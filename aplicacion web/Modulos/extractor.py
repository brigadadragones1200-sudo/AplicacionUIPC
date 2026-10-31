import re
import json

def extraer_eventos(ruta_txt):
    with open(ruta_txt, 'r', encoding='utf-8') as f:
        texto_crudo = f.read()
        
    patron_mensaje = r'\[\d{1,2}/\d{1,2},\s*\d{1,2}:\d{2}\s*[a-zA-Z\. ]+\]\s*[^:]+:'
    partes = re.split(patron_mensaje, texto_crudo)
    
    sedes_prioridad = ["Explanada", "Sala", "Auditorio", "Acceso", "Área", "Bodega", "Cubo", "Sector", "Ala Norte", "Ala Sur"]
    asistentes_keywords = ["Personas", "Asistentes", "Brigadistas", "Alumnos", "Niños", "participantes", "participaciones"]
    ur_keywords = ["DGBTED", "DGFCDD", "SEB", "DGGEyET", "DGEIIB", "DGETI", "DGCFT", "TecNM", "UNEM", "DGESUI", 
                   "DGESUM", "DGPPyEE", "SEMS", "DGETAYCM", "DGSANEF", "DGUTyP", "DGRHO", "DGRHYO", "DGPyRF", 
                   "CSI", "DGDySNEM", "CONAFE", "SES", "DGTIC", "AEFCM", "UnADM", "USICAMM", "DGAIR"]
    meses_regex = r'(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre)'
    
    eventos_json = []
    
    for bloque in partes:
        bloque = bloque.strip()
        if not bloque:
            continue
            
        evento = {
            "Sede": None,
            "total de asistentes": None,
            "UR responsable": None,
            "fecha": None,
            "horario": None,
            "tema del evento": None
        }
        
        # 1. SEDE
        for sede in sedes_prioridad:
            if re.search(r'\b' + re.escape(sede) + r'\b', bloque, re.IGNORECASE):
                evento["Sede"] = sede
                break
                
        # 2. TOTAL DE ASISTENTES
        for kw in asistentes_keywords:
            match = re.search(rf'(\d+)\s*{kw}|{kw}\s*(\d+)', bloque, re.IGNORECASE)
            if match:
                evento["total de asistentes"] = int(match.group(1) or match.group(2))
                break
                
        # 3. UR RESPONSABLE
        for ur in ur_keywords:
            if re.search(r'\b' + re.escape(ur) + r'\b', bloque, re.IGNORECASE):
                evento["UR responsable"] = ur.upper()
                break
                
        # 4. FECHA
        match_linea_fecha = re.search(r'Fecha:\s*(.*)', bloque, re.IGNORECASE)
        if match_linea_fecha:
            linea_f = match_linea_fecha.group(1).strip()
            match_mes = re.search(meses_regex, linea_f, re.IGNORECASE)
            if match_mes:
                mes = match_mes.group(1).lower()
                numeros = re.findall(r'\b\d+\b', linea_f)
                dia = numeros[0] if len(numeros) > 0 and len(numeros[0]) <= 2 else None
                ano = next((n for n in numeros if len(n) == 4 and n.startswith("20")), None)
                
                evento["fecha"] = f"{dia + ' de ' if dia else ''}{mes}{' de ' + ano if ano else ''}".capitalize()
            else:
                evento["fecha"] = linea_f
                
        # 5. HORARIO
        match_horario = re.search(r'Horario:\s*(.*?(?:Hrs|am|pm|horas|hrs))', bloque, re.IGNORECASE)
        if match_horario:
            evento["horario"] = match_horario.group(1).strip()
            
        # 6. TEMA DEL EVENTO
        # Busca desde "Tema:" hasta el próximo campo que empiece con mayúscula y dos puntos.
        match_tema = re.search(r'Tema:\s*(.*?)(?=\n[A-Z][a-z]+:|$)', bloque, re.IGNORECASE | re.DOTALL)
        if match_tema:
            evento["tema del evento"] = re.sub(r'\s+', ' ', match_tema.group(1).strip())
            
        eventos_json.append(evento)
        
    return json.dumps(eventos_json, ensure_ascii=False, indent=4)

if __name__ == "__main__":
    # Suponiendo que tu archivo se llama "eventos.txt"
    json_resultado = extraer_eventos("eventos.txt")
    with open("eventos_procesados.json", "w", encoding="utf-8") as f:
        f.write(json_resultado)
    print("Archivo eventos_procesados.json generado con éxito.")
