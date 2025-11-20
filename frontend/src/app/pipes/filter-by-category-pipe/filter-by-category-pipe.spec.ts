import { ComponentFixture, TestBed } from '@angular/core/testing';

import { FilterByCategoryPipe } from './filter-by-category-pipe';

describe('FilterByCategoryPipe', () => {
  let component: FilterByCategoryPipe;
  let fixture: ComponentFixture<FilterByCategoryPipe>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [FilterByCategoryPipe]
    })
    .compileComponents();

    fixture = TestBed.createComponent(FilterByCategoryPipe);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
