# Arquitectura de Datos: CRM Versión 4 (Flujo Ultra-Vertical)

Esta versión es una evolución puramente visual y organizativa de la V3. Se busca la máxima legibilidad mediante una disposición estrictamente vertical de las capas de datos, desde la captación hasta el ledger contable.

## 📌 Diferenciación de Capas (V4)

1.  **Capa Maestra (Top)**: Los motores de negocio (Fondos, Inversionistas, Asesores).
2.  **Capa Transaccional (Middle)**: Gestión de compromisos y estados (Contratos, Borradores).
3.  **Capa de Inteligencia (Process)**: Separación entre el **Motor de Cálculo** (matemática pura in-memory) y el **Motor de Asientos** (orquestador de persistencia y disparador de cambios de estado en los contratos).
4.  **Capa Inmutable y Operativa (Bottom)**: 
    *   **Ledger de Eventos**: Fuente de Verdad del historial.
    *   **Cronograma de Deducciones**: Provee las variables de **Rescates y Penalidades (Waiver)** que el Motor V32 utiliza para recalcular intereses antes de un cierre.

---

## 🛠️ Mejoras Visuales en V4
*   **Alineamiento Estricto**: Uso de agrupaciones de rango para evitar que las cajas se expandan horizontalmente.
*   **Flujo de Gravedad**: La relación `Contrato ➔ Ledger` ahora es el eje central del diagrama.
*   **Identificación de Módulos**: Cada entidad visual incluye el código del archivo `.py` que la gestiona.
