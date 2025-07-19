import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GameSelection } from './game-selection';

describe('GameSelection', () => {
  let component: GameSelection;
  let fixture: ComponentFixture<GameSelection>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GameSelection]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GameSelection);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
