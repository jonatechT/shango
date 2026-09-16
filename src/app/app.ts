// Deployed to GitHub Pages at https://jonatecht.github.io/shango/
import { Component, signal } from '@angular/core';
import { NgIf, DatePipe } from '@angular/common';
import { RouterOutlet, RouterLink, NavigationEnd } from '@angular/router';
import { Router } from '@angular/router';
import { filter } from 'rxjs';
import { AuthService } from './auth/auth.service';
import { User } from './auth/auth.service';
import { StructureService } from './superadmin/services/structure.service';
import { MaintenanceService, NotificationItem, MaintenanceItem } from './services/maintenance.service';
import { EquipmentService } from './services/equipment.service';
import { ThemeService } from './services/theme.service';

interface MenuItem {
  label: string;
  icon: string;
  route: string;
  active?: boolean;
}

@Component({
  selector: 'app-root',
  imports: [NgIf, DatePipe, RouterOutlet, RouterLink],
  templateUrl: './app.html',
  styleUrl: './app.scss'
})
export class App {
  protected readonly title = signal('Shango');

  private readonly SIDEBAR_STATE_KEY = 'shango_sidebar_collapsed';

  isSidebarCollapsed = false;
  isMobileMenuOpen = false;
  showLogoutConfirm = false;
  showProfile = false;
  showNotifications = false;
  showAlertsPanel = false;

  /** Mode nuit activé ? (état partagé via ThemeService, aussi utilisé par l'espace SuperAdmin) */
  protected get isDarkMode(): boolean {
    return this.themeService.isDark();
  }

  protected readonly menuItems: MenuItem[] = [
    { label: 'Tableau de bord', icon: 'fa-solid fa-chart-pie', route: '/dashboard', active: true },
    { label: "Parc d'équipement", icon: 'fa-solid fa-cube', route: '/equipements' },
    { label: 'Alertes', icon: 'fa-solid fa-triangle-exclamation', route: '/alerts' },
    { label: 'Maintenances', icon: 'fa-solid fa-wrench', route: '/maintenance' },
    { label: 'Rapports', icon: 'fa-solid fa-file-lines', route: '/rapports' },
    { label: 'Paramètres', icon: 'fa-solid fa-gear', route: '/parametres' },
    { label: 'Techniciens', icon: 'fa-solid fa-users', route: '/users' }
  ];

  /** URL actuellement affichée (sert d'état actif du menu en temps réel) */
  protected readonly activeUrl = signal(this.initialActiveUrl());

  private initialActiveUrl(): string {
    return typeof window !== 'undefined' ? window.location.pathname.replace(/\/$/, '') : '';
  }

  constructor(
    private authService: AuthService,
    private router: Router,
    private structureService: StructureService,
    private maintenanceService: MaintenanceService,
    private equipmentService: EquipmentService,
    private themeService: ThemeService
  ) {
    this.isSidebarCollapsed = this.loadSidebarState();
    this.themeService.init();
    // Suivre la navigation pour l'état actif du menu (y compris au clic et au retour navigateur)
    this.router.events.pipe(filter(e => e instanceof NavigationEnd)).subscribe(e => {
      this.activeUrl.set(e.urlAfterRedirects.split('?')[0].replace(/\/$/, ''));
    });
  }

  /** Navigation impérative robuste (contourne les ratés de routerLink en zoneless + event replay) */
  protected navigateTo(route: string): void {
    this.closeMobileMenu();
    this.activeUrl.set(route);
    this.router.navigate([route]).catch(() => {
      this.activeUrl.set(this.router.url.split('?')[0].replace(/\/$/, ''));
    });
  }

  protected isAuthPage(): boolean {
    const url = this.router.url;
    return url === '/login';
  }

  protected isSuperAdminPage(): boolean {
    const url = this.router.url;
    return url.startsWith('/superadmin');
  }

  /** Tableau de bord + pages métier toujours visibles ; pages d'administration réservées à l'admin. */
  protected get visibleMenuItems(): MenuItem[] {
    const role = this.authService.getUser()?.role;
    // ADMIN_STRUCTURE a accès aux techniciens de sa structure et aux paramètres globaux
    if (role === 'ADMIN_STRUCTURE') {
      return this.menuItems;
    }
    // TECHNICIEN/USER ne voit jamais "Techniciens" ni "Paramètres"
    return this.menuItems.filter(item => item.route !== '/users' && item.route !== '/parametres');
  }

  protected get currentUser(): User | null {
    return this.authService.getUser();
  }

  protected get currentStructureName(): string {
    const structureId = this.authService.structureId;
    if (!structureId) return this.currentUser?.name || 'Utilisateur';
    const structure = this.structureService.getStructure(structureId);
    return structure?.nom || this.currentUser?.name || 'Utilisateur';
  }

  protected get currentUserName(): string {
    return this.currentUser?.name || 'Utilisateur';
  }

  protected get currentUserEmail(): string {
    return this.currentUser?.email || '';
  }

  protected get currentUserPhone(): string {
    return this.currentUser?.telephone || 'Non renseigné';
  }

  protected get currentUserRole(): string {
    return this.currentUser?.role || '';
  }

  protected get currentUserStructureId(): string {
    return this.currentUser?.structureId || '';
  }

  protected get currentUserStatut(): string {
    return this.currentUser?.statut || '';
  }

  protected get currentUserDateCreation(): string {
    return this.currentUser?.dateCreation || '';
  }

  protected get sidebarToggleLabel(): string {
    return this.isSidebarCollapsed ? 'Développer le menu' : 'Réduire le menu';
  }

  protected toggleSidebar(): void {
    this.isSidebarCollapsed = !this.isSidebarCollapsed;
    this.saveSidebarState();
  }

  private loadSidebarState(): boolean {
    if (typeof window !== 'undefined') {
      return localStorage.getItem(this.SIDEBAR_STATE_KEY) === 'true';
    }
    return false;
  }

  private saveSidebarState(): void {
    if (typeof window !== 'undefined') {
      localStorage.setItem(this.SIDEBAR_STATE_KEY, String(this.isSidebarCollapsed));
    }
  }

  /** Bascule entre le mode nuit et le mode clair (délégué au ThemeService partagé) */
  protected toggleTheme(): void {
    this.themeService.toggle();
  }

  protected toggleMobileMenu(): void {
    this.isMobileMenuOpen = !this.isMobileMenuOpen;
  }

  protected closeMobileMenu(): void {
    this.isMobileMenuOpen = false;
  }

  protected openProfile(): void {
    this.showProfile = true;
  }

  protected closeProfile(): void {
    this.showProfile = false;
  }

  protected openLogoutConfirm(): void {
    this.showProfile = false;
    this.showLogoutConfirm = true;
  }

  protected cancelLogout(): void {
    this.showLogoutConfirm = false;
  }

  protected confirmLogout(): void {
    this.showLogoutConfirm = false;
    this.authService.logout();
    this.router.navigate(['/login']);
  }

  /**
   * Alertes ouvertes (non prises) — distinct des notifications ci-dessous.
   * Les notifications journalisent les actions déjà effectuées sur la plateforme
   * (« X a pris l'alerte Y ») ; cette icône signale les nouvelles alertes à traiter.
   */
  protected get openAlerts(): MaintenanceItem[] {
    const sid = this.authService.getUser()?.structureId || null;
    return this.maintenanceService.getItems().filter(i => !i.prisPar && i.alertes > 0 && (!sid || i.structureId === sid));
  }

  protected get openAlertsCount(): number {
    return this.openAlerts.length;
  }

  protected toggleAlertsPanel(): void {
    this.showAlertsPanel = !this.showAlertsPanel;
    if (this.showAlertsPanel) {
      this.showNotifications = false;
    }
  }

  protected closeAlertsPanel(): void {
    this.showAlertsPanel = false;
  }

  /** Ouvre le détail de l'équipement concerné par l'alerte. */
  protected openAlert(item: MaintenanceItem): void {
    this.closeAlertsPanel();
    const equipment = this.equipmentService.getOrCreateByName(item.equipment, {
      localisation: item.localisation,
      lienLocalisation: item.lienLocalisation
    });
    this.router.navigate(['/equipements', equipment.id], { queryParams: { source: 'alerts' } });
  }

  /**
   * Notifications visibles pour l'utilisateur courant.
   * Un technicien ne reçoit que les notifications qui le concernent
   * (affectation, rappel d'intervention). L'admin voit tout.
   */
  protected get notifications(): NotificationItem[] {
    const all = this.maintenanceService.notifications();
    if (this.isAdmin()) return all;
    const moi = this.currentUserName;
    return all.filter(n => !n.destinataire || n.destinataire === moi);
  }

  protected get unreadNotificationsCount(): number {
    return this.notifications.filter(n => !n.read).length;
  }

  protected isAdmin(): boolean {
    return this.authService.isStructureAdmin() || this.authService.isSuperAdmin();
  }

  protected toggleNotifications(): void {
    this.showNotifications = !this.showNotifications;
    if (this.showNotifications) {
      this.showAlertsPanel = false;
      this.markAllNotificationsRead();
    }
  }

  protected closeNotifications(): void {
    this.showNotifications = false;
  }

  /**
   * Cliquer sur une notification : elle est marquée comme lue, puis redirige
   * vers la page concernée (Alertes, Maintenance ou Rapports selon sa nature).
   */
  protected ouvrirNotification(notif: NotificationItem): void {
    if (!notif) return;
    this.maintenanceService.notifications.set(
      this.maintenanceService.notifications().map(n => (n.id === notif.id ? { ...n, read: true } : n))
    );
    this.closeNotifications();
    const cible = notif.cible
      ?? (notif.message.includes('intervention') || notif.message.includes('approche')
        ? 'maintenance'
        : notif.message.includes('rapport') ? 'rapports' : 'alerts');
    const route = cible === 'rapports' ? '/rapports' : cible === 'maintenance' ? '/maintenance' : '/alerts';
    this.router.navigate([route]);
  }

  /** Redirige vers la page Alertes depuis la cloche de notification */
  protected goToAlerts(): void {
    this.closeNotifications();
    this.router.navigate(['/alerts']);
  }

  protected markAllNotificationsRead(): void {
    const isAdmin = this.isAdmin();
    const moi = this.currentUserName;
    const notifs = this.maintenanceService.notifications().map(n => {
      const visible = isAdmin || !n.destinataire || n.destinataire === moi;
      return visible ? { ...n, read: true } : n;
    });
    this.maintenanceService.notifications.set(notifs);
  }

  protected validerAlerte(item: any): void {
    this.maintenanceService.validerAlerte(item.id);
    this.router.navigate(['/alerts']);
  }
}
