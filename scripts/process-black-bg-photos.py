"""
Processa fotos com fundo preto (pano):
- remove fundo/piso → preto infinito
- alinha eixo do instrumento
- ajusta exposição e nitidez
- exporta WebP no padrão BL-U1RPRU (altura máx. 1600, quality 80)

Uso:
  python scripts/process-black-bg-photos.py
  python scripts/process-black-bg-photos.py --limit 5
"""
from __future__ import annotations

import argparse
import io
import math
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter, ImageOps
from rembg import remove

ROOT = Path(__file__).resolve().parents[1]
SRC_DIR = ROOT / "images" / "instrumentos" / "fotos"
OUT_DIR = SRC_DIR / "processadas"
SKIP_DIR = SRC_DIR / "ignoradas"

MAX_HEIGHT = 1600
MAX_WIDTH = 1200
PADDING = 0.06
WEBP_QUALITY = 80
MIN_SUBJECT_RATIO = 0.03
MAX_MEAN_BRIGHT = 0.62  # fotos claras sem fundo preto (acidentes)


def load_oriented(path: Path) -> Image.Image:
    img = Image.open(path)
    return ImageOps.exif_transpose(img).convert("RGB")


def is_likely_junk(img: Image.Image) -> bool:
    """Detecta fotos acidentais (ex.: jardim claro, sem fundo preto)."""
    small = img.resize((160, 160), Image.Resampling.BILINEAR)
    arr = np.asarray(small, dtype=np.float32) / 255.0
    mean = float(arr.mean())
    # bordas deveriam ser escuras em fotos de estúdio preto
    h, w = arr.shape[:2]
    border = np.concatenate(
        [
            arr[0, :, :].reshape(-1, 3),
            arr[-1, :, :].reshape(-1, 3),
            arr[:, 0, :].reshape(-1, 3),
            arr[:, -1, :].reshape(-1, 3),
        ],
        axis=0,
    )
    border_mean = float(border.mean())
    if mean > MAX_MEAN_BRIGHT and border_mean > 0.35:
        return True
    # muita saturação verde (externo)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    greenish = ((g > r + 0.05) & (g > b + 0.05)).mean()
    if greenish > 0.25 and mean > 0.35:
        return True
    return False


def cutout(img: Image.Image) -> Image.Image:
    buf = io.BytesIO()
    img.save(buf, format="JPEG", quality=92)
    return Image.open(io.BytesIO(remove(buf.getvalue()))).convert("RGBA")


def keep_main_component(rgba: Image.Image) -> Image.Image:
    """Mantém o maior componente conectado da máscara (remove pedaços do pedestal)."""
    from skimage.measure import label, regionprops

    alpha = np.array(rgba.split()[3])
    mask = alpha > 20
    if not mask.any():
        return rgba

    labels = label(mask, connectivity=1)
    props = regionprops(labels)
    if not props:
        return rgba

    props = sorted(props, key=lambda p: p.area, reverse=True)
    main = props[0]
    h = mask.shape[0]
    keep = labels == main.label
    for p in props[1:]:
        cy = p.centroid[0]
        # descarta fragmentos pequenos na base (pés do suporte)
        if cy > h * 0.78 and p.area < main.area * 0.12:
            continue
        if p.area > main.area * 0.15:
            keep |= labels == p.label

    out = np.array(rgba)
    out[~keep, 3] = 0
    return Image.fromarray(out, "RGBA")


def trim_stand_feet(rgba: Image.Image) -> Image.Image:
    """Corta faixas inferiores estreitas (pés do suporte ainda colados ao sujeito)."""
    alpha = np.array(rgba.split()[3]) > 40
    if not alpha.any():
        return rgba
    h, w = alpha.shape
    row_width = alpha.sum(axis=1).astype(np.float64)
    # largura típica do corpo: percentil alto das linhas centrais
    mid = row_width[int(h * 0.25) : int(h * 0.70)]
    if len(mid) == 0 or mid.max() < 10:
        return rgba
    body_w = float(np.percentile(mid[mid > 0], 75)) if (mid > 0).any() else float(mid.max())
    # sobe da base enquanto a faixa for estreita (< 42% da largura do corpo)
    cut_y = h
    y = h - 1
    thin_run = 0
    while y > int(h * 0.50):
        if row_width[y] < body_w * 0.42:
            thin_run += 1
            cut_y = y
            y -= 1
        else:
            break
    if thin_run < 6:
        return rgba
    # corta um pouco acima do início da parte fina
    cut_y = max(0, cut_y - 4)
    out = np.array(rgba)
    out[cut_y:, :, 3] = 0
    return Image.fromarray(out, "RGBA")


def trim_alpha(rgba: Image.Image, pad: int = 2) -> Image.Image:
    a = rgba.split()[3]
    bbox = a.getbbox()
    if not bbox:
        return rgba
    l, t, r, b = bbox
    l = max(0, l - pad)
    t = max(0, t - pad)
    r = min(rgba.width, r + pad)
    b = min(rgba.height, b + pad)
    return rgba.crop((l, t, r, b))


def estimate_tilt_degrees(rgba: Image.Image) -> float:
    """Retorna ângulo de correção (graus, PIL: + = anti-horário) para verticalizar."""
    alpha = np.array(rgba.split()[3])
    ys, xs = np.where(alpha > 40)
    if len(xs) < 200:
        return 0.0
    # só endireita sujeitos altos (instrumento de pé / 3/4)
    bbox = alpha.getbbox() if hasattr(alpha, "getbbox") else None
    # numpy mask bbox
    if ys.max() - ys.min() < (xs.max() - xs.min()) * 1.15:
        return 0.0
    step = max(1, len(xs) // 8000)
    xs = xs[::step].astype(np.float64)
    ys = ys[::step].astype(np.float64)
    x = xs - xs.mean()
    y = ys - ys.mean()
    cov = np.cov(np.vstack([x, y]))
    eigvals, eigvecs = np.linalg.eigh(cov)
    vx, vy = eigvecs[:, np.argmax(eigvals)]
    # ângulo do eixo maior em relação à vertical
    angle = math.degrees(math.atan2(vx, vy))
    # normaliza para [-90, 90]
    while angle > 90:
        angle -= 180
    while angle < -90:
        angle += 180
    # correção = -desvio
    correction = -angle
    if abs(correction) < 0.4 or abs(correction) > 16:
        return 0.0
    return correction


def rotate_rgba(rgba: Image.Image, angle: float) -> Image.Image:
    if abs(angle) < 0.3:
        return rgba
    return rgba.rotate(angle, resample=Image.Resampling.BICUBIC, expand=True, fillcolor=(0, 0, 0, 0))


def auto_exposure(rgba: Image.Image) -> Image.Image:
    """Ajusta brilho/contraste no sujeito (usa percentil 60, evita sombras profundas)."""
    arr = np.array(rgba)
    a = arr[:, :, 3] > 40
    if a.sum() < 100:
        return rgba
    rgb = arr[:, :, :3].astype(np.float32)
    lum = (0.2126 * rgb[:, :, 0] + 0.7152 * rgb[:, :, 1] + 0.0722 * rgb[:, :, 2])[a]
    # ignora pixels muito escuros (buraco da boca, laterais) na medição
    bright = lum[lum > np.percentile(lum, 25)]
    if len(bright) < 50:
        bright = lum
    ref = float(np.percentile(bright, 60)) / 255.0
    target = 0.52
    if ref < 0.01:
        return rgba
    factor = target / ref
    factor = max(0.82, min(1.55, factor))
    rgb_img = Image.fromarray(arr[:, :, :3], "RGB")
    rgb_img = ImageEnhance.Brightness(rgb_img).enhance(factor)
    contrast = 1.12 if ref < 0.40 else (0.97 if ref > 0.58 else 1.06)
    rgb_img = ImageEnhance.Contrast(rgb_img).enhance(contrast)
    # leve saturação para madeira
    rgb_img = ImageEnhance.Color(rgb_img).enhance(1.06)
    out = np.array(rgba)
    out[:, :, :3] = np.array(rgb_img)
    return Image.fromarray(out, "RGBA")


def sharpen(rgba: Image.Image) -> Image.Image:
    rgb = rgba.convert("RGB")
    sharp = rgb.filter(ImageFilter.UnsharpMask(radius=1.4, percent=140, threshold=2))
    out = Image.new("RGBA", rgba.size)
    out.paste(sharp, (0, 0))
    out.putalpha(rgba.split()[3])
    return out


def crush_near_black_edges(rgba: Image.Image) -> Image.Image:
    """Remove halo cinza residual nas bordas da máscara."""
    arr = np.array(rgba)
    a = arr[:, :, 3].astype(np.float32)
    # suaviza alpha e corta franjas fracas
    soft = Image.fromarray(a.astype(np.uint8)).filter(ImageFilter.GaussianBlur(0.8))
    a2 = np.array(soft).astype(np.float32)
    a2 = np.clip((a2 - 18) * (255.0 / (255 - 18)), 0, 255)
    arr[:, :, 3] = a2.astype(np.uint8)
    return Image.fromarray(arr, "RGBA")


def compose_black(rgba: Image.Image) -> Image.Image:
    """Centraliza sujeito em canvas preto, no padrão BL-U1RPRU."""
    rgba = trim_alpha(rgba)
    sw, sh = rgba.size
    if sw < 10 or sh < 10:
        raise ValueError("sujeito vazio após recorte")

    # escala: altura máx 1600, largura máx 1200, com padding
    max_w = int(MAX_WIDTH * (1 - 2 * PADDING))
    max_h = int(MAX_HEIGHT * (1 - 2 * PADDING))
    scale = min(max_w / sw, max_h / sh, 1.0)
    nw = max(1, int(sw * scale))
    nh = max(1, int(sh * scale))
    subject = rgba.resize((nw, nh), Image.Resampling.LANCZOS)

    # canvas com margem proporcional ao sujeito
    canvas_w = min(MAX_WIDTH, max(int(nw * (1 + 2 * PADDING)), nw + 40))
    canvas_h = min(MAX_HEIGHT, max(int(nh * (1 + 2 * PADDING)), nh + 40))
    # se sujeito alto, prioriza altura 1600
    if nh >= max_h * 0.95:
        canvas_h = MAX_HEIGHT
        canvas_w = min(MAX_WIDTH, max(int(nw * (1 + 2 * PADDING)), nw + 40))

    canvas = Image.new("RGB", (canvas_w, canvas_h), (0, 0, 0))
    x = (canvas_w - nw) // 2
    y = (canvas_h - nh) // 2
    canvas.paste(subject, (x, y), subject)
    return canvas


def process_one(src: Path, dst: Path) -> str:
    img = load_oriented(src)
    if is_likely_junk(img):
        return "junk"

    rgba = cutout(img)
    rgba = keep_main_component(rgba)
    rgba = trim_stand_feet(rgba)
    rgba = crush_near_black_edges(rgba)
    rgba = trim_alpha(rgba)

    alpha = np.array(rgba.split()[3])
    subject_ratio = float((alpha > 40).mean())
    if subject_ratio < MIN_SUBJECT_RATIO:
        return "empty"

    angle = estimate_tilt_degrees(rgba)
    rgba = rotate_rgba(rgba, angle)
    rgba = trim_alpha(rgba)
    rgba = auto_exposure(rgba)
    rgba = sharpen(rgba)

    out = compose_black(rgba)
    dst.parent.mkdir(parents=True, exist_ok=True)
    out.save(dst, format="WEBP", quality=WEBP_QUALITY, method=6)
    return f"ok angle={angle:.1f}° size={out.size[0]}x{out.size[1]}"


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limit", type=int, default=0)
    parser.add_argument("--only", help="Processar só um arquivo, ex: IMG_1621.JPG")
    args = parser.parse_args()

    if not SRC_DIR.is_dir():
        print(f"Pasta não encontrada: {SRC_DIR}", file=sys.stderr)
        return 1

    files = sorted(SRC_DIR.glob("IMG_*.JPG")) + sorted(SRC_DIR.glob("IMG_*.jpg"))
    # dedupe
    seen = set()
    uniq = []
    for f in files:
        if f.name.lower() in seen:
            continue
        seen.add(f.name.lower())
        uniq.append(f)
    files = uniq

    if args.only:
        files = [SRC_DIR / args.only]
    if args.limit:
        files = files[: args.limit]

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    SKIP_DIR.mkdir(parents=True, exist_ok=True)

    ok = skip = err = 0
    for i, src in enumerate(files, 1):
        dst = OUT_DIR / (src.stem + ".webp")
        print(f"[{i}/{len(files)}] {src.name}...", end=" ", flush=True)
        try:
            status = process_one(src, dst)
            if status == "junk" or status == "empty":
                skip += 1
                # move cópia do nome para ignoradas (lista)
                (SKIP_DIR / src.name).write_bytes(b"")  # marcador
                print(f"IGNORADA ({status})")
            else:
                ok += 1
                print(status)
        except Exception as exc:
            err += 1
            print(f"ERRO: {exc}")

    print(f"\nOK: {ok} | Ignoradas: {skip} | Erros: {err}")
    print(f"Saída: {OUT_DIR}")
    return 0 if err == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
