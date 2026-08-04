# Reglas del Agente (Proyecto: Inandes.ERP.React)

## Regla 1 - Compatibilidad de Codificacion (Windows)
NUNCA insertar emojis ni caracteres no ASCII en codigo ejecutable, prints, logs de consola o scripts de automatizacion para evitar errores fatales de UnicodeEncodeError en el entorno Windows del usuario.

## Regla 2 - PRINCIPIO FUNDAMENTAL: Solo cambiar la UI, NO el Backend

Este proyecto consiste UNICAMENTE en reemplazar la interfaz de usuario de Streamlit por React.
TODO el backend Python (parseo de PDFs, calculos financieros, generacion de PDFs, Google Drive) YA EXISTE y funciona en mini_erp_v2_antigravity. NO se rehace, NO se duplica.

### Lo que hace React:
- Mostrar la UI (componentes, formularios, tablas)
- Llamar a los endpoints FastAPI que ya existen
- Leer/escribir datos en Supabase (egvcinsbyropumybatdf)

### Lo que NO hace React:
- Logica de parseo de PDFs (eso es pdf_parser.py)
- Calculos financieros (eso es factoring_calculator.py)
- Generacion de PDFs (eso es pdf_generators.py)
- Integracion con Google Drive (eso es google_integration.py)

### Backend disponible en produccion:
- FastAPI: https://api-factoring.geeksoft.tech
- Swagger: https://api-factoring.geeksoft.tech/docs
- Codigo fuente: C:\Users\rguti\mini_erp_v2_antigravity\src\api\

### Regla de implementacion:
Antes de construir cualquier logica nueva en React, preguntarse:
> "Existe ya este endpoint en https://api-factoring.geeksoft.tech/docs ?"
Si existe -> solo consumirlo desde React. NO rehacerlo.

## Regla 3 - PROHIBIDO abrir el browser del usuario

NUNCA usar el browser_subagent ni abrir el browser del usuario para tareas de debugging, QC o verificacion.
Toda verificacion de APIs, SSL y conectividad se hace exclusivamente via SSH al VPS o via terminal (PowerShell/Python).
Si se necesita ver la UI, pedirle al usuario que la abra el mismo y describa lo que ve.

## Regla 4 - Colaboracion Activa con el Usuario

Los agentes de IA NO deben intentar resolver problemas complejos o ambiguos de forma aislada a ciegas. 
Deben consultar y apoyarse activamente en el usuario (quien conoce el negocio y el contexto) para diagnosticar y decidir la solucion correcta, evitando bucles fallidos y perdida de tiempo.

## Regla 5 - LECTURA OBLIGATORIA al Iniciar Sesion

AL INICIO DE CADA SESION de trabajo en este proyecto, el agente DEBE leer el siguiente archivo antes de tomar cualquier accion:

  C:\Users\rguti\Inandes.ERP.React\Obsidian\Inandes.Factoring.React\Bienvenido.md

Este archivo contiene los principios fundamentales, la arquitectura del proyecto, el estado de modulos y las URLs/credenciales clave.
No leerlo equivale a operar sin contexto y es causa de errores graves.

