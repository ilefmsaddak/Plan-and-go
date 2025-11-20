import { Pipe, PipeTransform } from '@angular/core';

export interface FilterOption {
  id: string;
  label: string;
  category?: string;
  selected: boolean;
}

@Pipe({
  name: 'filterByCategory',
  standalone: true  // Add this for standalone pipes
})
export class FilterByCategoryPipe implements PipeTransform {
  transform(filters: FilterOption[], category: string): FilterOption[] {
    if (!filters || !category) {
      return filters || [];
    }
    return filters.filter(filter => filter.category === category);
  }
}
