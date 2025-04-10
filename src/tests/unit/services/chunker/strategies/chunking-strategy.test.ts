/**
 * 分片策略接口测试
 */

import { ChunkingStrategy } from '~/services/chunker/strategies/chunking-strategy.js';
import { ChunkingContext } from '~/services/chunker/chunking-context.js';
import { ChunkType } from '~/services/storage/models/chunk.js';
import { ChunkResult } from '~/models/chunker/chunk-result.js';

// 创建一个简单的测试分片策略实现类
class TestChunkingStrategy implements ChunkingStrategy {
  constructor(private readonly strategyType: ChunkType = ChunkType.NODE) {}
  
  async chunk(data: any, context: ChunkingContext): Promise<ChunkResult> {
    return {
      chunks: [{
        id: `test-${context.fileKey}:${this.getType()}:test-id`,
        fileKey: context.fileKey,
        type: this.getType(),
        created: new Date(),
        lastAccessed: new Date(),
        data,
        links: []
      }],
      primaryChunkId: `test-${context.fileKey}:${this.getType()}:test-id`,
      references: []
    };
  }
  
  shouldChunk(data: any, context: ChunkingContext): boolean {
    // 简单实现，始终返回false
    return false;
  }
  
  getType(): ChunkType {
    return this.strategyType;
  }
}

describe('ChunkingStrategy Interface', () => {
  let strategy: ChunkingStrategy;
  let context: ChunkingContext;
  
  beforeEach(() => {
    strategy = new TestChunkingStrategy();
    context = {
      fileKey: 'test-file',
      maxSize: 1024,
      path: [],
      depth: 0,
      idMap: new Map()
    };
  });
  
  // 测试接口方法实现
  describe('Interface Implementation', () => {
    it('应正确实现chunk方法', async () => {
      const data = { test: 'data' };
      
      const result = await strategy.chunk(data, context);
      
      expect(result).toBeDefined();
      expect(result.chunks).toBeInstanceOf(Array);
      expect(result.chunks.length).toBeGreaterThan(0);
      expect(result.primaryChunkId).toBeDefined();
    });
    
    it('应正确实现shouldChunk方法', () => {
      const data = { test: 'data' };
      
      const result = strategy.shouldChunk(data, context);
      
      expect(typeof result).toBe('boolean');
    });
    
    it('应正确实现getType方法', () => {
      const result = strategy.getType();
      
      expect(Object.values(ChunkType)).toContain(result);
    });
  });
  
  // 测试不同类型的策略
  describe('Different Strategy Types', () => {
    it('应支持NODE类型', () => {
      const nodeStrategy = new TestChunkingStrategy(ChunkType.NODE);
      expect(nodeStrategy.getType()).toBe(ChunkType.NODE);
    });
    
    it('应支持METADATA类型', () => {
      const metadataStrategy = new TestChunkingStrategy(ChunkType.METADATA);
      expect(metadataStrategy.getType()).toBe(ChunkType.METADATA);
    });
    
    it('应支持GLOBAL_VARS类型', () => {
      const globalVarsStrategy = new TestChunkingStrategy(ChunkType.GLOBAL_VARS);
      expect(globalVarsStrategy.getType()).toBe(ChunkType.GLOBAL_VARS);
    });
  });
  
  // 测试上下文参数处理
  describe('Context Handling', () => {
    it('应正确使用上下文中的fileKey', async () => {
      const data = { test: 'data' };
      const customContext = { ...context, fileKey: 'custom-file' };
      
      const result = await strategy.chunk(data, customContext);
      
      expect(result.chunks[0].fileKey).toBe('custom-file');
    });
    
    it('应考虑上下文中的maxSize', () => {
      const largeData = { items: Array(1000).fill('test') };
      const smallContext = { ...context, maxSize: 10 };
      const largeContext = { ...context, maxSize: 100000 };
      
      const shouldChunkWithSmallContext = strategy.shouldChunk(largeData, smallContext);
      const shouldChunkWithLargeContext = strategy.shouldChunk(largeData, largeContext);
      
      // 当前测试实现始终返回false，但实际策略应考虑大小
      expect(shouldChunkWithSmallContext).toBe(false);
      expect(shouldChunkWithLargeContext).toBe(false);
    });
  });
}); 