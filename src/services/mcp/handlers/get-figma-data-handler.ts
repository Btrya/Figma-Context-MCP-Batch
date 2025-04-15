import { FigmaApiClient } from '../../figma/figma-api-client.js';
import { FigmaNodeExtractor } from '../../figma/figma-node-extractor.js';
import { FigmaChunker } from '../../figma/figma-chunker.js';
import { FigmaCacheManager } from '../../figma/figma-cache-manager.js';
import { Logger } from '../../../utils/logger.js';

/**
 * 获取Figma数据请求接口
 */
export interface GetFigmaDataRequest {
  /**
   * Figma文件键
   */
  fileKey: string;
  
  /**
   * 节点ID（可选）
   */
  nodeId?: string;
  
  /**
   * 遍历深度（可选）
   */
  depth?: number;
}

/**
 * 获取Figma数据响应接口
 */
export interface GetFigmaDataResponse {
  /**
   * Figma文件键
   */
  fileKey: string;
  
  /**
   * 第一个分块ID
   */
  firstChunkId: string;
  
  /**
   * 总分块数
   */
  totalChunks: number;
  
  /**
   * 文件元数据
   */
  metadata: any;
  
  /**
   * 文件结构概要
   */
  structure: any;
}

/**
 * 获取Figma数据处理器
 * 负责处理get_figma_data工具调用，获取Figma设计数据并分块
 */
export class GetFigmaDataHandler {
  private readonly apiClient: FigmaApiClient;
  private readonly nodeExtractor: FigmaNodeExtractor;
  private readonly chunker: FigmaChunker;
  private readonly cacheManager: FigmaCacheManager;
  
  /**
   * 构造函数
   * @param apiKey Figma API密钥
   */
  constructor(apiKey: string) {
    this.apiClient = new FigmaApiClient(apiKey);
    this.nodeExtractor = new FigmaNodeExtractor();
    this.chunker = new FigmaChunker();
    this.cacheManager = new FigmaCacheManager();
    
    Logger.info('初始化GetFigmaDataHandler');
  }
  
  /**
   * 处理工具调用
   * @param request 请求参数
   * @returns 响应数据
   */
  async handle(request: GetFigmaDataRequest): Promise<GetFigmaDataResponse> {
    try {
      Logger.info(`处理get_figma_data请求: fileKey=${request.fileKey}, nodeId=${request.nodeId || 'null'}, depth=${request.depth || 'null'}`);
      
      // 验证请求
      this.validateRequest(request);
      
      // 获取Figma数据
      const figmaData = await this.fetchFigmaData(request.fileKey, request.nodeId, request.depth);
      
      // 提取节点
      const extractionResult = this.nodeExtractor.extractNodes(figmaData);
      
      // 创建分块
      const chunks = this.chunker.createChunks(
        extractionResult.nodes,
        extractionResult.metadata,
        extractionResult.globalVars,
        extractionResult.rootNodeIds,
        request.fileKey
      );
      
      // 缓存分块
      await this.cacheManager.cacheChunks(request.fileKey, chunks);
      
      // 格式化响应
      return this.formatResponse(request.fileKey, chunks, extractionResult);
    } catch (error) {
      Logger.error('处理get_figma_data请求失败', error);
      throw error;
    }
  }
  
  /**
   * 获取工具描述
   * @returns 工具描述
   */
  getToolDescription(): any {
    return {
      name: 'get_figma_data',
      description: '获取Figma设计文件数据并进行分块处理，返回文件元数据和分块信息',
      parameters: {
        properties: {
          fileKey: {
            type: 'string',
            description: 'Figma文件键，通常在Figma URL中，如：figma.com/file/{fileKey}/...',
            required: true
          },
          nodeId: {
            type: 'string',
            description: '可选的节点ID，用于获取特定节点的数据',
            required: false
          },
          depth: {
            type: 'number',
            description: '可选的遍历深度，控制获取的节点层级深度',
            required: false
          }
        },
        required: ['fileKey']
      }
    };
  }
  
  /**
   * 验证请求参数
   * @param request 请求参数
   */
  private validateRequest(request: GetFigmaDataRequest): void {
    if (!request.fileKey) {
      throw new Error('fileKey参数是必需的');
    }
    
    if (request.depth !== undefined && (typeof request.depth !== 'number' || request.depth < 0)) {
      throw new Error('depth参数必须是一个非负整数');
    }
  }
  
  /**
   * 获取Figma数据
   * @param fileKey Figma文件键
   * @param nodeId 可选的节点ID
   * @param depth 可选的遍历深度
   * @returns Figma数据
   */
  private async fetchFigmaData(fileKey: string, nodeId?: string, depth?: number): Promise<any> {
    try {
      return await this.apiClient.getFileData(fileKey, nodeId, depth);
    } catch (error) {
      Logger.error(`获取Figma数据失败: ${fileKey}`, error);
      throw error;
    }
  }
  
  /**
   * 格式化响应
   * @param fileKey Figma文件键
   * @param chunks 分块列表
   * @param extractionResult 提取结果
   * @returns 响应数据
   */
  private formatResponse(
    fileKey: string,
    chunks: any[],
    extractionResult: any
  ): GetFigmaDataResponse {
    if (chunks.length === 0) {
      throw new Error('没有生成分块数据');
    }
    
    // 获取第一个分块
    const firstChunk = chunks[0];
    
    // 创建结构概要
    const structure = this.createStructureSummary(extractionResult);
    
    return {
      fileKey,
      firstChunkId: firstChunk.chunkId,
      totalChunks: chunks.length,
      metadata: extractionResult.metadata,
      structure
    };
  }
  
  /**
   * 创建结构概要
   * @param extractionResult 提取结果
   * @returns 结构概要
   */
  private createStructureSummary(extractionResult: any): any {
    // 创建一个简化的结构概要，只包含根节点和第一级子节点
    const summary: any = {
      rootNodes: []
    };
    
    // 处理每个根节点
    for (const rootNodeId of extractionResult.rootNodeIds) {
      const rootNode = extractionResult.nodes.get(rootNodeId);
      if (!rootNode) continue;
      
      const nodeSummary: any = {
        id: rootNode.id,
        name: rootNode.name,
        type: rootNode.type
      };
      
      // 添加子节点概要
      if (rootNode.children && rootNode.children.length > 0) {
        nodeSummary.childrenCount = rootNode.children.length;
        nodeSummary.childrenTypes = this.summarizeChildrenTypes(rootNode.children, extractionResult.nodes);
      }
      
      summary.rootNodes.push(nodeSummary);
    }
    
    return summary;
  }
  
  /**
   * 汇总子节点类型
   * @param childrenIds 子节点ID列表
   * @param nodeMap 节点映射
   * @returns 类型统计
   */
  private summarizeChildrenTypes(childrenIds: string[], nodeMap: Map<string, any>): any {
    const typeCounts: Record<string, number> = {};
    
    for (const childId of childrenIds) {
      const child = nodeMap.get(childId);
      if (!child) continue;
      
      const type = child.type || 'UNKNOWN';
      typeCounts[type] = (typeCounts[type] || 0) + 1;
    }
    
    return typeCounts;
  }
} 