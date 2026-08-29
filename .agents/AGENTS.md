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

AL INICIO DE CADA SESION de trabajo en este proyecto, el agente DEBE leer los siguientes archivos antes de tomar cualquier accion:

  C:\Users\rguti\Inandes.ERP.React\Obsidian\Inandes.Factoring.React\Bienvenido.md
  C:\Users\rguti\Inandes.ERP.React\Obsidian\Inandes.Inversionistas.React\Lecciones.de.Bienvenida.md
  C:\Users\rguti\Inandes.ERP.React\Obsidian\Inandes.Factoring.React\06. Procedimientos de Despliegue y Base de Datos.md

Estos archivos contienen los principios fundamentales, la arquitectura del proyecto, reglas intangibles de UI, procedimientos de despliegue y las URLs/credenciales clave.
No leerlos equivale a operar sin contexto y es causa de errores graves.

## Regla 6 - PROTECCION INTANGIBLE: Selector de Letras A-Z (Modulo Aprobaciones)

El componente Selector de Letras del Abecedario en AprobacionesTab.tsx es INTANGIBLE y de cumplimiento obligatorio:

1. Visualizacion Completa: Debe mostrar SIEMPRE TODAS las letras del abecedario en orden ('TODOS', 'A' a la 'Z', '#'). PROHIBIDO ocultar o filtrar botones de letras sin facturas.
2. Diseno Visual: Burbujas cuadradas redondeadas ('w-10 h-10 rounded-xl font-black bg-indigo-600' para activas) con badge circular del conteo en la esquina superior derecha ('-top-1.5 -right-1.5').
3. Filtro y Conteo Exclusivo por Emisor: El conteo por letra y el filtro alfabetico se evalua EXCLUSIVAMENTE sobre la inicial del EMISOR (Cedente) 'op.emisor_nombre'. Queda PROHIBIDO evaluar la inicial del Aceptante (Pagador).
4. Ningun agente de IA o modelo de lenguaje puede modificar, reemplazar o refactorizar este selector de letras sin orden directa y explicita del usuario.

## Regla 7 - COMPONENTE OFICIAL UNICO Y REQUISITOS DEL MODULO APROBACIONES

1. COMPONENTE UNICO: El unico componente oficial del modulo Aprobaciones es AprobacionesTab.tsx. Queda PROHIBIDO usar o hacer referencia al archivo legacy AprobacionTab.tsx (singular).
2. ESTRUCTURA Y ARCHITECTURA ACORDEON OBLIGATORIA:
   - Estructura Jerárquica: Debe seguir la misma arquitectura acordeón de Desembolsos (`Rolodex A-Z` -> `🏢 Empresa Emisora` -> `📁 Lotes` -> `📊 Facturas`).
   - Badges Visuales: Badge verde/rojo para 'Est. Cavali' (ACEPTADA/PENDIENTE) y 'Est. Letra' (FIRMADA/PENDIENTE).
   - Acciones de Lote en Cabecera: Botones 'Aprobar Selección' y 'Rechazar' en la barra superior junto al título.
   - Checkbox Aprobacion Forzada: Opcion explicita de 'Aprobacion Forzada (ignorar estado Cavali/Letras)' en la cabecera.
## Regla 8 - PROHIBIDO Modificaciones Creativas o No Solicitadas

1. Cero modificaciones "creativas" o no solicitadas: Queda estrictamente PROHIBIDO reemplazar, rediseñar, recrear en SVG o alterar componentes visuales, logos, archivos de marca o logica preexistente.
2. Ajustes literales y puntuales: Ante peticiones de cambio de tamaño, posicionamiento o diseño, las modificaciones deben limitarse UNICAMENTE a cambiar las propiedades de estilo CSS (ancho, alto, margenes, saltos de pagina) sobre los elementos de imagen o plantilla exactos ya establecidos, sin alterar sus fuentes ni crear sustitutos.

## Regla 9 - PROHIBIDO Crear Branches en Git (Trabajo Exclusivo en MAIN) y Definicion de BRANCH TAG

1. Uso Exclusivo de MAIN: Todo el desarrollo activo, commits y pruebas continuas se realizan UNICAMENTE en la rama `main`.
2. Definicion Estricta de "BRANCH TAG" (Orden del Usuario):
   - Cuando el usuario solicite un "BRANCH TAG <NOMBRE>" o un punto de control / safepoint:
     a) Significa crear la rama local: `git branch <NOMBRE>`
     b) Hacer push explícito de la rama al repositorio remoto: `git push origin refs/heads/<NOMBRE>`
     c) Crear opcionalmente el tag homónimo: `git tag -a <NOMBRE> -m "..." ; git push origin <NOMBRE>`
     d) Regresar INMEDIATAMENTE a `main` (`git checkout main`) para mantener el trabajo 100% en `main`.
3. Safe Points por Nombre de Commit: Los puntos de control ("safe points") se identifican exclusivamente mediante el nombre especifico del commit o branches/tags asignados directamente por el usuario.


## Regla 11 - PROTOCOLO OBLIGATORIO DE DESPLIEGUE Y REPOSITORIO (EXCLUSIVO CONTABO)
1. Lectura Obligatoria de Procedimientos: El agente DEBE consultar y seguir estrictamente lo estipulado en `C:\Users\rguti\Inandes.ERP.React\Obsidian\Inandes.Factoring.React\06. Procedimientos de Despliegue y Base de Datos.md`.
2. Repositorio Oficial Git: El repositorio oficial y unico de este proyecto es `RichGutz/Inandes.ERP.React` (`origin/main`). Todo push se dirige prioritariamente a `origin main`.
3. PROHIBICION DE DESPLIEGUE A HOSTINGER: El servidor antiguo de Hostinger (91.108.125.253 / `deploy_vps.py`) esta OBSOLETO Y DEBAJA. Queda estrictamente PROHIBIDO ejecutar `deploy_vps.py` o realizar despliegues hacia Hostinger.
4. Procedimiento Unico de Despliegue (Contabo Coolify):
   - Probar y compilar localmente: `npm run build`
   - Sincronizar en Git: `git add .` -> `git commit -m "..."` -> `git push origin main`
   - El Webhook de Coolify en el VPS Contabo (`169.58.168.107`) se encarga del auto-despliegue automatico en caliente sin downtime.

## Regla 12 - UBICACION CENTRALIZADA DE CREDENCIALES Y SERVIDORES
Todo agente DEBE consultar las credenciales del proyecto en estas ubicaciones estandar antes de solicitar accesos:
1. Contabo VPS (Produccion Principal Coolify): `Obsidian/Mudanza.Contabo/Mudanza.Contabo/02. Infraestructura y Hardening del Server Contabo.md` y respaldo privado en `C:\Users\rguti\.gemini\antigravity-ide\scratch\contabo_credentials.json` (Host IP: 169.58.168.107, Domain: `inandes.geeksoft.tech`).
2. Supabase Cloud (PostgreSQL): `Obsidian/Inandes.Factoring.React/06. Procedimientos de Despliegue y Base de Datos.md` y `.env` / `.env.production` (Proyecto: egvcinsbyropumybatdf).
3. Hostinger VPS (DESACTIVADO / OBSOLETO): No utilizar.

## Regla 13 - PROHIBIDO Generar PDFs sin Solicitud Explicita del Usuario
Queda estrictamente PROHIBIDO compilar o convertir archivos Markdown (.md) a PDF de forma automatica salvo que el usuario lo solicite expresa y directamente en su mensaje. Toda documentacion se mantiene exclusivamente en Markdown (.md).


