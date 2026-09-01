# INFORME EJECUTIVO: SEEDING Y AUDITORIA DE DATOS BANCARIOS
**Sistema InAndes ERP - CRM Inversionistas & Contratos de Inversion**  
*Fecha de Emision: 01 de Setiembre de 2026*  
*Base de Datos: Supabase Cloud (egvcinsbyropumybatdf)*

---

## 1. Resumen de la Actualizacion y Seeding de Inversionistas

Se ha ejecutado la sincronizacion y enriquecimiento de datos de la tabla **crm_inversionistas** a partir del archivo maestro del usuario `00 CRM INVERSIONISTAS 2026 08 05.xlsx`, previo resguardo de seguridad.

* **Backup Pre-Seeding:** Generado en `backup.datos.inversionistas.pre.seeding.01.09.26.xlsx` con los 232 registros historicos.
* **Registros Procesados y Actualizados:** **220 participes** (100% de exito en sincronizacion segura / *upsert*).
* **Campos Enriquecidos y Estandarizados:**
  * **139** Direcciones fiscales completadas y formalizadas.
  * **42** Codigos postales normalizados al formato oficial de 5 digitos.
  * **28** Bancos en Soles (PEN) y **3** Bancos en Dolares (USD) actualizados.
  * **16** Numeros de cuenta bancaria en PEN y **3** en USD agregados.
  * **14** Codigos Interbancarios (CCI) en PEN y **3** en USD registrados.
  * **7** Estados civiles, **5** correos electronicos y **3** numeros telefonicos actualizados.

---

## 2. Diagnostico General de Informacion Bancaria en Contratos

Se cruzaron los **214 contratos de inversion** registrados en el ERP con la informacion de los **Participes Titulares 1** (`id_inversionista_1`):

| Estado de la Informacion Bancaria | Total Contratos | Inversionistas Unicos | Diagnostico y Factibilidad Operativa |
|---|:---:|:---:|---|
| **Cuentas y CCI Completos** | **52** | **38** | **Operativo 100%:** Aptos para transferencia directa o interbancaria. |
| **Con Cuenta pero SIN CCI** | **80** | **48** | **Operativo Parcial:** Permite transferencia local (mismo banco); requiere CCI para interbancario. |
| **Con CCI pero SIN Cuenta Local** | **54** | **42** | **Operativo Interbancario:** Se transfiere via CCI nacional. |
| **SIN Cuenta NI CCI (Critico)** | **28** | **24** | **Bloqueo de Transferencia:** No disponen de medio de abono registrado. |

---

## 3. Plan de Accion y Clasificacion por Urgencia de Transferencias

Al analizar el flujo de caja, el **Saldo Contable Activo** y el modo de compensacion contractual (**Porcentaje de Reparto**), el universo de 28 contratos sin cuenta/CCI se categoriza en tres niveles de atencion:

### NIVEL 1: URGENCIA MAXIMA - 4 Participes con Reparto en EFECTIVO (100% Cash)
Estos inversionistas tienen contratos vigentes con instruccion de **abono en efectivo bimestral**. Al no contar con cuenta ni CCI en la moneda pactada, **sus transferencias periodicas no pueden ser procesadas**:

| Participe Titular | Documento | Contrato | Fondo | Capital Activo | Telefono | Correo Electronico |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| **Velit Granda de Razuri Tula Luisa** | 08786954 | NSGPEN03-015.20211118 | NSGPEN03 | **S/ 450,000.00** | 992 688 022 | alerazuriv@gmail.com |
| **Lamas Arrasco Angel Eduardo** | 16635150 | NSGPEN02-007.20251013 | NSGPEN02 | **S/ 100,000.00** | 979 997 408 | angele.lamasa@gmail.com |
| **Garcia Benavente Luciana Karina** | 73179724 | NSGPEN02-011.20220901 | NSGPEN02 | **S/ 90,000.00** | 951 506 915 | luoarcb@gmail.com |
| **Moscoso Zapata Jaennette Leyla** | 07482582 | NSGUSD02-046.20250401 | NSGUSD02 | **USD 42,851.79** | 975 564 518 | leylamosh7@gmail.com |

*Accion Inmediata Requerida: Contactar a estos 4 participes prioritariamente para recabar su cuenta de abono y evitar retencion de pagos de intereses.*

---

### NIVEL 2: CAPITALIZACION TOTAL (23 Contratos) - Sin necesidad de abono bimestral
Contratos con **0% de reparto** (capitalizacion del 100% de rendimientos acumulados al saldo del capital):
* **Impacto Operativo:** **No requieren transferencias periodicas** durante la vigencia del contrato.
* **Protocolo:** Se recabara la cuenta bancaria de destino unicamente al momento de gestionar un **Rescate Anticipado** o a la **Fecha de Vencimiento** del contrato (entre Agosto 2026 y Diciembre 2031).

| N | Participe Inversionista | Documento | Contrato | Fondo | Capital Acumulado | Fecha Vto | Telefono |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| 1 | Ojeda Novoa Sheila Miriam | 02715386 | NSGPEN01-053.20160101 | NSGPEN01 | S/ 531,139.20 | 2027-12-31 | 977 536 983 |
| 2 | Leon Montano Luis Fernando | 06699824 | NSGPEN01-049.20160101 | NSGPEN01 | S/ 436,650.54 | 2027-12-31 | 999 765 516 |
| 3 | Sanchez Monteblanco Maria Guadalupe | 07707547 | NSGPEN03-056.20240710 | NSGPEN03 | S/ 328,606.11 | 2026-08-31 | 999 948 382 |
| 4 | Perez Aliaga Cesar Saul | 76272768 | NSGPEN01-090.20160101 | NSGPEN01 | S/ 325,272.51 | 2027-12-31 | 945 755 729 |
| 5 | Matos Rodriguez Mauricio Gerardo | 71835379 | NSGPEN03-005.20251117 | NSGPEN03 | S/ 250,236.49 | 2030-12-31 | 987 260 822 |
| 6 | Valdez Gonzales Luz Consuelo | 09202420 | NSGPEN02-049.20250905 | NSGPEN02 | S/ 229,393.63 | 2027-10-31 | 996 053 856 |
| 7 | Jarufe Medina Rufino | 29206150 | NSGPEN03-077.20250805 | NSGPEN03 | S/ 220,701.44 | 2026-08-31 | 981 174 316 |
| 8 | Huaman Almonacid Jorge Eliseo | 23953250 | NSGPEN03-074.20250513 | NSGPEN03 | S/ 210,281.00 | 2028-06-30 | - |
| 9 | Sanchez Santillan Teresa de Jesus | 07945584 | NSGPEN01-069.20160101 | NSGPEN01 | S/ 190,130.39 | 2027-12-31 | 999 724 385 |
| 10 | Martinez Ortiz Juan Jose | 09392230 | NSGPEN03-071.20250331 | NSGPEN03 | S/ 168,773.43 | 2030-04-30 | 999 949 815 |
| 11 | Salas Gomez Alfredo | 08714867 | NSGPEN03-072.20250507 | NSGPEN03 | S/ 167,153.97 | 2030-06-30 | 943 613 369 |
| 12 | Huaman Almonacid Jorge Eliseo | 23953250 | NSGPEN03-073.20250513 | NSGPEN03 | S/ 110,089.01 | 2027-06-30 | - |
| 13 | Quispe Saire Ruth Janet | 40813155 | NSGPEN03-029.20260203 | NSGPEN03 | S/ 103,701.74 | 2029-02-28 | 962 939 022 |
| 14 | Alvarado Gubler Lina Hilda Felipa | 07662698 | NSGPEN03-001.20260120 | NSGPEN03 | S/ 87,356.91 | 2027-02-28 | 941 454 261 |
| 15 | Tejada Cornejo Paulina Eleonor | 29272582 | NSGUSD02-017.20250101 | NSGUSD02 | USD 83,952.73 | 2027-12-31 | 959 860 404 |
| 16 | Ojeda Novoa Sheila Miriam | 02715386 | NSGUSD01-033.20160101 | NSGUSD01 | USD 83,782.41 | 2027-12-31 | 977 536 983 |
| 17 | Lujan Uculmana Vanessa Lisett | 40779246 | NSGPEN03-032.20230501 | NSGPEN03 | S/ 71,684.67 | 2028-04-30 | 962 241 967 |
| 18 | Cossio Ventura Nicolas Max | 73870152 | NSGPEN03-021.20260119 | NSGPEN03 | S/ 62,319.76 | 2028-02-28 | 968 494 220 |
| 19 | Salas Gomez Alfredo | 08714867 | NSGPEN02-013.20251229 | NSGPEN02 | S/ 52,420.31 | 2030-12-31 | 943 613 369 |
| 20 | Fouscas Elera Victor Hugo | 10799830 | NSGPEN03-058.20240923 | NSGPEN03 | S/ 52,264.06 | 2031-12-31 | 955 886 721 |
| 21 | Gallo Gonzalez Juan Ricardo | 70405795 | NSGPEN01-089.20160101 | NSGPEN01 | S/ 42,244.46 | 2027-12-31 | 997 362 498 |
| 22 | Salas Gomez Alfredo | 08714867 | NSGUSD02-026.20230131 | NSGUSD02 | USD 31,971.87 | 2028-02-28 | 943 613 369 |
| 23 | Carrillo Melendez Gissella del Pilar | 06772607 | NSGUSD02-034.20240422 | NSGUSD02 | USD 29,788.60 | 2029-04-30 | 955 500 468 |

---

### NIVEL 3: CONTRATOS CERRADOS / EXTINGUIDOS (1 Contrato)
* **Participe:** **Zuzunaga Gomez de Barra Katty Ana** (Doc: `09378278`)
* **Contrato:** `NSGUSD02-021.20240901` (Fondo NSGUSD02)
* **Estado:** `cerrado_por_rescate` (Liquidado en Abril 2026).
* **Saldo Actual:** **USD 0.00**
* **Conclusion:** **No requiere cuenta bancaria** dado que la liquidacion ya fue completada y el contrato se encuentra formalmente cerrado y extinguido.
