/**
 * Middleware JSON Server — reformate les réponses pour coller au contrat
 * attendu par le frontend Shango.
 *
 * Le frontend attend :
 *   GET /api/batterie/:device_id/actuel      -> BatteryCurrentDiagnostic (plat)
 *   GET /api/batterie/:device_id/historique  -> BatteryHistoryEntry[] (tableau plat)
 *   GET /api/equipements/:imei/localisations -> LocationHistoryEntry[] (tableau plat)
 *
 * Dans db.json, l'historique batterie et les localisations sont stockés
 * sous forme d'objets avec sous-tableaux (`points`, `history`) pour rester
 * lisibles. Ce middleware extrait le bon sous-tableau selon le device_id/imei.
 */
const db = require('./db.json');

module.exports = (req, res, next) => {
  const url = req.url;

  // --- Historique batterie : /batterie/:device_id/historique -> points[] ---
  const battHistMatch = url.match(/^\/batterie\/([^/]+)\/historique$/);
  if (battHistMatch && req.method === 'GET') {
    const deviceId = decodeURIComponent(battHistMatch[1]);
    const entry = db.batterie_historique.find(e => e.device_id === deviceId);
    return res.json(entry ? entry.points : []);
  }

  // --- Historique localisations : /equipements/:imei/localisations -> history[] ---
  const locMatch = url.match(/^\/equipements\/([^/]+)\/localisations$/);
  if (locMatch && req.method === 'GET') {
    const imei = decodeURIComponent(locMatch[1]);
    const entry = db.localisations.find(e => e.device_id === imei);
    return res.json(entry ? entry.history : []);
  }

  next();
};
