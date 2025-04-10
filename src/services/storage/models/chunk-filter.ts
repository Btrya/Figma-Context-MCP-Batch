/**
 * 分片过滤器模型文件
 * 用于过滤和查询分片数据
 */

import { ChunkType } from './chunk.js';

/**
 * 分片过滤器接口
 * 用于在查询分片时指定过滤条件
 */
export interface ChunkFilter {
  fileKey?: string;      // 按Figma文件键过滤
  type?: ChunkType;      // 按分片类型过滤
  olderThan?: Date;      // 过滤创建时间早于指定日期的分片
  newerThan?: Date;      // 过滤创建时间晚于指定日期的分片
  
  // 扩展过滤条件
  includeExpired?: boolean; // 是否包含已过期的分片，默认为false
  limit?: number;           // 返回结果的最大数量
  sortBy?: 'id' | 'fileKey' | 'type' | 'created' | 'size'; // 排序字段，仅限ChunkSummary中存在的字段
  sortDirection?: 'asc' | 'desc';               // 排序方向
}

/**
 * 创建默认的分片过滤器
 * @returns 默认过滤器配置
 */
export function createDefaultFilter(): ChunkFilter {
  return {
    includeExpired: false,
    limit: 100,
    sortBy: 'created',
    sortDirection: 'desc'
  };
}

/**
 * 合并过滤器
 * 将用户提供的过滤器与默认过滤器合并
 * 
 * @param filter 用户提供的过滤器
 * @returns 合并后的过滤器
 */
export function mergeWithDefaultFilter(filter?: ChunkFilter): ChunkFilter {
  return {
    ...createDefaultFilter(),
    ...filter
  };
} 