<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class RoleMiddleware
{
    /**
     * Vérifier que l'utilisateur possède
     * l'un des rôles autorisés.
     */
    public function handle(
        Request $request,
        Closure $next,
        ...$roles
    ): Response {

        // Vérifier que l'utilisateur est connecté.
        if (!$request->user()) {
            return response()->json([
                'message' => 'Utilisateur non authentifié.'
            ], 401);
        }

        // Récupérer l'utilisateur connecté.
        $user = $request->user();

        // Vérifier si son rôle fait partie
        // des rôles autorisés pour cette route.
        if (!in_array($user->role, $roles)) {
            return response()->json([
                'message' => 'Accès interdit. Vous n’avez pas les permissions nécessaires.'
            ], 403);
        }

        return $next($request);
    }
}