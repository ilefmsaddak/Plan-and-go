import { ComponentFixture, TestBed } from '@angular/core/testing';

import { GoogleMaps } from './google-maps';

describe('GoogleMaps', () => {
  let component: GoogleMaps;
  let fixture: ComponentFixture<GoogleMaps>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [GoogleMaps]
    })
    .compileComponents();

    fixture = TestBed.createComponent(GoogleMaps);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
