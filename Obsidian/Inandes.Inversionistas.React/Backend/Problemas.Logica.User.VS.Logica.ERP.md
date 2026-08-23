# 🧩 Problemas de Lógica de Negocio: Usuario Pre-ERP vs. Lógica ERP

> **Documento Técnico y de Auditoría de Datos**  
> **Ubicación:** `Obsidian/Inandes.Inversionistas.React/Backend/Problemas.Logica.User.VS.Logica.ERP.md`  
> **Fecha:** 2026-08-23  

---

## 1. El Conflicto Conceptual: La Lógica del "Cajón de Sastre" (Pre-ERP)

En la operativa manual previa a la implementación del nuevo ERP, existía una práctica administrativa de **reciclaje de correlativos de contratos**:

1. **El "Cajón de Sastre":** Cuando un contrato finalizaba (por rescate total o vencimiento), su código correlativo se enviaba a un repositorio de números "disponibles".
2. **Reutilización Aleatoria:** Al ingresar una nueva colocación o contrato de un inversionista distinto, el operador o software heredado tomaba el primer número de contrato cerrado disponible en el fondo para reutilizarlo en la nueva operación.
3. **El Problema en el ERP:** En una base de datos relacional y un Ledger Contable moderno, **un identificador de contrato debe ser inmutable, único e históricamente trazable**. Reutilizar un correlativo genera colisiones conceptuales, confusión en reportes históricos y riesgo de mezclar saldos de distintos inversionistas en el mismo código base.

---

## 2. Caso de Estudio: Inversionista Temoche Silva Jorge Arturo

### Diagnóstico de la Colisión Detectada:
* **Contrato Histórico Preexistente (`050`):**  
  * Código: `NSGPEN03-050.20240219`  
  * Titular: **Perales Bazalar María Agueda** (`DNI09180253`)  
  * Monto: S/ 200,000.00 PEN (Plazo 24m)  
  * Estado: `cerrado_por_rescate` (Rescatado al 2026-02-28).
* **Nuevo Contrato Emitido por Reciclaje (`050`):**  
  * Código original: `NSGPEN03-050.20260813`  
  * Titulares: **Temoche Silva Jorge Arturo** (`DNI07546408`, 50%) y **Temoche Silva Luis Ricardo** (`DNI07543693`, 50%)  
  * Monto: S/ 112,000.00 PEN (Fondo NSGPEN03-60, 60 meses, Tasa 10%)  
  * Fecha de Inicio: 2026-08-13 | Fecha de Fin: 2031-08-31  

### Solución Solicitada en Fase ETL:
Reasignar el correlativo de la nueva inversión de Temoche Silva de **`050`** a **`052`** (`NSGPEN03-052.20260813`), garantizando que `NSGPEN03-050` quede exclusivamente como el registro histórico cerrado de la Sra. Perales Bazalar.

---

## 3. Acciones Ejecutadas en la Base de Datos (Supabase)

Se ejecutó la migración atómica verificando la disponibilidad total del correlativo `NSGPEN03-052`:

| Tabla | Identificador Previo | Identificador Nuevo / Acción | Estado |
|---|---|---|---|
| **`crm_contratos`** | `NSGPEN03-050.20260813` | `NSGPEN03-052.20260813` (Insertado nuevo, eliminado viejo) | ✅ Actualizado |
| **`crm_certificados`** | `NSGPEN03-050.20260813.20260813` | `NSGPEN03-052.20260813.20260813` (id_contrato: `NSGPEN03-052.20260813`) | ✅ Sincronizado |
| **`crm_certificados_eventos`** | Evento ID `11371` | `id_contrato`: `NSGPEN03-052.20260813`<br>`id_certificado`: `NSGPEN03-052.20260813.20260813`<br>`id_certificado_origen`: `NSGPEN03-052.20260813.20260813` | ✅ Ledger Actualizado |
| **`crm_cronograma_deducciones_rescates`** | N/A (0 registros) | No requirió modificaciones | ✅ Sin impacto |

---

## 4. Aclaración Arquitectónica: La Tabla `crm_certificados`

### ¿Es necesaria *Sine Qua Non*?
**NO.** La tabla `crm_certificados` es un maestro documental redundante.

* **Arquitectura Ledger-First del ERP:**  
  Toda la lógica financiera, devengues, cortes bimestrales, liquidaciones y cálculo de patrimonio se sustenta exclusivamente en:
  1. `crm_contratos` (Parámetros y condiciones legales/contractuales).
  2. `crm_certificados_eventos` (Ledger contable de eventos financieros con saldos vivos).
* **Evidencia Técnica:**  
  Los más de 370 contratos históricos del fondo operan perfectamente sin registros en `crm_certificados`. Dicha tabla sólo contiene los 22 contratos aprobados recientemente vía web. No obstante, se mantiene sincronizada para evitar inconsistencias en vistas secundarias.

---

## 5. Protocolo para Futuros Casos de Reciclaje ETL

Ante situaciones similares donde el usuario reporte contratos reciclados:
1. **Verificación de Disponibilidad:** Comprobar que el nuevo correlativo propuesto no exista en ninguna tabla (`crm_contratos`, `crm_certificados_eventos`, `crm_certificados`, `crm_cronograma_deducciones_rescates`).
2. **Reasignación Atómica:**
   - Crear el nuevo registro en `crm_contratos`.
   - Re-apuntar los eventos contables en `crm_certificados_eventos`.
   - Actualizar `crm_certificados` si existe la cabecera.
   - Eliminar el contrato previo reciclado para liberar el historial del titular original.
3. **Registro en Bitácora:** Documentar el cambio en los logs de interacción y notas de Obsidian.
