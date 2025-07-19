import { ComponentFixture, TestBed } from '@angular/core/testing';

import { TransitionMatrixDisplay } from './transition-matrix-display';

describe('TransitionMatrixDisplay', () => {
  let component: TransitionMatrixDisplay;
  let fixture: ComponentFixture<TransitionMatrixDisplay>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TransitionMatrixDisplay]
    })
    .compileComponents();

    fixture = TestBed.createComponent(TransitionMatrixDisplay);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
