# Flowchart de Lógica de Negocio - CRM Inandes

Este diagrama modela el ciclo de vida de una inversión, desde el depósito inicial hasta la generación y tratamiento de los cupones bimestrales.

```mermaid
flowchart TD
    %% --- ENTITIES ---
    subgraph MASTER_DATA [1. Configuración Inicial]
        Person[👤 Partícipe]
        Fund[🏦 Fondo (Reglas de Tasa)]
    end

    %% --- CREATION ---
    subgraph INCEPTION [2. Nacimiento del Depósito]
        Deposit[💰 Depósito Nuevo]
        Rules[📜 Fijar Reglas]
        Attr[Instrucción: ¿Pagar o Capitalizar?]
        
        Person --> Deposit
        Fund --> Rules
        Rules -->|Aplica Tasa %| Deposit
        Deposit --> Attr
    end

    %% --- TIME LOOP ---
    subgraph LIFECYCLE [3. Ciclo Bimestral]
        TimePass[⏳ Pasan 2 Meses]
        EventGen((⚡ Generar Evento/Cupón))
        Calc[🧮 Calcular Interés Bruto]
        Tax[💸 Restar 5% Retención]
        Net[💰 Obtener Neto]

        Deposit --> TimePass
        TimePass --> EventGen
        EventGen --> Calc
        Calc --> Tax
        Tax --> Net
    end

    %% --- DECISION ---
    subgraph DECISION [4. Bifurcación de Destino]
        Switch{¿Instrucción?}
        
        Net --> Switch
        
        %% CAMINO A: PAGO
        Switch -- Pagar --> PayoutNode[📤 Generar Orden de Pago]
        PayoutNode --> Voucher[📄 PDF Voucher Interés]
        Voucher --> Transfer[🏦 Transferencia Bancaria]
        Transfer --> EndPeriodA[🏁 Fin Periodo (Capital Intacto)]

        %% CAMINO B: CAPITALIZACION
        Switch -- Capitalizar --> CompoundNode[📈 Sumar al Principal]
        CompoundNode --> UpdateCert[🔄 Actualizar Certificado]
        UpdateCert --> EndPeriodB[🏁 Fin Periodo (Capital Aumentado)]
    end

    %% --- LOOP BACK ---
    EndPeriodA -.->|Esperar sgte bimestre| TimePass
    EndPeriodB -.->|Esperar sgte bimestre| TimePass

    %% STYLING
    classDef money fill:#e1f5fe,stroke:#01579b,stroke-width:2px;
    classDef process fill:#f3e5f5,stroke:#4a148c,stroke-width:2px;
    classDef decision fill:#fff9c4,stroke:#fbc02d,stroke-width:2px;
    
    class Deposit,Net,PayoutNode,CompoundNode money;
    class EventGen,Calc,Tax process;
    class Switch decision;
```
