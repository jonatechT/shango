# SHANGO AI

API FastAPI de prédiction SOH (état de santé) et RUL (durée de vie restante)
pour les batteries LiFePO4, fournie par le développeur backend (commit
« Ajout du modèle IA SHANGO », 2026-09-22). Copiée depuis `SHANGO/ai/` avec
un correctif du `Dockerfile` (voir son en-tête) — le code Python lui-même
(`shango_api.py`) n'a pas été modifié.

## Contrat

`POST /predict` — déjà celui utilisé par `BatterieIAService.php` côté
backend, rien à changer de ce côté :

```json
// requête
{
  "device_id": "SH-001",
  "voltage_v": 12.7,
  "current_a": -3.2,
  "temperature_c": 31.0,
  "dod_percent": 45.0
}
```

`voltage_v` doit être entre **10.0 et 14.8 V** — calibré pour un pack LiFePO4
4 cellules (Alioth). Un autre type de kit avec un nombre de cellules
différent (le `.env.example` mentionne un « GMP » 8 cellules) serait rejeté
par cette validation ; pas retouché ici, à voir avec le développeur backend
si/quand ce cas se présente.

`GET /health` (utilisé comme `healthCheckPath` sur Render), `GET /info`,
`GET /features`, `GET /recommendations`, `POST /predict-batch` existent
aussi.

## Pas d'authentification

CORS ouvert à tous, aucune clé API vérifiée (câblé en dur dans le code,
malgré ce que documente `.env.example`). Cohérent avec `BatterieIAService.php`
qui n'en envoie pas non plus actuellement — à réévaluer si ce service est un
jour exposé à autre chose qu'au backend SHANGO.

## Déploiement

Render (`render.yaml` à la racine du dépôt, service `shango-ai`, Docker,
`healthCheckPath: /health`, plan gratuit — mêmes limites que `shango-api` :
veille après 15 min d'inactivité, quota d'heures partagé). Aucune variable
d'environnement requise : le script ne lit ni `MODELS_DIR`, ni `API_PORT`,
ni `CORS_ORIGINS` malgré `.env.example` — chemins et port sont gérés par le
`Dockerfile`.

Une fois déployé, coller son URL publique (`https://shango-ai.onrender.com`)
dans la variable `BATTERIE_IA_URL` du service `shango-api`.
