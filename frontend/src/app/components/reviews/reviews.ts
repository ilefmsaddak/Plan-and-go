import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';
import { FormsModule } from '@angular/forms'; 
import { ReviewService } from '../../services/review.service/review.service';
import { CommonModule } from '@angular/common';
import { BucketService, FavoritePlace } from '../../services/bucket.service/bucketService';

@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './reviews.html',
  styleUrls: ['./reviews.css'],
})
export class Reviews implements OnChanges {
  @Input() placeId: string = ""; 
  @Input() placeName: string = "";
  @Input() type: string = "";
  @Input() coordinates?: { lat: number; lng: number };

  aiSummary: string = '';
  reviews: any[] = [];
  tripId: string = "69222600a58e36d7798161f6"; // temporary
  reviewsError: string | null = null;
  loading = false;

  constructor(private rs: ReviewService, private bs: BucketService) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['placeId'] && this.placeId) {
      this.findReviews();
    }
  }

  findReviews() {
    console.log('🔍 Finding reviews for placeId:', this.placeId);
    this.reviewsError = null;
    this.rs.getReviews(this.placeId).subscribe((data) => {
      console.log('📦 Raw response from backend:', data);
      
      // Handle different possible response structures
      let reviewsArray = [];
      if (data.reviews) {
        reviewsArray = data.reviews;
      } else if (data.result?.reviews) {
        reviewsArray = data.result.reviews;
      } else if (Array.isArray(data)) {
        reviewsArray = data;
      }
      
      this.reviews = reviewsArray || [];
      console.log('📋 Extracted reviews:', this.reviews);
      
      if (this.reviews.length === 0) {
        this.reviewsError = 'No reviews available for this place at the moment.';
        console.warn('⚠️ No reviews found');
      } else {
        console.log('✅ Found', this.reviews.length, 'reviews');
      }
    }, (error) => {
      this.reviewsError = 'Unable to load reviews. Please try again.';
      console.error('❌ Error fetching reviews:', error);
    });
  }

  addToFavorite() {
    const place: FavoritePlace = { id: this.placeId, name: this.placeName, type: this.type, coordinates: this.coordinates };
    this.bs.addToFavorites(place);
    console.log('Added to favorite:', place);
  }

  SumReviews() {
    if (this.reviews.length === 0) {
      alert('No reviews to summarize. Please wait for reviews to load.');
      return;
    }

    this.loading = true;
    console.log('🤖 Sending', this.reviews.length, 'reviews for AI summary');
    
    this.rs.sumAI(this.reviews).subscribe({
      next: (result) => {
        console.log('📤 AI Summary Response:', result);
        
        // Handle different possible response structures
        let summary = '';
        if (result.summary) {
          summary = result.summary;
        } else if (result.data?.summary) {
          summary = result.data.summary;
        } else if (typeof result === 'string') {
          summary = result;
        }
        
        this.aiSummary = summary || 'Summary unavailable';
        console.log('✅ AI Summary:', this.aiSummary);
        this.loading = false;
      },
      error: (err) => {
        console.error('❌ AI summary error:', err);
        this.aiSummary = "⚠️ Error generating summary. Please try again.";
        this.loading = false;
      }
    });
  }
}
