/**
 * 分片指标收集器
 * 收集和分析分片处理的各项指标
 */

import { ChunkType } from '../storage/models/chunk.js';

/**
 * 分片处理统计信息接口
 */
export interface ChunkStatistics {
  // 各类型分片的处理时间记录（毫秒）
  processingTime: Record<ChunkType, number[]>;
  // 各类型分片的大小记录（字节）
  chunkSizes: Record<ChunkType, number[]>;
  // 各类型分片的数量
  chunkCounts: Record<ChunkType, number>;
  // 各类型分片的平均处理时间（毫秒）
  averageProcessingTime: Record<ChunkType, number>;
  // 各类型分片的平均大小（字节）
  averageChunkSize: Record<ChunkType, number>;
  // 分片总数
  totalChunks: number;
}

/**
 * 分片指标收集器类
 * 负责收集和分析分片处理的性能和结果指标
 */
export class ChunkMetricsCollector {
  // 存储各类型分片的处理时间
  private processingTimes: Map<ChunkType, number[]>;
  // 存储各类型分片的大小
  private chunkSizes: Map<ChunkType, number[]>;
  // 存储各类型分片的数量
  private chunkCounts: Map<ChunkType, number>;
  
  /**
   * 构造函数
   */
  constructor() {
    this.processingTimes = new Map<ChunkType, number[]>();
    this.chunkSizes = new Map<ChunkType, number[]>();
    this.chunkCounts = new Map<ChunkType, number>();
    
    // 初始化所有类型的计数器
    Object.values(ChunkType).forEach(type => {
      this.processingTimes.set(type as ChunkType, []);
      this.chunkSizes.set(type as ChunkType, []);
      this.chunkCounts.set(type as ChunkType, 0);
    });
  }
  
  /**
   * 记录分片处理时间
   * @param type 分片类型
   * @param time 处理时间（毫秒）
   */
  public recordProcessingTime(type: ChunkType, time: number): void {
    const times = this.processingTimes.get(type) || [];
    times.push(time);
    this.processingTimes.set(type, times);
  }
  
  /**
   * 记录分片大小
   * @param type 分片类型
   * @param size 分片大小（字节）
   */
  public recordChunkSize(type: ChunkType, size: number): void {
    const sizes = this.chunkSizes.get(type) || [];
    sizes.push(size);
    this.chunkSizes.set(type, sizes);
  }
  
  /**
   * 记录分片数量
   * @param type 分片类型
   * @param count 要增加的数量，默认为1
   */
  public recordChunkCount(type: ChunkType, count: number = 1): void {
    const currentCount = this.chunkCounts.get(type) || 0;
    this.chunkCounts.set(type, currentCount + count);
  }
  
  /**
   * 获取处理统计信息
   * @returns 汇总的分片处理统计信息
   */
  public getStatistics(): ChunkStatistics {
    // 准备统计数据
    const processingTime: Record<ChunkType, number[]> = {} as Record<ChunkType, number[]>;
    const chunkSizes: Record<ChunkType, number[]> = {} as Record<ChunkType, number[]>;
    const chunkCounts: Record<ChunkType, number> = {} as Record<ChunkType, number>;
    const averageProcessingTime: Record<ChunkType, number> = {} as Record<ChunkType, number>;
    const averageChunkSize: Record<ChunkType, number> = {} as Record<ChunkType, number>;
    let totalChunks = 0;
    
    // 计算各项统计数据
    Object.values(ChunkType).forEach(type => {
      const typeKey = type as ChunkType;
      
      // 获取原始数据
      const times = this.processingTimes.get(typeKey) || [];
      const sizes = this.chunkSizes.get(typeKey) || [];
      const count = this.chunkCounts.get(typeKey) || 0;
      
      // 填充记录数据
      processingTime[typeKey] = [...times];
      chunkSizes[typeKey] = [...sizes];
      chunkCounts[typeKey] = count;
      
      // 计算平均值
      averageProcessingTime[typeKey] = times.length > 0 
        ? times.reduce((sum, time) => sum + time, 0) / times.length 
        : 0;
      
      averageChunkSize[typeKey] = sizes.length > 0 
        ? sizes.reduce((sum, size) => sum + size, 0) / sizes.length 
        : 0;
      
      // 累计总分片数
      totalChunks += count;
    });
    
    // 返回统计结果
    return {
      processingTime,
      chunkSizes,
      chunkCounts,
      averageProcessingTime,
      averageChunkSize,
      totalChunks
    };
  }
  
  /**
   * 重置所有指标
   * 用于开始新的测量周期
   */
  public reset(): void {
    Object.values(ChunkType).forEach(type => {
      this.processingTimes.set(type as ChunkType, []);
      this.chunkSizes.set(type as ChunkType, []);
      this.chunkCounts.set(type as ChunkType, 0);
    });
  }
} 