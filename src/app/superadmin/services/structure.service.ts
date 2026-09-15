import { Injectable, signal } from '@angular/core';
import { Structure, StructureStats } from '../models/structure.model';
import { MaintenanceService } from '../../services/maintenance.service';

@Injectable({
  providedIn: 'root'
})
export class StructureService {
  private readonly STORAGE_KEY = 'shango_structures';
  private readonly STORAGE_VERSION_KEY = 'shango_structures_version';
  private readonly CURRENT_VERSION = '5';

  structures = signal<Structure[]>(this.loadStructures());

  constructor(private maintenanceService: MaintenanceService) {
    const version = typeof window !== 'undefined' ? localStorage.getItem(this.STORAGE_VERSION_KEY) : null;
    // Réamorce aussi si la liste est vide (ex. donnée corrompue/vidée) même si
    // la version est à jour : un front sans structures de démonstration est
    // impossible à prévisualiser/expliquer.
    if (version !== this.CURRENT_VERSION || this.structures().length === 0) {
      this.seedStructures();
      if (typeof window !== 'undefined') {
        localStorage.setItem(this.STORAGE_VERSION_KEY, this.CURRENT_VERSION);
      }
    }
  }

  private loadStructures(): Structure[] {
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(this.STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    }
    return [];
  }

  private saveStructures(structures: Structure[]): void {
    this.structures.set(structures);
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(structures));
    }
  }

  private seedStructures(): void {
    // Structures de démonstration avec administrateurs associés
    const now = new Date().toISOString();
    const structures: Structure[] = [
      {
        id: 'STR-001',
        nom: 'Alioth Systems',
        code: 'ALIOTH',
        description: 'Structure principale de gestion des équipements solaires.',
        email: 'contact@alioth-system.com',
        telephone: '+226 25 40 12 34',
        adresse: 'Zone industrielle Kossodo, Ouagadougou',
        ville: 'Ouagadougou',
        pays: 'Burkina Faso',
        statut: 'ACTIVE',
        dateCreation: '2024-03-20T10:00:00.000Z',
        dateModification: now,
        adminNom: 'Admin Alioth',
        adminEmail: 'admin@alioth-system.com',
        adminTelephone: '+226 70 98 76 54'
      },
      {
        id: 'STR-002',
        nom: 'Orange Énergie',
        code: 'ORANGE',
        description: 'Structure de distribution d\'énergie solaire.',
        email: 'contact@orange-energie.com',
        telephone: '+226 25 30 56 78',
        adresse: 'Avenue Kwame Nkrumah, Ouagadougou',
        ville: 'Ouagadougou',
        pays: 'Burkina Faso',
        statut: 'ACTIVE',
        dateCreation: '2024-01-15T10:00:00.000Z',
        dateModification: now,
        adminNom: 'Admin Orange',
        adminEmail: 'admin@orange-energie.com',
        adminTelephone: '+226 70 12 34 56'
      },
      {
        id: 'STR-003',
        nom: 'Bobo Services',
        code: 'BOBO',
        description: 'Structure de maintenance des équipements miniers.',
        email: 'contact@bobo-services.com',
        telephone: '+226 20 97 11 22',
        adresse: 'Zone industrielle, Bobo-Dioulasso',
        ville: 'Bobo-Dioulasso',
        pays: 'Burkina Faso',
        statut: 'INACTIVE',
        dateCreation: '2024-06-10T10:00:00.000Z',
        dateModification: now,
        adminNom: 'M. Sanogo',
        adminEmail: 'sanogo@bobo-services.com',
        adminTelephone: '+226 76 54 32 10'
      }
    ];
    this.saveStructures(structures);
  }

  getAllStructures(): Structure[] {
    return this.structures();
  }

  countUsers(): { total: number; actifs: number } {
    if (typeof window !== 'undefined') {
      const userKey = 'shango_users';
      const raw = localStorage.getItem(userKey);
      const users = raw ? JSON.parse(raw) : [];
      const actifs = users.filter((u: any) => u.role === 'ADMIN_STRUCTURE' || u.role === 'USER').length;
      return { total: users.length, actifs };
    }
    return { total: 0, actifs: 0 };
  }

  getStats(): StructureStats {
    const structures = this.structures();
    const actives = structures.filter(s => s.statut === 'ACTIVE').length;
    const users = this.countUsers();
    return {
      total: structures.length,
      actives,
      inactives: structures.length - actives,
      totalUtilisateurs: users.total,
      utilisateursActifs: users.actifs
    };
  }

  getStructure(id: string): Structure | undefined {
    return this.structures().find(s => s.id === id);
  }

  createStructure(structure: Omit<Structure, 'id' | 'dateCreation' | 'dateModification'>): Structure {
    const now = new Date().toISOString();
    const newStructure: Structure = {
      ...structure,
      id: this.generateId(),
      dateCreation: now,
      dateModification: now
    };
    this.saveStructures([...this.structures(), newStructure]);
    // Amorce 2 alertes de démonstration pour que l'admin de cette nouvelle
    // structure puisse tester l'affectation / la planification dès sa 1ère connexion.
    this.maintenanceService.seedAlertsForStructure(newStructure.id, newStructure.code || newStructure.nom);
    return newStructure;
  }

  updateStructure(id: string, changes: Partial<Structure>): Structure | undefined {
    const structures = this.structures();
    const index = structures.findIndex(s => s.id === id);
    if (index === -1) return undefined;
    const updated: Structure = {
      ...structures[index],
      ...changes,
      id,
      dateModification: new Date().toISOString()
    };
    const newList = [...structures];
    newList[index] = updated;
    this.saveStructures(newList);
    return updated;
  }

  toggleStatus(id: string): Structure | undefined {
    const structure = this.getStructure(id);
    if (!structure) return undefined;
    const newStatus = structure.statut === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';
    return this.updateStructure(id, { statut: newStatus });
  }

  private generateId(): string {
    const random = Math.floor(1000 + Math.random() * 9000);
    return `STR-${random}`;
  }
}