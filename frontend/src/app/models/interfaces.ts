export interface Place {
  name: string;
  address: string;
  rating: number;
  reviews: number;
  type: 'site' | 'hotel' | 'food' | 'cafe' | 'shop' | 'transports';
  coordinates: { lat: number; lng: number };
  placeId?: string;
  phoneNumber?: string;
  website?: string;
  photos?: string[];
  openingHours?: string[];
}
