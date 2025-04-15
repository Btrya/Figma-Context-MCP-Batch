import { FigmaNode, FigmaMetadata, FigmaGlobalVars } from '../../models/figma/figma-node.js';
import { FigmaChunk, ChunkGenerationConfig } from '../../models/figma/figma-chunk.js';
import { FigmaChunkConfig } from '../../config/env.js';
import { Logger } from '../../utils/logger.js';
import crypto from 'crypto';

/**
 * Figma分块处理器
 * 负责将提取的Figma节点转换为大小适当的分块
 */
export class FigmaChunker {
  private readonly config: ChunkGenerationConfig;
  
  /**
   * 构造函数
   * @param config 分块生成配置，默认使用环境配置
   */
  constructor(config?: Partial<ChunkGenerationConfig>) {
    this.config = {
      maxChunkSize: config?.maxChunkSize || FigmaChunkConfig.MAX_CHUNK_SIZE,
      depthFirst: config?.depthFirst !== undefined ? config.depthFirst : true
    };
    
    Logger.info(`初始化Figma分块处理器: 最大分块大小=${this.config.maxChunkSize}字符, 深度优先=${this.config.depthFirst}`);
  }
  
  /**
   * 创建Figma数据分块
   * @param nodeMap 节点映射 (nodeId -> FigmaNode)
   * @param metadata 元数据
   * @param globalVars 全局变量
   * @param rootNodeIds 根节点ID列表
   * @param fileKey Figma文件键
   * @returns 分块列表
   */
  createChunks(
    nodeMap: Map<string, FigmaNode>,
    metadata: FigmaMetadata,
    globalVars: FigmaGlobalVars,
    rootNodeIds: string[],
    fileKey: string
  ): FigmaChunk[] {
    try {
      Logger.info(`开始创建分块: 文件键=${fileKey}, 节点数量=${nodeMap.size}`);
      
      // 创建分块列表
      const chunks: FigmaChunk[] = [];
      
      // 创建收集要处理的节点的队列
      // 如果是深度优先，使用后进先出(栈)；否则使用先进先出(队列)
      const nodeQueue: string[] = [...rootNodeIds];
      
      // 已经处理的节点集合
      const processedNodes = new Set<string>();
      
      // 当前正在构建的分块
      let currentChunk: FigmaChunk = this.initializeFirstChunk(fileKey, metadata, globalVars);
      
      // 处理所有节点
      while (nodeQueue.length > 0) {
        // 根据深度优先策略选择下一个节点
        const nodeId = this.config.depthFirst
          ? nodeQueue.pop()!  // 栈 - 深度优先
          : nodeQueue.shift()!; // 队列 - 广度优先
        
        // 跳过已处理的节点
        if (processedNodes.has(nodeId)) {
          continue;
        }
        
        // 标记为已处理
        processedNodes.add(nodeId);
        
        // 获取节点
        const node = nodeMap.get(nodeId);
        if (!node) {
          Logger.warn(`节点不存在: ${nodeId}`);
          continue;
        }
        
        // 检查添加该节点是否会使当前分块超过大小限制
        const nodeJson = JSON.stringify(node);
        const currentChunkJson = JSON.stringify(currentChunk);
        
        if (currentChunkJson.length + nodeJson.length > this.config.maxChunkSize && currentChunk.nodes.length > 0) {
          // 当前分块已满，创建新分块
          chunks.push(currentChunk);
          
          // 创建新的分块
          currentChunk = this.createNextChunk(fileKey, chunks.length);
        }
        
        // 添加节点到当前分块
        currentChunk.nodes.push(node);
        
        // 深度优先：将子节点添加到队列
        // 注意：我们反向添加子节点，以便在使用栈时按照正常顺序处理
        if (node.children && node.children.length > 0) {
          const childrenToAdd = [...node.children];
          if (this.config.depthFirst) {
            // 对于深度优先，子节点倒序入栈，使得处理顺序符合预期
            childrenToAdd.reverse();
          }
          nodeQueue.push(...childrenToAdd);
        }
      }
      
      // 添加最后一个分块（如果有节点）
      if (currentChunk.nodes.length > 0) {
        chunks.push(currentChunk);
      }
      
      // 设置每个分块的totalChunks和nextChunkId
      for (let i = 0; i < chunks.length; i++) {
        chunks[i].totalChunks = chunks.length;
        
        // 如果不是最后一个分块，设置nextChunkId
        if (i < chunks.length - 1) {
          chunks[i].nextChunkId = chunks[i + 1].chunkId;
        }
      }
      
      Logger.info(`分块完成: 创建了${chunks.length}个分块`);
      return chunks;
    } catch (error) {
      Logger.error('创建分块失败', error);
      throw new Error(`创建分块失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * 初始化第一个分块
   * @param fileKey Figma文件键
   * @param metadata 元数据
   * @param globalVars 全局变量
   * @returns 初始分块
   */
  private initializeFirstChunk(
    fileKey: string,
    metadata: FigmaMetadata,
    globalVars: FigmaGlobalVars
  ): FigmaChunk {
    return {
      chunkId: this.generateChunkId(fileKey, 0),
      fileKey,
      totalChunks: 0, // 暂时设为0，后面会更新
      nodes: [],
      metadata,
      globalVars
    };
  }
  
  /**
   * 创建下一个分块
   * @param fileKey Figma文件键
   * @param chunkIndex 分块索引
   * @returns 新分块
   */
  private createNextChunk(fileKey: string, chunkIndex: number): FigmaChunk {
    return {
      chunkId: this.generateChunkId(fileKey, chunkIndex),
      fileKey,
      totalChunks: 0, // 暂时设为0，后面会更新
      nodes: []
    };
  }
  
  /**
   * 生成分块ID
   * @param fileKey Figma文件键
   * @param chunkIndex 分块索引
   * @returns 分块ID
   */
  private generateChunkId(fileKey: string, chunkIndex: number): string {
    // 使用文件键和索引创建一个唯一的ID
    const hash = crypto.createHash('md5').update(`${fileKey}-${chunkIndex}`).digest('hex').substring(0, 8);
    return `chunk-${chunkIndex}-${hash}`;
  }
} 