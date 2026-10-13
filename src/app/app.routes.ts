import { Routes } from '@angular/router';
import { Home } from './home/home';
import { CharacterEditor } from './character/character-editor';

export const routes: Routes = [
  { path: '', component: Home, title: 'SouthBeat' },
  { path: 'editor', component: CharacterEditor, title: 'SouthBeat · Charakter-Editor' },
  { path: '**', redirectTo: '' },
];
