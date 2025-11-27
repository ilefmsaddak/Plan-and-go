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
        // Wait for the container to be properly sized
        setTimeout(() => {
          this.initializeMap(mapElement, initialLocation, zoom);
          resolve();
        }, 100);
      } catch (error) {
        reject(new Error('Failed to initialize Leaflet map'));
      }
    });
  }

  private initializeMap(mapElement: HTMLElement, initialLocation: { lat: number; lng: number }, zoom: number): void {
    // Ensure container has proper dimensions
    this.ensureContainerSize(mapElement);

    this.map = L.map(mapElement, {
      center: [initialLocation.lat, initialLocation.lng],
      zoom: zoom,
      zoomControl: false,
      attributionControl: true,
      preferCanvas: true,
      fadeAnimation: true,
      markerZoomAnimation: true,
      trackResize: true, // Important for handling container resizes
      renderer: L.canvas()
    });

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 19
    }).addTo(this.map);

    // Add zoom control
    L.control.zoom({
      position: 'bottomright'
    }).addTo(this.map);

    // Handle map events for proper sizing
    this.map.whenReady(() => {
      console.log('🗺️ Leaflet map ready');
      this.ready = true;

      // Force resize and validation
      setTimeout(() => {
        this.map?.invalidateSize();
      }, 200);
    });

    // Handle resize events
    this.map.on('resize', () => {
      console.log('🔄 Map container resized');
      setTimeout(() => {
        this.map?.invalidateSize();
      }, 50);
    });
  }

  private ensureContainerSize(mapElement: HTMLElement): void {
    const computedStyle = window.getComputedStyle(mapElement);

    // Ensure container has height
    if (computedStyle.height === '0px' || computedStyle.height === 'auto') {
      console.warn('⚠️ Map container has no height, setting default');
      mapElement.style.height = '100vh';
    }

    // Ensure container has width
    if (computedStyle.width === '0px' || computedStyle.width === 'auto') {
      console.warn('⚠️ Map container has no width, setting default');
      mapElement.style.width = '100%';
    }
  }

  addMarkers(places: Place[], onMarkerClick?: (place: Place) => void): void {
    if (!this.map || !this.ready) {
      console.error('❌ Map not ready for adding markers');
      return;
    }

    this.clearMarkers();

    places.forEach(place => {
      try {
        const marker = L.marker([place.coordinates.lat, place.coordinates.lng], {
          icon: this.createEmojiIcon(place.type, false)
        })
          .bindPopup(this.createSimplePopup(place))
          .addTo(this.map!);

        if (onMarkerClick) {
          marker.on('click', () => onMarkerClick(place));
        }

        this.markers.push(marker);
      } catch (error) {
        console.error(`❌ Error adding marker for ${place.name}:`, error);
      }
    });

    console.log(`✅ Added ${this.markers.length} markers to map`);
  }

  addMarkersWithHighlight(places: Place[], highlightIds: Set<string>, onMarkerClick?: (place: Place) => void): void {
    if (!this.map || !this.ready) {
      console.error('❌ Map not ready for adding markers');
      return;
    }

    this.clearMarkers();

    places.forEach(place => {
      try {
        const highlighted = place.placeId ? highlightIds.has(place.placeId) : false;
        const marker = L.marker([place.coordinates.lat, place.coordinates.lng], {
          icon: this.createEmojiIcon(place.type, highlighted)
        })
          .bindPopup(this.createSimplePopup(place))
          .addTo(this.map!);

        if (onMarkerClick) {
          marker.on('click', () => onMarkerClick(place));
        }

        this.markers.push(marker);
      } catch (error) {
        console.error(`❌ Error adding marker for ${place.name}:`, error);
      }
    });

    console.log(`✅ Added ${this.markers.length} markers (with highlight where applicable)`);
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
    if (!this.map || !this.ready || places.length === 0) return;

    // Ensure map is properly sized before fitting bounds
    setTimeout(() => {
      this.map?.invalidateSize();

      const bounds = L.latLngBounds(
        places.map(p => [p.coordinates.lat, p.coordinates.lng])
      );

      this.map?.fitBounds(bounds, {
        padding: [20, 20],
        maxZoom: 14
      });

      // Don't zoom too much if single marker
      if (places.length === 1) {
        setTimeout(() => {
          if (this.map) {
            this.map.setZoom(15);
          }
        }, 100);
      }
    }, 100);
  }

  centerOnLocation(lat: number, lng: number, zoom: number): void {
    if (!this.map || !this.ready) return;

    setTimeout(() => {
      this.map?.invalidateSize();
      this.map?.setView([lat, lng], zoom);
    }, 50);
  }

  async calculateRoute(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): Promise<void> {
    if (!this.map || !this.ready) return;

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
    if (!this.map) return;

    // Draw a simple straight line as fallback
    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
    }

    this.routeLayer = L.polyline([[origin.lat, origin.lng], [destination.lat, destination.lng]], {
      color: '#667eea',
      weight: 4,
      opacity: 0.8,
      dashArray: '5, 5'
    }).addTo(this.map);

    console.warn('Using fallback route (straight line)');
  }

  isReady(): boolean {
    return this.ready;
  }

  // Force refresh map size (call this if map appears incomplete)
  refreshMap(): void {
    if (this.map && this.ready) {
      setTimeout(() => {
        this.map?.invalidateSize(true); // Force reset
      }, 100);
    }
  }

  // Display a route polyline from a list of [lat, lng] coordinates
  displayRoutePolyline(latLngs: [number, number][]): void {
    if (!this.map || !this.ready || latLngs.length < 2) {
      console.warn('Map not ready or insufficient coordinates to draw route');
      return;
    }

    if (this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
    }

    this.routeLayer = L.polyline(latLngs, {
      color: '#667eea',
      weight: 4,
      opacity: 0.8,
      dashArray: '0',
      lineCap: 'round',
      lineJoin: 'round'
    }).addTo(this.map);

    // Compute union bounds: route + existing markers
    let bounds = this.routeLayer.getBounds();
    this.markers.forEach(m => {
      const ll = m.getLatLng();
      bounds = bounds.extend(ll);
    });
    if (bounds.isValid()) {
      this.map.fitBounds(bounds, { padding: [50, 50] });
    }
  }

  // Clear current route polyline if exists
  clearRoutePolyline(): void {
    if (this.map && this.routeLayer) {
      this.map.removeLayer(this.routeLayer);
      this.routeLayer = null;
    }
  }

  private createEmojiIcon(type: string, highlighted: boolean): L.Icon {
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
    const color = highlighted ? '#e74c3c' : (colorMap[type] || '#667eea');

    // Create canvas icon
    const canvas = document.createElement('canvas');
    canvas.width = highlighted ? 48 : 40;
    canvas.height = highlighted ? 48 : 40;
    const ctx = canvas.getContext('2d');

    if (ctx) {
      // White background
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      const c = canvas.width / 2;
      const r = highlighted ? 22 : 18;
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.fill();

      // Colored border
      ctx.strokeStyle = color;
      ctx.lineWidth = highlighted ? 3 : 2;
      ctx.beginPath();
      ctx.arc(c, c, r, 0, Math.PI * 2);
      ctx.stroke();

      // Emoji
      ctx.font = (highlighted ? '28px' : '24px') + ' Arial';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(emoji, c, c);
    }

    return new L.Icon({
      iconUrl: canvas.toDataURL(),
      iconSize: [canvas.width, canvas.height],
      iconAnchor: [canvas.width/2, canvas.height],
      popupAnchor: [0, -canvas.height]
    });
  }

  private createSimplePopup(place: Place): string {
    const stars = '★'.repeat(Math.round(place.rating)) + '☆'.repeat(5 - Math.round(place.rating));
    
    return `
      <div class="simple-place-popup" style="
        font-family: 'Segoe UI', Arial;
        min-width: 280px;
        padding: 0;
        margin: 0;
      ">
        <div style="padding: 16px;">
          <h4 style="
            margin: 0 0 10px 0;
            color: #2c3e50;
            font-size: 16px;
            font-weight: 700;
            line-height: 1.3;
          ">${place.name}</h4>
          
          <p style="
            margin: 0 0 8px 0;
            color: #666;
            font-size: 13px;
            line-height: 1.4;
          ">📍 ${place.address}</p>
          
          <div style="
            margin: 0 0 12px 0;
            display: flex;
            align-items: center;
            gap: 8px;
            font-size: 13px;
          ">
            <span style="color: #ffc107; font-weight: 600;">${stars}</span>
            <span style="color: #666;">(${place.reviews || 0} avis)</span>
          </div>
          
          <button onclick="window.detailsPlaceId='${place.placeId}'; window.dispatchEvent(new Event('showPlaceDetails'));" style="
            width: 100%;
            padding: 10px 16px;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            color: white;
            border: none;
            border-radius: 6px;
            cursor: pointer;
            font-weight: 600;
            font-size: 13px;
            transition: all 0.2s;
          ">
            Voir les détails
          </button>
        </div>
      </div>
    `;
  }

  private createPopupContent(place: Place): string {
    const photoUrl = place.photos && place.photos.length > 0
      ? place.photos[0]
      : 'https://via.placeholder.com/300x200?text=No+Image';

    return `
      <div class="place-popup" style="
        width: 320px;
        font-family: 'Segoe UI', Arial;
        margin: 0;
        padding: 0;
        background: white;
        border-radius: 12px;
        overflow: hidden;
        text-align: center;
      ">
        <!-- Image Container with Sharp Quality -->
        <div style="
          position: relative;
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          width: 100%;
          height: 200px;
          overflow: hidden;
        ">
          <img 
            src="${photoUrl}" 
            alt="${place.name}" 
            style="
              width: 100%;
              height: 100%;
              object-fit: cover;
              object-position: center;
              display: block;
              filter: brightness(1);
              image-rendering: crisp-edges;
              -webkit-font-smoothing: antialiased;
            " 
            loading="lazy"
          />
          <!-- Overlay if image loads -->
          <div style="
            position: absolute;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: linear-gradient(to bottom, transparent 70%, rgba(0,0,0,0.15));
            pointer-events: none;
          "></div>
          <!-- Type Badge -->
          <div style="
            position: absolute;
            top: 12px;
            right: 12px;
            background: rgba(0, 0, 0, 0.7);
            color: white;
            padding: 8px 14px;
            border-radius: 20px;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          ">${place.type}</div>
        </div>
        
        <!-- Content Container - CENTERED -->
        <div style="
          padding: 20px;
          text-align: center;
        ">
          <!-- Place Name -->
          <h3 style="
            margin: 0 0 12px 0;
            color: #2c3e50;
            font-size: 17px;
            font-weight: 700;
            line-height: 1.3;
            word-break: break-word;
          ">${place.name}</h3>
          
          <!-- Address -->
          <p style="
            margin: 0 0 14px 0;
            color: #666;
            font-size: 12px;
            line-height: 1.6;
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 6px;
          ">
            📍 ${place.address}
          </p>
          
          <!-- Rating Section -->
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            margin-bottom: 16px;
            flex-wrap: wrap;
          ">
            <span style="
              color: #ffc107;
              font-size: 14px;
              letter-spacing: 2px;
              font-weight: 600;
            ">${this.getStars(place.rating)}</span>
            <span style="
              color: #2c3e50;
              font-weight: 600;
              font-size: 13px;
            ">${place.rating.toFixed(1)}</span>
            <span style="
              color: #999;
              font-size: 12px;
            ">(${place.reviews.toLocaleString()} avis)</span>
          </div>
          
          <!-- Action Buttons -->
          <div style="
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 10px;
            margin-top: 16px;
            padding-top: 16px;
            border-top: 1px solid #f0f0f0;
          ">
            <button style="
              padding: 10px 12px;
              background: linear-gradient(135deg, #667eea, #764ba2);
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
            ">Itinéraire</button>
            <button style="
              padding: 10px 12px;
              background: linear-gradient(135deg, #f093fb, #f5576c);
              color: white;
              border: none;
              border-radius: 6px;
              font-size: 12px;
              font-weight: 600;
              cursor: pointer;
              transition: all 0.2s;
            ">Favoris ♥</button>
          </div>
        </div>
      </div>
    `;

  }

  private getStars(rating: number): string {
    return '★'.repeat(Math.round(rating)) + '☆'.repeat(5 - Math.round(rating));
  }
}
