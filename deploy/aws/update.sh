#!/bin/bash
# Met à jour SHANGO sur l'instance : récupère le code, reconstruit, redémarre.
# Les migrations s'exécutent au démarrage du conteneur api (docker/entrypoint.sh).
set -euo pipefail
cd /opt/shango/src
git pull --ff-only
cd deploy/aws
docker compose up -d --build
docker image prune -f
docker compose ps
