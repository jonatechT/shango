/**
 * Environnement de production (build par défaut, ex. déploiement GitHub Pages).
 * Le frontend étant hébergé statiquement, `apiUrl` doit pointer vers l'URL
 * publique du backend Laravel.
 *
 * ⚠️ URL de tunnel Cloudflare TEMPORAIRE (démo) : générée à chaque relance du
 * tunnel (`cloudflared tunnel --url http://localhost:8000`), donc à remettre
 * à jour ici après chaque redémarrage. Ne fonctionne que tant que le poste
 * qui héberge le backend reste allumé et connecté. À remplacer par une vraie
 * URL d'hébergement dès que le backend aura un logement permanent.
 */
export const environment = {
  production: true,
  apiUrl: 'https://pure-div-treasurer-casinos.trycloudflare.com/api'
};
