import {Routes} from '@angular/router';

export const routes: Routes = [
  {path: '', loadComponent: () => import('./songs/song-list/song-list.component').then(m => m.SongListComponent)},
  {path: 'song/:id', loadComponent: () => import('./songs/song-detail/song-detail.component').then(m => m.SongDetailComponent)},
  {path: 'club/:id', loadComponent: () => import('./songs/club-detail/club-detail.component').then(m => m.ClubDetailComponent)},
  {path: 'login', loadComponent: () => import('./user/login/login.component').then(m => m.LoginComponent)},
  {path: '**', redirectTo: ''}
];
