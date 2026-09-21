<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Equipement;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class StatusController extends Controller
{
    /**
     * Recevoir le statut opérationnel d'un boîtier SHANGO.
     *
     * Contrat SHANGO V3.0.
     */
    public function store(Request $request)
    {
        // =================================================
        // 1. VALIDATION DU PAYLOAD V3.0
        // =================================================

        $validated = $request->validate([
            'id_appareil' => [
                'required',
                'string',
                'max:255',
            ],

            'etat_kit' => [
                'required',
                'string',
                Rule::in([
                    'MARCHE',
                    'BLOQUE',
                ]),
            ],

            'horodatage' => [
                'required',
                'integer',
                'min:0',
            ],
        ]);

        // =================================================
        // 2. RECHERCHER L'ÉQUIPEMENT
        // =================================================

        $equipement = Equipement::where(
            'device_id',
            $validated['id_appareil']
        )->first();

        if (!$equipement) {
            return response()->json([
                'success' => false,
                'message' => 'Équipement introuvable pour cet id_appareil.',
                'id_appareil' => $validated['id_appareil'],
            ], 404);
        }

        // =================================================
        // 3. CONVERSION DU TIMESTAMP
        // =================================================

        $horodatage = Carbon::createFromTimestamp(
            $validated['horodatage']
        );

        // =================================================
        // 4. MISE À JOUR DU STATUT DU KIT
        // =================================================

        $equipement->update([
            'etat_kit' => $validated['etat_kit'],
        ]);

        $equipement->refresh();

        // =================================================
        // 5. RÉPONSE
        // =================================================

        return response()->json([
            'success' => true,
            'message' => 'Statut du kit enregistré avec succès.',
            'data' => [
                'equipement_id' => $equipement->id,
                'device_id' => $equipement->device_id,
                'etat_kit' => $equipement->etat_kit,
                'horodatage' => $horodatage,
            ],
        ], 200);
    }

    /**
     * =====================================================
     * ÉTAT COMMANDÉ D'UN BOÎTIER (POLLING)
     * =====================================================
     *
     * Endpoint :
     * GET /api/status/{device_id}
     *
     * Le Bridge IoT interroge cette route périodiquement pour savoir
     * s'il doit couper (BLOQUE) ou laisser passer (MARCHE) le relais
     * entre le boîtier et la batterie. `etat_kit` est la même valeur
     * que celle affichée/modifiée côté admin (bouton Bloquer/Débloquer
     * du frontend, PUT /api/equipements/{id}).
     *
     * Authentification :
     * X-API-Key
     */
    public function show($deviceId)
    {
        $equipement = Equipement::where('device_id', $deviceId)->first();

        if (!$equipement) {
            return response()->json([
                'success' => false,
                'message' => 'Équipement introuvable pour cet id_appareil.',
                'id_appareil' => $deviceId,
            ], 404);
        }

        return response()->json([
            'success' => true,
            'device_id' => $equipement->device_id,
            'etat_kit' => $equipement->etat_kit ?? 'MARCHE',
        ], 200);
    }
}