import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root',
})
export class ReviewService {

  private apiUrl = 'http://127.0.0.1:8000/api/reviews/';

  constructor(private http: HttpClient) {}

  getReviews(placeId: string): Observable<any> {
    return this.http.get(`${this.apiUrl}?place_id=${placeId}`);
  }
 sumAI(reviews: any[]): Observable<any> {
  return this.http.post(`${this.apiUrl}sum/`, { result: { reviews } });
}

}
