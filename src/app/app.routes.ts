import { Routes } from '@angular/router';
import { Home } from './home/home';
import { CharacterEditor } from './character/character-editor';
import { ArenaSelect } from './arena/arena-select';
import { FightPage } from './fight/fight-page';
import { SingleplayerPage } from './singleplayer/singleplayer-page';
import { OnlinePage } from './online/online-page';
import { SelectPage } from './select/select-page';

export const routes: Routes = [
  { path: '', component: Home, title: 'SouthBeat' },
  { path: 'editor', component: CharacterEditor, title: 'SouthBeat · Charakter-Editor' },
  { path: 'select', component: SelectPage, title: 'SouthBeat · Kämpferauswahl' },
  { path: 'arena', component: ArenaSelect, title: 'SouthBeat · Arena' },
  { path: 'fight', component: FightPage, title: 'SouthBeat · Kampf' },
  { path: 'singleplayer', component: SingleplayerPage, title: 'SouthBeat · Einzelspieler' },
  { path: 'online', component: OnlinePage, title: 'SouthBeat · Online-Kampf' },
  { path: '**', redirectTo: '' },
];
