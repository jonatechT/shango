#!/bin/bash
# Sauvegarde PostgreSQL compressée dans /opt/shango/backups, conservation 7 jours.
# Restauration : gunzip -c fichier.sql.gz | docker compose exec -T db psql -U shango_user -d shango
set -euo pipefail
cd /opt/shango/src/deploy/aws
set -a; . ./.env; set +a
mkdir -p /opt/shango/backups
FILE="/opt/shango/backups/shango-$(date +%F-%H%M).sql.gz"
docker compose exec -T db pg_dump -U "${DB_USERNAME:-shango_user}" "${DB_DATABASE:-shango}" | gzip > "$FILE"
find /opt/shango/backups -name 'shango-*.sql.gz' -mtime +7 -delete
echo "[$(date -Is)] sauvegarde OK : $FILE ($(du -h "$FILE" | cut -f1))"
