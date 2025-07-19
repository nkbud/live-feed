import { TestBed } from '@angular/core/testing';
import { HttpClientTestingModule, HttpTestingController } from '@angular/common/http/testing';

import { PitchProbabilityService, PitchProbabilityMatrix } from './pitch-probability.service';

describe('PitchProbabilityService', () => {
  let service: PitchProbabilityService;
  let httpMock: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      imports: [HttpClientTestingModule],
      providers: [PitchProbabilityService]
    });
    service = TestBed.inject(PitchProbabilityService);
    httpMock = TestBed.inject(HttpTestingController);
  });

  afterEach(() => {
    httpMock.verify();
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });

  it('should correctly extract pitches', () => {
    const gameData = {
      allPlays: [
        {
          matchup: { pitcher: { id: 123 } },
          playEvents: [
            { count: { balls: 0, strikes: 0 }, details: { description: 'Ball' } },
            { count: { balls: 1, strikes: 0 }, details: { description: 'Called Strike' } },
            { count: { balls: 1, strikes: 1 }, details: { description: 'Foul' } },
            { count: { balls: 1, strikes: 2 }, details: { description: 'In play, out(s)', type: { description: 'In play' } } },
          ]
        },
        {
          matchup: { pitcher: { id: 456 } }, // Different pitcher
          playEvents: [
            { count: { balls: 0, strikes: 0 }, details: { description: 'Ball' } },
          ]
        }
      ]
    };
    // @ts-ignore
    const transitions = service['extractPitches'](gameData, 123);
    expect(transitions.length).toBe(4);
    expect(transitions[0]).toEqual([[0, 0], [1, 0]]);
    expect(transitions[3]).toEqual([[1, 2], 'X']);
  });

  it('should correctly build transition matrix', () => {
    const transitions = [
      [[0, 0], [1, 0]],
      [[1, 0], [1, 1]],
      [[1, 1], [1, 2]],
      [[1, 2], 'X'],
      [[0, 0], [0, 1]],
      [[0, 1], [1, 1]],
      [[1, 1], [2, 1]],
      [[2, 1], 'X'],
    ];
    // @ts-ignore
    const matrix: PitchProbabilityMatrix = service['buildTransitionMatrix'](transitions);

    expect(matrix.matrix.length).toBe(13);
    expect(matrix.matrix[0].length).toBe(13);

    // Check specific probabilities
    const idx00 = service['idxMap'].get('0,0');
    const idx10 = service['idxMap'].get('1,0');
    const idx01 = service['idxMap'].get('0,1');
    const idx11 = service['idxMap'].get('1,1');
    const idx12 = service['idxMap'].get('1,2');
    const idx21 = service['idxMap'].get('2,1');
    const idxX = service['idxMap'].get('X');

    expect(matrix.matrix[idx00!][idx10!]).toBeCloseTo(0.5);
    expect(matrix.matrix[idx00!][idx01!]).toBeCloseTo(0.5);
    expect(matrix.matrix[idx10!][idx11!]).toBeCloseTo(1.0);
    expect(matrix.matrix[idx11!][idx12!]).toBeCloseTo(0.5);
    expect(matrix.matrix[idx11!][idx21!]).toBeCloseTo(0.5);
    expect(matrix.matrix[idx12!][idxX!]).toBeCloseTo(1.0);
    expect(matrix.matrix[idx01!][idx11!]).toBeCloseTo(1.0);
    expect(matrix.matrix[idx21!][idxX!]).toBeCloseTo(1.0);
  });

  it('should calculate player matrices for a given game and season', (done) => {
    const gamePk = 777130;
    const season = 2025;
    const pitcherId = 678394;

    // Mock HTTP responses
    const mockBoxscore = {
      teams: {
        home: { pitchers: [pitcherId], batters: [] },
        away: { pitchers: [], batters: [] }
      }
    };

    const mockPlayerGamePks = {
      stats: [{
        splits: [
          { game: { gamePk: 777130 } },
          { game: { gamePk: 777144 } }
        ]
      }]
    };

    const mockPlayByPlay777130 = {
      allPlays: [
        {
          matchup: { pitcher: { id: pitcherId } },
          playEvents: [
            { count: { balls: 0, strikes: 0 }, details: { description: 'Ball' } },
            { count: { balls: 1, strikes: 0 }, details: { description: 'Called Strike' } },
          ]
        }
      ]
    };

    const mockPlayByPlay777144 = {
      allPlays: [
        {
          matchup: { pitcher: { id: pitcherId } },
          playEvents: [
            { count: { balls: 0, strikes: 0 }, details: { description: 'Called Strike' } },
            { count: { balls: 0, strikes: 1 }, details: { description: 'Ball' } },
          ]
        }
      ]
    };

    service.calculatePlayerMatrices(gamePk, season).subscribe(result => {
      expect(result.has(pitcherId)).toBeTrue();
      const matrix = result.get(pitcherId);
      expect(matrix).toBeDefined();
      expect(matrix!.matrix.length).toBe(13);
      expect(matrix!.matrix[0].length).toBe(13);

      // Verify some probabilities based on mock data
      const idx00 = service['idxMap'].get('0,0');
      const idx10 = service['idxMap'].get('1,0');
      const idx01 = service['idxMap'].get('0,1');

      // From mockPlayByPlay777130: (0,0) -> (1,0)
      // From mockPlayByPlay777144: (0,0) -> (0,1)
      // Total (0,0) transitions: 2. One to (1,0), one to (0,1)
      expect(matrix!.matrix[idx00!][idx10!]).toBeCloseTo(0.5);
      expect(matrix!.matrix[idx00!][idx01!]).toBeCloseTo(0.5);

      done();
    });

    // Expect and respond to HTTP requests
    const req1 = httpMock.expectOne(`https://statsapi.mlb.com/api/v1/game/${gamePk}/boxscore`);
    expect(req1.request.method).toBe('GET');
    req1.flush(mockBoxscore);

    const req2 = httpMock.expectOne(`https://statsapi.mlb.com/api/v1/people/${pitcherId}/stats?stats=gameLog&season=${season}`);
    expect(req2.request.method).toBe('GET');
    req2.flush(mockPlayerGamePks);

    const req3 = httpMock.expectOne(`https://statsapi.mlb.com/api/v1/game/777130/playByPlay`);
    expect(req3.request.method).toBe('GET');
    req3.flush(mockPlayByPlay777130);

    const req4 = httpMock.expectOne(`https://statsapi.mlb.com/api/v1/game/777144/playByPlay`);
    expect(req4.request.method).toBe('GET');
    req4.flush(mockPlayByPlay777144);
  });
});
