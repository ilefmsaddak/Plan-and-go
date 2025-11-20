// Color scheme for TripPlanner application
// Usage: Import and use for consistent styling across components

export const ColorScheme = {
  // Primary Colors
  primary: {
    light: '#667eea',
    dark: '#764ba2',
    gradient: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
  },

  // Semantic Colors
  success: '#27ae60',
  danger: '#e74c3c',
  warning: '#f39c12',
  info: '#3498db',

  // Grayscale
  white: '#ffffff',
  lightGray: '#f8f9fa',
  gray: '#e0e0e0',
  darkGray: '#7f8c8d',
  veryDarkGray: '#2c3e50',

  // Marker Colors by Location Type
  markers: {
    site: '#4285f4',      // Blue
    hotel: '#34a853',     // Green
    food: '#fbbc05',      // Yellow
    cafe: '#ea4335',      // Red
    drinks: '#8e44ad',    // Purple
    shop: '#f39c12',      // Orange
  },

  // Text Colors
  text: {
    primary: '#2c3e50',
    secondary: '#7f8c8d',
    light: '#95a5a6',
  },

  // Background Colors
  background: {
    main: '#ffffff',
    secondary: '#f8f9fa',
    tertiary: '#e5e3df',
  },

  // Rating Color
  rating: '#f39c12',  // Gold/Yellow

  // Shadow
  shadow: {
    subtle: '0 2px 8px rgba(0, 0, 0, 0.08)',
    medium: '0 6px 16px rgba(0, 0, 0, 0.15)',
    strong: '0 8px 24px rgba(0, 0, 0, 0.2)',
  },

  // Transitions
  transition: {
    default: '0.3s cubic-bezier(0.4, 0, 0.2, 1)',
    fast: '0.2s ease',
    slow: '0.5s ease-out',
  },
};

// Example usage in component:
// import { ColorScheme } from './config/colors';
// 
// const markerColor = ColorScheme.markers.site;  // #4285f4
// const gradient = ColorScheme.primary.gradient;  // CSS gradient string
