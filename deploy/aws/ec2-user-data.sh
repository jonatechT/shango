#!/bin/bash
# =============================================================================
# SHANGO — script d'initialisation EC2 (champ "User data" au lancement).
# Testé pour Ubuntu Server 24.04 LTS (x86_64). Il :
#   1. installe Docker + Docker Compose,
#   2. ajoute 2 Go de swap (indispensable sur les petites instances),
#   3. clone le dépôt et génère deploy/aws/.env avec des secrets aléatoires,
#   4. construit et démarre api + ai + db,
#   5. installe une sauvegarde quotidienne de la base.
# Durée : 8 à 15 minutes selon l'instance. Suivi : tail -f /var/log/cloud-init-output.log
# Les secrets générés sont relus dans /opt/shango/SECRETS.env (root uniquement).
# =============================================================================
set -euo pipefail

# ----------------------------- À PERSONNALISER --------------------------------
REPO_URL="https://github.com/jonatechT/shango.git"
BRANCH="main"
SUPERADMIN_EMAIL="admin@shango.com"      # doit se terminer par .com (règle du formulaire de login)
SUPERADMIN_PASSWORD=""                   # vide = mot de passe aléatoire, lisible dans SECRETS.env
APP_URL="http://A-REMPLACER"             # URL CloudFront, à mettre à jour après sa création (voir README)
# ------------------------------------------------------------------------------

export DEBIAN_FRONTEND=noninteractive
exec > >(tee -a /var/log/shango-init.log) 2>&1
echo "=== [$(date -Is)] SHANGO init : début"

# 1. Docker (dépôt officiel)
apt-get update -y
apt-get install -y ca-certificates curl git gnupg openssl
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
chmod a+r /etc/apt/keyrings/docker.asc
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -y
apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
systemctl enable --now docker
usermod -aG docker ubuntu || true

# 2. Swap 2 Go
if ! swapon --show | grep -q '/swapfile'; then
  fallocate -l 2G /swapfile
  chmod 600 /swapfile
  mkswap /swapfile
  swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi

# 3. Code + secrets
mkdir -p /opt/shango/backups
if [ ! -d /opt/shango/src/.git ]; then
  git clone --depth 1 --branch "$BRANCH" "$REPO_URL" /opt/shango/src
fi
cd /opt/shango/src/deploy/aws

if [ ! -f .env ]; then
  APP_KEY="base64:$(openssl rand -base64 32)"
  DB_PASSWORD="$(openssl rand -hex 24)"
  SHANGO_IOT_API_KEY="$(openssl rand -hex 24)"
  [ -n "$SUPERADMIN_PASSWORD" ] || SUPERADMIN_PASSWORD="$(openssl rand -base64 18 | tr -d '/+=' | cut -c1-16)"

  cat > .env <<EOF
APP_NAME=SHANGO
APP_ENV=production
APP_DEBUG=false
APP_KEY=${APP_KEY}
APP_URL=${APP_URL}

DB_DATABASE=shango
DB_USERNAME=shango_user
DB_PASSWORD=${DB_PASSWORD}

SUPERADMIN_EMAIL=${SUPERADMIN_EMAIL}
SUPERADMIN_PASSWORD=${SUPERADMIN_PASSWORD}
SUPERADMIN_RESET_PASSWORD=false

SHANGO_IOT_API_KEY=${SHANGO_IOT_API_KEY}

SHANGO_BRIDGE_URL=
SHANGO_BRIDGE_API_KEY=
EOF
  chmod 600 .env
  cp .env /opt/shango/SECRETS.env
  chmod 600 /opt/shango/SECRETS.env
fi

# 4. Build + démarrage
docker compose up -d --build

# 5. Sauvegarde quotidienne (03h15 UTC), 7 jours conservés dans /opt/shango/backups
chmod +x backup-db.sh update.sh
cat > /etc/cron.d/shango-backup <<'CRON'
15 3 * * * root /opt/shango/src/deploy/aws/backup-db.sh >> /var/log/shango-backup.log 2>&1
CRON

echo "=== [$(date -Is)] SHANGO init : terminé. Secrets dans /opt/shango/SECRETS.env"
echo "    Suivre le démarrage : docker compose -f /opt/shango/src/deploy/aws/docker-compose.yml logs -f api"
