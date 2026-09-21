<?php

namespace App\Services;

use App\Models\Alerte;
use App\Models\Telemetrie;

class AlerteDetectionService
{
    /**
     * Détecter automatiquement les anomalies
     * à partir d'une télémétrie.
     *
     * Les types d'alertes générés respectent
     * le contrat SHANGO V3.0.
     */
    public function detecter(Telemetrie $telemetrie): void
    {
        // =================================================
        // 1. SURCHAUFFE
        // =================================================

        if (
            $telemetrie->temperature !== null &&
            $telemetrie->temperature >= 60
        ) {
            $this->creerAlerte(
                $telemetrie,
                'SURCHAUFFE',
                'ELEVEE',
                $telemetrie->temperature
            );
        }

        // =================================================
        // 2. TENSION FAIBLE
        // =================================================

        if (
            $telemetrie->tension !== null &&
            $telemetrie->tension < 10
        ) {
            $this->creerAlerte(
                $telemetrie,
                'TENSION_FAIBLE',
                'MOYENNE',
                $telemetrie->tension
            );
        }
    }

    /**
     * Créer une alerte automatiquement — sauf si une alerte du même type
     * est déjà active (statut "nouvelle" ou "en_cours") pour cet équipement.
     * Sans cette vérification, une condition qui persiste sur plusieurs
     * télémétries consécutives (ex. tension basse en continu) génère une
     * nouvelle ligne à chaque envoi au lieu de représenter une seule
     * anomalie en cours.
     */
    private function creerAlerte(
        Telemetrie $telemetrie,
        string $type,
        string $gravite,
        $valeur
    ): void {
        $dejaActive = Alerte::where('equipement_id', $telemetrie->equipement_id)
            ->where('type_alerte', $type)
            ->whereIn('statut', ['nouvelle', 'en_cours'])
            ->exists();

        if ($dejaActive) {
            return;
        }

        Alerte::create([
            'equipement_id' => $telemetrie->equipement_id,
            'device_id' => $telemetrie->device_id,
            'type_alerte' => $type,
            'gravite' => $gravite,
            'statut' => 'nouvelle',
            'valeur' => $valeur,
            'horodatage' => $telemetrie->horodatage,
        ]);
    }
}