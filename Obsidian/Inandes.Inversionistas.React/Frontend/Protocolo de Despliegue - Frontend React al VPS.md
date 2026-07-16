# 🚀 Protocolo de Despliegue - Frontend React al VPS

Esta nota documenta el procedimiento estándar, los comandos exactos y **las lecciones aprendidas (a las malas)** al momento de desplegar el frontend de React + Vite al VPS de producción en Hostinger.

---

## 🛑 1. La Regla de Oro (Lección Aprendida)
**¡NUNCA EJECUTAR EL SCRIPT DE DEPLOY SIN COMPILAR!**

El script `deploy_vps.py` **NO** compila el proyecto de React automáticamente; su única función es conectarse por SSH/SFTP y transferir físicamente la carpeta `dist/` existente hacia `/var/www/inandes` en el VPS.

> [!WARNING]
> Si omites compilar, el script de despliegue subirá los archivos viejos (de la última vez que compilaste) y creerás erróneamente que el navegador tiene problemas de caché cuando en realidad el VPS tiene código obsoleto. Además, **compilar (`npm run build`) ejecuta un chequeo estricto de TypeScript (`tsc -b`)**, lo que garantiza que no se suba código roto a producción.

---

## 🛠️ 2. Procedimiento Paso a Paso

### Paso 1: Validación y Compilación Local
Abre una terminal en la raíz del proyecto (`C:\Users\rguti\Inandes.Inversionistas.React`) y ejecuta:
```bash
npm run build
```
**¿Qué ocurre aquí?**
1. Se ejecuta `tsc -b`: TypeScript verifica todo el código en busca de errores (importaciones faltantes, tipos incorrectos, componentes inexistentes como `TabView`).
2. Si falla: El proceso se detiene y **debes** arreglar el código.
3. Si es exitoso: Se ejecuta `vite build`, que empaqueta y minifica todo en la carpeta `dist/`.

### Paso 2: Despliegue al VPS
Una vez que el build fue exitoso y la carpeta `dist/` está actualizada, ejecuta el script de automatización:
```bash
python deploy_vps.py
```
**¿Qué ocurre aquí?**
1. El script se conecta vía SSH a `91.108.125.253` (Root).
2. Limpia el directorio destino `/var/www/inandes/*`.
3. Sube todos los archivos de `dist/` por SFTP.
4. Ajusta los permisos de Linux (`chmod 644 / 755` y `chown www-data`).
5. (Opcional) Refresca Nginx y el certificado SSL.

### Paso 3: Verificación
- Abre tu navegador en **https://inandes.react.geeksoft.tech**.
- Pulsa **Ctrl + F5** (Hard Refresh) para forzar al navegador a descargar el nuevo `index.html` e ignorar caché local.

---

## 📝 3. Troubleshooting Común

| Síntoma | Causa Probable | Solución |
| :--- | :--- | :--- |
| **"Sigo viendo el código viejo"** | Olvidaste correr `npm run build` antes de hacer el deploy (La carpeta `dist/` está desactualizada). | Corre `npm run build` y luego `python deploy_vps.py`. |
| **El build falla por "Cannot find module"** | Alguna importación está rota (ej: Lucide React icons, componentes inexistentes). | Revisa la terminal, lee la ruta del error en TypeScript y corrige la importación. |
| **Pantalla blanca (White Screen of Death)** | Se intentó llamar a un componente que no existe en el DOM virtual. | Revisa la consola de Chrome (`F12`), y asegúrate de importar el componente real. |

---
*Escrito por: Gemini (Agente Autónomo) tras una dolorosa sesión de debug donde intentó desplegar código fantasma. 15 de Julio, 2026.*
