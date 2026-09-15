import { Component, computed, signal } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CommonModule } from '@angular/common';
import { AuthService, User } from '../../auth/auth.service';
import { UsersService } from '../../services/users.service';
import { StructureService } from '../../superadmin/services/structure.service';

@Component({
  selector: 'app-users-list',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './users-list.html',
  styles: [`
    .users-page { display: flex; flex-direction: column; gap: 24px; }
    .users-header { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .users-header .users-btn-primary { position: relative; top: 5px; }
    .users-title { font-size: 24px; font-weight: 800; color: #0F172A; letter-spacing: -0.5px; }
    .users-subtitle { font-size: 14px; color: #64748B; margin-top: 4px; }
    .users-btn-primary { background: #2563EB; color: #FFF; border: none; padding: 10px 18px; border-radius: 8px; font-size: 13px; font-weight: 600; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; transition: all 0.2s ease; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); }
    .users-btn-primary i { color: #FFF; }
    .users-btn-primary:hover { background: #1D4ED8; transform: translateY(-1px); }
    .users-btn-secondary { background: #F1F5F9; color: #334155; border: 1px solid #E2E8F0; padding: 10px 18px; border-radius: 12px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
    .users-btn-secondary:hover { background: #E2E8F0; }
    .users-btn-danger { background: #FEF2F2; color: #EF4444; border: 1px solid #FECACA; padding: 10px 18px; border-radius: 12px; font-size: 13px; font-weight: 600; cursor: pointer; transition: all 0.2s ease; }
    .users-btn-danger:hover { background: #FEE2E2; }
    .users-btn-icon { width: 32px; height: 32px; border-radius: 6px; background: transparent; color: #64748B; display: inline-flex; align-items: center; justify-content: center; font-size: 13px; border: none; cursor: pointer; transition: all 0.15s ease; }
    .users-btn-icon:hover { background: #EFF6FF; color: #2563EB; }
    .users-icon-warning:hover { background: #FFFBEB; color: #F59E0B; }
    .users-alert { display: flex; align-items: center; gap: 10px; padding: 14px 16px; border-radius: 12px; font-size: 13px; font-weight: 500; margin-bottom: 20px; }
    .users-alert-success { background: #ECFDF5; color: #065F46; border: 1px solid #A7F3D0; }
    .users-alert-error { background: #FEF2F2; color: #991B1B; border: 1px solid #FECACA; }
    .users-card { background: #FFF; border-radius: 16px; padding: 24px; border: 1px solid #E2E8F0; box-shadow: 0 4px 16px rgba(15, 23, 42, 0.04); }
    /* Carte contenant un tableau : apparence de carte supprimée */
    .users-card--table { background: transparent; border: none; border-radius: 0; padding: 0; box-shadow: none; }
    .users-card-title { font-size: 16px; font-weight: 700; color: #0F172A; margin-bottom: 16px; }
    .users-detail-header { display: flex; align-items: center; gap: 14px; margin-bottom: 20px; padding-bottom: 16px; border-bottom: 1px solid #E2E8F0; }
    .users-detail-avatar { width: 52px; height: 52px; border-radius: 14px; background: linear-gradient(135deg, #1E3A8A, #3B5BDB); color: #FFF; font-size: 20px; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .users-detail-name { font-size: 17px; font-weight: 700; color: #0F172A; }
    .users-detail-sub { font-size: 12px; color: #64748B; }
    .users-detail-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px; }
    .users-detail-field { display: flex; flex-direction: column; gap: 4px; min-width: 0; }
    .users-detail-label { font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.4px; color: #94A3B8; }
    .users-detail-value { font-size: 14px; font-weight: 600; color: #0F172A; word-break: break-word; }
    .users-detail-value a { color: #2563EB; text-decoration: none; }
    .users-detail-value a:hover { text-decoration: underline; }
    .users-modal.users-modal--detail { max-width: 520px; }
    .users-modal.users-modal--add { max-width: 720px; }
    .users-modal-icon--info { background: #EFF6FF; color: #2563EB; }
    .users-form-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; }
    .users-form-group { display: flex; flex-direction: column; gap: 6px; }
    .users-form-label { font-size: 12px; font-weight: 600; color: #475569; }
    .users-form-input { padding: 12px 16px; border: 1px solid #E2E8F0; border-radius: 10px; font-size: 14px; color: #0F172A; background: rgba(255, 255, 255, 0.35); outline: none; transition: all 0.2s ease; font-family: 'Inter', sans-serif; box-shadow: 0 2px 4px rgba(15, 23, 42, 0.08); }
    .users-form-input:focus { border-color: #2563EB; background: rgba(255, 255, 255, 0.55); }
    .users-form-select { padding: 12px 16px; border: 1px solid #E2E8F0; border-radius: 10px; font-size: 14px; color: #0F172A; background: rgba(255, 255, 255, 0.35); outline: none; cursor: pointer; font-family: 'Inter', sans-serif; box-shadow: 0 2px 4px rgba(15, 23, 42, 0.08); }
    .users-form-select:focus { border-color: #2563EB; }
    .users-form-info { font-size: 12px; color: #94A3B8; margin-top: 8px; }
    .users-form-actions { display: flex; gap: 12px; justify-content: flex-end; margin-top: 20px; padding-top: 16px; border-top: 1px solid #F1F5F9; }
    .users-table-wrapper { overflow-x: auto; border: none; border-radius: 0; }
    .users-table { width: 100%; border-collapse: separate; border-spacing: 0 8px; font-size: 13px; }

    .users-table th {
      text-align: left;
      padding: 12px 14px;
      height: 40px;
      color: #FFFFFF;
      font-weight: 600;
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      background-color: #2563EB;
      border-bottom: 1px solid #2563EB;
      vertical-align: middle;
    }
    .users-table th:first-child { border-radius: 8px 0 0 8px; }
    .users-table th:last-child { text-align: right; border-radius: 0 8px 8px 0; }

    .users-table tbody tr {
      transition: background-color 0.15s ease, border-color 0.15s ease;
      background-color: #FFFFFF;
    }
    .users-table tbody tr.active {
      background-color: #2563EB;
    }
    .users-table tbody tr.active td {
      color: #FFFFFF;
      border-color: #2563EB;
    }
    .users-table td {
      background-color: #FFFFFF;
      padding: 13px 14px;
      border-top: 1px solid #E2E8F0;
      border-bottom: 1px solid #E2E8F0;
      color: #334155;
      vertical-align: middle;
    }
    .users-table tbody td:first-child { border-left: 1px solid #E2E8F0; border-radius: 8px 0 0 8px; color: #1E293B; font-weight: 600; font-size: 13px; }
    .users-table tbody td:last-child { border-right: 1px solid #E2E8F0; border-radius: 0 8px 8px 0; }
    .users-table tbody td:nth-child(2),
    .users-table tbody td:nth-child(3) { color: #64748B; font-size: 12px; }
    .users-table tbody td:last-child { text-align: right; }
    .users-table tbody tr:hover td { background-color: #F8FAFC; border-color: #BFDBFE; }
    .users-table tbody tr.active:hover td { background-color: #2563EB; border-color: #2563EB; }
    .users-cell-main { display: flex; align-items: center; gap: 10px; }
    .users-cell-avatar { width: 36px; height: 36px; border-radius: 10px; background: #EFF6FF; color: #2563EB; display: flex; align-items: center; justify-content: center; font-size: 14px; flex-shrink: 0; }
    .users-cell-name { font-weight: 600; color: #0F172A; }
    .users-cell-sub { font-size: 11px; color: #94A3B8; }
    .users-table tbody tr.active .users-cell-name,
    .users-table tbody tr.active .users-cell-sub { color: #FFFFFF; }
    .users-table tbody tr.active .users-cell-avatar { background: rgba(255, 255, 255, 0.2); color: #FFFFFF; }
    .users-badge { display: inline-flex; align-items: center; gap: 6px; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; white-space: nowrap; }
    .users-badge i { font-size: 6px; }
    .users-badge-active { background: #ECFDF5; color: #10B981; }
    .users-badge-inactive { background: #FEF2F2; color: #EF4444; }
    .users-empty { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 48px 24px; color: #94A3B8; }
    .users-empty-icon { font-size: 36px; color: #CBD5E1; }
    .users-modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(15, 23, 42, 0.35); display: flex; align-items: center; justify-content: center; z-index: 1000; backdrop-filter: blur(8px) saturate(1.2); -webkit-backdrop-filter: blur(8px) saturate(1.2); }
    .users-modal { background: #FFFFFF; border: 1px solid #E2E8F0; border-radius: 12px; padding: 0; width: 90%; max-width: 440px; max-height: 90vh; display: flex; flex-direction: column; overflow: hidden; box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08), 0 12px 32px rgba(15, 23, 42, 0.12), 0 24px 64px rgba(15, 23, 42, 0.2); }
    .users-modal-header { display: flex; align-items: center; gap: 12px; padding: 18px 20px; background: linear-gradient(180deg, #2563EB, #1D4ED8); border-bottom: 1px solid #1E40AF; border-radius: 20px 20px 0 0; margin: 0; flex-shrink: 0; }
    .users-modal-icon { width: 40px; height: 40px; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 16px; flex-shrink: 0; }
    .users-modal-icon-warning { background: rgba(255, 255, 255, 0.9); color: #F59E0B; border: 1px solid rgba(255, 255, 255, 0.3); }
    .users-modal-title { font-size: 18px; font-weight: 600; color: #FFFFFF; }
    .users-modal-body { flex: 1; min-height: 0; overflow-y: auto; font-size: 13px; color: #334155; line-height: 1.6; padding: 20px 24px; margin: 0; }
    .users-modal-body--form { display: flex; flex-direction: column; gap: 10px; }
    .users-modal-close { width: 32px; height: 32px; border-radius: 8px; border: none; background: rgba(255, 255, 255, 0.12); color: #FFFFFF; font-size: 14px; cursor: pointer; display: flex; align-items: center; justify-content: center; flex-shrink: 0; transition: all 0.15s ease; margin-left: auto; }
    .users-modal-close:hover { background: rgba(255, 255, 255, 0.22); color: #FFFFFF; }
    .users-modal-actions { display: flex; justify-content: flex-end; gap: 12px; padding: 0 24px 22px; flex-shrink: 0; }

    @media (max-width: 1024px) {
      .users-table-wrapper { overflow-x: auto; }
    }

    @media (max-width: 768px) {
      .users-header { flex-direction: column; align-items: flex-start; }
      .users-form-grid { grid-template-columns: 1fr; }
      .users-form-actions { flex-direction: column-reverse; }
      .users-form-actions button { width: 100%; justify-content: center; }
      .users-card { padding: 16px; }
      .users-table { font-size: 12px; }
      .users-table th, .users-table td { padding: 10px 12px; }
      .users-modal { padding: 16px; }
    }
  `]
})
export class UsersListComponent {
  protected showForm = signal(false);
  protected showAddModal = signal(false);
  protected message = signal('');
  protected messageType = signal<'success' | 'error'>('success');
  protected showConfirmModal = signal(false);
  protected selectedUser = signal<User | null>(null);
  protected showDetailModal = signal(false);
  protected selectedTech = signal<User | null>(null);

  protected formData: {
    nom: string;
    prenom: string;
    email: string;
    telephone: string;
    motDePasse: string;
    statut: 'ACTIVE' | 'INACTIVE';
  } = {
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    motDePasse: '',
    statut: 'ACTIVE'
  };

  protected users = computed(() => {
    const structureId = this.authService.structureId;
    if (!structureId) return [];
    // Ne montrer que les techniciens (rôle USER) de la structure,
    // jamais les admins de structure
    return this.usersService.getUsersByStructure(structureId).filter(u => u.role !== 'ADMIN_STRUCTURE');
  });

  protected structureName = computed(() => {
    const structureId = this.authService.structureId;
    if (!structureId) return '—';
    const structure = this.structureService.getStructure(structureId);
    return structure?.nom || structureId;
  });

  constructor(
    private authService: AuthService,
    private usersService: UsersService,
    private structureService: StructureService
  ) {}

  protected toggleForm(): void {
    this.showForm.set(!this.showForm());
    if (!this.showForm()) {
      this.resetForm();
    }
  }

  /** Ouvre la fenêtre modale d'ajout de technicien */
  protected openAddModal(): void {
    this.showAddModal.set(true);
  }

  /** Ferme la fenêtre modale d'ajout de technicien */
  protected closeAddModal(): void {
    this.showAddModal.set(false);
    this.resetForm();
  }

  protected createUser(): void {
    this.message.set('');
    const fullName = `${this.formData.prenom} ${this.formData.nom}`.trim();
    if (!this.formData.nom.trim() || !this.formData.prenom.trim() || !this.formData.email.trim()) {
      this.message.set('Veuillez remplir tous les champs obligatoires (*).');
      this.messageType.set('error');
      return;
    }
    if (this.formData.motDePasse.length < 8) {
      this.message.set('Le mot de passe doit contenir au moins 8 caractères.');
      this.messageType.set('error');
      return;
    }
    const structureId = this.authService.structureId;
    if (!structureId) {
      this.message.set('Structure introuvable.');
      this.messageType.set('error');
      return;
    }
    const newUser: User = {
      id: Date.now(),
      name: fullName,
      email: this.formData.email.toLowerCase(),
      role: 'USER',
      structureId,
      statut: this.formData.statut,
      telephone: this.formData.telephone || undefined,
      dateCreation: new Date().toISOString(),
      motDePasse: this.formData.motDePasse
    };
    this.usersService.createUser(newUser);
    this.message.set(`Le technicien « ${fullName} » a été créé avec succès.`);
    this.messageType.set('success');
    this.closeAddModal();
    setTimeout(() => this.message.set(''), 4000);
  }

  protected confirmToggleStatus(user: User): void {
    this.selectedUser.set(user);
    this.showConfirmModal.set(true);
  }

  /** Ouvre la modale de détail d'un technicien. */
  protected openDetail(tech: User): void {
    this.selectedTech.set(tech);
    this.showDetailModal.set(true);
  }

  protected closeDetail(): void {
    this.showDetailModal.set(false);
    this.selectedTech.set(null);
  }

  protected cancelModal(): void {
    this.showConfirmModal.set(false);
    this.selectedUser.set(null);
  }

  protected confirmToggle(): void {
    const u = this.selectedUser();
    if (!u) return;
    const updated = this.usersService.toggleStatus(u.id);
    if (updated) {
      const action = updated.statut === 'ACTIVE' ? 'activé' : 'désactivé';
this.message.set(`Le technicien « ${updated.name} » a été ${action} avec succès.`);
      this.messageType.set('success');
      setTimeout(() => this.message.set(''), 4000);
    }
    this.cancelModal();
  }

  private resetForm(): void {
    this.formData = {
      nom: '',
      prenom: '',
      email: '',
      telephone: '',
      motDePasse: '',
      statut: 'ACTIVE'
    };
  }
}