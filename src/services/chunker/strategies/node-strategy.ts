/**
 * 节点分片策略
 * 处理Figma节点数据的分片
 */

import { ChunkingStrategy } from './chunking-strategy.js';
import { ChunkingContext, createChildContext } from '../chunking-context.js';
import { ChunkResult, createSimpleChunkResult, mergeChunkResults } from '../../../models/chunker/chunk-result.js';
import { Chunk, ChunkType } from '../../storage/models/chunk.js';
import { ChunkIdGenerator } from '../chunk-id-generator.js';
import { estimateSize, isOverSize, shouldSplitNode } from '../../../utils/size-estimator.js';

/**
 * 节点引用
 * 用于替换被分离出去的子节点
 */
interface NodeReference {
  id: string;       // 原始节点ID
  name: string;     // 节点名称
  type: string;     // 节点类型
  chunkId: string;  // 包含节点的分片ID
}

/**
 * 节点分片策略
 * 实现对Figma节点数据的分片处理
 */
export class NodeChunkingStrategy implements ChunkingStrategy {
  // 最大嵌套深度，防止无限递归
  private static readonly MAX_DEPTH = 100;
  
  /**
   * 对节点数据进行分片
   * @param data 节点数据
   * @param context 分片上下文
   * @returns 分片结果
   */
  async chunk(data: any, context: ChunkingContext): Promise<ChunkResult> {
    // 检查递归深度
    if (context.depth > NodeChunkingStrategy.MAX_DEPTH) {
      throw new Error(`Maximum chunking depth exceeded: ${context.depth}`);
    }
    
    // 判断节点是否需要进一步分片
    if (!this.shouldChunk(data, context)) {
      // 创建单个节点分片
      const nodeId = data.id || `node-${Date.now()}`;
      const chunk: Chunk = {
        id: ChunkIdGenerator.generateId(context.fileKey, ChunkType.NODE, nodeId),
        fileKey: context.fileKey,
        type: ChunkType.NODE,
        created: new Date(),
        lastAccessed: new Date(),
        data,
        links: []
      };
      
      // 更新ID映射
      if (data.id) {
        context.idMap.set(data.id, chunk.id);
      }
      
      return createSimpleChunkResult(chunk);
    }
    
    // 需要分片的情况，处理节点及其子节点
    return await this.processComplexNode(data, context);
  }
  
  /**
   * 判断节点是否需要进一步分片
   * @param data 节点数据
   * @param context 分片上下文
   * @returns 是否需要分片
   */
  shouldChunk(data: any, context: ChunkingContext): boolean {
    // 检查节点大小
    if (isOverSize(data, context.maxSize)) {
      return true;
    }
    
    // 使用节点特定逻辑检查
    return shouldSplitNode(data, context.maxSize);
  }
  
  /**
   * 获取策略类型
   * @returns 节点分片类型
   */
  getType(): ChunkType {
    return ChunkType.NODE;
  }
  
  /**
   * 处理复杂节点
   * 将大型节点分解为多个分片
   * @param node 节点数据
   * @param context 分片上下文
   * @returns 分片结果
   */
  private async processComplexNode(node: any, context: ChunkingContext): Promise<ChunkResult> {
    const nodeId = node.id || `node-${Date.now()}`;
    const nodePath = node.name || nodeId;
    
    // 创建主节点的分片ID
    const chunkId = ChunkIdGenerator.generateId(context.fileKey, ChunkType.NODE, nodeId);
    
    // 更新ID映射
    if (node.id) {
      context.idMap.set(node.id, chunkId);
    }
    
    // 处理子节点
    const processedNode = { ...node };
    const childResults: ChunkResult[] = [];
    
    if (node.children && node.children.length > 0) {
      // 替换子节点为引用
      processedNode.children = await this.processChildren(node.children, createChildContext(
        context,
        nodePath,
        chunkId
      ));
      
      // 收集子节点分片结果
      for (let i = 0; i < node.children.length; i++) {
        const child = node.children[i];
        
        // 跳过已处理的简单子节点
        if (!this.shouldChunk(child, context)) continue;
        
        // 为复杂子节点创建分片
        const childContext = createChildContext(
          context,
          `${nodePath}/child-${i}`,
          chunkId
        );
        
        const childResult = await this.chunk(child, childContext);
        childResults.push(childResult);
      }
    }
    
    // 创建主节点分片
    const chunk: Chunk = {
      id: chunkId,
      fileKey: context.fileKey,
      type: ChunkType.NODE,
      created: new Date(),
      lastAccessed: new Date(),
      data: processedNode,
      links: []
    };
    
    // 将子分片ID添加到链接中
    const references: string[] = [];
    
    for (const result of childResults) {
      references.push(result.primaryChunkId);
      // 收集间接引用
      references.push(...result.references);
    }
    
    // 添加唯一引用
    chunk.links = [...new Set(references)];
    
    // 创建初始结果
    const mainResult = createSimpleChunkResult(chunk, references);
    
    // 如果没有子结果，直接返回主结果
    if (childResults.length === 0) {
      return mainResult;
    }
    
    // 合并所有结果
    return {
      chunks: [
        chunk,
        ...childResults.flatMap(result => result.chunks)
      ],
      primaryChunkId: chunk.id,
      references: Array.from(new Set(references))
    };
  }
  
  /**
   * 处理子节点
   * 将复杂子节点替换为引用
   * @param children 子节点数组
   * @param context 分片上下文
   * @returns 处理后的子节点数组（可能包含引用）
   */
  private async processChildren(children: any[], context: ChunkingContext): Promise<any[]> {
    const processedChildren = [];
    
    for (let i = 0; i < children.length; i++) {
      const child = children[i];
      
      // 如果是简单节点，保留原样
      if (!this.shouldChunk(child, context)) {
        processedChildren.push(child);
        continue;
      }
      
      // 对于复杂节点，创建引用
      const nodeRef: NodeReference = {
        id: child.id,
        name: child.name || `unnamed-${i}`,
        type: child.type || 'UNKNOWN',
        chunkId: '' // 暂时为空，将在子节点分片后更新
      };
      
      // 如果ID映射中已有该节点，使用映射的分片ID
      if (child.id && context.idMap.has(child.id)) {
        nodeRef.chunkId = context.idMap.get(child.id)!;
      } else {
        // 否则预生成分片ID
        const childId = child.id || `child-${Date.now()}-${i}`;
        nodeRef.chunkId = ChunkIdGenerator.generateId(context.fileKey, ChunkType.NODE, childId);
        
        if (child.id) {
          context.idMap.set(child.id, nodeRef.chunkId);
        }
      }
      
      processedChildren.push(nodeRef);
    }
    
    return processedChildren;
  }
  
  /**
   * 估计节点大小
   * @param node 节点数据
   * @returns 估计的字节大小
   */
  private estimateNodeSize(node: any): number {
    return estimateSize(node);
  }
} 