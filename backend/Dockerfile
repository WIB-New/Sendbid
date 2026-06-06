# SENDBID Backend — FastAPI production image
# Build : docker build -t sendbid-backend ./backend
# Run   : docker run -p 8001:8001 --env-file .env sendbid-backend
FROM python:3.11-slim

# OS deps (build tools + libs minimales pour pillow/jwt/bcrypt/etc.)
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 1) install Python deps (cache layer)
COPY requirements.txt ./
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# 2) copy source
COPY . .

# Healthcheck simple sur /api/health (s'il existe, sinon /docs)
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
  CMD curl -fsS http://localhost:8001/api/health || curl -fsS http://localhost:8001/docs || exit 1

EXPOSE 8001
# Mode prod : uvicorn sans --reload, 2 workers (ajuster selon vCPU)
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8001", "--workers", "2", "--proxy-headers", "--forwarded-allow-ips", "*"]
