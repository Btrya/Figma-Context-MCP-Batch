/**
 * 分片引用图
 * 管理分片之间的引用关系，支持循环引用检测
 */

/**
 * 分片引用图类
 * 使用图数据结构管理分片之间的引用关系
 */
export class ChunkReferenceGraph {
  // 存储分片节点及其引用关系
  private adjacencyList: Map<string, Set<string>>;
  // 存储分片节点相关数据
  private nodeData: Map<string, any>;
  
  /**
   * 构造函数
   */
  constructor() {
    this.adjacencyList = new Map<string, Set<string>>();
    this.nodeData = new Map<string, any>();
  }
  
  /**
   * 添加分片节点
   * @param chunkId 分片ID
   * @param data 节点相关数据（可选）
   */
  public addNode(chunkId: string, data?: any): void {
    if (!this.adjacencyList.has(chunkId)) {
      this.adjacencyList.set(chunkId, new Set<string>());
    }
    
    if (data !== undefined) {
      this.nodeData.set(chunkId, data);
    }
  }
  
  /**
   * 添加分片间引用
   * @param sourceId 源分片ID
   * @param targetId 目标分片ID
   */
  public addReference(sourceId: string, targetId: string): void {
    // 确保两个节点都存在
    this.addNode(sourceId);
    this.addNode(targetId);
    
    // 添加引用关系
    const references = this.adjacencyList.get(sourceId);
    references?.add(targetId);
  }
  
  /**
   * 获取分片的所有引用
   * @param chunkId 分片ID
   * @returns 引用的分片ID数组
   */
  public getReferences(chunkId: string): string[] {
    const references = this.adjacencyList.get(chunkId);
    return references ? Array.from(references) : [];
  }
  
  /**
   * 获取引用特定分片的所有分片
   * @param chunkId 分片ID
   * @returns 引用该分片的所有分片ID数组
   */
  public getReferencedBy(chunkId: string): string[] {
    const referencedBy: string[] = [];
    
    // 遍历所有节点的引用列表
    for (const [sourceId, references] of this.adjacencyList.entries()) {
      if (references.has(chunkId)) {
        referencedBy.push(sourceId);
      }
    }
    
    return referencedBy;
  }
  
  /**
   * 检测循环引用
   * 使用深度优先搜索算法检测图中的循环
   * @returns 检测到的循环引用路径数组
   */
  public detectCircularReferences(): string[][] {
    const visited = new Map<string, boolean>();
    const recursionStack = new Map<string, boolean>();
    const cycles: string[][] = [];
    
    // 对每个节点进行DFS
    for (const node of this.adjacencyList.keys()) {
      if (!visited.get(node)) {
        this.dfsForCycleDetection(node, visited, recursionStack, [], cycles);
      }
    }
    
    return cycles;
  }
  
  /**
   * 导出完整引用图
   * @returns 分片ID到其引用列表的映射
   */
  public exportGraph(): Record<string, string[]> {
    const graph: Record<string, string[]> = {};
    
    for (const [nodeId, references] of this.adjacencyList.entries()) {
      graph[nodeId] = Array.from(references);
    }
    
    return graph;
  }
  
  /**
   * 深度优先搜索辅助方法
   * 用于循环引用检测
   */
  private dfsForCycleDetection(
    node: string,
    visited: Map<string, boolean>,
    recursionStack: Map<string, boolean>,
    path: string[],
    cycles: string[][]
  ): void {
    // 标记当前节点为已访问
    visited.set(node, true);
    // 将当前节点加入递归栈
    recursionStack.set(node, true);
    // 将当前节点加入当前路径
    path.push(node);
    
    // 访问所有相邻节点
    const adjacentNodes = this.adjacencyList.get(node) || new Set<string>();
    for (const adjacent of adjacentNodes) {
      // 如果相邻节点未访问，则继续DFS
      if (!visited.get(adjacent)) {
        this.dfsForCycleDetection(adjacent, visited, recursionStack, [...path], cycles);
      }
      // 如果相邻节点在递归栈中，则找到一个循环
      else if (recursionStack.get(adjacent)) {
        // 从当前路径中提取循环
        const cycleStart = path.findIndex(n => n === adjacent);
        if (cycleStart !== -1) {
          const cycle = path.slice(cycleStart).concat(adjacent);
          cycles.push(cycle);
        }
      }
    }
    
    // 回溯时从递归栈中移除当前节点
    recursionStack.set(node, false);
  }
} 