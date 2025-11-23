import { ComponentFixture, TestBed } from '@angular/core/testing';

import { Bucket } from './bucket';

describe('Bucket', () => {
  let component: Bucket;
  let fixture: ComponentFixture<Bucket>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Bucket]
    })
    .compileComponents();

    fixture = TestBed.createComponent(Bucket);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
