/**
 * 全局变量分片策略
 * 处理Figma全局变量数据的分片
 */

import { ChunkingStrategy } from './chunking-strategy.js';
import { ChunkingContext } from '../chunking-context.js';
import { ChunkResult, createSimpleChunkResult } from '../../../models/chunker/chunk-result.js';
import { Chunk, ChunkType } from '../../storage/models/chunk.js';
import { ChunkIdGenerator } from '../chunk-id-generator.js';
import { estimateSize, isOverSize } from '../../../utils/size-estimator.js';

/**
 * 变量类型
 * Figma中常见的变量类型
 */
enum VariableType {
  COLOR = 'COLOR',
  FLOAT = 'FLOAT',
  STRING = 'STRING',
  BOOLEAN = 'BOOLEAN',
  TEXT_STYLE = 'TEXT_STYLE',
  EFFECT_STYLE = 'EFFECT_STYLE'
}

/**
 * 全局变量分片策略
 * 实现对Figma全局变量数据的分片处理
 */
export class GlobalVarsChunkingStrategy implements ChunkingStrategy {
  /**
   * 对全局变量进行分片
   * @param data 全局变量数据
   * @param context 分片上下文
   * @returns 分片结果
   */
  async chunk(data: any, context: ChunkingContext): Promise<ChunkResult> {
    // 如果数据很小，不需要分片
    if (!this.shouldChunk(data, context)) {
      // 创建单个全局变量分片
      const chunk: Chunk = {
        id: ChunkIdGenerator.generateId(context.fileKey, ChunkType.GLOBAL_VARS, 'all'),
        fileKey: context.fileKey,
        type: ChunkType.GLOBAL_VARS,
        created: new Date(),
        lastAccessed: new Date(),
        data,
        links: []
      };
      
      return createSimpleChunkResult(chunk);
    }
    
    // 需要分片的情况，按变量类型分组
    const variableGroups = this.groupVariablesByType(data);
    
    // 创建类型索引分片（保存变量类型和对应的分片ID）
    const indexData: Record<string, string> = {};
    const chunks: Chunk[] = [];
    const references: string[] = [];
    
    // 处理每种类型的变量
    for (const [type, variables] of Object.entries(variableGroups)) {
      // 跳过空组
      if (!variables || variables.length === 0) {
        continue;
      }
      
      // 检查分组后的大小
      const groupSize = estimateSize(variables);
      
      if (groupSize > context.maxSize) {
        // 如果单个类型组仍然太大，进一步拆分
        const subGroups = this.splitLargeGroup(variables, context.maxSize);
        
        // 为每个子组创建分片
        for (let i = 0; i < subGroups.length; i++) {
          const subGroup = subGroups[i];
          const subChunkId = ChunkIdGenerator.generateId(
            context.fileKey,
            ChunkType.GLOBAL_VARS,
            `${type}-${i}`
          );
          
          // 创建子组分片
          const subChunk: Chunk = {
            id: subChunkId,
            fileKey: context.fileKey,
            type: ChunkType.GLOBAL_VARS,
            created: new Date(),
            lastAccessed: new Date(),
            data: subGroup,
            links: []
          };
          
          // 如果是第一个子组，添加到索引
          if (i === 0) {
            indexData[type] = subChunkId;
          }
          
          chunks.push(subChunk);
          references.push(subChunkId);
        }
      } else {
        // 单个类型组不需要进一步拆分
        const typeChunkId = ChunkIdGenerator.generateId(
          context.fileKey,
          ChunkType.GLOBAL_VARS,
          type
        );
        
        // 创建类型组分片
        const typeChunk: Chunk = {
          id: typeChunkId,
          fileKey: context.fileKey,
          type: ChunkType.GLOBAL_VARS,
          created: new Date(),
          lastAccessed: new Date(),
          data: variables,
          links: []
        };
        
        // 添加到索引
        indexData[type] = typeChunkId;
        
        chunks.push(typeChunk);
        references.push(typeChunkId);
      }
    }
    
    // 创建索引分片
    const indexChunk: Chunk = {
      id: ChunkIdGenerator.generateId(context.fileKey, ChunkType.GLOBAL_VARS, 'index'),
      fileKey: context.fileKey,
      type: ChunkType.GLOBAL_VARS,
      created: new Date(),
      lastAccessed: new Date(),
      data: indexData,
      links: references
    };
    
    chunks.unshift(indexChunk); // 将索引分片放在最前面
    
    return {
      chunks,
      primaryChunkId: indexChunk.id,
      references
    };
  }
  
  /**
   * 判断变量集是否需要分片
   * @param data 变量数据
   * @param context 分片上下文
   * @returns 是否需要分片
   */
  shouldChunk(data: any, context: ChunkingContext): boolean {
    return isOverSize(data, context.maxSize);
  }
  
  /**
   * 获取策略类型
   * @returns 全局变量分片类型
   */
  getType(): ChunkType {
    return ChunkType.GLOBAL_VARS;
  }
  
  /**
   * 按类型分组变量
   * @param data 全局变量数据
   * @returns 按类型分组的变量
   */
  private groupVariablesByType(data: any): Record<string, any[]> {
    const groups: Record<string, any[]> = {};
    
    // 处理JSON对象
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      // 初始化所有变量类型组
      Object.values(VariableType).forEach(type => {
        groups[type] = [];
      });
      
      // 其他未知类型
      groups['OTHER'] = [];
      
      // 遍历变量
      for (const [key, value] of Object.entries(data)) {
        const varType = this.determineVariableType(value);
        groups[varType].push({ key, value });
      }
      
      // 移除空组
      Object.keys(groups).forEach(key => {
        if (groups[key].length === 0) {
          delete groups[key];
        }
      });
      
      return groups;
    }
    
    // 处理数组
    if (Array.isArray(data)) {
      // 初始化所有变量类型组
      Object.values(VariableType).forEach(type => {
        groups[type] = [];
      });
      
      // 其他未知类型
      groups['OTHER'] = [];
      
      // 遍历数组项
      for (const item of data) {
        const varType = this.determineVariableType(item);
        groups[varType].push(item);
      }
      
      // 移除空组
      Object.keys(groups).forEach(key => {
        if (groups[key].length === 0) {
          delete groups[key];
        }
      });
      
      return groups;
    }
    
    // 处理其他情况
    return { 'OTHER': [data] };
  }
  
  /**
   * 确定变量类型
   * @param value 变量值
   * @returns 变量类型
   */
  private determineVariableType(value: any): string {
    if (!value || typeof value !== 'object') {
      return 'OTHER';
    }
    
    if (value.type) {
      // 直接使用显式类型
      const type = value.type.toUpperCase();
      if (Object.values(VariableType).includes(type as VariableType)) {
        return type;
      }
    }
    
    // 根据属性推断类型
    if (value.r !== undefined && value.g !== undefined && value.b !== undefined) {
      return VariableType.COLOR;
    }
    
    if (value.fontFamily || value.fontSize) {
      return VariableType.TEXT_STYLE;
    }
    
    if (value.effects && Array.isArray(value.effects)) {
      return VariableType.EFFECT_STYLE;
    }
    
    // 默认为其他类型
    return 'OTHER';
  }
  
  /**
   * 分割大型变量组
   * 将过大的变量组分割为多个子组
   * @param variables 变量数组
   * @param maxSize 最大分片大小
   * @returns 分割后的子组数组
   */
  private splitLargeGroup(variables: any[], maxSize: number): any[][] {
    const result: any[][] = [];
    let currentGroup: any[] = [];
    let currentSize = 0;
    
    for (const variable of variables) {
      const varSize = estimateSize(variable);
      
      // 如果单个变量超过最大大小，单独放入一组
      if (varSize > maxSize) {
        // 如果当前组不为空，先保存
        if (currentGroup.length > 0) {
          result.push([...currentGroup]);
          currentGroup = [];
          currentSize = 0;
        }
        
        // 单独放入一组
        result.push([variable]);
        continue;
      }
      
      // 如果添加变量后超过最大大小，创建新组
      if (currentSize + varSize > maxSize && currentGroup.length > 0) {
        result.push([...currentGroup]);
        currentGroup = [];
        currentSize = 0;
      }
      
      // 添加到当前组
      currentGroup.push(variable);
      currentSize += varSize;
    }
    
    // 添加最后一组
    if (currentGroup.length > 0) {
      result.push(currentGroup);
    }
    
    return result;
  }
} 