/**
 * 存储管理器
 * 管理多个存储适配器，提供统一的存储接口
 */

import { StorageAdapter } from './adapters/storage-adapter.js';
import { FileSystemAdapter } from './adapters/file-system-adapter.js';
import { Chunk, ChunkSummary } from './models/chunk.js';
import { ChunkFilter } from './models/chunk-filter.js';
import { 
  StorageManagerConfig, 
  DEFAULT_STORAGE_MANAGER_CONFIG,
  mergeWithDefaultConfig 
} from '../../config/storage-config.js';

/**
 * 存储管理器类
 * 管理多个存储适配器，提供统一的存储接口
 */
export class StorageManager {
  private adapters: Map<string, StorageAdapter> = new Map();
  private config: StorageManagerConfig;
  
  /**
   * 构造函数
   * @param config 存储管理器配置
   */
  constructor(config?: Partial<StorageManagerConfig>) {
    this.config = mergeWithDefaultConfig(config);
    
    // 注册默认的文件系统适配器
    if (this.config.fileSystem) {
      this.registerAdapter('fileSystem', new FileSystemAdapter(this.config.fileSystem));
    }
  }
  
  /**
   * 注册存储适配器
   * @param name 适配器名称
   * @param adapter 适配器实例
   */
  public registerAdapter(name: string, adapter: StorageAdapter): void {
    this.adapters.set(name, adapter);
  }
  
  /**
   * 获取存储适配器
   * @param name 适配器名称，不提供则使用默认适配器
   * @returns StorageAdapter 存储适配器实例
   * @throws Error 如果适配器不存在
   */
  public getAdapter(name?: string): StorageAdapter {
    const adapterName = name || this.config.defaultAdapter;
    const adapter = this.adapters.get(adapterName);
    
    if (!adapter) {
      throw new Error(`Storage adapter "${adapterName}" not found`);
    }
    
    return adapter;
  }
  
  /**
   * 存储分片数据
   * @param chunk 要存储的分片数据
   * @param adapter 可选的适配器名称
   * @returns Promise<void>
   */
  public async saveChunk(chunk: Chunk, adapter?: string): Promise<void> {
    return this.getAdapter(adapter).saveChunk(chunk);
  }
  
  /**
   * 获取分片数据
   * @param id 分片ID
   * @param adapter 可选的适配器名称
   * @returns Promise<Chunk | null> 返回分片数据，不存在时返回null
   */
  public async getChunk(id: string, adapter?: string): Promise<Chunk | null> {
    return this.getAdapter(adapter).getChunk(id);
  }
  
  /**
   * 检查分片是否存在
   * @param id 分片ID
   * @param adapter 可选的适配器名称
   * @returns Promise<boolean> 分片存在返回true，否则返回false
   */
  public async hasChunk(id: string, adapter?: string): Promise<boolean> {
    return this.getAdapter(adapter).hasChunk(id);
  }
  
  /**
   * 删除分片
   * @param id 分片ID
   * @param adapter 可选的适配器名称
   * @returns Promise<boolean> 删除成功返回true，不存在或删除失败返回false
   */
  public async deleteChunk(id: string, adapter?: string): Promise<boolean> {
    return this.getAdapter(adapter).deleteChunk(id);
  }
  
  /**
   * 列出所有分片
   * @param filter 可选的过滤条件
   * @param adapter 可选的适配器名称
   * @returns Promise<ChunkSummary[]> 返回符合条件的分片摘要列表
   */
  public async listChunks(filter?: ChunkFilter, adapter?: string): Promise<ChunkSummary[]> {
    return this.getAdapter(adapter).listChunks(filter);
  }
  
  /**
   * 清理过期数据
   * 删除所有已过期的分片数据
   * @param adapter 可选的适配器名称
   * @returns Promise<void>
   */
  public async cleanup(adapter?: string): Promise<void> {
    return this.getAdapter(adapter).cleanup();
  }
  
  /**
   * 执行所有适配器的清理操作
   * @returns Promise<void>
   */
  public async cleanupAll(): Promise<void> {
    const promises: Promise<void>[] = [];
    
    for (const adapter of this.adapters.values()) {
      promises.push(adapter.cleanup());
    }
    
    await Promise.all(promises);
  }
  
  /**
   * 释放资源
   * 关闭和清理所有适配器
   */
  public dispose(): void {
    for (const adapter of this.adapters.values()) {
      if (adapter instanceof FileSystemAdapter) {
        adapter.dispose();
      }
      // 当添加其他适配器类型时，在这里添加相应的处理
    }
    
    this.adapters.clear();
  }
} 