import { Injectable } from '@angular/core';
import { Place } from '../models/interfaces';

export interface IMapService {
  initialize(mapElement: HTMLElement, initialLocation: { lat: number; lng: number }, zoom: number): Promise<void>;
  addMarkers(places: Place[], onMarkerClick?: (place: Place) => void): void;
  clearMarkers(): void;
  fitBounds(places: Place[]): void;
  centerOnLocation(lat: number, lng: number, zoom: number): void;
  calculateRoute(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): Promise<void>;
  isReady(): boolean;
}

@Injectable({
  providedIn: 'root'
})
export abstract class MapService implements IMapService {
  abstract initialize(mapElement: HTMLElement, initialLocation: { lat: number; lng: number }, zoom: number): Promise<void>;
  abstract addMarkers(places: Place[], onMarkerClick?: (place: Place) => void): void;
  abstract clearMarkers(): void;
  abstract fitBounds(places: Place[]): void;
  abstract centerOnLocation(lat: number, lng: number, zoom: number): void;
  abstract calculateRoute(origin: { lat: number; lng: number }, destination: { lat: number; lng: number }): Promise<void>;
  abstract isReady(): boolean;
}
