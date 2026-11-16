/**
 * Environnement de production (build par défaut, ex. déploiement GitHub Pages).
 * Le frontend étant hébergé statiquement, `apiUrl` doit pointer vers l'URL
 * publique du backend Laravel.
 *
 * Backend Laravel hébergé sur EC2 et exposé en HTTPS via CloudFront.
 */
export const environment = {
  production: true,
  apiUrl: 'https://api.shango-solar.com/api'
};
