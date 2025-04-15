import { describe, it, expect, beforeEach } from '@jest/globals';
import { jest } from '@jest/globals';
import { FigmaNodeExtractor } from '../../../../services/figma/figma-node-extractor.js';
import { Logger } from '../../../../utils/logger.js';

// 模拟 Logger
jest.mock('../../../../utils/logger.js', () => ({
  Logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('FigmaNodeExtractor', () => {
  let extractor: FigmaNodeExtractor;
  
  // 测试数据
  const sampleFigmaData = {
    document: {
      id: 'document',
      name: 'Test Document',
      type: 'DOCUMENT',
      children: [
        {
          id: 'page1',
          name: 'Page 1',
          type: 'CANVAS',
          children: [
            {
              id: 'frame1',
              name: 'Frame 1',
              type: 'FRAME',
              children: [
                {
                  id: 'text1',
                  name: 'Text 1',
                  type: 'TEXT',
                  characters: 'Hello World'
                },
                {
                  id: 'rect1',
                  name: 'Rectangle 1',
                  type: 'RECTANGLE',
                  fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }]
                }
              ]
            },
            {
              id: 'component1',
              name: 'Button',
              type: 'COMPONENT',
              description: 'A primary button'
            }
          ]
        }
      ]
    }
  };
  
  beforeEach(() => {
    jest.resetAllMocks();
    extractor = new FigmaNodeExtractor();
  });
  
  describe('extractNodes', () => {
    it('应该提取所有节点', () => {
      const result = extractor.extractNodes(sampleFigmaData);
      
      expect(result.nodes).toBeDefined();
      expect(result.nodes.size).toBeGreaterThan(0);
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('提取Figma节点'));
      
      // 检查节点数量
      expect(result.nodes.size).toBe(6); // document, page1, frame1, text1, rect1, component1
      
      // 检查节点ID是否都被提取
      expect(result.nodes.has('document')).toBeTruthy();
      expect(result.nodes.has('page1')).toBeTruthy();
      expect(result.nodes.has('frame1')).toBeTruthy();
      expect(result.nodes.has('text1')).toBeTruthy();
      expect(result.nodes.has('rect1')).toBeTruthy();
      expect(result.nodes.has('component1')).toBeTruthy();
    });
    
    it('应该提取节点关系', () => {
      const result = extractor.extractNodes(sampleFigmaData);
      
      // 检查节点关系是否正确
      const document = result.nodes.get('document');
      const page1 = result.nodes.get('page1');
      const frame1 = result.nodes.get('frame1');
      
      expect(document).toBeDefined();
      expect(page1).toBeDefined();
      expect(frame1).toBeDefined();
      expect(document?.children).toContain('page1');
      expect(page1?.children).toContain('frame1');
    });
    
    it('应该处理空数据', () => {
      const result = extractor.extractNodes({});
      
      expect(result.nodes.size).toBe(0);
      expect(result.rootNodeIds).toEqual([]);
    });
    
    it('应该处理没有document的数据', () => {
      const result = extractor.extractNodes({ metadata: {} });
      
      expect(result.nodes.size).toBe(0);
      expect(result.rootNodeIds).toEqual([]);
    });
  });
  
  describe('处理节点属性', () => {
    it('应该提取文本节点属性', () => {
      const result = extractor.extractNodes(sampleFigmaData);
      const textNode = result.nodes.get('text1');
      
      expect(textNode).toBeDefined();
      expect(textNode?.id).toBe('text1');
      expect(textNode?.name).toBe('Text 1');
      expect(textNode?.type).toBe('TEXT');
      expect(textNode?.characters).toBe('Hello World');
    });
    
    it('应该提取矩形节点属性', () => {
      const result = extractor.extractNodes(sampleFigmaData);
      const rectNode = result.nodes.get('rect1');
      
      expect(rectNode).toBeDefined();
      expect(rectNode?.id).toBe('rect1');
      expect(rectNode?.name).toBe('Rectangle 1');
      expect(rectNode?.type).toBe('RECTANGLE');
      expect(rectNode?.fills).toBeDefined();
    });
    
    it('应该提取组件节点属性', () => {
      const result = extractor.extractNodes(sampleFigmaData);
      const componentNode = result.nodes.get('component1');
      
      expect(componentNode).toBeDefined();
      expect(componentNode?.id).toBe('component1');
      expect(componentNode?.name).toBe('Button');
      expect(componentNode?.type).toBe('COMPONENT');
      expect(componentNode?.description).toBe('A primary button');
    });
  });
  
  describe('特定节点处理', () => {
    it('应该处理特殊的Figma节点类型', () => {
      // 创建包含特殊节点类型的数据
      const specialNodesData = {
        document: {
          id: 'doc',
          name: 'Document',
          type: 'DOCUMENT',
          children: [
            {
              id: 'vector1',
              name: 'Vector 1',
              type: 'VECTOR',
              strokeWeight: 2,
              strokes: [{ type: 'SOLID', color: { r: 0, g: 0, b: 0 } }]
            },
            {
              id: 'group1',
              name: 'Group 1',
              type: 'GROUP',
              children: [
                {
                  id: 'ellipse1',
                  name: 'Ellipse 1',
                  type: 'ELLIPSE'
                }
              ]
            }
          ]
        }
      };
      
      const result = extractor.extractNodes(specialNodesData);
      
      const vectorNode = result.nodes.get('vector1');
      const groupNode = result.nodes.get('group1');
      const ellipseNode = result.nodes.get('ellipse1');
      
      expect(vectorNode).toBeDefined();
      expect(vectorNode?.type).toBe('VECTOR');
      expect(vectorNode?.strokeWeight).toBe(2);
      
      expect(groupNode).toBeDefined();
      expect(groupNode?.type).toBe('GROUP');
      expect(groupNode?.children).toContain('ellipse1');
      
      expect(ellipseNode).toBeDefined();
      expect(ellipseNode?.type).toBe('ELLIPSE');
    });
  });
}); 