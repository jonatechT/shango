<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Equipement;
use App\Models\Telemetrie;
use App\Services\AlerteDetectionService;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class TelemetrieController extends Controller
{
    /**
     * Enregistrer une télémétrie envoyée par un boîtier SHANGO.
     *
     * Contrat SHANGO V3.0.
     */
    public function store(
        Request $request,
        AlerteDetectionService $alerteDetectionService
    ) {
        // =================================================
        // 1. VALIDATION DU PAYLOAD V3.0
        // =================================================

        $validated = $request->validate([
            'id_appareil' => [
                'required',
                'string',
                'max:255',
            ],

            'horodatage' => [
                'required',
                'integer',
                'min:0',
            ],

            'tension' => [
                'nullable',
                'numeric',
            ],

            'courant' => [
                'nullable',
                'numeric',
            ],

            'temperature' => [
                'nullable',
                'numeric',
            ],

            'humidite' => [
                'nullable',
                'numeric',
            ],

            'boitier' => [
                'nullable',
                'string',
                Rule::in([
                    'OUVERT',
                    'FERME',
                ]),
            ],

            'etat_kit' => [
                'nullable',
                'string',
                Rule::in([
                    'MARCHE',
                    'BLOQUE',
                ]),
            ],

            'statut_paiement' => [
                'nullable',
                'string',
                Rule::in([
                    'OK',
                    'EN_RETARD',
                    'BLOQUE',
                ]),
            ],

            'signal_gsm' => [
                'nullable',
                'numeric',
            ],

            // Réintroduit le 2026-09-22 : le contrat V3.0 avait retiré le GPS
            // (voir le commentaire plus bas), mais le firmware du boîtier
            // l'envoie toujours, imbriqué sous "gps". Décision explicite de
            // l'utilisateur de le réaccepter malgré ce contrat — si le
            // développeur backend resynchronise ce fichier depuis son dépôt,
            // vérifier que ce bloc n'a pas été écrasé silencieusement.
            'gps.latitude' => [
                'nullable',
                'numeric',
                'between:-90,90',
            ],

            'gps.longitude' => [
                'nullable',
                'numeric',
                'between:-180,180',
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
        // 4. PRÉPARATION DE LA TÉLÉMÉTRIE
        // =================================================

        $data = [
            'equipement_id' => $equipement->id,
            'device_id' => $validated['id_appareil'],
            'horodatage' => $horodatage,

            // Le contrat V3.0 avait retiré le GPS, mais le firmware
            // l'envoie toujours sous "gps" — réaccepté depuis le 2026-09-22.
            'latitude' => $validated['gps']['latitude'] ?? null,
            'longitude' => $validated['gps']['longitude'] ?? null,

            'tension' => $validated['tension'] ?? null,
            'courant' => $validated['courant'] ?? null,
            'temperature' => $validated['temperature'] ?? null,
            'humidite' => $validated['humidite'] ?? null,
            'boitier' => $validated['boitier'] ?? null,
            'etat_kit' => $validated['etat_kit'] ?? null,
            'statut_paiement' => $validated['statut_paiement'] ?? null,
            'signal_gsm' => $validated['signal_gsm'] ?? null,
        ];

        // =================================================
        // 5. ENREGISTREMENT
        // =================================================

        $telemetrie = Telemetrie::create($data);

        // =================================================
        // 6. DÉTECTION AUTOMATIQUE DES ALERTES
        // =================================================

        $alerteDetectionService->detecter($telemetrie);

        // =================================================
        // 7. RÉPONSE
        // =================================================

        return response()->json([
            'success' => true,
            'message' => 'Télémétrie enregistrée avec succès.',
            'data' => $telemetrie,
        ], 201);
    }

    /**
     * Récupérer la liste des télémétries.
     */
    public function index()
    {
        $user = request()->user();

        $query = Telemetrie::with('equipement');

        // Un technicien ne voit que les télémétries
        // des équipements qui lui sont affectés.
        if ($user->role === 'technicien') {
            $query->whereHas('equipement', function ($q) use ($user) {
                $q->where('technicien_id', $user->id);
            });
        }

        $telemetries = $query
            ->orderBy('horodatage', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Liste des télémétries récupérée avec succès.',
            'data' => $telemetries,
        ]);
    }

    /**
     * Récupérer l'historique des télémétries
     * d'un équipement.
     */
    public function equipementTelemetries($equipementId)
    {
        $equipement = Equipement::find($equipementId);

        if (!$equipement) {
            return response()->json([
                'message' => 'Ressource introuvable.'
            ], 404);
        }

        $user = request()->user();

        // Un technicien ne peut consulter que
        // les équipements qui lui sont affectés.
        if (
            $user->role === 'technicien' &&
            (int) $equipement->technicien_id !== (int) $user->id
        ) {
            return response()->json([
                'message' => 'Accès interdit. Cet équipement ne vous est pas affecté.'
            ], 403);
        }

        $telemetries = Telemetrie::where(
            'equipement_id',
            $equipementId
        )
            ->orderBy('horodatage', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Historique des télémétries récupéré avec succès.',
            'data' => $telemetries,
        ]);
    }
}