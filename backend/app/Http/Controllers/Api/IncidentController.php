<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Incident;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class IncidentController extends Controller
{
    /**
     * =====================================================
     * LISTE DES INCIDENTS
     * =====================================================
     */
    public function index()
    {
        $incidents = Incident::with([
            'equipement',
            'reporter'
        ])->latest()->get();

        return response()->json([
            'message' => 'Liste des incidents récupérée avec succès.',
            'data' => $incidents,
        ]);
    }


    /**
     * =====================================================
     * CREER UN INCIDENT
     * =====================================================
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'equipement_id' => [
                'required',
                'exists:equipements,id'
            ],

            'reported_by' => [
                'sometimes',
                'nullable',
                'exists:users,id'
            ],

            'type' => [
                'required',
                'string',
                'max:255'
            ],

            'description' => [
                'required',
                'string'
            ],

            'priority' => [
                'required',
                'in:basse,moyenne,haute'
            ],

            'status' => [
                'sometimes',
                'in:en_attente,en_cours,resolu,a_suivre'
            ],
        ]);

        // Si aucun utilisateur n'est indiqué,
        // on utilise l'utilisateur connecté.
        if (!isset($validated['reported_by'])) {
            $validated['reported_by'] = Auth::id();
        }

        // Statut par défaut
        if (!isset($validated['status'])) {
            $validated['status'] = 'en_attente';
        }

        $incident = Incident::create($validated);

        return response()->json([
            'message' => 'Incident créé avec succès.',
            'data' => $incident->load([
                'equipement',
                'reporter'
            ]),
        ], 201);
    }


    /**
     * =====================================================
     * AFFICHER UN INCIDENT
     * =====================================================
     */
    public function show(string $id)
    {
        $incident = Incident::with([
            'equipement',
            'reporter'
        ])->findOrFail($id);

        return response()->json([
            'message' => 'Incident trouvé.',
            'data' => $incident,
        ]);
    }


    /**
     * =====================================================
     * MODIFIER UN INCIDENT
     * =====================================================
     *
     * Réservé au :
     * - Super Admin
     * - Admin
     *
     * Le technicien utilise updateStatus()
     * pour modifier uniquement le statut.
     */
    public function update(Request $request, string $id)
    {
        $incident = Incident::findOrFail($id);

        $validated = $request->validate([
            'equipement_id' => [
                'sometimes',
                'exists:equipements,id'
            ],

            'reported_by' => [
                'sometimes',
                'nullable',
                'exists:users,id'
            ],

            'type' => [
                'sometimes',
                'string',
                'max:255'
            ],

            'description' => [
                'sometimes',
                'string'
            ],

            'priority' => [
                'sometimes',
                'in:basse,moyenne,haute'
            ],

            'status' => [
                'sometimes',
                'in:en_attente,en_cours,resolu,a_suivre'
            ],
        ]);

        $incident->update($validated);

        return response()->json([
            'message' => 'Incident modifié avec succès.',
            'data' => $incident->fresh()->load([
                'equipement',
                'reporter'
            ]),
        ]);
    }


    /**
     * =====================================================
     * MODIFIER UNIQUEMENT LE STATUT
     * =====================================================
     *
     * Accessible au :
     * - Super Admin
     * - Admin
     * - Technicien
     *
     * Le technicien peut uniquement modifier
     * le statut d'un incident concernant
     * un équipement qui lui est affecté.
     */
    public function updateStatus(Request $request, string $id)
    {
        // 1. Récupérer l'utilisateur connecté
        $user = $request->user();

        // 2. Vérifier l'authentification
        if (!$user) {
            return response()->json([
                'message' => 'Utilisateur non authentifié.'
            ], 401);
        }

        // 3. Récupérer l'incident avec son équipement
        $incident = Incident::with('equipement')
            ->findOrFail($id);

        // 4. Vérifier que l'équipement existe
        if (!$incident->equipement) {
            return response()->json([
                'message' => 'Impossible de modifier cet incident : équipement introuvable.'
            ], 404);
        }

        /**
         * =====================================================
         * 5. DIAGNOSTIC TEMPORAIRE
         * =====================================================
         *
         * Permet de vérifier :
         * - l'utilisateur connecté
         * - son rôle
         * - le technicien affecté à l'équipement
         *
         * A SUPPRIMER après le test.
         */
        //dd([
            //'ID utilisateur connecté' => Auth::id(),
           // 'Rôle utilisateur' => $user->role,
            //'ID technicien affecté à l’équipement' =>
             //   $incident->equipement?->technicien_id,
        //]);

        /**
         * =====================================================
         * 6. Vérifier l'affectation du technicien
         * =====================================================
         */
        if (
            $user->role === 'technicien' &&
            (int) $incident->equipement->technicien_id !== (int) $user->id
        ) {
            return response()->json([
                'message' => 'Accès interdit. Cet incident concerne un équipement qui ne vous est pas affecté.'
            ], 403);
        }

        /**
         * =====================================================
         * 7. Validation du statut
         * =====================================================
         */
        $validated = $request->validate([
            'status' => [
                'required',
                'in:en_attente,en_cours,resolu,a_suivre'
            ],
        ]);

        /**
         * =====================================================
         * 8. Modifier uniquement le statut
         * =====================================================
         */
        $incident->update([
            'status' => $validated['status']
        ]);

        /**
         * =====================================================
         * 9. Retourner l'incident modifié
         * =====================================================
         */
        return response()->json([
            'message' => 'Statut de l’incident modifié avec succès.',
            'data' => $incident->fresh()->load([
                'equipement',
                'reporter'
            ]),
        ]);
    }


    /**
     * =====================================================
     * SUPPRIMER UN INCIDENT
     * =====================================================
     *
     * Réservé au :
     * - Super Admin
     * - Admin
     */
    public function destroy(string $id)
{
// Récupérer l'utilisateur connecté
$user = request()->user();

// Vérifier l'authentification
if (!$user) {
    return response()->json([
        'message' => 'Utilisateur non authentifié.'
    ], 401);
}

// Seuls le superadmin et l'admin peuvent supprimer un incident
if (!in_array($user->role, ['superadmin', 'admin'])) {
    return response()->json([
        'message' => 'Accès interdit. Les techniciens ne peuvent pas supprimer un incident.'
    ], 403);
}

// Récupérer l'incident
$incident = Incident::findOrFail($id);

// Supprimer l'incident
$incident->delete();

return response()->json([
    'message' => 'Incident supprimé avec succès.'
]);
   }
}