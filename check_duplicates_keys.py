import openpyxl
import re

EXCEL_PATH = r'C:\Users\maxiv\.gemini\antigravity-ide\scratch\ancu\padron_maestro.xlsx'
wb = openpyxl.load_workbook(EXCEL_PATH, data_only=True)
sheet = wb['Socios únicos']
rows = list(sheet.iter_rows(values_only=True))[4:]

parsed = []
seen_num = {}
seen_ci = {}

for idx, r in enumerate(rows):
    if not any(r):
        continue
    raw_name = str(r[0] or '').strip()
    raw_ci = str(r[1] or '').strip()
    raw_num = str(r[2] or '').strip()
    raw_dept = str(r[3] or '').strip()
    
    if not raw_name or 'departamento' in raw_name.lower():
        continue
    
    clean_digits_ci = re.sub(r'\D', '', raw_ci)
    if not clean_digits_ci or clean_digits_ci == '0':
        clean_digits_ci = f"399{idx:05d}"
        formatted_ci = f"N/D-{idx}"
    else:
        formatted_ci = raw_ci

    clean_num = re.sub(r'[^0-9A-Za-z-]', '', raw_num)
    if clean_num and clean_num.lower() != 'none':
        if not clean_num.upper().startswith('ANCU-'):
            member_num = f"ANCU-{clean_num}"
        else:
            member_num = clean_num.upper()
    else:
        member_num = f"ANCU-S{idx+1:04d}"

    parsed.append({
        'row': idx + 5,
        'name': raw_name,
        'ci': formatted_ci,
        'clean_ci': clean_digits_ci,
        'member_num': member_num,
        'dept': raw_dept
    })
    
    seen_num[member_num] = seen_num.get(member_num, []) + [raw_name]
    seen_ci[clean_digits_ci] = seen_ci.get(clean_digits_ci, []) + [raw_name]

print("=== DUPLICATE MEMBER NUMBERS ===")
for num, names in seen_num.items():
    if len(names) > 1:
        print(f"Num {num}: {names}")

print("\n=== DUPLICATE CIS ===")
for ci, names in seen_ci.items():
    if len(names) > 1:
        print(f"CI {ci}: {names}")

wb.close()
