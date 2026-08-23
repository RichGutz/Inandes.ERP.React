# 📜 Deprecación y Desacoplamiento de la Tabla `crm_certificados`

> **Documento Técnico de Arquitectura y Base de Datos**  
> **Ubicación:** `Obsidian/Inandes.Inversionistas.React/Backend/Tabla_Contratos_deprecated.md`  
> **Fecha de Ejecución:** 2026-08-23  
> **Safe Point Git Tag:** `PRE.DEPRECATED.CRM.CONTRATOS` (Commit `c79fe97`)  

---

## 1. Contexto y Justificación Técnica

### ¿Qué era `crm_certificados` y por qué se depreció?
La tabla `crm_certificados` fue concebida en los inicios del frontend React como una tabla intermedia para guardar snapshots estáticos de los certificados emitidos (`id_certificado`, `monto_inversion`, `titulares_resumen` en JSON, `numero_cuotas`, `valor_cuota`).

Sin embargo, en la arquitectura real del ERP InAndes:
1. **Modelo Ledger-First Real:** Toda la vida contable, devengues de intereses, retenciones tributarias (5% 2da categoría), aumentos de capital, rescates y saldos vivos residen en el **Ledger Contable (`crm_certificados_eventos`)** (más de 590 asientos contables) y en la tabla maestra de contratos **`crm_contratos`**.
2. **Evidencia Histórica:** Los 379 certificados históricos jamás residieron en `crm_certificados` (la tabla estuvo con 0 registros históricos), y todo el sistema operó con total normalidad consumiendo `crm_contratos` y `crm_certificados_eventos`.
3. **Duplicidad y Riesgo de Inconsistencia:** Mantener `crm_certificados` (que solo acumuló 22 registros de pruebas/aprobaciones recientes) obligaba a mantener sincronizados 3 puntos de escritura en cada operación y provocaba sesgos en módulos como asesores (que solo proyectaba sobre esos 22 en vez de la totalidad de contratos).

---

## 2. Respaldo de Seguridad Realizado (Fase 0)

Antes de cualquier modificación de código, se extrajo un volcado completo de los 22 registros existentes en la tabla:
* **Archivo de Respaldo:** [`backups/crm_certificados_legacy_snapshot.json`](file:///C:/Users/rguti/Inandes.ERP.React/backups/crm_certificados_legacy_snapshot.json)

---

## 3. Desacoplamiento de Módulos y Funciones en el Código Fuente

Se refactorizaron 5 módulos clave para eliminar al 100% las llamadas a `.from('crm_certificados')`:

| # | Archivo | Función | Estado Previo | Nuevo Comportamiento (Ledger-First) |
|---|---|---|---|---|
| **1** | [`src/services/asesoresService.ts`](file:///C:/Users/rguti/Inandes.ERP.React/src/services/asesoresService.ts) | `getComisionesProyeccion()` | Consultaba `crm_certificados` (solo veía 22 contratos). | Consulta directamente `crm_contratos` (`estado != 'borrador'`), proyectando comisiones sobre **los más de 180 contratos reales**. |
| **2** | [`src/services/deduccionesService.ts`](file:///C:/Users/rguti/Inandes.ERP.React/src/services/deduccionesService.ts) | `getActiveCertificadoByContrato()` | Buscaba en `crm_certificados`. | Consulta el último `id_certificado` registrado en el Ledger (`crm_certificados_eventos`). |
| **3** | [`src/features/certificados/CertificadosPage.tsx`](file:///C:/Users/rguti/Inandes.ERP.React/src/features/certificados/CertificadosPage.tsx) | `handleGenerarCertificado()` | Consulta intermedia a `crm_certificados`. | Lee directamente de `crm_contratos` y `crm_certificados_eventos` para poblar el visor PDF. |
| **4** | [`src/services/contratosService.ts`](file:///C:/Users/rguti/Inandes.ERP.React/src/services/contratosService.ts) | `approveContrato()` | Hacía `insert` en `crm_certificados`. | Elimina la inserción redundante; inserta el contrato en `crm_contratos` y su asiento inicial en `crm_certificados_eventos`. |
| **5** | [`src/features/inversiones/InversionesPage.tsx`](file:///C:/Users/rguti/Inandes.ERP.React/src/features/inversiones/InversionesPage.tsx) | `handleOpenCertificateView()` | Buscaba en `crm_certificados`. | Construye el snapshot del certificado mapeando los titulares desde el contrato y el saldo desde `crm_certificados_eventos`. |

---

## 4. Estado Actual de la Base de Datos y Llamadas

* **Llamadas activas en Backend FastAPI:** `0` (Siempre operó sobre `crm_certificados_eventos`).
* **Llamadas activas en Frontend React:** `0` (Verificado con ripgrep en todo el directorio `src/`).
* **Compilación de Producción:** Validada con `npm run build` (`tsc -b && vite build` $\rightarrow$ **0 errores TS**, empaquetado en 15.39s).

---

## 5. Próximo Paso en Base de Datos (Supabase)

La tabla `crm_certificados` ya no recibe lecturas ni escrituras desde ninguna aplicación:
1. **Fase de Observación:** Se mantiene en la base de datos sin interacción.
2. **Eliminación Definitiva (Opcional):** Puede ser renombrada a `crm_certificados_deprecated` o eliminada vía SQL (`DROP TABLE public.crm_certificados;`) cuando se considere oportuno, ya que su respaldo reside en `backups/crm_certificados_legacy_snapshot.json`.
