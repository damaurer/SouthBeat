import { Routes } from '@angular/router';
import { Home } from './home/home';
import { CharacterEditor } from './character/character-editor';
import { ArenaSelect } from './arena/arena-select';
import { FightPage } from './fight/fight-page';

export const routes: Routes = [
  { path: '', component: Home, title: 'SouthBeat' },
  { path: 'editor', component: CharacterEditor, title: 'SouthBeat · Charakter-Editor' },
  { path: 'arena', component: ArenaSelect, title: 'SouthBeat · Arena' },
  { path: 'fight', component: FightPage, title: 'SouthBeat · Kampf' },
  { path: '**', redirectTo: '' },
];
