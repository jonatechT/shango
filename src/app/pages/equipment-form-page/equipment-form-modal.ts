import { Component, signal, WritableSignal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { EquipmentService, Equipment } from '../../services/equipment.service';

/** Types d'équipement proposés (liste fermée : pas de saisie libre). */
const TYPES_EQUIPEMENT = [
  'Kit solaire',
  'Panneau solaire',
  'Batterie',
  'Onduleur',
  'Groupe électrogène',
  'Pompe à eau solaire',
  'Réfrigérateur solaire',
  'Véhicule',
  'Moto / Tricycle',
  'Engin minier'
];

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
              <p class="eqm-subtitle">La position GPS sera transmise automatiquement par le boîtier IoT.</p>
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
                  <label class="eqm-label" for="eqm-client-nom">
                    Nom du client <span class="eqm-required">*</span>
                  </label>
                  <input
                    id="eqm-client-nom"
                    name="clientNom"
                    type="text"
                    class="eqm-input"
                    placeholder="Ex : Ouedraogo Ibrahim"
                    [(ngModel)]="clientNom"
                    required
                  />
                  @if (submitted() && !clientNom.trim()) {
                    <span class="eqm-error">Le nom du client est obligatoire.</span>
                  }
                </div>

                <div class="eqm-field">
                  <label class="eqm-label" for="eqm-client-numero">Numéro du client</label>
                  <input id="eqm-client-numero" name="clientNumero" type="text" class="eqm-input" placeholder="Ex : CL-0456" [(ngModel)]="clientNumero" />
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
                        @for (t of typesEquipement; track t) {
                          <li
                            class="eqm-select-option"
                            [class.eqm-select-option--selected]="type === t"
                            (mousedown)="$event.preventDefault(); selectType(t)"
                          >
                            <span>{{ t }}</span>
                            @if (type === t) { <i class="fa-solid fa-check"></i> }
                          </li>
                        }
                      </ul>
                    }
                  </div>
                  @if (submitted() && !type) {
                    <span class="eqm-error">Le type est obligatoire.</span>
                  }
                </div>

                <div class="eqm-field">
                  <label class="eqm-label" for="eqm-marque">Marque / modèle</label>
                  <input id="eqm-marque" name="marqueModele" type="text" class="eqm-input" placeholder="Ex : Victron MultiPlus-II" [(ngModel)]="marqueModele" />
                </div>

                <div class="eqm-field">
                  <label class="eqm-label" for="eqm-site">Site / emplacement</label>
                  <input id="eqm-site" name="site" type="text" class="eqm-input" placeholder="Ex : Ouagadougou — Secteur 12" [(ngModel)]="site" />
                </div>

                <div class="eqm-field">
                  <label class="eqm-label" for="eqm-boitier">ID du boîtier SHANGO</label>
                  <input id="eqm-boitier" type="text" class="eqm-input eqm-input-readonly" [value]="boitierIdPreview" readonly />
                </div>

                <div class="eqm-field eqm-field--full">
                  <label class="eqm-label" for="eqm-photo">Photo de l'équipement</label>
                  <input id="eqm-photo" type="file" accept="image/*" class="eqm-input eqm-input-file" (change)="onPhotoSelected($event)" />
                  @if (photoDataUrl) {
                    <div class="eqm-photo-preview">
                      <img [src]="photoDataUrl" alt="Aperçu de la photo de l'équipement" />
                      <button type="button" class="eqm-photo-remove" (click)="removePhoto()" title="Retirer la photo">
                        <i class="fa-solid fa-xmark"></i>
                      </button>
                    </div>
                  }
                </div>

                <!-- Périmètre autorisé -->
                <div class="eqm-field eqm-field--full">
                  <label class="eqm-checkbox-label">
                    <input type="checkbox" [(ngModel)]="perimetreActif" name="perimetreActif" />
                    Définir un périmètre (zone à ne pas dépasser)
                  </label>
                  @if (perimetreActif) {
                    <div class="eqm-perimetre-field">
                      <label class="eqm-label" for="eqm-perimetre">Rayon autorisé (mètres)</label>
                      <input
                        id="eqm-perimetre"
                        name="perimetreMetres"
                        type="number"
                        min="1"
                        class="eqm-input"
                        placeholder="Ex : 500"
                        [(ngModel)]="perimetreMetres"
                      />
                      <span class="eqm-hint">Une fois la position GPS reçue, tout dépassement de ce rayon déclenchera une alerte « Déplacement non autorisé ».</span>
                    </div>
                  }
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
      width: 100%; max-width: 900px;
      max-height: 94vh; overflow-y: auto;
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
    .eqm-hint { font-size: 11.5px; color: #94A3B8; line-height: 1.5; }

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
    .eqm-input-readonly { background: #F8FAFC; color: #64748B; cursor: not-allowed; }
    .eqm-input-readonly:hover { border-color: #E2E8F0; }
    .eqm-input-file { padding: 8px 10px; cursor: pointer; }

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
      max-height: 260px; overflow-y: auto;
    }
    .eqm-select-option {
      display: flex; align-items: center; justify-content: space-between; gap: 8px;
      padding: 9px 12px; border-radius: 8px; font-size: 13.5px; color: #334155;
      cursor: pointer; transition: background 0.15s ease, color 0.15s ease;
    }
    .eqm-select-option:hover { background: #EFF6FF; color: #1D4ED8; }
    .eqm-select-option--selected { background: #EFF6FF; color: #1D4ED8; font-weight: 600; }
    .eqm-select-option i { font-size: 12px; }

    .eqm-checkbox-label {
      display: flex; align-items: center; gap: 10px;
      font-size: 13px; font-weight: 600; color: #334155; cursor: pointer;
    }
    .eqm-checkbox-label input[type="checkbox"] { width: 16px; height: 16px; accent-color: #2563EB; cursor: pointer; }
    .eqm-perimetre-field {
      display: flex; flex-direction: column; gap: 6px;
      margin-top: 12px; padding: 14px; border-radius: 10px;
      background: #F8FAFC; border: 1px solid #E2E8F0;
      animation: eqmSlideIn 0.25s ease both;
    }

    .eqm-photo-preview {
      position: relative; margin-top: 10px; width: 140px; height: 140px;
      border-radius: 10px; overflow: hidden; border: 1px solid #E2E8F0;
    }
    .eqm-photo-preview img { width: 100%; height: 100%; object-fit: cover; display: block; }
    .eqm-photo-remove {
      position: absolute; top: 6px; right: 6px;
      width: 24px; height: 24px; border-radius: 50%;
      background: rgba(15, 23, 42, 0.6); color: #FFF; border: none;
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; font-size: 11px;
    }
    .eqm-photo-remove:hover { background: rgba(15, 23, 42, 0.8); }

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

  protected readonly typesEquipement = TYPES_EQUIPEMENT;

  clientNom = '';
  clientNumero = '';
  private equipmentIdPreview = '';
  boitierIdPreview = '';
  type = '';
  protected typeOpen = signal(false);
  marqueModele = '';
  site = '';
  photoDataUrl: string | null = null;
  perimetreActif = false;
  perimetreMetres: number | null = null;
  description = '';

  protected submitted = signal(false);
  protected isSubmitting = signal(false);
  protected message = signal('');
  protected messageType: WritableSignal<'success' | 'error'> = signal<'success' | 'error'>('success');

  constructor(private equipmentService: EquipmentService) {}

  /** Ouvre la modale (appelé par le parc d'équipement) */
  show(): void {
    this.reset();
    this.equipmentIdPreview = this.equipmentService.generateEquipmentId();
    this.boitierIdPreview = this.equipmentService.generateBoitierId();
    this.open.set(true);
  }

  close(): void {
    this.open.set(false);
    this.reset();
  }

  private reset(): void {
    this.clientNom = '';
    this.clientNumero = '';
    this.equipmentIdPreview = '';
    this.boitierIdPreview = '';
    this.type = '';
    this.typeOpen.set(false);
    this.marqueModele = '';
    this.site = '';
    this.photoDataUrl = null;
    this.perimetreActif = false;
    this.perimetreMetres = null;
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

  onPhotoSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onloadend = () => {
      this.photoDataUrl = reader.result as string;
    };
    reader.readAsDataURL(file);
  }

  removePhoto(): void {
    this.photoDataUrl = null;
  }

  onSubmit(): void {
    this.submitted.set(true);
    this.message.set('');

    const clientNom = this.clientNom.trim();

    if (!clientNom || !this.type) {
      this.message.set('Veuillez remplir tous les champs obligatoires.');
      this.messageType.set('error');
      return;
    }

    this.isSubmitting.set(true);

    const miseEnLigne = new Date().toLocaleDateString('fr-FR', {
      day: 'numeric', month: 'long', year: 'numeric'
    });

    const equipment: Equipment = {
      id: this.equipmentIdPreview,
      nom: `${this.type} — ${clientNom}`,
      statut: 'En ligne',
      localisation: 'En attente du GPS (IoT)',
      lienLocalisation: 'En attente du GPS (IoT)',
      miseEnLigne,
      type: this.type,
      description: this.description.trim(),
      temperature: null,
      tension: null,
      bloque: false,
      marqueModele: this.marqueModele.trim() || undefined,
      clientNom,
      clientNumero: this.clientNumero.trim() || undefined,
      site: this.site.trim() || undefined,
      boitierId: this.boitierIdPreview,
      photoDataUrl: this.photoDataUrl || undefined,
      perimetreMetres: this.perimetreActif && this.perimetreMetres ? this.perimetreMetres : undefined
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
