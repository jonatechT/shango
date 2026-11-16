# Bridge SHANGO

Le pont MQTT (boîtier IoT) <-> HTTP (API Laravel AWS exposée par CloudFront).

## Setup actuel : sur le PC de l'utilisateur

Le Bridge tourne en local. Il envoie la télémétrie vers l'API AWS via CloudFront.
Un tunnel Cloudflare n'est nécessaire que pour recevoir des commandes à distance.

### 1. Lancer le Bridge

```bash
cd bridge
pip install -r requirements.txt
cp .env.example .env   # puis renseigner SHANGO_API_TOKEN (clé AWS, voir plus bas)
python shango_bridge.py
```

Il charge `.env` automatiquement (`python-dotenv`) — pas besoin de redéfinir
les variables à chaque lancement.

Sous Windows, `start-bridge.bat` (double-clic) lance le Bridge dans une fenêtre et le
relance automatiquement s'il s'arrête. Pour qu'il démarre à chaque ouverture de session,
créer un raccourci vers ce fichier dans le dossier Démarrage (`Win+R` → `shell:startup`).

### 2. L'exposer sur Internet (pour `/commande`, optionnel)

Seule la réception de télémétrie/alertes/statut a besoin que le Bridge
appelle l'API AWS via CloudFront (sortant, aucune exposition nécessaire). **Exposer le Bridge
n'est utile que pour le blocage à distance d'un kit** (Laravel -> Bridge ->
MQTT), une fonctionnalité secondaire.

Sans domaine, seul le tunnel rapide Cloudflare (`*.trycloudflare.com`,
gratuit, sans compte) est possible — l'URL change à chaque redémarrage.
`tunnel_sync.py` ne configure que l'ancien déploiement Render; ne le lancez
pas pour ce déploiement AWS. Les variables `RENDER_API_KEY` et
`RENDER_SERVICE_ID` ne sont nécessaires qu'à cet ancien script. Pour AWS, les
commandes distantes doivent être configurées séparément sur l'instance; cette
étape n'est pas nécessaire pour envoyer la télémétrie.

### Clé API AWS

Sur l'instance EC2, la clé `SHANGO_IOT_API_KEY` est conservée dans
`/opt/shango/SECRETS.env` (lecture avec `sudo`). Copiez sa valeur dans
`SHANGO_API_TOKEN` du fichier `.env` local du Bridge. Ne partagez pas cette clé
et ne la commitez jamais.

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
