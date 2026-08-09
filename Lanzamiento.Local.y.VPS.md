# 🚀 Lanzamiento Local, Despliegue y Conexión SQL — InAndes

Este documento especifica los comandos, rutas e instrucciones de despliegue y conexión del ecosistema **InAndes Inversionistas** (Frontend React + Motores en Python + Supabase DB).

---

## 1. Lanzamiento Local (Desarrollo)

### A. Frontend (React + Vite)
El frontend se ejecuta localmente y se conecta de forma directa y segura (SSL) a la API de Supabase utilizando el SDK de JavaScript.

```powershell
# 1. Navegar al directorio del proyecto React
cd C:\Users\rguti\Inandes.ERP.React

# 2. Levantar el servidor de desarrollo de Vite
npm run dev
```
*(El frontend estará disponible localmente en `http://localhost:5173`)*

---

### B. Ejecución Local de Motores Financieros (Python)
Para realizar pruebas, auditorías o ejecutar la contabilidad del ledger en local, debes situarte en el directorio del ERP heredado en Python.

*   **Motor de Retornos (V32 - Intereses del Inversionista)**:
    ```powershell
    cd C:\Users\rguti\mini_erp_v2_antigravity
    python FLOW_CHARTS/scripts_CRM/C01_Motores_Calculo_NAV_y_PYL/CALCULO_Retornos_Intereses_V32.py
    ```
*   **Motor de Valor Cuota (V25 - Saldos y Patrimonio)**:
    ```powershell
    cd C:\Users\rguti\mini_erp_v2_antigravity
    python scripts_cuotas/generate_cuotas_v25.py
    ```
*   **Motor de Comisiones de Asesores (V2 - Fuerza de Ventas)**:
    ```powershell
    cd C:\Users\rguti\mini_erp_v2_antigravity
    python decommissioned_modules_scripts_reports/scripts/generate_comisiones_asesores_v2.py
    ```

---

## 2. Despliegue a Producción (VPS de Hostinger)

El despliegue de producción se gestiona directamente en el servidor VPS de Hostinger configurado para el dominio **`inandes.react.geeksoft.tech`**.

### A. Despliegue del Frontend (React + Vite)
Para desplegar la aplicación React en el servidor web (Nginx) del VPS:

```powershell
# 1. Compilar el proyecto localmente para generar la carpeta /dist
cd C:\Users\rguti\Inandes.ERP.React
npm run build

# 2. Transferir la carpeta dist optimizada al directorio de producción del VPS via SCP/Rsync
# (Reemplazar 'root@ip-vps' con las credenciales correspondientes del servidor de Hostinger)
scp -r ./dist/* root@inandes.react.geeksoft.tech:/var/www/inandes/dist/
```
*Nginx en el VPS debe estar configurado para apuntar la directiva `root` de `inandes.react.geeksoft.tech` al directorio `/var/www/inandes/dist/`.*

---

### B. Despliegue del ERP y Motores en Python
Para subir y actualizar los scripts del motor de cálculo contable y reportes en el VPS:

```powershell
# 1. Subir los cambios a tu repositorio Git en la rama principal
cd C:\Users\rguti\mini_erp_v2_antigravity
git add .
git commit -m "fix: Ajuste en la lógica de cálculo contable"
git push origin main

# 2. Conectarse al VPS por SSH para realizar el pull del repositorio y recargar servicios
ssh root@inandes.react.geeksoft.tech
# Dentro del VPS:
# cd /app/mini_erp_v2_antigravity
# git pull origin main
# sudo systemctl restart inandes-erp.service
```
*El servicio de Python (Uvicorn o Streamlit) corre localmente en el VPS administrado por systemd, y Nginx redirige el tráfico mediante un reverse proxy.*


---

## 3. Conexión SQL Directa (Supabase Postgres con SSL)

Cuando necesites realizar mantenimientos a nivel estructural de base de datos (por ejemplo, alteración de tablas, constraints, o inyecciones manuales), puedes conectarte de forma segura utilizando un connection string directo al pooler de Supabase.

### 🧪 A. Entorno de Desarrollo (Sandbox)
*   **Host**: `db.bqyouppbgylodvdbctcf.supabase.co`
*   **Puerto**: `6543` (o `5432` directo)
*   **Password**: `VivaLaVida2025$`
*   **Cadena de conexión SQL (Forzado SSL)**:
    `postgresql://postgres:VivaLaVida2025$@db.bqyouppbgylodvdbctcf.supabase.co:6543/postgres?sslmode=require`

### 🚀 B. Entorno de Producción
*   **Host**: `db.qwtwwidjfiymqgtmfhib.supabase.co`
*   **Puerto**: `6543`
*   **Password**: `VivaLaVida2026$`
*   **Cadena de conexión SQL (Forzado SSL)**:
    `postgresql://postgres:VivaLaVida2026$@db.qwtwwidjfiymqgtmfhib.supabase.co:6543/postgres?sslmode=require`

### 🐍 Snippet de Conexión en Python (psycopg2)
```python
import psycopg2

# Reemplazar con la URL del Sandbox o Producción descritas arriba
conn_str = "postgresql://postgres:VivaLaVida2025$@db.bqyouppbgylodvdbctcf.supabase.co:6543/postgres?sslmode=require"

# Conectar y habilitar autocommit para comandos DDL
conn = psycopg2.connect(conn_str)
conn.autocommit = True
cur = conn.cursor()

# Ejecutar consulta de ejemplo
cur.execute("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';")
print("Tablas detectadas:", cur.fetchall())

cur.close()
conn.close()
```
