Write-Host "🚀 Iniciando deploy Baratieri Luthieria..." -ForegroundColor Cyan

# Garante que estamos na branch main
git checkout main

# Atualiza a branch local
git pull origin main

# Adiciona todas as alterações
git add .

# Cria um commit (se não houver alterações, não quebra)
git commit -m "formatação imagens menores" --allow-empty

# Envia para a branch main (GitHub Pages já publica direto da main)
git push origin main

Write-Host "✅ Deploy concluído!"
