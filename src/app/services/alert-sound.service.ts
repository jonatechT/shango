import { Injectable } from '@angular/core';

/**
 * Sonnerie d'alerte IoT : courte mélodie répétée en boucle (Web Audio, aucun
 * fichier à télécharger) jusqu'à l'appel de `stop()` — clic sur la cloche du
 * header ou ouverture de la page Alertes.
 *
 * Les navigateurs bloquent le son tant que l'utilisateur n'a pas interagi
 * avec la page : si le contexte audio est suspendu, il est relancé au premier
 * clic/touche suivant.
 */
@Injectable({ providedIn: 'root' })
export class AlertSoundService {
  /** Notes de la mélodie (Hz) et durée de chaque note (s). */
  private static readonly MELODIE = [880, 1175, 880, 1175, 1568];
  private static readonly DUREE_NOTE_S = 0.16;
  /** Intervalle entre deux répétitions de la mélodie (ms). */
  private static readonly REPETITION_MS = 2200;

  private ctx: AudioContext | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private unlockListenerInstalled = false;

  get isPlaying(): boolean {
    return this.timer !== null;
  }

  start(): void {
    if (this.timer !== null || typeof window === 'undefined') return;
    this.ensureContext();
    this.jouerMelodie();
    this.timer = setInterval(() => this.jouerMelodie(), AlertSoundService.REPETITION_MS);
  }

  stop(): void {
    if (this.timer !== null) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private ensureContext(): void {
    if (!this.ctx) {
      const Ctor = window.AudioContext || (window as any).webkitAudioContext;
      if (!Ctor) return;
      this.ctx = new Ctor();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => undefined);
      this.installUnlockListener();
    }
  }

  /** Relance le contexte audio au premier geste de l'utilisateur (politique autoplay). */
  private installUnlockListener(): void {
    if (this.unlockListenerInstalled) return;
    this.unlockListenerInstalled = true;
    const unlock = () => {
      this.ctx?.resume().catch(() => undefined);
      if (this.ctx?.state === 'running') {
        document.removeEventListener('pointerdown', unlock);
        document.removeEventListener('keydown', unlock);
        this.unlockListenerInstalled = false;
      }
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
  }

  private jouerMelodie(): void {
    const ctx = this.ctx;
    if (!ctx) return;
    if (ctx.state === 'suspended') {
      ctx.resume().catch(() => undefined);
      return;
    }
    const debut = ctx.currentTime + 0.02;
    AlertSoundService.MELODIE.forEach((freq, i) => {
      const t = debut + i * AlertSoundService.DUREE_NOTE_S;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(freq, t);
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.25, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + AlertSoundService.DUREE_NOTE_S - 0.01);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + AlertSoundService.DUREE_NOTE_S);
    });
  }
}
