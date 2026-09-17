/**
 * Indicatifs téléphoniques proposés dans les formulaires — 12 pays africains,
 * principalement d'Afrique de l'Ouest (CEDEAO). `iso` est le code pays à 2
 * lettres utilisé par la librairie `flag-icons` (classe CSS `fi fi-{iso}`,
 * chargée en CDN dans index.html) ; les émojis drapeau (🇧🇫...) ne s'affichent
 * pas correctement sur Windows (le système montre le code ISO en texte, ex.
 * "BF", faute de police capable de composer les indicateurs régionaux
 * Unicode en drapeau).
 */
export interface IndicatifTelephone {
  code: string;
  pays: string;
  iso: string;
  longueur: number;
}

export const INDICATIFS_TELEPHONE: IndicatifTelephone[] = [
  { code: '+226', pays: 'Burkina Faso', iso: 'bf', longueur: 8 },
  { code: '+225', pays: "Côte d'Ivoire", iso: 'ci', longueur: 10 },
  { code: '+223', pays: 'Mali', iso: 'ml', longueur: 8 },
  { code: '+227', pays: 'Niger', iso: 'ne', longueur: 8 },
  { code: '+228', pays: 'Togo', iso: 'tg', longueur: 8 },
  { code: '+229', pays: 'Bénin', iso: 'bj', longueur: 8 },
  { code: '+221', pays: 'Sénégal', iso: 'sn', longueur: 9 },
  { code: '+233', pays: 'Ghana', iso: 'gh', longueur: 9 },
  { code: '+234', pays: 'Nigeria', iso: 'ng', longueur: 10 },
  { code: '+224', pays: 'Guinée', iso: 'gn', longueur: 9 },
  { code: '+245', pays: 'Guinée-Bissau', iso: 'gw', longueur: 7 },
  { code: '+238', pays: 'Cap-Vert', iso: 'cv', longueur: 7 }
];

/** Détails (pays, drapeau, longueur) de l'indicatif donné. */
export function getIndicatif(code: string): IndicatifTelephone {
  return INDICATIFS_TELEPHONE.find(i => i.code === code) ?? INDICATIFS_TELEPHONE[0];
}

/** Nombre de chiffres attendu pour l'indicatif donné (8 par défaut). */
export function getPhoneLength(indicatif: string): number {
  return getIndicatif(indicatif).longueur;
}

/** Espace réservé dynamique (ex. "XX XX XX XX" pour 8 chiffres). */
export function phonePlaceholder(indicatif: string): string {
  let remaining = getPhoneLength(indicatif);
  const groups: string[] = [];
  while (remaining > 0) {
    const take = remaining <= 3 ? remaining : 2;
    groups.push('X'.repeat(take));
    remaining -= take;
  }
  return groups.join(' ');
}

/** Ne garde que les chiffres, tronqués à la longueur exacte attendue pour l'indicatif. */
export function sanitizePhoneDigits(value: string, indicatif: string): string {
  return value.replace(/\D/g, '').slice(0, getPhoneLength(indicatif));
}
