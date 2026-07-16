-- Asegurarse de que la tabla user_module_access tenga la estructura requerida.
-- Si la tabla ya existe y difiere, se asume que las columnas esenciales son: email, modulo, rol.

DROP TABLE IF EXISTS public.user_module_access CASCADE;

CREATE TABLE public.user_module_access (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) NOT NULL,
    nombre_completo VARCHAR(255) NOT NULL,
    modulo VARCHAR(50) NOT NULL, -- Ej: 'CRM', 'FACTORING'
    rol VARCHAR(50) NOT NULL,    -- Ej: 'ADMIN', 'VISOR'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(email, modulo)
);

-- Limpiar los registros existentes para asegurar consistencia con el nuevo requerimiento
DELETE FROM public.user_module_access;

-- 1. rgallo@inandes.com: ADMIN en CRM, VISOR en Factoring.
INSERT INTO public.user_module_access (email, nombre_completo, modulo, rol) VALUES ('rgallo@inandes.com', 'Ricardo Gallo', 'CRM', 'ADMIN');
INSERT INTO public.user_module_access (email, nombre_completo, modulo, rol) VALUES ('rgallo@inandes.com', 'Ricardo Gallo', 'FACTORING', 'VISOR');

-- 2. jparra@inandes.com: VISOR en CRM.
INSERT INTO public.user_module_access (email, nombre_completo, modulo, rol) VALUES ('jparra@inandes.com', 'Yanneth Parra', 'CRM', 'VISOR');

-- 3. operaciones@inandes.com: VISOR en Factoring.
INSERT INTO public.user_module_access (email, nombre_completo, modulo, rol) VALUES ('operaciones@inandes.com', 'Lucy Carpio', 'FACTORING', 'VISOR');

-- 4. Analistajr01@inandes.com: ADMIN en Factoring.
INSERT INTO public.user_module_access (email, nombre_completo, modulo, rol) VALUES ('Analistajr01@inandes.com', 'Christie Awa', 'FACTORING', 'ADMIN');

-- 5. rgutil@gmail.com: ADMIN global (CRM y Factoring).
INSERT INTO public.user_module_access (email, nombre_completo, modulo, rol) VALUES ('rgutil@gmail.com', 'Richard Gutierrez', 'CRM', 'ADMIN');
INSERT INTO public.user_module_access (email, nombre_completo, modulo, rol) VALUES ('rgutil@gmail.com', 'Richard Gutierrez', 'FACTORING', 'ADMIN');
