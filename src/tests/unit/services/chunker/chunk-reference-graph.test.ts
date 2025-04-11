/**
 * 分片引用图单元测试
 */

import { ChunkReferenceGraph } from '../../../../services/chunker/chunk-reference-graph.js';

describe('ChunkReferenceGraph', () => {
  let graph: ChunkReferenceGraph;
  
  beforeEach(() => {
    // 每个测试前创建新的引用图
    graph = new ChunkReferenceGraph();
  });
  
  describe('addNode', () => {
    it('应正确添加节点', () => {
      graph.addNode('chunk1', { testData: 'value' });
      
      // 验证引用列表
      expect(graph.getReferences('chunk1')).toEqual([]);
    });
    
    it('重复添加同一节点不应出错', () => {
      graph.addNode('chunk1');
      graph.addNode('chunk1');
      
      // 验证节点被正确添加
      expect(graph.getReferences('chunk1')).toEqual([]);
    });
  });
  
  describe('addReference', () => {
    it('应正确添加引用关系', () => {
      graph.addReference('source', 'target');
      
      // 验证引用关系
      expect(graph.getReferences('source')).toContain('target');
      expect(graph.getReferencedBy('target')).toContain('source');
    });
    
    it('应自动创建不存在的节点', () => {
      graph.addReference('source', 'target');
      
      // 验证节点被创建
      expect(graph.getReferences('source')).toHaveLength(1);
      expect(graph.getReferences('target')).toHaveLength(0);
    });
  });
  
  describe('getReferences', () => {
    it('应返回节点的所有引用', () => {
      graph.addReference('source', 'target1');
      graph.addReference('source', 'target2');
      
      // 验证引用列表
      const refs = graph.getReferences('source');
      expect(refs).toHaveLength(2);
      expect(refs).toContain('target1');
      expect(refs).toContain('target2');
    });
    
    it('不存在的节点应返回空数组', () => {
      expect(graph.getReferences('nonexistent')).toEqual([]);
    });
  });
  
  describe('getReferencedBy', () => {
    it('应返回引用该节点的所有节点', () => {
      graph.addReference('source1', 'target');
      graph.addReference('source2', 'target');
      
      // 验证被引用列表
      const refs = graph.getReferencedBy('target');
      expect(refs).toHaveLength(2);
      expect(refs).toContain('source1');
      expect(refs).toContain('source2');
    });
    
    it('不被任何节点引用时应返回空数组', () => {
      graph.addNode('lonely');
      expect(graph.getReferencedBy('lonely')).toEqual([]);
    });
  });
  
  describe('detectCircularReferences', () => {
    it('应检测简单的循环引用', () => {
      graph.addReference('A', 'B');
      graph.addReference('B', 'C');
      graph.addReference('C', 'A');
      
      // 验证检测到循环
      const cycles = graph.detectCircularReferences();
      expect(cycles.length).toBeGreaterThan(0);
      
      // 至少有一个循环包含所有三个节点
      const hasCycle = cycles.some(cycle => 
        cycle.includes('A') && cycle.includes('B') && cycle.includes('C')
      );
      
      expect(hasCycle).toBe(true);
    });
    
    it('无循环引用时应返回空数组', () => {
      graph.addReference('A', 'B');
      graph.addReference('B', 'C');
      
      // 验证没有检测到循环
      const cycles = graph.detectCircularReferences();
      expect(cycles).toHaveLength(0);
    });
  });
  
  describe('exportGraph', () => {
    it('应导出完整的引用图', () => {
      graph.addReference('A', 'B');
      graph.addReference('A', 'C');
      graph.addReference('B', 'D');
      
      // 验证导出结果
      const exported = graph.exportGraph();
      
      expect(Object.keys(exported)).toHaveLength(4); // A, B, C, D
      expect(exported['A']).toContain('B');
      expect(exported['A']).toContain('C');
      expect(exported['B']).toContain('D');
      expect(exported['C']).toEqual([]);
      expect(exported['D']).toEqual([]);
    });
    
    it('空图应导出空对象', () => {
      const exported = graph.exportGraph();
      expect(Object.keys(exported)).toHaveLength(0);
    });
  });
}); 