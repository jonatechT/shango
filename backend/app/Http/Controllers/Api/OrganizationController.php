<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Organization;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class OrganizationController extends Controller
{
    /**
     * Afficher toutes les organisations.
     */
    public function index()
    {
        $organizations = Organization::with('users', 'equipements')->get();

        return response()->json([
            'message' => 'Liste des organisations',
            'data' => $organizations,
        ]);
    }

    /**
     * Créer une organisation.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',

            'code' => [
                'nullable',
                'string',
                'max:50',
                'unique:organizations,code',
            ],

            'description' => 'nullable|string',

            'email' => 'nullable|email|max:255',

            'phone' => 'nullable|string|max:30',

            'address' => 'nullable|string|max:255',

            'city' => 'nullable|string|max:255',

            'country' => 'nullable|string|max:255',

            'status' => 'required|in:active,inactive',
        ]);

        $organization = Organization::create($validated);

        return response()->json([
            'message' => 'Organisation créée avec succès.',
            'data' => $organization,
        ], 201);
    }

    /**
     * Afficher une organisation.
     */
    public function show(string $id)
    {
        $organization = Organization::with('users', 'equipements')
            ->findOrFail($id);

        return response()->json([
            'message' => 'Organisation trouvée.',
            'data' => $organization,
        ]);
    }

    /**
     * Modifier une organisation.
     */
    public function update(Request $request, string $id)
    {
        $organization = Organization::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',

            'code' => [
                'sometimes',
                'nullable',
                'string',
                'max:50',
                Rule::unique('organizations', 'code')
                    ->ignore($organization->id),
            ],

            'description' => 'sometimes|nullable|string',

            'email' => 'sometimes|nullable|email|max:255',

            'phone' => 'sometimes|nullable|string|max:30',

            'address' => 'sometimes|nullable|string|max:255',

            'city' => 'sometimes|nullable|string|max:255',

            'country' => 'sometimes|nullable|string|max:255',

            'status' => 'sometimes|in:active,inactive',
        ]);

        $organization->update($validated);

        return response()->json([
            'message' => 'Organisation modifiée avec succès.',
            'data' => $organization,
        ]);
    }

    /**
     * Supprimer une organisation.
     */
    public function destroy(string $id)
    {
        $organization = Organization::findOrFail($id);

        $organization->delete();

        return response()->json([
            'message' => 'Organisation supprimée avec succès.',
        ]);
    }
}