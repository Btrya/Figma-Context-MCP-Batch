import { FigmaNode, FigmaMetadata, FigmaGlobalVars } from './figma-node.js';

/**
 * Figma分块接口
 */
export interface FigmaChunk {
  /**
   * 分块ID
   */
  chunkId: string;
  
  /**
   * Figma文件键
   */
  fileKey: string;
  
  /**
   * 下一分块ID（如果不是最后一个分块）
   */
  nextChunkId?: string;
  
  /**
   * 总分块数
   */
  totalChunks: number;
  
  /**
   * 元数据（仅首块包含）
   */
  metadata?: FigmaMetadata;
  
  /**
   * 全局变量（仅首块包含）
   */
  globalVars?: FigmaGlobalVars;
  
  /**
   * 分块包含的节点
   */
  nodes: FigmaNode[];
}

/**
 * 分块生成配置
 */
export interface ChunkGenerationConfig {
  /**
   * 最大分块大小（字符数）
   */
  maxChunkSize: number;
  
  /**
   * 是否使用深度优先顺序生成分块
   */
  depthFirst: boolean;
} 