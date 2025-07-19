import { ComponentFixture, TestBed } from '@angular/core/testing';

import { ModelPlayers } from './model-players';

describe('ModelPlayers', () => {
  let component: ModelPlayers;
  let fixture: ComponentFixture<ModelPlayers>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ModelPlayers]
    })
    .compileComponents();

    fixture = TestBed.createComponent(ModelPlayers);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
