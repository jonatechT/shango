import { Component, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterLink } from '@angular/router';
import { Structure, StructureStatus } from '../../models/structure.model';
import { StructureService } from '../../services/structure.service';

@Component({
  selector: 'app-structure-form',
  standalone: true,
  imports: [FormsModule, RouterLink],
  templateUrl: './structure-form.html',
  styleUrl: '../../superadmin-styles.scss',
  styles: [`
    /* ============================================================
       Page "Ajouter structure" — Design ÉPURÉ (flat)
       Palette bleue, sans cartes, sans décorations
       --primary: #1E3A8A (bleu) · --accent: #3B82F6 (bleu clair)
       Typographie : Inter (déjà chargée par l'application)
       ============================================================ */

    :host {
      --primary: #1E3A8A;
      --primary-hover: #16307A;
      --accent: #3B82F6;
      --accent-hover: #2563EB;
      --primary-light: #EFF6FF;
      --primary-soft: #DBEAFE;
      --input-border: #CBD5E1;
      --input-border-hover: #94A3B8;
      --text-primary: #0F172A;
      --text-secondary: #64748B;
      --text-muted: #94A3B8;
      --border-color: #E2E8F0;

      display: block;
      width: 100%;
      min-height: 100vh;
      background: #FFFFFF;
      font-family: 'Inter', sans-serif;
      color: var(--text-primary);
    }

    /* ===== Conteneur de page ===== */
    /* Pas de padding-top : le titre repose directement sous la topbar,
       exactement comme sur la page "Gestion des structures". */
    .sf-page {
      width: 100%;
      min-height: 100vh;
      background: #FFFFFF;
      margin: 0;
      padding: 0 24px 24px;
    }

    /* ===== Titre de page : classes partagées sa-page-header / sa-title / sa-subtitle =====
       On utilise exactement le style partagé (justify-content: space-between →
       alignement à gauche). On avance le titre vers la gauche et le haut en
       sortant du padding de .sa-content (24px). */
    .sa-page-header {
      margin: -6px -6px 24px;
    }
    @media (max-width: 768px) {
      .sa-page-header { margin: -4px -4px 24px; }
    }

    /* ===== Formulaire (centrée, largeur max 960px) ===== */
    .sf-form {
      width: 100%;
      max-width: 960px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 0;
      padding: 0 4px;
    }

    /* ===== Carte : Administrateur ===== */
    /* margin négatif + padding horizontal identiques : la carte s'élargit
       horizontalement (au-delà du formulaire) sans augmenter la largeur
       d'affichage des champs à l'intérieur. */
    .sf-card {
      margin: 24px -24px;
      padding: 24px 24px;
      background: #FFFFFF;
      border-radius: 12px;
      border: 1px solid #E2E8F0;
      box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.04);
    }

    /* ===== Sections ===== */
    .sf-section-head {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 22px;
    }
    .sf-section {
      margin-bottom: 28px;
    }
    .sf-section:last-of-type {
      margin-bottom: 0;
    }
    .sf-icon {
      width: 34px;
      height: 34px;
      border-radius: 10px;
      background: var(--primary-light);
      color: var(--primary);
      display: inline-flex;
      align-items: center;
      justify-content: center;
      font-size: 14px;
      flex-shrink: 0;
    }
    .sf-icon-blue {
      background: #EFF6FF;
      color: var(--accent);
    }
    .sf-section-title {
      font-size: 17px;
      font-weight: 600;
      color: var(--text-primary);
      margin: 0;
    }
    .sf-section-sub {
      font-size: 13px;
      font-weight: 400;
      color: var(--text-secondary);
      margin: 2px 0 0;
    }
    .sf-tag {
      margin-left: auto;
      padding: 4px 12px;
      border-radius: 999px;
      font-size: 11px;
      font-weight: 600;
      letter-spacing: 0.3px;
      text-transform: uppercase;
      background: var(--primary-light);
      color: var(--primary);
      border: 1px solid var(--primary-soft);
    }
    .sf-divider {
      height: 1px;
      background: var(--border-color);
      margin: 32px 0;
    }

    /* ===== Grille des champs ===== */
    .sf-grid {
      display: grid;
      grid-template-columns: repeat(2, minmax(0, 1fr));
      gap: 20px 24px;
      margin-bottom: 20px;
      align-items: stretch;
    }
    .sf-grid-3 {
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .sf-field {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 0;
    }
    .sf-field .sf-input,
    .sf-field .sf-textarea,
    .sf-field .sf-select {
      margin-top: auto;
    }
    .sf-full { margin-bottom: 20px; }

    /* ===== Labels ===== */
    .sf-label {
      display: block;
      font-size: 13px;
      font-weight: 500;
      color: #334155;
      line-height: 1.4;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .sf-required { color: #EF4444; font-weight: 600; }

    /* ===== Inputs ===== */
    .sf-input {
      width: 100%;
      height: 44px;
      padding: 0 14px;
      background: #FFFFFF;
      border: 1px solid var(--input-border);
      border-radius: 8px;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      color: var(--text-primary);
      outline: none;
      transition:
        border-color 0.2s ease,
        box-shadow 0.2s ease;
    }
    .sf-input::placeholder { color: var(--text-muted); }
    .sf-input:hover { border-color: var(--input-border-hover); }
    .sf-input:focus {
      border-color: var(--primary);
      box-shadow: 0 0 0 3px rgba(30, 58, 138, 0.12);
    }
    .sf-select {
      appearance: none;
      cursor: pointer;
      background-color: #FFFFFF;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%233B82F6' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
      background-repeat: no-repeat;
      background-position: right 14px center;
      padding-right: 42px;
      font-weight: 500;
      transition: border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
    }
    .sf-select:hover {
      border-color: var(--accent);
      background-color: #F8FAFC;
    }
    .sf-select:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.15);
      background-color: #FFFFFF;
    }
    /* Liste déroulante : options plus lisibles et espacées */
    .sf-select option {
      padding: 10px 14px;
      font-size: 14px;
      font-weight: 500;
      color: var(--text-primary);
      background: #FFFFFF;
    }
    .sf-textarea {
      height: auto;
      min-height: 96px;
      padding: 12px 14px;
      resize: vertical;
      line-height: 1.55;
    }

    /* ===== Note d'information ===== */
    .sf-note {
      display: flex;
      align-items: flex-start;
      gap: 10px;
      margin-top: 24px;
      padding: 14px 16px;
      border-radius: 8px;
      font-size: 13px;
      line-height: 1.5;
      background: var(--primary-light);
      color: var(--primary);
      border: 1px solid var(--primary-soft);
    }
    .sf-note i { color: var(--primary); margin-top: 2px; font-size: 13px; }

    /* ===== Actions ===== */
    /* Zone « footer » du formulaire : compactée (elle occupait trop d'espace) */
    .sf-actions {
      display: flex;
      justify-content: flex-end;
      align-items: center;
      gap: 12px;
      margin-top: 14px;
      padding-top: 10px;
      border-top: 1px solid var(--border-color);
    }

    /* ===== Boutons ===== */
    .sf-btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      height: 44px;
      padding: 0 22px;
      border-radius: 10px;
      font-family: 'Inter', sans-serif;
      font-size: 14px;
      font-weight: 600;
      cursor: pointer;
      text-decoration: none;
      transition:
        background-color 0.2s ease,
        border-color 0.2s ease,
        transform 0.2s ease,
        box-shadow 0.2s ease;
    }
    .sf-btn-primary {
      background: linear-gradient(135deg, var(--primary), var(--accent));
      color: #FFFFFF;
      border: none;
      box-shadow: 0 4px 14px rgba(30, 58, 138, 0.25);
    }
    .sf-btn-primary:hover:not(:disabled) {
      background: linear-gradient(135deg, var(--primary-hover), var(--accent-hover));
      transform: translateY(-1px);
      box-shadow: 0 8px 20px rgba(30, 58, 138, 0.30);
    }
    .sf-btn-primary:active:not(:disabled) { transform: translateY(0); }
    .sf-btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .sf-btn-secondary {
      background: #FFFFFF;
      color: #475569;
      border: 1px solid var(--input-border);
    }
    .sf-btn-secondary:hover {
      background: #F8FAFC;
      border-color: var(--input-border-hover);
    }

    /* ===== Spinner ===== */
    .sf-spinner {
      width: 16px;
      height: 16px;
      border: 2px solid rgba(255, 255, 255, 0.35);
      border-top-color: #FFFFFF;
      border-radius: 50%;
      animation: sf-spin 0.7s linear infinite;
    }
    @keyframes sf-spin { to { transform: rotate(360deg); } }

    /* ===== Responsive ===== */
    @media (max-width: 1024px) {
      .sf-grid-3 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }

    @media (max-width: 768px) {
      .sf-page { padding: 16px; }
      .sf-card { margin: 24px 0; padding: 20px; }
      .sf-form { padding: 0; }
      .sf-grid,
      .sf-grid-3 { grid-template-columns: 1fr; gap: 16px; }
      .sf-grid-3 > .sf-field { margin-bottom: 0; }
      .sf-divider { margin: 24px 0; }
      .sf-actions {
        flex-direction: column-reverse;
        gap: 10px;
      }
      .sf-actions > * { width: 100%; }
    }
  `]
})
export class StructureFormComponent implements OnInit {
  protected isEditMode = false;
  protected structureId = '';
  protected isSaving = signal(false);
  protected message = signal('');
  protected messageType = signal<'success' | 'error'>('success');
  /** Email de l'admin AVANT modification (permet de retrouver son compte même si l'email change). */
  private originalAdminEmail = '';

  protected formData: {
    nom: string;
    code: string;
    description: string;
    email: string;
    telephone: string;
    adresse: string;
    ville: string;
    pays: string;
    statut: StructureStatus;
    adminNom: string;
    adminEmail: string;
    adminTelephone: string;
    adminMotDePasse: string;
  } = {
    nom: '',
    code: '',
    description: '',
    email: '',
    telephone: '',
    adresse: '',
    ville: '',
    pays: '',
    statut: 'ACTIVE',
    adminNom: '',
    adminEmail: '',
    adminTelephone: '',
    adminMotDePasse: ''
  };

  constructor(
    private structureService: StructureService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit(): void {
    this.structureId = this.route.snapshot.paramMap.get('id') || '';
    this.isEditMode = !!this.structureId;

    if (this.isEditMode) {
      const s = this.structureService.getStructure(this.structureId);
      if (s) {
        this.formData = {
          nom: s.nom,
          code: s.code,
          description: s.description,
          email: s.email,
          telephone: s.telephone,
          adresse: s.adresse,
          ville: s.ville,
          pays: s.pays,
          statut: s.statut,
          adminNom: s.adminNom || '',
          adminEmail: s.adminEmail || '',
          adminTelephone: s.adminTelephone || '',
          adminMotDePasse: ''
        };
        this.originalAdminEmail = s.adminEmail || '';
      } else {
        this.message.set('Structure introuvable.');
        this.messageType.set('error');
      }
    }
  }

  protected onSubmit(): void {
    this.message.set('');
    this.isSaving.set(true);

    // Validation
    if (!this.formData.nom.trim() || !this.formData.code.trim() || !this.formData.email.trim()) {
      this.message.set('Veuillez remplir tous les champs obligatoires (*).');
      this.messageType.set('error');
      this.isSaving.set(false);
      return;
    }

    if (this.formData.email && !this.isValidEmail(this.formData.email)) {
      this.message.set('Veuillez saisir un email valide.');
      this.messageType.set('error');
      this.isSaving.set(false);
      return;
    }

    if (this.formData.adminEmail && !this.isValidEmail(this.formData.adminEmail)) {
      this.message.set('Veuillez saisir un email valide pour l\'administrateur.');
      this.messageType.set('error');
      this.isSaving.set(false);
      return;
    }

    if (this.formData.adminMotDePasse && this.formData.adminMotDePasse.length < 8) {
      this.message.set('Le mot de passe doit contenir au moins 8 caractères.');
      this.messageType.set('error');
      this.isSaving.set(false);
      return;
    }

    // Création : un administrateur avec mot de passe est obligatoire (sinon
    // personne ne peut se connecter à la structure). Édition : si aucun admin
    // n'existait encore, les 3 champs sont requis ensemble pour en créer un.
    const adminCompletable = !this.originalAdminEmail && (this.formData.adminNom.trim() || this.formData.adminEmail.trim() || this.formData.adminMotDePasse.trim());
    if (!this.isEditMode || adminCompletable) {
      if (!this.formData.adminNom.trim() || !this.formData.adminEmail.trim() || !this.formData.adminMotDePasse.trim()) {
        this.message.set("Nom, email et mot de passe de l'administrateur sont obligatoires.");
        this.messageType.set('error');
        this.isSaving.set(false);
        return;
      }
      if (this.formData.adminMotDePasse.length < 8) {
        this.message.set('Le mot de passe doit contenir au moins 8 caractères.');
        this.messageType.set('error');
        this.isSaving.set(false);
        return;
      }
    }

    const common = {
      nom: this.formData.nom,
      code: this.formData.code,
      description: this.formData.description,
      email: this.formData.email,
      telephone: this.formData.telephone,
      adresse: this.formData.adresse,
      ville: this.formData.ville,
      pays: this.formData.pays,
      statut: this.formData.statut,
      adminNom: this.formData.adminNom.trim() || undefined,
      adminEmail: this.formData.adminEmail.trim().toLowerCase() || undefined,
      adminTelephone: this.formData.adminTelephone.trim() || undefined,
      adminMotDePasse: this.formData.adminMotDePasse.trim() || undefined
    };

    if (this.isEditMode) {
      this.structureService.updateStructure(this.structureId, common).subscribe(updated => {
        this.isSaving.set(false);
        if (updated) {
          this.message.set(this.structureService.error() || `La structure « ${updated.nom} » a été modifiée avec succès.`);
          this.messageType.set(this.structureService.error() ? 'error' : 'success');
          setTimeout(() => {
            this.router.navigate(['/superadmin/structures', this.structureId]);
          }, 1500);
        } else {
          this.message.set(this.structureService.error() || 'Une erreur est survenue lors de la modification.');
          this.messageType.set('error');
        }
      });
    } else {
      this.structureService.createStructure(common).subscribe(created => {
        this.isSaving.set(false);
        if (created) {
          this.message.set(this.structureService.error() || `La structure « ${created.nom} » a été créée avec succès.`);
          this.messageType.set(this.structureService.error() ? 'error' : 'success');
          setTimeout(() => {
            this.router.navigate(['/superadmin/structures']);
          }, 1500);
        } else {
          this.message.set(this.structureService.error() || "Une erreur est survenue lors de la création.");
          this.messageType.set('error');
        }
      });
    }
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }
}
