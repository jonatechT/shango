# Déployer SHANGO sur AWS

Remplace l'hébergement Render (dont la base gratuite expirait tous les 30 jours).
Tout le backend tourne sur **une instance EC2** avec Docker Compose, et **CloudFront**
fournit l'adresse HTTPS que le frontend (GitHub Pages) appelle.

```
Frontend Angular (GitHub Pages, HTTPS)
        │  https://dxxxx.cloudfront.net/api/...
        ▼
   CloudFront (HTTPS, pas de cache)
        │  http://<IP élastique>:80
        ▼
   EC2 Ubuntu 24.04 ── Docker Compose ──┬── api : Laravel (Apache :80)
                                        ├── ai  : FastAPI SOH/RUL (:8000 interne)
                                        └── db  : PostgreSQL 16 (volume persistant)
   Bridge IoT (shango_bridge.py) ──► POST https://dxxxx.cloudfront.net/api/telemetrie (X-API-Key)
```

Fichiers de ce dossier :

| Fichier | Rôle |
|---|---|
| `docker-compose.yml` | Les trois services, réseau interne, volumes `pgdata` et `storage_app` |
| `.env.example` | Modèle des variables de production (le vrai `.env` est généré sur l'instance, jamais commité) |
| `ec2-user-data.sh` | Script collé dans « User data » au lancement : installe Docker, génère les secrets, démarre tout |
| `update.sh` | Mise à jour : `git pull`, rebuild, redémarrage (migrations automatiques) |
| `backup-db.sh` | Sauvegarde quotidienne `pg_dump` compressée, 7 jours conservés |

## Coût estimé

Pas d'expiration, mais AWS facture à l'usage. Ordre de grandeur mensuel (région Paris ou Stockholm) :

| Ressource | Coût |
|---|---|
| EC2 t3.small (2 Go RAM, recommandé) | ≈ 15 à 17 $ |
| EC2 t3.micro (1 Go RAM, éligible offre gratuite 12 mois sur les anciens comptes) | ≈ 8 $ hors offre gratuite |
| Disque EBS 20 Go gp3 | ≈ 2 $ |
| IP élastique attachée à une instance allumée | 0 $ |
| CloudFront (trafic API faible) | ≈ 0 $, 1 To/mois inclus dans l'offre gratuite |

Le service IA (XGBoost + scikit-learn) et PostgreSQL cohabitent mal dans 1 Go : le script
ajoute 2 Go de swap, mais **t3.small est le choix sûr**.

## Étape 1 — Lancer l'instance EC2

1. Console AWS → choisir la région en haut à droite. **Paris (eu-west-3)** est la plus
   proche du Bénin ; Stockholm (eu-north-1) convient aussi et coûte un peu moins.
2. Service **EC2** → **Lancer une instance**.
3. Nom : `shango-api`.
4. Image : **Ubuntu Server 24.04 LTS**, architecture **64 bits (x86)**.
5. Type d'instance : **t3.small** (ou t3.micro, voir plus haut).
6. Paire de clés : **Créer une nouvelle paire de clés** → nom `shango-key`, type RSA,
   format `.pem` → le fichier se télécharge. Le garder précieusement, il ne sera plus proposé.
7. Paramètres réseau → **Modifier** :
   - Créer un groupe de sécurité nommé `shango-api-sg`.
   - Règle 1 : **SSH**, TCP 22, source **Mon IP**.
   - Règle 2 : **HTTP**, TCP 80, source **Partout (0.0.0.0/0)** (CloudFront doit joindre l'instance).
   - Pas de règle HTTPS : le TLS est terminé par CloudFront.
8. Stockage : **20 Gio**, type **gp3**.
9. **Détails avancés** → tout en bas, champ **Données utilisateur** : coller le contenu
   complet de `ec2-user-data.sh` après avoir rempli, en tête du script :
   - `SUPERADMIN_EMAIL` : **doit se terminer par `.com`** (règle du formulaire de login).
   - `SUPERADMIN_PASSWORD` : laisser vide pour un mot de passe aléatoire (relu à l'étape 3).
10. **Lancer l'instance**.

Le script travaille 8 à 15 minutes (installation Docker + construction des images).

## Étape 2 — IP élastique (adresse stable)

Sans elle, l'IP change à chaque arrêt/redémarrage et CloudFront perd l'origine.

1. EC2 → **Adresses IP élastiques** → **Allouer une adresse IP élastique** → Allouer.
2. Sélectionner l'adresse → **Actions → Associer** → instance `shango-api` → Associer.
3. Noter le **nom DNS public** de l'instance (EC2 → Instances → `shango-api` → onglet Détails →
   « DNS IPv4 public »), de la forme `ec2-13-xx-xx-xx.eu-west-3.compute.amazonaws.com`.
   CloudFront exige ce nom DNS, pas l'IP brute.

## Étape 3 — Vérifier l'instance et lire les secrets

Depuis la console : EC2 → Instances → `shango-api` → **Connecter** → onglet
**EC2 Instance Connect** → Connecter (terminal dans le navigateur, sans clé). Puis :

```bash
# Suivre l'initialisation jusqu'à « SHANGO init : terminé »
sudo tail -f /var/log/shango-init.log

# État des trois conteneurs (api doit être "healthy" après ~2 min)
cd /opt/shango/src/deploy/aws && sudo docker compose ps

# Secrets générés : mot de passe superadmin, SHANGO_IOT_API_KEY pour le bridge
sudo cat /opt/shango/SECRETS.env
```

Test depuis votre poste : `http://<IP élastique>/up` doit répondre 200.

## Étape 4 — CloudFront (HTTPS)

1. Service **CloudFront** → **Créer une distribution**.
2. **Domaine d'origine** : coller le nom DNS public de l'étape 2 (pas une entrée de la liste S3).
3. **Protocole** : **HTTP uniquement**, port 80.
4. Comportement par défaut :
   - Politique de protocole de visualisation : **Redirect HTTP to HTTPS**.
   - Méthodes HTTP autorisées : **GET, HEAD, OPTIONS, PUT, POST, PATCH, DELETE**.
   - Politique de cache : **CachingDisabled**.
   - Politique de demande d'origine : **AllViewer** (transmet `Authorization`, `X-API-Key`, etc.).
   - Politique d'en-têtes de réponse : aucune (Laravel gère déjà CORS).
5. **WAF** : ne pas activer (payant).
6. Classe de prix : « Amérique du Nord et Europe uniquement » suffit et coûte moins.
7. Créer. Le déploiement prend 5 à 10 minutes. Noter le **nom de domaine de la distribution** :
   `dxxxxxxxxxxxx.cloudfront.net`.

Si la console affiche le nouvel assistant (« Commencer »), choisir un type d'origine
**Autre** et retrouver les mêmes réglages ; les valeurs ci-dessus sont celles qui comptent.

## Étape 5 — Renseigner l'URL publique dans l'API

Dans le terminal de l'instance :

```bash
cd /opt/shango/src/deploy/aws
sudo sed -i 's|^APP_URL=.*|APP_URL=https://dxxxxxxxxxxxx.cloudfront.net|' .env
sudo docker compose up -d        # redémarre api avec la nouvelle config
```

Vérifier : `https://dxxxxxxxxxxxx.cloudfront.net/up` → 200, et

```bash
curl -s -X POST https://dxxxxxxxxxxxx.cloudfront.net/api/login \
  -H "Content-Type: application/json" -H "Accept: application/json" \
  -d '{"email":"<SUPERADMIN_EMAIL>","password":"<SUPERADMIN_PASSWORD>"}'
```

doit renvoyer `{"user":…,"token":"…"}`.

## Étape 6 — Brancher le frontend et le bridge

1. `src/environments/environment.ts` : `apiUrl: 'https://dxxxxxxxxxxxx.cloudfront.net/api'`,
   commit + push sur `main` → GitHub Pages se redéploie (2 à 3 minutes).
2. Bridge IoT (`shango_bridge.py`) : pointer l'URL de l'API vers CloudFront et renseigner
   `SHANGO_IOT_API_KEY` avec la valeur de `/opt/shango/SECRETS.env`.
3. Se connecter sur https://jonatecht.github.io/shango/ avec le superadmin, créer
   l'organisation puis l'équipement **SH-001** (identifiant du boîtier dans `config.h`).


## Nom de domaine (en place depuis le 16 novembre 2026)

- `shango-solar.com` est enregistré chez Route 53 Domains (renouvellement automatique, 16 $/an),
  zone hébergée `Z01438281FIGXK3MUOWIW`.
- Certificat ACM `*.shango-solar.com` + `shango-solar.com` (us-east-1, validation DNS), attaché à la
  distribution CloudFront `EFYNABFR6PSMK` avec l'alias **api.shango-solar.com**.
- L'API publique est donc **https://api.shango-solar.com** ; l'ancienne adresse
  `d2kl9a9hqtmf5q.cloudfront.net` reste valable (même distribution).
- Pour servir aussi le frontend sous ce domaine (ex. `app.shango-solar.com`), ajouter un CNAME vers
  `jonatecht.github.io` et déclarer le domaine personnalisé dans les réglages GitHub Pages du dépôt.

## Exploitation

```bash
# Mettre à jour après un push sur main
sudo /opt/shango/src/deploy/aws/update.sh

# Logs
cd /opt/shango/src/deploy/aws
sudo docker compose logs -f api      # Laravel (migrations, erreurs)
sudo docker compose logs -f ai       # FastAPI

# Sauvegarde manuelle / liste
sudo /opt/shango/src/deploy/aws/backup-db.sh
ls -lh /opt/shango/backups

# Réinitialiser le mot de passe superadmin : SUPERADMIN_RESET_PASSWORD=true dans .env,
# docker compose up -d, puis remettre false.
```

Les données vivent dans les volumes Docker `shango_pgdata` (base) et `shango_storage_app`
(photos) sur le disque EBS : elles survivent aux `update.sh` et aux redémarrages. Elles
disparaissent seulement si l'instance est **résiliée** ; penser à copier
`/opt/shango/backups` ailleurs (S3) avant une telle opération.

## Durcissement conseillé (après mise en service)

- Groupe de sécurité : remplacer la source `0.0.0.0/0` du port 80 par la liste de préfixes
  gérée `com.amazonaws.global.cloudfront.origin-facing` pour que seul CloudFront atteigne l'instance.
- Activer une **alarme de facturation** (Billing → Budgets) à 20 $/mois.
- Une fois AWS validé : suspendre puis supprimer les services Render (`shango-api`, `shango-ai`,
  `SHANGO-1`) et la base `shango-bd` pour ne rien laisser traîner.
