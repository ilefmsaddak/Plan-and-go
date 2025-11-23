import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface Plan {
  id: string;
  title?: string;
  description?: string;
  location?: string;
  city?: string;  // City name
  author: string;
  authorId: string;
  author_id?: string;  // Fallback
  likes?: number;
  commentsCount?: number;
  comments_count?: number;  // Fallback
  isPublic?: boolean;  // For private plans
  is_public?: boolean;  // Fallback
  isLiked?: boolean;
  isCloned?: boolean;
  createdAt?: string;
  created_at?: string;  // Fallback
  likedBy?: string[];  // Array of usernames who liked
  comments?: Comment[];  // Array of comments
  fromDate?: string;  // Start date
  from_date?: string;  // Fallback
  toDate?: string;  // End date
  to_date?: string;  // Fallback
  placesCount?: number;  // Number of places
  places_count?: number;  // Fallback
  daysCount?: number;  // Number of days
  days_count?: number;  // Fallback
  clonedFrom?: string;  // Original author if cloned
  cloned_from?: string;  // Fallback
  clonedFromPlanId?: string;  // Original plan ID if cloned
  cloned_from_plan_id?: string;  // Fallback
  clonedBy?: string[];  // Array of users who cloned
  cloned_by?: string[];  // Fallback
}

export interface Comment {
  id: string;
  author: string;
  authorId: string;
  text: string;
  createdAt: string;
}

export interface Notification {
  id?: string;
  _id?: string;
  sender?: string;
  sender_name?: string;
  senderId?: string;
  sender_id?: string;
  action?: string;
  action_type?: string;
  planId?: string;
  plan_id?: string;
  pub_id?: string;
  pubId?: string;
  recipientId?: string;
  recipient_id?: string;
  planTitle?: string;
  description?: string;
  message: string;
  isRead?: boolean;
  is_read?: boolean;
  createdAt?: string;
  created_at?: string;
}

export interface UserProfile {
  userId: string;
  username: string;
  email: string;
  bio: string;
  avatarUrl: string;
  publicPlans: Plan[];
  followers: number;
  following: number;
  followersList?: string[]; // Array of follower usernames
  followingList?: string[]; // Array of following usernames
}

@Injectable({
  providedIn: 'root'
})
export class SocialService {
  private apiUrl = 'http://127.0.0.1:8000/api';

  constructor(private http: HttpClient) {}

  // Plans
  getPublicPlans(userId?: string): Observable<Plan[]> {
    let url = `${this.apiUrl}/plans/`;
    if (userId) {
      url += `?user_id=${userId}`;
    }
    return this.http.get<Plan[]>(url);
  }

  getPlanDetail(planId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/plans/${planId}/`);
  }

  createPlan(plan: any): Observable<any> {
    return this.http.post(`${this.apiUrl}/plans/`, plan);
  }

  // Likes
  likePlan(planId: string, userId: string, userName: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/plans/${planId}/like/`, {
      user_id: userId,
      user_name: userName
    });
  }

  unlikePlan(planId: string, userId: string, userName: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/plans/${planId}/unlike/`, {
      user_id: userId,
      user_name: userName
    });
  }

  // Comments
  addComment(planId: string, userId: string, userName: string, text: string): Observable<Comment> {
    return this.http.post<Comment>(`${this.apiUrl}/plans/${planId}/comment/`, {
      user_id: userId,
      user_name: userName,
      text: text
    });
  }

  // Clone
  clonePlan(planId: string, userId: string, userName: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/plans/${planId}/clone/`, {
      user_id: userId,
      user_name: userName
    });
  }

  // Notifications
  getUserNotifications(userId: string): Observable<Notification[]> {
    return this.http.get<Notification[]>(`${this.apiUrl}/notifications/${userId}/`);
  }

  // Profile
  getUserProfile(userId: string): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.apiUrl}/profile/${userId}/`);
  }

  getUserPrivatePlans(userId: string): Observable<Plan[]> {
    return this.http.get<Plan[]>(`${this.apiUrl}/profile/${userId}/private-plans/`);
  }

  getUserClonedPlans(userId: string): Observable<Plan[]> {
    return this.http.get<Plan[]>(`${this.apiUrl}/profile/${userId}/cloned-plans/`);
  }

  // Search
  getPlansByCity(city: string, userId?: string): Observable<Plan[]> {
    let url = `${this.apiUrl}/plans/by-city/?city=${encodeURIComponent(city)}`;
    if (userId) {
      url += `&user_id=${userId}`;
    }
    return this.http.get<Plan[]>(url);
  }

  getPublicationsByCity(city: string, userId?: string): Observable<any[]> {
    let url = `${this.apiUrl}/publications/by-city/?city=${encodeURIComponent(city)}`;
    if (userId) {
      url += `&user_id=${userId}`;
    }
    return this.http.get<any[]>(url);
  }

  // Follow/Unfollow
  followUser(userId: string, currentUserId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/profile/${userId}/follow/`, {
      current_user_id: currentUserId
    });
  }

  unfollowUser(userId: string, currentUserId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/profile/${userId}/unfollow/`, {
      current_user_id: currentUserId
    });
  }

  removeFollower(userId: string, followerId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/profile/${userId}/remove-follower/`, {
      follower_id: followerId
    });
  }

  checkFollowStatus(userId: string, currentUserId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/profile/${userId}/follow-status/?current_user_id=${currentUserId}`);
  }

  getAllUsers(currentUserId?: string): Observable<any[]> {
    let url = `${this.apiUrl}/users/`;
    if (currentUserId) {
      url += `?current_user_id=${currentUserId}`;
    }
    return this.http.get<any[]>(url);
  }

  // Share Plan (make private plan public)
  sharePlan(planId: string, userId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/plans/${planId}/share/`, {
      user_id: userId
    });
  }

  // Unshare Plan (make public plan private and delete publication)
  unsharePlan(planId: string, userId: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/plans/${planId}/unshare/`, {
      user_id: userId
    });
  }

  // Update User Profile
  updateUserProfile(userId: string, username: string, bio: string, email: string, currentPassword?: string, newPassword?: string): Observable<any> {
    const body: any = {
      username,
      bio,
      email
    };
    
    if (currentPassword && newPassword) {
      body.current_password = currentPassword;
      body.new_password = newPassword;
    }
    
    return this.http.post(`${this.apiUrl}/profile/${userId}/update/`, body);
  }
}
