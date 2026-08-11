# 📄 Especificación y Diagnóstico: REPORTE BELLO CON DESGLOSE

> **Nota Hija de [00.A — Módulo de Inversionistas](file:///C:/Users/rguti/Inandes.ERP.React/Obsidian/Inandes.Inversionistas.React/00.A.INVERSIONISTAS.md)**  
> **Fecha:** 11 de Agosto de 2026  
> **Safe Point Relacionado:** `BELLO.FINALES.LOGOS.Y.RESCATES` (Commit `d522899`)

---

## 1. 🎯 Objetivo del Requerimiento

El objetivo es consolidar el módulo de Inversionistas con 2 ajustes finales de UX y consistencia de datos:

1. **Persistencia Estricta de Navegación UI (`activeSubTab`):**
   - Evitar que la interfaz salte a la pestaña de `datos` tras exportar o imprimir reportes PDF. La pantalla debe permanecer fija en `retornos_react` utilizando persisterna en `sessionStorage`.

2. **Algoritmo de Desglose de Aumentos en el Excel Maestro:**
   - Garantizar que las sub-filas de incrementos de capital figuren desglosadas en el Excel con la etiqueta `└─ Incremento de Capital` e incluyendo su `Capital Base` e `INT. BRUTO` devengado correspondiente.

---

## 🔍 2. Diagnóstico Técnico

### A. Salto de Pestaña al Imprimir PDF
- Al invocar `window.open` y disparar el diálogo de impresión, el cambio de foco de ventana causaba un re-render de `InversionistasPage.tsx`. Como el estado `activeSubTab` iniciaba con el valor estático `'datos'`, la UI se reseteaba a la pestaña inicial.
- **Solución:** Inicializar `activeSubTab` leyendo de `sessionStorage.getItem('inv_active_subtab') || 'retornos_react'` y guardar su valor en cada cambio.

### B. Desglose en Excel Maestro (`financialCalculator.ts`)
- En `financialCalculator.ts`, al iterar los `hijos` (aumentos de capital) para construir `rowsXls`, la propiedad `"Inversionista"` se enviaba vacía (`""`) y `"INT. BRUTO"` se forzaba a `0.0`.
- **Solución:** Asignar `"Inversionista": "└─ Incremento de Capital"` y `"INT. BRUTO": Math.round(h.interes_acum * 100) / 100` a cada fila de aumento en `rowsXls`.

---

## 🛠️ 3. Plan de Acción (PASO 4)

1. **Modificar `InversionistasPage.tsx`:**
   - Añadir lectura y escritura de `sessionStorage` para `activeSubTab`.

2. **Modificar `financialCalculator.ts`:**
   - En la sección de construcción de `rowsXls` (líneas 457-474), poblar `Inversionista` con `"└─ Incremento de Capital"` e `INT. BRUTO` con el devengue acumulado del aumento.

3. **Compilar y Desplegar (Regla 11):**
   - `npm run build`
   - `python deploy_vps.py`
   - `git add .` -> `git commit -m "..."` -> `git push origin main`
