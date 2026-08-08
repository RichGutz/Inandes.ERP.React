# GUIA DE MOTORES Y REPORTES CRM

Esta carpeta centraliza el "Cerebro" del módulo CRM. Aquí tienes dónde se genera cada reporte:

### 1. Motores de Cálculo (NAV y P&L)
- **Ruta**: `C01_Motores_Calculo_NAV_y_PYL/`
- **Scripts**: `MOTOR_A_y_B_Calculo_NAV_y_PYL.py` y `CALCULO_Retornos_Intereses_Base365.py`
- **Función**: El corazón matemático. Calcula Valor Cuota y P&L.

### 2. Generación de Reportes Batch
- **Ruta**: `C02_Orquestador_Reportes_Batch/`
- **Script**: `ORQUESTADOR_Reportes_Batch_Integrado.py`
- **Función**: Genera Estados de Cuenta y Retenciones Masivas.

### 3. Generación de Documentación y Fichas
- **Ruta**: `C03_Generador_Documentos_Fichas/`
- **Script**: `GENERADOR_Documentos_y_Fichas_CRM.py`
- **Función**: PDFs unitarios y fichas de partícipes.

### 4. Flujogramas y Mapas Visuales
- **Ruta**: `C04_Mapas_Arquitectura_CRM/`
- **Script**: `FLUJOGRAMA_Arquitectura_CRM_V18.py`
- **Función**: Genera el mapa visual de la arquitectura.

---
*Nota: Al ejecutar los scripts (1) y (2), los PDFs resultantes se guardan automáticamente en la carpeta `/reports/` del proyecto.*
