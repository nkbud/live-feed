import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MlbDataService, CountEventProbabilities, PlayerDetails } from '../services/mlb-data.service';
import { CommonModule } from '@angular/common';
import { firstValueFrom } from 'rxjs';

@Component({
  selector: 'app-game-probability-page',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './game-probability-page.html',
  styleUrls: ['./game-probability-page.css']
})
export class GameProbabilityPageComponent implements OnInit {
  playerId: number | undefined;
  season: number | undefined;
  transitionMatrix: CountEventProbabilities | undefined;
  playerFullName: string = 'Loading...';
  loading: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private mlbDataService: MlbDataService
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(async params => {
      this.playerId = parseInt(params.get('playerId') || '', 10);
      this.season = parseInt(params.get('season') || '', 10);

      if (this.playerId && this.season) {
        this.loading = true;
        try {
          // Fetch player details
          const playerDetails = await firstValueFrom(this.mlbDataService.getPlayerDetails(this.playerId));
          if (playerDetails && playerDetails.people && playerDetails.people.length > 0) {
            this.playerFullName = playerDetails.people[0].fullName;
          }

          // Fetch transition matrix
          this.transitionMatrix = await firstValueFrom(this.mlbDataService.getPlayerTransitionMatrix(this.playerId, this.season));

        } catch (error) {
          console.error('Error loading transition matrix:', error);
        } finally {
          this.loading = false;
        }
      }
    });
  }

  getBallProbability(entry: any): number {
    const total = entry.value.ball + entry.value.strike + entry.value.in_play;
    return total > 0 ? entry.value.ball / total : 0;
  }

  getStrikeProbability(entry: any): number {
    const total = entry.value.ball + entry.value.strike + entry.value.in_play;
    return total > 0 ? entry.value.strike / total : 0;
  }

  getInPlayProbability(entry: any): number {
    const total = entry.value.ball + entry.value.strike + entry.value.in_play;
    return total > 0 ? entry.value.in_play / total : 0;
  }

  getProbabilityColor(probability: number): string {
    // Scale the probability to an alpha value between 0 and 1
    const alpha = probability; 
    // Return a green color with varying alpha
    return `rgba(0, 128, 0, ${alpha})`;
  }
}