<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Equipement;
use App\Models\Intervention;
use Illuminate\Http\Request;

class InterventionController extends Controller
{
    /**
     * =====================================================
     * LISTE DES INTERVENTIONS
     * =====================================================
     */
    public function index()
    {
        $user = request()->user();

        $query = Intervention::with([
            'maintenance',
            'equipement',
            'technicien',
        ]);

        // Le technicien ne voit que ses propres interventions.
        if ($user->role === 'technicien') {
            $query->where('technicien_id', $user->id);
        }

        $interventions = $query->latest()->get();

        return response()->json([
            'message' => 'Liste des interventions',
            'data' => $interventions,
        ]);
    }

    /**
     * =====================================================
     * CREER UNE INTERVENTION
     * =====================================================
     */
    public function store(Request $request)
    {
        $user = request()->user();

        $validated = $request->validate([
            'maintenance_id' => [
                'nullable',
                'exists:maintenances,id',
            ],

            'equipement_id' => [
                'required',
                'exists:equipements,id',
            ],

            'technicien_id' => [
                'required',
                'exists:users,id',
            ],

            'date_intervention' => [
                'required',
                'date',
            ],

            'diagnostic' => [
                'nullable',
                'string',
            ],

            'actions_realisees' => [
                'nullable',
                'string',
            ],

            'pieces_utilisees' => [
                'nullable',
                'array',
            ],

            'etat_equipement_apres' => [
                'nullable',
                'string',
            ],

            'commentaire' => [
                'nullable',
                'string',
            ],

            'status' => [
                'nullable',
                'in:en_attente,en_cours,resolu,a_suivre',
            ],
        ]);

        /*
         * =================================================
         * SECURITE TECHNICIEN
         * =================================================
         *
         * Un technicien ne peut créer une intervention
         * que pour lui-même.
         */
        if ($user->role === 'technicien') {

            if (
                (int) $validated['technicien_id']
                !== (int) $user->id
            ) {
                return response()->json([
                    'message' => 'Accès interdit. Vous ne pouvez créer une intervention que pour vous-même.',
                ], 403);
            }

            /*
             * =================================================
             * SECURITE EQUIPEMENT
             * =================================================
             *
             * Un technicien ne peut créer une intervention
             * que sur un équipement qui lui est affecté.
             */
            $equipement = Equipement::find(
                $validated['equipement_id']
            );

            if (
                !$equipement ||
                (int) $equipement->technicien_id
                !== (int) $user->id
            ) {
                return response()->json([
                    'message' => 'Accès interdit. Cet équipement ne vous est pas affecté.',
                ], 403);
            }
        }

        $intervention = Intervention::create($validated);

        return response()->json([
            'message' => 'Intervention enregistrée avec succès.',
            'data' => $intervention->load([
                'maintenance',
                'equipement',
                'technicien',
            ]),
        ], 201);
    }

    /**
     * =====================================================
     * AFFICHER UNE INTERVENTION
     * =====================================================
     */
    public function show(string $id)
    {
        $intervention = Intervention::with([
            'maintenance',
            'equipement',
            'technicien',
        ])->findOrFail($id);

        $user = request()->user();

        /*
         * =================================================
         * SECURITE TECHNICIEN
         * =================================================
         *
         * Le technicien ne peut consulter que les
         * interventions qui lui sont affectées.
         */
        if (
            $user->role === 'technicien' &&
            (int) $intervention->technicien_id
            !== (int) $user->id
        ) {
            return response()->json([
                'message' => 'Accès interdit. Cette intervention ne vous est pas affectée.',
            ], 403);
        }

        return response()->json([
            'message' => 'Intervention trouvée.',
            'data' => $intervention,
        ]);
    }

    /**
     * =====================================================
     * MODIFIER UNE INTERVENTION
     * =====================================================
     */
    public function update(Request $request, string $id)
    {
        $intervention = Intervention::findOrFail($id);

        $user = request()->user();

        /*
         * =================================================
         * SECURITE TECHNICIEN
         * =================================================
         *
         * Un technicien peut modifier uniquement
         * une intervention qui lui appartient.
         */
        if (
            $user->role === 'technicien' &&
            (int) $intervention->technicien_id
            !== (int) $user->id
        ) {
            return response()->json([
                'message' => 'Accès interdit. Cette intervention ne vous est pas affectée.',
            ], 403);
        }

        /*
         * =================================================
         * SECURITE TECHNICIEN_ID
         * =================================================
         *
         * Un technicien ne peut jamais modifier le
         * technicien affecté à l'intervention.
         */
        if (
            $user->role === 'technicien' &&
            $request->has('technicien_id')
        ) {
            return response()->json([
                'message' => 'Accès interdit. Un technicien ne peut pas modifier le technicien affecté.',
            ], 403);
        }

        /*
         * =================================================
         * VALIDATION
         * =================================================
         */
        $validated = $request->validate([

            'maintenance_id' => [
                'sometimes',
                'nullable',
                'exists:maintenances,id',
            ],

            'equipement_id' => [
                'sometimes',
                'exists:equipements,id',
            ],

            'date_intervention' => [
                'sometimes',
                'date',
            ],

            'diagnostic' => [
                'sometimes',
                'nullable',
                'string',
            ],

            'actions_realisees' => [
                'sometimes',
                'nullable',
                'string',
            ],

            'pieces_utilisees' => [
                'sometimes',
                'nullable',
                'array',
            ],

            'etat_equipement_apres' => [
                'sometimes',
                'nullable',
                'string',
            ],

            'commentaire' => [
                'sometimes',
                'nullable',
                'string',
            ],

            'status' => [
                'sometimes',
                'in:en_attente,en_cours,resolu,a_suivre',
            ],
        ]);

        /*
         * =================================================
         * SECURITE EQUIPEMENT
         * =================================================
         *
         * Si un technicien essaie de modifier
         * l'équipement de l'intervention, le nouvel
         * équipement doit également lui être affecté.
         */
        if (
            $user->role === 'technicien' &&
            array_key_exists('equipement_id', $validated)
        ) {
            $equipement = Equipement::find(
                $validated['equipement_id']
            );

            if (
                !$equipement ||
                (int) $equipement->technicien_id
                !== (int) $user->id
            ) {
                return response()->json([
                    'message' => 'Accès interdit. Cet équipement ne vous est pas affecté.',
                ], 403);
            }
        }

        /*
         * =================================================
         * MISE A JOUR
         * =================================================
         */
        $intervention->update($validated);

        /*
         * =================================================
         * MAINTENANCE AUTOMATIQUE
         * =================================================
         *
         * Si l'intervention est résolue,
         * la maintenance passe automatiquement
         * à "terminee".
         */
        if (
            $intervention->status === 'resolu' &&
            $intervention->maintenance_id
        ) {
            $maintenance = $intervention->maintenance;

            if ($maintenance) {
                $maintenance->update([
                    'status' => 'terminee',
                ]);
            }
        }

        /*
         * Recharger les relations après modification.
         */
        $intervention->refresh();

        $intervention->load([
            'maintenance',
            'equipement',
            'technicien',
        ]);

        return response()->json([
            'message' => 'Intervention modifiée avec succès.',
            'data' => $intervention,
        ]);
    }

    /**
     * =====================================================
     * SUPPRIMER UNE INTERVENTION
     * =====================================================
     */
    public function destroy(string $id)
    {
        $user = request()->user();

        /*
         * =================================================
         * SECURITE TECHNICIEN
         * =================================================
         *
         * Un technicien ne peut jamais supprimer
         * une intervention.
         */
        if ($user->role === 'technicien') {
            return response()->json([
                'message' => 'Accès interdit. Les techniciens ne peuvent pas supprimer une intervention.',
            ], 403);
        }

        $intervention = Intervention::findOrFail($id);

        $intervention->delete();

        return response()->json([
            'message' => 'Intervention supprimée avec succès.',
        ]);
    }
}