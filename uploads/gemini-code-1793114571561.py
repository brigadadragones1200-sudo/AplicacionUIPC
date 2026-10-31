import pandas as pd
import openpyxl
from openpyxl.styles import Font, PatternFill, Alignment, Border, Side
from openpyxl.utils import dataframe_to_rows

# Datos extraídos del escaneo Anexo 4 (Excluyendo Correo, Teléfono personal, Telefono y Extensión)
data = [
    [1, "GRISELDA", "CRUZ", "RICO", "Prevención y Combate de Incendios", 5, "27", "E6", "Explanada Xoco"],
    [2, "JOSE EDUARDO", "GONZALEZ", "LOPEZ", "Evacuación", 0, "E6", "E6", "Explanada Xoco"],
    [3, "DULCE KARINA", "LEON", "OLMOS", "Búsqueda y Rescate", 5, "26", "E6", "Explanada Xoco"],
    [4, "CARLOS HILARIO", "LONGINO", "NO APLICA", "Primeros Auxilios", 5, "26", "E6", "Explanada Xoco"],
    [5, "MARCOS SALOMON", "MOLINA", "RIVERA", "Evacuación", 0, "E", "E", "Explanada Xoco"],
    [6, "GABRIEL", "MORALES", "DIAZ", "Prevención y Combate de Incendios", 5, "26", "E6", "Explanada Xoco"],
    [7, "VICTOR HUGO", "OSORNIO", "MONDRAGON", "Evacuación", 5, "26", "E6", "Explanada Xoco"],
    [8, "OSCAR", "VILLEGAS", "HERNANDEZ", "Multifuncional", 5, "28", "E5", "Explanada Xoco"],
    [9, "HECTOR", "CORTES", "FLORES", "Evacuación", 5, "17", "E", "Explanada Av. Universidad"],
    [10, "REY NOE", "CUELLAR", "PELCASTRE", "Evacuación", 5, "24", "E6", "Explanada Xoco"],
    [11, "ADRIAN GEOVANI", "GARCIA", "LOPEZ", "Evacuación", 5, "27", "E6", "Explanada Xoco"],
    [12, "SERGIO DAVID", "MENDOZA", "TOLEDO", "Prevención y Combate de Incendios", 5, "24", "E6", "Explanada Xoco"],
    [13, "ALEJANDRA", "RIVERA", "MORENO", "Búsqueda y Rescate", 5, "28", "E5", "Explanada Xoco"],
    [14, "JORGE", "SALAZAR", "MARTINEZ", "Búsqueda y Rescate", 5, "27", "E5", "Explanada Xoco"],
    [15, "MITZI VALERIA", "VAZQUEZ", "PIMENTEL", "Primeros Auxilios", 5, "24", "E6", "Explanada Xoco"],
    [16, "ELVIA", "VEGA", "ZAMBRANO", "Enlace de Protección Civil", 5, "26", "E6", "Explanada Xoco"],
    [17, "JACOB ARTURO", "GAMBOA", "LOPEZ", "Evacuación", 5, "K", "E5", "Explanada Xoco"],
    [18, "MARTIN", "JIMENEZ", "CHAVEZ", "Evacuación", 5, "29", "E5", "Explanada Xoco"],
    [19, "ALEJANDRO", "BARBA", "FRANCO", "Evacuación", 5, "29", "E5", "Explanada Xoco"],
    [20, "MICHEL EDUARDO", "GARCIA", "GARCIA", "Evacuación", 5, "K", "E5", "Explanada Xoco"],
    [21, "EMANUEL", "HERNÁNDEZ", "FAJARDO", "Evacuación", 5, "K", "E5", "Explanada Xoco"]
]

columns = [
    "Núm.", "Nombre", "Apellido Paterno", "Apellido Materno", 
    "Brigada a la que pertenece", "Piso", "Sector", "Escalera de evacuación", "Punto de Reunión"
]

df = pd.DataFrame(data, columns=columns)

wb = openpyxl.Workbook()
ws = wb.active
ws.title = "Directorio Brigadistas (Sanitizado)"

# Estilos
header_fill = PatternFill(start_color="77AF9C", end_color="77AF9C", fill_type="solid")
header_font = Font(name="Calibri", size=11, bold=True, color="FFFFFF")
data_font = Font(name="Calibri", size=10)
thin_border = Border(
    left=Side(style='thin', color='D9D9D9'),
    right=Side(style='thin', color='D9D9D9'),
    top=Side(style='thin', color='D9D9D9'),
    bottom=Side(style='thin', color='D9D9D9')
)

# Encabezados
ws.append(columns)
for cell in ws[1]:
    cell.fill = header_fill
    cell.font = header_font
    cell.alignment = Alignment(horizontal="center", vertical="center")

# Filas
for r in dataframe_to_rows(df, index=False, header=False):
    ws.append(r)

for row in ws.iter_rows(min_row=2, max_row=len(data)+1, min_col=1, max_col=len(columns)):
    for cell in row:
        cell.font = data_font
        cell.border = thin_border
        if cell.column in [1, 6, 7, 8]:
            cell.alignment = Alignment(horizontal="center", vertical="center")
        else:
            cell.alignment = Alignment(horizontal="left", vertical="center")

# Ajuste de ancho de columnas
for col in ws.columns:
    max_len = max(len(str(cell.value or '')) for cell in col)
    col_letter = openpyxl.utils.get_column_letter(col[0].column)
    ws.column_dimensions[col_letter].width = max(max_len + 3, 12)

wb.save("Directorio_Brigadistas_DGESUI_Sanitizado.xlsx")