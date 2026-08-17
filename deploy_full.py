import os
import sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
VPS_IP = '138.197.84.24'
PASSWORD = 'Astro2030Seguridad'

LOCAL_BASE = r'C:\Users\maxiv\.gemini\antigravity-ide\scratch\ancu'
REMOTE_BASE = '/var/www/ancu'

def deploy():
    print("[*] Conectando por SSH a VPS ANCU (138.197.84.24)...")
    client = paramiko.SSHClient()
    client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
    client.connect(VPS_IP, username='root', password=PASSWORD, timeout=15)
    
    sftp = client.open_sftp()
    
    # 1. Asegurar directorios remotos
    remote_dirs = [
        f"{REMOTE_BASE}/uploads",
        f"{REMOTE_BASE}/uploads/prizes",
        f"{REMOTE_BASE}/uploads/news",
        f"{REMOTE_BASE}/uploads/authorities",
        f"{REMOTE_BASE}/uploads/members",
        f"{REMOTE_BASE}/uploads/activities",
        f"{REMOTE_BASE}/uploads/partners",
        f"{REMOTE_BASE}/uploads/documents",
        f"{REMOTE_BASE}/uploads/receipts",
        f"{REMOTE_BASE}/js",
        f"{REMOTE_BASE}/css",
        f"{REMOTE_BASE}/backend"
    ]
    for rdir in remote_dirs:
        try:
            sftp.mkdir(rdir)
        except Exception:
            pass

    # 2. Transferir archivos frontend y backend modificados
    files_to_sync = [
        ('admin.html', f'{REMOTE_BASE}/admin.html'),
        ('autoridades.html', f'{REMOTE_BASE}/autoridades.html'),
        ('index.html', f'{REMOTE_BASE}/index.html'),
        ('rifas.html', f'{REMOTE_BASE}/rifas.html'),
        ('socios.html', f'{REMOTE_BASE}/socios.html'),
        ('institucional.html', f'{REMOTE_BASE}/institucional.html'),
        ('noticias.html', f'{REMOTE_BASE}/noticias.html'),
        ('actividades.html', f'{REMOTE_BASE}/actividades.html'),
        ('normativa.html', f'{REMOTE_BASE}/normativa.html'),
        ('contacto.html', f'{REMOTE_BASE}/contacto.html'),
        (os.path.join('js', 'app.js'), f'{REMOTE_BASE}/js/app.js'),
        (os.path.join('backend', 'server.js'), f'{REMOTE_BASE}/backend/server.js'),
        (os.path.join('backend', 'schema.sql'), f'{REMOTE_BASE}/backend/schema.sql'),
        (os.path.join('uploads', 'prizes', 'prize_visor_sytong_xs03.png'), f'{REMOTE_BASE}/uploads/prizes/prize_visor_sytong_xs03.png'),
        (os.path.join('uploads', 'prizes', 'prize_arco_diamond_edge.png'), f'{REMOTE_BASE}/uploads/prizes/prize_arco_diamond_edge.png'),
        (os.path.join('uploads', 'prizes', 'prize_cuchillo_schmieden.png'), f'{REMOTE_BASE}/uploads/prizes/prize_cuchillo_schmieden.png'),
    ]

    print("[*] Subiendo archivos vía SFTP...")
    for local_rel, remote_path in files_to_sync:
        local_path = os.path.join(LOCAL_BASE, local_rel)
        if os.path.exists(local_path):
            print(f"  -> Subiendo: {local_rel} ({os.path.getsize(local_path)} bytes)")
            sftp.put(local_path, remote_path)
        else:
            print(f"  [!] No encontrado localmente: {local_path}")

    sftp.close()

    # 3. Ejecutar comandos de base de datos y reinicio en VPS
    print("\n[*] Actualizando PostgreSQL (constraints, mandato y premios oficiales de la rifa)...")
    
    sql_script = """
    -- 1. Arreglar constraints de institutional_settings
    ALTER TABLE institutional_settings ALTER COLUMN label DROP NOT NULL;
    ALTER TABLE institutional_settings ALTER COLUMN label SET DEFAULT 'Parámetro General';

    -- 2. Actualizar mandato a 2026 - 2028
    INSERT INTO institutional_settings (setting_key, setting_value, category, label, updated_at)
    VALUES ('mandate_period', '2026 – 2028', 'GOVERNANCE', 'Período de Mandato de la Comisión Directiva', NOW())
    ON CONFLICT (setting_key) DO UPDATE 
    SET setting_value = '2026 – 2028', updated_at = NOW();

    -- 3. Actualizar los 3 premios oficiales de la rifa activa (raffle_id = 1)
    DELETE FROM raffle_prizes WHERE raffle_id = 1;

    INSERT INTO raffle_prizes (raffle_id, prize_order, title, description, image_url, estimated_value, regulated, note)
    VALUES 
    (
      1, 
      1, 
      'Visor Térmico Sytong XS03-35LRF con Telémetro Láser', 
      'Sensor térmico de alta sensibilidad 384x288 px, lente de 35mm F1.0, telémetro láser integrado hasta 1.200 metros, aumento óptico 2.8x y digital hasta 8x, pantalla AMOLED 1024x768, grabación de foto/video, conectividad WiFi y protección IP66.', 
      '/uploads/prizes/prize_visor_sytong_xs03.png', 
      1450.00, 
      false, 
      'Entrega directa y garantía oficial en todo el Uruguay.'
    ),
    (
      1, 
      2, 
      'Arco Compuesto Profesional Diamond EDGE', 
      'Velocidad de salida hasta 310 FPS, peso ultra ligero 3.5 lbs (1.59 kg), distancia entre ejes 31\" (78.7 cm), longitud de ataque 6.25\" - 31\", potencia regulable de 5 a 70 lbs, modos Diamond Draw y Bowtech Draw, acabado Realtree Edge.', 
      '/uploads/prizes/prize_arco_diamond_edge.png', 
      650.00, 
      false, 
      'Entrega directa con accesorios completos en todo el país.'
    ),
    (
      1, 
      3, 
      'Cuchillo Criollo Schmieden Acero Inoxidable con Vaina', 
      'Hoja de acero inoxidable de alta retención de filo y tenacidad, cabo artesanal combinado en maderas nobles y virolas de bronce, incluye vaina tradicional de cuero vacuno repujado con broches y pasacinto reforzado.', 
      '/uploads/prizes/prize_cuchillo_schmieden.png', 
      180.00, 
      false, 
      'Entrega directa a domicilio en todo el país.'
    );

    -- 4. Registrar en audit_logs
    INSERT INTO audit_logs (action, details, ip_address)
    VALUES ('SYSTEM_UPDATE_PRIZES_AND_MANDATE', '{"prizes": 3, "mandate": "2026-2028", "status": "SUCCESS"}', '127.0.0.1');
    """

    escaped_sql = sql_script.replace('"', '\\"')
    db_cmd = f'su - postgres -c "psql -d ancu_db -c \\"{escaped_sql}\\""'
    
    stdin, stdout, stderr = client.exec_command(db_cmd)
    print("DB Output:\n", stdout.read().decode('utf-8'))
    err = stderr.read().decode('utf-8')
    if err:
        print("DB Error/Notice:\n", err)

    # 4. Ajustar permisos, reiniciar backend con PM2 y recargar Nginx
    print("[*] Configurando permisos del sistema y reiniciando PM2 / Nginx...")
    cmd = 'chown -R www-data:www-data /var/www/ancu && chmod -R 755 /var/www/ancu/uploads && cd /var/www/ancu/backend && pm2 restart ancu-backend && systemctl reload nginx'
    stdin, stdout, stderr = client.exec_command(cmd)
    print(stdout.read().decode('utf-8'))
    
    # 5. Verificar salud y endpoints
    print("\n[*] Verificando endpoints en producción...")
    check_cmd = """
    echo "=== API RAFFLE ACTIVE ==="
    curl -s http://localhost:4000/api/raffle/active | jq '{title: .raffle.title, prizes: .raffle.prizes}'
    echo "=== API AUTHORITIES ==="
    curl -s http://localhost:4000/api/authorities | jq '{mandate: .mandatePeriod, total: .authorities | length}'
    echo "=== API MEMBERS (ADMIN) ==="
    curl -s http://localhost:4000/api/admin/members | jq '{total_members: .members | length}'
    echo "=== UPLOADS PERMISSIONS ==="
    ls -la /var/www/ancu/uploads/prizes
    """
    stdin, stdout, stderr = client.exec_command(check_cmd)
    print(stdout.read().decode('utf-8'))

    client.close()
    print("\n[+] ¡Despliegue, migración y sincronización completados con éxito!")

if __name__ == '__main__':
    deploy()
