#!/bin/bash
# Sauvegarde PostgreSQL compressée dans /opt/shango/backups (7 jours conservés),
# puis copie vers S3 si BACKUP_S3_BUCKET est défini dans .env (rétention gérée par
# le cycle de vie du bucket). L'instance s'authentifie via son rôle IAM.
# Restauration : gunzip -c fichier.sql.gz | docker compose exec -T db psql -U shango_user -d shango
set -euo pipefail
cd /opt/shango/src/deploy/aws
set -a; . ./.env; set +a
mkdir -p /opt/shango/backups
FILE="/opt/shango/backups/shango-$(date +%F-%H%M).sql.gz"
docker compose exec -T db pg_dump -U "${DB_USERNAME:-shango_user}" "${DB_DATABASE:-shango}" | gzip > "$FILE"
gzip -t "$FILE"
find /opt/shango/backups -name 'shango-*.sql.gz' -mtime +7 -delete
echo "[$(date -Is)] sauvegarde locale OK : $FILE ($(du -h "$FILE" | cut -f1))"
if [ -n "${BACKUP_S3_BUCKET:-}" ]; then
  aws s3 cp "$FILE" "s3://${BACKUP_S3_BUCKET}/postgres/$(basename "$FILE")" --only-show-errors
  echo "[$(date -Is)] copie S3 OK : s3://${BACKUP_S3_BUCKET}/postgres/$(basename "$FILE")"
fi
