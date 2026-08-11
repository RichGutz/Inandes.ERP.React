# Arquitectura y Lógica de Retornos v4.0 — Módulo Inversionistas ERP

Esta nota documenta exhaustivamente el funcionamiento del **Motor de Retornos v4.0**, la generación de contratos, el ciclo de vida de los certificados, los movimientos de capital (incrementos y rescates) y las reglas de integración entre el Frontend React y el Backend Python/Supabase.

---

## 1. Visión General de Arquitectura

El ERP opera bajo un modelo de separación estricta de responsabilidades:

- **Backend / Persistencia (Python / FastAPI / Supabase):**
  - Ubicación código fuente Backend: `C:\Users\rguti\mini_erp_v2_antigravity\src\api\`
  - Servidor de Producción VPS: `https://api-factoring.geeksoft.tech`
  - Base de Datos: Supabase PostgreSQL (`egvcinsbyropumybatdf`).
  - Responsabilidad: Parseo de PDFs, cálculo financiero oficial v4.0, cronogramas de rescates/deducciones y registro de asientos de cierre de período.

- **Frontend (React / TypeScript / Tailwind):**
  - Ubicación código fuente Frontend: `C:\Users\rguti\Inandes.ERP.React\src\`
  - Aplicación Producción VPS: `https://inandes.react.geeksoft.tech`
  - Responsabilidad: Visualización de fichas de inversionistas, liquidaciones por fondo, simulaciones de cierre y exportación de reportes PDF/Excel.

---

## 2. Estructura y Nomenclatura de Contratos y Certificados

### 2.1 Formato del ID de Certificado
Cada certificado posee una clave única compuesta por el código del contrato, la fecha de emisión/inicio y la fecha de vencimiento/cierre de período:

$$\text{ID\_Certificado} = \text{ID\_Contrato} . \text{YYYYMMDD\_Inicio} . \text{YYYYMMDD\_Fin}$$

*Ejemplo:* `NSGPEN01-001.20160101.20251231`
- `NSGPEN01-001`: Código base del contrato del inversionista.
- `20160101`: Fecha de emisión/inicio original.
- `20251231`: Fecha de fin del período contable previo.

### 2.2 Transición por Asiento de Cierre de Período
Cuando se ejecuta el cálculo v4.0 para una fecha de corte (ej. `2026-02-28`), el motor genera un asiento registrado en la tabla `asientos_cierre_periodo`:
- `fecha_periodo_origen`: `2026-01-01`
- `fecha_periodo_fin`: `2026-02-28`
- El ID del nuevo certificado generado por el cierre pasa a ser: `${id_contrato}.${fecha_periodo_origen}.${fecha_periodo_fin}` (ej. `NSGPEN01-001.20160101.20260228`).

---

## 3. Jerarquía y Movimientos de Certificados

### 3.1 Certificado Padre (Contrato Principal)
- Representa el capital base inicial suscrito por el inversionista.
- Propiedades clave: `capital_base`, `tasa_pactada`, `porcentaje_reparto` (0% a 100%), `moneda` (PEN o USD).

### 3.2 Movimientos Secundarios (Incrementos de Capital / Hijos)
- **Incremento de Capital (Aumento):** Suscripciones adicionales realizadas durante el período vigente.
- Poseen su propia fecha de abono (`fecha_inicio`) y monto abonado.
- **Cálculo Proporcional:** Los intereses del aumento se devengan **exclusivamente desde su fecha de abono** hasta la fecha de cierre de período ($N$ días transcurridos base 365):

$$\text{Interés Aumento} = \text{Monto Aumento} \times \left( (1 + \text{Tasa})^{\frac{N}{365}} - 1 \right)$$

- En los reportes de auditoría, los aumentos pueden listarse como sub-filas itálicas desglosadas `└─ Incremento de Capital` vinculadas a su certificado padre.

### 3.3 Rescates y Penalidades de Capital
- **Rescates (Devolución de Capital):** Disminución de capital programada o ejecutada dentro del período.
- **Penalidades por Rescate:** Cargos deducidos del rescate cuando el contrato no ha cumplido el plazo mínimo de permanencia.
- Se descuentan al calcular el `Capital Final Saldo`.

---

## 4. Fórmula Matemática del Motor v4.0 (`financialCalculator.ts`)

Para un período de $D$ días (base 365, ej. 59 días del 01/Ene al 28/Feb):

1. **Interés Bruto Devengado:**
   $$\text{Bruto} = \text{Capital Base} \times \left( (1 + \text{Tasa Pactada})^{\frac{D}{365}} - 1 \right) + \sum \text{Intereses Aumentos}$$

2. **Retención de Impuesto a la Renta 5% (Segunda Categoría):**
   $$\text{IR (5\%)} = \text{Interés Bruto} \times 0.05$$

3. **Interés Neto Disponible:**
   $$\text{Base Neta} = \text{Interés Bruto} - \text{IR (5\%)}$$

4. **Capitalización vs. Reparto:**
   - **Reparto en Efectivo:** $\text{Reparto} = \text{Base Neta} \times \text{porcentaje\_reparto}$
   - **Capitalización:** $\text{Capitalización} = \text{Base Neta} \times (1 - \text{porcentaje\_reparto})$

5. **Deducciones Ordinarias y Penalidades:**
   - $\text{Deducciones Ordinarias}$: Cargos administrativos o comisiones de gestión.
   - $\text{Neto Final}: \text{Reparto} - \text{Deducciones Ordinarias}$.

6. **Capital Final Vigente:**
   $$\text{Capital Final} = \text{Capital Base} + \text{Aumentos} + \text{Capitalización} - \text{Rescates} - \text{Penalidades}$$

---

## 5. Puntos de Control ("Safe Points") y Protocolos

### 5.1 Safe Point Registrado
- **Nombre de Commit Oficial:** `BELLO.SIN.DESGLOSE.TODOS`
- **Hash Git:** `217a682`
- **Rama:** `main` (`origin/main`)
- **Descripción:** Mantiene intacta la exportación del PDF "Bello" original sin desgloses para la descarga global de todos los fondos.

### 5.2 Protocolo Obligatorio de Despliegue
Cualquier actualización en el módulo de inversionistas debe seguir estrictamente los 3 pasos:
1. `npm run build`
2. `python deploy_vps.py`
3. `git add .` -> `git commit -m "..."` -> `git push origin main`
