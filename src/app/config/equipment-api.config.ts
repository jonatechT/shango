/**
 * Configuration des endpoints backend consommés par `EquipmentService`
 * (création d'équipement, blocage/déblocage, diagnostic batterie, historique
 * de localisation).
 *
 * Le frontend ne contient AUCUNE logique de prédiction IA : il consomme
 * uniquement les endpoints fournis par le backend, listés dans
 * BACKEND_API_CONTRACT.md.
 *
 * ── Mode MOCK (prévisualisation sans backend) ────────────────────────────────
 * Si `useMock` vaut `true`, `EquipmentService` utilise des données simulées
 * (isolées dans `services/equipment-mock-data.ts`) au lieu d'appeler le
 * backend — utile tant que le backend n'est pas encore déployé (ex. démo sur
 * GitHub Pages, hébergement 100% statique).
 * Repasser `useMock` à `false` dès que le backend est branché.
 */
export const EQUIPMENT_API_CONFIG = {
  /** true = données simulées (pas de backend requis) ; false = backend réel. */
  useMock: true
} as const;
