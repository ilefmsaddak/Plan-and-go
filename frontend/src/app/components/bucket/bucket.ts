import { Component, OnInit } from '@angular/core';
import { BucketService, FavoritePlace } from '../../services/bucket.service/bucketService';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';

interface DayPlan {
  date: string;
  temp: string;
  places: FavoritePlace[];
}

@Component({
  selector: 'app-bucket',
  imports: [CommonModule, DragDropModule, FormsModule],
  templateUrl: './bucket.html',
  styleUrls: ['./bucket.css'],
})
export class Bucket implements OnInit {

  favorites: FavoritePlace[] = [];
  days: DayPlan[] = [];
  favoritesConnectedTo: string[] = [];

  typeIcons: { [key: string]: string } = {
    site: '📷',
    hotel: '🏨',
    food: '🍽️',
    cafe: '☕',
    shop: '🛍️',
    transports: '🚌'
  };
  plans = [
    { id: 1, name: 'New York' },
    { id: 2, name: 'Los Angeles' },
    { id: 3, name: 'Chicago' },
    { id: 4, name: 'Houston' }
  ];
  selectedPlan: any = null;

  onSelectChange(event: any) {
    console.log("vent.target.value", event.target.value)
    this.selectedPlan = event.target.value;
  }
  constructor(public bucketService: BucketService) { }

  ngOnInit(): void {
    this.bucketService.favorites$.subscribe((favs: FavoritePlace[]) => {
      this.favorites = favs;
      console.log("Favorites updated:", this.favorites);
    });

    // Temporary days
    this.days = [
      { date: '22/11/2025', temp: '82° / 73°', places: [] },
      { date: '23/11/2025', temp: '81° / 72°', places: [] },
      { date: '24/11/2025', temp: '80° / 72°', places: [] },
    ];

    // Generate IDs for connected drop lists
    this.favoritesConnectedTo = this.days.map((_, i) => `day-${i}`);
  }

  // Drop in favorites list (just reorder)
  onDropToFavorites(event: CdkDragDrop<FavoritePlace[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
    }
  }

  // Drop into a day
  onDropToDay(event: CdkDragDrop<FavoritePlace[]>, dayIndex: number) {
    const day = this.days[dayIndex];
    if (!day) return;

    if (event.previousContainer !== event.container) {
      const movedItem = event.previousContainer.data[event.previousIndex];

      transferArrayItem(
        event.previousContainer.data,
        day.places,
        event.previousIndex,
        event.currentIndex
      );

      // Remove only the dragged object, not all with same id
      this.bucketService.removeFavorite(movedItem);
    } else {
      moveItemInArray(day.places, event.previousIndex, event.currentIndex);
    }
  }
  removeFromDay(placeId: string, dayIndex: number) {
    const day = this.days[dayIndex];
    if (!day) return;
    const index = day.places.findIndex(p => p.id === placeId);
    if (index > -1) {
      day.places.splice(index, 1);
    }
  }
  saveItinerary() {
    const tripId = localStorage.getItem("plan")! //'69222600a58e36d7798161f6'; // Replace with actual trip id when nour finiches
    this.bucketService.saveItinerary(this.days, tripId).subscribe({
      next: (res) => {
        console.log('Itinerary saved successfully', res);
        alert('Itinerary saved!');
      },
      error: (err) => {
        console.error('Error saving itinerary', err);
        alert('Failed to save itinerary.');
      }
    });
  }

}
