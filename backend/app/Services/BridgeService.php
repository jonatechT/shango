<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;

class BridgeService
{
    /**
     * Envoyer une commande au Bridge MQTT
     */
    public function envoyerCommande(array $commande)
    {
        $url = config('services.shango_bridge.url');
        $apiKey = config('services.shango_bridge.api_key');

        return Http::withHeaders([
            'X-API-Key' => $apiKey,
            'Accept' => 'application/json',
            'Content-Type' => 'application/json',
        ])->post($url . '/commande', $commande);
    }
}