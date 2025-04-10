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
import { ChunkResult } from '../../models/chunker/chunk-result.js';

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
}

/**
 * 默认分片配置
 */
const DEFAULT_CONFIG: ChunkerConfig = {
  maxChunkSize: 30 * 1024, // 30KB
  debug: false
};

/**
 * 分片处理器
 * 负责根据数据类型选择合适的分片策略，并执行分片处理
 */
export class Chunker {
  private strategies: Map<ChunkType, ChunkingStrategy>;
  private config: ChunkerConfig;
  
  /**
   * 构造函数
   * @param config 分片配置（可选）
   */
  constructor(config?: ChunkerConfig) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.strategies = new Map<ChunkType, ChunkingStrategy>();
    
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
   * 对数据进行分片
   * @param data 要分片的数据
   * @param fileKey Figma文件键
   * @param type 数据类型（可选，如果不指定将尝试自动检测）
   * @returns 分片结果
   */
  public async chunk(data: any, fileKey: string, type?: ChunkType): Promise<ChunkResult> {
    // 确定数据类型
    const dataType = type || this.detectDataType(data);
    
    // 获取对应的分片策略
    const strategy = this.strategies.get(dataType);
    
    if (!strategy) {
      throw new Error(`No chunking strategy registered for type: ${dataType}`);
    }
    
    // 创建分片上下文
    const context = createInitialContext(fileKey, this.config.maxChunkSize || DEFAULT_CONFIG.maxChunkSize!);
    
    // 执行分片
    const result = await strategy.chunk(data, context);
    
    // 调试输出
    if (this.config.debug) {
      this.debugOutput(result);
    }
    
    return result;
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
    
    console.log('======================');
  }
} 