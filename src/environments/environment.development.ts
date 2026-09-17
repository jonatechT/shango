/**
 * Environnement de développement (ng serve).
 * `apiUrl` relatif : les requêtes passent par le proxy Angular
 * (proxy.conf.json) qui les redirige vers le backend Laravel local.
 */
export const environment = {
  production: false,
  apiUrl: '/api'
};
