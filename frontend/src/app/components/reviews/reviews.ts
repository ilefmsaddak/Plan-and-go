import { Component, Input } from '@angular/core';
import { FormsModule } from '@angular/forms'; 
import { ReviewService } from '../../services/review.service/review.service';
import { CommonModule } from '@angular/common';
@Component({
  selector: 'app-reviews',
  standalone: true,
  imports: [FormsModule, CommonModule],
  templateUrl: './reviews.html',
  styleUrl: './reviews.css',
})
export class Reviews {
  @Input() placeId: string = ""; 
  aiSummary: string = '';
  reviews: any[] = [];

  constructor(private rs: ReviewService) {}

  ngOnChanges() {
    if (this.placeId) {
      this.findReviews();
    }
  }

  findReviews() {
    this.rs.getReviews(this.placeId).subscribe((data) => {
      this.reviews = data.result?.reviews || [];
});
  }

  loading = false;

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
