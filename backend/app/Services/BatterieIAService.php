<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use RuntimeException;

class BatterieIAService
{
    /**
     * URL de l'API FastAPI SHANGO AI.
     */
    protected string $apiUrl;

    public function __construct()
    {
        $this->apiUrl = rtrim(
            config('services.batterie_ia.url', 'http://127.0.0.1:8000'),
            '/'
        );
    }

    /**
     * Prépare les données de batterie pour le modèle IA.
     *
     * L'ordre attendu par le modèle est :
     * 1. Tension par cellule
     * 2. Courant
     * 3. Température
     * 4. DoD
     */
    public function preparerDonnees(
        float $voltage,
        float $current,
        float $temperature,
        float $dod
    ): array {
        // Alioth possède 4 cellules.
        $voltageCellule = $voltage / 4;

        return [
            $voltageCellule,
            $current,
            $temperature,
            $dod,
        ];
    }

    /**
     * Prépare les données dans le format attendu
     * par l'API FastAPI.
     */
    public function preparerRequeteIA(
        string $deviceId,
        float $voltage,
        float $current,
        float $temperature,
        float $dod
    ): array {
        return [
            'device_id' => $deviceId,
            'voltage_v' => $voltage,
            'current_a' => $current,
            'temperature_c' => $temperature,
            'dod_percent' => $dod,
        ];
    }

    /**
     * Envoie les données à FastAPI et récupère
     * le résultat du modèle IA.
     */
    public function predire(
        string $deviceId,
        float $voltage,
        float $current,
        float $temperature,
        float $dod
    ): array {
        $requete = $this->preparerRequeteIA(
            $deviceId,
            $voltage,
            $current,
            $temperature,
            $dod
        );

        try {
            $response = Http::timeout(10)
                ->acceptJson()
                ->post(
                    $this->apiUrl . '/predict',
                    $requete
                );

            if ($response->failed()) {
                throw new RuntimeException(
                    'L\'API FastAPI a retourné une erreur HTTP '
                    . $response->status()
                    . ' : '
                    . $response->body()
                );
            }

            $resultat = $response->json();

            if (!is_array($resultat)) {
                throw new RuntimeException(
                    'La réponse de FastAPI est invalide.'
                );
            }

            return $resultat;

        } catch (\Throwable $e) {
            throw new RuntimeException(
                'Impossible de contacter l\'API SHANGO AI : '
                . $e->getMessage(),
                0,
                $e
            );
        }
    }
}
