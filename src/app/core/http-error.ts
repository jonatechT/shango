import { HttpErrorResponse } from '@angular/common/http';

/** Message d'erreur lisible à partir d'une réponse d'erreur HTTP du backend. */
export function extractHttpErrorMessage(error: HttpErrorResponse, action: string): string {
  if (error.status === 0) {
    return `Backend indisponible : impossible ${action}.`;
  }
  const errors = error.error?.errors as Record<string, string[]> | undefined;
  const firstFieldError = errors ? Object.values(errors)[0]?.[0] : undefined;
  const backendMessage = error.error?.message || firstFieldError;
  return backendMessage || `Erreur ${error.status} lors de la tentative ${action}.`;
}
