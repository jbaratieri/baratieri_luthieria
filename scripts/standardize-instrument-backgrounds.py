"""
Padroniza fundos das fotos de instrumentos: recorte + gradiente cinza quente.
Uso (na raiz do projeto):
  python scripts/standardize-instrument-backgrounds.py
  python scripts/standardize-instrument-backgrounds.py --dry-run
  python scripts/standardize-instrument-backgrounds.py --folder BL-U1RPRU
"""
from __future__ import annotations

import argparse
import io
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageFilter
from rembg import remove

ROOT = Path(__file__).resolve().parents[1]
IMAGES_ROOT = ROOT / "images" / "instrumentos"
BACKUP_ROOT = ROOT / ".backup" / "instrumentos-original"

BG_TOP = (0xF7, 0xF4, 0xEF)
BG_BOTTOM = (0xE8, 0xE3, 0xDB)
CANVAS_SIZE = (1200, 1600)
PADDING_RATIO = 0.08
SHADOW_OFFSET = (0, 18)
SHADOW_BLUR = 28
SHADOW_OPACITY = 0.22
WEBP_QUALITY = 82


def make_gradient(size: tuple[int, int]) -> Image.Image:
    w, h = size
    top = np.array(BG_TOP, dtype=np.float32)
    bottom = np.array(BG_BOTTOM, dtype=np.float32)
    row = np.linspace(0.0, 1.0, h, dtype=np.float32)[:, None, None]
    rgb = np.repeat(top * (1.0 - row) + bottom * row, w, axis=1)
    return Image.fromarray(rgb.astype(np.uint8), mode="RGB")


def trim_transparent(img: Image.Image) -> Image.Image:
    if img.mode != "RGBA":
        img = img.convert("RGBA")
    alpha = img.split()[3]
    bbox = alpha.getbbox()
    if not bbox:
        return img
    return img.crop(bbox)


def fit_subject(subject: Image.Image, canvas_size: tuple[int, int]) -> Image.Image:
    cw, ch = canvas_size
    pad_x = int(cw * PADDING_RATIO)
    pad_y = int(ch * PADDING_RATIO)
    max_w = cw - pad_x * 2
    max_h = ch - pad_y * 2
    sw, sh = subject.size
    scale = min(max_w / sw, max_h / sh, 1.0)
    nw, nh = max(1, int(sw * scale)), max(1, int(sh * scale))
    return subject.resize((nw, nh), Image.Resampling.LANCZOS)


def make_shadow(subject: Image.Image) -> Image.Image:
    alpha = subject.split()[3]
    shadow = Image.new("RGBA", subject.size, (0, 0, 0, 0))
    shadow.putalpha(alpha)
    shadow = shadow.filter(ImageFilter.GaussianBlur(SHADOW_BLUR))
    r, g, b, a = shadow.split()
    a = a.point(lambda v: int(v * SHADOW_OPACITY))
    shadow = Image.merge("RGBA", (r, g, b, a))
    return shadow


def process_image(src: Path, dst: Path, backup: Path | None) -> None:
    raw = src.read_bytes()
    cutout = Image.open(io.BytesIO(remove(raw))).convert("RGBA")
    cutout = trim_transparent(cutout)
    subject = fit_subject(cutout, CANVAS_SIZE)

    canvas = make_gradient(CANVAS_SIZE).convert("RGBA")
    shadow = make_shadow(subject)

    sw, sh = subject.size
    x = (CANVAS_SIZE[0] - sw) // 2
    y = (CANVAS_SIZE[1] - sh) // 2

    canvas.alpha_composite(shadow, (x + SHADOW_OFFSET[0], y + SHADOW_OFFSET[1]))
    canvas.alpha_composite(subject, (x, y))

    out = canvas.convert("RGB")
    if backup and not backup.exists():
        backup.parent.mkdir(parents=True, exist_ok=True)
        backup.write_bytes(src.read_bytes())

    out.save(dst, format="WEBP", quality=WEBP_QUALITY, method=6)


def iter_images(folder: Path) -> list[Path]:
    files = [p for p in folder.glob("*.webp") if p.is_file()]
    return sorted(files, key=lambda p: int(p.stem) if p.stem.isdigit() else p.stem)


def main() -> int:
    parser = argparse.ArgumentParser(description="Padroniza fundos das fotos de instrumentos.")
    parser.add_argument("--folder", help="Processar apenas uma pasta (ex.: BL-U1RPRU)")
    parser.add_argument("--dry-run", action="store_true", help="Lista arquivos sem processar")
    parser.add_argument("--no-backup", action="store_true", help="Não salvar backup dos originais")
    args = parser.parse_args()

    if not IMAGES_ROOT.is_dir():
        print(f"Pasta não encontrada: {IMAGES_ROOT}", file=sys.stderr)
        return 1

    folders = sorted(p for p in IMAGES_ROOT.iterdir() if p.is_dir())
    if args.folder:
        folders = [p for p in folders if p.name == args.folder]
        if not folders:
            print(f"Pasta não encontrada: {args.folder}", file=sys.stderr)
            return 1

    total = 0
    for folder in folders:
        images = iter_images(folder)
        if not images:
            continue
        print(f"\n{folder.name} ({len(images)} fotos)")
        for src in images:
            rel = src.relative_to(IMAGES_ROOT)
            backup = None if args.no_backup else BACKUP_ROOT / rel
            if args.dry_run:
                print(f"  - {rel}")
                total += 1
                continue
            print(f"  {src.name}...", end=" ", flush=True)
            try:
                process_image(src, src, backup)
                print("ok")
                total += 1
            except Exception as exc:
                print(f"ERRO: {exc}")

    print(f"\nConcluído: {total} imagem(ns).")
    if not args.no_backup and not args.dry_run:
        print(f"Backups em: {BACKUP_ROOT}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
