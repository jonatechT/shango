<?php

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    |
    | Le frontend Angular (ng serve, ex. http://localhost:4200) tourne sur une
    | origine différente du backend Laravel (ex. http://localhost:8000).
    | L'authentification se fait via un token Bearer (Sanctum, pas de cookies
    | de session), donc `supports_credentials` reste à false.
    |
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => ['*'],

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    'exposed_headers' => [],

    'max_age' => 0,

    'supports_credentials' => false,

];
