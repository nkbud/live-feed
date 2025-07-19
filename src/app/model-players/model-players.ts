import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MlbDataService, PitchEvent, PlayerDetails } from '../services/mlb-data.service';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { firstValueFrom, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';

interface PlayerDisplayData {
  id: number;
  fullName: string;
  isPitcher: boolean;
  events: PitchEvent[];
  collapsed: boolean;
}

@Component({
  selector: 'app-model-players',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './model-players.html',
  styleUrls: ['./model-players.css']
})
export class ModelPlayersComponent implements OnInit {
  gamePk: number | undefined;
  season: number | undefined;
  awayPlayers: PlayerDisplayData[] = [];
  homePlayers: PlayerDisplayData[] = [];
  loading: boolean = true;

  constructor(
    private route: ActivatedRoute,
    private mlbDataService: MlbDataService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.route.paramMap.subscribe(async params => {
      this.gamePk = parseInt(params.get('gamePk') || '', 10);
      this.season = parseInt(params.get('season') || '', 10);

      if (this.gamePk && this.season) {
        this.loading = true;
        try {
          const analysisResult = await firstValueFrom(this.mlbDataService.analyzeGameAndSeason(this.gamePk, this.season));

          if (analysisResult.size === 0) {
            console.warn(`No player data found for game ${this.gamePk} and season ${this.season}.`);
            this.loading = false;
            return; // Exit if no data
          }

          const allPlayerIds = Array.from(analysisResult.keys());

          const boxscore = await firstValueFrom(this.mlbDataService.getBoxscore(this.gamePk));

          const playerDetailsObservables = allPlayerIds.map(id =>
            this.mlbDataService.getPlayerDetails(id).pipe(
              map((details: PlayerDetails) => ({ id, details }))
            )
          );

          const playerDetails = await firstValueFrom(forkJoin(playerDetailsObservables));
          const playerDetailsMap = new Map<number, any>();
          playerDetails.forEach((p: { id: number; details: PlayerDetails }) => playerDetailsMap.set(p.id, p.details.people[0]));

          const homePitchers: number[] = boxscore.teams.home?.pitchers || [];
          const awayPitchers: number[] = boxscore.teams.away?.pitchers || [];
          const homeBatters: number[] = boxscore.teams.home?.batters || [];
          const awayBatters: number[] = boxscore.teams.away?.batters || [];

          const processPlayers = (playerIds: number[], isPitcher: boolean, teamPlayers: PlayerDisplayData[]) => {
            playerIds.forEach(id => {
              const events = this.mlbDataService.getRawPitchEvents(id);
              const details = playerDetailsMap.get(id);
              if (events && details) {
                teamPlayers.push({
                  id: id,
                  fullName: details.fullName,
                  isPitcher: isPitcher,
                  events: events,
                  collapsed: true // Collapsed by default
                });
              }
            });
          };

          // Process Away Team
          processPlayers(awayPitchers, true, this.awayPlayers);
          processPlayers(awayBatters, false, this.awayPlayers);

          // Process Home Team
          processPlayers(homePitchers, true, this.homePlayers);
          processPlayers(homeBatters, false, this.homePlayers);

          // Sort batters by batting order if available (assuming boxscore provides it)
          // This part might need refinement based on the exact structure of boxscore.teams.home/away.batters
          // For now, assuming the order in boxscore.teams.home/away.batters is the batting order.

        } catch (error) {
          console.error('Error loading player model data:', error);
        } finally {
          this.loading = false;
        }
      }
    });
  }

  navigateToGameProbability(playerId: number): void {
    if (this.season) {
      this.router.navigate(['/game-probability', playerId, this.season]);
    }
  }

  toggleCollapse(player: PlayerDisplayData): void {
    player.collapsed = !player.collapsed;
  }
}