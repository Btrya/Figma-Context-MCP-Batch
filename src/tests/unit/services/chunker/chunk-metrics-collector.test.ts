/**
 * 分片指标收集器单元测试
 */

import { ChunkMetricsCollector } from '../../../../services/chunker/chunk-metrics-collector.js';
import { ChunkType } from '../../../../services/storage/models/chunk.js';

describe('ChunkMetricsCollector', () => {
  let collector: ChunkMetricsCollector;
  
  beforeEach(() => {
    // 每个测试前创建新的实例
    collector = new ChunkMetricsCollector();
  });
  
  describe('recordProcessingTime', () => {
    it('应记录处理时间', () => {
      collector.recordProcessingTime(ChunkType.NODE, 100);
      collector.recordProcessingTime(ChunkType.NODE, 200);
      
      const stats = collector.getStatistics();
      
      // 验证记录的时间
      expect(stats.processingTime[ChunkType.NODE]).toEqual([100, 200]);
      
      // 验证统计信息
      expect(stats.averageProcessingTime[ChunkType.NODE]).toBe(150);
    });
    
    it('对不同类型分别记录', () => {
      collector.recordProcessingTime(ChunkType.NODE, 100);
      collector.recordProcessingTime(ChunkType.METADATA, 50);
      
      const stats = collector.getStatistics();
      
      // 验证记录的时间
      expect(stats.processingTime[ChunkType.NODE]).toEqual([100]);
      expect(stats.processingTime[ChunkType.METADATA]).toEqual([50]);
      
      // 验证统计信息
      expect(stats.averageProcessingTime[ChunkType.NODE]).toBe(100);
      expect(stats.averageProcessingTime[ChunkType.METADATA]).toBe(50);
    });
  });
  
  describe('recordChunkSize', () => {
    it('应记录分片大小', () => {
      collector.recordChunkSize(ChunkType.NODE, 1024);
      collector.recordChunkSize(ChunkType.NODE, 2048);
      
      const stats = collector.getStatistics();
      
      // 验证记录的大小
      expect(stats.chunkSizes[ChunkType.NODE]).toEqual([1024, 2048]);
      
      // 验证统计信息
      expect(stats.averageChunkSize[ChunkType.NODE]).toBe(1536);
    });
    
    it('对不同类型分别记录', () => {
      collector.recordChunkSize(ChunkType.NODE, 1024);
      collector.recordChunkSize(ChunkType.METADATA, 512);
      
      const stats = collector.getStatistics();
      
      // 验证记录的大小
      expect(stats.chunkSizes[ChunkType.NODE]).toEqual([1024]);
      expect(stats.chunkSizes[ChunkType.METADATA]).toEqual([512]);
      
      // 验证统计信息
      expect(stats.averageChunkSize[ChunkType.NODE]).toBe(1024);
      expect(stats.averageChunkSize[ChunkType.METADATA]).toBe(512);
    });
  });
  
  describe('recordChunkCount', () => {
    it('应记录分片数量', () => {
      collector.recordChunkCount(ChunkType.NODE, 5);
      collector.recordChunkCount(ChunkType.NODE, 3);
      
      const stats = collector.getStatistics();
      
      // 验证记录的数量
      expect(stats.chunkCounts[ChunkType.NODE]).toBe(8);
      expect(stats.totalChunks).toBe(8);
    });
    
    it('默认增加1个分片数', () => {
      collector.recordChunkCount(ChunkType.NODE);
      collector.recordChunkCount(ChunkType.NODE);
      
      const stats = collector.getStatistics();
      
      // 验证记录的数量
      expect(stats.chunkCounts[ChunkType.NODE]).toBe(2);
    });
    
    it('对不同类型分别记录', () => {
      collector.recordChunkCount(ChunkType.NODE, 5);
      collector.recordChunkCount(ChunkType.METADATA, 3);
      
      const stats = collector.getStatistics();
      
      // 验证记录的数量
      expect(stats.chunkCounts[ChunkType.NODE]).toBe(5);
      expect(stats.chunkCounts[ChunkType.METADATA]).toBe(3);
      expect(stats.totalChunks).toBe(8);
    });
  });
  
  describe('getStatistics', () => {
    it('应返回正确的统计信息', () => {
      // 添加一些测试数据
      collector.recordProcessingTime(ChunkType.NODE, 100);
      collector.recordProcessingTime(ChunkType.NODE, 200);
      collector.recordChunkSize(ChunkType.NODE, 1024);
      collector.recordChunkSize(ChunkType.NODE, 2048);
      collector.recordChunkCount(ChunkType.NODE, 3);
      
      collector.recordProcessingTime(ChunkType.METADATA, 50);
      collector.recordChunkSize(ChunkType.METADATA, 512);
      collector.recordChunkCount(ChunkType.METADATA, 1);
      
      const stats = collector.getStatistics();
      
      // 验证统计信息包含所有类型
      expect(Object.keys(stats.processingTime)).toContain(ChunkType.NODE);
      expect(Object.keys(stats.processingTime)).toContain(ChunkType.METADATA);
      expect(Object.keys(stats.processingTime)).toContain(ChunkType.GLOBAL_VARS);
      
      // 验证计算的平均值
      expect(stats.averageProcessingTime[ChunkType.NODE]).toBe(150);
      expect(stats.averageChunkSize[ChunkType.NODE]).toBe(1536);
      
      // 验证总数量
      expect(stats.totalChunks).toBe(4);
    });
    
    it('对于无数据应返回默认值', () => {
      const stats = collector.getStatistics();
      
      // 验证默认值
      expect(stats.averageProcessingTime[ChunkType.NODE]).toBe(0);
      expect(stats.averageChunkSize[ChunkType.NODE]).toBe(0);
      expect(stats.chunkCounts[ChunkType.NODE]).toBe(0);
      expect(stats.totalChunks).toBe(0);
    });
  });
  
  describe('reset', () => {
    it('应重置所有指标', () => {
      // 添加一些测试数据
      collector.recordProcessingTime(ChunkType.NODE, 100);
      collector.recordChunkSize(ChunkType.NODE, 1024);
      collector.recordChunkCount(ChunkType.NODE, 3);
      
      // 确认数据已记录
      let stats = collector.getStatistics();
      expect(stats.processingTime[ChunkType.NODE]).toEqual([100]);
      expect(stats.chunkCounts[ChunkType.NODE]).toBe(3);
      
      // 重置
      collector.reset();
      
      // 验证数据已重置
      stats = collector.getStatistics();
      expect(stats.processingTime[ChunkType.NODE]).toEqual([]);
      expect(stats.chunkCounts[ChunkType.NODE]).toBe(0);
      expect(stats.totalChunks).toBe(0);
    });
  });
}); 