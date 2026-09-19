# Reformulacion Estetica y Matematica de Estados de Cuenta (EE.CC.)
**Fuente:** `Exceles.Ricardo.Gallo/Modelos.EE.CC.RGP.18.09.26.xlsx`  
**Fecha de Analisis:** 19-Sep-2026  
**Autor del Modelo:** Ricardo Gallo (RGP)  
**Objetivo:** Documentar la reestructuracion estetica, jerarquia visual, codigo de colores y conciliacion matematica de los Estados de Cuenta de Inversionistas para la construccion del nuevo generador PDF V4.

---

## 1. Diagnostico del Modelo Anterior vs. Modelo RGP

En las versiones previas de los Estados de Cuenta se detecto una inconsistencia critica en los calculos de liquidacion cuando existian deducciones o penalidades por rescate anticipado (caso Paulina Tejada):
- Se listaba la penalidad con signo negativo `(-) Penalidades por rescate anticipado: USD 4,250.00`, pero en la linea de **Monto transferido / abonado** se sumaba el capital total mas la ganancia neta sin restar dicha penalidad.
- El modelo reformulado de Ricardo Gallo resuelve esta inconsistencia reestructurando la naturaleza de las lineas, separando claramente lo que corresponde a **Rendimiento/Capitalizacion**, lo que corresponde a **Transferencias/Flujo de Caja**, y el **Cierre de Posicion/Capital Residual**.

---

## 2. Verificacion Matematica de los 3 Inversionistas de Prueba

Se auditaron y validaron al 100% las cifras de las 3 pestanas del archivo de Ricardo Gallo:

| Linea / Concepto | Gladys Yanneth Parra | Paulina Leonor Tejada | Rodrigo Aravena Elias | Tipo / Naturaleza |
| :--- | :---: | :---: | :---: | :---: |
| **Monto inicial invertido** | `PEN 925,000.00` | `PEN 83,952.73` | `PEN 100,643.85` | Capital Base |
| **Ganancia bruta obtenida** | `PEN 1,140.84` | `PEN 1,140.84` | `PEN 1,624.09` | Rendimiento Bruto |
| **(-) Impuesto a la Renta (5%)** | `PEN 57.04` | `PEN 57.04` | `PEN 81.20` | Retencion Tributaria |
| **Ganancia disponible del participe** | `PEN 1,083.80` | `PEN 1,083.80` | `PEN 1,542.89` | Rendimiento Neto |
| **(-) Retenciones a las ganancias obtenidas** | `PEN 0.00` | `PEN 4,250.00` | `PEN 0.00` | Penalidad / Deduccion |
| **(+) Inversiones adicionales del participe** | `PEN 0.00` | `PEN 0.00` | `PEN 0.00` | Aporte de Capital |
| **Monto destinado para adquirir nuevas cuotas**| `PEN 0.00` | `PEN 0.00` | `PEN 0.00` | Capitalizacion |
| **Monto transferido a su cuenta bancaria** | `PEN 15,673.05` | `PEN 1,083.80` | `PEN 1,542.89` | Flujo Bancario (Ganancia) |
| **Rescates solicitados por el participe** | `PEN 325,000.00` | `PEN 79,702.73` | `PEN 20,643.85` | Devolucion de Capital |
| **Monto de la inversion al 31-ago-26** | `PEN 600,000.00` | `PEN 0.00` | `PEN 80,000.00` | Capital Final Cuadrado |
| **Numero de cuotas al 31-ago-26** | `600,000 CUOTAS` | `0 CUOTAS` | `80,000 CUOTAS` | Posicion de Cuotas |
| **Fecha de cierre del fondo / contrato** | `31/12/2027` | `31/12/2027` | `31/12/2027` | Vencimiento Contrato |

---

## 3. Resolucion Especifica del Caso Tejada (Penalidad de Rescate)

- **Monto Inicial:** `PEN 83,952.73`
- **Ganancia Neta Transferida:** `PEN 1,083.80`
- **Penalidad/Retencion:** `PEN 4,250.00`
- **Capital Devuelto Efectivo (Rescate):** `PEN 79,702.73` ($83,952.73 - 4,250.00$)
- **Formula de Cierre de Capital:**
  $$\text{Monto Inversion Final} = \text{Monto Inicial} - \text{Rescates} - \text{Retenciones}$$
  $$\text{Monto Inversion Final} = 83,952.73 - 79,702.73 - 4,250.00 = \mathbf{0.00}$$
- **Resultado:** Cuadre matematico perfecto y cierre total de cuotas (0 cuotas) sin saldos huerfanos.

---

## 4. Reestructuracion Visual y Codigo de Colores (Diseno RGP)

Ricardo Gallo incorporo bandas de color tematicas para distinguir intuitivamente los distintos bloques financieros:

### A. Bloque de Rendimiento y Capitalizacion (Celeste Suave: `#CCECFF`)
- **Fondo:** `#CCECFF` (RGB: 204, 236, 255)
- **Filas Afectadas:**
  1. *Ganancia bruta obtenida:*
  2. *Ganancia disponible del participe:*
  3. *Monto destinado para adquirir nuevas cuotas:*
- **Proposito:** Resaltar la rentabilidad generada por el fondo y si esta se reinvierte o no.

### B. Bloque de Pagos y Liquidaciones al Cliente (Verde Suave: `#E2EFD9`)
- **Fondo:** `#E2EFD9` (RGB: 226, 239, 217)
- **Filas Afectadas:**
  1. *Monto transferido a su cuenta bancaria:*
  2. *Rescates solicitados por el participe:*
- **Proposito:** Mostrar con maxima claridad el efectivo desembolsado o transferido a la cuenta bancaria del inversionista.

### C. Bloque de Posicion y Cierre de Contrato
- **Estilo:** Contenedor o seccion de totales con borde solido.
- **Filas:**
  1. *Monto de la inversion al [Fecha]:* (Negrita)
  2. *Numero de cuotas al [Fecha]:* (Negrita, Formato CUOTAS)
  3. *Fecha de cierre del fondo / cierre del contrato:* (Nuevo metadato con formato fecha `DD/MM/AAAA` o `d-mmm-yy`)

---

## 5. Especificaciones para la Nueva Plantilla HTML/PDF (V4)

1. **Nombre de Plantilla:** `src/templates/estado_cuenta_inversionista_v4_rgp.html` (o `backend/templates/estado_cuenta_inversionista_v4_rgp.html`).
2. **Politica de Preservacion:** Mantener intactas las plantillas `v1`, `v2` y `v3_test`. No eliminar componentes anteriores.
3. **Tipografia:** `Consolas, 'Courier New', monospace` para garantizar alineacion decimal exacta.
4. **Encabezado Institucional:**
   - Titulo: `ESTADO DE CUENTA DEL CERTIFICADO DE INVERSION [N°] DEL FONDO [NOMBRE] - FONDO DE INVERSION PRIVADO`
   - Rango: `DEL [FECHA_INICIO] AL [FECHA_FIN]`
   - Titular: `Sr(a)(s): [NOMBRE COMPLETO]`
5. **Pie de Pagina Oficial:**
   - Razon Social: `INANDES ACTIVOS ALTERNATIVOS SAC`
   - Direccion: `Av. Javier Prado Este 560 Int 1403 Centro Empresarial Javier Prado, San Isidro, Lima`
   - Contacto: `Telefono: + 51 (1) 712 1700 | info@inandes.com`
