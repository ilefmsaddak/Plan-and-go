import { Component, OnInit, Output, EventEmitter } from '@angular/core';
import { BucketService, FavoritePlace, DayPlan } from '../../services/bucket.service/bucketService';
import { CommonModule } from '@angular/common';
import { DragDropModule, CdkDragDrop, moveItemInArray, transferArrayItem } from '@angular/cdk/drag-drop';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-bucket',
  imports: [CommonModule, DragDropModule, FormsModule],
  templateUrl: './bucket.html',
  styleUrls: ['./bucket.css'],
  standalone: true
})
export class Bucket implements OnInit {

  @Output() daySelected = new EventEmitter<{ day: DayPlan; dayIndex: number }>();
  @Output() dayDeselected = new EventEmitter<void>();

  favorites: FavoritePlace[] = [];
  days: DayPlan[] = [];
  favoritesConnectedTo: string[] = [];
  selectedDayIndex: number | null = null;

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

    // Load days from localStorage, or initialize defaults
    const savedDays = this.bucketService.getSavedDays();
    if (savedDays && savedDays.length > 0) {
      this.days = savedDays;
     
    } else {
      this.days = [
        { date: '22/11/2025', temp: '82° / 73°', places: [] },
        { date: '23/11/2025', temp: '81° / 72°', places: [] },
        { date: '24/11/2025', temp: '80° / 72°', places: [] },
        
      ];
      this.bucketService.saveDays(this.days);
    }

    // Generate IDs for connected drop lists
    this.favoritesConnectedTo = this.days.map((_, i) => `day-${i}`);
  }

  // Drop in favorites list (just reorder)
  onDropToFavorites(event: CdkDragDrop<FavoritePlace[]>) {
    if (event.previousContainer === event.container) {
      moveItemInArray(event.container.data, event.previousIndex, event.currentIndex);
      // Persist order changes
      this.bucketService.setFavorites(this.favorites);
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
      this.bucketService.saveDays(this.days);
    } else {
      moveItemInArray(day.places, event.previousIndex, event.currentIndex);
      this.bucketService.saveDays(this.days);
    }
  }
  removeFromDay(placeId: string, dayIndex: number) {
    const day = this.days[dayIndex];
    if (!day) return;
    const index = day.places.findIndex(p => p.id === placeId);
    if (index > -1) {
      day.places.splice(index, 1);
      this.bucketService.saveDays(this.days);
    }
  }

  selectDay(dayIndex: number): void {
    const day = this.days[dayIndex];
    if (!day) return;

    if (day.places.length === 0) {
      alert('Ce jour n\'a pas de places. Ajoutez des places en les glissant-déposant.');
      return;
    }

    this.selectedDayIndex = dayIndex;
    this.daySelected.emit({ day, dayIndex });
    console.log('📅 Day selected:', dayIndex, day);
  }

  deselectDay(): void {
    this.selectedDayIndex = null;
    this.dayDeselected.emit();
    console.log('📅 Day deselected');
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
