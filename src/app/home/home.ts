import { Component } from '@angular/core';
import { RouterLink } from '@angular/router';

@Component({
  selector: 'app-home',
  imports: [RouterLink],
  template: `
    <main class="title-screen">
      <h1>SouthBeat</h1>
      <p>Programmierer prügeln sich durchs Büro.</p>
      <a routerLink="/editor">Charakter erstellen</a>
      <a routerLink="/arena">Arena wählen</a>
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
