<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Localisation;
use Illuminate\Http\Request;

class LocalisationController extends Controller
{
    /**
     * Liste des localisations.
     */
    public function index()
    {
        $localisations = Localisation::with('equipement')
            ->latest('captured_at')
            ->get();

        return response()->json([
            'message' => 'Liste des localisations',
            'data' => $localisations,
        ]);
    }

    /**
     * Enregistrer une nouvelle localisation.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'equipement_id' => ['required', 'exists:equipements,id'],
            'latitude' => ['required', 'numeric', 'between:-90,90'],
            'longitude' => ['required', 'numeric', 'between:-180,180'],
            'source' => ['nullable', 'in:gps,gsm,manuelle'],
            'captured_at' => ['nullable', 'date'],
        ]);

        $localisation = Localisation::create($validated);

        return response()->json([
            'message' => 'Localisation enregistrée avec succès.',
            'data' => $localisation->load('equipement'),
        ], 201);
    }

    /**
     * Afficher une localisation.
     */
    public function show(string $id)
    {
        $localisation = Localisation::with('equipement')->findOrFail($id);

        return response()->json([
            'message' => 'Localisation trouvée.',
            'data' => $localisation,
        ]);
    }

    /**
     * Modifier une localisation.
     */
    public function update(Request $request, string $id)
    {
        $localisation = Localisation::findOrFail($id);

        $validated = $request->validate([
            'equipement_id' => ['sometimes', 'exists:equipements,id'],
            'latitude' => ['sometimes', 'numeric', 'between:-90,90'],
            'longitude' => ['sometimes', 'numeric', 'between:-180,180'],
            'source' => ['sometimes', 'in:gps,gsm,manuelle'],
            'captured_at' => ['sometimes', 'date'],
        ]);

        $localisation->update($validated);

        return response()->json([
            'message' => 'Localisation modifiée avec succès.',
            'data' => $localisation->load('equipement'),
        ]);
    }

    /**
     * Supprimer une localisation.
     */
    public function destroy(string $id)
    {
        $localisation = Localisation::findOrFail($id);

        $localisation->delete();

        return response()->json([
            'message' => 'Localisation supprimée avec succès.',
        ]);
    }
}