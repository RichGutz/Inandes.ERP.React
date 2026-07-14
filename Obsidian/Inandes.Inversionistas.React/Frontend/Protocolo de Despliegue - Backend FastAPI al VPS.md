# Protocolo de Despliegue: Backend FastAPI al VPS Hostinger

**Fecha de ejecución:** 14 de Julio de 2026
**Ejecutado por:** Gemini (Antigravity IDE)
**Estado:** EXITOSO

---

## Infraestructura Objetivo

| Componente | Detalle |
|---|---|
| VPS | Hostinger — IP `91.108.125.253` |
| Usuario SSH | `root` |
| Dominio Frontend | `inandes.react.geeksoft.tech` |
| Puerto Backend | `8010` (interno, no expuesto directamente) |
| Proxy | Nginx ruteando `/api/` → `127.0.0.1:8010` |
| Entorno Python | `/opt/erp_inandes/venv/` |
| Directorio Backend | `/opt/erp_inandes/backend/` |

> [!WARNING]
> El puerto `8000` está **permanentemente ocupado** por otro servicio del servidor llamado `geeksoft_engine` (`/opt/geeksoft_engine/`). NUNCA intentar correr InAndes Backend en el puerto `8000`.

---

## Paso 1 — Preparar Estructura Local del Backend

Crear la carpeta `backend/` dentro del repositorio React local antes de subir al VPS:

```
backend/
├── main.py
├── requirements.txt
└── routers/
    ├── __init__.py
    ├── retornos.py        ← Motor V40 (Intereses Inversionistas)
    ├── comisiones.py      ← Motor V2 (Comisiones Asesores)
    └── valor_cuota.py     ← Motor V25 (Valor Cuota Fondos)
```

Los motores de cálculo se importan directamente desde la instalación del ERP Streamlit en:
- `sys.path.insert(0, '/opt/erp_inandes/CRM_Inandes')`

---

## Paso 2 — Subir Archivos al VPS via SFTP

Usar el script `deploy_backend_vps.py` (en raíz del repositorio React). Este script:
1. Sube recursivamente la carpeta `backend/` a `/opt/erp_inandes/backend/` vía SFTP.
2. Crea automáticamente el archivo `.env` en el servidor con las variables de entorno de Supabase.

```bash
python deploy_backend_vps.py
```

**Variables de entorno escritas en `/opt/erp_inandes/backend/.env`:**
```
SUPABASE_URL=https://egvcinsbyropumybatdf.supabase.co   ← BD de pruebas (Virginia)
SUPABASE_KEY=<service_role_key>
```

> [!IMPORTANT]
> Para apuntar a producción real, cambiar la URL y KEY a la BD de producción (`qwtwwidjfiymqgtmfhib`).

---

## Paso 3 — Instalar Dependencias en el VPS

Conectarse al VPS vía SSH y correr:

```bash
cd /opt/erp_inandes
source venv/bin/activate
pip install -r backend/requirements.txt
```

Las dependencias clave son:
- `fastapi>=0.110.0`
- `uvicorn>=0.28.0`
- `pydantic>=2.6.0`
- `supabase>=2.4.0`
- `pandas>=2.0.0`

---

## Paso 4 — Configurar Servicio Systemd

Usar el script `vps_setup_systemd.py`. Este crea el archivo de servicio en `/etc/systemd/system/inandes-backend.service`:

```ini
[Unit]
Description=InAndes FastAPI Backend Service
After=network.target

[Service]
User=root
WorkingDirectory=/opt/erp_inandes/backend
ExecStart=/opt/erp_inandes/venv/bin/uvicorn main:app --host 127.0.0.1 --port 8010
Restart=always

[Install]
WantedBy=multi-user.target
```

> [!IMPORTANT]
> El puerto es `8010` y el host es `127.0.0.1` (solo escucha internamente). Nginx actúa como proxy público.

Luego habilitar e iniciar:
```bash
systemctl daemon-reload
systemctl enable inandes-backend.service
systemctl restart inandes-backend.service
systemctl status inandes-backend.service
```

---

## Paso 5 — Configurar Nginx como Proxy Reverso

La configuración de Nginx para `inandes.react.geeksoft.tech` **ya incluía** el bloque proxy para `/api/`:

```nginx
location /api/ {
    proxy_pass http://127.0.0.1:8010;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
}
```

Si la configuración cambia de puerto, editar el archivo en:
```
/etc/nginx/sites-available/inandes.react.geeksoft.tech
```

Luego recargar:
```bash
nginx -t
systemctl reload nginx
```

---

## Paso 6 — Verificar que el Servicio Esté Activo

```bash
systemctl status inandes-backend.service
```

Salida esperada:
```
Active: active (running) since Tue 2026-07-14 22:25:52 UTC; ...
Main PID: XXXXXX (uvicorn)
```

---

## Paso 7 — Validar Endpoints desde Local

Usar el script `test_production_all_apis.py`:

```bash
python test_production_all_apis.py
```

Endpoints disponibles en producción:

| Endpoint | Método | Descripción |
|---|---|---|
| `GET /api/retornos/preview` | GET | Preview de asientos de intereses (Motor V40) |
| `POST /api/retornos/oficializar` | POST | Persistir asientos en DB |
| `POST /api/retornos/rollback` | POST | Revertir periodo oficializado |
| `GET /api/valor-cuota/diario` | GET | Valor cuota diario por fondo (Motor V25) |
| `GET /api/comisiones/calcular` | GET | Proyección comisiones asesores (Motor V2) |

**Resultado de validación del 14/07/2026:**
- `GET /api/retornos/preview?fecha_inicio=2026-01-01&fecha_corte=2026-02-28&codigo_fondo=NSGPEN01` → **200 OK, 66 asientos devueltos**

---

## Troubleshooting Conocido

### Puerto en uso (`Address already in use`)

El proceso `geeksoft_engine` ocupa el puerto `8000`. Para liberar si es necesario:
```bash
fuser -k 8000/tcp
```
El backend de InAndes **siempre** debe correr en el puerto `8010`.

### Ver logs del servicio en tiempo real
```bash
journalctl -u inandes-backend.service -f --no-pager
```

### Reiniciar servicio limpiamente
```bash
systemctl restart inandes-backend.service
```

---

## Scripts Clave del Repositorio React

| Script | Propósito |
|---|---|
| `deploy_backend_vps.py` | Subir `backend/` al VPS y crear `.env` |
| `vps_setup_systemd.py` | Crear y habilitar servicio systemd |
| `vps_setup_nginx.py` | Configurar bloque Nginx (usar solo para dominio nuevo) |
| `vps_free_port_8000.py` | Liberar puerto 8000 si está secuestrado |
| `test_production_all_apis.py` | Validar los 3 endpoints de la API |

---

## Arquitectura Final

```
[React Frontend]
     |
     | HTTPS (port 443)
     v
[Nginx - inandes.react.geeksoft.tech]
     |
     | /api/* → proxy_pass 127.0.0.1:8010
     v
[FastAPI - uvicorn (puerto 8010, host 127.0.0.1)]
     |
     | import motors Python
     v
[Motores de Calculo ERP]                [Supabase DB]
 /opt/erp_inandes/CRM_Inandes/      ←→  egvcinsbyropumybatdf (pruebas)
  - CALCULO_Retornos_Intereses_v40.py   qwtwwidjfiymqgtmfhib (produccion)
  - generate_cuotas_v25.py
  - generate_comisiones_asesores_v2.py
```
