/**
 * 分片结果模型文件
 * 定义分片操作的结果结构
 */

import { Chunk } from '../../services/storage/models/chunk.js';

/**
 * 分片结果接口
 * 表示一次分片操作的完整结果
 */
export interface ChunkResult {
  /**
   * 生成的分片列表
   */
  chunks: Chunk[];
  
  /**
   * 主分片ID
   * 表示当前分片操作的主要结果分片
   */
  primaryChunkId: string;
  
  /**
   * 引用的其他分片ID列表
   * 用于表示分片间的引用关系
   */
  references: string[];
}

/**
 * 合并多个分片结果
 * 用于将子分片操作的结果合并到父分片操作中
 * @param results 要合并的分片结果列表
 * @returns 合并后的分片结果
 */
export function mergeChunkResults(results: ChunkResult[]): ChunkResult {
  if (results.length === 0) {
    throw new Error('Cannot merge empty results array');
  }
  
  // 使用第一个结果的主分片ID作为合并结果的主分片ID
  const primaryChunkId = results[0].primaryChunkId;
  
  // 合并所有分片和引用
  const chunks: Chunk[] = [];
  const references: Set<string> = new Set<string>();
  
  for (const result of results) {
    // 添加所有分片
    chunks.push(...result.chunks);
    
    // 添加所有引用
    result.references.forEach(ref => references.add(ref));
    
    // 如果不是第一个结果，将其主分片ID添加到引用中
    if (result.primaryChunkId !== primaryChunkId) {
      references.add(result.primaryChunkId);
    }
  }
  
  // 移除主分片ID自引用
  references.delete(primaryChunkId);
  
  return {
    chunks,
    primaryChunkId,
    references: Array.from(references)
  };
}

/**
 * 创建简单分片结果
 * 用于创建只包含一个分片的结果
 * @param chunk 分片数据
 * @param references 引用的其他分片ID
 * @returns 简单分片结果
 */
export function createSimpleChunkResult(chunk: Chunk, references: string[] = []): ChunkResult {
  return {
    chunks: [chunk],
    primaryChunkId: chunk.id,
    references
  };
} 