<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Equipement;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\Rule;

class EquipementController extends Controller
{
    /**
     * =====================================================
     * LISTE DES ÉQUIPEMENTS
     * =====================================================
     */
    public function index()
    {
        $user = request()->user();

        $query = Equipement::with([
            'organization',
            'technicien'
        ]);

        // Un technicien voit seulement ses équipements.
        if ($user->role === 'technicien') {
            $query->where('technicien_id', $user->id);
        }

        $equipements = $query->latest()->get();

        return response()->json([
            'message' => 'Liste des équipements',
            'data' => $equipements
        ]);
    }


    /**
     * =====================================================
     * CRÉER UN ÉQUIPEMENT
     * =====================================================
     */
    public function store(Request $request)
    {
        $validated = $request->validate([

            // Organisation
            'organization_id' => [
                'required',
                'exists:organizations,id'
            ],

            // Type
            'type' => [
                'required',
                'string',
                'max:255'
            ],

            // Référence unique
            'reference' => [
                'required',
                'string',
                'max:255',
                'unique:equipements,reference'
            ],

            // Informations générales
            'nom' => [
                'nullable',
                'string',
                'max:255'
            ],

            'description' => [
                'nullable',
                'string'
            ],

            // Client
            'client_nom' => [
                'nullable',
                'string',
                'max:255'
            ],

            'client_numero' => [
                'nullable',
                'string',
                'max:30'
            ],

            // Marque / modèle
            'marque_modele' => [
                'nullable',
                'string',
                'max:255'
            ],

            // Site
            'site' => [
                'nullable',
                'string',
                'max:255'
            ],

            // Vraie image
            'photo' => [
                'nullable',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:5120'
            ],

            // Périmètre
            'perimetre_metres' => [
                'nullable',
                'numeric',
                'min:0'
            ],

            // Device ID
            'device_id' => [
                'required',
                'string',
                'max:255',
                'unique:equipements,device_id'
            ],

            // Technicien
            'technicien_id' => [
                'nullable',
                Rule::exists('users', 'id')->where(function ($query) {
                    $query->where('role', 'technicien')
                          ->where('status', 'actif');
                })
            ],

            // Statut
            'status' => [
                'required',
                Rule::in([
                    'actif',
                    'en_panne',
                    'maintenance',
                    'hors_service'
                ])
            ],

            // État du kit
            'etat_kit' => [
                'nullable',
                Rule::in([
                    'MARCHE',
                    'BLOQUE'
                ])
            ],

            // Date d'installation
            'installed_at' => [
                'nullable',
                'date'
            ],
        ]);

        // =================================================
        // UPLOAD DE LA PHOTO
        // =================================================

        if ($request->hasFile('photo')) {
            $validated['photo'] = $request
                ->file('photo')
                ->store('equipements', 'public');
        }

        // =================================================
        // CRÉATION
        // =================================================

        $equipement = Equipement::create($validated);

        return response()->json([
            'message' => 'Équipement créé avec succès.',
            'data' => $equipement->load([
                'organization',
                'technicien'
            ])
        ], 201);
    }


    /**
     * =====================================================
     * AFFICHER UN ÉQUIPEMENT
     * =====================================================
     */
    public function show(string $id)
    {
        $equipement = Equipement::with([
            'organization',
            'technicien',
            'localisations',
            'incidents',
            'maintenances',
            'interventions'
        ])->findOrFail($id);

        $user = request()->user();

        // Un technicien ne peut voir que son propre équipement.
        if (
            $user->role === 'technicien' &&
            (int) $equipement->technicien_id !== (int) $user->id
        ) {
            return response()->json([
                'message' => 'Accès interdit. Cet équipement ne vous est pas affecté.'
            ], 403);
        }

        return response()->json([
            'message' => 'Équipement trouvé.',
            'data' => $equipement
        ]);
    }


    /**
     * =====================================================
     * MODIFIER UN ÉQUIPEMENT
     * =====================================================
     */
    public function update(Request $request, string $id)
    {
        $equipement = Equipement::findOrFail($id);

        $validated = $request->validate([

            // Organisation
            'organization_id' => [
                'sometimes',
                'exists:organizations,id'
            ],

            // Type
            'type' => [
                'sometimes',
                'string',
                'max:255'
            ],

            // Référence
            'reference' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('equipements', 'reference')
                    ->ignore($equipement->id)
            ],

            // Informations générales
            'nom' => [
                'sometimes',
                'nullable',
                'string',
                'max:255'
            ],

            'description' => [
                'sometimes',
                'nullable',
                'string'
            ],

            // Client
            'client_nom' => [
                'sometimes',
                'nullable',
                'string',
                'max:255'
            ],

            'client_numero' => [
                'sometimes',
                'nullable',
                'string',
                'max:30'
            ],

            // Marque / modèle
            'marque_modele' => [
                'sometimes',
                'nullable',
                'string',
                'max:255'
            ],

            // Site
            'site' => [
                'sometimes',
                'nullable',
                'string',
                'max:255'
            ],

            // Nouvelle photo
            'photo' => [
                'sometimes',
                'nullable',
                'image',
                'mimes:jpg,jpeg,png,webp',
                'max:5120'
            ],

            // Périmètre
            'perimetre_metres' => [
                'sometimes',
                'nullable',
                'numeric',
                'min:0'
            ],

            // Device ID
            'device_id' => [
                'sometimes',
                'string',
                'max:255',
                Rule::unique('equipements', 'device_id')
                    ->ignore($equipement->id)
            ],

            // Technicien
            'technicien_id' => [
                'sometimes',
                'nullable',
                Rule::exists('users', 'id')->where(function ($query) {
                    $query->where('role', 'technicien')
                          ->where('status', 'actif');
                })
            ],

            // Statut
            'status' => [
                'sometimes',
                Rule::in([
                    'actif',
                    'en_panne',
                    'maintenance',
                    'hors_service'
                ])
            ],

            // État du kit
            'etat_kit' => [
                'sometimes',
                'nullable',
                Rule::in([
                    'MARCHE',
                    'BLOQUE'
                ])
            ],

            // Date d'installation
            'installed_at' => [
                'sometimes',
                'nullable',
                'date'
            ],
        ]);

        // =================================================
        // GESTION DE LA NOUVELLE PHOTO
        // =================================================

        if ($request->hasFile('photo')) {

            // Supprimer l'ancienne photo si elle existe
            if (
                $equipement->photo &&
                Storage::disk('public')->exists($equipement->photo)
            ) {
                Storage::disk('public')->delete($equipement->photo);
            }

            // Enregistrer la nouvelle photo
            $validated['photo'] = $request
                ->file('photo')
                ->store('equipements', 'public');
        }

        // =================================================
        // MISE À JOUR
        // =================================================

        $equipement->update($validated);

        return response()->json([
            'message' => 'Équipement modifié avec succès.',
            'data' => $equipement->fresh()->load([
                'organization',
                'technicien'
            ])
        ]);
    }


    /**
     * =====================================================
     * SUPPRIMER UN ÉQUIPEMENT
     * =====================================================
     */
    public function destroy(string $id)
    {
        $equipement = Equipement::findOrFail($id);

        // Supprimer également la photo associée
        if (
            $equipement->photo &&
            Storage::disk('public')->exists($equipement->photo)
        ) {
            Storage::disk('public')->delete($equipement->photo);
        }

        $equipement->delete();

        return response()->json([
            'message' => 'Équipement supprimé avec succès.'
        ]);
    }
}