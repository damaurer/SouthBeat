import { Routes } from '@angular/router';
import { Home } from './home/home';
import { CharacterEditor } from './character/character-editor';
import { ArenaSelect } from './arena/arena-select';

export const routes: Routes = [
  { path: '', component: Home, title: 'SouthBeat' },
  { path: 'editor', component: CharacterEditor, title: 'SouthBeat · Charakter-Editor' },
  { path: 'arena', component: ArenaSelect, title: 'SouthBeat · Arena' },
  { path: '**', redirectTo: '' },
];
