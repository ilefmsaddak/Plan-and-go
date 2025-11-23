import { Component, OnInit, output, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { SocialService, UserProfile, Plan } from '../../services/social.service';
import { AuthService } from '../../services/auth.service';
import { PlansService } from '../../services/plans.service';
import { CreatePathComponent } from '../create-path/create-path';

@Component({
  selector: 'app-user-profile',
  standalone: true,
  imports: [CommonModule, FormsModule, CreatePathComponent],
  templateUrl: './user-profile.html',
  styleUrl: './user-profile.scss'
})
export class UserProfileComponent implements OnInit {
  profile = signal<UserProfile | null>(null);
  publicPlans = signal<Plan[]>([]);
  privatePlans = signal<Plan[]>([]);
  clonedPlans = signal<Plan[]>([]);
  publications = signal<any[]>([]);
  loading = signal(true);
  error = signal<string | null>(null);

  // Utilisateur courant depuis AuthService
  currentUserId: any;
  currentUsername: any;

  // Utilisateur dont on consulte le profil
  viewedUserId: string | null = null;
  isOwnProfile = signal(true);

  activeTab = signal<'public' | 'private'>('public');

  // Follow/Unfollow
  isFollowing = signal(false);
  followLoading = signal(false);

  // Followers/Following Modal
  showFollowersModal = signal(false);
  followersModalType = signal<'followers' | 'following'>('followers');
  followersList = signal<string[]>([]);
  followersMap = signal<Map<string, string>>(new Map()); // Map userId -> username

  // Comments/Likes Modal
  showCommentsModal = signal(false);
  showLikesModal = signal(false);
  selectedPlanComments = signal<any[]>([]);
  selectedPlanLikes = signal<string[]>([]);
  selectedPlanTitle = signal<string>('');
  selectedPlan = signal<Plan | null>(null);
  newCommentText = '';

  // Publication Comments/Likes/Clones Modal
  showPublicationCommentsModal = signal(false);
  showPublicationLikesModal = signal(false);
  showPublicationClonesModal = signal(false);
  selectedPublicationComments = signal<any[]>([]);
  selectedPublicationLikes = signal<string[]>([]);
  selectedPublicationClones = signal<string[]>([]);
  selectedPublicationTitle = signal<string>('');
  selectedPublication = signal<any | null>(null);
  newPublicationCommentText = '';

  // Réactions et réponses pour les commentaires de publications
  activeReactionCommentId = signal<string | null>(null);
  activeReplyCommentId = signal<string | null>(null);
  replyText: { [key: string]: string } = {};
  reactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡', '🔥'];

  // Edit Profile Modal
  showEditProfileModal = signal(false);
  editProfileLoading = signal(false);
  editProfileData = {
    username: '',
    bio: '',
    email: '',
    currentPassword: '',
    newPassword: '',
    confirmPassword: ''
  };

  // Share Plan Modal
  showShareModal = signal(false);
  shareLoading = signal(false);
  selectedPlanForShare: any = null;
  shareModalData = {
    description: ''
  };

  showCreatePathModal = signal(false);

  constructor(
    private socialService: SocialService,
    private authService: AuthService,
    private router: Router,
    private route: ActivatedRoute,
    private plansService: PlansService
  ) {
    this.currentUserId = this.authService.currentUserId;
    this.currentUsername = this.authService.currentUsername;
  }

  ngOnInit(): void {
    // Vérifier si l'utilisateur est connecté
    if (!this.currentUserId()) {
      // Rediriger vers la page de connexion
      this.router.navigate(['/login']);
      return;
    }

    // Récupérer l'ID de l'utilisateur depuis la route
    this.route.params.subscribe(params => {
      if (params['userId']) {
        this.viewedUserId = params['userId'];
        this.isOwnProfile.set(this.viewedUserId === this.currentUserId());
      } else {
        this.viewedUserId = this.currentUserId();
        this.isOwnProfile.set(true);
      }
      this.loadProfile();

      // Gérer la navigation depuis les notifications
      this.route.queryParams.subscribe(queryParams => {
        if (queryParams['pubId']) {
          // Attendre que les publications soient chargées puis scroller vers celle-ci
          setTimeout(() => {
            this.scrollToPublication(queryParams['pubId']);
          }, 500);
        }
      });
    });
  }

  onCloseLogin(): void {
    this.showCreatePathModal.set(false);
  }

  scrollToPublication(pubId: string): void {
    const element = document.getElementById(`pub-${pubId}`);
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      // Ajouter une classe pour mettre en évidence
      element.classList.add('highlight');
      setTimeout(() => {
        element.classList.remove('highlight');
      }, 3000);
    }
  }

  loadProfile(): void {
    if (!this.viewedUserId) {
      this.error.set('Utilisateur non trouvé');
      this.loading.set(false);
      return;
    }

    this.loading.set(true);
    this.error.set(null);

    this.socialService.getUserProfile(this.viewedUserId).subscribe({
      next: (profile) => {
        this.profile.set(profile);
        this.publicPlans.set(profile.publicPlans || []);

        // Charger les publications de l'utilisateur
        this.loadUserPublications();

        // Si c'est notre profil, charger les plans privés et clonés
        if (this.isOwnProfile()) {
          this.loadPrivatePlans();
        } else {
          // Si c'est un autre profil, vérifier le statut de follow
          this.checkFollowStatus();
          this.loading.set(false);
        }
      },
      error: (err) => {
        console.error('Erreur lors du chargement du profil:', err);
        this.error.set('Erreur lors du chargement du profil ❌');
        this.loading.set(false);
      }
    });
  }

  loadUserPublications(): void {
    if (!this.viewedUserId) return;

    this.plansService.getUserPublications(this.viewedUserId, this.currentUserId()).subscribe({
      next: (publications) => {
        if (Array.isArray(publications)) {
          this.publications.set(publications);
        } else {
          this.publications.set([]);
        }
      },
      error: (err) => {
        console.error('Erreur lors du chargement des publications:', err);
        this.publications.set([]);
      }
    });
  }

  loadPrivatePlans(): void {
    if (!this.currentUserId()) {
      this.loading.set(false);
      return;
    }

    this.socialService.getUserPrivatePlans(this.currentUserId()!).subscribe({
      next: (plans) => {
        this.privatePlans.set(plans);
        this.loadClonedPlans();
      },
      error: (err) => {
        console.error('Erreur lors du chargement des plans privés:', err);
        this.loading.set(false);
      }
    });
  }

  loadClonedPlans(): void {
    if (!this.currentUserId()) {
      this.loading.set(false);
      return;
    }

    this.socialService.getUserClonedPlans(this.currentUserId()!).subscribe({
      next: (plans) => {
        this.clonedPlans.set(plans);
        this.checkFollowStatus();
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Erreur lors du chargement des plans clonés:', err);
        this.loading.set(false);
      }
    });
  }

  switchTab(tab: 'public' | 'private'): void {
    this.activeTab.set(tab);
  }

  logout(): void {
    this.authService.logout();
    this.router.navigate(['/']);
  }

  onCreatePathSuccess(): void {
    this.router.navigate(['/trip']);
  }

  createItinerary(): void {
    this.showCreatePathModal.set(true);

  }

  goBack(): void {
    this.router.navigate(['/']);
  }

  getDisplayPlans(): Plan[] {
    // For other profiles, always show public plans
    if (!this.isOwnProfile()) {
      return this.publicPlans();
    }

    // For own profile, respect the active tab
    if (this.activeTab() === 'public') {
      return this.publicPlans();
    } else {
      return this.privatePlans();
    }
  }

  toggleFollow(): void {
    if (!this.currentUserId() || !this.profile()) return;

    this.followLoading.set(true);

    if (this.isFollowing()) {
      // Unfollow
      this.socialService.unfollowUser(this.profile()!.userId, this.currentUserId()).subscribe({
        next: () => {
          this.isFollowing.set(false);
          this.followLoading.set(false);
        },
        error: (err) => {
          console.error('Erreur lors du unfollow:', err);
          this.followLoading.set(false);
        }
      });
    } else {
      // Follow
      this.socialService.followUser(this.profile()!.userId, this.currentUserId()).subscribe({
        next: () => {
          this.isFollowing.set(true);
          this.followLoading.set(false);
        },
        error: (err) => {
          console.error('Erreur lors du follow:', err);
          this.followLoading.set(false);
        }
      });
    }
  }

  checkFollowStatus(): void {
    if (!this.currentUserId() || !this.profile()) return;

    this.socialService.checkFollowStatus(this.profile()!.userId, this.currentUserId()).subscribe({
      next: (response) => {
        this.isFollowing.set(response.isFollowing);
      },
      error: (err) => {
        console.error('Erreur lors de la vérification du follow status:', err);
      }
    });
  }

  showFollowers(): void {
    if (!this.profile()) return;
    this.followersModalType.set('followers');
    // Extraire les IDs et usernames des followers
    const followersList = this.profile()!.followersList || [];
    const followerIds: string[] = [];
    const map = new Map<string, string>();

    followersList.forEach((f: any) => {
      const userId = typeof f === 'string' ? f : f.userId;
      const username = typeof f === 'string' ? f : f.username;
      followerIds.push(userId);
      map.set(userId, username);
    });

    this.followersList.set(followerIds);
    this.followersMap.set(map);
    this.showFollowersModal.set(true);
  }

  showFollowing(): void {
    if (!this.profile()) return;
    this.followersModalType.set('following');
    // Extraire les IDs et usernames des following
    const followingList = this.profile()!.followingList || [];
    const followingIds: string[] = [];
    const map = new Map<string, string>();

    followingList.forEach((f: any) => {
      const userId = typeof f === 'string' ? f : f.userId;
      const username = typeof f === 'string' ? f : f.username;
      followingIds.push(userId);
      map.set(userId, username);
    });

    this.followersList.set(followingIds);
    this.followersMap.set(map);
    this.showFollowersModal.set(true);
  }

  closeFollowersModal(): void {
    this.showFollowersModal.set(false);
    this.followersList.set([]);
  }

  removeFollower(userId: string): void {
    if (!this.currentUserId() || !this.profile()) return;

    // Vérifier si c'est la liste des followers ou following
    if (this.followersModalType() === 'followers') {
      // C'est la liste des abonnés - retirer ce follower
      this.socialService.removeFollower(this.profile()!.userId, userId).subscribe({
        next: (response) => {
          // Mettre à jour la liste des followers
          const updated = this.followersList().filter(id => id !== userId);
          this.followersList.set(updated);

          // Mettre à jour le nombre de followers
          const profile = this.profile();
          if (profile) {
            profile.followers = response.followers;
            this.profile.set(profile);
          }
        },
        error: (err) => {
          console.error('Erreur lors du retrait du follower:', err);
          alert('Erreur lors du retrait du follower');
        }
      });
    } else {
      // C'est la liste des abonnements - unfollow cet utilisateur
      this.socialService.unfollowUser(userId, this.currentUserId()).subscribe({
        next: () => {
          // Mettre à jour la liste des following
          const updated = this.followersList().filter(id => id !== userId);
          this.followersList.set(updated);

          // Mettre à jour le nombre de following
          const profile = this.profile();
          if (profile) {
            profile.following = Math.max(0, profile.following - 1);
            this.profile.set(profile);
          }
        },
        error: (err) => {
          console.error('Erreur lors du unfollow:', err);
          alert('Erreur lors du unfollow');
        }
      });
    }
  }

  sharePlan(plan: any): void {
    if (!this.currentUserId()) {
      alert('Veuillez vous connecter');
      return;
    }

    // Call backend to update plan to public
    this.socialService.sharePlan(plan.id, this.currentUserId()).subscribe({
      next: () => {
        alert('Plan partagé avec succès!');

        // Add to public plans (keep in private plans)
        const updatedPublic = [...this.publicPlans(), plan];
        this.publicPlans.set(updatedPublic);

        // Mark plan as public in private plans list
        const updatedPrivate = this.privatePlans().map(p =>
          p.id === plan.id ? { ...p, isPublic: true } : p
        );
        this.privatePlans.set(updatedPrivate);
      },
      error: (err: any) => {
        console.error('Erreur lors du partage:', err);
        alert('Erreur lors du partage du plan');
      }
    });
  }

  unsharePlan(plan: any): void {
    if (!this.currentUserId()) {
      alert('Veuillez vous connecter');
      return;
    }

    if (!confirm('Êtes-vous sûr de vouloir annuler le partage de ce plan? La publication sera supprimée.')) {
      return;
    }

    // Call backend to make plan private and delete publication
    this.socialService.unsharePlan(plan.id, this.currentUserId()).subscribe({
      next: () => {
        alert('Partage annulé avec succès!');

        // Remove from public plans
        const updatedPublic = this.publicPlans().filter(p => p.id !== plan.id);
        this.publicPlans.set(updatedPublic);

        // Move back to private plans
        const updatedPrivate = [...this.privatePlans(), { ...plan, isPublic: false }];
        this.privatePlans.set(updatedPrivate);

        // Reload publications to remove the deleted one
        this.loadUserPublications();
      },
      error: (err: any) => {
        console.error('Erreur lors de l\'annulation du partage:', err);
        alert('Erreur lors de l\'annulation du partage');
      }
    });
  }

  viewPlan(plan: any): void {
    // Navigate to home page with plan ID to scroll to it
    // For now, just show an alert with plan details
    alert(`Plan: ${plan.city || 'Plan'}\n\nDates: ${plan.fromDate ? new Date(plan.fromDate).toLocaleDateString() : '?'} - ${plan.toDate ? new Date(plan.toDate).toLocaleDateString() : '?'}\n\nLieux: ${plan.placesCount || 0}\nJours: ${plan.daysCount || 0}`);
  }

  showComments(plan: any): void {
    this.selectedPlan.set(plan);
    this.selectedPlanTitle.set(plan.title);

    // Charger les détails complets du plan pour obtenir les commentaires
    this.socialService.getPlanDetail(plan.id).subscribe({
      next: (fullPlan: any) => {
        this.selectedPlanComments.set(fullPlan.comments || []);
        this.showCommentsModal.set(true);
      },
      error: (err: any) => {
        console.error('Erreur lors du chargement des commentaires:', err);
        this.selectedPlanComments.set(plan.comments || []);
        this.showCommentsModal.set(true);
      }
    });
  }

  showLikes(plan: any): void {
    this.selectedPlan.set(plan);
    this.selectedPlanTitle.set(plan.title);

    // Charger les détails complets du plan pour obtenir les usernames des likes
    this.socialService.getPlanDetail(plan.id).subscribe({
      next: (fullPlan: any) => {
        console.log('Full plan details:', fullPlan);
        console.log('likedBy:', fullPlan.likedBy);
        console.log('likes_by:', fullPlan.likes_by);

        // Essayer différentes clés possibles
        const likedByList = fullPlan.likedBy || fullPlan.likes_by || fullPlan.liked_by || [];
        this.selectedPlanLikes.set(likedByList);
        this.showLikesModal.set(true);
      },
      error: (err: any) => {
        console.error('Erreur lors du chargement des likes:', err);
        this.selectedPlanLikes.set(plan.likedBy || []);
        this.showLikesModal.set(true);
      }
    });
  }

  closeCommentsModal(): void {
    this.showCommentsModal.set(false);
    this.selectedPlanComments.set([]);
    this.newCommentText = '';
  }

  addCommentToModal(): void {
    if (!this.newCommentText.trim() || !this.selectedPlan()) {
      return;
    }

    const plan = this.selectedPlan()!;
    this.addComment(plan, this.newCommentText);
    this.newCommentText = '';
  }

  closeLikesModal(): void {
    this.showLikesModal.set(false);
    this.selectedPlanLikes.set([]);
  }

  likePlan(plan: Plan): void {
    if (!this.currentUserId()) {
      alert('Veuillez vous connecter');
      return;
    }

    this.socialService.likePlan(plan.id, this.currentUserId(), this.currentUsername()).subscribe({
      next: () => {
        // Update the plan's like status
        const updatedPublic = this.publicPlans().map(p =>
          p.id === plan.id ? { ...p, isLiked: true, likes: (p.likes || 0) + 1 } : p
        );
        this.publicPlans.set(updatedPublic);
      },
      error: (err: any) => {
        console.error('Erreur lors du like:', err);
      }
    });
  }

  unlikePlan(plan: Plan): void {
    if (!this.currentUserId()) {
      alert('Veuillez vous connecter');
      return;
    }

    this.socialService.unlikePlan(plan.id, this.currentUserId(), this.currentUsername()).subscribe({
      next: () => {
        // Update the plan's like status
        const updatedPublic = this.publicPlans().map(p =>
          p.id === plan.id ? { ...p, isLiked: false, likes: Math.max(0, (p.likes || 1) - 1) } : p
        );
        this.publicPlans.set(updatedPublic);
      },
      error: (err: any) => {
        console.error('Erreur lors du unlike:', err);
      }
    });
  }

  addComment(plan: Plan, commentText: string): void {
    if (!this.currentUserId()) {
      alert('Veuillez vous connecter');
      return;
    }

    if (!commentText.trim()) {
      alert('Veuillez entrer un commentaire');
      return;
    }

    this.socialService.addComment(plan.id, this.currentUserId(), this.currentUsername(), commentText).subscribe({
      next: (response: any) => {
        // Update the plan's comment count
        const updatedPublic = this.publicPlans().map(p =>
          p.id === plan.id ? { ...p, commentsCount: (p.commentsCount || 0) + 1 } : p
        );
        this.publicPlans.set(updatedPublic);

        // Refresh comments modal
        this.showComments(updatedPublic.find(p => p.id === plan.id) || plan);
      },
      error: (err: any) => {
        console.error('Erreur lors de l\'ajout du commentaire:', err);
      }
    });
  }

  clonePlan(plan: Plan): void {
    if (!this.currentUserId()) {
      alert('Veuillez vous connecter');
      return;
    }

    this.socialService.clonePlan(plan.id, this.currentUserId(), this.currentUsername()).subscribe({
      next: () => {
        // Update the plan's clone status
        const updatedPublic = this.publicPlans().map(p =>
          p.id === plan.id ? { ...p, isCloned: true } : p
        );
        this.publicPlans.set(updatedPublic);
        alert('Plan cloné avec succès! 🎉');
      },
      error: (err: any) => {
        console.error('Erreur lors du clonage:', err);
      }
    });
  }

  getFollowerUsername(userId: string): string {
    return this.followersMap().get(userId) || userId;
  }

  formatDate(dateString: string): string {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffTime = Math.abs(now.getTime() - date.getTime());
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 0) return 'Aujourd\'hui';
      if (diffDays === 1) return 'Hier';
      if (diffDays < 7) return `Il y a ${diffDays} jours`;
      if (diffDays < 30) return `Il y a ${Math.floor(diffDays / 7)} semaines`;
      if (diffDays < 365) return `Il y a ${Math.floor(diffDays / 30)} mois`;
      return `Il y a ${Math.floor(diffDays / 365)} ans`;
    } catch (e) {
      return dateString.substring(0, 10);
    }
  }

  // Obtenir le nom d'un lieu - peut être un ID ou un objet complet
  getPlaceName(placeData: any, publication: any): string {
    // Si c'est déjà un objet avec un nom, retourner le nom
    if (typeof placeData === 'object' && placeData !== null) {
      return placeData.name || placeData.title || 'Lieu inconnu';
    }

    // Si c'est un ID string, chercher dans placeBucket
    if (typeof placeData === 'string') {
      if (!publication || !publication.planSnapshot || !publication.planSnapshot.placeBucket) {
        return 'Lieu inconnu';
      }

      const place = publication.planSnapshot.placeBucket.find((p: any) =>
        String(p.id) === String(placeData) || String(p._id) === String(placeData)
      );

      return place ? (place.name || place.title || 'Lieu') : 'Lieu inconnu';
    }

    return 'Lieu inconnu';
  }

  // Éditer le profil
  openEditProfileModal(): void {
    if (this.profile()) {
      this.editProfileData = {
        username: this.profile()!.username,
        bio: this.profile()!.bio || '',
        email: this.profile()!.email,
        currentPassword: '',
        newPassword: '',
        confirmPassword: ''
      };
      this.showEditProfileModal.set(true);
    }
  }

  closeEditProfileModal(): void {
    this.showEditProfileModal.set(false);
  }

  saveProfileChanges(): void {
    if (!this.currentUserId()) return;

    // Valider les mots de passe si fournis
    if (this.editProfileData.newPassword || this.editProfileData.currentPassword) {
      if (!this.editProfileData.currentPassword) {
        alert('❌ Veuillez entrer votre mot de passe actuel');
        return;
      }
      if (!this.editProfileData.newPassword) {
        alert('❌ Veuillez entrer un nouveau mot de passe');
        return;
      }
      if (this.editProfileData.newPassword !== this.editProfileData.confirmPassword) {
        alert('❌ Les mots de passe ne correspondent pas');
        return;
      }
      if (this.editProfileData.newPassword.length < 6) {
        alert('❌ Le mot de passe doit contenir au moins 6 caractères');
        return;
      }
    }

    this.editProfileLoading.set(true);

    this.socialService.updateUserProfile(
      this.currentUserId(),
      this.editProfileData.username,
      this.editProfileData.bio,
      this.editProfileData.email,
      this.editProfileData.currentPassword,
      this.editProfileData.newPassword
    ).subscribe({
      next: (response: any) => {
        // Mettre à jour le profil local
        if (this.profile()) {
          const updatedProfile = {
            ...this.profile()!,
            username: this.editProfileData.username,
            bio: this.editProfileData.bio,
            email: this.editProfileData.email
          };
          this.profile.set(updatedProfile);
        }

        // Mettre à jour AuthService avec le nouveau nom d'utilisateur
        this.authService.currentUsername.set(this.editProfileData.username);
        localStorage.setItem('username', this.editProfileData.username);

        // Mettre à jour le nom dans les publications existantes
        const updatedPublications = this.publications().map(pub => ({
          ...pub,
          author: this.editProfileData.username
        }));
        this.publications.set(updatedPublications);

        this.editProfileLoading.set(false);
        this.showEditProfileModal.set(false);
        alert('✅ Profil mis à jour avec succès!');
      },
      error: (err: any) => {
        console.error('Erreur lors de la mise à jour du profil:', err);
        this.editProfileLoading.set(false);
        alert('❌ Erreur lors de la mise à jour du profil: ' + (err.error?.error || 'Erreur inconnue'));
      }
    });
  }

  // Share Plan Modal Methods
  openSharePlanModal(plan: any): void {
    this.selectedPlanForShare = plan;
    this.shareModalData.description = '';
    this.showShareModal.set(true);
  }

  closeShareModal(): void {
    this.showShareModal.set(false);
    this.selectedPlanForShare = null;
    this.shareModalData.description = '';
  }

  createPublicationFromPlan(): void {
    if (!this.currentUserId() || !this.selectedPlanForShare) return;

    if (!this.shareModalData.description.trim()) {
      alert('❌ Veuillez entrer une description pour votre publication');
      return;
    }

    this.shareLoading.set(true);

    // D'abord, partager le plan (le rendre public)
    this.socialService.sharePlan(this.selectedPlanForShare.id, this.currentUserId()).subscribe({
      next: (shareResponse: any) => {
        // Ensuite, créer la publication
        this.plansService.publishPlan(
          this.selectedPlanForShare.id,
          this.currentUserId(),
          this.shareModalData.description
        ).subscribe({
          next: (pubResponse: any) => {
            this.shareLoading.set(false);
            this.showShareModal.set(false);

            // Recharger les publications et les plans
            this.loadUserPublications();
            this.loadPrivatePlans();

            alert('✅ Publication créée avec succès! Votre plan est maintenant public.');
          },
          error: (err: any) => {
            console.error('Erreur lors de la création de la publication:', err);
            this.shareLoading.set(false);
            alert('❌ Erreur lors de la création de la publication');
          }
        });
      },
      error: (err: any) => {
        console.error('Erreur lors du partage du plan:', err);
        this.shareLoading.set(false);
        alert('❌ Erreur lors du partage du plan');
      }
    });
  }

  // Publication Comments/Likes Methods
  showPublicationLikes(pub: any): void {
    this.selectedPublication.set(pub);
    this.selectedPublicationTitle.set(pub.planSnapshot?.city || 'Publication');

    // Charger les détails complets pour obtenir les likes avec usernames
    this.plansService.getPublicationDetails(pub.id, this.currentUserId()).subscribe({
      next: (details: any) => {
        // Extraire les usernames des likes
        const likeUsernames = (details.likes || []).map((like: any) => like.username);
        this.selectedPublicationLikes.set(likeUsernames);
        this.showPublicationLikesModal.set(true);
      },
      error: (err: any) => {
        console.error('Erreur lors du chargement des likes:', err);
        this.selectedPublicationLikes.set([]);
        this.showPublicationLikesModal.set(true);
      }
    });
  }

  closePublicationLikesModal(): void {
    this.showPublicationLikesModal.set(false);
  }

  showPublicationComments(pub: any): void {
    this.selectedPublication.set(pub);
    this.selectedPublicationTitle.set(pub.planSnapshot?.city || 'Publication');

    // Charger les détails complets pour obtenir les commentaires avec réponses et réactions
    this.plansService.getPublicationDetails(pub.id, this.currentUserId()).subscribe({
      next: (details: any) => {
        this.selectedPublicationComments.set(details.comments || []);
        this.showPublicationCommentsModal.set(true);
      },
      error: (err: any) => {
        console.error('Erreur lors du chargement des commentaires:', err);
        this.selectedPublicationComments.set([]);
        this.showPublicationCommentsModal.set(true);
      }
    });
  }

  closePublicationCommentsModal(): void {
    this.showPublicationCommentsModal.set(false);
  }

  showPublicationClones(pub: any): void {
    this.selectedPublication.set(pub);
    this.selectedPublicationTitle.set(pub.planSnapshot?.city || 'Publication');

    // Charger les détails complets pour obtenir les cloneurs avec usernames
    this.plansService.getPublicationDetails(pub.id, this.currentUserId()).subscribe({
      next: (details: any) => {
        // Extraire les usernames des cloneurs
        const cloneUsernames = (details.clonedBy || []).map((clone: any) => clone.username);
        this.selectedPublicationClones.set(cloneUsernames);
        this.showPublicationClonesModal.set(true);
      },
      error: (err: any) => {
        console.error('Erreur lors du chargement des clones:', err);
        this.selectedPublicationClones.set([]);
        this.showPublicationClonesModal.set(true);
      }
    });
  }

  closePublicationClonesModal(): void {
    this.showPublicationClonesModal.set(false);
  }

  addPublicationComment(): void {
    if (!this.currentUserId() || !this.selectedPublication() || !this.newPublicationCommentText.trim()) {
      return;
    }

    const pubId = this.selectedPublication().id;
    this.plansService.addPublicationComment(pubId, this.currentUserId(), this.currentUsername(), this.newPublicationCommentText).subscribe({
      next: (response: any) => {
        this.newPublicationCommentText = '';
        this.loadUserPublications();
        this.showPublicationComments(this.selectedPublication());
      },
      error: (err: any) => {
        console.error('Erreur lors de l\'ajout du commentaire:', err);
      }
    });
  }

  likePublication(pub: any): void {
    if (!this.currentUserId()) {
      this.router.navigate(['/login']);
      return;
    }

    const pubId = pub.id;
    this.plansService.likePublication(pubId, this.currentUserId(), this.currentUsername()).subscribe({
      next: (response: any) => {
        pub.isLiked = true;
        pub.likes = (pub.likes || 0) + 1;
        this.loadUserPublications();
      },
      error: (err: any) => {
        console.error('Erreur lors du like:', err);
      }
    });
  }

  clonePublication(pub: any): void {
    if (!this.currentUserId()) {
      this.router.navigate(['/login']);
      return;
    }

    this.plansService.clonePublication(pub.id, this.currentUserId(), this.currentUsername()).subscribe({
      next: (response: any) => {
        alert('✅ Plan cloné avec succès! Vous pouvez le trouver dans vos plans privés.');
        pub.clonedBy = (pub.clonedBy || 0) + 1;
        this.loadUserPublications();
      },
      error: (err: any) => {
        console.error('Erreur lors du clonage:', err);
        alert('❌ Erreur lors du clonage du plan');
      }
    });
  }

  // ========== PUBLICATION COMMENT INTERACTIONS ==========

  // Toggle Reply Form for Publication Comments
  toggleReplyForm(commentId: string | null): void {
    if (this.activeReplyCommentId() === commentId) {
      this.activeReplyCommentId.set(null);
      if (commentId) {
        this.replyText[commentId] = '';
      }
    } else {
      this.activeReplyCommentId.set(commentId);
    }
  }

  // Show Reaction Emojis for Publication Comments
  showReactionEmojis(commentId: string): void {
    this.activeReactionCommentId.set(commentId);
  }

  // Add Reaction to Publication Comment
  addPublicationReaction(pub: any, comment: any, emoji: string): void {
    if (!this.currentUserId()) {
      this.router.navigate(['/login']);
      return;
    }

    this.plansService.addPublicationReaction(pub.id, comment.id, this.currentUserId(), this.currentUsername(), emoji).subscribe({
      next: (response: any) => {
        // Recharger les commentaires
        this.showPublicationComments(pub);
        this.activeReactionCommentId.set(null);
      },
      error: (err: any) => {
        console.error('Erreur lors de l\'ajout de la réaction:', err);
      }
    });
  }

  // Add Reply to Publication Comment
  addPublicationReply(pub: any, comment: any): void {
    if (!this.currentUserId()) {
      this.router.navigate(['/login']);
      return;
    }

    const replyTextValue = this.replyText[comment.id];
    if (!replyTextValue || replyTextValue.trim() === '') {
      alert('Veuillez entrer une réponse');
      return;
    }

    this.plansService.addPublicationReply(pub.id, comment.id, this.currentUserId(), this.currentUsername(), replyTextValue).subscribe({
      next: (response: any) => {
        // Recharger les commentaires
        this.showPublicationComments(pub);
        this.replyText[comment.id] = '';
        this.activeReplyCommentId.set(null);
      },
      error: (err: any) => {
        console.error('Erreur lors de l\'ajout de la réponse:', err);
        alert('Erreur lors de l\'ajout de la réponse');
      }
    });
  }

  // Helper pour accéder à Object.keys dans le template
  Object = Object;
}
