/**
 * 大小估算工具单元测试
 */

import { estimateSize, isOverSize, shouldSplitNode } from '~/utils/size-estimator.js';

describe('size-estimator', () => {
  // 测试估算大小函数
  describe('estimateSize', () => {
    it('应正确估算简单对象大小', () => {
      const obj = { name: 'test', value: 123 };
      
      const size = estimateSize(obj);
      
      // JSON.stringify(obj) = '{"name":"test","value":123}'，长度为28字节
      expect(size).toBe(27);
    });
    
    it('应正确估算包含数组的对象大小', () => {
      const obj = { items: [1, 2, 3, 4, 5] };
      
      const size = estimateSize(obj);
      
      // JSON.stringify(obj) = '{"items":[1,2,3,4,5]}'，长度为21字节
      expect(size).toBe(21);
    });
    
    it('应正确估算嵌套对象大小', () => {
      const obj = { 
        user: { 
          name: 'test', 
          profile: { 
            age: 30, 
            country: 'China' 
          } 
        } 
      };
      
      const size = estimateSize(obj);
      
      // JSON的长度应该反映对象的复杂性
      expect(size).toBeGreaterThan(50);
    });
    
    it('应处理循环引用对象', () => {
      const obj: any = { name: 'test' };
      obj.self = obj; // 创建循环引用
      
      // 不应抛出错误
      expect(() => estimateSize(obj)).not.toThrow();
      
      const size = estimateSize(obj);
      expect(size).toBeGreaterThan(0);
    });
  });
  
  // 测试大小检查函数
  describe('isOverSize', () => {
    it('当对象大小小于最大大小时应返回false', () => {
      const obj = { name: 'test' };
      const maxSize = 100; // 字节
      
      expect(isOverSize(obj, maxSize)).toBe(false);
    });
    
    it('当对象大小大于最大大小时应返回true', () => {
      // 创建一个大对象
      const largeObj = { items: Array(1000).fill('test string that takes up space') };
      const maxSize = 100; // 字节
      
      expect(isOverSize(largeObj, maxSize)).toBe(true);
    });
    
    it('当对象大小等于最大大小时应返回false', () => {
      const obj = { name: 'x'.repeat(10) }; // 创建特定大小的对象
      const size = estimateSize(obj);
      
      expect(isOverSize(obj, size)).toBe(false);
    });
  });
  
  // 测试节点分割判断函数
  describe('shouldSplitNode', () => {
    it('当节点大小超过最大大小时应返回true', () => {
      const largeNode = { items: Array(1000).fill('test') };
      const maxSize = 100;
      
      expect(shouldSplitNode(largeNode, maxSize)).toBe(true);
    });
    
    it('当节点有过多子节点时应返回true', () => {
      const nodeWithManyChildren = {
        children: Array(15).fill({ id: 'child' })
      };
      const maxSize = 10000;
      
      expect(shouldSplitNode(nodeWithManyChildren, maxSize)).toBe(true);
    });
    
    it('当节点是页面类型时应返回true', () => {
      const pageNode = { type: 'PAGE', name: 'Page 1' };
      const maxSize = 10000;
      
      expect(shouldSplitNode(pageNode, maxSize)).toBe(true);
    });
    
    it('当节点包含图片填充时应返回true', () => {
      const nodeWithImage = {
        fills: [
          { type: 'SOLID', color: { r: 1, g: 1, b: 1 } },
          { type: 'IMAGE', imageRef: 'img123' }
        ]
      };
      const maxSize = 10000;
      
      expect(shouldSplitNode(nodeWithImage, maxSize)).toBe(true);
    });
    
    it('当节点是简单节点时应返回false', () => {
      const simpleNode = {
        id: 'node1',
        name: 'Simple Node',
        type: 'RECTANGLE',
        fills: [{ type: 'SOLID', color: { r: 1, g: 1, b: 1 } }]
      };
      const maxSize = 10000;
      
      expect(shouldSplitNode(simpleNode, maxSize)).toBe(false);
    });
  });
}); 