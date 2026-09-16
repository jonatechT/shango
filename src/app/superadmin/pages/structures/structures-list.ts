import { Component, computed, OnInit, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { Structure } from '../../models/structure.model';
import { StructureService } from '../../services/structure.service';
import { AuthService, User } from '../../../auth/auth.service';

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

/** Indicatifs téléphoniques proposés dans le formulaire (Afrique de l'Ouest en priorité). */
export const INDICATIFS_TELEPHONE: { code: string; pays: string }[] = [
  { code: '+226', pays: 'Burkina Faso' },
  { code: '+225', pays: "Côte d'Ivoire" },
  { code: '+223', pays: 'Mali' },
  { code: '+227', pays: 'Niger' },
  { code: '+228', pays: 'Togo' },
  { code: '+229', pays: 'Bénin' },
  { code: '+221', pays: 'Sénégal' },
  { code: '+233', pays: 'Ghana' },
  { code: '+234', pays: 'Nigeria' },
  { code: '+237', pays: 'Cameroun' },
  { code: '+241', pays: 'Gabon' },
  { code: '+33', pays: 'France' },
  { code: '+1', pays: 'États-Unis / Canada' }
];

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
    private authService: AuthService,
    private router: Router
  ) {}

  ngOnInit(): void {
    // Simulate a small load time for UX
    setTimeout(() => this.isLoading.set(false), 300);
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
    const updated = this.structureService.toggleStatus(s.id);
    if (updated) {
      const action = updated.statut === 'ACTIVE' ? 'activée' : 'désactivée';
      this.message.set(`La structure « ${updated.nom} » a été ${action} avec succès.`);
      this.messageType.set('success');
      setTimeout(() => this.message.set(''), 4000);
    }
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

  protected submitCreate(): void {
    this.stepError.set('');
    this.message.set('');
    this.isSaving.set(true);

    const f = this.form;
    setTimeout(() => {
      const created = this.structureService.createStructure({
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
        adminTelephone: this.telephoneComplet(f.adminIndicatif, f.adminTelephone) || undefined
      });

      // Créer l'administrateur de structure si renseigné
      if (f.adminNom.trim() && f.adminEmail.trim() && f.adminMotDePasse) {
        const adminUser: User = {
          id: Date.now(),
          name: f.adminNom.trim(),
          email: f.adminEmail.trim().toLowerCase(),
          role: 'ADMIN_STRUCTURE',
          structureId: created.id,
          statut: 'ACTIVE',
          telephone: this.telephoneComplet(f.adminIndicatif, f.adminTelephone) || undefined,
          dateCreation: new Date().toISOString(),
          motDePasse: f.adminMotDePasse
        };
        this.authService.registerUser(adminUser);
      }

      this.isSaving.set(false);
      this.message.set(`La structure « ${created.nom} » a été créée avec succès.`);
      this.messageType.set('success');

      setTimeout(() => {
        this.closeCreateModal();
        this.message.set(`La structure « ${created.nom} » a été créée avec succès.`);
        this.messageType.set('success');
        setTimeout(() => this.message.set(''), 4000);
      }, 1200);
    }, 500);
  }
}