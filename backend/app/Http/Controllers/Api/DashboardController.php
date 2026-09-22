<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Equipement;
use App\Models\Incident;
use App\Models\Maintenance;
use App\Models\Intervention;
use App\Models\Alerte;
use App\Models\User;

class DashboardController extends Controller
{
    public function index()
    {
        return response()->json([
            'success' => true,

            'statistiques' => [
                // Équipements
                'equipements_total' => Equipement::count(),
                'equipements_actifs' => Equipement::where('status', 'actif')->count(),
                'equipements_inactifs' => Equipement::where('status', '!=', 'actif')->count(),

                // État des kits IoT
                'equipements_en_marche' => Equipement::where('etat_kit', 'MARCHE')->count(),
                'equipements_bloques' => Equipement::where('etat_kit', 'BLOQUE')->count(),

                // Techniciens
                'techniciens_total' => User::where('role', 'technicien')->count(),
                'techniciens_actifs' => User::where('role', 'technicien')
                    ->where('status', 'actif')
                    ->count(),

                // Incidents
                'incidents_total' => Incident::count(),
                'incidents_en_attente' => Incident::where('status', 'en_attente')->count(),
                'incidents_en_cours' => Incident::where('status', 'en_cours')->count(),
                'incidents_resolus' => Incident::where('status', 'resolu')->count(),

                // Maintenances
                'maintenances_total' => Maintenance::count(),
                'maintenances_en_cours' => Maintenance::where('status', 'en_cours')->count(),
                'maintenances_terminees' => Maintenance::where('status', 'terminee')->count(),

                // Interventions
                'interventions_total' => Intervention::count(),

                // Alertes
                'alertes_total' => Alerte::count(),
                'alertes_nouvelles' => Alerte::where('statut', 'nouvelle')->count(),
                'alertes_en_cours' => Alerte::where('statut', 'en_cours')->count(),
                'alertes_resolues' => Alerte::where('statut', 'resolue')->count(),
            ],
        ], 200);
    }
}