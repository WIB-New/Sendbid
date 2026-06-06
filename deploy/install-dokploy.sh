#!/usr/bin/env bash
# install-dokploy.sh — Script clé-en-main pour préparer un VPS Debian 13 et installer Dokploy.
#
# Usage (en SSH root sur votre VPS) :
#   curl -fsSL https://raw.githubusercontent.com/<VOTRE_USER>/<VOTRE_REPO>/main/deploy/install-dokploy.sh | bash
# OU si le code n'est pas encore sur GitHub :
#   1. scp deploy/install-dokploy.sh root@195.110.35.155:/root/
#   2. ssh root@195.110.35.155 'chmod +x /root/install-dokploy.sh && /root/install-dokploy.sh'
#
# Ce script :
#  - met à jour Debian 13
#  - installe Docker + Docker Compose
#  - configure UFW (ports 22, 80, 443, 3000)
#  - installe Dokploy via l'installeur officiel
#  - affiche les URLs et les prochaines étapes

set -euo pipefail

# ────────────── Couleurs pour le log ──────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'
log()   { echo -e "${GREEN}[$(date +%H:%M:%S)]${NC} $*"; }
warn()  { echo -e "${YELLOW}[$(date +%H:%M:%S)] ⚠${NC} $*"; }
error() { echo -e "${RED}[$(date +%H:%M:%S)] ✗${NC} $*" >&2; exit 1; }

# ────────────── Pré-checks ──────────────
[[ $EUID -eq 0 ]] || error "Ce script doit être lancé en root (ou avec sudo)."
apt-get update -qq && apt-get install -y -qq lsb-release ca-certificates curl gnupg
OS_ID=$(lsb_release -is 2>/dev/null || echo unknown)
OS_VER=$(lsb_release -rs 2>/dev/null || echo "?")
log "OS détecté : $OS_ID $OS_VER"

# ────────────── 1. Mise à jour système ──────────────
log "📦 1/6 — Mise à jour des paquets système…"
export DEBIAN_FRONTEND=noninteractive
apt-get upgrade -y -qq
apt-get install -y -qq curl wget git ufw jq

# ────────────── 2. Firewall UFW ──────────────
log "🔥 2/6 — Configuration du firewall UFW (SSH/HTTP/HTTPS/3000)…"
ufw --force reset >/dev/null
ufw default deny incoming >/dev/null
ufw default allow outgoing >/dev/null
ufw allow 22/tcp comment 'SSH' >/dev/null
ufw allow 80/tcp comment 'HTTP (Lets Encrypt + redirect)' >/dev/null
ufw allow 443/tcp comment 'HTTPS' >/dev/null
ufw allow 3000/tcp comment 'Dokploy UI (initial setup)' >/dev/null
ufw --force enable >/dev/null
log "✓ Firewall actif : 22 / 80 / 443 / 3000 autorisés"

# ────────────── 3. Docker + Docker Compose ──────────────
if ! command -v docker >/dev/null 2>&1; then
  log "🐳 3/6 — Installation de Docker Engine…"
  install -m 0755 -d /etc/apt/keyrings
  curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
  chmod a+r /etc/apt/keyrings/docker.gpg
  CODENAME=$(lsb_release -cs)
  # Debian 13 (trixie) — Docker peut ne pas encore avoir un canal stable dédié.
  # On utilise le canal "bookworm" qui est compatible binaire pour Debian 13.
  if [[ "$CODENAME" == "trixie" ]]; then
    warn "Debian 13 (trixie) détecté → utilisation du canal Docker 'bookworm' (compat binaire)."
    CODENAME="bookworm"
  fi
  echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian ${CODENAME} stable" \
    > /etc/apt/sources.list.d/docker.list
  apt-get update -qq
  apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
  systemctl enable docker --now
  log "✓ Docker installé : $(docker --version)"
else
  log "✓ Docker déjà présent : $(docker --version)"
fi

# ────────────── 4. Installation Dokploy ──────────────
if docker ps -a --format '{{.Names}}' | grep -q "^dokploy$"; then
  warn "Conteneur 'dokploy' déjà présent. Skip installation."
else
  log "🚀 4/6 — Installation de Dokploy (installeur officiel)…"
  # L'installeur Dokploy fait tout : crée le swarm, le network dokploy-network, le conteneur dokploy
  curl -sSL https://dokploy.com/install.sh | sh
fi

# ────────────── 5. Vérification ──────────────
log "🔍 5/6 — Vérification du conteneur Dokploy…"
sleep 15
if docker ps --format '{{.Names}}' | grep -q dokploy; then
  log "✓ Dokploy conteneur actif"
else
  warn "Dokploy n'apparaît pas encore dans 'docker ps'. Patientez 30-60s, puis relancez 'docker ps'."
fi

# ────────────── 6. Récap ──────────────
IP_PUB=$(curl -s -4 https://ifconfig.me 2>/dev/null || hostname -I | awk '{print $1}')
echo
echo "╔══════════════════════════════════════════════════════════════════════╗"
echo "║                    ✅ INSTALLATION TERMINÉE                           ║"
echo "╠══════════════════════════════════════════════════════════════════════╣"
echo "║                                                                        ║"
echo "║  🌍 Dokploy UI   : http://${IP_PUB}:3000"
echo "║                                                                        ║"
echo "║  ⏭  PROCHAINES ÉTAPES :                                                ║"
echo "║                                                                        ║"
echo "║  1) Vérifiez vos DNS (5 entrées A → ${IP_PUB}) :"
echo "║       dokploy.sendfloo.sendbid.app                                     ║"
echo "║       app.sendfloo.sendbid.app                                         ║"
echo "║       agent.sendfloo.sendbid.app                                       ║"
echo "║       api.sendfloo.sendbid.app                                         ║"
echo "║                                                                        ║"
echo "║  2) Ouvrez http://${IP_PUB}:3000 dans le navigateur et :"
echo "║     - Créez le compte admin Dokploy                                    ║"
echo "║     - Settings → Server → Domain : dokploy.sendfloo.sendbid.app        ║"
echo "║     - Activez Let's Encrypt                                            ║"
echo "║                                                                        ║"
echo "║  3) Settings → Git → GitHub → connectez votre dépôt                    ║"
echo "║                                                                        ║"
echo "║  4) Créez le projet 'sendbid' → Type 'Docker Compose'                  ║"
echo "║     - Branch : main                                                    ║"
echo "║     - Compose path : docker-compose.yml                                ║"
echo "║     - Renseignez les env vars (voir .env.production.example)           ║"
echo "║     - Ajoutez les 3 domaines (app/agent/api)                           ║"
echo "║     - Deploy !                                                         ║"
echo "║                                                                        ║"
echo "║  Documentation complète : deploy/DEPLOY-DOKPLOY.md                     ║"
echo "║                                                                        ║"
echo "╚══════════════════════════════════════════════════════════════════════╝"
echo
