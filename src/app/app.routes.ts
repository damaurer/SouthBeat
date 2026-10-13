import { Routes } from '@angular/router';
import { Home } from './home/home';

// Every screen but the title is loaded when first opened, so the start page stays small.
export const routes: Routes = [
  { path: '', component: Home, title: 'SouthBeat' },
  { path: 'editor', loadComponent: () => import('./character/character-editor').then((m) => m.CharacterEditor), title: 'SouthBeat · Charakter-Editor' },
  { path: 'select', loadComponent: () => import('./select/select-page').then((m) => m.SelectPage), title: 'SouthBeat · Kämpferauswahl' },
  { path: 'arena', loadComponent: () => import('./arena/arena-select').then((m) => m.ArenaSelect), title: 'SouthBeat · Arena' },
  { path: 'fight', loadComponent: () => import('./fight/fight-page').then((m) => m.FightPage), title: 'SouthBeat · Kampf' },
  { path: 'training', loadComponent: () => import('./fight/fight-page').then((m) => m.FightPage), data: { training: true }, title: 'SouthBeat · Training' },
  { path: 'singleplayer', loadComponent: () => import('./singleplayer/singleplayer-page').then((m) => m.SingleplayerPage), title: 'SouthBeat · Einzelspieler' },
  { path: 'online', loadComponent: () => import('./online/online-page').then((m) => m.OnlinePage), title: 'SouthBeat · Online-Kampf' },
  { path: 'stages', loadComponent: () => import('./stage/stage-page').then((m) => m.StagePage), title: 'SouthBeat · Stage-Modus' },
  { path: 'controls', loadComponent: () => import('./settings/controls-page').then((m) => m.ControlsPage), title: 'SouthBeat · Steuerung' },
  { path: 'studio', loadComponent: () => import('./content/studio-page').then((m) => m.StudioPage), title: 'SouthBeat · Content-Studio' },
  { path: '**', redirectTo: '' },
];
