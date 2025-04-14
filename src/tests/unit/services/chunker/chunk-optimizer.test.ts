/**
 * 分片优化器单元测试
 */

import { ChunkOptimizer, OptimizationLevel } from '../../../../services/chunker/chunk-optimizer.js';
import { Chunk, ChunkType } from '../../../../services/storage/models/chunk.js';
import { sampleNode } from '../../../fixtures/figma-files/sample-node.js';
import { sampleMetadata } from '../../../fixtures/figma-files/sample-metadata.js';

// 测试用大分片
const createLargeNodeChunk = (): Chunk => {
  return {
    id: 'test-large-node',
    fileKey: 'test-file',
    type: ChunkType.NODE,
    created: new Date(),
    lastAccessed: new Date(),
    data: sampleNode,
    links: []
  };
};

// 测试用大元数据分片
const createLargeMetadataChunk = (): Chunk => {
  return {
    id: 'test-large-metadata',
    fileKey: 'test-file',
    type: ChunkType.METADATA,
    created: new Date(),
    lastAccessed: new Date(),
    data: sampleMetadata,
    links: []
  };
};

// 创建简单分片
const createSimpleChunk = (): Chunk => {
  return {
    id: 'test-simple',
    fileKey: 'test-file',
    type: ChunkType.NODE,
    created: new Date(),
    lastAccessed: new Date(),
    data: { id: 'simple', name: 'Simple Node', type: 'RECTANGLE' },
    links: []
  };
};

describe('ChunkOptimizer', () => {
  let optimizer: ChunkOptimizer;
  
  beforeEach(() => {
    // 每个测试前创建新的实例，设置小的分片大小以便更容易测试优化
    optimizer = new ChunkOptimizer(5 * 1024); // 5KB
  });
  
  describe('optimize', () => {
    it('对小分片不做优化', () => {
      const chunk = createSimpleChunk();
      const optimized = optimizer.optimize(chunk);
      
      // 验证分片的数据内容没有变化，而不是检查引用相等
      expect(optimized).toStrictEqual(chunk);
    });
    
    it('使用低级优化仅移除不必要属性', () => {
      const chunk = createLargeNodeChunk();
      
      // 直接向数据对象添加不必要的属性
      chunk.data._internal = 'should be removed';
      chunk.data.thumbnailUrl = 'http://example.com/image.png';
      
      // 手动检查这些属性是否已添加到数据中
      expect(chunk.data._internal).toBeDefined();
      expect(chunk.data.thumbnailUrl).toBeDefined();
      
      const optimized = optimizer.optimize(chunk, OptimizationLevel.LOW);
      
      // 验证分片被优化，不必要的属性被移除
      expect(optimized).not.toStrictEqual(chunk); // 应该是内容不同的对象
      expect(optimized.data._internal).toBeUndefined();
      expect(optimized.data.thumbnailUrl).toBeUndefined();
      
      // 验证数据内容发生了变化
      expect(optimized.data !== chunk.data).toBe(true);
    });
    
    it('使用中级优化应执行压缩', () => {
      const chunk = createLargeNodeChunk();
      
      // 确保测试数据中有一些冗余属性
      chunk.data.absoluteBoundingBox = { x: 0, y: 0, width: 100, height: 100 };
      chunk.data.constraintValues = { horizontal: "LEFT", vertical: "TOP" };
      
      const originalData = JSON.parse(JSON.stringify(chunk.data));
      const originalJSON = JSON.stringify(originalData);
      
      const optimized = optimizer.optimize(chunk, OptimizationLevel.MEDIUM);
      
      // 验证返回了不同的对象
      expect(optimized).not.toStrictEqual(chunk);
      
      // 验证数据被压缩
      const compressedJSON = JSON.stringify(optimized.data);
      expect(compressedJSON.length).toBeLessThan(originalJSON.length);
      
      // 压缩后应移除冗余属性
      expect(optimized.data.absoluteBoundingBox).toBeUndefined();
      expect(optimized.data.constraintValues).toBeUndefined();
    });
  });
  
  describe('compress', () => {
    it('应根据分片类型使用不同的压缩策略', () => {
      const nodeChunk = createLargeNodeChunk();
      const metadataChunk = createLargeMetadataChunk();
      
      const compressedNode = optimizer.compress(nodeChunk);
      const compressedMetadata = optimizer.compress(metadataChunk);
      
      // 验证节点分片压缩包含必要属性
      expect(compressedNode.data.id).toBe(nodeChunk.data.id);
      expect(compressedNode.data.name).toBe(nodeChunk.data.name);
      
      // 验证元数据分片压缩包含核心信息
      expect(compressedMetadata.data.name).toBe(metadataChunk.data.name);
      expect(compressedMetadata.data.version).toBe(metadataChunk.data.version);
    });
  });
  
  describe('split', () => {
    it('应将节点分片拆分为父节点和子节点分片', () => {
      const nodeChunk = createLargeNodeChunk();
      
      // 确保数据中有子节点
      nodeChunk.data.children = [
        { id: 'child1', name: 'Child 1', type: 'RECTANGLE' },
        { id: 'child2', name: 'Child 2', type: 'TEXT' }
      ];
      
      // 设置一个非常小的最大大小以确保需要拆分
      const split = optimizer.split(nodeChunk, 100);
      
      // 验证拆分结果
      expect(split.length).toBeGreaterThan(1);
      
      // 验证父节点
      expect(split[0].id).toBe(nodeChunk.id); // 保留原ID
      expect(Array.isArray(split[0].data.children)).toBe(true);
      expect(split[0].data.children.length).toBe(0); // 子节点已移除
      expect(split[0].links.length).toBe(nodeChunk.data.children.length); // 链接到子节点
      
      // 验证子节点
      for (let i = 1; i < split.length; i++) {
        expect(split[0].links).toContain(split[i].id); // 父节点链接到子节点
      }
    });
    
    it('应将元数据分片拆分为核心分片和附加分片', () => {
      const metadataChunk = createLargeMetadataChunk();
      
      // 设置一个非常小的最大大小以确保需要拆分
      const split = optimizer.split(metadataChunk, 100);
      
      // 验证拆分结果
      expect(split.length).toBeGreaterThan(1);
      
      // 验证核心分片
      expect(split[0].id).toBe(metadataChunk.id); // 保留原ID
      expect(split[0].data.name).toBe(metadataChunk.data.name);
      expect(split[0].data.version).toBe(metadataChunk.data.version);
      
      // 验证附加分片被链接
      expect(split[0].links.length).toBeGreaterThan(0);
    });
    
    it('小分片不需要拆分', () => {
      const chunk = createSimpleChunk();
      
      const split = optimizer.split(chunk, 5 * 1024);
      
      // 验证没有拆分，但检查内容相等而非引用相等
      expect(split.length).toBe(1);
      expect(split[0]).toStrictEqual(chunk);
    });
  });
  
  describe('merge', () => {
    it('应合并多个分片为一个', () => {
      // 创建父节点和子节点分片
      const parentChunk: Chunk = {
        id: 'parent',
        fileKey: 'test-file',
        type: ChunkType.NODE,
        created: new Date(),
        lastAccessed: new Date(),
        data: { id: 'parent-id', name: 'Parent', type: 'FRAME' },
        links: ['child1', 'child2']
      };
      
      const childChunk1: Chunk = {
        id: 'child1',
        fileKey: 'test-file',
        type: ChunkType.NODE,
        created: new Date(),
        lastAccessed: new Date(),
        data: { id: 'child1-id', name: 'Child 1', type: 'RECTANGLE' },
        links: []
      };
      
      const childChunk2: Chunk = {
        id: 'child2',
        fileKey: 'test-file',
        type: ChunkType.NODE,
        created: new Date(),
        lastAccessed: new Date(),
        data: { id: 'child2-id', name: 'Child 2', type: 'TEXT' },
        links: []
      };
      
      const merged = optimizer.merge([parentChunk, childChunk1, childChunk2]);
      
      // 验证合并结果
      expect(merged.fileKey).toBe('test-file');
      expect(merged.type).toBe(ChunkType.NODE);
      
      // 验证合并的数据
      expect(merged.data.id).toBe('parent-id');
      expect(merged.data.children).toBeDefined();
      expect(merged.data.children.length).toBe(2);
      
      // 验证子节点数据被合并
      const childIds = merged.data.children.map((child: any) => child.id);
      expect(childIds).toContain('child1-id');
      expect(childIds).toContain('child2-id');
    });
    
    it('空数组应抛出错误', () => {
      expect(() => optimizer.merge([])).toThrow();
    });
    
    it('单个分片直接返回', () => {
      const chunk = createSimpleChunk();
      
      const merged = optimizer.merge([chunk]);
      
      // 验证返回的是内容相同的对象，而不是原始引用
      expect(merged).toStrictEqual(chunk);
    });
  });
}); 