<?php

use Illuminate\Support\Facades\Route;

// =====================================================
// CONTROLLERS
// =====================================================

use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\OrganizationController;
use App\Http\Controllers\Api\EquipementController;
use App\Http\Controllers\Api\LocalisationController;
use App\Http\Controllers\Api\IncidentController;
use App\Http\Controllers\Api\MaintenanceController;
use App\Http\Controllers\Api\InterventionController;
use App\Http\Controllers\Api\TelemetrieController;
use App\Http\Controllers\Api\AlerteController;
use App\Http\Controllers\Api\CommandeController;
use App\Http\Controllers\Api\BatterieDiagnosticController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\StatusController;


// =====================================================
// AUTHENTIFICATION
// =====================================================

// Connexion
Route::post('/login', [AuthController::class, 'login'])
    ->name('login');


// =====================================================
// TÉLÉMÉTRIE - BOÎTIERS IoT
// =====================================================

// Réception des données envoyées par le boîtier IoT / Bridge
Route::post('/telemetrie', [TelemetrieController::class, 'store'])
    ->name('telemetrie.store')
    ->middleware('shango.api');


// =====================================================
// ALERTES - BOÎTIERS IoT
// =====================================================

// Réception des alertes envoyées par le Bridge IoT
Route::post('/alertes', [AlerteController::class, 'store'])
    ->middleware('shango.api')
    ->name('alertes.store');


// =====================================================
// STATUS - BOÎTIERS IoT
// =====================================================

// Réception du statut opérationnel envoyé par le Bridge IoT
Route::post('/status', [StatusController::class, 'store'])
    ->middleware('shango.api')
    ->name('status.store');

// État commandé du boîtier (polling) — le Bridge interroge pour savoir
// s'il doit bloquer/débloquer physiquement le relais.
Route::get('/status/{device_id}', [StatusController::class, 'show'])
    ->middleware('shango.api')
    ->name('status.show');


// =====================================================
// ROUTES PROTÉGÉES
// =====================================================

Route::middleware('auth:sanctum')->group(function () {

    // =================================================
    // UTILISATEUR CONNECTÉ
    // =================================================

    Route::get('/me', [AuthController::class, 'me'])
        ->name('me');


    // =================================================
    // DASHBOARD
    // SUPERADMIN + ADMIN + TECHNICIEN
    // =================================================

    Route::get('/dashboard', [DashboardController::class, 'index'])
        ->name('dashboard.index');


    // =================================================
    // DÉCONNEXION
    // =================================================

    Route::post('/logout', [AuthController::class, 'logout'])
        ->name('logout');


    // =================================================
    // DIAGNOSTIC BATTERIE - IA
    // SUPERADMIN + ADMIN + TECHNICIEN
    // =================================================

    Route::middleware('role:superadmin,admin,technicien')->group(function () {

        Route::post('/batterie/diagnostic', [BatterieDiagnosticController::class, 'store'])
            ->name('batterie.diagnostic');

        Route::get('/batteries/{device_id}/diagnostics', [BatterieDiagnosticController::class, 'history'])
            ->name('batteries.diagnostics.history');
    });


    // =====================================================
    // SUPERADMIN + ADMIN
    // =====================================================

    Route::middleware('role:superadmin,admin')->group(function () {

        // =================================================
        // UTILISATEURS
        // =================================================

        Route::apiResource('users', UserController::class);


        // =================================================
        // ORGANISATIONS
        // =================================================

        Route::apiResource('organizations', OrganizationController::class);


        // =================================================
        // ÉQUIPEMENTS - ADMINISTRATION
        // =================================================

        Route::post('/equipements', [EquipementController::class, 'store'])
            ->name('equipements.store');

        Route::put('/equipements/{equipement}', [EquipementController::class, 'update'])
            ->name('equipements.update');

        Route::patch('/equipements/{equipement}', [EquipementController::class, 'update']);

        Route::delete('/equipements/{equipement}', [EquipementController::class, 'destroy'])
            ->name('equipements.destroy');


        // =================================================
        // LOCALISATIONS - ADMINISTRATION
        // =================================================

        Route::post('/localisations', [LocalisationController::class, 'store'])
            ->name('localisations.store');

        Route::put('/localisations/{localisation}', [LocalisationController::class, 'update'])
            ->name('localisations.update');

        Route::patch('/localisations/{localisation}', [LocalisationController::class, 'update']);

        Route::delete('/localisations/{localisation}', [LocalisationController::class, 'destroy'])
            ->name('localisations.destroy');


        // =================================================
        // INCIDENTS - ADMINISTRATION
        // =================================================

        Route::post('/incidents', [IncidentController::class, 'store'])
            ->name('incidents.store');

        Route::put('/incidents/{incident}', [IncidentController::class, 'update'])
            ->name('incidents.update');

        Route::patch('/incidents/{incident}', [IncidentController::class, 'update']);

        Route::delete('/incidents/{incident}', [IncidentController::class, 'destroy'])
            ->name('incidents.destroy');


        // =================================================
        // MAINTENANCES - ADMINISTRATION
        // =================================================

        Route::post('/maintenances', [MaintenanceController::class, 'store'])
            ->name('maintenances.store');

        Route::delete('/maintenances/{maintenance}', [MaintenanceController::class, 'destroy'])
            ->name('maintenances.destroy');
    });


    // =====================================================
    // CONSULTATION DES ÉQUIPEMENTS
    // SUPERADMIN + ADMIN + TECHNICIEN
    // =====================================================

    Route::middleware('role:superadmin,admin,technicien')->group(function () {

        Route::get('/equipements', [EquipementController::class, 'index'])
            ->name('equipements.index');

        Route::get('/equipements/{equipement}', [EquipementController::class, 'show'])
            ->name('equipements.show');
    });


    // =====================================================
    // INCIDENTS
    // SUPERADMIN + ADMIN + TECHNICIEN
    // =====================================================

    Route::middleware('role:superadmin,admin,technicien')->group(function () {

        Route::get('/incidents', [IncidentController::class, 'index'])
            ->name('incidents.index');

        Route::get('/incidents/{incident}', [IncidentController::class, 'show'])
            ->name('incidents.show');

        Route::patch('/incidents/{incident}/status', [IncidentController::class, 'updateStatus'])
            ->name('incidents.updateStatus');
    });


    // =====================================================
    // MAINTENANCES
    // SUPERADMIN + ADMIN + TECHNICIEN
    // =====================================================

    Route::middleware('role:superadmin,admin,technicien')->group(function () {

        Route::get('/maintenances', [MaintenanceController::class, 'index'])
            ->name('maintenances.index');

        Route::get('/maintenances/{maintenance}', [MaintenanceController::class, 'show'])
            ->name('maintenances.show');

        Route::put('/maintenances/{maintenance}', [MaintenanceController::class, 'update'])
            ->name('maintenances.update');

        Route::patch('/maintenances/{maintenance}', [MaintenanceController::class, 'update']);
    });


    // =====================================================
    // INTERVENTIONS
    // SUPERADMIN + ADMIN + TECHNICIEN
    // =====================================================

    Route::middleware('role:superadmin,admin,technicien')->group(function () {

        Route::apiResource('interventions', InterventionController::class);
    });


    // =====================================================
    // LOCALISATIONS - LECTURE
    // SUPERADMIN + ADMIN + TECHNICIEN
    // =====================================================

    Route::middleware('role:superadmin,admin,technicien')->group(function () {

        Route::get('/localisations', [LocalisationController::class, 'index'])
            ->name('localisations.index');

        Route::get('/localisations/{localisation}', [LocalisationController::class, 'show'])
            ->name('localisations.show');
    });


    // =====================================================
    // TÉLÉMÉTRIES - CONSULTATION
    // SUPERADMIN + ADMIN + TECHNICIEN
    // =====================================================

    Route::middleware('role:superadmin,admin,technicien')->group(function () {

        Route::get('/telemetries', [TelemetrieController::class, 'index'])
            ->name('telemetries.index');

        Route::get(
            '/equipements/{equipement}/telemetries',
            [TelemetrieController::class, 'equipementTelemetries']
        )->name('equipements.telemetries');
    });


    // =====================================================
    // ALERTES - CONSULTATION
    // SUPERADMIN + ADMIN + TECHNICIEN
    // =====================================================

    Route::middleware('role:superadmin,admin,technicien')->group(function () {

        Route::get('/alertes', [AlerteController::class, 'index'])
            ->name('alertes.index');

        Route::get(
            '/equipements/{equipement}/alertes',
            [AlerteController::class, 'equipementAlertes']
        )->name('equipements.alertes');

        Route::patch(
            '/alertes/{alerte}/status',
            [AlerteController::class, 'updateStatus']
        )->name('alertes.updateStatus');
    });


    // =====================================================
    // COMMANDES
    // SUPERADMIN + ADMIN + TECHNICIEN
    // =====================================================

    Route::middleware('role:superadmin,admin,technicien')->group(function () {

        Route::post('/commande', [CommandeController::class, 'store'])
            ->name('commande.store');

        Route::get('/commandes', [CommandeController::class, 'index'])
            ->name('commandes.index');

        Route::get(
            '/equipements/{equipement}/commandes',
            [CommandeController::class, 'equipementCommandes']
        )->name('equipements.commandes');
    });

});