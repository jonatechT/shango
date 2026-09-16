import { Component, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EquipmentService, Equipment } from '../../services/equipment.service';

/**
 * Modale « Ajouter un équipement ».
 * S'affiche en fenêtre modale au-dessus du parc d'équipement
 * au lieu de rediriger vers une page dédiée.
 */
@Component({
  selector: 'app-equipment-form-modal',
  standalone: true,
  imports: [FormsModule],
  template: `
    @if (open()) {
      <div class="eqm-overlay" (click)="close()">
        <div class="eqm-modal" (click)="$event.stopPropagation()" role="dialog" aria-modal="true">
          <div class="eqm-header">
            <div class="eqm-header-icon">
              <i class="fa-solid fa-cube"></i>
            </div>
            <div class="eqm-header-title-block">
              <h3 class="eqm-title">Ajouter un équipement</h3>
              <p class="eqm-subtitle">Position GPS et mesures transmises automatiquement par l'IoT.</p>
            </div>
            <button type="button" class="eqm-close" (click)="close()" aria-label="Fermer">
              <i class="fa-solid fa-xmark"></i>
            </button>
          </div>

          <div class="eqm-body">
            @if (message()) {
              <div
                class="eqm-alert"
                [class.eqm-alert--success]="messageType() === 'success'"
                [class.eqm-alert--error]="messageType() === 'error'"
                role="status"
              >
                <i class="fa-solid" [class.fa-circle-check]="messageType() === 'success'" [class.fa-circle-xmark]="messageType() === 'error'"></i>
                <span>{{ message() }}</span>
              </div>
            }

            <form (ngSubmit)="onSubmit()" novalidate>
              <div class="eqm-grid">
                <div class="eqm-field">
                  <label class="eqm-label" for="eqm-nom">
                    Nom de l'équipement <span class="eqm-required">*</span>
                  </label>
                  <input
                    id="eqm-nom"
                    name="nom"
                    type="text"
                    class="eqm-input"
                    placeholder="Ex : Kit solaire"
                    [(ngModel)]="nom"
                    required
                  />
                  @if (submitted() && !nom.trim()) {
                    <span class="eqm-error">Le nom est obligatoire.</span>
                  }
                </div>

                <div class="eqm-field">
                  <label class="eqm-label" for="eqm-type">
                    Type / catégorie <span class="eqm-required">*</span>
                  </label>
                  <div class="eqm-select-wrap" [class.eqm-select-open]="typeOpen()" (focusout)="onTypeFocusOut($event)">
                    <button
                      type="button"
                      id="eqm-type"
                      name="type"
                      class="eqm-input eqm-select"
                      (click)="toggleTypeOpen()"
                      aria-haspopup="listbox"
                      [attr.aria-expanded]="typeOpen()"
                    >
                      <span [class.eqm-select-placeholder]="!type">
                        {{ type || 'Sélectionnez un type…' }}
                      </span>
                      <i class="fa-solid fa-chevron-down eqm-select-arrow"></i>
                    </button>

                    @if (typeOpen()) {
                      <ul class="eqm-select-menu" role="listbox">
                        <li
                          class="eqm-select-option"
                          [class.eqm-select-option--selected]="type === 'Kit solaire'"
                          (mousedown)="$event.preventDefault(); selectType('Kit solaire')"
                        >
                          <span>Kit solaire</span>
                          @if (type === 'Kit solaire') { <i class="fa-solid fa-check"></i> }
                        </li>
                        <li
                          class="eqm-select-option"
                          [class.eqm-select-option--selected]="type === 'Véhicule'"
                          (mousedown)="$event.preventDefault(); selectType('Véhicule')"
                        >
                          <span>Véhicule</span>
                          @if (type === 'Véhicule') { <i class="fa-solid fa-check"></i> }
                        </li>
                        <li
                          class="eqm-select-option"
                          [class.eqm-select-option--selected]="type === 'Autre'"
                          (mousedown)="$event.preventDefault(); selectType('Autre')"
                        >
                          <span>Autre</span>
                          @if (type === 'Autre') { <i class="fa-solid fa-check"></i> }
                        </li>
                      </ul>
                    }
                  </div>
                  @if (submitted() && !type) {
                    <span class="eqm-error">Le type est obligatoire.</span>
                  }
                  @if (type === 'Autre') {
                    <div class="eqm-type-custom">
                      <input
                        id="eqm-type-autre"
                        name="typeAutre"
                        type="text"
                        class="eqm-input"
                        placeholder="Précisez le type (ex : Pompe, Convertisseur…)"
                        [(ngModel)]="typeAutre"
                      />
                      @if (submitted() && !typeAutre.trim()) {
                        <span class="eqm-error">Veuillez préciser le type.</span>
                      }
                    </div>
                  }
                </div>

                <!-- Identifiant de l'équipement (IMEI / ID du boîtier IoT) -->
                <div class="eqm-field">
                  <label class="eqm-label" for="eqm-id">Équipement ID</label>
                  <input
                    id="eqm-id"
                    name="equipmentId"
                    type="text"
                    class="eqm-input"
                    placeholder="Ex : SH-001"
                    [(ngModel)]="equipmentId"
                  />
                </div>
<!-- Date de mise en ligne -->
                <div class="eqm-field">
                  <label class="eqm-label" for="eqm-mise">Date de mise en ligne</label>
                  <input
                    id="eqm-mise"
                    name="miseEnLigne"
                    type="date"
                    class="eqm-input"
                    [(ngModel)]="miseEnLigne"
                  />
                </div>

                <!-- Description -->
                <div class="eqm-field eqm-field--full">
                  <label class="eqm-label" for="eqm-description">Description</label>
                  <textarea
                    id="eqm-description"
                    name="description"
                    class="eqm-input eqm-textarea"
                    placeholder="Ex : Kit solaire principal"
                    [(ngModel)]="description"
                    rows="3"
                  ></textarea>
                </div>
              </div>

              <div class="eqm-actions">
                <button type="button" class="eqm-btn eqm-btn--ghost" (click)="close()">
                  <i class="fa-solid fa-xmark"></i>
                  Annuler
                </button>
                <button type="submit" class="eqm-btn eqm-btn--primary" [disabled]="isSubmitting()">
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
      </div>
    }
  `,
  styles: [`
.eqm-overlay {
      position: fixed; inset: 0;
      background: rgba(15, 23, 42, 0.35);
      backdrop-filter: blur(8px) saturate(1.2);
      -webkit-backdrop-filter: blur(8px) saturate(1.2);
      display: flex; align-items: center; justify-content: center;
      z-index: 1000; padding: 16px;
    }
    .eqm-modal {
      background: #FFFFFF;
      border: 1px solid #E2E8F0;
      border-radius: 12px;
      width: 100%; max-width: 820px;
      max-height: 92vh; overflow-y: auto;
      box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08), 0 12px 32px rgba(15, 23, 42, 0.12), 0 24px 64px rgba(15, 23, 42, 0.2);
    }
    .eqm-header {
      display: flex; align-items: flex-start; gap: 14px;
      padding: 18px 20px 14px;
      border-bottom: 1px solid #1E40AF;
      position: sticky; top: 0; background: linear-gradient(180deg, #2563EB, #1D4ED8); z-index: 2;
      border-radius: 20px 20px 0 0;
    }
    .eqm-header-icon {
      width: 40px; height: 40px; border-radius: 10px;
      background: rgba(255, 255, 255, 0.18); color: #FFF;
      display: flex; align-items: center; justify-content: center;
      font-size: 16px; flex-shrink: 0;
      border: 1px solid rgba(255, 255, 255, 0.25);
    }
    .eqm-header-title-block { flex: 1; min-width: 0; }
    .eqm-title { font-size: 18px; font-weight: 600; color: #FFF; margin: 0; letter-spacing: -0.2px; }
    .eqm-subtitle { font-size: 12.5px; color: rgba(255, 255, 255, 0.75); margin: 4px 0 0; line-height: 1.5; }
    .eqm-close {
      width: 32px; height: 32px; border-radius: 8px;
      background: rgba(255, 255, 255, 0.12); color: #FFF;
      display: flex; align-items: center; justify-content: center;
      border: none; cursor: pointer; font-size: 15px;
      transition: all 0.15s ease; flex-shrink: 0;
    }
    .eqm-close:hover { background: rgba(255, 255, 255, 0.22); color: #FFF; }

    .eqm-body { padding: 20px 24px 24px; }

    .eqm-alert {
      display: flex; align-items: center; gap: 10px;
      padding: 12px 16px; border-radius: 12px;
      font-size: 13px; font-weight: 500; margin-bottom: 18px;
    }
    .eqm-alert i { font-size: 14px; }
    .eqm-alert--success { background: #ECFDF5; color: #047857; border: 1px solid #A7F3D0; }
    .eqm-alert--error { background: #FEF2F2; color: #B91C1C; border: 1px solid #FCA5A5; }

    .eqm-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 18px; }
    .eqm-field { display: flex; flex-direction: column; gap: 6px; }
    .eqm-field--full { grid-column: 1 / -1; }
    .eqm-label { font-size: 12.5px; font-weight: 600; color: #334155; }
    .eqm-required { color: #EF4444; }
    .eqm-error { color: #DC2626; font-size: 12px; font-weight: 500; }

    .eqm-input {
      padding: 11px 14px;
      border: 1px solid #E2E8F0; border-radius: 8px;
      font-size: 13.5px; font-family: inherit;
      color: #0F172A; background: #FFFFFF;
      outline: none; width: 100%; box-sizing: border-box;
      box-shadow: 0 2px 4px rgba(15, 23, 42, 0.08);
      transition: border-color 0.15s ease, background 0.15s ease;
    }
    .eqm-input:hover { border-color: #CBD5E1; }
    .eqm-input:focus { border-color: #2563EB; background: #FFFFFF; }

    .eqm-select-wrap { position: relative; }
    .eqm-select { cursor: pointer; text-align: left; display: flex; align-items: center; justify-content: space-between; gap: 10px; background-color: #FFFFFF; font-weight: 500; }
    .eqm-select-placeholder { color: #94A3B8; font-weight: 400; }
    .eqm-select-arrow { font-size: 12px; color: #64748B; pointer-events: none; transition: transform 0.2s ease, color 0.2s ease; }
    .eqm-select-open .eqm-select-arrow { transform: rotate(180deg); color: #2563EB; }
    .eqm-select-menu {
      position: absolute; top: calc(100% + 6px); left: 0; right: 0;
      margin: 0; padding: 6px; list-style: none;
      background: #FFFFFF;
      border: 1px solid #E2E8F0; border-radius: 12px;
      box-shadow: 0 4px 12px rgba(15, 23, 42, 0.1), 0 12px 32px rgba(15, 23, 42, 0.18);
      z-index: 30; animation: eqmDropIn 0.18s ease both; box-sizing: border-box;
    }
    .eqm-select-option {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 9px 12px; border-radius: 8px; font-size: 13.5px; color: #334155;
      cursor: pointer; transition: background 0.15s ease, color 0.15s ease;
    }
    .eqm-select-option:hover { background: #EFF6FF; color: #1D4ED8; }
    .eqm-select-option--selected { background: #EFF6FF; color: #1D4ED8; font-weight: 600; }
    .eqm-select-option i { font-size: 12px; }

    .eqm-type-custom { display: flex; flex-direction: column; gap: 6px; animation: eqmSlideIn 0.25s ease both; }

    .eqm-actions {
      display: flex; justify-content: flex-end; gap: 12px;
      margin-top: 24px; padding-top: 18px; border-top: 1px solid rgba(15, 23, 42, 0.1);
    }
    .eqm-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 8px;
      padding: 10px 16px; border-radius: 8px; border: 1px solid transparent;
      font-family: inherit; font-size: 13.5px; font-weight: 600; cursor: pointer;
      transition: all 0.15s ease;
    }
    .eqm-btn--primary { background: #2563EB; color: #FFF; }
    .eqm-btn--primary:hover:not(:disabled) { background: #1D4ED8; }
    .eqm-btn--ghost { background: #FFF; color: #475569; border-color: #E2E8F0; }
    .eqm-btn--ghost:hover { background: #F1F5F9; color: #1E293B; }
    .eqm-btn:disabled { opacity: 0.7; cursor: not-allowed; }

    .eqm-textarea { height: auto; min-height: 96px; padding: 12px 14px; line-height: 1.5; resize: vertical; }

    @keyframes eqmDropIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }
    @keyframes eqmSlideIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: translateY(0); } }

    @media (max-width: 640px) {
      .eqm-grid { grid-template-columns: 1fr; }
      .eqm-header { flex-wrap: wrap; }
      .eqm-actions { flex-direction: column-reverse; }
      .eqm-btn { width: 100%; }
    }
  `]
})
export class EquipmentFormModalComponent {
  open = signal(false);

  nom = '';
  type = '';
  typeAutre = '';
  protected typeOpen = signal(false);
  equipmentId = '';
  miseEnLigne = '';
  description = '';

  protected submitted = signal(false);
  protected isSubmitting = signal(false);
  protected message = signal('');
  protected messageType: WritableSignal<'success' | 'error'> = signal<'success' | 'error'>('success');

  constructor(private equipmentService: EquipmentService) {}

  /** Ouvre la modale (appelé par le parc d'équipement) */
  show(): void {
    this.reset();
    this.open.set(true);
  }

  close(): void {
    this.open.set(false);
    this.reset();
  }

  private reset(): void {
    this.nom = '';
    this.type = '';
    this.typeAutre = '';
    this.typeOpen.set(false);
    this.equipmentId = '';
    this.miseEnLigne = '';
    this.description = '';
    this.submitted.set(false);
    this.isSubmitting.set(false);
    this.message.set('');
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

    const nom = this.nom.trim();
    const typeFinal = this.type === 'Autre' ? this.typeAutre.trim() : this.type;

    if (!nom || !this.type || (this.type === 'Autre' && !typeFinal)) {
      this.message.set('Veuillez remplir tous les champs obligatoires.');
      this.messageType.set('error');
      return;
    }

    this.isSubmitting.set(true);

    const miseEnLigne = this.miseEnLigne
      ? new Date(this.miseEnLigne + 'T00:00:00').toLocaleDateString('fr-FR', {
          day: 'numeric', month: 'long', year: 'numeric'
        })
      : new Date().toLocaleDateString('fr-FR', {
          day: 'numeric', month: 'long', year: 'numeric'
        });

    const equipment: Equipment = {
      id: this.equipmentId.trim() || this.equipmentService.generateEquipmentId(),
      nom,
      statut: 'En ligne',
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
        this.message.set(`L'équipement « ${created.nom} » a été ajouté avec succès.`);
        this.messageType.set('success');
        setTimeout(() => this.close(), 1200);
      } else {
        const errMsg = this.equipmentService.equipmentCreateError() ?? "Impossible d'ajouter l'équipement.";
        this.message.set(errMsg);
        this.messageType.set('error');
      }
    });
  }
}