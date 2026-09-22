# Bridge SHANGO — hébergement 24/7 hors Render

Ce dossier contient uniquement le Bridge Python (`shango_bridge.py`) : le pont
MQTT (boîtier IoT) <-> HTTP (backend Laravel). Il est volontairement hébergé
**ailleurs que Render**, car il maintient une connexion permanente et ne doit
jamais s'endormir (contrairement au backend, une mise en veille ferait perdre
silencieusement toute la télémétrie reçue pendant ce temps) — et parce
qu'ajouter un deuxième service Render éveillé 24/24 dépasserait le quota
gratuit de 750h/mois du compte.

## Prérequis
- Une VM Linux qui tourne en continu (Oracle Cloud "Always Free" convient :
  authentiquement gratuit à vie, contrairement aux essais gratuits limités
  dans le temps d'autres fournisseurs). N'importe quelle petite VM Ubuntu/
  Debian fait l'affaire.
- Python 3.10+.
- Les mêmes clés que celles configurées sur le backend Render :
  `SHANGO_IOT_API_KEY` (à recopier ici sous `SHANGO_API_TOKEN`) et une
  nouvelle clé partagée `SHANGO_BRIDGE_API_KEY` (à définir des deux côtés).

## Installation sur la VM

```bash
sudo useradd -r -s /usr/sbin/nologin shango   # utilisateur dédié, sans shell
sudo mkdir -p /opt/shango-bridge
sudo chown $USER:$USER /opt/shango-bridge
# Copier shango_bridge.py, requirements.txt, .env (rempli depuis .env.example)
# dans /opt/shango-bridge/
cd /opt/shango-bridge
python3 -m venv venv
./venv/bin/pip install -r requirements.txt
sudo chown -R shango:shango /opt/shango-bridge
```

Puis installer le service systemd (voir les commandes en haut de
`shango-bridge.service`) pour qu'il redémarre seul au boot et après un crash.

## Ouvrir le port

Sur la VM (Oracle Cloud : "Security List" ou "Network Security Group" du
VCN, **en plus** du pare-feu système `iptables`/`ufw`/`firewalld`), ouvrir en
entrée le port choisi pour `SHANGO_BRIDGE_HTTP_PORT` (5000 par défaut) — mais
pas plus : le Bridge n'a besoin d'aucun autre port ouvert (la connexion MQTT
sortante ne nécessite aucune ouverture en entrée).

## Côté backend Laravel (Render)

Dans les variables d'environnement du service `shango-api` :
- `SHANGO_BRIDGE_URL` = `http://<ip-publique-de-la-vm>:5000`
- `SHANGO_BRIDGE_API_KEY` = même valeur que celle mise dans `.env` ici

## Vérifier que ça marche

```bash
curl http://<ip-publique-de-la-vm>:5000/health
# {"status":"up","mqtt_connecte":true,"mqtt_broker":"broker.emqx.io:1883"}
```

Configurer un pingeur externe gratuit (UptimeRobot, ou équivalent) sur cette
URL toutes les 5 minutes : la VM elle-même ne s'endort pas comme Render, mais
ça permet d'être alerté si le processus plante malgré `Restart=always`.

## Important : une seule instance à la fois

Si le Bridge tourne encore sur le PC local (`python shango_bridge.py`) en
même temps que sur la VM, les deux se battent pour le même
`SHANGO_BRIDGE_CLIENT_ID` MQTT (déconnexions en boucle) et chaque télémétrie
reçue par le boîtier est enregistrée deux fois côté Laravel. **Arrêtez le
Bridge local dès que celui de la VM est confirmé fonctionnel.**
