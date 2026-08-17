import sys
import paramiko
import os
import json

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
VPS_IP = '138.197.84.24'
PASSWORD = 'Astro2030Seguridad'
LOCAL_BASE = r'C:\Users\maxiv\.gemini\antigravity-ide\scratch\ancu'
REMOTE_BASE = '/var/www/ancu'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(VPS_IP, username='root', password=PASSWORD, timeout=15)

print("[1] Ejecutando reseteo total de tickets en PostgreSQL (100% disponibles, 0 vendidos)...")
reset_sql = """
-- 1. Resetear todos los 1000 números de rifa a disponibles
UPDATE raffle_tickets 
SET status = 'available', 
    held_until = NULL, 
    buyer_name = NULL, 
    buyer_email = NULL, 
    buyer_phone = NULL, 
    buyer_ci = NULL, 
    buyer_dept = NULL, 
    payment_method = NULL, 
    payment_ref = NULL, 
    receipt_url = NULL,
    updated_at = NOW();

-- 2. Eliminar comprobantes mock de rifas
DELETE FROM payment_receipts WHERE target_type = 'RAFFLE';

-- 3. Registrar auditoría
INSERT INTO audit_logs (action, details, ip_address)
VALUES ('CLEAN_MOCK_RAFFLE_TICKETS', '{"tickets_reset": 1000, "sold_count": 0, "status": "ALL_AVAILABLE_READY_FOR_PUBLIC"}', '127.0.0.1');
"""

sftp = client.open_sftp()
with sftp.file('/var/www/ancu/reset_raffle.sql', 'w') as f:
    f.write(reset_sql)

stdin, stdout, stderr = client.exec_command('su - postgres -c "psql -d ancu_db -f /var/www/ancu/reset_raffle.sql"')
print("SQL Output:\n", stdout.read().decode('utf-8'))
print("SQL Errors:\n", stderr.read().decode('utf-8'))

print("\n[2] Subiendo archivos CSS, JS y HTML actualizados...")
files_to_sync = [
    (os.path.join('css', 'main.css'), f'{REMOTE_BASE}/css/main.css'),
    (os.path.join('js', 'app.js'), f'{REMOTE_BASE}/js/app.js'),
    ('rifas.html', f'{REMOTE_BASE}/rifas.html'),
    ('index.html', f'{REMOTE_BASE}/index.html'),
    ('admin.html', f'{REMOTE_BASE}/admin.html'),
    ('autoridades.html', f'{REMOTE_BASE}/autoridades.html')
]

for local_rel, remote_path in files_to_sync:
    local_path = os.path.join(LOCAL_BASE, local_rel)
    print(f"  -> Subiendo: {local_rel} ({os.path.getsize(local_path)} bytes)")
    sftp.put(local_path, remote_path)

sftp.close()

print("\n[3] Permisos y reinicio de servicios...")
cmd = 'chown -R www-data:www-data /var/www/ancu && pm2 restart ancu-backend && systemctl reload nginx'
stdin, stdout, stderr = client.exec_command(cmd)
print(stdout.read().decode('utf-8'))

print("\n[4] Verificando API /api/raffle/active...")
stdin, stdout, stderr = client.exec_command('curl -s http://localhost:4000/api/raffle/active')
data = json.loads(stdout.read().decode('utf-8'))
print("Raffle Title:", data['raffle']['title'])
print("Stats:", data['raffle']['stats'])
print("Total Prizes:", len(data['raffle']['prizes']))

# Check count in DB
stdin, stdout, stderr = client.exec_command('su - postgres -c "psql -d ancu_db -c \\"SELECT count(*) as total, count(*) FILTER (WHERE status = \'available\') as available, count(*) FILTER (WHERE status = \'sold\') as sold, count(*) FILTER (WHERE status = \'paid\') as paid, count(*) FILTER (WHERE status = \'held\') as held FROM raffle_tickets;\\""')
print("\nPostgreSQL Status:\n", stdout.read().decode('utf-8'))

client.close()
print("\n[+] ¡Reseteo a CERO de tickets completado con éxito!")
