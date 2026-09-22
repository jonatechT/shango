#!/usr/bin/env python3
"""
Lance un tunnel Cloudflare rapide (gratuit, sans compte ni domaine) vers le
port local du Bridge, et pousse automatiquement la nouvelle URL publique sur
Render dès qu'elle est connue.

À chaque lancement, cloudflared génère une URL *.trycloudflare.com
différente (limite du tunnel rapide sans domaine propre) : ce script fait ce
qu'on ferait à la main (copier l'URL, la coller dans les variables
d'environnement Render, redéployer) pour éviter de le refaire à chaque fois.

⚠️ Chaque mise à jour redéploie tout le service backend sur Render (~30 s de
coupure de TOUTE l'application, pas seulement du Bridge) — c'est le prix de
l'automatisation. Ne relancez ce script que quand c'est nécessaire (ex. après
un redémarrage du PC), pas en boucle.

Variables nécessaires (voir .env.example) :
    RENDER_API_KEY      Clé API Render (Account Settings -> API Keys).
                         Donne accès à TOUT le compte Render : à garder aussi
                         secrète qu'un mot de passe, jamais commitée.
    RENDER_SERVICE_ID   Id du service backend (ex. srv-xxxxxxxxxxxxxxxxxxxx),
                         visible dans l'URL du service sur le dashboard Render.
    CLOUDFLARED_PATH    Chemin vers cloudflared.exe.
    SHANGO_BRIDGE_HTTP_PORT  Port local du Bridge (5000 par défaut).

Lancement (le Bridge doit déjà tourner à côté, dans un autre terminal) :
    python tunnel_sync.py
"""

import os
import re
import subprocess
import sys

import requests
from dotenv import load_dotenv

load_dotenv()

RENDER_API_KEY = os.getenv("RENDER_API_KEY", "")
RENDER_SERVICE_ID = os.getenv("RENDER_SERVICE_ID", "")
CLOUDFLARED_PATH = os.getenv("CLOUDFLARED_PATH", "cloudflared")
BRIDGE_PORT = os.getenv("SHANGO_BRIDGE_HTTP_PORT", "5000")

RENDER_API_BASE = "https://api.render.com/v1"

URL_RE = re.compile(r"https://[a-z0-9-]+\.trycloudflare\.com")


def verifier_configuration() -> None:
    manquantes = [
        nom for nom, val in (
            ("RENDER_API_KEY", RENDER_API_KEY),
            ("RENDER_SERVICE_ID", RENDER_SERVICE_ID),
        )
        if not val
    ]
    if manquantes:
        print(
            "Variables manquantes dans bridge/.env : " + ", ".join(manquantes),
            file=sys.stderr,
        )
        sys.exit(1)


def pousser_url_sur_render(url: str) -> None:
    headers = {
        "Authorization": f"Bearer {RENDER_API_KEY}",
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    print(f"[Render] Mise à jour de SHANGO_BRIDGE_URL -> {url}")

    r = requests.put(
        f"{RENDER_API_BASE}/services/{RENDER_SERVICE_ID}/env-vars/SHANGO_BRIDGE_URL",
        headers=headers,
        json={"value": url},
        timeout=20,
    )
    if not r.ok:
        print(
            f"[Render] Échec mise à jour variable : {r.status_code} {r.text}",
            file=sys.stderr,
        )
        return

    print("[Render] Variable mise à jour, déclenchement du redéploiement...")

    r = requests.post(
        f"{RENDER_API_BASE}/services/{RENDER_SERVICE_ID}/deploys",
        headers=headers,
        json={"deployMode": "deploy_only"},
        timeout=20,
    )
    if not r.ok:
        print(
            f"[Render] Échec déclenchement déploiement : {r.status_code} {r.text}",
            file=sys.stderr,
        )
        return

    print(
        "[Render] Redéploiement déclenché. Le backend sera brièvement "
        "indisponible (~30 s) le temps qu'il redémarre."
    )


def main() -> None:
    verifier_configuration()

    cmd = [CLOUDFLARED_PATH, "tunnel", "--url", f"http://localhost:{BRIDGE_PORT}"]
    print(f"Lancement : {' '.join(cmd)}")

    proc = subprocess.Popen(
        cmd,
        stdout=subprocess.PIPE,
        stderr=subprocess.STDOUT,
        text=True,
        bufsize=1,
    )

    url_trouvee = False

    for ligne in proc.stdout:
        print(ligne, end="")
        if not url_trouvee:
            m = URL_RE.search(ligne)
            if m:
                url_trouvee = True
                pousser_url_sur_render(m.group(0))

    proc.wait()
    print(f"cloudflared s'est arrêté (code {proc.returncode}).")


if __name__ == "__main__":
    main()
