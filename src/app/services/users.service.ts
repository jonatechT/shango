import { Injectable, signal } from '@angular/core';
import { User } from '../auth/auth.service';

@Injectable({
  providedIn: 'root'
})
export class UsersService {
  private readonly USERS_REGISTRY_KEY = 'shango_users';

  users = signal<User[]>(this.loadUsers());

  private loadUsers(): User[] {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(this.USERS_REGISTRY_KEY);
      return raw ? JSON.parse(raw) : [];
    }
    return [];
  }

  private saveUsers(users: User[]): void {
    this.users.set(users);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.USERS_REGISTRY_KEY, JSON.stringify(users));
    }
  }

  /** Tous les utilisateurs (hors superadmin) */
  getAllUsers(): User[] {
    return this.users().filter(u => u.role !== 'SUPERADMIN');
  }

  /** Utilisateurs d'une structure donnée */
  getUsersByStructure(structureId: string): User[] {
    return this.getAllUsers().filter(u => u.structureId === structureId);
  }

  /** Créer un utilisateur (rôle imposé par le système) */
  createUser(user: Omit<User, 'id' | 'dateCreation'>): User {
    const newUser: User = {
      ...user,
      id: Date.now(),
      dateCreation: new Date().toISOString()
    };
    this.saveUsers([...this.users(), newUser]);
    return newUser;
  }

  /** Mettre à jour un utilisateur */
  updateUser(id: number, changes: Partial<User>): User | undefined {
    const users = this.users();
    const index = users.findIndex(u => u.id === id);
    if (index === -1) return undefined;
    const updated: User = { ...users[index], ...changes, id };
    const newList = [...users];
    newList[index] = updated;
    this.saveUsers(newList);
    return updated;
  }

  /** Activer/désactiver un utilisateur */
  toggleStatus(id: number): User | undefined {
    const user = this.users().find(u => u.id === id);
    if (!user) return undefined;
    const newStatus = user.statut === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    return this.updateUser(id, { statut: newStatus });
  }

  /** Supprimer un utilisateur (technicien ou compte rejeté) */
  deleteUser(id: number): void {
    this.saveUsers(this.users().filter(u => u.id !== id));
  }

  /** Recharger les utilisateurs depuis le stockage local */
  reload(): void {
    this.users.set(this.loadUsers());
  }
}
