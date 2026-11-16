<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\PredictionBatterie;
use App\Models\Telemetrie;
use App\Services\BatterieCalculService;
use App\Services\BatterieIAService;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Throwable;

/**
 * Diagnostic batterie (document 3, partie 1 — backend) :
 * reçoit les mesures, convertit la tension (÷4), interroge le modèle IA,
 * calcule SOH / capacité / durée de vie / état / message, puis ENREGISTRE
 * chaque prédiction : c'est ce qui construit l'historique de la batterie.
 */
class BatterieDiagnosticController extends Controller
{
    public function __construct(
        private readonly BatterieIAService $serviceIA,
        private readonly BatterieCalculService $calcul
    ) {
    }

    /**
     * POST /api/batterie/diagnostic — mesures envoyées par le boîtier (§3).
     * `dod_percent` est facultatif : s'il manque, il est estimé depuis la tension.
     */
    public function store(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'device_id' => ['required', 'string', 'max:191'],
            'voltage_v' => ['required', 'numeric'],
            'current_a' => ['required', 'numeric'],
            'temperature_c' => ['required', 'numeric'],
            'dod_percent' => ['nullable', 'numeric', 'min:0', 'max:100'],
        ]);

        return $this->diagnostiquer(
            trim($validated['device_id']),
            (float) $validated['voltage_v'],
            (float) $validated['current_a'],
            (float) $validated['temperature_c'],
            isset($validated['dod_percent']) ? (float) $validated['dod_percent'] : null
        );
    }

    /**
     * POST /api/batteries/{device_id}/diagnostic — bouton « Lancer un
     * diagnostic » de la page détail : utilise la dernière télémétrie reçue
     * du boîtier comme mesures d'entrée.
     */
    public function lancer(string $device_id): JsonResponse
    {
        $telemetrie = Telemetrie::where('device_id', $device_id)
            ->orderBy('horodatage', 'desc')
            ->first();

        if (!$telemetrie) {
            return response()->json([
                'success' => false,
                'message' => 'Aucune télémétrie reçue pour ce boîtier : impossible de lancer le diagnostic.',
            ], 404);
        }

        if ($telemetrie->tension === null) {
            return response()->json([
                'success' => false,
                'message' => 'La dernière télémétrie ne contient pas de tension batterie : diagnostic impossible.',
            ], 422);
        }

        return $this->diagnostiquer(
            $device_id,
            (float) $telemetrie->tension,
            (float) ($telemetrie->courant ?? 0),
            // Le DHT22 du boîtier mesure l'air autour de la batterie ; 25 °C
            // (température de référence des fiches LiFePO4) s'il est absent.
            (float) ($telemetrie->temperature ?? 25),
            null,
            [
                'humidite_pourcent' => $telemetrie->humidite !== null ? (float) $telemetrie->humidite : null,
                'statut_paiement' => $telemetrie->statut_paiement,
            ]
        );
    }

    /**
     * GET /api/batteries/{device_id}/diagnostics — historique complet (§7, §8),
     * du plus récent au plus ancien, avec les informations dérivées.
     */
    public function history(string $device_id): JsonResponse
    {
        $historique = PredictionBatterie::where('device_id', $device_id)
            ->orderBy('date_heure', 'desc')
            ->get()
            ->map(fn (PredictionBatterie $p) => $this->formater($this->completer($p)))
            ->values();

        return response()->json([
            'success' => true,
            'device_id' => $device_id,
            'nombre_diagnostics' => $historique->count(),
            'historique' => $historique,
        ], 200);
    }

    /**
     * Chaîne complète du document : conversion → IA → calculs → enregistrement.
     */
    private function diagnostiquer(
        string $deviceId,
        float $voltage,
        float $current,
        float $temperature,
        ?float $dodRecu,
        array $complements = []
    ): JsonResponse {
        // §4 — DoD (reçu ou estimé) et tension par cellule pour le modèle.
        [$dod, $sourceDod] = $this->calcul->resoudreDod($dodRecu, $voltage);
        $voltageCellule = $this->calcul->tensionParCellule($voltage);

        // §5 — Prédiction IA (la conversion ÷4 est refaite côté FastAPI,
        // qui reçoit la tension brute du pack).
        try {
            $resultatIA = $this->serviceIA->predire($deviceId, $voltage, $current, $temperature, $dod);
        } catch (Throwable $e) {
            return response()->json([
                'success' => false,
                'message' => 'Le service IA de diagnostic est injoignable. Vérifiez qu\'il est démarré, puis réessayez.',
                'erreur' => $e->getMessage(),
            ], 503);
        }

        $sohClass = $resultatIA['soh_class'] ?? null;
        $sohClassId = isset($resultatIA['soh_class_id']) ? (int) $resultatIA['soh_class_id'] : null;
        $sohProbabilities = $resultatIA['soh_probabilities'] ?? null;
        $confidence = isset($resultatIA['confidence']) ? (float) $resultatIA['confidence'] : null;
        $rulCycles = isset($resultatIA['rul_cycles']) ? (int) $resultatIA['rul_cycles'] : null;

        // §6 — Informations dérivées.
        $derivees = $this->calcul->informationsDerivees($sohProbabilities, $sohClass, $sohClassId, $rulCycles);

        // §7 — Enregistrement (tension BRUTE conservée).
        $prediction = PredictionBatterie::create([
            'device_id' => $deviceId,
            'date_heure' => now(),
            'voltage_v' => $voltage,
            'current_a' => $current,
            'temperature_c' => $temperature,
            'dod_percent' => $dod,
            'soh_pourcent' => $derivees['soh_pourcent'],
            'capacite_ah' => $derivees['capacite_ah'],
            'rul_jours' => $derivees['rul_jours'],
            'etat' => $derivees['etat'],
            'soh_class' => $sohClass,
            'soh_class_id' => $sohClassId,
            'soh_probabilities' => $sohProbabilities,
            'confidence' => $confidence,
            'rul_cycles' => $rulCycles,
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Diagnostic batterie effectué avec succès.',
            'data' => array_merge($this->formater($prediction), $complements, [
                'dod_source' => $sourceDod,
                'voltage_par_cellule' => round($voltageCellule, 3),
            ]),
        ], 200);
    }

    /**
     * Anciennes lignes enregistrées sans informations dérivées (SOH null) :
     * on les calcule à partir des résultats IA stockés et on les persiste.
     */
    private function completer(PredictionBatterie $p): PredictionBatterie
    {
        if ($p->soh_pourcent !== null || ($p->soh_class === null && $p->soh_class_id === null)) {
            return $p;
        }

        $derivees = $this->calcul->informationsDerivees(
            $p->soh_probabilities,
            $p->soh_class,
            $p->soh_class_id,
            $p->rul_cycles
        );

        $p->fill($derivees);
        $p->save();

        return $p;
    }

    /** Ligne d'historique + message technicien et alerte de surchauffe. */
    private function formater(PredictionBatterie $p): array
    {
        $etat = $p->etat ?? ($p->soh_pourcent !== null ? $this->calcul->etat((float) $p->soh_pourcent) : null);

        return array_merge($p->toArray(), [
            'date_heure' => $p->date_heure?->toIso8601String(),
            'etat' => $etat,
            'rul_jours' => $p->rul_jours !== null ? (int) $p->rul_jours : null,
            'capacite_nominale_ah' => BatterieCalculService::CAPACITE_NOMINALE_AH,
            'message' => $this->calcul->message($etat, $p->temperature_c),
            'alerte_surchauffe' => $this->calcul->surchauffe($p->temperature_c),
        ]);
    }
}
