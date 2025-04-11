/**
 * 分片处理器主类
 * 整合所有分片策略，提供统一的分片处理入口
 */

import { ChunkType } from '../storage/models/chunk.js';
import { ChunkingStrategy } from './strategies/chunking-strategy.js';
import { MetadataChunkingStrategy } from './strategies/metadata-strategy.js';
import { NodeChunkingStrategy } from './strategies/node-strategy.js';
import { GlobalVarsChunkingStrategy } from './strategies/global-vars-strategy.js';
import { ChunkingContext, createInitialContext } from './chunking-context.js';
import { ChunkResult, mergeChunkResults } from '../../models/chunker/chunk-result.js';
import { ChunkReferenceGraph } from './chunk-reference-graph.js';
import { ChunkMetricsCollector } from './chunk-metrics-collector.js';
import { ChunkOptimizer, OptimizationLevel } from './chunk-optimizer.js';

/**
 * 分片配置
 */
export interface ChunkerConfig {
  /**
   * 最大分片大小（字节）
   * 默认为30KB
   */
  maxChunkSize?: number;
  
  /**
   * 是否启用调试模式
   * 开启后会输出分片过程的详细日志
   */
  debug?: boolean;

  /**
   * 优化级别
   * 默认为中等优化
   */
  optimizationLevel?: OptimizationLevel;

  /**
   * 是否启用性能指标收集
   * 默认为false
   */
  collectMetrics?: boolean;

  /**
   * 是否检测循环引用
   * 默认为true
   */
  detectCircularReferences?: boolean;
}

/**
 * 默认分片配置
 */
const DEFAULT_CONFIG: ChunkerConfig = {
  maxChunkSize: 30 * 1024, // 30KB
  debug: false,
  optimizationLevel: OptimizationLevel.MEDIUM,
  collectMetrics: false,
  detectCircularReferences: true
};

/**
 * 分片处理器
 * 负责根据数据类型选择合适的分片策略，并执行分片处理
 */
export class Chunker {
  private strategies: Map<ChunkType, ChunkingStrategy>;
  private config: ChunkerConfig;
  private optimizer: ChunkOptimizer;
  private metricsCollector: ChunkMetricsCollector;
  private referenceGraph: ChunkReferenceGraph;
  
  /**
   * 构造函数
   * @param config 分片配置（可选）
   */
  constructor(config?: ChunkerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.strategies = new Map<ChunkType, ChunkingStrategy>();
    this.optimizer = new ChunkOptimizer(this.config.maxChunkSize);
    this.metricsCollector = new ChunkMetricsCollector();
    this.referenceGraph = new ChunkReferenceGraph();
    
    // 注册默认策略
    this.registerDefaultStrategies();
  }
  
  /**
   * 注册默认分片策略
   */
  private registerDefaultStrategies(): void {
    this.registerStrategy(new MetadataChunkingStrategy());
    this.registerStrategy(new NodeChunkingStrategy());
    this.registerStrategy(new GlobalVarsChunkingStrategy());
  }
  
  /**
   * 注册分片策略
   * @param strategy 要注册的分片策略
   */
  public registerStrategy(strategy: ChunkingStrategy): void {
    this.strategies.set(strategy.getType(), strategy);
  }
  
  /**
   * 获取特定类型的分片策略
   * @param type 分片类型
   * @returns 对应的分片策略，如果不存在则返回undefined
   */
  public getStrategy(type: ChunkType): ChunkingStrategy | undefined {
    return this.strategies.get(type);
  }
  
  /**
   * 对数据进行分片处理
   * @param data 要分片的数据
   * @param fileKey Figma文件键
   * @param type 指定的数据类型（可选，如果未提供则自动检测）
   * @returns 分片结果
   */
  public async chunk(data: any, fileKey: string, type?: ChunkType): Promise<ChunkResult> {
    // 记录开始时间（用于性能指标）
    const startTime = Date.now();
    
    // 确定数据类型
    const dataType = type || this.detectDataType(data);
    
    // 获取对应的分片策略
    const strategy = this.strategies.get(dataType);
    
    if (!strategy) {
      throw new Error(`No chunking strategy registered for type: ${dataType}`);
    }
    
    // 创建分片上下文
    const context = createInitialContext(
      fileKey, 
      this.config.maxChunkSize || DEFAULT_CONFIG.maxChunkSize!,
      dataType
    );
    
    // 执行分片
    let result = await strategy.chunk(data, context);
    
    // 处理分片引用关系
    result = await this.processReferences(result);
    
    // 优化分片大小
    if (this.config.optimizationLevel !== OptimizationLevel.NONE) {
      result = this.optimizeChunks(result);
    }
    
    // 检测循环引用
    if (this.config.detectCircularReferences) {
      this.detectCircularReferences(result);
    }
    
    // 收集性能指标
    if (this.config.collectMetrics) {
      const endTime = Date.now();
      const processingTime = endTime - startTime;
      
      this.metricsCollector.recordProcessingTime(dataType, processingTime);
      this.metricsCollector.recordChunkCount(dataType, result.chunks.length);
      
      // 记录分片大小
      result.chunks.forEach(chunk => {
        const size = Buffer.byteLength(JSON.stringify(chunk.data), 'utf8');
        this.metricsCollector.recordChunkSize(chunk.type, size);
      });
    }
    
    // 调试输出
    if (this.config.debug) {
      this.debugOutput(result);
    }
    
    return result;
  }
  
  /**
   * 处理分片引用关系
   * 构建分片引用图并确保引用完整性
   * @param result 原始分片结果
   * @returns 处理后的分片结果
   */
  private async processReferences(result: ChunkResult): Promise<ChunkResult> {
    // 构建引用图
    for (const chunk of result.chunks) {
      this.referenceGraph.addNode(chunk.id, { type: chunk.type });
      
      // 添加分片间的引用关系
      for (const linkedId of chunk.links) {
        this.referenceGraph.addReference(chunk.id, linkedId);
      }
    }
    
    return result;
  }
  
  /**
   * 优化分片大小
   * @param result 原始分片结果
   * @returns 优化后的分片结果
   */
  private optimizeChunks(result: ChunkResult): ChunkResult {
    const optimizedChunks = result.chunks.map(chunk => 
      this.optimizer.optimize(chunk, this.config.optimizationLevel)
    );
    
    return {
      ...result,
      chunks: optimizedChunks
    };
  }
  
  /**
   * 检测循环引用
   * @param result 分片结果
   * @throws 如果检测到循环引用，抛出错误
   */
  private detectCircularReferences(result: ChunkResult): void {
    const cycles = this.referenceGraph.detectCircularReferences();
    
    if (cycles.length > 0) {
      if (this.config.debug) {
        console.warn('Circular references detected:', cycles);
      }
      
      // 在非严格模式下，只警告不抛出错误
      // 如果需要严格处理，可以在这里抛出错误
      // throw new Error(`Circular references detected: ${JSON.stringify(cycles)}`);
    }
  }
  
  /**
   * 获取分片指标
   * @returns 收集的分片处理指标
   */
  public getMetrics() {
    return this.metricsCollector.getStatistics();
  }
  
  /**
   * 重置分片指标
   * 清空所有收集的指标数据
   */
  public resetMetrics(): void {
    this.metricsCollector.reset();
  }
  
  /**
   * 获取分片引用图
   * @returns 导出的引用图
   */
  public getReferenceGraph() {
    return this.referenceGraph.exportGraph();
  }
  
  /**
   * 检测数据类型
   * 根据数据特征自动判断适合的分片类型
   * @param data 要检测的数据
   * @returns 检测到的数据类型
   */
  private detectDataType(data: any): ChunkType {
    if (!data) {
      return ChunkType.METADATA; // 默认为元数据
    }
    
    // 检查是否为全局变量
    if (
      (data.variables && typeof data.variables === 'object') ||
      (data.localVariables && typeof data.localVariables === 'object') ||
      (Array.isArray(data) && data.length > 0 && data[0].type && 
       ['COLOR', 'FLOAT', 'STRING', 'BOOLEAN'].includes(data[0].type))
    ) {
      return ChunkType.GLOBAL_VARS;
    }
    
    // 检查是否为节点
    if (
      (data.id && data.type && typeof data.type === 'string') ||
      (data.document && data.document.id && data.document.children)
    ) {
      return ChunkType.NODE;
    }
    
    // 检查是否为元数据
    if (
      (data.name && data.schemaVersion) ||
      (data.name && data.lastModified && data.version)
    ) {
      return ChunkType.METADATA;
    }
    
    // 默认为元数据
    return ChunkType.METADATA;
  }
  
  /**
   * 输出调试信息
   * @param result 分片结果
   */
  private debugOutput(result: ChunkResult): void {
    console.log('=== Chunking Debug ===');
    console.log(`Total chunks: ${result.chunks.length}`);
    console.log(`Primary chunk: ${result.primaryChunkId}`);
    console.log(`References: ${result.references.length}`);
    
    // 输出每个分片的基本信息
    result.chunks.forEach((chunk, index) => {
      const size = Buffer.byteLength(JSON.stringify(chunk.data), 'utf8');
      console.log(`[${index}] ID: ${chunk.id}, Type: ${chunk.type}, Size: ${size} bytes, Links: ${chunk.links.length}`);
    });
    
    // 如果收集了指标，显示指标摘要
    if (this.config.collectMetrics) {
      const metrics = this.metricsCollector.getStatistics();
      console.log('\n=== Metrics Summary ===');
      console.log(`Total chunks: ${metrics.totalChunks}`);
      console.log(`Average size: ${Math.round(metrics.averageChunkSize[result.chunks[0].type])} bytes`);
      console.log(`Processing time: ${Math.round(metrics.averageProcessingTime[result.chunks[0].type])} ms`);
    }
    
    console.log('======================');
  }
} 