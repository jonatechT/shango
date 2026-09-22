#!/usr/bin/env python3
"""
SHANGO — Bridge MQTT <-> HTTP v2.4
Orange Summer Challenge 2026

Architecture :

1) MQTT -> HTTP
   ESP32
      ↓
   MQTT broker
      ↓
   Bridge
      ↓
   Laravel

   Topics écoutés :
       shango/+/telemetry -> POST /api/telemetrie
       shango/+/alert     -> POST /api/alertes
       shango/+/status    -> POST /api/status

2) HTTP -> MQTT
   Laravel
      ↓
   POST /commande du Bridge
      ↓
   MQTT
      ↓
   ESP32

Installation :
    pip install paho-mqtt requests flask

Lancement :
    python shango_bridge.py

Exposer le port Flask :
    ngrok http 5000
"""

import os
import json
import logging
import threading
import time
from datetime import datetime, timezone

import requests
import paho.mqtt.client as mqtt
from flask import Flask, request, jsonify
from dotenv import load_dotenv

# Charge .env s'il est présent à côté du script (pratique pour un lancement
# local répété) ; ne fait rien si le fichier n'existe pas — sans effet en
# production où les variables viennent de l'environnement du service.
load_dotenv()


# =====================================================
# CONFIGURATION
# =====================================================

MQTT_BROKER = os.getenv(
    "SHANGO_MQTT_BROKER",
    "broker.emqx.io"
)

MQTT_PORT = int(
    os.getenv(
        "SHANGO_MQTT_PORT",
        "1883"
    )
)

MQTT_CLIENT_ID = os.getenv(
    "SHANGO_BRIDGE_CLIENT_ID",
    "shango-bridge"
)


# =====================================================
# LARAVEL
# =====================================================

API_BASE_URL = os.getenv(
    "SHANGO_API_BASE_URL",
    "http://localhost:8000/api"
)

# IMPORTANT :
# Cette variable doit contenir la même clé que
# SHANGO_IOT_API_KEY dans le .env Laravel.
API_TOKEN = os.getenv(
    "SHANGO_API_TOKEN",
    ""
)


# =====================================================
# TOPICS MQTT
# =====================================================

TOPIC_TELEMETRY = "shango/+/telemetry"

TOPIC_ALERT = "shango/+/alert"

TOPIC_STATUS = "shango/+/status"

TOPIC_COMMAND_TEMPLATE = "shango/{id_appareil}/command"


# =====================================================
# ENDPOINTS LARAVEL
# =====================================================

ENDPOINT_MAP = {
    "telemetry": f"{API_BASE_URL}/telemetrie",
    "alert": f"{API_BASE_URL}/alertes",
    "status": f"{API_BASE_URL}/status",
}


# =====================================================
# PARAMÈTRES HTTP
# =====================================================

HTTP_TIMEOUT_S = 5

HTTP_MAX_RETRIES = 3

HTTP_RETRY_BACKOFF_S = 2


# =====================================================
# AUTHENTIFICATION DU BRIDGE
# =====================================================

# Cette clé protège l'endpoint :
# POST http://<bridge>:5000/commande
#
# Elle doit être configurée dans l'environnement
# sous SHANGO_BRIDGE_API_KEY.
BRIDGE_API_KEY = os.getenv(
    "SHANGO_BRIDGE_API_KEY",
    ""
)


# =====================================================
# SERVEUR FLASK
# =====================================================

FLASK_HOST = os.getenv(
    "SHANGO_BRIDGE_HTTP_HOST",
    "0.0.0.0"
)

FLASK_PORT = int(
    os.getenv(
        "SHANGO_BRIDGE_HTTP_PORT",
        "5000"
    )
)


# =====================================================
# LOGGING
# =====================================================

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)

log = logging.getLogger("shango-bridge")


# =====================================================
# HTTP FORWARDING : MQTT -> LARAVEL
# =====================================================

def forward_to_laravel(
    kind: str,
    payload: dict,
    id_appareil: str
):

    url = ENDPOINT_MAP.get(kind)

    if not url:
        log.warning(
            "Type de message inconnu '%s', ignoré",
            kind
        )
        return


    # =================================================
    # HEADERS
    # =================================================

    headers = {
        "Content-Type": "application/json",
        "Accept": "application/json",
    }

    # Le middleware Laravel shango.api
    # attend X-API-Key.
    if API_TOKEN:
        headers["X-API-Key"] = API_TOKEN


    # =================================================
    # ENVOI AVEC RETRIES
    # =================================================

    for attempt in range(
        1,
        HTTP_MAX_RETRIES + 1
    ):

        try:

            resp = requests.post(
                url,
                json=payload,
                headers=headers,
                timeout=HTTP_TIMEOUT_S
            )


            # =========================================
            # SUCCÈS
            # =========================================

            if resp.status_code in (200, 201):

                log.info(
                    "[%s] %s -> %s OK (HTTP %d)",
                    id_appareil,
                    kind,
                    url,
                    resp.status_code
                )

                return


            # =========================================
            # ERREUR HTTP
            # =========================================

            log.warning(
                "[%s] %s -> %s a répondu %d "
                "(tentative %d/%d)",
                id_appareil,
                kind,
                url,
                resp.status_code,
                attempt,
                HTTP_MAX_RETRIES
            )


            # Afficher la réponse Laravel
            # pour faciliter le diagnostic.
            try:

                response_data = resp.json()

                log.warning(
                    "[%s] Réponse Laravel : %s",
                    id_appareil,
                    response_data
                )

            except ValueError:

                log.warning(
                    "[%s] Réponse Laravel brute : %s",
                    id_appareil,
                    resp.text[:500]
                )


        except requests.exceptions.RequestException as e:

            log.warning(
                "[%s] %s -> %s échec réseau "
                "(tentative %d/%d) : %s",
                id_appareil,
                kind,
                url,
                attempt,
                HTTP_MAX_RETRIES,
                e
            )


        # =============================================
        # ATTENTE AVANT NOUVEL ESSAI
        # =============================================

        if attempt < HTTP_MAX_RETRIES:

            time.sleep(
                HTTP_RETRY_BACKOFF_S * attempt
            )


    # =================================================
    # ABANDON
    # =================================================

    log.error(
        "[%s] %s -> %s abandonné après %d tentatives",
        id_appareil,
        kind,
        url,
        HTTP_MAX_RETRIES
    )


# =====================================================
# PARSING TOPIC MQTT
# =====================================================

def parse_topic(topic: str):

    # Format attendu :
    #
    # shango/{id_appareil}/{kind}

    parts = topic.split("/")

    if (
        len(parts) != 3
        or parts[0] != "shango"
    ):
        return None, None

    return parts[1], parts[2]


# =====================================================
# CALLBACK MQTT : CONNEXION
# =====================================================

def on_connect(
    client,
    userdata,
    flags,
    reason_code,
    properties=None
):

    if reason_code == 0:

        log.info(
            "Connecté au broker %s:%s",
            MQTT_BROKER,
            MQTT_PORT
        )


        # =============================================
        # ABONNEMENTS
        # =============================================

        client.subscribe([
            (
                TOPIC_TELEMETRY,
                0
            ),
            (
                TOPIC_ALERT,
                0
            ),
            (
                TOPIC_STATUS,
                0
            ),
        ])


        log.info(
            "Abonné à : %s | %s | %s",
            TOPIC_TELEMETRY,
            TOPIC_ALERT,
            TOPIC_STATUS
        )

    else:

        log.error(
            "Échec de connexion au broker "
            "(code %s)",
            reason_code
        )


# =====================================================
# CALLBACK MQTT : DÉCONNEXION
# =====================================================

def on_disconnect(
    client,
    userdata,
    disconnect_flags,
    reason_code,
    properties=None
):

    log.warning(
        "Déconnecté du broker "
        "(code %s) — reconnexion automatique...",
        reason_code
    )


# =====================================================
# CALLBACK MQTT : MESSAGE
# =====================================================

def on_message(
    client,
    userdata,
    msg
):

    # ================================================
    # ANALYSE DU TOPIC
    # ================================================

    id_appareil, kind = parse_topic(
        msg.topic
    )

    if id_appareil is None:

        log.warning(
            "Topic inattendu ignoré : %s",
            msg.topic
        )

        return


    # ================================================
    # LECTURE DU PAYLOAD
    # ================================================

    raw = msg.payload.decode(
        "utf-8",
        errors="replace"
    ).strip()


    # ================================================
    # JSON
    # ================================================

    try:

        payload = json.loads(raw)

    except json.JSONDecodeError:

        log.warning(
            "[%s] Payload non-JSON ignoré "
            "sur %s : %s",
            id_appareil,
            msg.topic,
            raw
        )

        return


    # ================================================
    # IDENTIFIANT APPAREIL
    # ================================================

    payload.setdefault(
        "id_appareil",
        id_appareil
    )


    # ================================================
    # HORODATAGE
    # ================================================

    if "horodatage" not in payload:

        payload["horodatage"] = int(
            datetime.now(
                timezone.utc
            ).timestamp()
        )


    # ================================================
    # LOG
    # ================================================

    log.info(
        "[%s] Reçu %s : %s",
        id_appareil,
        kind,
        raw
    )


    # ================================================
    # ENVOI VERS LARAVEL
    # ================================================

    forward_to_laravel(
        kind,
        payload,
        id_appareil
    )


# =====================================================
# FLASK
# =====================================================

flask_app = Flask(
    __name__
)


mqtt_client_ref = {
    "client": None
}


# =====================================================
# SUPERVISION : /health
# =====================================================
# Utilisé par un service de ping externe (ex. UptimeRobot) pour vérifier
# que le Bridge tourne encore et reste connecté au broker MQTT.

@flask_app.route(
    "/health",
    methods=["GET"]
)
def health():

    client = mqtt_client_ref["client"]

    mqtt_connecte = bool(
        client is not None
        and client.is_connected()
    )

    return jsonify({
        "status": "up",
        "mqtt_connecte": mqtt_connecte,
        "mqtt_broker": f"{MQTT_BROKER}:{MQTT_PORT}",
    }), 200 if mqtt_connecte else 503


# =====================================================
# HTTP -> MQTT : /commande
# =====================================================

@flask_app.route(
    "/commande",
    methods=["POST"]
)
def recevoir_commande():

    # ================================================
    # AUTHENTIFICATION
    # ================================================

    if (
        not BRIDGE_API_KEY
        or request.headers.get("X-API-Key")
        != BRIDGE_API_KEY
    ):

        return jsonify({
            "erreur": "non autorise"
        }), 401


    # ================================================
    # JSON
    # ================================================

    data = request.get_json(
        silent=True
    )

    if not data:

        return jsonify({
            "erreur": "JSON invalide ou manquant"
        }), 400


    # ================================================
    # ID APPAREIL
    # ================================================

    id_appareil = data.get(
        "id_appareil"
    )

    if not id_appareil:

        return jsonify({
            "erreur": "champ id_appareil manquant"
        }), 400


    # ================================================
    # COMMANDE
    # ================================================

    commande = data.get(
        "commande",
        ""
    )

    if not commande:

        return jsonify({
            "erreur": "champ commande manquant"
        }), 400


    # ================================================
    # NORMALISATION
    # ================================================

    data["commande"] = commande.upper()


    # ================================================
    # HORODATAGE
    # ================================================

    if "horodatage" not in data:

        data["horodatage"] = int(
            datetime.now(
                timezone.utc
            ).timestamp()
        )


    # ================================================
    # CLIENT MQTT
    # ================================================

    client = mqtt_client_ref["client"]


    if (
        client is None
        or not client.is_connected()
    ):

        log.error(
            "[%s] Commande refusée : "
            "bridge non connecté au broker MQTT",
            id_appareil
        )

        return jsonify({
            "erreur":
                "bridge non connecte "
                "au broker MQTT"
        }), 503


    # ================================================
    # PUBLICATION MQTT
    # ================================================

    topic = TOPIC_COMMAND_TEMPLATE.format(
        id_appareil=id_appareil
    )


    result = client.publish(
        topic,
        json.dumps(data)
    )


    # Vérification du résultat de publication.
    if result.rc != mqtt.MQTT_ERR_SUCCESS:

        log.error(
            "[%s] Échec publication MQTT "
            "(code %s)",
            id_appareil,
            result.rc
        )

        return jsonify({
            "erreur":
                "echec publication MQTT",
            "code":
                result.rc
        }), 502


    log.info(
        "[%s] Commande republiée sur %s : %s",
        id_appareil,
        topic,
        data
    )


    return jsonify({
        "statut":
            "commande transmise",
        "topic":
            topic
    }), 200


# =====================================================
# SERVEUR FLASK
# =====================================================

def run_flask():

    log.info(
        "Serveur HTTP /commande démarré "
        "sur %s:%s",
        FLASK_HOST,
        FLASK_PORT
    )


    flask_app.run(
        host=FLASK_HOST,
        port=FLASK_PORT,
        use_reloader=False
    )


# =====================================================
# MAIN
# =====================================================

def main():

    log.info(
        "=== SHANGO Bridge MQTT <-> HTTP v2.4 ==="
    )


    log.info(
        "Broker MQTT : %s:%s (sans TLS)",
        MQTT_BROKER,
        MQTT_PORT
    )


    log.info(
        "API Laravel : %s",
        API_BASE_URL
    )


    # ================================================
    # VÉRIFICATION CLÉ API LARAVEL
    # ================================================

    if API_TOKEN:

        log.info(
            "Auth API (vers Laravel) : X-API-Key configurée"
        )

    else:

        log.warning(
            "ATTENTION : SHANGO_API_TOKEN "
            "n'est pas configuré."
        )

        log.warning(
            "Les requêtes vers Laravel "
            "risquent de retourner HTTP 401."
        )


    # ================================================
    # VÉRIFICATION CLÉ BRIDGE
    # ================================================

    if BRIDGE_API_KEY:

        log.info(
            "Auth endpoint /commande : configurée"
        )

    else:

        log.warning(
            "ATTENTION : SHANGO_BRIDGE_API_KEY "
            "n'est pas configurée."
        )

        log.warning(
            "Les appels Laravel -> Bridge "
            "vers /commande seront refusés."
        )


    log.info(
        "Endpoint commande : "
        "POST http://<ce-host>:%s/commande",
        FLASK_PORT
    )


    # ================================================
    # CLIENT MQTT
    # ================================================

    client = mqtt.Client(
        client_id=MQTT_CLIENT_ID,
        callback_api_version=
            mqtt.CallbackAPIVersion.VERSION2,
    )


    client.on_connect = on_connect

    client.on_disconnect = on_disconnect

    client.on_message = on_message


    mqtt_client_ref["client"] = client


    # ================================================
    # CONNEXION BROKER
    # ================================================

    client.connect(
        MQTT_BROKER,
        MQTT_PORT,
        keepalive=60
    )


    # ================================================
    # SERVEUR FLASK
    # ================================================

    flask_thread = threading.Thread(
        target=run_flask,
        daemon=True
    )

    flask_thread.start()


    # ================================================
    # BOUCLE MQTT
    # ================================================

    client.loop_forever(
        retry_first_connection=True
    )


# =====================================================
# POINT D'ENTRÉE
# =====================================================

if __name__ == "__main__":

    main()