<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Maintenance;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;

class MaintenanceController extends Controller
{
    /**
     * =====================================================
     * LISTE DES MAINTENANCES
     * =====================================================
     */
    public function index()
    {
        $user = Auth::user();

        $query = Maintenance::with([
            'equipement',
            'incident',
            'requester',
            'validator',
            'assignedTechnicien'
        ]);

        // Le technicien voit uniquement
        // les maintenances qui lui sont affectées.
        if ($user->role === 'technicien') {
            $query->where('assigned_to', $user->id);
        }

        $maintenances = $query->latest()->get();

        return response()->json([
            'message' => 'Liste des maintenances',
            'data' => $maintenances,
        ]);
    }


    /**
     * =====================================================
     * CRÉER UNE MAINTENANCE
     * =====================================================
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'equipement_id' => [
                'required',
                'exists:equipements,id'
            ],

            'incident_id' => [
                'nullable',
                'exists:incidents,id'
            ],

            'type' => [
                'required',
                'in:preventive,corrective'
            ],

            'requested_by' => [
                'nullable',
                'exists:users,id'
            ],

            'validated_by' => [
                'nullable',
                'exists:users,id'
            ],

            'assigned_to' => [
                'nullable',
                'exists:users,id'
            ],

            'status' => [
                'nullable',
                'in:demandee,validee,planifiee,en_cours,terminee'
            ],

            'scheduled_at' => [
                'nullable',
                'date'
            ],
        ]);

        $maintenance = Maintenance::create($validated);

        return response()->json([
            'message' => 'Maintenance enregistrée avec succès.',
            'data' => $maintenance->load([
                'equipement',
                'incident',
                'requester',
                'validator',
                'assignedTechnicien'
            ]),
        ], 201);
    }


    /**
     * =====================================================
     * AFFICHER UNE MAINTENANCE
     * =====================================================
     */
    public function show(string $id)
    {
        $user = Auth::user();

        $maintenance = Maintenance::with([
            'equipement',
            'incident',
            'requester',
            'validator',
            'assignedTechnicien'
        ])->findOrFail($id);

        // Le technicien peut uniquement consulter
        // une maintenance qui lui est affectée.
        if (
            $user->role === 'technicien' &&
            (int) $maintenance->assigned_to !== (int) $user->id
        ) {
            return response()->json([
                'message' => 'Accès interdit. Cette maintenance ne vous est pas affectée.'
            ], 403);
        }

        return response()->json([
            'message' => 'Maintenance trouvée.',
            'data' => $maintenance,
        ], 200);
    }


    /**
     * =====================================================
     * MODIFIER UNE MAINTENANCE
     * =====================================================
     */
    public function update(Request $request, string $id)
    {
        $user = Auth::user();

        $maintenance = Maintenance::findOrFail($id);

        /**
         * -------------------------------------------------
         * TECHNICIEN
         * -------------------------------------------------
         */

        if ($user->role === 'technicien') {

            // Le technicien ne peut modifier
            // qu'une maintenance qui lui est affectée.
            if (
                (int) $maintenance->assigned_to !== (int) $user->id
            ) {
                return response()->json([
                    'message' => 'Accès interdit. Cette maintenance ne vous est pas affectée.'
                ], 403);
            }

            // Le technicien peut uniquement modifier le statut.
            $validated = $request->validate([
                'status' => [
                    'required',
                    'in:planifiee,en_cours,terminee'
                ],
            ]);
        }

        /**
         * -------------------------------------------------
         * ADMIN / SUPERADMIN
         * -------------------------------------------------
         */

        else {

            $validated = $request->validate([
                'equipement_id' => [
                    'sometimes',
                    'exists:equipements,id'
                ],

                'incident_id' => [
                    'sometimes',
                    'nullable',
                    'exists:incidents,id'
                ],

                'type' => [
                    'sometimes',
                    'in:preventive,corrective'
                ],

                'requested_by' => [
                    'sometimes',
                    'nullable',
                    'exists:users,id'
                ],

                'validated_by' => [
                    'sometimes',
                    'nullable',
                    'exists:users,id'
                ],

                'assigned_to' => [
                    'sometimes',
                    'nullable',
                    'exists:users,id'
                ],

                'status' => [
                    'sometimes',
                    'in:demandee,validee,planifiee,en_cours,terminee'
                ],

                'scheduled_at' => [
                    'sometimes',
                    'nullable',
                    'date'
                ],
            ]);
        }

        $maintenance->update($validated);

        return response()->json([
            'message' => 'Maintenance modifiée avec succès.',
            'data' => $maintenance->fresh()->load([
                'equipement',
                'incident',
                'requester',
                'validator',
                'assignedTechnicien'
            ]),
        ]);
    }


    /**
     * =====================================================
     * SUPPRIMER UNE MAINTENANCE
     * =====================================================
     */
    public function destroy(string $id)
    {
        $user = Auth::user();

        // Le technicien ne peut pas supprimer
        // une maintenance.
        if ($user->role === 'technicien') {
            return response()->json([
                'message' => 'Accès interdit. Les techniciens ne peuvent pas supprimer une maintenance.'
            ], 403);
        }

        $maintenance = Maintenance::findOrFail($id);

        $maintenance->delete();

        return response()->json([
            'message' => 'Maintenance supprimée avec succès.',
        ]);
    }
}