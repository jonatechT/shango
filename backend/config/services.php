<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Third Party Services
    |--------------------------------------------------------------------------
    |
    | This file is for storing the credentials for third party services such
    | as Resend, Postmark, AWS, and more. This file provides the de facto
    | location for this type of service credentials, allowing packages
    | to have a conventional place to find the various service credentials.
    |
    */

    'postmark' => [
        'key' => env('POSTMARK_API_KEY'),
    ],

    'resend' => [
        'key' => env('RESEND_API_KEY'),
    ],

    'ses' => [
        'key' => env('AWS_ACCESS_KEY_ID'),
        'secret' => env('AWS_SECRET_ACCESS_KEY'),
        'region' => env(
            'AWS_DEFAULT_REGION',
            'us-east-1'
        ),
    ],

    'slack' => [
        'notifications' => [
            'bot_user_oauth_token' => env(
                'SLACK_BOT_USER_OAUTH_TOKEN'
            ),

            'channel' => env(
                'SLACK_BOT_USER_DEFAULT_CHANNEL'
            ),
        ],
    ],

    /*
    |--------------------------------------------------------------------------
    | SHANGO Bridge MQTT
    |--------------------------------------------------------------------------
    |
    | Configuration utilisée pour envoyer les commandes Laravel
    | vers le Bridge MQTT.
    |
    */

    'shango_bridge' => [
        'url' => env('SHANGO_BRIDGE_URL'),
        'api_key' => env('SHANGO_BRIDGE_API_KEY'),
    ],

    /*
    |--------------------------------------------------------------------------
    | SHANGO IoT API
    |--------------------------------------------------------------------------
    |
    | Clé utilisée pour authentifier les données envoyées par les
    | équipements IoT vers Laravel (télémétrie et alertes).
    |
    */

    'shango_iot' => [
        'api_key' => env('SHANGO_IOT_API_KEY'),
    ],

    /*
    |--------------------------------------------------------------------------
    | SHANGO Batterie IA
    |--------------------------------------------------------------------------
    |
    | URL de l'API FastAPI utilisée pour les prédictions
    | SOH et RUL des batteries.
    |
    */

    'batterie_ia' => [
        'url' => env(
            'BATTERIE_IA_URL',
            'http://127.0.0.1:8000'
        ),
    ],

];
