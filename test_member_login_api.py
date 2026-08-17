import paramiko
import json
import sys

sys.stdout.reconfigure(encoding='utf-8', errors='replace')
VPS_IP = '138.197.84.24'
PASSWORD = 'Astro2030Seguridad'

client = paramiko.SSHClient()
client.set_missing_host_key_policy(paramiko.AutoAddPolicy())
client.connect(VPS_IP, username='root', password=PASSWORD, timeout=15)

# Test 1: Alessandro Kunrath
cmd1 = """curl -s -X POST http://localhost:4000/api/members/login -H "Content-Type: application/json" -d '{"username": "1568", "password": "48775475"}'"""
stdin, stdout, stderr = client.exec_command(cmd1)
print("Test 1 (1568 + 48775475):\n", stdout.read().decode('utf-8'))

# Test 2: With ANCU- prefix
cmd2 = """curl -s -X POST http://localhost:4000/api/members/login -H "Content-Type: application/json" -d '{"username": "ANCU-1573", "password": "51429633"}'"""
stdin, stdout, stderr = client.exec_command(cmd2)
print("Test 2 (ANCU-1573 + 51429633):\n", stdout.read().decode('utf-8'))

# Test 3: Wrong Password
cmd3 = """curl -s -X POST http://localhost:4000/api/members/login -H "Content-Type: application/json" -d '{"username": "1568", "password": "99999999"}'"""
stdin, stdout, stderr = client.exec_command(cmd3)
print("Test 3 (Wrong Password):\n", stdout.read().decode('utf-8'))

client.close()
