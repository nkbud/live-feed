import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { MlbDataService, EventProbabilityDistribution, PlayerDetails } from '../../services/mlb-data.service';
import { CommonModule } from '@angular/common';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { firstValueFrom, forkJoin } from 'rxjs';
import { map } from 'rxjs/operators';

@Component({
  selector: 'app-live-game',
  imports: [CommonModule, FormsModule, ReactiveFormsModule],
  templateUrl: './live-game.html',
  styleUrls: ['./live-game.css']
})
export class LiveGame implements OnInit {
  gamePk: string | null = null;
  season: number = 2025; // Assuming a default season
  loading: boolean = true;

  pitchers: { id: number; fullName: string }[] = [];
  batters: { id: number; fullName: string }[] = [];
  counts: string[] = [
    "0-0", "0-1", "0-2",
    "1-0", "1-1", "1-2",
    "2-0", "2-1", "2-2",
    "3-0", "3-1", "3-2"
  ];

  selectedPitcherId: number | undefined;
  selectedBatterId: number | undefined;
  selectedCount: string | undefined;

  predictedProbabilities: EventProbabilityDistribution | undefined;

  constructor(
    private route: ActivatedRoute,
    private mlbDataService: MlbDataService,
    private router: Router
  ) { }

  ngOnInit(): void {
    this.gamePk = this.route.snapshot.paramMap.get('gamePk');
    if (this.gamePk) {
      this.loadGameData();
    }
  }

  async loadGameData(): Promise<void> {
    this.loading = true;
    try {
      const boxscore = await firstValueFrom(this.mlbDataService.getBoxscore(parseInt(this.gamePk!, 10)));

      const pitcherIds: number[] = [];
      const batterIds: number[] = [];

      if (boxscore.teams.home?.pitchers) {
        pitcherIds.push(...boxscore.teams.home.pitchers);
      }
      if (boxscore.teams.away?.pitchers) {
        pitcherIds.push(...boxscore.teams.away.pitchers);
      }
      if (boxscore.teams.home?.batters) {
        batterIds.push(...boxscore.teams.home.batters);
      }
      if (boxscore.teams.away?.batters) {
        batterIds.push(...boxscore.teams.away.batters);
      }

      const allPlayerIds = Array.from(new Set([...pitcherIds, ...batterIds]));

      const playerDetailsObservables = allPlayerIds.map(id =>
        this.mlbDataService.getPlayerDetails(id).pipe(
          map(details => details.people[0])
        )
      );

      const playerDetails = await firstValueFrom(forkJoin(playerDetailsObservables));
      const playerDetailsMap = new Map<number, PlayerDetails['people'][0]>();
      playerDetails.forEach((p: PlayerDetails['people'][0]) => playerDetailsMap.set(p.id, p));

      this.pitchers = pitcherIds.map(id => ({ id, fullName: playerDetailsMap.get(id)?.fullName || `Player ${id}` }));
      this.batters = batterIds.map(id => ({ id, fullName: playerDetailsMap.get(id)?.fullName || `Player ${id}` }));

      // Set initial selections
      if (this.pitchers.length > 0) {
        this.selectedPitcherId = this.pitchers[0].id;
      }
      if (this.batters.length > 0) {
        this.selectedBatterId = this.batters[0].id;
      }
      if (this.counts.length > 0) {
        this.selectedCount = this.counts[0];
      }

    } catch (error) {
      console.error('Error loading game data:', error);
    } finally {
      this.loading = false;
    }
  }

  async predictProbabilities(): Promise<void> {
    if (this.selectedPitcherId && this.selectedBatterId && this.selectedCount && this.gamePk) {
      this.predictedProbabilities = await firstValueFrom(this.mlbDataService.getPredictedProbabilities(
        this.selectedPitcherId,
        this.selectedBatterId,
        this.selectedCount,
        this.season
      ));
    }
  }

  navigateToModelPlayers(): void {
    if (this.gamePk && this.season) {
      this.router.navigate(['/model-players', this.gamePk, this.season]);
    }
  }

  navigateToGameProbability(playerId: number): void {
    if (this.season) {
      this.router.navigate(['/game-probability', playerId, this.season]);
    }
  }
}