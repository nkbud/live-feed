import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map, catchError } from 'rxjs/operators';

export interface PitchEvent {
  playerId: number;
  gamePk: number;
  atBatId: number;
  beforeCount: string; // e.g., "0-0", "1-2"
  pitchEvent: 'Ball' | 'Strike' | 'InPlay';
  eventDescription: string;
}

export interface EventProbabilityDistribution {
  ball: number;
  strike: number;
  in_play: number;
}

export interface EventCounts {
  ball: number;
  strike: number;
  in_play: number;
}

export interface CountEventProbabilities {
  eventCounts: Map<string, EventCounts>;
}

export interface PlayerData {
  transitionMatrix: CountEventProbabilities;
  rawPitchEvents: PitchEvent[];
}

export interface AnalyzeResponse {
  playerData: { [key: number]: PlayerData };
}

export interface PlayerDetails {
  people: {
    id: number;
    fullName: string;
  }[];
}

@Injectable({
  providedIn: 'root'
})
export class MlbDataService {
  private readonly API_BASE_URL = 'http://localhost:8000';

  // In-memory storage
  private playerTransitionMatrices = new Map<number, CountEventProbabilities>();
  private playerRawPitchEvents = new Map<number, PitchEvent[]>();

  constructor(private http: HttpClient) { }

  public getBoxscore(gamePk: number): Observable<any> {
    const url = `${this.API_BASE_URL}/boxscore/${gamePk}`;
    return this.http.get(url).pipe(
      catchError(error => {
        console.error(`Error fetching boxscore for game ${gamePk}:`, error);
        return of(null);
      })
    );
  }

  analyzeGameAndSeason(initialGamePk: number, season: number): Observable<Map<number, CountEventProbabilities>> {
    this.playerTransitionMatrices.clear();
    this.playerRawPitchEvents.clear();

    const url = `${this.API_BASE_URL}/analyze/${initialGamePk}/${season}`;
    return this.http.get<any>(url).pipe(
      map(response => {
        const playerDataMap = new Map<number, PlayerData>();
        for (const playerId in response.playerData) {
          if (response.playerData.hasOwnProperty(playerId)) {
            const data = response.playerData[playerId];
            // Convert eventProbabilities from object to Map
            data.transitionMatrix.eventCounts = new Map(Object.entries(data.transitionMatrix.eventCounts));
            playerDataMap.set(parseInt(playerId, 10), data);
            this.playerTransitionMatrices.set(parseInt(playerId, 10), data.transitionMatrix);
            this.playerRawPitchEvents.set(parseInt(playerId, 10), data.rawPitchEvents);
          }
        }
        return this.playerTransitionMatrices;
      }),
      catchError(error => {
        console.error(`Error analyzing game and season:`, error);
        return of(new Map<number, CountEventProbabilities>());
      })
    );
  }

  getTransitionMatrix(playerId: number): CountEventProbabilities | undefined {
    return this.playerTransitionMatrices.get(playerId);
  }

  getRawPitchEvents(playerId: number): PitchEvent[] | undefined {
    return this.playerRawPitchEvents.get(playerId);
  }

  getPlayerDetails(playerId: number): Observable<any> {
    const url = `${this.API_BASE_URL}/people/${playerId}`;
    return this.http.get(url).pipe(
      catchError(error => {
        console.error(`Error fetching player details for player ${playerId}:`, error);
        return of(null);
      })
    );
  }

  getPlayerTransitionMatrix(playerId: number, season: number): Observable<CountEventProbabilities> {
    const url = `${this.API_BASE_URL}/players/${playerId}/transition-matrix?season=${season}`;
    return this.http.get<any>(url).pipe(
      map(response => {
        response.eventCounts = new Map(Object.entries(response.eventCounts));
        return response;
      }),
      catchError(error => {
        console.error(`Error fetching transition matrix for player ${playerId} in season ${season}:`, error);
        return of(null as any); // Return null or handle error appropriately
      })
    );
  }

  getPredictedProbabilities(pitcherId: number, batterId: number, countStr: string, season: number): Observable<EventProbabilityDistribution> {
    const url = `${this.API_BASE_URL}/predict-probability/${pitcherId}/${batterId}/${countStr}/${season}`;
    return this.http.get<EventProbabilityDistribution>(url).pipe(
      catchError(error => {
        console.error(`Error fetching predicted probabilities for pitcher ${pitcherId}, batter ${batterId}, count ${countStr}, season ${season}:`, error);
        return of(null as any);
      })
    );
  }
}