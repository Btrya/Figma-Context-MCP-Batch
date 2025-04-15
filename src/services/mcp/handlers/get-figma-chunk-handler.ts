import { FigmaCacheManager } from '../../figma/figma-cache-manager.js';
import { FigmaChunk } from '../../../models/figma/figma-chunk.js';
import { Logger } from '../../../utils/logger.js';

/**
 * 获取Figma分块请求接口
 */
export interface GetFigmaChunkRequest {
  /**
   * Figma文件键
   */
  fileKey: string;
  
  /**
   * 分块ID
   */
  chunkId: string;
}

/**
 * 获取Figma分块响应接口
 */
export interface GetFigmaChunkResponse {
  /**
   * Figma文件键
   */
  fileKey: string;
  
  /**
   * 当前分块ID
   */
  chunkId: string;
  
  /**
   * 下一分块ID（如果有）
   */
  nextChunkId?: string;
  
  /**
   * 总分块数
   */
  totalChunks: number;
  
  /**
   * 元数据（仅首块包含）
   */
  metadata?: any;
  
  /**
   * 全局变量（仅首块包含）
   */
  globalVars?: any;
  
  /**
   * 分块包含的节点
   */
  nodes: any[];
}

/**
 * 获取Figma分块处理器
 * 负责处理get_figma_chunk工具调用，获取特定的Figma数据分块
 */
export class GetFigmaChunkHandler {
  private readonly cacheManager: FigmaCacheManager;
  
  /**
   * 构造函数
   */
  constructor() {
    this.cacheManager = new FigmaCacheManager();
    Logger.info('初始化GetFigmaChunkHandler');
  }
  
  /**
   * 处理工具调用
   * @param request 请求参数
   * @returns 响应数据
   */
  async handle(request: GetFigmaChunkRequest): Promise<GetFigmaChunkResponse> {
    try {
      Logger.info(`处理get_figma_chunk请求: fileKey=${request.fileKey}, chunkId=${request.chunkId}`);
      
      // 验证请求
      this.validateRequest(request);
      
      // 从缓存中获取分块
      const chunk = await this.fetchChunkFromCache(request.fileKey, request.chunkId);
      
      // 格式化响应
      return this.formatResponse(chunk);
    } catch (error) {
      Logger.error('处理get_figma_chunk请求失败', error);
      throw error;
    }
  }
  
  /**
   * 获取工具描述
   * @returns 工具描述
   */
  getToolDescription(): any {
    return {
      name: 'get_figma_chunk',
      description: '获取Figma设计文件的特定分块数据',
      parameters: {
        properties: {
          fileKey: {
            type: 'string',
            description: 'Figma文件键，通常在Figma URL中，如：figma.com/file/{fileKey}/...',
            required: true
          },
          chunkId: {
            type: 'string',
            description: '分块ID，从get_figma_data响应或前一个分块中获取',
            required: true
          }
        },
        required: ['fileKey', 'chunkId']
      }
    };
  }
  
  /**
   * 验证请求参数
   * @param request 请求参数
   */
  private validateRequest(request: GetFigmaChunkRequest): void {
    if (!request.fileKey) {
      throw new Error('fileKey参数是必需的');
    }
    
    if (!request.chunkId) {
      throw new Error('chunkId参数是必需的');
    }
  }
  
  /**
   * 从缓存中获取分块
   * @param fileKey Figma文件键
   * @param chunkId 分块ID
   * @returns 分块数据
   */
  private async fetchChunkFromCache(fileKey: string, chunkId: string): Promise<FigmaChunk> {
    const chunk = await this.cacheManager.getChunk(fileKey, chunkId);
    
    if (!chunk) {
      throw new Error(`分块不存在: ${fileKey}/${chunkId}`);
    }
    
    return chunk;
  }
  
  /**
   * 格式化响应
   * @param chunk 分块数据
   * @returns 响应数据
   */
  private formatResponse(chunk: FigmaChunk): GetFigmaChunkResponse {
    return {
      fileKey: chunk.fileKey,
      chunkId: chunk.chunkId,
      nextChunkId: chunk.nextChunkId,
      totalChunks: chunk.totalChunks,
      metadata: chunk.metadata,
      globalVars: chunk.globalVars,
      nodes: chunk.nodes
    };
  }
} 