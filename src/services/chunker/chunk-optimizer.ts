/**
 * 分片优化器
 * 优化分片大小和内容，提供压缩、分割和合并功能
 */

import { Chunk, ChunkType } from '../storage/models/chunk.js';
import { ChunkIdGenerator } from './chunk-id-generator.js';
import { estimateSize } from '../../utils/size-estimator.js';

/**
 * 优化级别
 * - NONE: 不进行优化
 * - LOW: 低级优化，仅进行基本处理
 * - MEDIUM: 中级优化，平衡性能和优化效果
 * - HIGH: 高级优化，最大程度优化但可能较慢
 */
export enum OptimizationLevel {
  NONE = 0,
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3
}

/**
 * 分片优化器类
 * 提供各种优化分片的方法
 */
export class ChunkOptimizer {
  // 最大分片大小（字节）
  private maxSize: number;
  
  /**
   * 构造函数
   * @param maxSize 最大分片大小（字节），默认为30KB
   */
  constructor(maxSize: number = 30 * 1024) {
    this.maxSize = maxSize;
  }
  
  /**
   * 优化分片
   * @param chunk 要优化的分片
   * @param level 优化级别
   * @returns 优化后的分片
   */
  public optimize(chunk: Chunk, level: OptimizationLevel = OptimizationLevel.MEDIUM): Chunk {
    // 创建原始chunk的深拷贝
    const chunkCopy = {
      ...chunk,
      data: JSON.parse(JSON.stringify(chunk.data))
    };
    
    // 检查是否需要优化
    const size = estimateSize(chunkCopy.data);
    if (size <= this.maxSize && level === OptimizationLevel.NONE) {
      // 即使不需要优化，也返回一个浅拷贝以保持一致性
      return chunkCopy;
    }
    
    // 根据优化级别选择不同策略
    switch (level) {
      case OptimizationLevel.NONE:
        // 即使在NONE级别，也返回新对象以保持一致性
        return chunkCopy;
        
      case OptimizationLevel.LOW:
        // 基本优化：移除不必要的属性
        return this.basicOptimize(chunkCopy);
        
      case OptimizationLevel.MEDIUM:
        // 中级优化：执行更严格的数据精简
        return this.mediumOptimize(chunkCopy);
        
      case OptimizationLevel.HIGH:
        // 高级优化：执行最严格的数据精简
        // 先执行中级优化
        const mediumOptimized = this.mediumOptimize(chunkCopy);
        
        // 然后移除所有以下划线开头的属性
        const removeUnderscoreProps = (obj: any): any => {
          if (obj === null || typeof obj !== 'object') {
            return obj;
          }
          
          if (Array.isArray(obj)) {
            return obj.map(item => removeUnderscoreProps(item));
          }
          
          const result: any = {};
          for (const [key, value] of Object.entries(obj)) {
            if (!key.startsWith('_')) {
              result[key] = removeUnderscoreProps(value);
            }
          }
          return result;
        };
        
        return {
          ...mediumOptimized,
          data: removeUnderscoreProps(mediumOptimized.data)
        };
        
      default:
        throw new Error(`未知的优化级别: ${level}`);
    }
  }
  
  /**
   * 基本优化
   * 移除不必要的属性以减小数据大小
   * @param chunk 要优化的分片
   * @returns 优化后的分片
   */
  private basicOptimize(chunk: Chunk): Chunk {
    // 创建原始chunk的深拷贝
    const chunkCopy = {
      ...chunk,
      data: JSON.parse(JSON.stringify(chunk.data))
    };
    
    // 确保数据是对象
    if (chunkCopy.data && typeof chunkCopy.data === 'object') {
      // 直接删除不必要的属性
      delete chunkCopy.data._internal;
      delete chunkCopy.data.thumbnailUrl;
      delete chunkCopy.data.documentationLinks;
      delete chunkCopy.data.editorType;
    }
    
    // 深度处理所有嵌套对象
    const optimizedData = this.removeUnnecessaryProperties(chunkCopy.data);
    
    // 创建新的分片
    return {
      ...chunkCopy,
      data: optimizedData
    };
  }
  
  /**
   * 移除不必要的属性
   * @param data 要处理的数据
   * @returns 处理后的数据
   */
  private removeUnnecessaryProperties(data: any): any {
    if (data === null || typeof data !== 'object') {
      return data;
    }
    
    // 数组处理
    if (Array.isArray(data)) {
      return data.map(item => this.removeUnnecessaryProperties(item));
    }
    
    // 对象处理
    const result: any = {};
    
    // 保留必要属性
    for (const [key, value] of Object.entries(data)) {
      // 跳过空值和可能不必要的属性
      if (
        value === null || 
        value === undefined ||
        key.startsWith('_') || // 跳过内部属性
        key === 'documentationLinks' || // 不重要的文档链接
        key === 'editorType' || // 编辑器类型通常不重要
        key === 'thumbnailUrl' // 缩略图URL可能很长
      ) {
        continue;
      }
      
      // 递归处理嵌套对象
      result[key] = this.removeUnnecessaryProperties(value);
    }
    
    return result;
  }
  
  /**
   * 压缩分片
   * 使用数据压缩技术减小分片大小
   * @param chunk 要压缩的分片
   * @returns 压缩后的分片
   */
  public compress(chunk: Chunk): Chunk {
    // 创建原始chunk的深拷贝
    const chunkCopy = {
      ...chunk,
      data: JSON.parse(JSON.stringify(chunk.data))
    };
    
    // 根据分片类型进行不同的压缩策略
    let compressedData: any;
    
    switch (chunkCopy.type) {
      case ChunkType.NODE:
        compressedData = this.compressNodeData(chunkCopy.data);
        break;
      
      case ChunkType.METADATA:
        compressedData = this.compressMetadataData(chunkCopy.data);
        break;
      
      case ChunkType.GLOBAL_VARS:
        compressedData = this.compressGlobalVarsData(chunkCopy.data);
        break;
      
      default:
        compressedData = this.removeUnnecessaryProperties(chunkCopy.data);
    }
    
    // 创建新的压缩分片
    return {
      ...chunkCopy,
      data: compressedData
    };
  }
  
  /**
   * 解压分片
   * 将压缩的分片数据还原
   * @param chunk 要解压的分片
   * @returns 解压后的分片
   */
  public decompress(chunk: Chunk): Chunk {
    // 实际实现中，这里应该是压缩算法的反向操作
    // 由于示例中没有真正的压缩，所以直接返回原分片
    return {...chunk}; // 创建副本
  }
  
  /**
   * 将分片拆分为多个较小的分片
   * @param chunk 要拆分的分片
   * @param maxSize 每个分片的最大大小
   * @returns 拆分后的分片数组
   */
  public split(chunk: Chunk, maxSize: number): Chunk[] {
    // 检查是否需要拆分
    const size = estimateSize(chunk.data);
    if (size <= maxSize) {
      // 即使不需要拆分，也返回包含副本的数组，以保持一致性
      return [{ ...chunk, data: JSON.parse(JSON.stringify(chunk.data)) }];
    }
    
    // 创建原始chunk的深拷贝
    const chunkCopy = {
      ...chunk,
      data: JSON.parse(JSON.stringify(chunk.data))
    };
    
    // 根据分片类型选择不同的拆分策略
    switch (chunkCopy.type) {
      case ChunkType.NODE:
        return this.splitNodeChunk(chunkCopy, maxSize);
      
      case ChunkType.METADATA:
        return this.splitMetadataChunk(chunkCopy, maxSize);
      
      case ChunkType.GLOBAL_VARS:
        return this.splitGlobalVarsChunk(chunkCopy, maxSize);
      
      default:
        // 默认按通用方法拆分
        return this.splitGenericChunk(chunkCopy, maxSize);
    }
  }
  
  /**
   * 合并多个分片为一个
   * @param chunks 要合并的分片数组
   * @returns 合并后的分片
   */
  public merge(chunks: Chunk[]): Chunk {
    if (chunks.length === 0) {
      throw new Error('Cannot merge empty chunks array');
    }
    
    if (chunks.length === 1) {
      // 返回深拷贝以保持一致性
      const chunk = chunks[0];
      return {
        ...chunk,
        data: JSON.parse(JSON.stringify(chunk.data))
      };
    }
    
    // 以第一个分片为基础
    const baseChunk = chunks[0];
    const fileKey = baseChunk.fileKey;
    const type = baseChunk.type;
    
    // 合并数据
    let mergedData: any;
    
    // 根据类型选择不同的合并策略
    switch (type) {
      case ChunkType.NODE:
        mergedData = this.mergeNodeData(chunks);
        break;
      
      case ChunkType.METADATA:
        mergedData = this.mergeMetadataData(chunks);
        break;
      
      case ChunkType.GLOBAL_VARS:
        mergedData = this.mergeGlobalVarsData(chunks);
        break;
      
      default:
        // 默认合并策略
        mergedData = this.mergeGenericData(chunks);
    }
    
    // 创建合并后的分片
    return {
      id: baseChunk.id,
      fileKey,
      type,
      created: new Date(),
      lastAccessed: new Date(),
      data: mergedData,
      links: []
    };
  }
  
  // 以下是各种类型数据的压缩方法
  
  /**
   * 压缩节点数据
   * @param data 节点数据
   * @returns 压缩后的数据
   */
  private compressNodeData(data: any): any {
    if (!data) return data;
    
    // 创建一个更小的数据副本
    const compressed: any = {};
    
    // 保留必要的属性
    const essentialProps = [
      'id', 'type', 'name', 'x', 'y', 'width', 'height',
      'fills', 'strokes', 'cornerRadius', 'blendMode'
    ];
    
    // 只保留必要属性，忽略其他所有属性
    for (const prop of essentialProps) {
      if (data[prop] !== undefined) {
        compressed[prop] = data[prop];
      }
    }
    
    // 如果有子节点，添加一个空数组作为占位符
    if (data.children) {
      compressed.children = [];
    }
    
    return compressed;
  }
  
  /**
   * 压缩元数据数据
   * @param data 元数据数据
   * @returns 压缩后的数据
   */
  private compressMetadataData(data: any): any {
    if (!data) return data;
    
    // 创建一个更小的数据副本
    const compressed: any = {};
    
    // 保留核心元数据
    const essentialProps = [
      'name', 'version', 'schemaVersion', 'lastModified'
    ];
    
    // 复制必要属性
    for (const prop of essentialProps) {
      if (data[prop] !== undefined) {
        compressed[prop] = data[prop];
      }
    }
    
    // 简化组件和样式信息
    if (data.components) {
      compressed.components = {};
      for (const [id, component] of Object.entries(data.components)) {
        compressed.components[id] = { name: (component as any).name };
      }
    }
    
    if (data.styles) {
      compressed.styles = {};
      for (const [id, style] of Object.entries(data.styles)) {
        compressed.styles[id] = { name: (style as any).name };
      }
    }
    
    return compressed;
  }
  
  /**
   * 压缩全局变量数据
   * @param data 全局变量数据
   * @returns 压缩后的数据
   */
  private compressGlobalVarsData(data: any): any {
    if (!data || !data.variables) return data;
    
    // 创建一个更小的数据副本
    const compressed: any = {
      variables: {}
    };
    
    // 压缩每个变量
    for (const [id, variable] of Object.entries(data.variables)) {
      compressed.variables[id] = {
        name: (variable as any).name,
        type: (variable as any).type
      };
      
      // 保留值类型信息，但可能简化值内容
      if ((variable as any).valuesByMode) {
        compressed.variables[id].valuesByMode = (variable as any).valuesByMode;
      }
    }
    
    return compressed;
  }
  
  /**
   * 拆分节点分片
   * 将大型节点分片拆分为父节点和子节点
   * @param chunk 要拆分的节点分片
   * @param maxSize 每个分片的最大大小
   * @returns 拆分后的分片数组
   */
  private splitNodeChunk(chunk: Chunk, maxSize: number): Chunk[] {
    // 准备结果数组，第一个是父节点
    const result: Chunk[] = [{
      ...chunk,
      data: { ...chunk.data },
      links: [] // 清空链接，后面会添加
    }];
    
    // 如果没有子节点或已经足够小，直接返回
    if (!chunk.data.children || !Array.isArray(chunk.data.children) || chunk.data.children.length === 0) {
      return result;
    }
    
    // 为子节点创建单独的分片
    const children = [...chunk.data.children]; // 复制子节点数组
    result[0].data.children = []; // 清空父节点的子节点
    
    // 为每个子节点创建分片
    for (let i = 0; i < children.length; i++) {
      const childData = children[i];
      const childId = `${chunk.id}-child-${i}`;
      
      // 创建子节点分片
      const childChunk: Chunk = {
        id: childId,
        fileKey: chunk.fileKey,
        type: ChunkType.NODE,
        created: new Date(),
        lastAccessed: new Date(),
        data: childData,
        links: []
      };
      
      // 添加子节点分片ID到父节点的链接中
      result[0].links.push(childId);
      
      // 添加子节点分片到结果数组
      result.push(childChunk);
    }
    
    return result;
  }
  
  /**
   * 拆分元数据分片
   * 将大型元数据分片拆分为核心和附加信息
   * @param chunk 要拆分的元数据分片
   * @param maxSize 每个分片的最大大小
   * @returns 拆分后的分片数组
   */
  private splitMetadataChunk(chunk: Chunk, maxSize: number): Chunk[] {
    // 创建元数据部分
    type MetadataPart = {
      name: string;
      data: any;
      estimatedSize: number;
    };
    
    // 准备分解后的数据部分
    const parts: MetadataPart[] = [];
    
    // 核心元数据（必须保留在主分片中）
    const coreData: any = {
      name: chunk.data.name,
      version: chunk.data.version,
      schemaVersion: chunk.data.schemaVersion,
      lastModified: chunk.data.lastModified
    };
    parts.push({
      name: 'core',
      data: coreData,
      estimatedSize: estimateSize(coreData)
    });
    
    // 可拆分的数据部分
    const splittableParts: [string, any][] = [
      ['components', chunk.data.components],
      ['styles', chunk.data.styles],
      ['documentationLinks', chunk.data.documentationLinks],
      ['branches', chunk.data.branches]
    ];
    
    // 对每个部分检查大小并添加到拆分列表
    for (const [name, data] of splittableParts) {
      if (data) {
        const partData = { [name]: data };
        parts.push({
          name,
          data: partData,
          estimatedSize: estimateSize(partData)
        });
      }
    }
    
    // 准备结果数组，第一个是主分片
    const result: Chunk[] = [{
      ...chunk,
      data: coreData,
      links: [] // 清空链接，后面会添加
    }];
    
    // 添加其他部分作为单独的分片
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i];
      const partId = `${chunk.id}-part-${part.name}`;
      
      // 创建部分分片
      const partChunk: Chunk = {
        id: partId,
        fileKey: chunk.fileKey,
        type: ChunkType.METADATA,
        created: new Date(),
        lastAccessed: new Date(),
        data: part.data,
        links: []
      };
      
      // 添加部分分片ID到主分片的链接中
      result[0].links.push(partId);
      
      // 添加部分分片到结果数组
      result.push(partChunk);
    }
    
    return result;
  }
  
  /**
   * 拆分全局变量分片
   * 将大型全局变量分片拆分为多个较小部分
   * @param chunk 要拆分的全局变量分片
   * @param maxSize 每个分片的最大大小
   * @returns 拆分后的分片数组
   */
  private splitGlobalVarsChunk(chunk: Chunk, maxSize: number): Chunk[] {
    // 如果没有变量或变量不是对象，直接返回
    if (!chunk.data.variables || typeof chunk.data.variables !== 'object') {
      return [chunk];
    }
    
    // 准备结果数组，第一个是主分片
    const result: Chunk[] = [{
      ...chunk,
      data: { variables: {} }, // 清空变量，后面会按需添加
      links: [] // 清空链接，后面会添加
    }];
    
    // 获取所有变量项
    const variables = chunk.data.variables;
    const variableIds = Object.keys(variables);
    
    // 如果变量数量少，可能不需要拆分
    if (variableIds.length <= 10) {
      return [chunk];
    }
    
    // 变量分组大小（每组最多50个变量）
    const groupSize = 50;
    
    // 按组拆分变量
    for (let i = 0; i < variableIds.length; i += groupSize) {
      const groupIds = variableIds.slice(i, i + groupSize);
      const groupVariables: any = {};
      
      // 复制该组中的所有变量
      for (const id of groupIds) {
        groupVariables[id] = variables[id];
      }
      
      // 为这组变量创建分片
      const groupId = `${chunk.id}-vars-${i / groupSize}`;
      const groupChunk: Chunk = {
        id: groupId,
        fileKey: chunk.fileKey,
        type: ChunkType.GLOBAL_VARS,
        created: new Date(),
        lastAccessed: new Date(),
        data: { variables: groupVariables },
        links: []
      };
      
      // 添加组分片ID到主分片的链接中
      result[0].links.push(groupId);
      
      // 添加组分片到结果数组
      result.push(groupChunk);
    }
    
    return result;
  }
  
  /**
   * 拆分通用分片
   * 简单地将数据分成多个较小部分
   * @param chunk 要拆分的分片
   * @param maxSize 每个分片的最大大小
   * @returns 拆分后的分片数组
   */
  private splitGenericChunk(chunk: Chunk, maxSize: number): Chunk[] {
    // 这里只返回原始分片，因为通用拆分较复杂且需要具体数据结构信息
    return [chunk];
  }
  
  /**
   * 合并节点数据
   * @param chunks 要合并的节点分片数组
   * @returns 合并后的节点数据
   */
  private mergeNodeData(chunks: Chunk[]): any {
    if (chunks.length === 0) return null;
    
    // 获取父节点数据
    const parentChunk = chunks[0];
    const parentData = { ...parentChunk.data };
    
    // 建立ID到分片的映射
    const chunkMap = new Map<string, Chunk>();
    for (const chunk of chunks) {
      chunkMap.set(chunk.id, chunk);
    }
    
    // 如果父节点有链接，将链接的子节点数据添加到children数组
    if (parentChunk.links && parentChunk.links.length > 0) {
      parentData.children = parentData.children || [];
      
      // 将链接的子节点数据添加到children数组
      for (const childId of parentChunk.links) {
        const childChunk = chunkMap.get(childId);
        if (childChunk) {
          parentData.children.push(childChunk.data);
        }
      }
    }
    
    return parentData;
  }
  
  /**
   * 合并元数据数据
   * @param chunks 要合并的元数据分片数组
   * @returns 合并后的元数据数据
   */
  private mergeMetadataData(chunks: Chunk[]): any {
    if (chunks.length === 0) return null;
    
    // 获取核心元数据数据
    const coreChunk = chunks[0];
    const mergedData = { ...coreChunk.data };
    
    // 建立ID到分片的映射
    const chunkMap = new Map<string, Chunk>();
    for (const chunk of chunks) {
      chunkMap.set(chunk.id, chunk);
    }
    
    // 合并链接的部分数据
    if (coreChunk.links && coreChunk.links.length > 0) {
      for (const partId of coreChunk.links) {
        const partChunk = chunkMap.get(partId);
        if (partChunk) {
          // 合并每个部分的数据
          Object.assign(mergedData, partChunk.data);
        }
      }
    }
    
    return mergedData;
  }
  
  /**
   * 合并全局变量数据
   * @param chunks 要合并的全局变量分片数组
   * @returns 合并后的全局变量数据
   */
  private mergeGlobalVarsData(chunks: Chunk[]): any {
    if (chunks.length === 0) return null;
    
    // 获取主分片数据
    const mainChunk = chunks[0];
    const mergedData = {
      variables: { ...mainChunk.data.variables }
    };
    
    // 建立ID到分片的映射
    const chunkMap = new Map<string, Chunk>();
    for (const chunk of chunks) {
      chunkMap.set(chunk.id, chunk);
    }
    
    // 合并链接的变量组
    if (mainChunk.links && mainChunk.links.length > 0) {
      for (const groupId of mainChunk.links) {
        const groupChunk = chunkMap.get(groupId);
        if (groupChunk && groupChunk.data.variables) {
          // 合并变量
          Object.assign(mergedData.variables, groupChunk.data.variables);
        }
      }
    }
    
    return mergedData;
  }
  
  /**
   * 合并通用数据
   * @param chunks 要合并的通用分片数组
   * @returns 合并后的通用数据
   */
  private mergeGenericData(chunks: Chunk[]): any {
    if (chunks.length === 0) return null;
    
    // 简单地返回第一个分片的数据
    return chunks[0].data;
  }

  /**
   * 中级优化
   * 执行更严格的数据精简
   * @param chunk 要优化的分片
   * @returns 优化后的分片
   */
  private mediumOptimize(chunk: Chunk): Chunk {
    const chunkCopy = {
      ...chunk,
      data: JSON.parse(JSON.stringify(chunk.data))
    };
    
    if (chunkCopy.type === ChunkType.NODE) {
      // 对节点数据进行特殊处理
      chunkCopy.data = this.compressNodeData(chunkCopy.data);
    } else if (chunkCopy.type === ChunkType.METADATA) {
      // 对元数据进行特殊处理
      chunkCopy.data = this.compressMetadataData(chunkCopy.data);
    } else if (chunkCopy.type === ChunkType.GLOBAL_VARS) {
      // 对全局变量进行特殊处理
      chunkCopy.data = this.compressGlobalVarsData(chunkCopy.data);
    } else {
      // 默认处理
      chunkCopy.data = this.removeUnnecessaryProperties(chunkCopy.data);
    }
    
    return chunkCopy;
  }
} 