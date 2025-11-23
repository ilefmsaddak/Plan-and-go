import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SocialService } from '../../services/social.service';
import { AuthService } from '../../services/auth.service';
import { Router } from '@angular/router';

interface User {
  userId: string;
  username: string;
  email: string;
  bio: string;
  avatarUrl: string;
  followers: number;
  following: number;
  commonFollowers: number;
  isFollowing: boolean;
  publicPlansCount: number;
}

@Component({
  selector: 'app-user-suggestions',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './user-suggestions.html',
  styleUrl: './user-suggestions.scss'
})
export class UserSuggestionsComponent implements OnInit {
  users = signal<User[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);
  
  currentUserId: any;
  currentUsername: any;
  
  followingUsers = signal<Set<string>>(new Set());

  constructor(
    private socialService: SocialService,
    private authService: AuthService,
    private router: Router
  ) {
    this.currentUserId = this.authService.currentUserId;
    this.currentUsername = this.authService.currentUsername;
  }

  ngOnInit(): void {
    this.loadUsers();
  }

  loadUsers(): void {
    if (!this.currentUserId()) {
      this.error.set('Veuillez vous connecter');
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.socialService.getAllUsers(this.currentUserId()).subscribe({
      next: (users) => {
        this.users.set(users || []);
        
        // Mettre à jour la liste des utilisateurs suivis
        const following = new Set<string>();
        users.forEach(user => {
          if (user.isFollowing) {
            following.add(user.userId);
          }
        });
        this.followingUsers.set(following);
        
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Erreur lors du chargement des utilisateurs:', err);
        this.error.set('Erreur lors du chargement des utilisateurs');
        this.loading.set(false);
      }
    });
  }

  followUser(user: User): void {
    if (!this.currentUserId()) {
      alert('Veuillez vous connecter');
      return;
    }

    this.socialService.followUser(user.userId, this.currentUserId()).subscribe({
      next: () => {
        // Mettre à jour l'état local
        const following = this.followingUsers();
        following.add(user.userId);
        this.followingUsers.set(following);
        
        // Mettre à jour l'utilisateur dans la liste
        const updatedUsers = this.users().map(u => {
          if (u.userId === user.userId) {
            return { ...u, isFollowing: true, followers: u.followers + 1 };
          }
          return u;
        });
        this.users.set(updatedUsers);
      },
      error: (err) => {
        console.error('Erreur lors du follow:', err);
        alert('Erreur lors du follow');
      }
    });
  }

  unfollowUser(user: User): void {
    if (!this.currentUserId()) {
      alert('Veuillez vous connecter');
      return;
    }

    this.socialService.unfollowUser(user.userId, this.currentUserId()).subscribe({
      next: () => {
        // Mettre à jour l'état local
        const following = this.followingUsers();
        following.delete(user.userId);
        this.followingUsers.set(following);
        
        // Mettre à jour l'utilisateur dans la liste
        const updatedUsers = this.users().map(u => {
          if (u.userId === user.userId) {
            return { ...u, isFollowing: false, followers: Math.max(0, u.followers - 1) };
          }
          return u;
        });
        this.users.set(updatedUsers);
      },
      error: (err) => {
        console.error('Erreur lors du unfollow:', err);
        alert('Erreur lors du unfollow');
      }
    });
  }

  viewUserProfile(userId: string): void {
    if (userId) {
      this.router.navigate(['/profile', userId]);
    }
  }

  getInitial(username: string): string {
    return (username || 'U').charAt(0).toUpperCase();
  }
}
