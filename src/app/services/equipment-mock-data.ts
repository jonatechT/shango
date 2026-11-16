import type { BatteryCurrentDiagnostic, BatteryHistoryEntry, LocationHistoryEntry } from './equipment.service';

/**
 * ⚠️ MOCK RÉSERVÉ À LA PRÉVISUALISATION SANS BACKEND — À SUPPRIMER UNE FOIS
 * LE BACKEND CONNECTÉ.
 *
 * Ce module fournit des données SIMULÉES pour les endpoints backend consommés
 * par `EquipmentService`, utilisées uniquement lorsque
 * `EQUIPMENT_API_CONFIG.useMock` vaut `true`.
 *
 * Une fois le backend réellement branché (`useMock: false`), ces fonctions ne
 * sont plus jamais appelées et le frontend consomme exclusivement les vrais
 * endpoints :
 *   GET   /api/batterie/{device_id}/actuel
 *   GET   /api/batterie/{device_id}/historique
 *   GET   /api/equipements/{id}/localisations
 *   PATCH /api/equipements/{id}/status
 *
 * Aucune conversion électrique (ex. voltage / 4) n'est réalisée ici : ces
 * valeurs simulées représentent ce que le backend renverra après analyse.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_POINTS = 30;

export function mockBatteryCurrentDiagnostic(deviceId: string): BatteryCurrentDiagnostic {
  return {
    device_id: deviceId,
    date_heure: new Date().toISOString(),
    voltage_v: 13.2,
    current_a: 2.8,
    temperature_c: 36.9,
    dod_percent: 30,
    humidite_pourcent: 42,
    statut_paiement: 'Payé',
    soh_pourcent: 84,
    // Document 3 §6 : capacité = SOH / 100 × 24 Ah ; durée = cycles / 1 cycle par jour.
    capacite_restante_ah: 20.2,
    duree_estimee_jours: 810,
    etat: 'Bon',
    message: 'Batterie en bon état. Aucune action.',
    capacite_nominale_ah: 24,
    alerte_surchauffe: false,
    dod_source: 'tension'
  };
}

export function mockBatteryHistory(deviceId: string): BatteryHistoryEntry[] {
  const now = Date.now();
  const points: BatteryHistoryEntry[] = [];
  for (let i = HISTORY_POINTS - 1; i >= 0; i--) {
    const soh = Math.round((86 - i * 0.07) * 10) / 10;
    points.push({
      date_heure: new Date(now - i * 3 * DAY_MS).toISOString(),
      soh,
      capacite: Math.round((soh / 100) * 24 * 10) / 10,
      rul_jours: Math.round(810 + i * 3),
      temperature: Math.round((34 + Math.sin(i / 3) * 4) * 10) / 10,
      dod: Math.round((30 + Math.cos(i / 2) * 15) * 10) / 10
    });
  }
  return points;
}

/** Historique de localisation simulé : 3 positions successives menant à la position actuelle de l'équipement. */
export function mockLocationHistory(deviceId: string, currentLocalisation: string, currentLien: string): LocationHistoryEntry[] {
  const now = Date.now();
  const positions: { localisation: string; lien: string }[] = [
    { localisation: '12.3714°N, -1.5197°E', lien: '12.3714,-1.5197' },
    { localisation: '12.3685°N, -1.5250°E', lien: '12.3685,-1.5250' },
    { localisation: currentLocalisation || '12.3714°N, -1.5197°E', lien: currentLien || '12.3714,-1.5197' }
  ];

  return positions.map((pos, index) => {
    const debut = new Date(now - (positions.length - index) * 4 * DAY_MS);
    const estActuelle = index === positions.length - 1;
    const fin = estActuelle ? null : new Date(debut.getTime() + 4 * DAY_MS);
    return {
      date_debut: debut.toISOString(),
      date_fin: fin ? fin.toISOString() : null,
      localisation: pos.localisation,
      lien_localisation: pos.lien
    };
  });
}
