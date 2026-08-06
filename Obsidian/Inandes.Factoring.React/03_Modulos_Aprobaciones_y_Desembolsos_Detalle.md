# 🛡️ Módulos de Aprobaciones y Desembolsos — Documentación Exhaustiva y Especificación Técnica

> **Documento Oficial de Arquitectura, Componentes, Reglas Intangibles y QC de Aprobaciones y Desembolsos**

---

## 🎯 1. Módulo de Aprobaciones (`AprobacionesTab.tsx`)

### 📋 Propósito y Responsabilidad
El módulo de **Aprobaciones** es la 3ra etapa del flujo de Factoring. Su función principal es permitir al Comité Financiero revisar de forma clara y estructurada todas las operaciones que se originaron (`estado = ORIGINADO`) y tomar decisiones de aprobación o rechazo en lote o de forma individual.

### 🏗️ Estructura Jerárquica y Acordeón Estandarizado
Para eliminar cualquier diseño amateur y ofrecer una experiencia de usuario consistente con Desembolsos, el módulo se estructura jerárquicamente en **3 niveles de acordeón anidados**:

1. **Rolodex Alfabético A-Z (Nivel Superior):**
   - Burbujas cuadradas redondeadas con contadores flotantes en la esquina superior derecha (`-top-1.5 -right-1.5`).
   - El conteo y filtrado es evaluado **únicamente por la inicial del Emisor (Cedente)** (`op.emisor_nombre`).
   - Filtro 'TODOS', 'A'...'Z' y '#'.

2. **🏢 Nivel 1 - Tarjeta de Empresa Emisora (Cedente):**
   - Encabezado principal tipo tarjeta con el ícono corporativo `Building2` en azul índigo, **Nombre Grande de la Empresa** y conteo total de facturas pendientes.
   - **Estado Inicial:** Colapsado por defecto al cargar o filtrar, desplegándose al hacer clic.

3. **📁 Nivel 2 - Sub-bloque de Lote:**
   - Cada empresa agrupa sus operaciones en sub-bloques por **Lote** (`FolderOpen` en verde esmeralda).
   - Incluye el identificador del lote, el número de operaciones y la casilla de verificación rápida **"Seleccionar Lote"** para marcar/desmarcar en masa ese lote.
   - **Estado Inicial:** Colapsado por defecto al desplegar la empresa.

4. **📊 Nivel 3 - Tabla Elegante de Facturas / Operaciones:**
   - Muestra las facturas dentro de cada lote con:
     - Casilla de selección individual por fila.
     - N° Factura / Propuesta ID.
     - Pagador (Aceptante) y RUC.
     - Monto Neto, Interés Ganado y Abono Neto a Cedente.
     - **Est. Cavali** (Badge verde `ACEPTADA` / rojo `PENDIENTE`).
     - **Est. Letra** (Badge verde `FIRMADA` / rojo `PENDIENTE`).
     - **Acciones Directas:** Botones individuales `Aprobar` (verde) y `Rechazar` (rojo).

### ⚡ Acciones de Lote y Aprobación Forzada (Cabecera)
En la barra superior del módulo (al lado del título **Bandeja de Aprobación de Factoring**):
- **`Aprobar Selección (N)`**: Aprueba en lote todas las facturas marcadas.
- **`Rechazar (N)`**: Rechaza en lote todas las facturas marcadas.
- **`Aprobación Forzada` (Checkbox)**: Permite aprobar facturas que no tengan Cavali en `ACEPTADA` o Letra en `FIRMADA`. Si no está marcado y alguna factura no cumple los requisitos, el sistema detiene el proceso y muestra una alerta explicativa.

---

## 💵 2. Módulo de Desembolsos (`DesembolsosTab.tsx`)

### 📋 Propósito y Responsabilidad
El módulo de **Desembolsos** es la 4ta etapa del flujo operativo. Recibe las propuestas aprobadas (`estado = APROBADO`) y ejecuta:
1. Resumen de montos líquidos a desembolsar (PEN y USD).
2. Consulta de cuentas bancarias y CCI del Cedente vía FastAPI.
3. Generación y descarga del **Voucher de Transferencia en PDF (1 página)**.
4. Carga de evidencias de transferencia (Sustento Único o Sustentos Individuales).
5. Selección de carpeta destino en **Google Drive** vía `DriveTreeView`.
6. Cambios de estado a `DESEMBOLSADA` y registro final.

### 📊 Tarjetas de Métricas de Resumen Superiores
Estandarizadas con el diseño de Aprobaciones:
1. **Facturas Pendientes:** Conteo total con ícono `Clock` en ámbar.
2. **Total Abono Pendiente (PEN):** Monto líquido a desembolsar en Soles (`DollarSign` en verde esmeralda).
3. **Total Abono Pendiente (USD):** Monto líquido a desembolsar en Dólares ($).

### 📁 Estructura Acordeón y Navegación
- **Rolodex Alfabético A-Z** en la parte superior.
- Acordeón jerárquico: **Empresa (Emisor) ➔ Lote ➔ Grupo ➔ Tabla de Facturas**.
- Colapsado por defecto al cargar para una navegación organizada.

---

## 🔒 3. Reglas Intangibles de UI y Blindaje Contra Modificaciones AI

Se incluyeron reglas estrictas en `.agents/AGENTS.md` y `Lecciones.de.Bienvenida.md`:
1. **Archivo Oficial Único:** `AprobacionesTab.tsx` (queda prohibido usar el legacy `AprobacionTab.tsx`).
2. **Prohibido reinventar la UI:** Las acciones individuales en Aprobaciones solo constan de los botones directos `Aprobar` y `Rechazar`. Queda prohibido añadir Popups/Modales ficticios de "Dictamen de Riesgos" o "Resumen de Operación".
3. **Selector de Letras A-Z:** Filtro exclusivo por el Emisor (Cedente).

---

*Última actualización de la nota: 2026-08-05*
