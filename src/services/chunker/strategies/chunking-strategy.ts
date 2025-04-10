/**
 * 分片策略接口文件
 * 定义不同类型数据分片策略的统一接口
 */

import { ChunkType } from '../../storage/models/chunk.js';
import { ChunkingContext } from '../chunking-context.js';
import { ChunkResult } from '../../../models/chunker/chunk-result.js';

/**
 * 分片策略接口
 * 所有具体分片策略类必须实现此接口
 */
export interface ChunkingStrategy {
  /**
   * 对数据进行分片
   * @param data 要分片的数据
   * @param context 分片上下文
   * @returns 分片结果，包含生成的分片列表和引用关系
   */
  chunk(data: any, context: ChunkingContext): Promise<ChunkResult>;
  
  /**
   * 判断数据是否需要进一步分片
   * @param data 要检查的数据
   * @param context 分片上下文
   * @returns 如果需要分片返回true，否则返回false
   */
  shouldChunk(data: any, context: ChunkingContext): boolean;
  
  /**
   * 获取策略类型
   * @returns 策略适用的分片类型
   */
  getType(): ChunkType;
} 