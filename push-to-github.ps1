param([string]$RepoUrl)

$ErrorActionPreference = 'Stop'
Set-Location 'C:\Users\User\VacantesWatcher'

if (-not $RepoUrl) {
  $RepoUrl = Read-Host 'Pega la URL HTTPS de tu repo (https://github.com/TU_USUARIO/TU_REPO.git)'
}
if (-not $RepoUrl) { throw 'No se indicó la URL del repo.' }

if (-not (Test-Path '.git')) {
  git init | Out-Null
  git config user.email 'watcher@localhost'
  git config user.name 'VacantesWatcher'
}

git add .
$status = git status --porcelain
if ($status) {
  git commit -m 'Vigilante de vacantes MEN con GitHub Actions' | Out-Null
} else {
  Write-Output 'No hay cambios nuevos para subir.'
}

git branch -M main
$remotes = @(git remote)
if ($remotes -contains 'origin') { git remote set-url origin $RepoUrl }
else { git remote add origin $RepoUrl }

git push -u origin main

Write-Output '========================================'
Write-Output 'CODIGO SUBIDO A GITHUB'
Write-Output 'Ahora agrega los secretos TELEGRAM_TOKEN y TELEGRAM_CHAT_ID'
Write-Output 'y activa permisos de lectura/escritura en Settings > Actions > General.'
Write-Output '========================================'
