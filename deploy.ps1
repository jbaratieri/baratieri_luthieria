Write-Host "Iniciando deploy Baratieri Luthieria..."

# Garante que estamos na branch main
git checkout main

# Atualiza a branch local
git pull origin main

# Verifica se existe .gitignore
if (-not (Test-Path ".gitignore")) {
    Write-Host "Criando .gitignore..."
    @"
*.psd
*.zip
*.mp4
*.mov
*.bak
.backup/
assets/originais/
assets/raw/
"@ | Out-File -Encoding utf8 .gitignore
}

# Adiciona todas as alterações
git add .

# Cria commit (não quebra se não houver mudanças)
git commit -m "deploy ajustes e limpeza" --allow-empty

# Envia para o GitHub
git push origin main

Write-Host "Deploy concluido!"
