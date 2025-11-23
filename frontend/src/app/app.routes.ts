import { Routes } from '@angular/router';
import { GoogleMaps } from './components/google-maps/google-maps';
import { MainLayout } from './pages/main-layout/main-layout';

import { PlansFeedComponent } from './components/plans-feed/plans-feed';
import { UserProfileComponent } from './components/user-profile/user-profile';
import { LoginComponent } from './components/login/login';

export const routes: Routes = [
  { path: 'map', component: GoogleMaps },
  { path: 'trip', component: MainLayout },
  {
    path: '',
    component: PlansFeedComponent,
  },
  {
    path: 'login',
    component: LoginComponent,
  },
  {
    path: 'profile',
    component: UserProfileComponent,
  },
  {
    path: 'profile/:userId',
    component: UserProfileComponent,
  }
];
