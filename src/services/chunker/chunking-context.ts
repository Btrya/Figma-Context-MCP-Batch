/**
 * 分片上下文文件
 * 定义分片过程中的上下文信息
 */

/**
 * 分片上下文接口
 * 包含分片过程中需要的各种参数和状态
 */
export interface ChunkingContext {
  /**
   * Figma文件键
   */
  fileKey: string;
  
  /**
   * 最大分片大小（字节）
   */
  maxSize: number;
  
  /**
   * 父节点ID（如果有）
   */
  parentId?: string;
  
  /**
   * 当前路径，记录分片层级路径
   */
  path: string[];
  
  /**
   * 当前深度，记录分片操作递归深度
   */
  depth: number;
  
  /**
   * 对象ID到分片ID的映射
   * 用于追踪已分片对象和避免循环引用
   */
  idMap: Map<string, string>;
}

/**
 * 创建初始分片上下文
 * @param fileKey Figma文件键
 * @param maxSize 最大分片大小（字节）
 * @returns 初始分片上下文
 */
export function createInitialContext(fileKey: string, maxSize: number): ChunkingContext {
  return {
    fileKey,
    maxSize,
    path: [],
    depth: 0,
    idMap: new Map<string, string>()
  };
}

/**
 * 创建子上下文
 * 用于递归分片处理中创建子节点的上下文
 * @param parentContext 父上下文
 * @param path 子路径
 * @param parentId 父节点ID
 * @returns 子上下文
 */
export function createChildContext(
  parentContext: ChunkingContext,
  path: string,
  parentId?: string
): ChunkingContext {
  return {
    fileKey: parentContext.fileKey,
    maxSize: parentContext.maxSize,
    parentId: parentId || parentContext.parentId,
    path: [...parentContext.path, path],
    depth: parentContext.depth + 1,
    idMap: parentContext.idMap
  };
} 