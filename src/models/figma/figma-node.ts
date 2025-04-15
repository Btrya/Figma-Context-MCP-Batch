/**
 * Figma设计节点接口
 */
export interface FigmaNode {
  /**
   * 节点ID
   */
  id: string;
  
  /**
   * 节点名称
   */
  name: string;
  
  /**
   * 节点类型
   */
  type: string;
  
  /**
   * 子节点ID列表
   */
  children?: string[];
  
  /**
   * 其他节点属性（通过索引签名支持任意属性）
   */
  [key: string]: any;
}

/**
 * Figma文件元数据
 */
export interface FigmaMetadata {
  /**
   * 文件名
   */
  name: string;
  
  /**
   * 最后修改时间
   */
  lastModified: string;
  
  /**
   * 缩略图URL
   */
  thumbnailUrl?: string;
  
  /**
   * 其他元数据属性
   */
  [key: string]: any;
}

/**
 * Figma全局变量
 */
export interface FigmaGlobalVars {
  /**
   * 样式定义
   */
  styles?: Record<string, any>;
  
  /**
   * 其他全局变量
   */
  [key: string]: any;
} 