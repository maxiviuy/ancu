import sys
import paramiko
import json

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
VPS_IP = '138.197.84.24'
PASSWORD = 'Astro2030Seguridad'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(VPS_IP, username='root', password=PASSWORD, timeout=15)

stdin, stdout, stderr = client.exec_command('su - postgres -c "psql -d ancu_db -c \\"SELECT prize_order, title, image_url, estimated_value FROM raffle_prizes ORDER BY prize_order;\\""')
print("=== RAFFLE PRIZES IN DB ===")
print(stdout.read().decode('utf-8'))

stdin, stdout, stderr = client.exec_command('curl -s http://localhost:4000/api/raffle/active')
data = json.loads(stdout.read().decode('utf-8'))
print("=== API ACTIVE RAFFLE PRIZES ===")
for p in data['raffle']['prizes']:
    print(f"  [Prize {p['order']}] {p['title']} -> {p['imageUrl']} (${p['estimatedValue']} USD)")

stdin, stdout, stderr = client.exec_command('curl -s http://localhost:4000/api/authorities')
data = json.loads(stdout.read().decode('utf-8'))
print("\n=== API AUTHORITIES ===")
print(f"Mandate Period: {data['mandatePeriod']}")
for a in data['authorities']:
    print(f"  [{a['role_title']}] {a['name']} -> photo: {a['photo_url']}")

stdin, stdout, stderr = client.exec_command('curl -s http://localhost:4000/api/admin/members')
data = json.loads(stdout.read().decode('utf-8'))
print(f"\n=== API ADMIN MEMBERS ({len(data['members'])} socios) ===")
for m in data['members']:
    print(f"  [{m['member_number']}] {m['first_name']} {m['last_name']} (CI: {m['ci']}) -> {m['status']} / valid: {m['valid_until']}")

client.close()
