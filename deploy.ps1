# Script de despliegue automatizado a VPS
$vpsHost = "138.197.84.24"
$vpsUser = "root"

Write-Host "🚀 Iniciando despliegue de ANCU en $vpsHost..." -ForegroundColor Cyan

# 1. Asegurar que los cambios locales esten en Git
git add .
$status = git status --porcelain
if ($status) {
    git commit -m "chore(deploy): sincronizar cambios antes del despliegue"
    git push origin main
}

# 2. Actualizar repositorio en el VPS y recargar Nginx
ssh "${vpsUser}@${vpsHost}" "cd /var/www/ancu && git fetch origin && git reset --hard origin/main && chown -R www-data:www-data /var/www/ancu && systemctl reload nginx"

Write-Host "✅ Despliegue completado con éxito en http://$vpsHost/" -ForegroundColor Green
