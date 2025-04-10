/**
 * 节点分片策略单元测试
 */

import { NodeChunkingStrategy } from '~/services/chunker/strategies/node-strategy.js';
import { ChunkingContext } from '~/services/chunker/chunking-context.js';
import { ChunkType } from '~/services/storage/models/chunk.js';
import { sampleNode } from '../../../../fixtures/figma-files/sample-node.js';

describe('NodeChunkingStrategy', () => {
  let strategy: NodeChunkingStrategy;
  let context: ChunkingContext;
  
  beforeEach(() => {
    strategy = new NodeChunkingStrategy();
    context = {
      fileKey: 'test-file',
      maxSize: 1024 * 10, // 10KB, 足够大以允许控制分片
      path: [],
      depth: 0,
      idMap: new Map()
    };
  });
  
  // 测试策略类型
  describe('getType', () => {
    it('应返回节点分片类型', () => {
      expect(strategy.getType()).toBe(ChunkType.NODE);
    });
  });
  
  // 测试分片判断
  describe('shouldChunk', () => {
    it('当节点小于最大大小时应返回false', () => {
      const smallNode = { 
        id: 'small-node', 
        name: 'Small Node', 
        type: 'RECTANGLE' 
      };
      
      expect(strategy.shouldChunk(smallNode, context)).toBe(false);
    });
    
    it('当节点大于最大大小时应返回true', () => {
      // 创建一个大型节点
      const largeNode = {
        ...sampleNode,
        // 添加大量数据使其超过大小限制
        extraData: Array(1000).fill('padding data')
      };
      
      // 设置一个较小的最大大小
      const smallContext = { ...context, maxSize: 100 };
      
      expect(strategy.shouldChunk(largeNode, smallContext)).toBe(true);
    });
    
    it('当节点是页面类型时应返回true', () => {
      const pageNode = {
        id: 'page-node',
        name: '页面节点',
        type: 'PAGE'
      };
      
      expect(strategy.shouldChunk(pageNode, context)).toBe(true);
    });
    
    it('当节点有许多子节点时应返回true', () => {
      const nodeWithManyChildren = {
        id: 'parent-node',
        name: '父节点',
        type: 'FRAME',
        children: Array(11).fill(0).map((_, i) => ({
          id: `child-${i}`,
          name: `子节点 ${i}`,
          type: 'RECTANGLE'
        }))
      };
      
      expect(strategy.shouldChunk(nodeWithManyChildren, context)).toBe(true);
    });
  });
  
  // 测试分片处理
  describe('chunk', () => {
    it('当节点小于最大大小时应创建单个分片', async () => {
      const smallNode = { 
        id: 'small-node', 
        name: 'Small Node', 
        type: 'RECTANGLE' 
      };
      
      const result = await strategy.chunk(smallNode, context);
      
      expect(result.chunks.length).toBe(1);
      expect(result.primaryChunkId).toBe(result.chunks[0].id);
      expect(result.references.length).toBe(0);
      expect(result.chunks[0].data).toEqual(smallNode);
    });
    
    it('当节点需要分片时应正确处理子节点', async () => {
      // 设置一个较小的最大大小以确保分片
      const smallContext = { ...context, maxSize: 500 };
      
      const result = await strategy.chunk(sampleNode, smallContext);
      
      // 应创建多个分片（主节点分片和子节点分片）
      expect(result.chunks.length).toBeGreaterThan(1);
      
      // 验证主分片
      const mainChunk = result.chunks.find(chunk => chunk.id === result.primaryChunkId);
      expect(mainChunk).toBeDefined();
      
      if (mainChunk) {
        // 验证主要节点属性保留
        expect(mainChunk.data.id).toBe(sampleNode.id);
        expect(mainChunk.data.name).toBe(sampleNode.name);
        expect(mainChunk.data.type).toBe(sampleNode.type);
        
        // 验证子节点引用
        expect(mainChunk.data.children).toBeDefined();
        expect(Array.isArray(mainChunk.data.children)).toBe(true);
        
        // 验证引用关系
        expect(mainChunk.links.length).toBeGreaterThan(0);
        expect(result.references.length).toBeGreaterThan(0);
      }
    });
    
    it('应在ID映射中记录节点映射', async () => {
      await strategy.chunk(sampleNode, context);
      
      // 验证ID映射中包含节点ID
      expect(context.idMap.has(sampleNode.id)).toBe(true);
      
      // 获取对应的分片ID
      const chunkId = context.idMap.get(sampleNode.id);
      expect(chunkId).toBeDefined();
      expect(typeof chunkId).toBe('string');
    });
    
    it('应处理深度递归限制', async () => {
      // 创建一个递归层次很深的节点结构
      let deepNode = { id: 'deep-1', name: 'Deep Node 1', type: 'FRAME' };
      const maxDepth = 100; // 与策略中的MAX_DEPTH相同
      
      // 设置达到最大深度的上下文
      const deepContext = { ...context, depth: maxDepth + 1 };
      
      // 应抛出错误
      await expect(strategy.chunk(deepNode, deepContext)).rejects.toThrow(/Maximum chunking depth exceeded/);
    });
  });
}); 