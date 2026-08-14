# Script de despliegue automatizado a VPS ANCU
$vpsHost = "138.197.84.24"
$vpsUser = "root"

Write-Host "🚀 Iniciando despliegue de ANCU Portal & Backend en $vpsHost..." -ForegroundColor Cyan

# 1. Asegurar que los cambios locales esten en Git
git add .
$status = git status --porcelain
if ($status) {
    git commit -m "feat(nginx): sincronizar proxy /api/ y configuracion SSL"
    git push origin main
}

# 2. Comandos remotos en VPS: Git + PostgreSQL + NPM + Migraciones + PM2 + Nginx
$remoteScript = @'
set -e
echo "📦 Actualizando repositorio /var/www/ancu..."
cd /var/www/ancu
git fetch origin
git reset --hard origin/main

echo "🗄️ Configurando base de datos PostgreSQL..."
chmod +x /var/www/ancu/backend/setup_vps_db.sh
bash /var/www/ancu/backend/setup_vps_db.sh

echo "⚡ Instalando dependencias de Node.js..."
cd /var/www/ancu/backend
npm install --production

echo "🌱 Ejecutando migraciones SQL..."
node migrate.js

echo "🔄 Iniciando/Reiniciando servicio backend con PM2..."
pm2 describe ancu-backend > /dev/null 2>&1 && pm2 restart ancu-backend || pm2 start server.js --name ancu-backend
pm2 save

echo "🌐 Aplicando configuración Nginx..."
cp /var/www/ancu/ancu.nginx.conf /etc/nginx/sites-available/ancu
nginx -t
systemctl reload nginx
chown -R www-data:www-data /var/www/ancu

echo "✅ Verificando endpoint de salud de la API..."
curl -s http://127.0.0.1:4000/api/health
echo ""
curl -s http://127.0.0.1/api/health || true
'@

ssh "${vpsUser}@${vpsHost}" $remoteScript

Write-Host "✅ Despliegue completado con éxito en https://ancu.uy (y http://$vpsHost/)" -ForegroundColor Green
