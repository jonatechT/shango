<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PredictionBatterie;
use App\Services\BatterieIAService;
use Illuminate\Http\Request;
use Illuminate\Http\JsonResponse;
use Throwable;

class BatterieDiagnosticController extends Controller
{
    /**
     * Enregistrer les données d'un diagnostic batterie,
     * envoyer les données au modèle IA FastAPI,
     * puis enregistrer les résultats de la prédiction.
     */
    public function store(
        Request $request,
        BatterieIAService $serviceIA
    ): JsonResponse {
        // ============================================================
        // 1. VALIDATION DES DONNÉES REÇUES
        // ============================================================

        $validated = $request->validate([
            'device_id' => [
                'required',
                'string',
                'max:191',
            ],

            'voltage_v' => [
                'required',
                'numeric',
            ],

            'current_a' => [
                'required',
                'numeric',
            ],

            'temperature_c' => [
                'required',
                'numeric',
            ],

            'dod_percent' => [
                'required',
                'numeric',
                'min:0',
                'max:100',
            ],
        ]);

        // ============================================================
        // 2. RÉCUPÉRATION ET CONVERSION DES DONNÉES
        // ============================================================

        $deviceId = trim($validated['device_id']);

        $voltage = (float) $validated['voltage_v'];
        $current = (float) $validated['current_a'];
        $temperature = (float) $validated['temperature_c'];
        $dod = (float) $validated['dod_percent'];

        // ============================================================
        // 3. PRÉPARATION DES DONNÉES POUR L'IA
        // ============================================================

        $donneesIA = $serviceIA->preparerDonnees(
            $voltage,
            $current,
            $temperature,
            $dod
        );

        // La première valeur correspond à la tension par cellule.
        $voltageCellule = $donneesIA[0];

        // ============================================================
        // 4. APPEL DU MODÈLE IA FASTAPI
        // ============================================================

        try {
            $resultatIA = $serviceIA->predire(
                $deviceId,
                $voltage,
                $current,
                $temperature,
                $dod
            );
        } catch (Throwable $e) {
            return response()->json([
                'success' => false,

                'message' => 'Impossible d\'obtenir le diagnostic IA.',

                'erreur' => $e->getMessage(),

                'donnees_recues' => [
                    'device_id' => $deviceId,
                    'voltage_v' => $voltage,
                    'current_a' => $current,
                    'temperature_c' => $temperature,
                    'dod_percent' => $dod,
                ],
            ], 503);
        }

        // ============================================================
        // 5. RÉCUPÉRATION DES RÉSULTATS IA
        // ============================================================

        $sohClass = $resultatIA['soh_class'] ?? null;

        $sohClassId = isset($resultatIA['soh_class_id'])
            ? (int) $resultatIA['soh_class_id']
            : null;

        $sohProbabilities = $resultatIA['soh_probabilities'] ?? null;

        $confidence = isset($resultatIA['confidence'])
            ? (float) $resultatIA['confidence']
            : null;

        $rulCycles = isset($resultatIA['rul_cycles'])
            ? (int) $resultatIA['rul_cycles']
            : null;

        // ============================================================
        // 6. ENREGISTREMENT EN BASE DE DONNÉES
        // ============================================================

        $prediction = PredictionBatterie::create([
            'device_id' => $deviceId,

            'date_heure' => now(),

            // Données reçues
            'voltage_v' => $voltage,
            'current_a' => $current,
            'temperature_c' => $temperature,
            'dod_percent' => $dod,

            // Anciennes colonnes IA
            // Elles restent null car le modèle actuel
            // ne fournit pas directement ces informations.
            'soh_pourcent' => null,
            'capacite_ah' => null,
            'rul_jours' => null,

            // Résultats réels du modèle IA
            'soh_class' => $sohClass,
            'soh_class_id' => $sohClassId,
            'soh_probabilities' => $sohProbabilities,
            'confidence' => $confidence,
            'rul_cycles' => $rulCycles,

            // État métier non défini pour le moment.
            'etat' => null,
        ]);

        // ============================================================
        // 7. RÉPONSE API
        // ============================================================

        return response()->json([
            'success' => true,

            'message' =>
                'Diagnostic batterie effectué avec succès.',

            'prediction_id' =>
                $prediction->id,

            'donnees_recues' => [
                'device_id' => $deviceId,
                'voltage_v' => $voltage,
                'current_a' => $current,
                'temperature_c' => $temperature,
                'dod_percent' => $dod,
            ],

            'donnees_envoyees_a_l_ia' => [
                'device_id' => $deviceId,
                'voltage_v' => $voltage,
                'voltage_per_cell' => $voltageCellule,
                'current_a' => $current,
                'temperature_c' => $temperature,
                'dod_percent' => $dod,
            ],

            'resultats_ia' => [
                'soh_class' => $sohClass,
                'soh_class_id' => $sohClassId,
                'soh_probabilities' => $sohProbabilities,
                'confidence' => $confidence,
                'rul_cycles' => $rulCycles,
            ],

            'prediction_enregistree' => [
                'id' => $prediction->id,
                'device_id' => $prediction->device_id,
                'date_heure' => $prediction->date_heure,
            ],
        ], 200);
    }

    /**
     * Récupérer l'historique des diagnostics
     * d'une batterie à partir de son device_id.
     */
    public function history(string $device_id): JsonResponse
    {
        $historique = PredictionBatterie::where(
            'device_id',
            $device_id
        )
            ->orderBy('date_heure', 'desc')
            ->get();

        return response()->json([
            'success' => true,

            'device_id' => $device_id,

            'nombre_diagnostics' =>
                $historique->count(),

            'historique' =>
                $historique,
        ], 200);
    }
}
