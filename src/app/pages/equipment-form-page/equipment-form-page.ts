import { Component, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { BasePageComponent } from '../base-page/base-page';
import { EquipmentService, Equipment } from '../../services/equipment.service';

@Component({
  selector: 'app-equipment-form-page',
  standalone: true,
  imports: [BasePageComponent, FormsModule],
  template: `
    <app-base-page
      title="Ajouter un équipement"
      subtitle="Déclarez l'équipement : la position GPS et les mesures (tension, courant, température) seront transmises automatiquement par l'IoT après la création."
      icon="fa-solid fa-plus"
    >
      <div class="eqf-content">
        @if (message()) {
          <div
            class="eqf-alert"
            [class.eqf-alert--success]="messageType() === 'success'"
            [class.eqf-alert--error]="messageType() === 'error'"
            role="status"
          >
            <i
              class="fa-solid"
              [class.fa-circle-check]="messageType() === 'success'"
              [class.fa-circle-xmark]="messageType() === 'error'"
            ></i>
            <span>{{ message() }}</span>
          </div>
        }

        <div class="eqf-card">
          <form (ngSubmit)="onSubmit()" #eqForm="ngForm" novalidate>
            <div class="eqf-grid">
              <!-- Nom -->
              <div class="eqf-field">
                <label class="eqf-label" for="eq-nom">
                  Nom de l'équipement <span class="eqf-required">*</span>
                </label>
                <input
                  id="eq-nom"
                  name="nom"
                  type="text"
                  class="eqf-input"
                  placeholder="Ex : Kit solaire"
                  [(ngModel)]="nom"
                  required
                />
                @if (submitted() && !nom.trim()) {
                  <span class="eqf-error">Le nom est obligatoire.</span>
                }
              </div>

              <!-- Type / catégorie -->
              <div class="eqf-field">
                <label class="eqf-label" for="eq-type">
                  Type / catégorie <span class="eqf-required">*</span>
                </label>
                <div
                  class="eqf-select-wrap"
                  [class.eqf-select-open]="typeOpen()"
                  (focusout)="onTypeFocusOut($event)"
                >
                  <button
                    type="button"
                    id="eq-type"
                    name="type"
                    class="eqf-input eqf-select"
                    (click)="toggleTypeOpen()"
                    aria-haspopup="listbox"
                    [attr.aria-expanded]="typeOpen()"
                  >
                    <span [class.eqf-select-placeholder]="!type">
                      {{ type || 'Sélectionnez un type…' }}
                    </span>
                    <i class="fa-solid fa-chevron-down eqf-select-arrow"></i>
                  </button>

                  @if (typeOpen()) {
                    <ul class="eqf-select-menu" role="listbox">
                      <li
                        class="eqf-select-option"
                        role="option"
                        [class.eqf-select-option--selected]="type === 'Kit solaire'"
                        (mousedown)="$event.preventDefault(); selectType('Kit solaire')"
                      >
                        <span>Kit solaire</span>
                        @if (type === 'Kit solaire') {
                          <i class="fa-solid fa-check"></i>
                        }
                      </li>
                    </ul>
                  }
                </div>
                @if (submitted() && !type) {
                  <span class="eqf-error">Le type est obligatoire.</span>
                }
              </div>

              <!-- Mise en ligne -->
              <div class="eqf-field">
                <label class="eqf-label" for="eq-mise">
                  Date de mise en ligne
                </label>
                <input
                  id="eq-mise"
                  name="miseEnLigne"
                  type="date"
                  class="eqf-input"
                  [(ngModel)]="miseEnLigne"
                />
              </div>

              <!-- Description -->
              <div class="eqf-field eqf-field--full">
                <label class="eqf-label" for="eq-description">Description</label>
                <textarea
                  id="eq-description"
                  name="description"
                  class="eqf-input eqf-textarea"
                  placeholder="Ex : Kit solaire principal"
                  [(ngModel)]="description"
                  rows="3"
                ></textarea>
              </div>
            </div>

            <div class="eqf-actions">
              <button
                type="button"
                class="eqf-btn eqf-btn--ghost"
                (click)="annuler()"
              >
                <i class="fa-solid fa-xmark"></i>
                Annuler
              </button>
              <button
                type="submit"
                class="eqf-btn eqf-btn--primary"
                [disabled]="isSubmitting()"
              >
                @if (isSubmitting()) {
                  <i class="fa-solid fa-spinner fa-spin"></i>
                } @else {
                  <i class="fa-solid fa-plus"></i>
                }
                <span>{{ isSubmitting() ? 'Ajout…' : 'Ajouter' }}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </app-base-page>
  `,
  styles: [
    `
    .eqf-content {
      display: flex;
      flex-direction: column;
      gap: 20px;
      width: 100%;
    }

    /* ===== Bandeau de message ===== */
    .eqf-alert {
      display: flex;
      align-items: center;
      gap: 10px;
      padding: 12px 16px;
      border-radius: 12px;
      font-size: 13px;
      font-weight: 500;
    }
    .eqf-alert i { font-size: 14px; }
    .eqf-alert--success { background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; }
    .eqf-alert--error { background: #FEF2F2; color: #B91C1C; border: 1px solid #FCA5A5; }

    /* ===== Carte formulaire (fond blanc, propre) ===== */
    .eqf-card {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 16px;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04), 0 8px 24px rgba(15, 23, 42, 0.04);
      padding: 24px;
      max-width: 960px;
      width: 100%;
      box-sizing: border-box;
    }

    .eqf-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 18px;
    }

    .eqf-field { display: flex; flex-direction: column; gap: 6px; }

    .eqf-label {
      font-size: 12.5px;
      font-weight: 600;
      color: #334155;
    }

    .eqf-required { color: #EF4444; }

    .eqf-input {
      padding: 11px 14px;
      border: 1px solid #E2E8F0;
      border-radius: 10px;
      font-size: 13.5px;
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #0F172A;
      background: #FFFFFF;
      outline: none;
      transition: border-color 0.2s ease, box-shadow 0.2s ease;
      width: 100%;
      box-sizing: border-box;
    }
    .eqf-input:hover { border-color: #CBD5E1; }
    .eqf-input:focus { border-color: #94A3B8; box-shadow: 0 0 0 3px rgba(100, 116, 139, 0.10); }

    /* ===== Menu déroulant type / catégorie (personnalisé) ===== */
    .eqf-select-wrap { position: relative; display: block; }
    .eqf-select {
      cursor: pointer;
      text-align: left;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 10px;
      background-color: #F8FAFC;
      font-weight: 500;
    }
    .eqf-select-placeholder { color: #94A3B8; font-weight: 400; }
    .eqf-select-arrow {
      font-size: 12px;
      color: #64748B;
      pointer-events: none;
      transition: transform 0.2s ease, color 0.2s ease;
    }
    .eqf-select-wrap:hover .eqf-select-arrow { color: #475569; }
    .eqf-select-open .eqf-select-arrow { transform: rotate(180deg); color: #2563EB; }

    .eqf-select-menu {
      position: absolute;
      top: calc(100% + 6px);
      left: 0;
      right: 0;
      margin: 0;
      padding: 6px;
      list-style: none;
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      box-shadow: 0 12px 32px rgba(15, 23, 42, 0.14);
      z-index: 30;
      animation: eqfDropIn 0.18s ease both;
      box-sizing: border-box;
    }
    @keyframes eqfDropIn {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }
    .eqf-select-option {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 8px;
      padding: 9px 12px;
      border-radius: 8px;
      font-size: 13.5px;
      color: #334155;
      cursor: pointer;
      transition: background 0.15s ease, color 0.15s ease;
    }
    .eqf-select-option:hover { background: #EFF6FF; color: #1D4ED8; }
    .eqf-select-option--selected { background: #EFF6FF; color: #1D4ED8; font-weight: 600; }
    .eqf-select-option i { font-size: 12px; }

    /* ===== Type personnalisé (option « Autre ») ===== */
    .eqf-type-custom {
      display: flex;
      flex-direction: column;
      gap: 6px;
      animation: eqfSlideIn 0.25s ease both;
    }
    @keyframes eqfSlideIn {
      from { opacity: 0; transform: translateY(-6px); }
      to { opacity: 1; transform: translateY(0); }
    }

    .eqf-error { color: #DC2626; font-size: 12px; font-weight: 500; }

    .eqf-actions {
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
      padding-top: 18px;
      border-top: 1px solid #F1F5F9;
    }

    /* ===== Boutons ===== */
    .eqf-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 11px 18px;
      border-radius: 10px;
      border: 1px solid transparent;
      font-family: inherit;
      font-size: 13.5px;
      font-weight: 600;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .eqf-btn--primary {
      background: #2563EB;
      color: #FFFFFF;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
    }
    .eqf-btn--primary:hover:not(:disabled) {
      background: #1D4ED8;
      transform: translateY(-1px);
    }
    .eqf-btn--ghost {
      background: #FFFFFF;
      color: #475569;
      border-color: #E2E8F0;
    }
    .eqf-btn--ghost:hover { background: #F8FAFC; color: #1E293B; }
    .eqf-btn:disabled { opacity: 0.7; cursor: not-allowed; }

    /* ===== Description pleine largeur ===== */
    .eqf-field--full { grid-column: 1 / -1; }
    .eqf-textarea {
      height: auto;
      min-height: 96px;
      padding: 12px 14px;
      line-height: 1.5;
      resize: vertical;
    }

    /* ===== Responsive ===== */
    @media (max-width: 768px) {
      .eqf-grid { grid-template-columns: 1fr; }
      .eqf-card { padding: 18px; }
      .eqf-actions { flex-direction: column-reverse; }
      .eqf-btn { width: 100%; }
    }
  `
  ]
})
export class EquipmentFormPageComponent {
  nom = '';
  type = '';
  protected typeOpen = signal(false);
  miseEnLigne = '';
  description = '';

  protected submitted = signal(false);
  protected isSubmitting = signal(false);
  protected message = signal('');
  protected messageType: WritableSignal<'success' | 'error'> = signal<'success' | 'error'>('success');

  constructor(
    private equipmentService: EquipmentService,
    private router: Router
  ) {}

  private showMessage(text: string, type: 'success' | 'error'): void {
    this.message.set(text);
    this.messageType.set(type);
  }

  toggleTypeOpen(): void {
    this.typeOpen.update(v => !v);
  }

  onTypeFocusOut(event: FocusEvent): void {
    const next = event.relatedTarget as Node | null;
    if (!(event.currentTarget as HTMLElement).contains(next)) {
      this.typeOpen.set(false);
    }
  }

  selectType(value: string): void {
    this.type = value;
    this.typeOpen.set(false);
  }

  onSubmit(): void {
    this.submitted.set(true);
    this.message.set('');

    // Vérifications locales (chaque champ obligatoire est validé individuellement).
    const nom = this.nom.trim();
    const typeFinal = this.type;

    if (!nom || !typeFinal) {
      this.showMessage('Veuillez remplir tous les champs obligatoires.', 'error');
      return;
    }

    this.isSubmitting.set(true);

    const miseEnLigne = this.miseEnLigne
      ? new Date(this.miseEnLigne + 'T00:00:00').toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        })
      : new Date().toLocaleDateString('fr-FR', {
          day: 'numeric',
          month: 'long',
          year: 'numeric'
        });

    // Le technicien déclare uniquement l'équipement. L'état réel — statut,
    // position GPS, tension, courant, température — est transmis
    // automatiquement par l'ESP32/IoT et traité par le backend.
    // L'organisation est déterminée par le backend à partir de l'utilisateur
    // authentifié (aucun champ organisation côté frontend).
    // L'équipement reçoit un identifiant technique généré localement.
    // L'identifiant IoT réel (ESP32) sera transmis automatiquement par le
    // device lors de sa première synchronisation avec le backend.
    const equipment: Equipment = {
      id: `EQ-${Date.now()}`,
      nom,
      statut: 'En ligne', // état initial déclaré — mis à jour ensuite par l'IoT/backend
      localisation: 'En attente du GPS (IoT)',
      lienLocalisation: 'En attente du GPS (IoT)',
      miseEnLigne,
      type: typeFinal,
      description: this.description.trim(),
      temperature: null,
      tension: null,
      bloque: false
    };

    this.equipmentService.createEquipment(equipment).subscribe((created) => {
      this.isSubmitting.set(false);
      if (created) {
        this.showMessage(`L'équipement « ${created.nom} » a été ajouté avec succès.`, 'success');
        setTimeout(() => this.router.navigate(['/equipements']), 1200);
      } else {
        this.showMessage(
          this.equipmentService.equipmentCreateError() ?? "Impossible d'ajouter l'équipement.",
          'error'
        );
      }
    });
  }

  annuler(): void {
    this.router.navigate(['/equipements']);
  }
}