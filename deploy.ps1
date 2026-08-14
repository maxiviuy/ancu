# Script de despliegue automatizado a VPS ANCU
$vpsHost = "138.197.84.24"
$vpsUser = "root"

Write-Host "🚀 Iniciando despliegue de ANCU Portal & Backend en $vpsHost..." -ForegroundColor Cyan

# 1. Asegurar que los cambios locales esten en Git
git add .
$status = git status --porcelain
if ($status) {
    git commit -m "feat(backend): integracion completa de backend Node.js, PostgreSQL y API REST"
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

echo "🌐 Actualizando configuración Nginx /api/..."
if ! grep -q "location /api/" /etc/nginx/sites-available/ancu; then
    sed -i '/location \/ {/i \    # API Reverse Proxy\n    location /api/ {\n        proxy_pass http://127.0.0.1:4000;\n        proxy_http_version 1.1;\n        proxy_set_header Upgrade $http_upgrade;\n        proxy_set_header Connection '\''upgrade'\'';\n        proxy_set_header Host $host;\n        proxy_set_header X-Real-IP $remote_addr;\n        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n        proxy_set_header X-Forwarded-Proto $scheme;\n    }\n' /etc/nginx/sites-available/ancu
fi

nginx -t
systemctl reload nginx
chown -R www-data:www-data /var/www/ancu

echo "✅ Verificando endpoint de salud..."
curl -s http://127.0.0.1:4000/api/health || true
'@

ssh "${vpsUser}@${vpsHost}" $remoteScript

Write-Host "✅ Despliegue completado con éxito en https://ancu.uy (y http://$vpsHost/)" -ForegroundColor Green
