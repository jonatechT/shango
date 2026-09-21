#!/bin/sh
set -e

cd /var/www/html

# Render fournit $PORT (10000 par défaut) : Apache doit écouter dessus.
PORT="${PORT:-10000}"
sed -ri "s/Listen 80/Listen ${PORT}/" /etc/apache2/ports.conf
sed -ri "s/<VirtualHost \*:80>/<VirtualHost *:${PORT}>/" /etc/apache2/sites-available/000-default.conf

# Les secrets collés dans le dashboard Render arrivent parfois avec un espace/retour ligne parasite.
for var in APP_KEY SHANGO_IOT_API_KEY SHANGO_BRIDGE_API_KEY; do
    eval "value=\${$var}"
    if [ -n "$value" ]; then
        export "$var=$(printf '%s' "$value" | tr -d '[:space:]')"
    fi
done

# Clé sans préfixe "base64:" (44 caractères = 32 octets encodés) : on le rétablit.
case "$APP_KEY" in
    base64:*) ;;
    *) if [ "${#APP_KEY}" -eq 44 ]; then export APP_KEY="base64:$APP_KEY"; fi ;;
esac

if [ -z "$APP_KEY" ]; then
    echo "ERREUR: APP_KEY absente. Générez-la avec 'php artisan key:generate --show' et ajoutez-la aux variables d'environnement Render." >&2
    exit 1
fi

# Un échec de migration doit stopper le déploiement (pas de base à moitié migrée qui répond quand même).
php artisan migrate --force

# Le disque de Render est éphémère : le lien public/storage disparaît à chaque déploiement.
php artisan storage:link --force

# Premier compte superadmin (le plan gratuit n'a pas de shell). Sans effet s'il existe déjà.
if [ -n "$SUPERADMIN_EMAIL" ] && [ -n "$SUPERADMIN_PASSWORD" ]; then
    # SUPERADMIN_RESET_PASSWORD=true : réécrit le mot de passe d'un compte existant (à retirer ensuite).
    if [ "$SUPERADMIN_RESET_PASSWORD" = "true" ]; then
        php artisan shango:ensure-superadmin "$SUPERADMIN_EMAIL" "$SUPERADMIN_PASSWORD" --reset
    else
        php artisan shango:ensure-superadmin "$SUPERADMIN_EMAIL" "$SUPERADMIN_PASSWORD"
    fi
fi

php artisan config:cache

exec "$@"
