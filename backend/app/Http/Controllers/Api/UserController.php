<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    /**
     * Afficher tous les utilisateurs.
     */
    public function index()
    {
        $users = User::with('organization')->get();

        return response()->json([
            'message' => 'Liste des utilisateurs',
            'data' => $users,
        ]);
    }

    /**
     * Créer un utilisateur.
     */
    public function store(Request $request)
    {
        $validated = $request->validate([
            'name' => 'required|string|max:255',
            'email' => 'required|email|unique:users,email',
            'password' => 'required|string|min:8',
            'role' => 'required|in:superadmin,admin,technicien',
            'organization_id' => 'nullable|exists:organizations,id',
            'phone' => 'nullable|string|max:30',
            'status' => 'nullable|in:actif,inactif',
        ]);

        $user = User::create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'role' => $validated['role'],
            'organization_id' => $validated['organization_id'] ?? null,
            'phone' => $validated['phone'] ?? null,
            'status' => $validated['status'] ?? 'actif',
        ]);

        return response()->json([
            'message' => 'Utilisateur créé avec succès.',
            'data' => $user,
        ], 201);
    }

    /**
     * Afficher un utilisateur.
     */
    public function show(string $id)
    {
        $user = User::with('organization')->findOrFail($id);

        return response()->json([
            'message' => 'Utilisateur trouvé.',
            'data' => $user,
        ]);
    }

    /**
     * Modifier un utilisateur.
     */
    public function update(Request $request, string $id)
    {
        $user = User::findOrFail($id);

        $validated = $request->validate([
            'name' => 'sometimes|string|max:255',
            'email' => 'sometimes|email|unique:users,email,' . $user->id,
            'password' => 'sometimes|string|min:8',
            'role' => 'sometimes|in:superadmin,admin,technicien',
            'organization_id' => 'nullable|exists:organizations,id',
            'phone' => 'nullable|string|max:30',
            'status' => 'sometimes|in:actif,inactif',
        ]);

        if (isset($validated['password'])) {
            $validated['password'] = Hash::make($validated['password']);
        }

        $user->update($validated);

        return response()->json([
            'message' => 'Utilisateur modifié avec succès.',
            'data' => $user,
        ]);
    }

    /**
     * Supprimer un utilisateur.
     */
    public function destroy(string $id)
    {
        $user = User::findOrFail($id);

        $user->delete();

        return response()->json([
            'message' => 'Utilisateur supprimé avec succès.',
        ]);
    }
}