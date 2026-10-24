# 🚀 Protocolo Maestro de Despliegue en Producción (VPS Contabo) y Gestión de Caché

> **Nota Oficial:** Ver versión completa en el archivo del Vault:  
> `Obsidian/Mudanza.Contabo/Mudanza.Contabo/27. Protocolo Maestro de Despliegue y Ciclo de Cache Contabo.md`

---

## 🧭 Resumen de Acciones Rápida para Despliegues

1. **Compilar y validar localmente:**
   ```powershell
   npm run build
   ```
2. **Subir a Git:**
   ```powershell
   git add <archivos>
   git commit -m "..."
   git push origin main
   ```
3. **Tiempo de compilación Coolify en VPS:**
   - Esperar **60 a 90 segundos** (Zero downtime).
4. **Validación en Cliente (Bypass de Caché):**
   - Presionar **`Ctrl + F5`** (o `Ctrl + Shift + R`) en Chrome/Edge.
   - O abrir en pestaña de incógnito con **`Ctrl + Shift + N`**.
5. **Comprobación Forense SSH:**
   - Contenedor activo: `docker ps --filter "name=yjttbctaekty8zb5ode0hiu4"`
   - Búsqueda en JS: `docker exec <ID> grep -o "TEXTO" /app/dist/assets/*.js`
   - IP Traefik: `cat /data/coolify/proxy/dynamic/inandes_frontend.yaml`
