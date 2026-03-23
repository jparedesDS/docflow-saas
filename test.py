import pandas as pd

  df = pd.read_excel("docflow/backend/data_erp.xlsx", engine="openpyxl")
  PENDIENTES = {"sin enviar", "", "com. menores", "com. mayores", "comentado", "rechazado"}

  df["_estado"] = df["Estado"].fillna("").astype(str).str.strip().str.lower()
  pend = df[df["_estado"].isin(PENDIENTES)]

  print(f"Total docs pendientes: {len(pend)}")
  print(f"Pedidos activos con pendientes: {pend['Nº Pedido'].nunique()}")
  print("\nDesglose por estado:")
  print(pend["_estado"].replace("", "(sin enviar)").value_counts().to_string())
  print("\nPor pedido:")
  print(pend.groupby("Nº Pedido").size().sort_values(ascending=False).to_string())