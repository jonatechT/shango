import { Injectable, signal } from '@angular/core';

/** Action que l'admin effectue sur une alerte depuis /alerts — un seul mode actif à la fois. */
export type ActionAdminAlerte = 'affecter' | 'planifier' | 'prendre';

/** Préférences métier stockées dans la page Paramètres — elles pilotent tout le trafic de la plateforme. */
export interface AppSettings {
  /** L'admin peut affecter plusieurs techniciens à une même alerte */
  multiTechniciens: boolean;
  /** Nombre maximal de techniciens par intervention (valeur libre définie par l'admin) */
  maxTechniciens: number;
  /** Les techniciens peuvent prendre une alerte sans attendre une affectation de l'admin */
  priseEnChargeGlobale: boolean;
  /**
   * Action proposée à l'admin sur une alerte (une seule à la fois, choisie ici) :
   * 'affecter' un technicien, 'planifier' une intervention (date + nature), ou
   * 'prendre' l'alerte lui-même sans passer par un technicien.
   */
  actionAdmin: ActionAdminAlerte;
  /** Jours avant la date d'une intervention planifiée : les techniciens affectés reçoivent une notification */
  rappelAvantIntervention: number;
}

@Injectable({
  providedIn: 'root'
})
export class SettingsService {
  private readonly STORAGE_KEY = 'shango_settings';

  readonly settings = signal<AppSettings>(this.load());

  private defaults(): AppSettings {
    return {
      multiTechniciens: false,
      maxTechniciens: 2,
      priseEnChargeGlobale: true,
      actionAdmin: 'planifier',
      rappelAvantIntervention: 2
    };
  }

  private load(): AppSettings {
    if (typeof window === 'undefined') return this.defaults();
    try {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<AppSettings>;
        return { ...this.defaults(), ...parsed };
      }
    } catch {
      /* données corrompues → valeurs par défaut */
    }
    return this.defaults();
  }

  private save(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.settings()));
    }
  }

  /** Met à jour tout ou partie des paramètres (persisté) */
  update(patch: Partial<AppSettings>): void {
    this.settings.set({ ...this.settings(), ...patch });
    this.save();
  }

  /** Réinitialise les préférences aux valeurs par défaut */
  reset(): void {
    this.settings.set(this.defaults());
    this.save();
  }
}