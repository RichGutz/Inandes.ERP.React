# 📄 Especificación y Diagnóstico: REPORTE BELLO CON DESGLOSE

> **Nota Hija de [00.A — Módulo de Inversionistas](file:///C:/Users/rguti/Inandes.ERP.React/Obsidian/Inandes.Inversionistas.React/00.A.INVERSIONISTAS.md)**  
> **Fecha:** 11 de Agosto de 2026  
> **Safe Point Relacionado:** `DESGLOSE.EXCEL.DINAMICO.OFICIAL` (Commit `1c570c6`)

---

## 1. 🎯 Objetivo del Requerimiento

Garantizar la presencia del **Desglose de Aumentos de Capital** en la exportación de **Excel Maestro**, coincidiendo 1:1 con la tabla del PDF Bello.

Ejemplo oficial verificado de salida:
```
#   Certificado             Inversionista              Capital Base   INT. BRUTO  IR (5%)  BASE NETA ...
33  NSGPEN01-090.20160101   Pérez Aliaga Saul / Cano   S/ 220,940.74  S/ 6,279.43 S/ 313.97 ...
-   Aumento (02/01/26)      └─ Incremento de Capital   S/ 60,000.00   S/ 1,001.10 -        -
-   Aumento (03/01/26)      └─ Incremento de Capital   S/ 9,000.00    S/ 147.58   -        -
-   Aumento (12/01/26)      └─ Incremento de Capital   S/ 100,000.00  S/ 1,380.82 -        -
```

---

## 🔍 2. Auditoría y Loop QC de Causa Raíz

### ❌ Causa del Problema en Excel
* En `InversionistasPage.tsx`, el botón "Descargar / Consultar Excel Maestro" contenía un redireccionamiento estático:
  `if (fEnd === '2026-02-28') window.open('/Reportes_Auditoria_2026-02-28/AUDITORIA_OFICIAL_SISTEMA_2026-02-28_PULIDO.xlsx', '_blank')`.
* Al descargar el Excel para el 28 de Febrero, la interfaz no ejecutaba la función `handleExportExcelV40()`, sino que entregaba una plantilla estática antigua en disco que no poseía las filas desglosadas de `└─ Incremento de Capital`.

### ✅ Solución Aplicada
1. **Eliminación del Atajo Estático:** Se removió la condición del botón de Excel en `InversionistasPage.tsx`, haciendo que cualquier descarga ejecute `handleExportExcelV40()` de forma dinámica.
2. **Estructura Desglosada en Excel (`handleExportExcelV40`):** Cada pestaña de fondo (`Fondo_[ID]`) renderiza la lista `pdfData` con la fila del certificado principal y sus sub-filas de `Aumento (DD/MM/YY)` rotuladas como `└─ Incremento de Capital`, asignando su `Capital Base` e `INT. BRUTO` devengado, con guiones `"-"` en las columnas no aplicables.

---

## 🛠️ 3. Protocolo de Despliegue (Regla 11)

1. `npm run build`
2. `python deploy_vps.py`
3. `git add .` -> `git commit -m "..."` -> `git push origin main`
