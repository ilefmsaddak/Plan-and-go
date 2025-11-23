import { Component, OnInit, signal, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { SocialService, Notification } from '../../services/social.service';
import { AuthService } from '../../services/auth.service';

@Component({
  selector: 'app-notifications',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './notifications.html',
  styleUrl: './notifications.scss'
})
export class NotificationsComponent implements OnInit {
  notifications = signal<Notification[]>([]);
  loading = signal(false);
  isOpen = signal(false);
  
  // Utilisateur courant
  currentUserId: any;

  constructor(
    private socialService: SocialService,
    private authService: AuthService,
    private router: Router
  ) {
    this.currentUserId = this.authService.currentUserId;
    // Recharge les notifications toutes les 10 secondes
    effect(() => {
      const userId = this.currentUserId();
      if (userId) {
        const interval = setInterval(() => {
          this.loadNotifications();
        }, 10000);
        
        return () => {
          clearInterval(interval);
        };
      }
      return undefined;
    });
  }

  ngOnInit(): void {
    this.loadNotifications();
  }

  loadNotifications(): void {
    this.socialService.getUserNotifications(this.currentUserId()).subscribe({
      next: (data) => {
        this.notifications.set(data || []);
      },
      error: (err) => {
        console.error('Erreur lors du chargement des notifications:', err);
      }
    });
  }

  toggleNotifications(): void {
    this.isOpen.set(!this.isOpen());
  }

  getUnreadCount(): number {
    return this.notifications().filter(n => !n.isRead && !n.is_read).length;
  }

  getActionIcon(action: string | undefined): string {
    const actionType = action || '';
    switch (actionType) {
      case 'like':
        return '👍';
      case 'comment':
        return '💬';
      case 'clone':
        return '📋';
      default:
        return '📢';
    }
  }

  formatDate(dateString: string | undefined): string {
    if (!dateString) {
      return 'À l\'instant';
    }
    
    const date = new Date(dateString);
    
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  navigateToPublication(notif: Notification): void {
    if (notif.recipient_id || notif.recipientId) {
      const recipientId = notif.recipient_id || notif.recipientId;
      // Fermer le dropdown des notifications
      this.isOpen.set(false);
      // Naviguer vers le profil de l'auteur de la publication (recipient) avec la pub_id
      this.router.navigate(['/profile', recipientId], { queryParams: { pubId: notif.pub_id || notif.pubId } });
    }
  }
}
