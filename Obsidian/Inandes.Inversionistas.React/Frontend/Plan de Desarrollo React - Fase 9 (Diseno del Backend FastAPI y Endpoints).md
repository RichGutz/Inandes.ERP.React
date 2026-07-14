# ⚙️ Plan de Desarrollo React - Fase 9 (Diseño del Backend FastAPI y Endpoints)

Esta nota detalla el plan arquitectónico para construir y desplegar el backend intermedio en **FastAPI (Python)** en tu VPS de Hostinger. Este backend actuará como el "cerebro" del sistema, permitiendo que la aplicación React ejecute directamente los motores contables en Python ya validados en Streamlit.

---

## 🎯 1. Objetivo
Exponer la lógica de los scripts de cálculo financiero en Python a través de una API REST moderna, rápida y segura, consumible por el frontend en React. Esto garantiza la convergencia matemática absoluta sin tener que reescribir ni una sola línea de código financiero en JavaScript.

---

## 🏗️ 2. Arquitectura de Comunicación

```mermaid
graph LR
    React["Frontend (React / Vite)"] -->|HTTP REST (Port 8000/443)| FastAPI["Backend (FastAPI / Python)"]
    FastAPI -->|Llamada Local / Importación| Engines["Motores Contables (V32, V25, V2)"]
    Engines -->|Lectura/Escritura SQL| Supabase["Supabase DB (Virginia)"]
```

* **React (Cliente)**: Realiza peticiones HTTPS a la API.
* **FastAPI (Servidor)**: Recibe los parámetros, ejecuta las funciones contables en Python, lee/escribe en Supabase y devuelve las respuestas (JSON, Excel o PDF).
* **Nginx (VPS)**: Actúa como proxy reverso para enrutar las peticiones seguras (SSL) de `api.inandes.react.geeksoft.tech` al puerto local de FastAPI (ej. `8000`).

---

## 📂 3. Estructura de Directorios del Backend en el VPS

Crearemos un subdirectorio dedicado `/opt/erp_inandes/backend` en el VPS con la siguiente estructura limpia y modular:

```text
/opt/erp_inandes/backend/
├── main.py                     # Archivo principal de inicio de FastAPI y middleware CORS
├── requirements.txt            # Dependencias (fastapi, uvicorn, pydantic, psycopg2, etc.)
├── routers/                    # Rutas y controladores divididos por área
│   ├── __init__.py
│   ├── retornos.py             # Endpoints para Motor V32 (Retornos y Auditoría)
│   ├── comisiones.py           # Endpoints para Motor V2 (Asesores y Comisiones)
│   └── valor_cuota.py          # Endpoints para Motor V25 (Devengue y Valor Cuota)
├── services/                   # Envolturas y adaptadores de los scripts originales
│   ├── __init__.py
│   └── script_runner.py        # Orquestador para importar o invocar los scripts .py
└── scripts/                    # Scripts originales de cálculo de Streamlit (solo lectura)
    ├── CALCULO_Retornos_Intereses_V32.py
    ├── CALCULO_Valor_Cuota_V25.py
    └── CALCULO_Comisiones_Asesores_V2.py
```

---

## 🔗 4. Definición de Endpoints Requeridos

### A. Módulo Retornos e Intereses (Inversionistas)
* **`GET /api/retornos/preview`**
  * **Parámetros**: `codigo_inversionista`, `fecha_corte` (formato YYYY-MM-DD).
  * **Acción**: Ejecuta el cálculo en memoria de intereses devengados, impuestos y tramos de rescate.
  * **Retorno**: JSON con el balance consolidado, intereses y saldo final proyectado.
* **`POST /api/retornos/oficializar`**
  * **Parámetros**: `fecha_periodo_origen`, `fecha_periodo_fin` (ej. Bimestre).
  * **Acción**: Ejecuta `registrar_asientos_v32.py` para escribir los eventos definitivos en `crm_certificados_eventos`.
  * **Retorno**: JSON de confirmación con el ID del asiento o ledger.

### B. Módulo Asesores y Comisiones
* **`GET /api/comisiones/calcular`**
  * **Parámetros**: `mes_cierre` (formato YYYY-MM).
  * **Acción**: Ejecuta `CALCULO_Comisiones_Asesores_V2.py`.
  * **Retorno**: JSON con la liquidación por asesor (comisión por captación y mantenimiento).

### C. Módulo Fondos y Valor Cuota
* **`GET /api/valor-cuota/diario`**
  * **Parámetros**: `fecha_corte`.
  * **Acción**: Ejecuta `CALCULO_Valor_Cuota_V25.py`.
  * **Retorno**: JSON con el valor cuota calculado y el patrimonio neto de todos los fondos.

---

## ⚡ 5. Protocolo de Despliegue y Ejecución en VPS

1. **Configurar el Entorno**:
   * Usar el entorno virtual existente `/opt/erp_inandes/venv/`.
   * Instalar dependencias mediante `pip install -r requirements.txt`.
2. **Ejecutar como Servicio Systemd**:
   * Crearemos un servicio Linux `/etc/systemd/system/inandes-backend.service` para mantener a FastAPI corriendo de forma infinita en segundo plano en el puerto `8000`.
   * Monitoreo simple por `journalctl -u inandes-backend -f`.
3. **Seguridad (CORS y SSL)**:
   * Restringir el acceso CORS de FastAPI únicamente al dominio frontend `inandes.react.geeksoft.tech`.
   * Utilizar Certbot / Let's Encrypt para habilitar SSL (`https`) en el subdominio de la API.
