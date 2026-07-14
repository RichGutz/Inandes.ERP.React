# Reglas del Agente (Proyecto-Scoped)

* **Compatibilidad de Codificación (Windows/Console)**: NUNCA insertar emojis ni caracteres no ASCII/CP1252 en código ejecutable, prints, logs de consola o scripts de automatización para evitar errores fatales de `UnicodeEncodeError` en el entorno Windows del usuario.
