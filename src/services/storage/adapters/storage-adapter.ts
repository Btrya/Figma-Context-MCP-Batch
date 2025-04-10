/**
 * 存储适配器接口文件
 * 定义通用存储适配器接口，所有具体存储实现必须实现此接口
 */

import { Chunk, ChunkSummary } from '../models/chunk.js';
import { ChunkFilter } from '../models/chunk-filter.js';

/**
 * 存储适配器接口
 * 抽象定义分片数据存储的基本操作
 */
export interface StorageAdapter {
  /**
   * 存储分片数据
   * @param chunk 要存储的分片数据
   * @returns Promise<void>
   */
  saveChunk(chunk: Chunk): Promise<void>;
  
  /**
   * 获取分片数据
   * @param id 分片ID
   * @returns Promise<Chunk | null> 返回分片数据，不存在时返回null
   */
  getChunk(id: string): Promise<Chunk | null>;
  
  /**
   * 检查分片是否存在
   * @param id 分片ID
   * @returns Promise<boolean> 分片存在返回true，否则返回false
   */
  hasChunk(id: string): Promise<boolean>;
  
  /**
   * 删除分片
   * @param id 分片ID
   * @returns Promise<boolean> 删除成功返回true，不存在或删除失败返回false
   */
  deleteChunk(id: string): Promise<boolean>;
  
  /**
   * 列出所有分片
   * @param filter 可选的过滤条件
   * @returns Promise<ChunkSummary[]> 返回符合条件的分片摘要列表
   */
  listChunks(filter?: ChunkFilter): Promise<ChunkSummary[]>;
  
  /**
   * 清理过期数据
   * 删除所有已过期的分片数据
   * @returns Promise<void>
   */
  cleanup(): Promise<void>;
}

/**
 * 基础存储适配器配置接口
 * 所有存储适配器配置的基础接口
 */
export interface BaseStorageAdapterConfig {
  /**
   * 是否在启动时自动清理过期数据
   */
  cleanupOnStart?: boolean;
  
  /**
   * 自动清理间隔时间（毫秒）
   * 设置为0或负数将禁用自动清理
   */
  cleanupInterval?: number;
} 