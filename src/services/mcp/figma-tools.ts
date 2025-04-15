import { ToolManager } from './tool-manager.js';
import { GetFigmaDataHandler } from './handlers/get-figma-data-handler.js';
import { GetFigmaChunkHandler } from './handlers/get-figma-chunk-handler.js';
import { Logger } from '../../utils/logger.js';

/**
 * 注册Figma工具
 * @param toolManager 工具管理器
 * @param figmaApiKey Figma API密钥
 */
export function registerFigmaTools(toolManager: ToolManager, figmaApiKey: string): void {
  try {
    Logger.info('注册Figma工具');
    
    // 创建处理器
    const getFigmaDataHandler = new GetFigmaDataHandler(figmaApiKey);
    const getFigmaChunkHandler = new GetFigmaChunkHandler();
    
    // 注册工具
    toolManager.registerHandler('get_figma_data', getFigmaDataHandler);
    toolManager.registerHandler('get_figma_chunk', getFigmaChunkHandler);
    
    Logger.info('Figma工具注册完成');
  } catch (error) {
    Logger.error('注册Figma工具失败', error);
    throw error;
  }
} 