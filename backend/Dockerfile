# Dockerfile para FastAPI Backend (InAndes ERP) en Coolify
FROM python:3.11-slim

# Evitar escritura de bytecode de python y forzar stdout sin buffer
ENV PYTHONDONTWRITEBYTECODE 1
ENV PYTHONUNBUFFERED 1

# Instalación de librerías del sistema operativo requeridas para PDF y Postgres
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    poppler-utils \
    ghostscript \
    tesseract-ocr \
    curl \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copiar requerimientos e instalar dependencias Python
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar código fuente
COPY . .

# Puerto expuesto para FastAPI
EXPOSE 8010

# Comando de ejecución con Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8010", "--workers", "4"]
