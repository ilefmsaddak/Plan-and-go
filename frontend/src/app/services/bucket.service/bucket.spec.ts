import { TestBed } from '@angular/core/testing';

import { Bucket } from './bucket';

describe('Bucket', () => {
  let service: Bucket;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(Bucket);
  });

  it('should be created', () => {
    expect(service).toBeTruthy();
  });
});
