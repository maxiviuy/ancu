import openpyxl
import re
import json

sys_stdout = open('parsed_analysis.txt', 'w', encoding='utf-8')

wb = openpyxl.load_workbook(r'C:\Users\maxiv\.gemini\antigravity-ide\scratch\ancu\padron_maestro.xlsx', data_only=True)
sheet = wb['Socios únicos']

rows = list(sheet.iter_rows(values_only=True))
header = rows[3] # Row 4
print("Header:", header, file=sys_stdout)

members_list = []
ci_counts = {}
member_num_counts = {}
missing_ci = []
missing_names = []

for idx, r in enumerate(rows[4:]): # From row 5 onwards
    if not any(r):
        continue
    raw_name = str(r[0] or '').strip()
    raw_ci = str(r[1] or '').strip()
    raw_num = str(r[2] or '').strip()
    raw_dept = str(r[3] or '').strip()
    raw_phone = str(r[4] or '').strip()
    raw_email = str(r[5] or '').strip()

    if not raw_name:
        missing_names.append((idx+5, r))
        continue
    
    # Split name into first_name and last_name
    name_parts = raw_name.split()
    if len(name_parts) == 1:
        first_name = name_parts[0]
        last_name = 'Socio'
    elif len(name_parts) == 2:
        first_name = name_parts[0]
        last_name = name_parts[1]
    else:
        # e.g., "Adriano Valdoir Nuñez Montero"
        first_name = " ".join(name_parts[:2])
        last_name = " ".join(name_parts[2:])

    # Clean CI
    clean_digits_ci = re.sub(r'\D', '', raw_ci)
    if not clean_digits_ci:
        missing_ci.append((idx+5, raw_name, r))

    # Standard member number
    clean_num = re.sub(r'[^0-9A-Za-z-]', '', raw_num)
    if clean_num and not clean_num.upper().startswith('ANCU-'):
        member_number = f"ANCU-{clean_num}"
    elif clean_num:
        member_number = clean_num.upper()
    else:
        member_number = f"ANCU-TEMP-{idx+1:04d}"

    dept = raw_dept if raw_dept and raw_dept != 'Sin inferir' and raw_dept != 'None' else 'Lavalleja'
    phone = raw_phone if raw_phone and raw_phone != 'None' else '099 000 000'
    email = raw_email if raw_email and raw_email != 'None' else f"socio.{clean_digits_ci or idx+1}@ancu.uy"

    member_data = {
        'row': idx + 5,
        'raw_name': raw_name,
        'first_name': first_name,
        'last_name': last_name,
        'formatted_ci': raw_ci if clean_digits_ci else f"DOC-{idx+1}",
        'clean_ci': clean_digits_ci if clean_digits_ci else f"{idx+1:08d}",
        'member_number': member_number,
        'raw_num': clean_num,
        'department': dept,
        'phone': phone,
        'email': email,
        'status': 'ACTIVE',
        'category': 'Socio Pleno Activo',
        'valid_until': '2026-12-31'
    }
    members_list.append(member_data)
    
    ci_counts[member_data['clean_ci']] = ci_counts.get(member_data['clean_ci'], 0) + 1
    member_num_counts[member_data['member_number']] = member_num_counts.get(member_data['member_number'], 0) + 1

print(f"\nTotal valid rows parsed: {len(members_list)}", file=sys_stdout)
print(f"Missing CIs: {len(missing_ci)}", file=sys_stdout)
for m in missing_ci[:5]:
    print(f"  Missing CI row: {m}", file=sys_stdout)

dup_cis = {k: v for k, v in ci_counts.items() if v > 1}
print(f"\nDuplicate CIs in 'Socios únicos': {len(dup_cis)}", file=sys_stdout)
for k, v in list(dup_cis.items())[:10]:
    print(f"  CI {k} repeated {v} times", file=sys_stdout)

dup_nums = {k: v for k, v in member_num_counts.items() if v > 1}
print(f"\nDuplicate Member Numbers in 'Socios únicos': {len(dup_nums)}", file=sys_stdout)
for k, v in list(dup_nums.items())[:10]:
    print(f"  Num {k} repeated {v} times", file=sys_stdout)

print("\nSample first 5 members:", file=sys_stdout)
for m in members_list[:5]:
    print(m, file=sys_stdout)

sys_stdout.close()
print("Analysis complete. Check parsed_analysis.txt")
