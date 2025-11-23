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

  aiSummary: string = '';
  reviews: any[] = [];
  tripId: string = "69222600a58e36d7798161f6"; // temporary

  loading = false;

  constructor(private rs: ReviewService, private bs: BucketService) {}

  ngOnChanges(changes: SimpleChanges) {
    if (changes['placeId'] && this.placeId) {
      this.findReviews();
    }
  }

  findReviews() {
    this.rs.getReviews(this.placeId).subscribe((data) => {
      this.reviews = data.result?.reviews || [];
    });
  }

  addToFavorite() {
    const place: FavoritePlace = { id: this.placeId, name: this.placeName, type: this.type };
    this.bs.addToFavorites(place);
    console.log('Added to favorite:', place);
  }

  SumReviews() {
    this.loading = true;         
    this.rs.sumAI(this.reviews).subscribe({
      next: (result) => {
        this.aiSummary = result.summary;
        this.loading = false;    
      },
      error: (err) => {
        console.error('AI summary error:', err);
        this.aiSummary = "⚠️ Error generating summary. Please try again.";
        this.loading = false;    
      }
    });
  }
}
