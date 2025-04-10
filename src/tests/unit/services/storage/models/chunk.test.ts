/**
 * 分片数据模型单元测试
 */
import { Chunk, ChunkType, ChunkSummary } from '~/services/storage/models/chunk.js';

describe('Chunk Models', () => {
  describe('ChunkType Enum', () => {
    it('should have the correct values', () => {
      expect(ChunkType.METADATA).toBe('metadata');
      expect(ChunkType.NODE).toBe('node');
      expect(ChunkType.GLOBAL_VARS).toBe('globalVars');
    });
  });

  describe('Chunk Interface', () => {
    it('should create a valid chunk object', () => {
      const now = new Date();
      const expires = new Date(now.getTime() + 3600000); // 1 hour from now
      
      const chunk: Chunk = {
        id: 'test-chunk-id',
        fileKey: 'test-file-key',
        type: ChunkType.METADATA,
        created: now,
        expires,
        lastAccessed: now,
        data: { key: 'value' },
        links: ['related-chunk-1', 'related-chunk-2']
      };
      
      expect(chunk).toBeDefined();
      expect(chunk.id).toBe('test-chunk-id');
      expect(chunk.fileKey).toBe('test-file-key');
      expect(chunk.type).toBe(ChunkType.METADATA);
      expect(chunk.created).toBe(now);
      expect(chunk.expires).toBe(expires);
      expect(chunk.lastAccessed).toBe(now);
      expect(chunk.data).toEqual({ key: 'value' });
      expect(chunk.links).toEqual(['related-chunk-1', 'related-chunk-2']);
    });
    
    it('should create a valid chunk without optional fields', () => {
      const now = new Date();
      
      const chunk: Chunk = {
        id: 'test-chunk-id',
        fileKey: 'test-file-key',
        type: ChunkType.NODE,
        created: now,
        lastAccessed: now,
        data: null,
        links: []
      };
      
      expect(chunk).toBeDefined();
      expect(chunk.id).toBe('test-chunk-id');
      expect(chunk.expires).toBeUndefined();
      expect(chunk.links).toEqual([]);
    });
  });

  describe('ChunkSummary Interface', () => {
    it('should create a valid chunk summary object', () => {
      const now = new Date();
      
      const summary: ChunkSummary = {
        id: 'test-chunk-id',
        fileKey: 'test-file-key',
        type: ChunkType.METADATA,
        created: now,
        size: 1024
      };
      
      expect(summary).toBeDefined();
      expect(summary.id).toBe('test-chunk-id');
      expect(summary.fileKey).toBe('test-file-key');
      expect(summary.type).toBe(ChunkType.METADATA);
      expect(summary.created).toBe(now);
      expect(summary.size).toBe(1024);
    });
  });
}); 