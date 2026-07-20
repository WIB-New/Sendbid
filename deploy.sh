#!/bin/bash
# =================================================================
# Script de deploiement SendBID / PayBID sur VPS
# Usage : ./deploy.sh
# =================================================================

set -e

echo "=== Deploiement SendBID / PayBID ==="

# Verifier que .env existe
if [ ! -f .env ]; then
    echo "Erreur : fichier .env manquant. Copiez env-example.txt en .env et remplissez-le."
    exit 1
fi

# Charger les variables
export $(grep -v '^#' .env | xargs)

# Creer le reseau si necessaire
if ! docker network inspect dokploy-network >/dev/null 2>&1; then
    echo "Creation du reseau dokploy-network..."
    docker network create dokploy-network
fi

# Pull / Build / Up
echo "Build et demarrage des conteneurs..."
docker compose pull || true
docker compose up -d --build

# Healthcheck
echo "Attente du backend..."
sleep 10
if curl -f -s "${PUBLIC_BACKEND_URL}/api/health" >/dev/null; then
    echo "Backend OK : ${PUBLIC_BACKEND_URL}/api/health"
else
    echo "Attention : le backend ne repond pas encore. Verifiez les logs : docker compose logs -f backend"
fi

echo "=== Deploiement termine ==="
echo "Frontend web : https://${FRONTEND_HOST:-sendfloo.sendbid.app}"
echo "Backend API  : ${PUBLIC_BACKEND_URL:-https://api.sendbid.app}"
echo "Panel admin  : https://${ADMIN_HOST:-admin.sendbid.app}/api/web/admin"
