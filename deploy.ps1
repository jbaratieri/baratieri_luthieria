# Deploy da loja (vitrine) — Luthieria Baratieri
# Pré-requisito: Node.js para regenerar fichas e sitemap (npm run build).

$ErrorActionPreference = "Stop"

# Regenera instrumento/*.html e sitemap.xml a partir de data/baratieri_instruments.json
if (Get-Command node -ErrorAction SilentlyContinue) {
  Push-Location $PSScriptRoot
  try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
      Write-Host "ERRO: npm run build falhou (codigo $LASTEXITCODE)."
      exit 1
    }
  } finally {
    Pop-Location
  }
} else {
  Write-Host "AVISO: Node.js nao encontrado. Confira se instrumento/ e sitemap.xml estao atualizados antes do push."
}

git checkout main
git pull origin main

git add .

$ts = Get-Date -Format "yyyy-MM-dd HH:mm"
git commit -m "deploy: loja Luthieria Baratieri ($ts)" --allow-empty

# A branch main dispara a publicacao (ex.: Vercel ligado ao repositorio).
git push origin main

Write-Host "Deploy concluido: loja.luthieriabaratieri.com.br"
