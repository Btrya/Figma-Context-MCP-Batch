/**
 * 分片ID生成器
 * 提供分片ID的生成、解析和验证功能
 */

import { ChunkType } from '../storage/models/chunk.js';
import crypto from 'crypto';

// 分隔符，用于分隔ID的各个部分
const ID_SEPARATOR = ':';

// ID格式正则表达式 fileKey:type:identifier
const ID_REGEX = /^([^:]+):([^:]+)(?::([^:]+))?$/;

/**
 * 分片ID生成器
 * 提供静态方法用于生成、解析和验证分片ID
 */
export class ChunkIdGenerator {
  /**
   * 生成分片ID
   * 格式为：fileKey:type:identifier
   * @param fileKey Figma文件键
   * @param type 分片类型
   * @param identifier 额外标识符（可选）
   * @returns 生成的分片ID
   */
  static generateId(fileKey: string, type: ChunkType, identifier?: string): string {
    // 如果没有提供标识符，生成随机标识符
    const finalIdentifier = identifier || this.generateRandomIdentifier();
    
    // 组合ID各部分
    return [fileKey, type, finalIdentifier].join(ID_SEPARATOR);
  }
  
  /**
   * 生成随机标识符
   * 用于当未提供标识符时
   * @returns 随机标识符
   */
  private static generateRandomIdentifier(): string {
    return crypto.randomBytes(8).toString('hex');
  }
  
  /**
   * 解析分片ID
   * 将ID分解为组成部分
   * @param id 分片ID
   * @returns ID的组成部分对象
   * @throws 如果ID格式无效
   */
  static parseId(id: string): { fileKey: string; type: ChunkType; identifier?: string } {
    const match = id.match(ID_REGEX);
    
    if (!match) {
      throw new Error(`Invalid chunk ID format: ${id}`);
    }
    
    const [, fileKey, typeStr, identifier] = match;
    
    // 验证类型是否有效
    if (!Object.values(ChunkType).includes(typeStr as ChunkType)) {
      throw new Error(`Invalid chunk type in ID: ${typeStr}`);
    }
    
    return {
      fileKey,
      type: typeStr as ChunkType,
      identifier
    };
  }
  
  /**
   * 验证分片ID格式
   * @param id 要验证的分片ID
   * @returns 格式有效返回true，否则返回false
   */
  static validateId(id: string): boolean {
    try {
      this.parseId(id);
      return true;
    } catch (error) {
      return false;
    }
  }
} 