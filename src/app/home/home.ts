import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <main class="title-screen">
      <h1>SouthBeat</h1>
      <p>Programmierer prügeln sich durchs Büro.</p>
      <a routerLink="/singleplayer">Einzelspieler</a>
      <a routerLink="/editor">Charakter erstellen</a>
      <a routerLink="/stages">Stage-Modus (Koop)</a>
      <a routerLink="/select">Freier Kampf</a>
      <a routerLink="/online">Online-Kampf</a>
      <a routerLink="/controls">Steuerung</a>
    </main>
  `,
  styles: `
    .title-screen {
      display: grid;
      place-content: center;
      gap: 8px;
      min-height: 100vh;
      text-align: center;
    }
    a { color: #f1c40f; font-size: 1.25rem; }
  `,
})
export class Home {}
