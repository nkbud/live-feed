import { Component, OnInit } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-game-selection',
  imports: [CommonModule],
  templateUrl: './game-selection.html',
  styleUrls: ['./game-selection.css']
})
export class GameSelection implements OnInit {
  games: any[] = [];
  loading: boolean = true; // Add loading state
  private readonly CORS_PROXY_URL = 'https://api.allorigins.win/get?url=';
  private readonly MLB_STATS_API_SCHEDULE_URL = 'https://statsapi.mlb.com/api/v1/schedule/games/?sportId=1';

  constructor(private http: HttpClient, private router: Router) { }

  ngOnInit(): void {
    this.fetchGames();
  }

  async fetchGames(): Promise<void> {
    this.loading = true; // Set loading to true before fetch
    const url = `${this.CORS_PROXY_URL}${encodeURIComponent(this.MLB_STATS_API_SCHEDULE_URL)}`;
    try {
      const response: any = await firstValueFrom(this.http.get(url));
      const data = JSON.parse(response.contents);
      this.games = data.dates[0].games;
    } catch (error) {
      console.error('Error fetching games:', error);
    } finally {
      this.loading = false; // Set loading to false after fetch (success or error)
    }
  }

  selectGame(gamePk: string): void {
    this.router.navigate(['/game', gamePk]);
  }
}
