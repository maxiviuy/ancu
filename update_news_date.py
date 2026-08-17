import sys
import paramiko

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
VPS_IP = '138.197.84.24'
PASSWORD = 'Astro2030Seguridad'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(VPS_IP, username='root', password=PASSWORD, timeout=15)

# Inspect news articles
stdin, stdout, stderr = client.exec_command('su - postgres -c "psql -d ancu_db -c \\"SELECT id, title, publish_date FROM news_articles ORDER BY id;\\""')
print("Current News Articles:\n", stdout.read().decode('utf-8'))

# Update publish_date to 2026-08-17
update_sql = """
UPDATE news_articles 
SET publish_date = '2026-08-17 10:00:00-03', updated_at = NOW()
WHERE publish_date > '2026-08-17 23:59:59-03' OR id = 1;
"""
sftp = client.open_sftp()
with sftp.file('/var/www/ancu/update_news_date.sql', 'w') as f:
    f.write(update_sql)

stdin, stdout, stderr = client.exec_command('su - postgres -c "psql -d ancu_db -f /var/www/ancu/update_news_date.sql"')
print("Update Output:\n", stdout.read().decode('utf-8'))

stdin, stdout, stderr = client.exec_command('su - postgres -c "psql -d ancu_db -c \\"SELECT id, title, publish_date FROM news_articles ORDER BY id;\\""')
print("Updated News Articles:\n", stdout.read().decode('utf-8'))

client.close()
