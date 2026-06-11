# ── Stage 1 : builder ────────────────────────────────────────────────────────
FROM python:3.12-slim AS builder

WORKDIR /app

# Dépendances système nécessaires pour les wheels (grpcio, cffi, pillow…)
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    g++ \
    libffi-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --upgrade pip \
    && pip install --extra-index-url https://pypi.emergentmethods.ai/simple/ emergentintegrations==0.1.0 \
    && pip install --prefix=/install --no-cache-dir -r requirements.txt


# ── Stage 2 : runtime ────────────────────────────────────────────────────────
FROM python:3.12-slim

WORKDIR /app

# Copier les packages installés depuis le builder
COPY --from=builder /install /usr/local

# Copier le code source
COPY . .

# Créer le dossier memory utilisé par seed.py
RUN mkdir -p /app/memory

# Utilisateur non-root pour la sécurité
RUN useradd -m appuser && chown -R appuser:appuser /app
USER appuser

EXPOSE 8000

# Démarrage production : sans --reload, workers multiples
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "2"]