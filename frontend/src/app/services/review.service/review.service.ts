import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environment/env';

@Injectable({
  providedIn: 'root',
})
export class ReviewService {

  private apiUrl = 'http://127.0.0.1:8000/api/reviews/';

  constructor(private http: HttpClient) {}

  getReviews(placeId: string): Observable<any> {
    console.log('🔍 Fetching reviews for placeId:', placeId);
    const url = `${this.apiUrl}?place_id=${placeId}`;
    console.log('📡 API URL:', url);
    
    return this.http.get<any>(url).pipe(
      tap((response) => {
        console.log('✅ Reviews fetched successfully:', response);
      }),
      catchError((error) => {
        console.error('❌ Error fetching reviews:', error);
        console.error('Status:', error.status);
        console.error('Message:', error.message);
        // Return empty reviews array as fallback
        return of({ result: { reviews: [] } });
      })
    );
  }

  sumAI(reviews: any[]): Observable<any> {
    console.log('🤖 Summarizing reviews with AI, count:', reviews.length);
    
    const payload = { reviews: reviews };
    console.log('📤 Sending payload:', payload);
    
    return this.http.post<any>(`${this.apiUrl}sum/`, payload).pipe(
      tap((response) => {
        console.log('✅ AI summary generated:', response);
      }),
      catchError((error) => {
        console.error('❌ Error summarizing reviews:', error);
        return of({ summary: 'Résumé non disponible pour le moment' });
      })
    );
  }
}
