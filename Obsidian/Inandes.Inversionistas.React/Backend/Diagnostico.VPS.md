# Guia de Diagnostico del VPS (Hostinger - 91.108.125.253)

> **DOCUMENTO TECNICO DE REFERENCIA**
> Fecha de creacion: 2026-08-09

---

## 1. Servicios Activos en el VPS

| Puerto | Proceso | Ruta | Pertenece A |
|--------|---------|------|-------------|
| `8010` | `uvicorn main:app` | `/opt/erp_inandes/backend` | **InAndes ERP React (FastAPI)** |
| `8501` | `streamlit run 00_Gateway.py` | `/opt/erp_inandes/` | **ERP Heredado Streamlit (CRM Inversionistas)** |
| `8502` | `streamlit run frontend_app.py` | `/opt/crm_neoauto/` | **CRM Neoauto (Scraper)** |
| `8000` | `uvicorn backend.main:app` | `/opt/geeksoft_engine/` | **Geeksoft Engine (otro proyecto)** |

---

## 2. Proceso Streamlit Gateway (00_Gateway.py) — Identificado

El proceso:
```
root  2927008  4.4%CPU  198MB  streamlit run 00_Gateway.py --server.port=8501
```

**Pertenece al ERP heredado en Streamlit (CRM Inversionistas Python).**

- **Directorio en VPS:** `/opt/erp_inandes/`
- **Archivo principal:** `00_Gateway.py`
- **Funcion:** Gateway de autenticacion con Google OAuth para el ERP legacy de Streamlit (`INANDES ERP - Gateway`). Da acceso a todos los modulos del CRM Inversionistas de la version antigua en Python.
- **Repositorio:** `mini_erp_v2_antigravity` (ERP original, NO es el React).
- **Tiempo acumulado de CPU:** 234 horas (activo desde Aug 6).
- **RAM consumida:** ~198 MB constantemente.

> **NOTA IMPORTANTE para Agentes:** Este proceso es el backend LEGACY de Streamlit. Mientras se complete la migracion a React, debe mantenerse activo. NO detenerlo sin autorizacion explicita del usuario.

---

## 3. Problema Conocido: Puerto 8010 con Proceso Huerfano

**Sintoma:** El servicio `inandes-api.service` falla al arrancar con `[Errno 98] address already in use`.

**Causa raiz:** Existe un proceso uvicorn lanzado manualmente que bloquea el puerto 8010 de forma permanente. Cada vez que se hace `systemctl restart inandes-api.service`, el nuevo proceso falla porque el huerfano nunca libera el puerto.

**Diagnostico rapido:**
```bash
ss -tulpn | grep 8010
```
Si la salida muestra `uvicorn` con un PID que NO es el de `inandes-api.service`, ese es el huerfano.

**Solucion:**
```bash
pkill -9 -f "uvicorn main:app"
systemctl restart inandes-api.service
systemctl status inandes-api.service
```

---

## 4. Scripts de Diagnostico Disponibles

Los siguientes scripts se ejecutan desde la maquina local con Python y se conectan al VPS por SSH.

### Script A: Diagnostico General de CPU, Procesos y Logs
**Archivo:** `C:\Users\rguti\.gemini\antigravity-ide\brain\6c2bec51-1f0f-4775-aea8-39e82c692687\scratch\diag_vps.py`

Ejecutar con:
```powershell
python C:\Users\rguti\.gemini\antigravity-ide\brain\6c2bec51-1f0f-4775-aea8-39e82c692687\scratch\diag_vps.py
```

**Que hace:**
- Muestra el estado del CPU (top -bn1).
- Lista todos los procesos Python ordenados por consumo de CPU.
- Muestra los puertos activos en el servidor.
- Filtra las entradas `[PDF BENCHMARK]` del log del backend.
- Muestra el log reciente de `inandes-api.service`.

---

### Script B: Matar Proceso Huerfano y Reiniciar Servicio
**Archivo:** `C:\Users\rguti\.gemini\antigravity-ide\brain\6c2bec51-1f0f-4775-aea8-39e82c692687\scratch\fix_vps_port.py`

Ejecutar con:
```powershell
python C:\Users\rguti\.gemini\antigravity-ide\brain\6c2bec51-1f0f-4775-aea8-39e82c692687\scratch\fix_vps_port.py
```

**Que hace:**
- Mata el proceso uvicorn huerfano que ocupa el puerto 8010.
- Verifica que el puerto quedo libre.
- Reinicia el servicio oficial `inandes-api.service`.
- Muestra el estado final del servicio.

---

### Script C: Benchmark de Velocidad del Endpoint generate-pdf
**Comando (ejecutar en PowerShell):**
```powershell
python -c "import urllib.request, json; req = urllib.request.Request('https://inandes.react.geeksoft.tech/api/inversionistas/generate-pdf', data=json.dumps({'html': '<html><body><h1>PRUEBA</h1></body></html>', 'filename': 'test.pdf'}).encode('utf-8'), headers={'Content-Type': 'application/json'}); res = urllib.request.urlopen(req); print('STATUS:', res.status); print('LATENCIA EN VPS (ms):', res.headers.get('X-PDF-Generation-Time-MS'))"
```

**Que muestra:**
- `STATUS: 200` si el endpoint esta activo.
- `LATENCIA EN VPS (ms): xxx.xx` — tiempo exacto de generacion de WeasyPrint en el servidor (leible del header HTTP `X-PDF-Generation-Time-MS`).

---

## 5. Como Leer el Log de Latencia de PDF en el VPS

El backend registra en su log cada generacion de PDF con el formato:
```
[PDF BENCHMARK] Generado 'nombre.pdf' (XXXX bytes) en XXX.XX ms
```

Para leerlo directamente desde PowerShell:
```powershell
# Conectar al VPS por SSH y filtrar el log
ssh root@91.108.125.253 "journalctl -u inandes-api.service -n 50 --no-pager | grep 'PDF BENCHMARK'"
```

---

## 6. Referencia de Recursos del VPS

| Recurso | Total | Libre (tipico) |
|---------|-------|----------------|
| RAM | 3.9 GB | ~500 MB |
| CPU | 2 vCPU | ~20-40% libre en picos PDF |
| Swap | 0 MB | — |

> **ALERTA:** El servidor NO tiene swap. Cuando WeasyPrint genera PDFs grandes, puede causar picos de RAM que compiten con los demas servicios activos (Streamlit Gateway, CRM Neoauto, Geeksoft Engine), alargando el tiempo de generacion de 300ms a 15-20 segundos.
