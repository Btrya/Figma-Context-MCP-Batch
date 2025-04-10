/**
 * 元数据分片策略
 * 处理Figma文件元数据
 */

import { ChunkingStrategy } from './chunking-strategy.js';
import { ChunkingContext } from '../chunking-context.js';
import { ChunkResult, createSimpleChunkResult } from '../../../models/chunker/chunk-result.js';
import { Chunk, ChunkType } from '../../storage/models/chunk.js';
import { ChunkIdGenerator } from '../chunk-id-generator.js';
import { estimateSize, isOverSize } from '../../../utils/size-estimator.js';

/**
 * 元数据分片策略
 * 实现对Figma文件元数据的分片处理
 */
export class MetadataChunkingStrategy implements ChunkingStrategy {
  /**
   * 对元数据进行分片
   * 提取关键信息并生成概要
   * @param data 元数据
   * @param context 分片上下文
   * @returns 分片结果
   */
  async chunk(data: any, context: ChunkingContext): Promise<ChunkResult> {
    // 如果元数据很小，不需要分片
    if (!this.shouldChunk(data, context)) {
      // 创建单个元数据分片
      const chunk: Chunk = {
        id: ChunkIdGenerator.generateId(context.fileKey, ChunkType.METADATA, 'main'),
        fileKey: context.fileKey,
        type: ChunkType.METADATA,
        created: new Date(),
        lastAccessed: new Date(),
        data,
        links: []
      };
      
      return createSimpleChunkResult(chunk);
    }
    
    // 需要分片的情况，分离核心元数据和详细信息
    const mainMetadata = this.extractCoreMedadata(data);
    const detailsMetadata = this.extractDetailsMetadata(data);
    
    // 创建主元数据分片
    const mainChunk: Chunk = {
      id: ChunkIdGenerator.generateId(context.fileKey, ChunkType.METADATA, 'main'),
      fileKey: context.fileKey,
      type: ChunkType.METADATA,
      created: new Date(),
      lastAccessed: new Date(),
      data: mainMetadata,
      links: []
    };
    
    // 创建详细元数据分片
    const detailsChunk: Chunk = {
      id: ChunkIdGenerator.generateId(context.fileKey, ChunkType.METADATA, 'details'),
      fileKey: context.fileKey,
      type: ChunkType.METADATA,
      created: new Date(),
      lastAccessed: new Date(),
      data: detailsMetadata,
      links: []
    };
    
    // 添加详细分片的引用
    mainChunk.links.push(detailsChunk.id);
    
    // 如果有结构概要，创建结构概要分片
    const structureSummary = this.extractStructureSummary(data);
    let structureChunk: Chunk | null = null;
    
    if (structureSummary && Object.keys(structureSummary).length > 0) {
      structureChunk = {
        id: ChunkIdGenerator.generateId(context.fileKey, ChunkType.METADATA, 'structure'),
        fileKey: context.fileKey,
        type: ChunkType.METADATA,
        created: new Date(),
        lastAccessed: new Date(),
        data: structureSummary,
        links: []
      };
      
      // 添加结构分片的引用
      mainChunk.links.push(structureChunk.id);
    }
    
    // 构建结果
    const chunks = [mainChunk, detailsChunk];
    if (structureChunk) {
      chunks.push(structureChunk);
    }
    
    return {
      chunks,
      primaryChunkId: mainChunk.id,
      references: mainChunk.links
    };
  }
  
  /**
   * 判断元数据是否需要分片
   * @param data 元数据
   * @param context 分片上下文
   * @returns 是否需要分片
   */
  shouldChunk(data: any, context: ChunkingContext): boolean {
    return isOverSize(data, context.maxSize);
  }
  
  /**
   * 获取策略类型
   * @returns 元数据分片类型
   */
  getType(): ChunkType {
    return ChunkType.METADATA;
  }
  
  /**
   * 提取核心元数据
   * 包含文件基本信息和必要的导航数据
   * @param data 完整元数据
   * @returns 核心元数据
   */
  private extractCoreMedadata(data: any): any {
    // 提取必要的基本信息
    const coreMetadata: any = {
      name: data.name,
      lastModified: data.lastModified,
      version: data.version,
      thumbnailUrl: data.thumbnailUrl,
      schemaVersion: data.schemaVersion,
      documentationLinks: data.documentationLinks || []
    };
    
    // 提取页面列表（只包含基本信息）
    if (data.document && data.document.children) {
      coreMetadata.pages = data.document.children.map((page: any) => ({
        id: page.id,
        name: page.name,
        type: page.type
      }));
    }
    
    // 添加组件库引用（如果有）
    if (data.components) {
      coreMetadata.componentCount = Object.keys(data.components).length;
    }
    
    // 添加样式库引用（如果有）
    if (data.styles) {
      coreMetadata.styleCount = Object.keys(data.styles).length;
    }
    
    return coreMetadata;
  }
  
  /**
   * 提取详细元数据
   * 包含非必要但有用的辅助信息
   * @param data 完整元数据
   * @returns 详细元数据
   */
  private extractDetailsMetadata(data: any): any {
    // 提取次要信息
    const detailsMetadata: any = {
      editorType: data.editorType,
      linkAccess: data.linkAccess,
      createdAt: data.createdAt,
      branches: data.branches || []
    };
    
    // 添加组件详细信息
    if (data.components) {
      detailsMetadata.components = data.components;
    }
    
    // 添加样式详细信息
    if (data.styles) {
      detailsMetadata.styles = data.styles;
    }
    
    // 其他辅助信息
    if (data.users) {
      detailsMetadata.users = data.users;
    }
    
    if (data.lastUser) {
      detailsMetadata.lastUser = data.lastUser;
    }
    
    return detailsMetadata;
  }
  
  /**
   * 提取文件结构概要
   * 生成文件结构的轻量级概要信息
   * @param data 完整元数据
   * @returns 结构概要
   */
  private extractStructureSummary(data: any): any {
    const summary: any = {};
    
    // 如果没有文档数据，返回空概要
    if (!data.document) {
      return summary;
    }
    
    // 提取文档结构骨架
    if (data.document.children) {
      summary.pages = data.document.children.map((page: any) => {
        return this.simplifyNodeInfo(page);
      });
    }
    
    return summary;
  }
  
  /**
   * 简化节点信息
   * 递归地提取节点的基本结构信息
   * @param node 节点数据
   * @returns 简化后的节点信息
   */
  private simplifyNodeInfo(node: any): any {
    // 基本节点信息
    const info: any = {
      id: node.id,
      name: node.name,
      type: node.type
    };
    
    // 处理子节点（递归，但限制深度）
    if (node.children && node.children.length > 0) {
      // 仅处理前10个子节点，避免过大
      const childrenToProcess = node.children.slice(0, 10);
      info.children = childrenToProcess.map((child: any) => 
        this.simplifyNodeInfo(child)
      );
      
      // 如果有更多子节点，添加计数
      if (node.children.length > 10) {
        info.childrenCount = node.children.length;
      }
    }
    
    return info;
  }
} 