import { Component, computed, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Structure } from '../../models/structure.model';
import { StructureService } from '../../services/structure.service';
import {
  INDICATIFS_TELEPHONE,
  getIndicatif,
  getPhoneLength,
  phonePlaceholder,
  sanitizePhoneDigits
} from '../../../core/phone-indicatifs';

interface StructureForm {
  nom: string;
  code: string;
  email: string;
  indicatif: string;
  telephone: string;
  adresse: string;
  ville: string;
  pays: string;
  statut: 'ACTIVE' | 'INACTIVE';
  description: string;
  adminNom: string;
  adminEmail: string;
  adminIndicatif: string;
  adminTelephone: string;
  adminMotDePasse: string;
}

@Component({
  selector: 'app-structures-list',
  standalone: true,
  imports: [FormsModule, RouterLink, CommonModule],
  templateUrl: './structures-list.html',
  styleUrl: '../../superadmin-styles.scss'
})
export class StructuresListComponent implements OnInit {
  protected searchTerm = signal('');
  protected statusFilter = signal('');
  protected isLoading = signal(true);
  protected message = signal('');
  protected messageType = signal<'success' | 'error'>('success');
  protected showConfirmModal = signal(false);
  protected selectedStructure = signal<Structure | null>(null);

  // Modale « Ajouter une structure » (4 étapes)
  protected showCreateModal = signal(false);
  protected step = signal<1 | 2 | 3 | 4>(1);
  protected stepError = signal('');
  protected isSaving = signal(false);

  protected form: StructureForm = this.emptyForm();
  protected readonly indicatifs = INDICATIFS_TELEPHONE;

  protected filteredStructures = computed(() => {
    const all = this.structureService.getAllStructures();
    const term = this.searchTerm().toLowerCase().trim();
    const status = this.statusFilter();
    return all.filter(s => {
      const matchesTerm = !term ||
        s.nom.toLowerCase().includes(term) ||
        s.code.toLowerCase().includes(term) ||
        s.email.toLowerCase().includes(term) ||
        s.ville.toLowerCase().includes(term);
      const matchesStatus = !status || s.statut === status;
      return matchesTerm && matchesStatus;
    });
  });

  constructor(
    private structureService: StructureService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.structureService.load();
    this.isLoading.set(false);
  }
protected verStructure(id: string): void {
    this.router.navigate(['/superadmin/structures', id]);
  }

  protected confirmToggleStatus(structure: Structure): void {
    this.selectedStructure.set(structure);
    this.showConfirmModal.set(true);
  }

  protected cancelModal(): void {
    this.showConfirmModal.set(false);
    this.selectedStructure.set(null);
  }

  protected confirmToggle(): void {
    const s = this.selectedStructure();
    if (!s) return;
    this.structureService.toggleStatus(s.id).subscribe(updated => {
      if (updated) {
        const action = updated.statut === 'ACTIVE' ? 'activée' : 'désactivée';
        this.message.set(`La structure « ${updated.nom} » a été ${action} avec succès.`);
        this.messageType.set('success');
        setTimeout(() => this.message.set(''), 4000);
      } else {
        this.message.set(this.structureService.error() || 'Une erreur est survenue.');
        this.messageType.set('error');
      }
    });
    this.cancelModal();
  }

  // ===== Modale « Ajouter une structure » (4 étapes) =====

  private emptyForm(): StructureForm {
    return {
      nom: '',
      code: '',
      email: '',
      indicatif: '+226',
      telephone: '',
      adresse: '',
      ville: '',
      pays: '',
      statut: 'ACTIVE',
      description: '',
      adminNom: '',
      adminEmail: '',
      adminIndicatif: '+226',
      adminTelephone: '',
      adminMotDePasse: ''
    };
  }

  protected openCreateModal(): void {
    this.form = this.emptyForm();
    this.step.set(1);
    this.stepError.set('');
    this.message.set('');
    this.isSaving.set(false);
    this.showCreateModal.set(true);
  }

  protected closeCreateModal(): void {
    this.showCreateModal.set(false);
    this.stepError.set('');
  }

  private isValidEmail(email: string): boolean {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  }

  /** Génère un code identifiant unique (slug) à partir du nom de la structure */
  private genererCodeStructure(nom: string): string {
    const slug = nom
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '');
    return `STR-${slug.slice(0, 40)}${slug ? '' : Math.floor(1000 + Math.random() * 9000)}`;
  }

  protected nextStep(): void {
    this.stepError.set('');
    this.message.set('');

    const s = this.step();
    if (s === 1) {
      const f = this.form;
      if (!f.nom.trim()) { this.stepError.set('Le nom de la structure est obligatoire.'); return; }
      if (!f.email.trim() || !this.isValidEmail(f.email)) { this.stepError.set('Veuillez saisir un email valide pour la structure.'); return; }
      if (f.telephone.trim() && f.telephone.trim().length !== this.getPhoneLength(f.indicatif)) {
        this.stepError.set(`Le numéro doit contenir exactement ${this.getPhoneLength(f.indicatif)} chiffres pour l'indicatif ${f.indicatif}.`);
        return;
      }
      this.step.set(2);
    } else if (s === 2) {
      const f = this.form;
      if (!f.ville.trim()) { this.stepError.set('La ville est obligatoire.'); return; }
      if (!f.pays.trim()) { this.stepError.set('Le pays est obligatoire.'); return; }
      this.step.set(3);
    } else if (s === 3) {
      const f = this.form;
      if (!f.adminNom.trim()) { this.stepError.set("Le nom complet de l'administrateur est obligatoire."); return; }
      if (!f.adminEmail.trim() || !this.isValidEmail(f.adminEmail)) {
        this.stepError.set("Veuillez saisir un email valide pour l'administrateur.");
        return;
      }
      if (!f.adminMotDePasse || f.adminMotDePasse.length < 8) {
        this.stepError.set('Le mot de passe est obligatoire (8 caractères minimum) : sans lui, personne ne pourra se connecter à cette structure.');
        return;
      }
      if (f.adminTelephone.trim() && f.adminTelephone.trim().length !== this.getPhoneLength(f.adminIndicatif)) {
        this.stepError.set(`Le numéro de l'administrateur doit contenir exactement ${this.getPhoneLength(f.adminIndicatif)} chiffres pour l'indicatif ${f.adminIndicatif}.`);
        return;
      }
      this.step.set(4);
    }
  }

  protected prevStep(): void {
    this.stepError.set('');
    this.message.set('');
    if (this.step() > 1) {
      this.step.update(v => (v - 1) as 1 | 2 | 3 | 4);
    }
  }

  /** Combine l'indicatif et le numéro saisi (ex. "+226" + "70 12 34 56" → "+226 70 12 34 56"). */
  private telephoneComplet(indicatif: string, numero: string): string {
    const n = numero.trim();
    return n ? `${indicatif} ${n}` : '';
  }

  /** Nombre de chiffres attendu pour l'indicatif donné (8 par défaut). */
  protected getPhoneLength(indicatif: string): number {
    return getPhoneLength(indicatif);
  }

  /** Détails (pays, drapeau) de l'indicatif sélectionné. */
  protected getIndicatif(code: string) {
    return getIndicatif(code);
  }

  // ===== Menu déroulant personnalisé (drapeau + indicatif) =====
  // Un <select> natif ne peut afficher que du texte dans ses <option> : pour
  // montrer un vrai drapeau (flag-icons), il faut un menu déroulant "maison".
  protected indicatifMenuOpen = signal(false);
  protected adminIndicatifMenuOpen = signal(false);

  protected toggleIndicatifMenu(which: 'indicatif' | 'adminIndicatif'): void {
    if (which === 'indicatif') {
      this.indicatifMenuOpen.update(v => !v);
      this.adminIndicatifMenuOpen.set(false);
    } else {
      this.adminIndicatifMenuOpen.update(v => !v);
      this.indicatifMenuOpen.set(false);
    }
  }

  protected closeIndicatifMenus(): void {
    this.indicatifMenuOpen.set(false);
    this.adminIndicatifMenuOpen.set(false);
  }

  protected selectIndicatif(which: 'indicatif' | 'adminIndicatif', code: string): void {
    this.form[which] = code;
    const field = which === 'indicatif' ? 'telephone' : 'adminTelephone';
    // Retronque le numéro déjà saisi si le nouveau pays a une longueur plus courte.
    this.form[field] = this.form[field].slice(0, this.getPhoneLength(code));
    this.closeIndicatifMenus();
  }

  /** Espace réservé dynamique (ex. "XX XX XX XX" pour 8 chiffres, "XX XX XX XX XX" pour 10). */
  protected phonePlaceholder(indicatif: string): string {
    return phonePlaceholder(indicatif);
  }

  /**
   * Nettoie la saisie du numéro (chiffres uniquement) et la tronque à la
   * longueur exacte attendue pour l'indicatif sélectionné — impossible de
   * dépasser cette longueur ; la validation d'étape empêche de valider en
   * dessous.
   */
  protected setPhone(field: 'telephone' | 'adminTelephone', indicatifField: 'indicatif' | 'adminIndicatif', value: string): void {
    this.form[field] = sanitizePhoneDigits(value, this.form[indicatifField]);
  }

  protected submitCreate(): void {
    this.stepError.set('');
    this.message.set('');
    this.isSaving.set(true);

    const f = this.form;
    this.structureService.createStructure({
      nom: f.nom.trim(),
      code: this.genererCodeStructure(f.nom.trim()),
      description: f.description.trim(),
      email: f.email.trim().toLowerCase(),
      telephone: this.telephoneComplet(f.indicatif, f.telephone),
      adresse: f.adresse.trim(),
      ville: f.ville.trim(),
      pays: f.pays.trim(),
      statut: f.statut,
      adminNom: f.adminNom.trim() || undefined,
      adminEmail: f.adminEmail.trim().toLowerCase() || undefined,
      adminTelephone: this.telephoneComplet(f.adminIndicatif, f.adminTelephone) || undefined,
      adminMotDePasse: f.adminMotDePasse || undefined
    }).subscribe(created => {
      this.isSaving.set(false);
      if (!created) {
        this.stepError.set(this.structureService.error() || 'Une erreur est survenue lors de la création.');
        return;
      }

      const errorMsg = this.structureService.error();
      this.message.set(errorMsg || `La structure « ${created.nom} » a été créée avec succès.`);
      this.messageType.set(errorMsg ? 'error' : 'success');

      setTimeout(() => {
        this.closeCreateModal();
        this.message.set(errorMsg || `La structure « ${created.nom} » a été créée avec succès.`);
        this.messageType.set(errorMsg ? 'error' : 'success');
        setTimeout(() => this.message.set(''), 4000);
      }, 1200);
    });
  }
}