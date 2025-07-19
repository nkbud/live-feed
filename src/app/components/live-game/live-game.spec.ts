import { ComponentFixture, TestBed } from '@angular/core/testing';

import { LiveGame } from './live-game';

describe('LiveGame', () => {
  let component: LiveGame;
  let fixture: ComponentFixture<LiveGame>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LiveGame]
    })
    .compileComponents();

    fixture = TestBed.createComponent(LiveGame);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
