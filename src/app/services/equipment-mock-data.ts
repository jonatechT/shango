import type { BatteryCurrentDiagnostic, BatteryHistoryEntry } from './equipment.service';

/**
 * ⚠️ MOCK RÉSERVÉ AU DÉVELOPPEMENT — NE PAS UTILISER EN PRODUCTION.
 *
 * Ce module fournit des données de diagnostic batterie SIMULÉES, utilisées
 * uniquement lorsque `BATTERY_API_CONFIG.useMock` vaut `true`
 * (backend de diagnostic pas encore démarré en local).
 *
 * En production (`useMock: false`), ces fonctions ne sont jamais appelées et le
 * frontend consomme exclusivement le vrai backend :
 *   GET /api/batterie/{device_id}/actuel
 *   GET /api/batterie/{device_id}/historique
 *
 * Aucune conversion électrique (ex. voltage / 4) n'est réalisée ici : ces
 * valeurs simulées représentent ce que le backend renverRA après analyse.
 */

const DAY_MS = 24 * 60 * 60 * 1000;
const HISTORY_POINTS = 30;

export function mockBatteryCurrentDiagnostic(deviceId: string): BatteryCurrentDiagnostic {
  return {
    device_id: deviceId,
    date_heure: new Date().toISOString(),
    voltage_v: 12.46,
    current_a: 2.8,
    temperature_c: 36.9,
    dod_percent: 38,
    soh_pourcent: 84,
    capacite_restante_ah: 102.4,
    duree_estimee_jours: 190,
    etat: 'Bon',
    message: 'Batterie en bon état, aucun remplacement nécessaire pour le moment.'
  };
}

export function mockBatteryHistory(deviceId: string): BatteryHistoryEntry[] {
  const now = Date.now();
  const points: BatteryHistoryEntry[] = [];
  for (let i = HISTORY_POINTS - 1; i >= 0; i--) {
    points.push({
      date_heure: new Date(now - i * 3 * DAY_MS).toISOString(),
      soh: Math.round((86 - i * 0.07) * 10) / 10,
      capacite: Math.round((105 - i * 0.09) * 100) / 100,
      rul_jours: Math.round(210 - i * 0.7),
      temperature: Math.round((34 + Math.sin(i / 3) * 4) * 10) / 10
    });
  }
  return points;
}