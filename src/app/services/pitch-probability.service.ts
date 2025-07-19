import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, forkJoin, from, of } from 'rxjs';
import { map, switchMap, catchError, mergeMap, toArray } from 'rxjs/operators';

// Define interfaces for MLB API responses and internal data structures
interface Count {
  balls: number;
  strikes: number;
}

interface Details {
  description: string;
  type?: {
    description: string;
  };
}

interface PlayEvent {
  count: Count;
  details: Details;
}

interface Matchup {
  pitcher?: {
    id: number;
  };
  batter?: {
    id: number;
  };
}

interface Play {
  atBatIndex: number;
  matchup: Matchup;
  playEvents: PlayEvent[];
}

interface AllPlaysResponse {
  allPlays: Play[];
}

interface TeamPlayers {
  pitchers: number[];
  batters: number[];
}

interface BoxscoreResponse {
  teams: {
    home: TeamPlayers;
    away: TeamPlayers;
  };
}

interface PlayerStatsSplit {
  game: {
    gamePk: number;
  };
}

interface PlayerStatsResponse {
  stats: {
    splits: PlayerStatsSplit[];
  }[];
}

type CountState = [number, number] | 'X';
type Transition = [CountState, CountState];

export interface PitchProbabilityMatrix {
  matrix: number[][];
  rowLabels: CountState[];
  colLabels: CountState[];
}

@Injectable({
  providedIn: 'root'
})
export class PitchProbabilityService {

  private readonly MLB_API_BASE_URL = 'https://statsapi.mlb.com/api/v1';

  private readonly BALL_EVENTS = [
    'Ball',
    'Hit By Pitch',
    'Automatic Ball - Pitcher Pitch Timer Violation',
  ];
  private readonly STRIKE_EVENTS = [
    'Called Strike', 'Swinging Strike', 'Foul', 'Foul Tip', 'Missed Bunt',
    'Swinging Pitchout', 'Foul Bunt', 'Foul Tip Bunt', 'Bunt Foul Tip',
    'Bunt Foul', 'Strike',
  ];
  private readonly INPLAY_PREFIXES = [
    'In play',
  ];

  // 1️⃣ Count-state mapping
  private readonly counts: [number, number][] = [];
  private readonly states: CountState[] = [];
  private readonly idxMap = new Map<CountState | string, number>();

  constructor(private http: HttpClient) {
    // Initialize counts, states, and idxMap
    for (let b = 0; b < 4; b++) {
      for (let s = 0; s < 3; s++) {
        if (!(b === 3 && s === 2)) { // remove invalid 3-2
          this.counts.push([b, s]);
        }
      }
    }
    this.states = [...this.counts, 'X']; // 'X' = end of plate appearance
    this.states.forEach((c, i) => {
      if (Array.isArray(c)) {
        this.idxMap.set(`${c[0]},${c[1]}`, i); // Store array as string key
      } else {
        this.idxMap.set(c, i);
      }
    });
  }

  private getCountStateKey(state: CountState): string | CountState {
    return Array.isArray(state) ? `${state[0]},${state[1]}` : state;
  }

  private getPlayByPlay(gamePk: number): Observable<AllPlaysResponse> {
    const url = `${this.MLB_API_BASE_URL}/game/${gamePk}/playByPlay`;
    return this.http.get<AllPlaysResponse>(url).pipe(
      catchError(error => {
        console.error(`Error fetching play-by-play for game ${gamePk}:`, error);
        return of({ allPlays: [] }); // Return empty data on error
      })
    );
  }

  private getBoxscore(gamePk: number): Observable<BoxscoreResponse> {
    const url = `${this.MLB_API_BASE_URL}/boxscore/${gamePk}`;
    return this.http.get<BoxscoreResponse>(url).pipe(
      catchError(error => {
        console.error(`Error fetching boxscore for game ${gamePk}:`, error);
        return of({ teams: { home: { pitchers: [], batters: [] }, away: { pitchers: [], batters: [] } } }); // Return empty data on error
      })
    );
  }

  private getPlayerGamePks(playerId: number, season: number): Observable<Set<number>> {
    const url = `${this.MLB_API_BASE_URL}/people/${playerId}/stats?stats=gameLog&season=${season}`;
    return this.http.get<PlayerStatsResponse>(url).pipe(
      map(data => {
        const gamePks = new Set<number>();
        try {
          const splits = data.stats[0]?.splits;
          if (splits) {
            for (const split of splits) {
              gamePks.add(split.game.gamePk);
            }
          }
        } catch (e) {
          console.warn(`Could not get gamePks for player ${playerId}:`, e);
        }
        return gamePks;
      }),
      catchError(error => {
        console.error(`Error fetching gamePks for player ${playerId}:`, error);
        return of(new Set<number>()); // Return empty set on error
      })
    );
  }

  private getStartingPlayers(gamePk: number): Observable<Set<number>> {
    return this.getBoxscore(gamePk).pipe(
      map(boxscore => {
        const starters = new Set<number>();
        boxscore.teams.home.pitchers.forEach(id => starters.add(id));
        boxscore.teams.away.pitchers.forEach(id => starters.add(id));
        boxscore.teams.home.batters.forEach(id => starters.add(id));
        boxscore.teams.away.batters.forEach(id => starters.add(id));
        return starters;
      })
    );
  }

  private extractPitches(gameData: AllPlaysResponse, pitcherId: number): Transition[] {
    const transitions: Transition[] = [];
    for (const play of gameData.allPlays) {
      const pm = play.matchup;
      if (pm.pitcher?.id !== pitcherId) {
        continue;
      }

      for (const ev of play.playEvents) {
        const cb = ev.count;
        const before: CountState = [cb.balls, cb.strikes];

        const details = ev.details;
        let afterState: CountState;

        const isEndPlay = details.type && ['In play', 'Batter Interference', 'Walk', 'Strikeout'].includes(details.type.description);
        const isInPlayPrefix = this.INPLAY_PREFIXES.some(prefix => details.description.startsWith(prefix));

        if (isEndPlay || isInPlayPrefix) {
          afterState = 'X';
        } else {
          // Assuming ev.count already represents the count *after* the pitch for non-end-of-PA events
          afterState = [cb.balls, cb.strikes];
        }
        transitions.push([before, afterState]);
      }
    }
    return transitions;
  }

  private buildTransitionMatrix(transitions: Transition[]): PitchProbabilityMatrix {
    const n = this.states.length;
    const mat = Array(n).fill(0).map(() => Array(n).fill(0)); // Initialize with zeros

    for (const [before, after] of transitions) {
      const i = this.idxMap.get(this.getCountStateKey(before));
      const j = this.idxMap.get(this.getCountStateKey(after));

      if (i !== undefined && j !== undefined) { // Ensure valid states
        mat[i][j]++;
      }
    }

    // Normalize rows
    const prob = mat.map(row => [...row]); // Deep copy for probabilities
    for (let i = 0; i < n; i++) {
      const rowSum = prob[i].reduce((sum, val) => sum + val, 0);
      if (rowSum > 0) {
        for (let j = 0; j < n; j++) {
          prob[i][j] /= rowSum;
        }
      }
    }

    return {
      matrix: prob,
      rowLabels: this.states,
      colLabels: this.states
    };
  }

  /**
   * Calculates pitch count transition probability matrices for all starting players
   * in a given game and their games throughout the season.
   * @param gamePk The game ID to start with.
   * @param season The season to consider for player games.
   * @returns An Observable of a Map where keys are player IDs and values are their
   *          PitchProbabilityMatrix.
   */
  calculatePlayerMatrices(gamePk: number, season: number): Observable<Map<number, PitchProbabilityMatrix>> {
    const playerPitchEvents = new Map<number, Transition[]>();
    const allGamePks = new Set<number>();

    return this.getStartingPlayers(gamePk).pipe(
      switchMap(startingPlayerIds => {
        if (startingPlayerIds.size === 0) {
          console.warn(`No starting players found for game ${gamePk}.`);
          return of(new Map<number, PitchProbabilityMatrix>());
        }

        // Initialize playerPitchEvents for all starting players
        startingPlayerIds.forEach(pid => playerPitchEvents.set(pid, []));

        // Get all gamePks for each starting player
        const playerGamePkObservables = Array.from(startingPlayerIds).map(pid =>
          this.getPlayerGamePks(pid, season).pipe(
            map(pks => ({ pid, pks }))
          )
        );

        return forkJoin(playerGamePkObservables).pipe(
          switchMap(results => {
            results.forEach(res => {
              res.pks.forEach(pk => allGamePks.add(pk));
            });

            if (allGamePks.size === 0) {
              console.warn(`No games found for starting players in season ${season}.`);
              return of(new Map<number, PitchProbabilityMatrix>());
            }

            // Fetch play-by-play data for all unique gamePks
            const gameDataObservables = Array.from(allGamePks).map(gpk =>
              this.getPlayByPlay(gpk).pipe(
                map(data => ({ gpk, data }))
              )
            );

            return forkJoin(gameDataObservables).pipe(
              map(gameResults => {
                gameResults.forEach(gameRes => {
                  const currentGamePk = gameRes.gpk;
                  const pbpData = gameRes.data;

                  // Iterate through all plays in the current game
                  for (const play of pbpData.allPlays) {
                    const pitcherId = play.matchup.pitcher?.id;
                    const batterId = play.matchup.batter?.id;

                    // Check if the pitcher is one of our tracked players
                    if (pitcherId && startingPlayerIds.has(pitcherId)) {
                      const transitions = this.extractPitches(pbpData, pitcherId);
                      playerPitchEvents.get(pitcherId)?.push(...transitions);
                    }
                    // Note: The original Python script also collected events for batters.
                    // If batter events are needed for a different type of matrix,
                    // this section would need to be expanded.
                    // For now, focusing on pitcher transition matrices as per the request.
                  }
                });

                const playerMatrices = new Map<number, PitchProbabilityMatrix>();
                playerPitchEvents.forEach((transitions, playerId) => {
                  if (transitions.length > 0) {
                    playerMatrices.set(playerId, this.buildTransitionMatrix(transitions));
                  } else {
                    console.warn(`No pitch events found for player ${playerId}.`);
                  }
                });
                return playerMatrices;
              })
            );
          })
        );
      }),
      catchError(error => {
        console.error('Error in calculatePlayerMatrices:', error);
        return of(new Map<number, PitchProbabilityMatrix>());
      })
    );
  }
}
