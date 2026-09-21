<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class VerifyShangoApiKey
{
    /**
     * Vérifier la clé API utilisée par le Bridge IoT.
     */
    public function handle(Request $request, Closure $next): Response
    {
        // Récupérer la clé envoyée dans le header
        $apiKey = $request->header('X-API-Key');

        // Clé configurée : config/services.php → SHANGO_IOT_API_KEY du .env.
        // On passe par `config()` et non `env()` (comme BridgeService) : dès
        // qu'un cache de configuration est généré (`php artisan config:cache`,
        // courant en production), `env()` renvoie null hors des fichiers de
        // config — la clé attendue deviendrait null et TOUTES les requêtes des
        // boîtiers seraient rejetées en 401.
        $expectedApiKey = config('services.shango_iot.api_key');

        // Vérifier la clé
        if (!$apiKey || $apiKey !== $expectedApiKey) {
            return response()->json([
                'success' => false,
                'message' => 'Clé API IoT invalide ou absente.',
            ], 401);
        }

        // Clé correcte → continuer vers le contrôleur
        return $next($request);
    }
}