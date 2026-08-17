import openpyxl
import re

wb = openpyxl.load_workbook(r'C:\Users\maxiv\.gemini\antigravity-ide\scratch\ancu\padron_maestro.xlsx', data_only=True)
sheet = wb['Socios únicos']
rows = list(sheet.iter_rows(values_only=True))[4:]

dup_cis = ['48115453', '54671409', '51143085', '43365009', '39146164', '45603722']

print("=== INSPECTION OF DUPLICATE CIS IN 'Socios únicos' ===")
for r in rows:
    name = str(r[0] or '').strip()
    ci = str(r[1] or '').strip()
    clean_ci = re.sub(r'\D', '', ci)
    num = str(r[2] or '').strip()
    dept = str(r[3] or '').strip()
    if clean_ci in dup_cis:
        print(f"CI: {clean_ci} ({ci}) | Name: '{name}' | Num: '{num}' | Dept: '{dept}' | Source: '{r[7]}'")

print("\n=== NON-PERSON / HEADER ROWS ===")
for idx, r in enumerate(rows):
    name = str(r[0] or '').strip()
    ci = str(r[1] or '').strip()
    clean_ci = re.sub(r'\D', '', ci)
    if not clean_ci or 'departamento' in name.lower() or len(clean_ci) < 6:
        print(f"Row {idx+5}: Name: '{name}', CI: '{ci}', Num: '{r[2]}', Dept: '{r[3]}'")

wb.close()
