import { Component, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { BasePageComponent } from '../base-page/base-page';
import { AuthService } from '../../auth/auth.service';
import { StructureService } from '../../superadmin/services/structure.service';

/**
 * Page « Profil » — affiche dynamiquement l'utilisateur connecté.
 *
 * Aucune donnée n'est codée en dur : toutes les valeurs proviennent de
 * `AuthService.currentUser` (nom, email, téléphone, rôle, structure, statut,
 * date de création) et de `StructureService` pour le nom de la structure.
 * Accessible par tout utilisateur authentifié (authGuard).
 */
@Component({
  selector: 'app-profile-page',
  standalone: true,
  imports: [BasePageComponent, DatePipe, FormsModule],
  templateUrl: './profile-page.html',
  styleUrl: './profile-page.scss'
})
export class ProfilePageComponent {
  constructor(
    private authService: AuthService,
    private structureService: StructureService,
    private router: Router
  ) {}

  /** Utilisateur actuellement connecté. */
  protected get user() {
    return this.authService.currentUser;
  }

  /** Nom de la structure (plutôt que le seul structureId). */
  protected get structureName(): string {
    const id = this.user?.structureId;
    if (!id) return '—';
    const structure = this.structureService.getStructure(id);
    return structure?.nom || id;
  }

  /**
   * structureId affiché avec un minimum de 3 chiffres (ex. "6" -> "006").
   * structureId est l'organization_id du backend, un simple entier auto-
   * incrémenté — ce padding est purement cosmétique, sans effet sur les
   * appels API (qui continuent d'utiliser structureId tel quel).
   */
  protected get structureIdDisplay(): string {
    const id = this.user?.structureId;
    if (!id) return '—';
    return /^\d+$/.test(id) ? id.padStart(3, '0') : id;
  }

  /** Libellé lisible du rôle. */
  protected roleLabel(): string {
    switch (this.user?.role) {
      case 'SUPERADMIN':
        return 'Super administrateur';
      case 'ADMIN_STRUCTURE':
        return 'Administrateur de structure';
      case 'USER':
        return 'Technicien';
      default:
        return this.user?.role || '—';
    }
  }

  /** Classe CSS du badge de rôle. */
  protected roleClass(): string {
    switch (this.user?.role) {
      case 'SUPERADMIN':
        return 'profile-badge-super';
      case 'ADMIN_STRUCTURE':
        return 'profile-badge-admin';
      default:
        return 'profile-badge-user';
    }
  }

  /** Libellé lisible du statut du compte. */
  protected statutLabel(): string {
    switch (this.user?.statut) {
      case 'ACTIVE':
        return 'Actif';
      case 'INACTIVE':
        return 'Inactif';
      case 'PENDING':
        return 'En attente de validation';
      default:
        return this.user?.statut || '—';
    }
  }

  /** Classe CSS du badge de statut. */
  protected statutClass(): string {
    switch (this.user?.statut) {
      case 'ACTIVE':
        return 'profile-badge-active';
      case 'PENDING':
        return 'profile-badge-pending';
      default:
        return 'profile-badge-inactive';
    }
  }

  /** Initiale de l'utilisateur pour l'avatar. */
  protected initials(): string {
    const name = this.user?.name?.trim();
    return name ? name.charAt(0).toUpperCase() : 'U';
  }

  /** Déconnexion (fonctionnalité existante conservée). */
  protected logout(): void {
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  // ================== Édition des informations du compte ==================

  /** Mode édition activé ? */
  protected readonly isEditing = signal(false);

  /** Message de retour (succès / erreur) après une tentative de sauvegarde. */
  protected readonly feedback = signal('');
  protected readonly feedbackType = signal<'success' | 'error'>('success');

  /** Champs du formulaire d'édition (mot de passe vide = conserver l'actuel). */
  protected editForm = { name: '', email: '', telephone: '', motDePasse: '' };

  /** Passer en mode édition, pré-rempli avec les valeurs courantes. */
  protected startEdit(): void {
    const u = this.user;
    this.editForm = {
      name: u?.name || '',
      email: u?.email || '',
      telephone: u?.telephone || '',
      motDePasse: ''
    };
    this.feedback.set('');
    this.isEditing.set(true);
  }

  /** Annuler l'édition. */
  protected cancelEdit(): void {
    this.isEditing.set(false);
    this.feedback.set('');
  }

  /** Sauvegarder les modifications via AuthService (registre + session). */
  protected saveEdit(): void {
    if (!this.editForm.name.trim() || !this.editForm.email.trim()) {
      this.feedbackType.set('error');
      this.feedback.set('Le nom complet et l\u2019adresse e-mail sont requis.');
      return;
    }
    if (this.editForm.motDePasse && this.editForm.motDePasse.trim().length < 8) {
      this.feedbackType.set('error');
      this.feedback.set('Le mot de passe doit contenir au moins 8 caractères.');
      return;
    }
    const ok = this.authService.updateCurrentUser({
      name: this.editForm.name.trim(),
      email: this.editForm.email.trim().toLowerCase(),
      telephone: this.editForm.telephone.trim(),
      ...(this.editForm.motDePasse.trim() ? { motDePasse: this.editForm.motDePasse.trim() } : {})
    });
    if (ok) {
      this.isEditing.set(false);
      this.feedbackType.set('success');
      this.feedback.set('Informations mises à jour avec succès.');
    } else {
      this.feedbackType.set('error');
      this.feedback.set('Impossible de mettre à jour le compte (aucune session active).');
    }
  }
}