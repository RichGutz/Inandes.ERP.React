-- =========================================================================
-- SCRIPT DDL: CREACIÓN DE TABLA DEDICADA crm_valor_cuota_eventos
-- PROYECTO: InAndes ERP (Supabase: egvcinsbyropumybatdf)
-- MÓDULO: Gestión de Fondos -> Valor Cuota (NAV V27)
-- =========================================================================

CREATE TABLE IF NOT EXISTS public.crm_valor_cuota_eventos (
    id_evento UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    id_fondo VARCHAR(30) NOT NULL,
    nombre_fondo VARCHAR(150),
    fecha_corte DATE NOT NULL,
    anio INT NOT NULL,
    ciclo VARCHAR(20) NOT NULL, -- 'Bimestre' o 'Trimestre'
    num_periodo INT NOT NULL,   -- 1, 2, 3, 4, 5, 6
    fecha_inicio_periodo DATE NOT NULL,
    fecha_fin_periodo DATE NOT NULL,
    valor_cuota_inicial NUMERIC(16, 8) NOT NULL,
    valor_cuota_final NUMERIC(16, 8) NOT NULL,
    patrimonio_apertura NUMERIC(18, 4) NOT NULL,
    patrimonio_cierre NUMERIC(18, 4) NOT NULL,
    cuotas_apertura NUMERIC(18, 4) NOT NULL,
    cuotas_totales_cierre NUMERIC(18, 4) NOT NULL,
    capital_adicional_periodo NUMERIC(18, 4) DEFAULT 0,
    ingresos_brutos_periodo NUMERIC(18, 4) NOT NULL,
    pago_inversionistas_periodo NUMERIC(18, 4) NOT NULL,
    comision_admin_periodo NUMERIC(18, 4) NOT NULL,
    comision_captacion_periodo NUMERIC(18, 4) NOT NULL,
    comision_misc_periodo NUMERIC(18, 4) DEFAULT 0,
    tasa_activa_anual NUMERIC(10, 6),
    payload_resumen JSONB, -- desglose completo de días y conceptos para auditoría forense
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_by VARCHAR(100) DEFAULT 'SISTEMA_REACT'
);

-- Índices de alto rendimiento para consultas por corte y fondo
CREATE INDEX IF NOT EXISTS idx_vc_eventos_corte ON public.crm_valor_cuota_eventos(fecha_fin_periodo, id_fondo);
CREATE INDEX IF NOT EXISTS idx_vc_eventos_periodo ON public.crm_valor_cuota_eventos(anio, ciclo, num_periodo);

-- Habilitar RLS y políticas públicas para frontend anon
ALTER TABLE public.crm_valor_cuota_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura publica de valor cuota" ON public.crm_valor_cuota_eventos;
CREATE POLICY "Permitir lectura publica de valor cuota" ON public.crm_valor_cuota_eventos
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Permitir insercion anon de valor cuota" ON public.crm_valor_cuota_eventos;
CREATE POLICY "Permitir insercion anon de valor cuota" ON public.crm_valor_cuota_eventos
    FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Permitir eliminacion anon de valor cuota" ON public.crm_valor_cuota_eventos;
CREATE POLICY "Permitir eliminacion anon de valor cuota" ON public.crm_valor_cuota_eventos
    FOR DELETE USING (true);
