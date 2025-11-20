import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FiltersPanel } from './filters-panel';

describe('FiltersPanel', () => {
  let component: FiltersPanel;
  let fixture: ComponentFixture<FiltersPanel>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FiltersPanel]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FiltersPanel);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
