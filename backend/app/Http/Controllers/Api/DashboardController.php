<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Equipement;
use App\Models\Incident;
use App\Models\Maintenance;
use App\Models\Intervention;
use App\Models\Alerte;

class DashboardController extends Controller
{
    /**
     * Statistiques générales du Dashboard
     */
    public function index()
    {
        return response()->json([
            'success' => true,

            'statistiques' => [

                // =================================================
                // ÉQUIPEMENTS
                // =================================================

                'equipements_total' => Equipement::count(),

                'equipements_actifs' => Equipement::where('status', 'actif')
                    ->count(),


                // =================================================
                // INCIDENTS
                // =================================================

                'incidents_total' => Incident::count(),

                'incidents_en_attente' => Incident::where('status', 'en_attente')
                    ->count(),

                'incidents_en_cours' => Incident::where('status', 'en_cours')
                    ->count(),

                'incidents_resolus' => Incident::where('status', 'resolu')
                    ->count(),


                // =================================================
                // MAINTENANCES
                // =================================================

                'maintenances_total' => Maintenance::count(),

                'maintenances_en_cours' => Maintenance::where('status', 'en_cours')
                    ->count(),

                'maintenances_terminees' => Maintenance::where('status', 'terminee')
                    ->count(),


                // =================================================
                // INTERVENTIONS
                // =================================================

                'interventions_total' => Intervention::count(),


                // =================================================
                // ALERTES
                // =================================================

                // Attention : la table alertes utilise "statut"
                'alertes_total' => Alerte::count(),
            ],
        ], 200);
    }
}