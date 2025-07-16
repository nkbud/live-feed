import { Routes } from '@angular/router';
import { GameSelection } from './components/game-selection/game-selection';
import { LiveGame } from './components/live-game/live-game';
import { ModelPlayersComponent } from './model-players/model-players';
import { GameProbabilityPageComponent } from './game-probability-page/game-probability-page';

export const routes: Routes = [
  { path: '', component: GameSelection },
  { path: 'game/:gamePk', component: LiveGame },
  { path: 'model-players/:gamePk/:season', component: ModelPlayersComponent },
  { path: 'game-probability/:playerId/:season', component: GameProbabilityPageComponent },
];
