# ╔════════════════════════════════════════════════════════════════════════╗
# ║                 DOCKERFILE - SHANGO AI API                             ║
# ║                                                                        ║
# ║  Containerise l'API FastAPI pour un déploiement facile                ║
# ╚════════════════════════════════════════════════════════════════════════╝
#
# Corrigé pour Render le 2026-09-22 (fichier original du dépôt backend) :
#   - `COPY models/ ./models/` référençait un dossier qui n'existe pas — les
#     .pkl sont à la racine de ce dossier, à côté de shango_api.py, ce que le
#     code lui-même attend (MODELS_DIR = BASE_DIR dans shango_api.py). Tel
#     quel, ce Dockerfile ne construisait pas.
#   - Port figé à 8000 partout (CMD, healthcheck) — Render fournit le port
#     d'écoute via $PORT, pas forcément 8000.
#   - libgomp1 manquant dans l'image runtime : XGBoost en a besoin au
#     chargement (sinon "libgomp.so.1: cannot open shared object file").
#   - shango_api.py affiche des emojis au démarrage (✅, 📊...) : sans forcer
#     l'UTF-8, un environnement avec une locale par défaut restrictive plante
#     au chargement du module (UnicodeEncodeError), avant même de démarrer.
#   - Python 3.10 -> 3.11 : scikit-learn==1.9.0 (nécessaire pour relire
#     shango_scaler.pkl, voir requirements.txt) exige Python >= 3.11 ; avec
#     3.10, le build échouait dès l'installation ("No matching distribution
#     found for scikit-learn==1.9.0").

# Stage 1: Builder (construire l'image)
FROM python:3.11-slim as builder

WORKDIR /app

# Installer les dépendances système nécessaires
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

# Copier requirements et installer pip packages
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


# Stage 2: Runtime (image finale minimale)
FROM python:3.11-slim

WORKDIR /app

ENV PYTHONIOENCODING=utf-8 PYTHONUNBUFFERED=1

# ca-certificates : appels HTTPS sortants. libgomp1 : requis par XGBoost.
RUN apt-get update && apt-get install -y --no-install-recommends \
    ca-certificates \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copier les packages pip du builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Copier l'application et les modèles (fichiers à plat, pas de sous-dossier).
COPY shango_api.py .
COPY shango_soh_model.pkl shango_rul_model.pkl shango_scaler.pkl shango_label_mapping.json ./

# Créer un utilisateur non-root pour la sécurité
RUN useradd -m -u 1000 appuser && chown -R appuser:appuser /app
USER appuser

# Port exposé (documentatif ; le port réel d'écoute vient de $PORT au démarrage).
EXPOSE 8000

# Health check — utilise $PORT, avec 8000 en repli pour un lancement local.
HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD python -c "import os,requests; requests.get(f'http://localhost:{os.environ.get(\"PORT\",\"8000\")}/health')" || exit 1

# Lancer l'API sur le port fourni par Render ($PORT), 8000 par défaut sinon.
CMD uvicorn shango_api:app --host 0.0.0.0 --port ${PORT:-8000}
