/**
 * 元数据分片策略单元测试
 */

import { MetadataChunkingStrategy } from '~/services/chunker/strategies/metadata-strategy.js';
import { ChunkingContext } from '~/services/chunker/chunking-context.js';
import { ChunkType } from '~/services/storage/models/chunk.js';
import { sampleMetadata } from '../../../../fixtures/figma-files/sample-metadata.js';

describe('MetadataChunkingStrategy', () => {
  let strategy: MetadataChunkingStrategy;
  let context: ChunkingContext;
  
  beforeEach(() => {
    strategy = new MetadataChunkingStrategy();
    context = {
      fileKey: 'test-file',
      maxSize: 30 * 1024,
      chunkType: ChunkType.METADATA,
      path: [],
      depth: 0,
      idMap: new Map()
    };
  });
  
  // 测试策略类型
  describe('getType', () => {
    it('应返回元数据分片类型', () => {
      expect(strategy.getType()).toBe(ChunkType.METADATA);
    });
  });
  
  // 测试分片判断
  describe('shouldChunk', () => {
    it('当数据小于最大大小时应返回false', () => {
      const smallData = { name: 'Small Metadata' };
      
      expect(strategy.shouldChunk(smallData, context)).toBe(false);
    });
    
    it('当数据大于最大大小时应返回true', () => {
      // 创建一个大型元数据对象
      const largeData = {
        ...sampleMetadata,
        // 添加大量额外数据使其超过大小限制
        extraData: Array(1000).fill('padding data to increase size')
      };
      
      // 设置一个较小的最大大小
      const smallContext = { ...context, maxSize: 100 };
      
      expect(strategy.shouldChunk(largeData, smallContext)).toBe(true);
    });
  });
  
  // 测试分片处理
  describe('chunk', () => {
    it('当数据小于最大大小时应创建单个分片', async () => {
      const smallData = { name: 'Small Metadata' };
      
      const result = await strategy.chunk(smallData, context);
      
      expect(result.chunks.length).toBe(1);
      expect(result.primaryChunkId).toBe(result.chunks[0].id);
      expect(result.references.length).toBe(0);
      expect(result.chunks[0].data).toEqual(smallData);
    });
    
    it('当数据大于最大大小时应创建多个分片', async () => {
      // 设置一个较小的最大大小
      const smallContext = { ...context, maxSize: 100 };
      
      const result = await strategy.chunk(sampleMetadata, smallContext);
      
      // 应至少创建两个分片（主分片和详细信息分片）
      expect(result.chunks.length).toBeGreaterThanOrEqual(2);
      
      // 验证主分片
      const mainChunk = result.chunks.find(chunk => chunk.id === result.primaryChunkId);
      expect(mainChunk).toBeDefined();
      
      // 验证主分片包含核心元数据
      if (mainChunk) {
        expect(mainChunk.data.name).toBe(sampleMetadata.name);
        expect(mainChunk.links.length).toBeGreaterThan(0);
      }
      
      // 验证引用关系
      expect(result.references.length).toBeGreaterThan(0);
      expect(result.references).toEqual(mainChunk?.links);
    });
    
    it('应正确提取元数据关键信息', async () => {
      // 设置一个较小的最大大小以确保分片
      const smallContext = { ...context, maxSize: 100 };
      
      const result = await strategy.chunk(sampleMetadata, smallContext);
      
      // 检查主分片是否包含关键信息
      const mainChunk = result.chunks.find(chunk => chunk.id === result.primaryChunkId);
      
      if (mainChunk) {
        // 验证主要元数据字段
        expect(mainChunk.data.name).toBe(sampleMetadata.name);
        expect(mainChunk.data.version).toBe(sampleMetadata.version);
        expect(mainChunk.data.thumbnailUrl).toBe(sampleMetadata.thumbnailUrl);
        
        // 验证页面摘要
        if (sampleMetadata.document?.children) {
          expect(mainChunk.data.pages).toBeDefined();
          expect(mainChunk.data.pages.length).toBe(sampleMetadata.document.children.length);
        }
      }
    });
  });
}); 