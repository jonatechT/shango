import { Injectable, signal } from '@angular/core';

const THEME_STATE_KEY = 'shango_theme';

/**
 * Service de thème partagé (shell principal + espace SuperAdmin).
 * Persiste le choix dans localStorage et applique la classe `dark-mode`
 * sur <body> pour que toutes les pages (styles scopés inclus) réagissent.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly _isDark = signal(false);

  /** État courant du mode nuit (lecture réactive) */
  readonly isDark = this._isDark;

  /** Initialise le thème depuis localStorage (à appeler au démarrage de l'app) */
  init(): void {
    this._isDark.set(this.readStoredTheme());
    this.apply();
  }

  /** Bascule entre mode nuit et mode clair */
  toggle(): void {
    this._isDark.update(v => !v);
    this.save();
    this.apply();
  }

  private readStoredTheme(): boolean {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(THEME_STATE_KEY) === 'dark';
    }
    return false;
  }

  private save(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(THEME_STATE_KEY, this._isDark() ? 'dark' : 'light');
    }
  }

  /** Applique/retire la classe dark-mode sur <body> (portée globale) */
  private apply(): void {
    if (typeof document !== 'undefined') {
      document.body.classList.toggle('dark-mode', this._isDark());
    }
  }
}
