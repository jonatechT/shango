<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Commande;
use App\Models\Equipement;
use App\Services\BridgeService;
use Illuminate\Http\Request;

class CommandeController extends Controller
{
    /**
     * =====================================================
     * ENVOYER UNE COMMANDE À UN BOÎTIER IoT
     * =====================================================
     *
     * Endpoint :
     * POST /api/commande
     */
    public function store(Request $request, BridgeService $bridgeService)
    {
        // =================================================
        // 1. VALIDATION
        // =================================================

        $validated = $request->validate([
            'id_appareil' => 'required|string|max:255',

            'commande' => 'required|string|in:BLOQUER,DEBLOQUER',

            'emis_par' => 'required|string|max:100',

            'raison' => 'nullable|string|max:255',
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
        // 3. VÉRIFIER LES DROITS DU TECHNICIEN
        // =================================================

        $user = request()->user();

        if (
            $user->role === 'technicien' &&
            (int) $equipement->technicien_id !== (int) $user->id
        ) {
            return response()->json([
                'success' => false,
                'message' => 'Accès interdit. Cet équipement ne vous est pas affecté.'
            ], 403);
        }

        // =================================================
        // 4. PRÉPARER LA COMMANDE POUR LE BRIDGE
        // =================================================

        $commandeBridge = [
            'id_appareil' => $validated['id_appareil'],
            'commande' => $validated['commande'],
            'emis_par' => $validated['emis_par'],
            'raison' => $validated['raison'] ?? null,
            'horodatage' => time(),
        ];

        // =================================================
        // 5. ENVOYER AU BRIDGE
        // =================================================

        try {
            $responseBridge = $bridgeService->envoyerCommande(
                $commandeBridge
            );
        } catch (\Throwable $e) {

            $commande = Commande::create([
                'equipement_id' => $equipement->id,
                'device_id' => $equipement->device_id,
                'commande' => $validated['commande'],
                'emis_par' => $validated['emis_par'],
                'raison' => $validated['raison'] ?? null,
                'statut' => 'echouee',
                'reponse_bridge' => $e->getMessage(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'Impossible de contacter le Bridge MQTT.',
                'data' => $commande,
            ], 502);
        }

        // =================================================
        // 6. DÉTERMINER LE STATUT
        // =================================================

        $statut = $responseBridge->successful()
            ? 'transmise'
            : 'echouee';

        // =================================================
        // 7. ENREGISTRER LA COMMANDE
        // =================================================

        $commande = Commande::create([
            'equipement_id' => $equipement->id,
            'device_id' => $equipement->device_id,
            'commande' => $validated['commande'],
            'emis_par' => $validated['emis_par'],
            'raison' => $validated['raison'] ?? null,
            'statut' => $statut,
            'reponse_bridge' => $responseBridge->body(),
        ]);

        // =================================================
        // 8. SI LE BRIDGE REFUSE LA COMMANDE
        // =================================================

        if (!$responseBridge->successful()) {
            return response()->json([
                'success' => false,
                'message' => 'Le Bridge MQTT a refusé la commande.',
                'bridge_status' => $responseBridge->status(),
                'data' => $commande,
            ], 502);
        }

        // =================================================
        // 9. RÉPONSE FINALE
        // =================================================

        return response()->json([
            'success' => true,
            'message' => 'Commande reçue et transmise au Bridge MQTT avec succès.',
            'data' => $commande,
        ], 201);
    }

    /**
     * =====================================================
     * LISTE DES COMMANDES
     * =====================================================
     *
     * Endpoint :
     * GET /api/commandes
     *
     * Superadmin et admin :
     * voient les commandes globales.
     *
     * Technicien :
     * voit uniquement les commandes des équipements
     * qui lui sont affectés.
     */
    public function index()
    {
        $user = request()->user();

        $query = Commande::with('equipement');

        // =================================================
        // FILTRAGE POUR LE TECHNICIEN
        // =================================================

        if ($user->role === 'technicien') {
            $query->whereHas('equipement', function ($q) use ($user) {
                $q->where('technicien_id', $user->id);
            });
        }

        $commandes = $query
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Liste des commandes récupérée avec succès.',
            'data' => $commandes,
        ]);
    }

    /**
     * =====================================================
     * HISTORIQUE DES COMMANDES D'UN ÉQUIPEMENT
     * =====================================================
     *
     * Endpoint :
     * GET /api/equipements/{equipement}/commandes
     */
    public function equipementCommandes($equipementId)
    {
        // =================================================
        // 1. RECHERCHER L'ÉQUIPEMENT
        // =================================================

        $equipement = Equipement::find($equipementId);

        if (!$equipement) {
            return response()->json([
                'message' => 'Ressource introuvable.'
            ], 404);
        }

        // =================================================
        // 2. VÉRIFIER LES DROITS DU TECHNICIEN
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
        // 3. RÉCUPÉRER LES COMMANDES
        // =================================================

        $commandes = Commande::where(
            'equipement_id',
            $equipementId
        )
            ->orderBy('created_at', 'desc')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Historique des commandes récupéré avec succès.',
            'data' => $commandes,
        ]);
    }
}