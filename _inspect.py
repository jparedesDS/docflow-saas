import pandas as pd

print("=== MONITORING REPORT (referencia) ===")
ref = pd.read_excel(r'U:\USUARIOS\jose.paredes\Desktop\DocuControl\monitoring_report_27-02-2026.xlsx', engine='openpyxl')
print("Columnas:", list(ref.columns))
print("Shape:", ref.shape)
print()
print(ref.head(3).to_string())
print()
# Check for any merged/header rows
print("Valores unicos por columna (primeras 5 cols):")
for c in ref.columns[:8]:
    vals = ref[c].dropna().unique()
    print(f"  {c}: {vals[:5]}")

print("\n=== DATA_ERP ===")
d = pd.read_excel(r'U:\USUARIOS\jose.paredes\Desktop\DocFlow\data_erp.xlsx', engine='openpyxl')
print("Columnas:", list(d.columns))
print("Shape:", d.shape)
print()
print(d.head(3).to_string())

print("\n=== CONSULTA_ERP ===")
c = pd.read_excel(r'U:\USUARIOS\jose.paredes\Desktop\DocFlow\consulta_erp.xlsx', engine='openpyxl')
print("Columnas:", list(c.columns))
print("Shape:", c.shape)
print()
print(c.head(3).to_string())
