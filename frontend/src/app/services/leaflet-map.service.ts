import { Injectable } from '@angular/core';
import { MapService } from './map.service';
import { Place } from '../models/interfaces';
import * as L from 'leaflet';
import { HttpClient } from '@angular/common/http';
import { environment } from '../environment/env';

@Injectable({
  providedIn: 'root'
})
export class LeafletMapService extends MapService {
  private map: L.Map | null = null;
  private markers: L.Marker[] = [];
  private routeLayer: L.Polyline | null = null;
  private ready = false;

  constructor(private http: HttpClient) {
    super();
  }

  async initialize(mapElement: HTMLElement, initialLocation: { lat: number; lng: number }, zoom: number): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.map = L.map(mapElement).setView([initialLocation.lat, initialLocation.lng], zoom);

        // Add OpenStreetMap tiles
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors',
          maxZoom: 19
        }).addTo(this.map);

        this.ready = true;
        resolve();
      } catch (error) {
        reject(new Error('Failed to initialize Leaflet map'));
      }
    });
  }

  addMarkers(places: Place[], onMarkerClick?: (place: Place) => void): void {
    if (!this.map) return;

    places.forEach(place => {
      const marker = L.marker([place.coordinates.lat, place.coordinates.lng], {
        icon: this.createEmojiIcon(place.type)
      })
        .bindPopup(this.createPopupContent(place))
        .addTo(this.map!);

      if (onMarkerClick) {
        marker.on('click', () => onMarkerClick(place));
      }

      this.markers.push(marker);
    });
  }

  clearMarkers(): void {
    this.markers.forEach(marker => {
      if (this.map) {
        this.map.removeLayer(marker);
      }
    });
    this.markers = [];
  }

  fitBounds(places: Place[]): void {
    if (!this.map || places.length === 0) return;

    const bounds = L.latLngBounds(
      places.map(p => [p.coordinates.lat, p.coordinates.lng])
    );

    this.map.fitBounds(bounds, { padding: [50, 50] });

    // Don't zoom too much if single marker
    if (places.length === 1) {
      setTimeout(() => {
        if (this.map) {
          this.map.setZoom(15);
        }
      }, 100);
    }
  }

  centerOnLocation(lat: number, lng: number, zoom: number): void {
    if (!this.map) return;
    this.map.setView([lat, lng], zoom);
  }

  async calculateRoute(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): Promise<void> {
    if (!this.map) return;

    try {
      // Use OpenRouteService with proper API key
      const apiKey = environment.openRouteServiceKey;
      const url = `https://api.openrouteservice.org/v2/directions/driving-car?api_key=${apiKey}&start=${origin.lng},${origin.lat}&end=${destination.lng},${destination.lat}`;

      const response = await this.http.get<any>(url).toPromise();

      if (response && response.features && response.features.length > 0) {
        const coords = response.features[0].geometry.coordinates;
        const latLngs = coords.map((c: [number, number]) => [c[1], c[0]]);

        // Remove old route
        if (this.routeLayer) {
          this.map.removeLayer(this.routeLayer);
        }

        // Add new route
        this.routeLayer = L.polyline(latLngs, {
          color: '#667eea',
          weight: 4,
          opacity: 0.8
        }).addTo(this.map);

        // Fit bounds to show route
        const routeBounds = L.latLngBounds(latLngs);
        this.map.fitBounds(routeBounds, { padding: [50, 50] });
      }
    } catch (error) {
      console.error('Route calculation failed:', error);
      // Fallback to straight line if routing fails
      this.drawSimpleRoute(origin, destination);
    }
  }

  private drawSimpleRoute(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): void {
    // Draw a simple straight line as fallback
    if (this.routeLayer) {
      this.map!.removeLayer(this.routeLayer);
    }

    this.routeLayer = L.polyline([[origin.lat, origin.lng], [destination.lat, destination.lng]], {
      color: '#667eea',
      weight: 4,
      opacity: 0.8,
      dashArray: '5, 5'
    }).addTo(this.map!);

    console.warn('Using fallback route (straight line)');
  }

  isReady(): boolean {
    return this.ready;
  }

  private createEmojiIcon(type: string): L.Icon {
    const emojiMap: { [key: string]: string } = {
      site: '📷',
      hotel: '🏨',
      food: '🍽️',
      cafe: '☕',
      shop: '🛍️',
      transports: '🚌'
    };

    const colorMap: { [key: string]: string } = {
      site: '#4285f4',
      hotel: '#34a853',
      food: '#fbbc05',
      cafe: '#ea4335',
      shop: '#f39c12',
      transports: '#ff6d00'
    };

    const emoji = emojiMap[type] || '📍';
    const color = colorMap[type] || '#667eea';

    // Create canvas icon
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // White background
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(20, 20, 18, 0, Math.PI * 2);
      ctx.fill();

      // Colored border
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(20, 20, 18, 0, Math.PI * 2);
      ctx.stroke();

      // Emoji
      ctx.font = '24px Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, 20, 20);
    }

    return new L.Icon({
      iconUrl: canvas.toDataURL(),
      iconSize: [40, 40],
      iconAnchor: [20, 40],
      popupAnchor: [0, -40]
    });
  }

  private createPopupContent(place: Place): string {
    const photoUrl = place.photos && place.photos.length > 0
      ? place.photos[0]
      : 'https://via.placeholder.com/300x200?text=No+Image';

    return `
      <div class="leaflet-popup-content" style="
        width: 300px;
        font-family: 'Segoe UI', Arial;
      ">
        <div style="position: relative; background: #f5f5f5;">
          <img src="${photoUrl}" alt="${place.name}" style="
            width: 100%;
            height: 180px;
            object-fit: cover;
            display: block;
          "/>
          <div style="
            position: absolute;
            top: 10px;
            right: 10px;
            background: #fff;
            padding: 6px 12px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 600;
            color: #667eea;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">${place.type}</div>
        </div>
        <div style="padding: 16px;">
          <h3 style="
            margin: 0 0 8px 0;
            color: #333;
            font-size: 16px;
            font-weight: 600;
          ">${place.name}</h3>
          <p style="
            margin: 0 0 12px 0;
            color: #666;
            font-size: 13px;
            line-height: 1.5;
          ">
            📍 ${place.address}
          </p>
          <div style="
            display: flex;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
          ">
            <span style="
              color: #ffc107;
              font-size: 14px;
              letter-spacing: 1px;
            ">${this.getStars(place.rating)}</span>
            <span style="
              color: #999;
              font-size: 12px;
            ">(${place.reviews.toLocaleString()} avis)</span>
          </div>
        </div>
      </div>
    `;
  }

  private getStars(rating: number): string {
    return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
  }
}
