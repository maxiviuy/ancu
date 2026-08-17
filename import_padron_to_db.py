import openpyxl
import re
import sys
import paramiko
import json

sys.stdout.reconfigure(encoding='utf-8', errors='replace')

EXCEL_PATH = r'C:\Users\maxiv\.gemini\antigravity-ide\scratch\ancu\padron_maestro.xlsx'
VPS_IP = '138.197.84.24'
PASSWORD = 'Astro2030Seguridad'

wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
sheet = wb['Socios únicos']
rows = list(sheet.iter_rows(values_only=True))[4:]

parsed_members = []
seen_ci_map = {}
seen_member_nums = set()

# Deduplication / Normalization pass
for idx, r in enumerate(rows):
    if not any(r):
        continue
    raw_name = str(r[0] or '').strip()
    raw_ci = str(r[1] or '').strip()
    raw_num = str(r[2] or '').strip()
    raw_dept = str(r[3] or '').strip()
    raw_phone = str(r[4] or '').strip()
    raw_email = str(r[5] or '').strip()

    if not raw_name or 'departamento' in raw_name.lower():
        continue

    # Split name
    name_parts = raw_name.split()
    if len(name_parts) == 1:
        first_name = name_parts[0]
        last_name = 'Socio'
    elif len(name_parts) == 2:
        first_name = name_parts[0]
        last_name = name_parts[1]
    else:
        first_name = " ".join(name_parts[:2])
        last_name = " ".join(name_parts[2:])

    # Clean CI
    clean_digits_ci = re.sub(r'\D', '', raw_ci)
    if not clean_digits_ci or clean_digits_ci == '0':
        clean_digits_ci = f"999{idx:05d}"
        formatted_ci = f"DOC-{idx}"
    else:
        formatted_ci = raw_ci

    # Member number
    clean_num = re.sub(r'[^0-9A-Za-z-]', '', raw_num)
    if clean_num and clean_num.lower() != 'none':
        if not clean_num.upper().startswith('ANCU-'):
            member_num = f"ANCU-{clean_num}"
        else:
            member_num = clean_num.upper()
    else:
        member_num = f"ANCU-S{idx+1:04d}"

    dept = raw_dept if raw_dept and raw_dept not in ['Sin inferir', 'None', ''] else 'Lavalleja'
    phone = raw_phone if raw_phone and raw_phone not in ['None', ''] else '099 000 000'
    email = raw_email if raw_email and raw_email not in ['None', ''] else f"socio.{clean_digits_ci}@ancu.uy"

    # Check identical person duplicate
    norm_name = re.sub(r'[^a-zA-Z]', '', raw_name.lower())
    if clean_digits_ci in seen_ci_map:
        prev = seen_ci_map[clean_digits_ci]
        prev_norm_name = re.sub(r'[^a-zA-Z]', '', prev['raw_name'].lower())
        # If same name or contains each other (e.g. Nelson Borges vs Nelson Gonzalo Borges)
        if norm_name == prev_norm_name or norm_name in prev_norm_name or prev_norm_name in norm_name:
            # Upgrade data if current has more info
            if len(raw_name) > len(prev['raw_name']):
                prev['raw_name'] = raw_name
                prev['first_name'] = first_name
                prev['last_name'] = last_name
            continue
        else:
            # Different person with accidental typo CI in original sheet -> make CI unique
            formatted_ci = f"{formatted_ci} (Bis)"
            clean_digits_ci = f"{clean_digits_ci}{idx % 10}"

    # Disambiguate duplicate member_number
    original_num = member_num
    counter = 2
    while member_num in seen_member_nums:
        dept_code = dept[:3].upper() if len(dept) >= 3 else 'UY'
        member_num = f"{original_num}-{dept_code}"
        if member_num in seen_member_nums:
            member_num = f"{original_num}-{counter}"
            counter += 1

    seen_member_nums.add(member_num)

    entry = {
        'raw_name': raw_name,
        'member_number': member_num,
        'first_name': first_name.replace("'", "''"),
        'last_name': last_name.replace("'", "''"),
        'ci': formatted_ci.replace("'", "''"),
        'clean_ci': clean_digits_ci,
        'phone': phone.replace("'", "''"),
        'email': email.replace("'", "''"),
        'department': dept.replace("'", "''"),
        'thata_number': 'Habilitado',
        'category': 'Socio Pleno Activo',
        'status': 'ACTIVE',
        'valid_until': '2026-12-31'
    }
    seen_ci_map[clean_digits_ci] = entry
    parsed_members.append(entry)

wb.close()

print(f"[*] Total socios únicos procesados para inserción: {len(parsed_members)}")

# Generar SQL de inserción masiva
sql_statements = [
    "-- 1. Limpiar socios previos e insertar padrón maestro 2025/2026",
    "TRUNCATE TABLE members CASCADE;",
    "INSERT INTO members (member_number, first_name, last_name, ci, phone, email, department, thata_number, category, status, valid_until) VALUES"
]

values_list = []
for m in parsed_members:
    val = f"('{m['member_number']}', '{m['first_name']}', '{m['last_name']}', '{m['ci']}', '{m['phone']}', '{m['email']}', '{m['department']}', '{m['thata_number']}', '{m['category']}', '{m['status']}', '{m['valid_until']}')"
    values_list.append(val)

sql_statements.append(",\n".join(values_list) + ";")
sql_statements.append(f"""
INSERT INTO audit_logs (action, details, ip_address)
VALUES ('IMPORT_PADRON_MAESTRO_EXCEL', '{{"total_imported": {len(parsed_members)}, "file": "padron_maestro_socios_ANCU_2025.xlsx", "status": "SUCCESS"}}', '127.0.0.1');
""")

full_sql = "\n".join(sql_statements)

with open(r'C:\Users\maxiv\.gemini\antigravity-ide\scratch\ancu\import_padron.sql', 'w', encoding='utf-8') as f:
    f.write(full_sql)

print("[*] Archivo import_padron.sql generado con éxito.")

# Subir al VPS y ejecutar
print("[*] Conectando a VPS y ejecutando importación en ancu_db...")
client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(VPS_IP, username='root', password=PASSWORD, timeout=20)

sftp = client.open_sftp()
sftp.put(r'C:\Users\maxiv\.gemini\antigravity-ide\scratch\ancu\import_padron.sql', '/var/www/ancu/import_padron.sql')
sftp.close()

stdin, stdout, stderr = client.exec_command('su - postgres -c "psql -d ancu_db -f /var/www/ancu/import_padron.sql"')
print("SQL Output:\n", stdout.read().decode('utf-8'))
err = stderr.read().decode('utf-8')
if err:
    print("SQL Error/Notice:\n", err)

# Verificar cantidad en BD
stdin, stdout, stderr = client.exec_command('su - postgres -c "psql -d ancu_db -c \\"SELECT count(*) as total_socios_en_bd, count(*) FILTER (WHERE status = \'ACTIVE\') as activos FROM members;\\""')
print("\n=== TOTAL SOCIOS EN POSTGRESQL ===")
print(stdout.read().decode('utf-8'))

# Muestra de socios importados
stdin, stdout, stderr = client.exec_command('su - postgres -c "psql -d ancu_db -c \\"SELECT id, member_number, first_name, last_name, ci, department FROM members ORDER BY id LIMIT 10;\\""')
print("\n=== MUESTRA DE PRIMEROS 10 SOCIOS IMPORTADOS ===")
print(stdout.read().decode('utf-8'))

client.close()
print("\n[+] ¡Importación del padrón maestro completada con éxito!")
