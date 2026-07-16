# El Triángulo de Autenticación: Google Console ↔ Supabase ↔ React ERP

Este documento sirve como un **Boilerplate Definitivo** (Vibe Coder Edition 🚀) para entender y configurar desde cero el flujo de autenticación OAuth usando Google como proveedor de identidad, Supabase como backend/gateway, y React como frontend para el ERP.

## 🏗️ La Arquitectura (Cómo funciona la magia)

Para que el login funcione sin problemas, tres entidades deben confiar entre sí y pasarse la pelota en el orden correcto:

1. **React ERP (Frontend)**: Tiene el botón "Iniciar Sesión con Google".
2. **Supabase (Backend)**: Recibe el click del usuario y genera un link seguro hacia Google.
3. **Google Cloud Console (IDP)**: Verifica quién es el usuario y le devuelve un token a Supabase (no a React directamente).
4. **Supabase (Backend)**: Recibe el token de Google, verifica que sea válido, crea/inicia la sesión en su base de datos, y **redirige de vuelta** a React con la sesión ya iniciada.

---

## 🛠️ Paso 1: Configurar el Proveedor en Google Cloud Console

Google necesita saber que existes y que le vas a pedir permisos para loguear a tus usuarios.

1. Ve a [Google Cloud Console > APIs & Services > Credentials](https://console.cloud.google.com/apis/credentials).
2. Haz clic en **+ CREATE CREDENTIALS** y elige **OAuth client ID**.
3. En **Application type**, selecciona **Web application**.
4. Ponle un nombre para reconocerlo (ej: `ERP V4 Auth`).
5. Se generarán dos datos ultra secretos e importantes:
   - **Client ID** (Termina en `.apps.googleusercontent.com`)
   - **Client Secret** (Una cadena alfanumérica como `GOCSPX-...`)

*(Pausa aquí. Aún falta llenar las URLs en Google, pero para eso necesitamos ir primero a Supabase).*

---

## 🛠️ Paso 2: Conectar Supabase con Google

Supabase debe actuar como el "Gateway". Necesita las llaves que acabas de crear en Google para poder hablar en tu nombre.

1. Ve a tu panel de **Supabase > Authentication > Providers**.
2. Busca **Google** y activa el interruptor verde (Enable).
3. Pega el **Client ID** y el **Client Secret** que obtuviste en el Paso 1.
4. En esta misma pantalla, Supabase te va a dar una URL mágica llamada **Callback URL (for OAuth)**.
   - *Ejemplo: `https://egvcinsbyropumybatdf.supabase.co/auth/v1/callback`*
5. Copia esa **Callback URL** y dale al botón **Save** en Supabase.

---

## 🛠️ Paso 3: Cerrar el Triángulo en Google Cloud (El paso donde todos fallan)

Google, por seguridad extrema, rechazará cualquier intento de login (el infame `Error 400: redirect_uri_mismatch`) si no le dices **EXACTAMENTE** a qué URL de Supabase debe devolver la respuesta.

1. Vuelve a **Google Cloud Console**, a la credencial que creaste en el Paso 1.
2. En la sección **Authorized JavaScript origins** (Orígenes de JavaScript autorizados), añade:
   - La URL de tu frontend en producción: `https://inandes.react.geeksoft.tech`
   - La URL de tu frontend local: `http://localhost:5173` (para que puedas probar desarrollando).
3. En la sección **Authorized redirect URIs** (URI de redireccionamiento autorizados), **ESTO ES LO MÁS CRÍTICO**, añade:
   - La **Callback URL** exacta que copiaste de Supabase: `https://egvcinsbyropumybatdf.supabase.co/auth/v1/callback`
   - *(No pongas la URL de tu React aquí como principal, porque Supabase es el intermediario).*
4. Dale a **Save**. (Nota: Google puede tardar hasta 5 minutos en aplicar este cambio en sus servidores globales).

---

## 🛠️ Paso 4: El Código en React (Frontend)

En el frontend, la lógica es extremadamente limpia gracias al SDK de Supabase.

1. **Variables de Entorno (`.env.local` / `.env.production`)**:
   Debes tener la URL de Supabase y la **Anon Key** (Clave Pública).
   ```env
   VITE_SUPABASE_URL="https://egvcinsbyropumybatdf.supabase.co"
   VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5..."
   ```

2. **El botón de Login (`LoginPage.tsx`)**:
   Cuando el usuario hace clic, llamas a `signInWithOAuth`.
   ```typescript
   const handleGoogleLogin = async () => {
     const { error } = await supabase.auth.signInWithOAuth({
       provider: 'google',
       options: {
         // Fuerza a Google a mostrar la pantalla de elegir cuenta
         queryParams: { prompt: 'select_account' }, 
         
         // A donde volver DESPUÉS de que Supabase procese el login
         redirectTo: window.location.origin 
       }
     });
   };
   ```

3. **Escuchar la Sesión (`App.tsx`)**:
   React debe "darse cuenta" de que el usuario ya volvió logueado. Para eso usamos un Listener en el componente principal de la app:
   ```typescript
   useEffect(() => {
     supabase.auth.getSession().then(({ data: { session } }) => {
       setSession(session);
     });

     supabase.auth.onAuthStateChange((_event, session) => {
       setSession(session);
     });
   }, []);
   ```

---

## 🛡️ Paso 5: Row Level Security (RLS) - El Bloqueo Invisible

Incluso si el login con Google es exitoso y el `session` existe, **la base de datos puede rechazar las consultas de permisos**.

Si creas una tabla como `user_module_access` para guardar los roles (Administrador, Visor) y le habilitas **Row Level Security (RLS)**, las peticiones que haga el frontend logueado fallarán por defecto devolviendo arreglos vacíos `[]`.

**Para evitar que la app muestre "Acceso Denegado" erróneamente:**
1. O bien creas una Política (Policy) en Supabase permitiendo `SELECT` a los usuarios con rol `authenticated`.
2. O bien desactivas el RLS en esa tabla específica (si los datos no son críticos/sensibles), ejecutando este SQL:
   ```sql
   ALTER TABLE public.user_module_access DISABLE ROW LEVEL SECURITY;
   ```

---

## 🚀 Resumen del Flujo Exitoso

1. Usuario entra a `https://inandes.react.geeksoft.tech`.
2. Hace clic en "Iniciar Sesión con Google".
3. React llama a Supabase.
4. Supabase arma un link y manda al usuario a `accounts.google.com`.
5. Google verifica el `Client ID` y revisa que la **Redirect URI** de Supabase esté en su lista blanca.
6. El usuario elige su correo y acepta.
7. Google manda un token a la **Callback URL** de Supabase.
8. Supabase lee el token, dice "Es un usuario válido", crea la sesión en su BD interna, y redirige al usuario a `https://inandes.react.geeksoft.tech` (`redirectTo: window.location.origin`).
9. El `useEffect` de React detecta la nueva sesión mágica, extrae el email del usuario, hace un `SELECT` a la tabla de roles (que ya no bloquea por RLS), y muestra el Dashboard de Vibe Coder. ✨
