/**
 * Figma数据分片模型文件
 * 定义分片数据的结构和类型
 */

/**
 * 分片类型枚举
 * 标识不同类型的Figma数据分片
 */
export enum ChunkType {
  METADATA = 'metadata',   // 元数据分片
  NODE = 'node',           // 节点数据分片
  GLOBAL_VARS = 'globalVars' // 全局变量分片
}

/**
 * 分片数据接口
 * 表示一个Figma数据分片的完整信息
 */
export interface Chunk {
  id: string;           // 分片唯一标识符
  fileKey: string;      // Figma文件键
  type: ChunkType;      // 分片类型
  created: Date;        // 创建时间
  expires?: Date;       // 过期时间（可选）
  lastAccessed: Date;   // 最后访问时间
  data: any;            // 分片实际数据
  links: string[];      // 相关联的其他分片ID
}

/**
 * 分片摘要接口
 * 用于列表展示的分片简略信息
 */
export interface ChunkSummary {
  id: string;           // 分片ID
  fileKey: string;      // Figma文件键
  type: ChunkType;      // 分片类型
  created: Date;        // 创建时间
  size: number;         // 数据大小（字节）
} 