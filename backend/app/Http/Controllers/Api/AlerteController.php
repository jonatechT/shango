<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Alerte;
use App\Models\Equipement;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class AlerteController extends Controller
{
    /**
     * =====================================================
     * ENREGISTRER UNE ALERTE
     * =====================================================
     *
     * Endpoint :
     * POST /api/alertes
     *
     * Utilisé par le Bridge IoT.
     *
     * Authentification :
     * X-API-Key
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

            'horodatage' => [
                'required',
                'integer',
                'min:0',
            ],

            'type_alerte' => [
                'required',
                'string',
                Rule::in([
                    'CHOC',
                    'SURCHAUFFE',
                    'TENSION_FAIBLE',
                    'MOUVEMENT',
                    'BOITIER_OUVERT',
                ]),
            ],

            'gravite' => [
                'required',
                'string',
                Rule::in([
                    'FAIBLE',
                    'MOYENNE',
                    'ELEVEE',
                ]),
            ],

            'valeur' => [
                'nullable',
                'numeric',
            ],
        ]);

        // =================================================
        // 2. RECHERCHER L'ÉQUIPEMENT
        // =================================================

        $equipement = Equipement::where(
            'device_id',
            $validated['id_appareil']
        )->first();

        // =================================================
        // 3. VÉRIFIER QUE L'ÉQUIPEMENT EXISTE
        // =================================================

        if (!$equipement) {
            return response()->json([
                'success' => false,
                'message' => 'Équipement introuvable pour cet id_appareil.',
                'id_appareil' => $validated['id_appareil'],
            ], 404);
        }

        // =================================================
        // 4. CONVERTIR L'HORODATAGE UNIX
        // =================================================

        $horodatage = Carbon::createFromTimestamp(
            $validated['horodatage']
        );

        // =================================================
        // 5. NE PAS DUPLIQUER UNE ALERTE DÉJÀ ACTIVE
        // =================================================
        // Même règle que la détection automatique (AlerteDetectionService) :
        // une condition qui persiste (bouton resté ouvert, mouvement continu)
        // ne doit produire qu'une seule alerte active, pas une par envoi.

        $dejaActive = Alerte::where('equipement_id', $equipement->id)
            ->where('type_alerte', $validated['type_alerte'])
            ->whereIn('statut', ['nouvelle', 'en_cours'])
            ->first();

        if ($dejaActive) {
            return response()->json([
                'success' => true,
                'message' => 'Alerte déjà active pour ce type, aucun doublon créé.',
                'data' => $dejaActive,
            ], 200);
        }

        // =================================================
        // 6. ENREGISTRER L'ALERTE
        // =================================================

        $alerte = Alerte::create([
            'equipement_id' => $equipement->id,
            'device_id' => $validated['id_appareil'],
            'type_alerte' => $validated['type_alerte'],
            'gravite' => $validated['gravite'],
            'statut' => 'nouvelle',
            'valeur' => $validated['valeur'] ?? null,
            'horodatage' => $horodatage,
        ]);

        // =================================================
        // 7. RÉPONSE
        // =================================================

        return response()->json([
            'success' => true,
            'message' => 'Alerte enregistrée avec succès.',
            'data' => $alerte,
        ], 201);
    }


    /**
     * =====================================================
     * LISTE DES ALERTES
     * =====================================================
     *
     * Endpoint :
     * GET /api/alertes
     *
     * Authentification :
     * Sanctum
     */
    public function index()
    {
        $user = request()->user();

        $query = Alerte::with('equipement');

        // =================================================
        // RESTRICTION POUR LE TECHNICIEN
        // =================================================

        if ($user->role === 'technicien') {
            $query->whereHas('equipement', function ($q) use ($user) {
                $q->where('technicien_id', $user->id);
            });
        }

        // =================================================
        // RÉCUPÉRER LES ALERTES
        // =================================================

        $alertes = $query
            ->orderBy('horodatage', 'desc')
            ->get();

        // =================================================
        // RÉPONSE
        // =================================================

        return response()->json([
            'success' => true,
            'message' => 'Liste des alertes récupérée avec succès.',
            'data' => $alertes,
        ]);
    }


    /**
     * =====================================================
     * HISTORIQUE DES ALERTES D'UN ÉQUIPEMENT
     * =====================================================
     *
     * Endpoint :
     * GET /api/equipements/{equipement}/alertes
     *
     * Authentification :
     * Sanctum
     */
    public function equipementAlertes($equipementId)
    {
        // =================================================
        // 1. VÉRIFIER QUE L'ÉQUIPEMENT EXISTE
        // =================================================

        $equipement = Equipement::find($equipementId);

        if (!$equipement) {
            return response()->json([
                'success' => false,
                'message' => 'Équipement introuvable.',
            ], 404);
        }

        // =================================================
        // 2. VÉRIFIER LES PERMISSIONS
        // =================================================

        $user = request()->user();

        if (
            $user->role === 'technicien' &&
            (int) $equipement->technicien_id !== (int) $user->id
        ) {
            return response()->json([
                'message' => 'Accès interdit. Cet équipement ne vous est pas affecté.'
            ], 403);
        }

        // =================================================
        // 3. RÉCUPÉRER LES ALERTES
        // =================================================

        $alertes = Alerte::where(
            'equipement_id',
            $equipementId
        )
            ->orderBy('horodatage', 'desc')
            ->get();

        // =================================================
        // 4. RÉPONSE
        // =================================================

        return response()->json([
            'success' => true,
            'message' => 'Historique des alertes récupéré avec succès.',
            'data' => $alertes,
        ]);
    }


    /**
     * =====================================================
     * MODIFIER LE STATUT D'UNE ALERTE
     * =====================================================
     *
     * Endpoint :
     * PATCH /api/alertes/{alerte}/status
     *
     * Authentification :
     * Sanctum
     */
    public function updateStatus(Request $request, Alerte $alerte)
    {
        // =================================================
        // 1. VÉRIFIER LES PERMISSIONS
        // =================================================

        $user = request()->user();

        $equipement = Equipement::find(
            $alerte->equipement_id
        );

        // =================================================
        // SÉCURITÉ TECHNICIEN
        // =================================================

        if (
            $user->role === 'technicien' &&
            (
                !$equipement ||
                (int) $equipement->technicien_id !== (int) $user->id
            )
        ) {
            return response()->json([
                'message' => 'Accès interdit. Cette alerte concerne un équipement qui ne vous est pas affecté.'
            ], 403);
        }

        // =================================================
        // 2. VALIDATION DU STATUT
        // =================================================

        $validated = $request->validate([
            'statut' => [
                'required',
                'string',
                Rule::in([
                    'nouvelle',
                    'en_cours',
                    'resolue',
                    'ignoree',
                ]),
            ],
        ]);

        // =================================================
        // 3. MODIFIER LE STATUT
        // =================================================

        $alerte->update([
            'statut' => $validated['statut'],
        ]);

        // =================================================
        // 4. RÉCUPÉRER LES DONNÉES À JOUR
        // =================================================

        $alerte->refresh();

        // =================================================
        // 5. RÉPONSE
        // =================================================

        return response()->json([
            'success' => true,
            'message' => 'Statut de l\'alerte mis à jour avec succès.',
            'data' => $alerte,
        ]);
    }
}