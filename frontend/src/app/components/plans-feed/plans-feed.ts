import { Component, signal, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { PlansService, Plan } from '../../services/plans.service';
import { SocialService } from '../../services/social.service';
import { AuthService } from '../../services/auth.service';
import { UserSuggestionsComponent } from '../user-suggestions/user-suggestions';

@Component({
  selector: 'app-plans-feed',
  standalone: true,
  imports: [CommonModule, FormsModule, UserSuggestionsComponent],
  templateUrl: './plans-feed.html',
  styleUrl: './plans-feed.scss'
})
export class PlansFeedComponent implements OnInit {
  plans = signal<Plan[]>([]);
  publications = signal<any[]>([]);
  loading = signal(false);
  error = signal<string | null>(null);

  // Utilisateur courant
  currentUserId: any;
  currentUsername: any;

  // Commentaires
  commentText = signal<{ [key: string]: string }>({});
  expandedPlanId = signal<string | null>(null);
  planComments = signal<{ [key: string]: any[] }>({});

  // Recherche
  searchCity = signal('');
  isSearching = signal(false);

  // Modal des likes
  showLikesModalFlag = signal(false);
  selectedPlanForLikes = signal<Plan | null>(null);

  // Réactions et réponses
  activeReactionCommentId = signal<string | null>(null);
  activeReplyCommentId = signal<string | null>(null);
  expandedRepliesCommentId = signal<string | null>(null);
  replyText: { [key: string]: string } = {};
  reactionEmojis = ['👍', '❤️', '😂', '😮', '😢', '😡', '🔥'];
  // Stockage des réactions par commentaire: { commentId: { emoji: count } }
  commentReactions = signal<{ [key: string]: { [key: string]: number } }>({});
  // Stockage des réponses par commentaire: { commentId: [{ author, text, date }] }
  commentReplies = signal<{ [key: string]: any[] }>({});

  constructor(
    private plansService: PlansService,
    private socialService: SocialService,
    private authService: AuthService,
    private router: Router,
    private activatedRoute: ActivatedRoute
  ) {
    this.currentUserId = this.authService.currentUserId;
    this.currentUsername = this.authService.currentUsername;
  }

  ngOnInit(): void {
    this.loadPlans();
  }

  loadRepliesAndReactionsFromPlan(plan: Plan): void {
    // Charger les réponses et réactions depuis les commentaires du plan
    const replies: { [key: string]: any[] } = {};
    const reactions: { [key: string]: { [key: string]: number } } = {};

    if (plan.comments && Array.isArray(plan.comments)) {
      plan.comments.forEach((comment: any) => {
        // Charger les réponses
        if (comment.replies && Array.isArray(comment.replies)) {
          replies[comment.id] = comment.replies.map((reply: any) => ({
            id: reply.id,
            author: reply.author_name,
            text: reply.text,
            createdAt: reply.created_at
          }));
        }

        // Charger les réactions
        if (comment.reactions && Array.isArray(comment.reactions)) {
          reactions[comment.id] = {};
          comment.reactions.forEach((reaction: any) => {
            const emoji = reaction.type || '👍';
            reactions[comment.id][emoji] = (reactions[comment.id][emoji] || 0) + 1;
          });
        }
      });
    }

    this.commentReplies.set(replies);
    this.commentReactions.set(reactions);
  }

  loadPlans(): void {
    this.loading.set(true);
    this.error.set(null);

    // Charger les publications
    this.plansService.getPublications(this.currentUserId()).subscribe({
      next: (response: any) => {
        if (Array.isArray(response)) {
          this.publications.set(response);
        } else {
          this.publications.set([]);
        }
      },
      error: (err) => {
        console.error('Erreur lors du chargement des publications:', err);
        this.publications.set([]);
      }
    });

    // Charger les plans
    this.plansService.getPublicPlans(this.currentUserId()).subscribe({
      next: (response: any) => {
        // Le backend retourne directement un tableau
        if (Array.isArray(response)) {
          this.plans.set(response);
        } else if (response.success && response.data) {
          this.plans.set(response.data);
        } else {
          this.plans.set([]);
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Erreur lors du chargement des plans:', err);
        this.error.set('Erreur lors du chargement des plans');
        this.loading.set(false);
      }
    });
  }

  likePlan(plan: Plan): void {
    if (!this.currentUserId()) {
      this.router.navigate(['/login']);
      return;
    }

    this.plansService.likePlan(plan.id, this.currentUserId(), this.currentUsername()).subscribe({
      next: () => {
        // Recharger les plans
        this.loadPlans();
      },
      error: (err) => {
        console.error('Erreur lors du like:', err);
        alert('Erreur lors du like');
      }
    });
  }

  addComment(plan: Plan): void {
    if (!this.currentUserId()) {
      this.router.navigate(['/login']);
      return;
    }

    const text = this.commentText()[plan.id];
    if (!text || text.trim() === '') {
      alert('Veuillez entrer un commentaire');
      return;
    }

    this.plansService.addComment(plan.id, this.currentUserId(), this.currentUsername(), text).subscribe({
      next: () => {
        // Réinitialiser le commentaire
        const newCommentText = { ...this.commentText() };
        delete newCommentText[plan.id];
        this.commentText.set(newCommentText);
        // Recharger les plans
        this.loadPlans();
      },
      error: (err) => {
        console.error('Erreur lors du commentaire:', err);
        alert('Erreur lors du commentaire');
      }
    });
  }

  clonePlan(plan: Plan): void {
    if (!this.currentUserId()) {
      this.router.navigate(['/login']);
      return;
    }

    this.plansService.clonePlan(plan.id, this.currentUserId()).subscribe({
      next: () => {
        alert('Plan cloné avec succès!');
        // Recharger les plans
        this.loadPlans();
      },
      error: (err) => {
        console.error('Erreur lors du clone:', err);
        alert('Erreur lors du clone');
      }
    });
  }

  isLikedByUser(plan: Plan): boolean {
    if (!this.currentUserId()) return false;
    // Le backend retourne isLiked comme booléen
    return (plan as any).isLiked === true;
  }

  isClonedByUser(plan: Plan): boolean {
    if (!this.currentUserId()) return false;
    // Le backend retourne isCloned comme booléen
    return (plan as any).isCloned === true;
  }

  updateCommentText(planId: string, text: string): void {
    const newCommentText = { ...this.commentText() };
    newCommentText[planId] = text;
    this.commentText.set(newCommentText);
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  }

  searchByCity(): void {
    const city = this.searchCity().trim();

    if (!city) {
      alert('Veuillez entrer une ville');
      return;
    }

    if (!this.currentUserId()) {
      this.router.navigate(['/login']);
      return;
    }

    this.loading.set(true);
    this.isSearching.set(true);
    this.error.set(null);

    this.socialService.getPublicationsByCity(city, this.currentUserId()).subscribe({
      next: (response: any) => {
        if (Array.isArray(response)) {
          // Le backend retourne déjà au format correct
          this.publications.set(response);
        } else {
          this.publications.set([]);
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Erreur lors de la recherche:', err);
        this.error.set(`Aucune publication trouvée pour "${city}"`);
        this.loading.set(false);
      }
    });
  }

  resetSearch(): void {
    this.searchCity.set('');
    this.isSearching.set(false);
    this.loadPlans();
  }

  showComments(planId: string): void {
    if (!this.currentUserId()) {
      this.router.navigate(['/login']);
      return;
    }

    if (this.expandedPlanId() === planId) {
      this.expandedPlanId.set(null);
    } else {
      this.expandedPlanId.set(planId);
      // Charger les commentaires si pas déjà chargés
      if (!this.planComments()[planId]) {
        this.loadPlanComments(planId);
      }
    }
  }

  loadPlanComments(planId: string): void {
    this.plansService.getPlan(planId).subscribe({
      next: (response: any) => {
        const comments = this.planComments();
        comments[planId] = response.comments || [];
        this.planComments.set(comments);

        // Charger les réponses et réactions depuis les commentaires
        this.loadRepliesAndReactionsFromPlan(response);
      },
      error: (err: any) => {
        console.error('Erreur lors du chargement des commentaires:', err);
      }
    });
  }

  viewUserProfile(userId: string): void {
    if (userId) {
      this.router.navigate(['/profile', userId]);
    }
  }

  showLikesModal(plan: Plan): void {
    if (!this.currentUserId()) {
      this.router.navigate(['/login']);
      return;
    }

    // Charger les détails complets du plan pour obtenir les usernames des likes
    this.plansService.getPlan(plan.id).subscribe({
      next: (fullPlan: any) => {
        console.log('Full plan details:', fullPlan);
        console.log('likedBy:', fullPlan.likedBy);
        console.log('likes_by:', fullPlan.likes_by);

        // Essayer différentes clés possibles
        const likedByList = fullPlan.likedBy || fullPlan.likes_by || fullPlan.liked_by || [];
        const planWithLikes = { ...fullPlan, likedBy: likedByList };
        this.selectedPlanForLikes.set(planWithLikes);
        this.showLikesModalFlag.set(true);
      },
      error: (err: any) => {
        console.error('Erreur lors du chargement des likes:', err);
        this.selectedPlanForLikes.set(plan);
        this.showLikesModalFlag.set(true);
      }
    });
  }

  closeLikesModal(): void {
    this.showLikesModalFlag.set(false);
    this.selectedPlanForLikes.set(null);
  }

  toggleReactionMenu(commentId: string): void {
    if (this.activeReactionCommentId() === commentId) {
      this.activeReactionCommentId.set(null);
    } else {
      this.activeReactionCommentId.set(commentId);
    }
  }

  addReaction(comment: any, emoji: string, plan: Plan): void {
    if (!this.currentUserId()) {
      this.router.navigate(['/login']);
      return;
    }

    // Envoyer la réaction au backend
    this.plansService.addReactionToComment(plan.id, comment.id, this.currentUserId(), this.currentUsername(), emoji).subscribe({
      next: (response: any) => {
        console.log('Réaction ajoutée:', emoji, 'au commentaire:', comment.text);

        // Mettre à jour les réactions locales
        const reactions = { ...this.commentReactions() };
        if (!reactions[comment.id]) {
          reactions[comment.id] = {};
        }

        // Incrémenter le compteur pour cet emoji
        reactions[comment.id][emoji] = (reactions[comment.id][emoji] || 0) + 1;
        this.commentReactions.set(reactions);

        this.activeReactionCommentId.set(null);
      },
      error: (err) => {
        console.error('Erreur lors de l\'ajout de la réaction:', err);
        alert('Erreur lors de l\'ajout de la réaction');
      }
    });
  }

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

  showReactionEmojis(commentId: string): void {
    this.activeReactionCommentId.set(commentId);
  }

  toggleRepliesDisplay(commentId: string): void {
    if (this.expandedRepliesCommentId() === commentId) {
      this.expandedRepliesCommentId.set(null);
    } else {
      this.expandedRepliesCommentId.set(commentId);
    }
  }

  submitReply(comment: any, plan: Plan): void {
    if (!this.currentUserId()) {
      this.router.navigate(['/login']);
      return;
    }

    const replyTextValue = this.replyText[comment.id];
    if (!replyTextValue || replyTextValue.trim() === '') {
      alert('Veuillez entrer une réponse');
      return;
    }

    // Envoyer la réponse au backend
    this.plansService.addReply(plan.id, comment.id, this.currentUserId(), this.currentUsername(), replyTextValue).subscribe({
      next: (response: any) => {
        // Créer la réponse avec la réponse du backend
        const reply = {
          id: response.id,
          author: response.author,
          text: response.text,
          createdAt: response.createdAt
        };

        // Ajouter la réponse au stockage local
        const replies = { ...this.commentReplies() };
        if (!replies[comment.id]) {
          replies[comment.id] = [];
        }
        replies[comment.id].push(reply);
        this.commentReplies.set(replies);

        console.log('Réponse ajoutée:', replyTextValue, 'au commentaire:', comment.text);

        // Réinitialiser
        this.replyText[comment.id] = '';
        this.activeReplyCommentId.set(null);
      },
      error: (err) => {
        console.error('Erreur lors de l\'ajout de la réponse:', err);
        alert('Erreur lors de l\'ajout de la réponse');
      }
    });
  }

  // ========== PUBLICATIONS INTERACTIONS ==========

  // Signaux pour les modals et états des publications
  publicationComments = signal<{ [key: string]: any[] }>({});
  publicationLikes = signal<{ [key: string]: any[] }>({});
  publicationClones = signal<{ [key: string]: any[] }>({});
  showPublicationCommentsModal = signal(false);
  showPublicationLikesModal = signal(false);
  showPublicationClonesModal = signal(false);
  selectedPublicationId = signal<string | null>(null);
  publicationCommentText = signal<{ [key: string]: string }>({});
  publicationCommentReactions = signal<{ [key: string]: { [key: string]: number } }>({});
  publicationCommentReplies = signal<{ [key: string]: any[] }>({});

  // Liker/Unliker une publication (Toggle)
  likePublication(pub: any): void {
    if (!this.currentUserId()) {
      this.router.navigate(['/login']);
      return;
    }

    this.plansService.likePublication(pub.id, this.currentUserId(), this.currentUsername()).subscribe({
      next: (response: any) => {
        // Mettre à jour l'état du like
        pub.isLiked = response.liked;
        pub.likes = response.likesCount;

        // ✅ Créer une notification si c'est un nouveau like (pas un unlike)
        if (response.liked && pub.authorId !== this.currentUserId()) {
          this.plansService.createNotification(
            pub.authorId,
            this.currentUserId(),
            this.currentUsername(),
            'like',
            pub.id,
            pub.description || 'Publication'
          ).subscribe({
            next: () => console.log('Notification créée'),
            error: (err) => console.error('Erreur notification:', err)
          });
        }
      },
      error: (err) => {
        console.error('Erreur lors du like:', err);
        alert('Erreur lors du like');
      }
    });
  }

  // Ajouter un commentaire à une publication
  addPublicationComment(pub: any): void {
    if (!this.currentUserId()) {
      this.router.navigate(['/login']);
      return;
    }

    const commentTextValue = this.publicationCommentText()[pub.id];
    if (!commentTextValue || commentTextValue.trim() === '') {
      alert('Veuillez entrer un commentaire');
      return;
    }

    this.plansService.addPublicationComment(pub.id, this.currentUserId(), this.currentUsername(), commentTextValue).subscribe({
      next: (response: any) => {
        // Ajouter le commentaire à la liste
        const comments = { ...this.publicationComments() };
        if (!comments[pub.id]) {
          comments[pub.id] = [];
        }
        comments[pub.id].push(response.comment);
        this.publicationComments.set(comments);

        // Réinitialiser le texte
        const newCommentText = { ...this.publicationCommentText() };
        newCommentText[pub.id] = '';
        this.publicationCommentText.set(newCommentText);

        // Mettre à jour le nombre de commentaires
        pub.commentsCount = (pub.commentsCount || 0) + 1;

        // ✅ Créer une notification pour le créateur de la publication
        if (pub.authorId !== this.currentUserId()) {
          this.plansService.createNotification(
            pub.authorId,
            this.currentUserId(),
            this.currentUsername(),
            'comment',
            pub.id,
            pub.description || 'Publication'
          ).subscribe({
            next: () => console.log('Notification commentaire créée'),
            error: (err: any) => console.error('Erreur notification:', err)
          });
        }
      },
      error: (err: any) => {
        console.error('Erreur lors de l\'ajout du commentaire:', err);
        alert('Erreur lors de l\'ajout du commentaire');
      }
    });
  }

  // Ajouter une réponse à un commentaire d'une publication (wrapper)
  addPublicationReplyWrapper(commentId: string): void {
    const pubId = this.selectedPublicationId();
    if (!pubId) return;

    // Créer un objet publication temporaire
    const pub = { id: pubId };

    // Créer un objet commentaire temporaire
    const comment = { id: commentId };

    this.addPublicationReply(pub, comment);
  }

  // Ajouter une réponse à un commentaire d'une publication
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
        // Recharger les détails de la publication
        this.loadPublicationDetails({ id: pub.id });

        // Réinitialiser
        this.replyText[comment.id] = '';
        this.activeReplyCommentId.set(null);
      },
      error: (err) => {
        console.error('Erreur lors de l\'ajout de la réponse:', err);
        alert('Erreur lors de l\'ajout de la réponse');
      }
    });
  }

  // Ajouter une réaction à un commentaire d'une publication (wrapper)
  addPublicationReactionWrapper(commentId: string, emoji: string): void {
    const pubId = this.selectedPublicationId();
    if (!pubId) return;

    // Créer un objet publication temporaire
    const pub = { id: pubId };

    // Créer un objet commentaire temporaire
    const comment = { id: commentId };

    this.addPublicationReaction(pub, comment, emoji);
  }

  // Ajouter une réaction à un commentaire d'une publication
  addPublicationReaction(pub: any, comment: any, emoji: string): void {
    if (!this.currentUserId()) {
      this.router.navigate(['/login']);
      return;
    }

    this.plansService.addPublicationReaction(pub.id, comment.id, this.currentUserId(), this.currentUsername(), emoji).subscribe({
      next: (response: any) => {
        // Recharger les détails de la publication
        this.loadPublicationDetails({ id: pub.id });
        this.activeReactionCommentId.set(null);
      },
      error: (err) => {
        console.error('Erreur lors de l\'ajout de la réaction:', err);
      }
    });
  }

  // Cloner une publication
  clonePublication(pub: any): void {
    if (!this.currentUserId()) {
      this.router.navigate(['/login']);
      return;
    }

    this.plansService.clonePublication(pub.id, this.currentUserId(), this.currentUsername()).subscribe({
      next: (response: any) => {
        alert('Plan cloné avec succès! 🎉');
        pub.clonedBy = response.clonedCount;

        // ✅ Créer une notification pour le créateur de la publication
        if (pub.authorId !== this.currentUserId()) {
          this.plansService.createNotification(
            pub.authorId,
            this.currentUserId(),
            this.currentUsername(),
            'clone',
            pub.id,
            pub.description || 'Publication'
          ).subscribe({
            next: () => console.log('Notification clone créée'),
            error: (err: any) => console.error('Erreur notification:', err)
          });
        }

        // Recharger les publications
        this.loadPlans();
      },
      error: (err: any) => {
        console.error('Erreur lors du clonage:', err);
        alert('Erreur lors du clonage');
      }
    });
  }

  // Charger les détails d'une publication (commentaires, likes, clones)
  loadPublicationDetails(pub: any): void {
    this.plansService.getPublicationDetails(pub.id, this.currentUserId()).subscribe({
      next: (response: any) => {
        // Stocker les commentaires
        const comments = { ...this.publicationComments() };
        comments[pub.id] = response.comments || [];
        this.publicationComments.set(comments);

        // Stocker les likes
        const likes = { ...this.publicationLikes() };
        likes[pub.id] = response.likes || [];
        this.publicationLikes.set(likes);

        // Stocker les clones
        const clones = { ...this.publicationClones() };
        clones[pub.id] = response.clonedBy || [];
        this.publicationClones.set(clones);

        // Charger les réactions et réponses
        this.loadPublicationRepliesAndReactions(response.comments || []);
      },
      error: (err) => {
        console.error('Erreur lors du chargement des détails:', err);
      }
    });
  }

  loadPublicationRepliesAndReactions(comments: any[]): void {
    const replies: { [key: string]: any[] } = {};
    const reactions: { [key: string]: { [key: string]: number } } = {};

    comments.forEach((comment: any) => {
      if (comment.replies && Array.isArray(comment.replies)) {
        replies[comment.id] = comment.replies;
      }

      if (comment.reactions && Array.isArray(comment.reactions)) {
        reactions[comment.id] = {};
        comment.reactions.forEach((reaction: any) => {
          const emoji = reaction.type || '👍';
          reactions[comment.id][emoji] = (reactions[comment.id][emoji] || 0) + 1;
        });
      }
    });

    this.publicationCommentReplies.set(replies);
    this.publicationCommentReactions.set(reactions);
  }

  // Afficher le modal des commentaires
  showPublicationComments(pub: any): void {
    this.selectedPublicationId.set(pub.id);
    this.loadPublicationDetails(pub);
    this.showPublicationCommentsModal.set(true);
  }

  // Afficher le modal des likes
  showPublicationLikes(pub: any): void {
    this.selectedPublicationId.set(pub.id);
    this.loadPublicationDetails(pub);
    this.showPublicationLikesModal.set(true);
  }

  // Afficher le modal des clones
  showPublicationClones(pub: any): void {
    this.selectedPublicationId.set(pub.id);
    this.loadPublicationDetails(pub);
    this.showPublicationClonesModal.set(true);
  }

  // Helper pour accéder à Object.keys dans le template
  Object = Object;
}
