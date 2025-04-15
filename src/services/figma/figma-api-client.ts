import { Logger } from '../../utils/logger.js';

/**
 * Figma API错误
 */
export interface FigmaApiError {
  status: number;
  message: string;
}

/**
 * Figma API客户端
 * 负责与Figma API交互获取设计数据
 */
export class FigmaApiClient {
  private readonly apiKey: string;
  private readonly baseUrl: string;
  
  /**
   * 构造函数
   * @param apiKey Figma API密钥
   * @param baseUrl API基础URL，默认为Figma官方API
   */
  constructor(apiKey: string, baseUrl: string = 'https://api.figma.com/v1') {
    this.apiKey = apiKey;
    this.baseUrl = baseUrl;
    
    if (!this.apiKey) {
      throw new Error('Figma API密钥不能为空');
    }
    
    Logger.info('初始化Figma API客户端');
  }
  
  /**
   * 获取Figma文件数据
   * @param fileKey Figma文件键
   * @param nodeId 可选的节点ID
   * @param depth 可选的遍历深度
   * @returns 文件数据
   */
  async getFileData(fileKey: string, nodeId?: string, depth?: number): Promise<any> {
    try {
      let endpoint = `/files/${fileKey}`;
      
      // 构建查询参数
      const queryParams: string[] = [];
      
      if (depth !== undefined) {
        queryParams.push(`depth=${depth}`);
      }
      
      if (nodeId) {
        endpoint = `/files/${fileKey}/nodes`;
        queryParams.push(`ids=${nodeId}`);
      }
      
      if (queryParams.length > 0) {
        endpoint += `?${queryParams.join('&')}`;
      }
      
      Logger.info(`请求Figma数据: ${endpoint}`);
      return await this.request(endpoint);
    } catch (error) {
      Logger.error(`获取Figma文件数据失败: ${fileKey}`, error);
      throw error;
    }
  }
  
  /**
   * 发送API请求
   * @param endpoint API端点
   * @returns 响应数据
   */
  private async request(endpoint: string): Promise<any> {
    try {
      // 检查fetch是否可用（Node.js环境）
      if (typeof fetch !== 'function') {
        throw new Error('当前环境不支持fetch，请使用Node.js v18或更高版本');
      }
      
      const url = `${this.baseUrl}${endpoint}`;
      Logger.debug(`发送请求: ${url}`);
      
      const response = await fetch(url, {
        headers: {
          'X-Figma-Token': this.apiKey,
          'Content-Type': 'application/json'
        }
      });
      
      if (!response.ok) {
        const error: FigmaApiError = {
          status: response.status,
          message: response.statusText || '未知错误'
        };
        
        throw error;
      }
      
      return await response.json();
    } catch (error) {
      if ((error as FigmaApiError).status) {
        const apiError = error as FigmaApiError;
        throw new Error(`Figma API错误: ${apiError.status} ${apiError.message}`);
      }
      
      if (error instanceof Error) {
        throw new Error(`请求Figma API失败: ${error.message}`);
      }
      
      throw new Error(`请求Figma API失败: ${String(error)}`);
    }
  }
} 