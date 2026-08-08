FROM python:3.9-slim
# Railway FORCE REBUILD: 2026-01-17-16:11 - Fix Supabase env vars

# 1. Instalar dependencias de sistema para Graphviz
RUN apt-get update && apt-get install -y \
    graphviz \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

# 2. Configurar directorio de trabajo
WORKDIR /app

# 3. Copiar archivos de requerimientos primero (para aprovechar cache de Docker)
COPY requirements.txt .

# 4. Instalar librerias Python
RUN pip install --no-cache-dir --upgrade pip
RUN pip install --no-cache-dir -r requirements.txt

# 5. Copiar el resto del codigo fuente
COPY . .

# 6. Exponer puerto de Streamlit
EXPOSE 8501

# 7. Chequeo de salud (Healthcheck) para que Railway sepa si arranco
HEALTHCHECK CMD curl --fail http://localhost:8501/_stcore/health || exit 1

# 8. Comando de inicio (Asegurando bind a 0.0.0.0 para acceso externo)
CMD ["streamlit", "run", "Home.py", "--server.port=8501", "--server.address=0.0.0.0"]
