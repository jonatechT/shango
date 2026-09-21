/**
 * Environnement de production (build par défaut, ex. déploiement GitHub Pages).
 * Le frontend étant hébergé statiquement, `apiUrl` doit pointer vers l'URL
 * publique du backend Laravel.
 *
 * Backend hébergé sur Render (service `shango-api`, cf. render.yaml).
 * Plan gratuit : le service s'endort après ~15 min d'inactivité, la première
 * requête suivante peut prendre environ une minute.
 */
export const environment = {
  production: true,
  apiUrl: 'https://shango-api.onrender.com/api'
};
