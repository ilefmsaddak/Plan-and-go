import { Routes } from '@angular/router';
import {GoogleMaps} from './components/google-maps/google-maps';
import {MainLayout} from './pages/main-layout/main-layout';

export const routes: Routes = [
  { path: 'map', component: GoogleMaps },
  { path: '', component: MainLayout },
];
