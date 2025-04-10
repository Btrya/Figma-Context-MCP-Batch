/**
 * ChunkIdGenerator 单元测试
 */

import { ChunkIdGenerator } from '~/services/chunker/chunk-id-generator.js';
import { ChunkType } from '~/services/storage/models/chunk.js';
import { jest } from '@jest/globals';

describe('ChunkIdGenerator', () => {
  // 测试ID格式
  describe('generateId', () => {
    it('应使用提供的fileKey、type和identifier生成ID', () => {
      const fileKey = 'test-file';
      const type = ChunkType.METADATA;
      const identifier = 'test-id';
      
      const id = ChunkIdGenerator.generateId(fileKey, type, identifier);
      
      expect(id).toBe('test-file:metadata:test-id');
    });
    
    it('当未提供identifier时，应生成随机标识符', () => {
      // 模拟随机生成函数
      // @ts-ignore 私有方法测试
      const originalGenerateRandomIdentifier = ChunkIdGenerator.generateRandomIdentifier;
      // @ts-ignore 私有方法测试
      ChunkIdGenerator.generateRandomIdentifier = jest.fn().mockReturnValue('random123');
      
      const fileKey = 'test-file';
      const type = ChunkType.NODE;
      
      const id = ChunkIdGenerator.generateId(fileKey, type);
      
      expect(id).toBe('test-file:node:random123');
      
      // 恢复原始函数
      // @ts-ignore 私有方法测试
      ChunkIdGenerator.generateRandomIdentifier = originalGenerateRandomIdentifier;
    });
  });
  
  // 测试ID解析
  describe('parseId', () => {
    it('应正确解析有效的ID', () => {
      const id = 'test-file:metadata:test-id';
      
      const result = ChunkIdGenerator.parseId(id);
      
      expect(result).toEqual({
        fileKey: 'test-file',
        type: ChunkType.METADATA,
        identifier: 'test-id'
      });
    });
    
    it('当ID不包含identifier时应正确解析', () => {
      const id = 'test-file:node:identifier';
      
      const result = ChunkIdGenerator.parseId(id);
      
      expect(result).toEqual({
        fileKey: 'test-file',
        type: ChunkType.NODE,
        identifier: 'identifier'
      });
    });
    
    it('当ID格式无效时应抛出错误', () => {
      const invalidId = 'invalid-id';
      
      expect(() => ChunkIdGenerator.parseId(invalidId)).toThrow('Invalid chunk ID format');
    });
    
    it('当ID包含无效类型时应抛出错误', () => {
      const idWithInvalidType = 'test-file:invalid-type:test-id';
      
      expect(() => ChunkIdGenerator.parseId(idWithInvalidType)).toThrow('Invalid chunk type in ID');
    });
  });
  
  // 测试ID验证
  describe('validateId', () => {
    it('对有效ID应返回true', () => {
      const validId = 'test-file:metadata:test-id';
      
      expect(ChunkIdGenerator.validateId(validId)).toBe(true);
    });
    
    it('对无效ID应返回false', () => {
      const invalidId = 'invalid-id';
      
      expect(ChunkIdGenerator.validateId(invalidId)).toBe(false);
    });
    
    it('对包含无效类型的ID应返回false', () => {
      const idWithInvalidType = 'test-file:invalid-type:test-id';
      
      expect(ChunkIdGenerator.validateId(idWithInvalidType)).toBe(false);
    });
  });
}); 