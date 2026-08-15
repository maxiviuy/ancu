import paramiko
import sys
import os

# Configurar encoding seguro para Windows
if sys.platform == 'win32':
    sys.stdout.reconfigure(encoding='utf-8', errors='replace')

VPS_IP = '138.197.84.24'
PASSWORD = 'Astro2030Seguridad'

def run():
    print("[*] Sincronizando con VPS...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    try:
        client.connect(VPS_IP, username='root', password=PASSWORD, timeout=10)
        cmd = 'cd /var/www/ancu && git fetch origin && git reset --hard origin/main && cd /var/www/ancu/backend && node migrate.js && pm2 restart all && chown -R www-data:www-data /var/www/ancu && systemctl reload nginx'
        stdin, stdout, stderr = client.exec_command(cmd)
        out = stdout.read().decode('utf-8', errors='replace')
        err = stderr.read().decode('utf-8', errors='replace')
        print(out)
        if err:
            print("INFO/STDERR:", err)
        print("[+] Despliegue y migración completados con éxito en https://ancu.uy")
    except Exception as e:
        print("[-] Error en despliegue:", e)

if __name__ == '__main__':
    run()
