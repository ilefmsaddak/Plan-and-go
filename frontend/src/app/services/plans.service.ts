import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Plan {
  id: string;
  title: string;
  description: string;
  location: string;
  authorId: string;
  author: string;  // Username from backend
  author_name?: string;  // Fallback for compatibility
  isPublic?: boolean;  // For private plans
  is_public?: boolean;  // Fallback
  likes?: number;  // Count from backend
  commentsCount?: number;  // Count from backend
  comments?: any[];  // Fallback
  cloned_by?: string[];
  createdAt: string;
  created_at?: string;  // Fallback
  updated_at?: string;
  isLiked?: boolean;
  isCloned?: boolean;
  likedBy?: string[];  // Array of usernames who liked
  likes_by?: string[];  // Fallback
  liked_by?: string[];  // Fallback
  place_bucket?: string;  // Place/bucket name
  city?: string;  // City name
  from_date?: string;  // Start date (dd/mm/yyyy format)
  to_date?: string;  // End date (dd/mm/yyyy format)
  from?: string;  // Alias for from_date
  to?: string;  // Alias for to_date
}

@Injectable({
  providedIn: 'root'
})
export class PlansService {
  private apiUrl = 'http://127.0.0.1:8000/api';

  constructor(private http: HttpClient) { }

  // Récupérer tous les plans publics
  getPublicPlans(userId?: string): Observable<any> {
    let url = `${this.apiUrl}/plans/`;
    if (userId) {
      url += `?user_id=${userId}`;
    }
    return this.http.get(url);
  }

  // Récupérer un plan spécifique
  getPlan(planId: string): Observable<Plan> {
    return this.http.get<Plan>(`${this.apiUrl}/plans/${planId}/`);
  }

  // Créer un nouveau plan
  createPlan(data: any): Observable<any> {

    return this.http.post(`${this.apiUrl}/plans/create/`, data);
  }

  // Liker un plan
  likePlan(planId: string, userId: string, userName: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/plans/${planId}/like/`, {
      user_id: userId,
      user_name: userName
    });
  }

  // Ajouter un commentaire
  addComment(planId: string, userId: string, userName: string, text: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/plans/${planId}/comment/`, {
      user_id: userId,
      user_name: userName,
      text: text
    });
  }

  // Ajouter une réponse à un commentaire
  addReply(planId: string, commentId: string, userId: string, userName: string, text: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/plans/${planId}/comment/${commentId}/reply/`, {
      user_id: userId,
      user_name: userName,
      text: text
    });
  }

  // Ajouter une réaction à un commentaire
  addReactionToComment(planId: string, commentId: string, userId: string, userName: string, emoji: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/plans/${planId}/comment/${commentId}/reaction/`, {
      user_id: userId,
      user_name: userName,
      emoji: emoji
    });
  }

  // Cloner un plan
  clonePlan(planId: string, userId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/plans/${planId}/clone/`, {
      user_id: userId
    });
  }

  // Récupérer les plans privés d'un utilisateur
  getUserPrivatePlans(userId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/profile/${userId}/private-plans/`);
  }

  // Récupérer toutes les publications
  getPublications(userId?: string): Observable<any> {
    let url = `${this.apiUrl}/publications/`;
    if (userId) {
      url += `?user_id=${userId}`;
    }
    return this.http.get(url);
  }

  // Récupérer les publications d'un utilisateur spécifique
  getUserPublications(userId: string, currentUserId?: string): Observable<any> {
    let url = `${this.apiUrl}/publications/?author_id=${userId}`;
    if (currentUserId) {
      url += `&user_id=${currentUserId}`;
    }
    return this.http.get(url);
  }

  // Récupérer les détails d'une publication
  getPublicationDetails(pubId: string, userId?: string): Observable<any> {
    let url = `${this.apiUrl}/publications/${pubId}/`;
    if (userId) {
      url += `?user_id=${userId}`;
    }
    return this.http.get(url);
  }

  // Liker une publication
  likePublication(pubId: string, userId: string, userName: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/publications/${pubId}/like/`, {
      user_id: userId,
      user_name: userName
    });
  }

  // Ajouter un commentaire à une publication
  addPublicationComment(pubId: string, userId: string, userName: string, text: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/publications/${pubId}/comment/`, {
      user_id: userId,
      user_name: userName,
      text: text
    });
  }

  // Ajouter une réponse à un commentaire d'une publication
  addPublicationReply(pubId: string, commentId: string, userId: string, userName: string, text: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/publications/${pubId}/comment/${commentId}/reply/`, {
      user_id: userId,
      user_name: userName,
      text: text
    });
  }

  // Ajouter une réaction à un commentaire d'une publication
  addPublicationReaction(pubId: string, commentId: string, userId: string, userName: string, emoji: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/publications/${pubId}/comment/${commentId}/reaction/`, {
      user_id: userId,
      user_name: userName,
      emoji: emoji
    });
  }

  // Cloner une publication
  clonePublication(pubId: string, userId: string, userName: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/publications/${pubId}/clone/`, {
      user_id: userId,
      user_name: userName
    });
  }

  // Publier un plan (créer une publication)
  publishPlan(planId: string, userId: string, description: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/plans/${planId}/publish/`, {
      user_id: userId,
      description: description
    });
  }

  // Créer une notification
  createNotification(recipientId: string, senderId: string, senderName: string, actionType: string, pubId: string, description: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/notifications/`, {
      recipient_id: recipientId,
      sender_id: senderId,
      sender_name: senderName,
      action_type: actionType,
      pub_id: pubId,
      description: description
    });
  }
}
