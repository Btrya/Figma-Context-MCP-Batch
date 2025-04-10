/**
 * 分片过滤器单元测试
 */
import { ChunkFilter, createDefaultFilter, mergeWithDefaultFilter } from '~/services/storage/models/chunk-filter.js';
import { ChunkType } from '~/services/storage/models/chunk.js';

describe('ChunkFilter', () => {
  describe('createDefaultFilter', () => {
    it('should create a default filter with correct values', () => {
      const defaultFilter = createDefaultFilter();
      
      expect(defaultFilter).toBeDefined();
      expect(defaultFilter.includeExpired).toBe(false);
      expect(defaultFilter.limit).toBe(100);
      expect(defaultFilter.sortBy).toBe('created');
      expect(defaultFilter.sortDirection).toBe('desc');
    });
  });
  
  describe('mergeWithDefaultFilter', () => {
    it('should return default filter when input is undefined', () => {
      const mergedFilter = mergeWithDefaultFilter(undefined);
      const defaultFilter = createDefaultFilter();
      
      expect(mergedFilter).toEqual(defaultFilter);
    });
    
    it('should merge custom filter with default filter', () => {
      const customFilter: ChunkFilter = {
        fileKey: 'test-file',
        type: ChunkType.NODE,
        includeExpired: true,
        sortBy: 'size',
        sortDirection: 'asc'
      };
      
      const mergedFilter = mergeWithDefaultFilter(customFilter);
      
      expect(mergedFilter).toBeDefined();
      expect(mergedFilter.fileKey).toBe('test-file');
      expect(mergedFilter.type).toBe(ChunkType.NODE);
      expect(mergedFilter.includeExpired).toBe(true);
      expect(mergedFilter.limit).toBe(100); // From default
      expect(mergedFilter.sortBy).toBe('size');
      expect(mergedFilter.sortDirection).toBe('asc');
    });
    
    it('should override default values with custom values', () => {
      const customFilter: ChunkFilter = {
        limit: 50,
        sortBy: 'id'
      };
      
      const mergedFilter = mergeWithDefaultFilter(customFilter);
      
      expect(mergedFilter.limit).toBe(50);
      expect(mergedFilter.sortBy).toBe('id');
      expect(mergedFilter.includeExpired).toBe(false); // From default
      expect(mergedFilter.sortDirection).toBe('desc'); // From default
    });
    
    it('should handle date filters correctly', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const customFilter: ChunkFilter = {
        olderThan: now,
        newerThan: yesterday
      };
      
      const mergedFilter = mergeWithDefaultFilter(customFilter);
      
      expect(mergedFilter.olderThan).toBe(now);
      expect(mergedFilter.newerThan).toBe(yesterday);
    });
  });
}); 