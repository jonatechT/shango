# Bridge SHANGO

Le pont MQTT (boîtier IoT) <-> HTTP (backend Laravel sur Render).

## Setup actuel : sur le PC de l'utilisateur

Décidé le 2026-09-22 : pas de carte bancaire disponible, ce qui exclut les
VM cloud "always free" habituelles (Oracle, Google, Azure en demandent une
pour vérifier l'identité, même sans rien facturer). Le Bridge tourne donc en
local, exposé via un tunnel Cloudflare gratuit.

### 1. Lancer le Bridge

```bash
cd bridge
pip install -r requirements.txt
cp .env.example .env   # puis remplir .env (clés, voir plus bas)
python shango_bridge.py
```

Il charge `.env` automatiquement (`python-dotenv`) — pas besoin de redéfinir
les variables à chaque lancement.

### 2. L'exposer sur Internet (pour `/commande`, optionnel)

Seule la réception de télémétrie/alertes/statut a besoin que le Bridge
appelle Render (sortant, aucune exposition nécessaire). **Exposer le Bridge
n'est utile que pour le blocage à distance d'un kit** (Laravel -> Bridge ->
MQTT), une fonctionnalité secondaire.

Sans domaine, seul le tunnel rapide Cloudflare (`*.trycloudflare.com`,
gratuit, sans compte) est possible — l'URL change à chaque redémarrage.
`tunnel_sync.py` automatise la mise à jour de cette URL sur Render :

```bash
python tunnel_sync.py
```

Nécessite dans `.env` : `RENDER_API_KEY` (Account Settings -> API Keys sur
render.com — **donne accès à tout le compte Render, à garder secrète**),
`RENDER_SERVICE_ID` et `CLOUDFLARED_PATH`. Voir les commentaires de
`.env.example`.

⚠️ Chaque redémarrage du tunnel redéploie tout le backend sur Render (~30 s
de coupure de toute l'application, pas seulement du Bridge) — c'est le prix
pour ne pas avoir à recopier l'URL à la main. Ne lancez ce script que quand
c'est nécessaire.

### Une seule instance à la fois

Ne faites jamais tourner deux Bridges en même temps (ex. PC + ailleurs) :
même `SHANGO_BRIDGE_CLIENT_ID` MQTT = déconnexions en boucle côté broker, et
chaque télémétrie serait enregistrée deux fois côté Laravel.

## Alternative future : une VM dédiée 24/7

Si le Bridge doit un jour survivre à l'extinction du PC (le boîtier IoT
maintient une connexion permanente : si le Bridge est éteint, tout ce que le
boîtier envoie pendant ce temps est perdu, sans rattrapage), la bonne
solution reste une petite VM Linux toujours allumée plutôt que Render (un
service gratuit Render s'endort après 15 min sans requête HTTP, ce qui tue
justement cette connexion permanente). Oracle Cloud "Always Free" est
recommandé (gratuit sans limite de temps) mais demande une carte bancaire
pour la vérification d'identité — à reconsidérer si cette contrainte change.
`requirements.txt` et `shango-bridge.service` (service systemd, redémarrage
automatique) dans ce dossier sont déjà prêts pour ce scénario.
