<?php

namespace App\Services;

/**
 * Calculs batterie du projet SHANGO — kit Alioth (LiFePO4 4S, 12,8 V, 24 Ah).
 *
 * Règles reprises du document « 3 — Backend et Frontend de l'application web » :
 *   §4  tension par cellule = tension du pack ÷ 4 (le modèle IA travaille à la cellule)
 *   §6  capacité restante (Ah) = SOH / 100 × 24
 *       durée de vie (jours)   = cycles restants / 1 (1 cycle par jour)
 *       état / message         = seuils USABC + Heliyon 2024 :
 *                                SOH ≥ 80 → Bon, 70–80 → Surveiller, < 70 → À remplacer
 *   §9  alerte visuelle en cas de surchauffe
 *
 * Le boîtier ne transmet pas encore le DoD : il est alors estimé à partir de
 * la tension par cellule (courbe tension à vide / état de charge LiFePO4).
 */
class BatterieCalculService
{
    /** Nombre de cellules en série de la batterie Alioth (12,8 V / 3,2 V). */
    public const N_CELLULES = 4;

    /** Capacité nominale de la batterie Alioth (Ah). */
    public const CAPACITE_NOMINALE_AH = 24.0;

    /** Hypothèse d'usage du document : 1 cycle de charge/décharge par jour. */
    public const CYCLES_PAR_JOUR = 1;

    /** Au-delà, la température est considérée comme une surchauffe (°C). */
    public const SEUIL_SURCHAUFFE_C = 45.0;

    /** Seuils SOH (%) — USABC (fin de vie à 80 %) et Heliyon 2024 (70–80 %). */
    public const SEUIL_SOH_BON = 80.0;
    public const SEUIL_SOH_SURVEILLER = 70.0;

    public const ETAT_BON = 'Bon';
    public const ETAT_SURVEILLER = 'Surveiller';
    public const ETAT_A_REMPLACER = 'À remplacer';

    /**
     * Courbe tension à vide (V par cellule) → état de charge (%) d'une
     * cellule LiFePO4, triée par tension décroissante. Valeurs usuelles des
     * fabricants pour un pack 4S 12,8 V (13,6 V = 100 %, 12,0 V = 9 %,
     * 10,0 V = 0 %) ramenées à la cellule.
     */
    private const COURBE_OCV_SOC = [
        [3.400, 100.0],
        [3.350, 99.0],
        [3.325, 90.0],
        [3.320, 80.0],
        [3.300, 70.0],
        [3.290, 60.0],
        [3.2825, 50.0],
        [3.275, 40.0],
        [3.250, 30.0],
        [3.225, 20.0],
        [3.200, 17.0],
        [3.125, 14.0],
        [3.000, 9.0],
        [2.500, 0.0],
    ];

    /**
     * SOH représentatif (%) de chaque classe du modèle IA. Le modèle fourni
     * par l'équipe IA est un classifieur (Bon / A Surveiller / A Remplacer)
     * et non une régression : on prend le milieu de la plage de chaque classe
     * (80–100, 70–80, 50–70) pour reconstituer un SOH en pourcentage.
     */
    private const SOH_CENTRE_CLASSE = [
        self::ETAT_BON => 90.0,
        self::ETAT_SURVEILLER => 75.0,
        self::ETAT_A_REMPLACER => 60.0,
    ];

    /** §4 — Tension par cellule donnée au modèle (la tension brute est conservée à part). */
    public function tensionParCellule(float $tensionPack): float
    {
        return $tensionPack / self::N_CELLULES;
    }

    /**
     * État de charge (%) estimé par interpolation linéaire sur la courbe
     * tension à vide LiFePO4. La mesure étant prise en charge réelle, c'est
     * une estimation (la tension d'une LiFePO4 est très plate entre 20 et 80 %).
     */
    public function etatDeChargeDepuisTension(float $tensionPack): float
    {
        $vCellule = $this->tensionParCellule($tensionPack);
        $courbe = self::COURBE_OCV_SOC;

        if ($vCellule >= $courbe[0][0]) {
            return 100.0;
        }

        $dernier = $courbe[count($courbe) - 1];
        if ($vCellule <= $dernier[0]) {
            return 0.0;
        }

        for ($i = 0; $i < count($courbe) - 1; $i++) {
            [$vHaut, $socHaut] = $courbe[$i];
            [$vBas, $socBas] = $courbe[$i + 1];

            if ($vCellule <= $vHaut && $vCellule >= $vBas) {
                $ratio = ($vCellule - $vBas) / ($vHaut - $vBas);

                return $socBas + $ratio * ($socHaut - $socBas);
            }
        }

        return 0.0;
    }

    /** Profondeur de décharge (%) = 100 − état de charge, estimée depuis la tension du pack. */
    public function dodDepuisTension(float $tensionPack): float
    {
        return round(100.0 - $this->etatDeChargeDepuisTension($tensionPack), 1);
    }

    /**
     * DoD retenu : la valeur envoyée par le boîtier si elle existe,
     * sinon l'estimation depuis la tension.
     *
     * @return array{0: float, 1: string} [dod %, source 'boitier'|'tension']
     */
    public function resoudreDod(?float $dodRecu, float $tensionPack): array
    {
        if ($dodRecu !== null) {
            return [round(max(0.0, min(100.0, $dodRecu)), 1), 'boitier'];
        }

        return [$this->dodDepuisTension($tensionPack), 'tension'];
    }

    /**
     * Ramène un libellé de classe du modèle (réel ou mock) à l'un des trois
     * états métier du document.
     */
    public function normaliserClasse(?string $libelle, ?int $classeId = null): ?string
    {
        if ($libelle !== null) {
            $l = mb_strtolower(trim($libelle));

            if (str_contains($l, 'rempla') || str_contains($l, 'dégrad') || str_contains($l, 'degrad')) {
                return self::ETAT_A_REMPLACER;
            }
            if (str_contains($l, 'surveil') || str_contains($l, 'moyen')) {
                return self::ETAT_SURVEILLER;
            }
            if (str_contains($l, 'bon')) {
                return self::ETAT_BON;
            }
        }

        // Encodage du modèle : 0 = Bon, 1 = A Surveiller, 2 = A Remplacer.
        return match ($classeId) {
            0 => self::ETAT_BON,
            1 => self::ETAT_SURVEILLER,
            2 => self::ETAT_A_REMPLACER,
            default => null,
        };
    }

    /**
     * SOH (%) = espérance des probabilités du modèle pondérées par le SOH
     * représentatif de chaque classe. Ex. : Bon 0,51 / Surveiller 0,37 /
     * Remplacer 0,11 → 0,51×90 + 0,37×75 + 0,11×60 ≈ 80,6 %.
     * Sans probabilités, on retient le SOH représentatif de la classe prédite.
     */
    public function sohDepuisClassification(
        ?array $probabilites,
        ?string $classe,
        ?int $classeId = null
    ): ?float {
        if (is_array($probabilites) && $probabilites !== []) {
            $somme = 0.0;
            $poids = 0.0;

            foreach ($probabilites as $libelle => $p) {
                $etat = $this->normaliserClasse((string) $libelle, is_int($libelle) ? $libelle : null);
                if ($etat === null || !is_numeric($p)) {
                    continue;
                }
                $somme += (float) $p * self::SOH_CENTRE_CLASSE[$etat];
                $poids += (float) $p;
            }

            if ($poids > 0) {
                return round($somme / $poids, 1);
            }
        }

        $etat = $this->normaliserClasse($classe, $classeId);

        return $etat !== null ? self::SOH_CENTRE_CLASSE[$etat] : null;
    }

    /** §6 — Capacité restante (Ah) = SOH / 100 × 24. */
    public function capaciteRestante(float $soh): float
    {
        return round($soh / 100 * self::CAPACITE_NOMINALE_AH, 1);
    }

    /** §6 — Durée de vie (jours) = cycles restants / cycles par jour. */
    public function dureeVieJours(?int $cyclesRestants): ?int
    {
        if ($cyclesRestants === null) {
            return null;
        }

        return (int) max(0, intdiv($cyclesRestants, self::CYCLES_PAR_JOUR));
    }

    /** §6 — État selon les seuils SOH. */
    public function etat(float $soh): string
    {
        if ($soh >= self::SEUIL_SOH_BON) {
            return self::ETAT_BON;
        }
        if ($soh >= self::SEUIL_SOH_SURVEILLER) {
            return self::ETAT_SURVEILLER;
        }

        return self::ETAT_A_REMPLACER;
    }

    public function surchauffe(?float $temperature): bool
    {
        return $temperature !== null && $temperature > self::SEUIL_SURCHAUFFE_C;
    }

    /**
     * §6 — Message de maintenance pour le technicien (tableau du document).
     * Avec $avecAlerteSurchauffe, ajoute l'alerte §9 (utile hors interface web,
     * ex. réponse au boîtier ou rapport texte).
     */
    public function message(?string $etat, ?float $temperature = null, bool $avecAlerteSurchauffe = false): ?string
    {
        $message = match ($etat) {
            self::ETAT_BON => 'Batterie en bon état. Aucune action.',
            self::ETAT_SURVEILLER => 'Entrée en fin de vie. Contrôle au prochain passage.',
            self::ETAT_A_REMPLACER, 'A_remplacer' => 'Fin de vie. Planifier le remplacement.',
            default => null,
        };

        if ($avecAlerteSurchauffe && $this->surchauffe($temperature)) {
            $alerte = sprintf(
                'Alerte surchauffe : %.1f °C (seuil %.0f °C). Vérifier la ventilation du kit.',
                $temperature,
                self::SEUIL_SURCHAUFFE_C
            );
            $message = $message ? $message . ' ' . $alerte : $alerte;
        }

        return $message;
    }

    /**
     * Calcule toutes les informations dérivées (§6) à partir de la réponse
     * du modèle IA.
     *
     * @return array{soh_pourcent: ?float, capacite_ah: ?float, rul_jours: ?int, etat: ?string}
     */
    public function informationsDerivees(
        ?array $probabilites,
        ?string $classe,
        ?int $classeId,
        ?int $rulCycles
    ): array {
        $soh = $this->sohDepuisClassification($probabilites, $classe, $classeId);

        return [
            'soh_pourcent' => $soh,
            'capacite_ah' => $soh !== null ? $this->capaciteRestante($soh) : null,
            'rul_jours' => $this->dureeVieJours($rulCycles),
            'etat' => $soh !== null ? $this->etat($soh) : null,
        ];
    }
}
