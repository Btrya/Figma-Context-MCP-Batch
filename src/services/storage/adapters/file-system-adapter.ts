/**
 * 文件系统存储适配器
 * 提供基于文件系统的分片数据存储功能
 */

import path from 'path';
import fs from 'fs';
import { promisify } from 'util';
import { StorageAdapter } from './storage-adapter.js';
import { Chunk, ChunkSummary, ChunkType } from '../models/chunk.js';
import { ChunkFilter, mergeWithDefaultFilter } from '../models/chunk-filter.js';
import { FileSystemAdapterConfig } from '../../../config/storage-config.js';
import {
  ensureDirectoryExists,
  safeWriteFile,
  safeReadFile,
  generateHashName,
  getAllFiles,
  acquireLock,
  releaseLock
} from '../../../utils/file-utils.js';

// 将回调式API转换为Promise式API
const unlink = promisify(fs.unlink);
const readdir = promisify(fs.readdir);
const stat = promisify(fs.stat);

/**
 * 文件系统存储适配器实现
 * 使用文件系统存储分片数据
 */
export class FileSystemAdapter implements StorageAdapter {
  private config: FileSystemAdapterConfig;
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * 构造函数
   * @param config 文件系统适配器配置
   */
  constructor(config: FileSystemAdapterConfig) {
    this.config = config;
    
    // 确保基础目录存在
    ensureDirectoryExists(this.config.basePath).catch(error => {
      console.error('Failed to create base directory:', error);
    });
    
    // 如果配置了启动时清理，执行清理
    if (this.config.cleanupOnStart) {
      this.cleanup().catch(error => {
        console.error('Failed to cleanup on start:', error);
      });
    }
    
    // 如果配置了清理间隔，设置定时器
    if (this.config.cleanupInterval && this.config.cleanupInterval > 0) {
      this.cleanupInterval = setInterval(() => {
        this.cleanup().catch(error => {
          console.error('Failed to cleanup:', error);
        });
      }, this.config.cleanupInterval);
      
      // 确保Node.js进程可以正常退出
      this.cleanupInterval.unref();
    }
  }

  /**
   * 释放资源
   * 清理定时器和其他资源
   */
  public dispose(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
  }

  /**
   * 获取分片的文件路径
   * @param id 分片ID
   * @returns 文件路径
   */
  private getChunkPath(id: string): string {
    // 使用哈希算法生成安全的文件名
    const hashedId = generateHashName(id, this.config.hashAlgorithm);
    
    // 根据分片ID的前两个字符创建子目录，避免单个目录中文件过多
    const subDir = hashedId.substring(0, 2);
    
    return path.join(this.config.basePath, subDir, `${hashedId}.json`);
  }

  /**
   * 获取文件锁路径
   * @param id 分片ID
   * @returns 锁文件路径
   */
  private getLockPath(id: string): string {
    return `${this.getChunkPath(id)}.lock`;
  }

  /**
   * 序列化分片数据
   * 特殊处理Date类型，确保正确序列化
   * 
   * @param chunk 分片数据
   * @returns 序列化后的JSON字符串
   */
  private serializeChunk(chunk: Chunk): string {
    return JSON.stringify(chunk, (key, value) => {
      // 将Date对象转换为ISO字符串并添加特殊标记
      if (value instanceof Date) {
        return { __date: true, value: value.toISOString() };
      }
      return value;
    });
  }

  /**
   * 反序列化分片数据
   * 将JSON字符串转换为Chunk对象，处理Date类型
   * 
   * @param data JSON字符串
   * @returns 分片数据对象
   */
  private deserializeChunk(data: string): Chunk {
    return JSON.parse(data, (key, value) => {
      // 检测并还原Date对象
      if (value && typeof value === 'object' && value.__date === true) {
        return new Date(value.value);
      }
      return value;
    });
  }

  /**
   * 计算分片大小
   * @param chunk 分片数据
   * @returns 大小（字节）
   */
  private getChunkSize(chunk: Chunk): number {
    return Buffer.byteLength(this.serializeChunk(chunk));
  }

  /**
   * 检查分片是否过期
   * @param chunk 分片数据
   * @returns 是否过期
   */
  private isExpired(chunk: Chunk): boolean {
    return chunk.expires ? new Date() > chunk.expires : false;
  }

  /**
   * 使用锁执行操作
   * 获取锁，执行操作，释放锁
   * 
   * @param id 分片ID
   * @param operation 要执行的操作
   * @returns 操作结果
   */
  private async withLock<T>(id: string, operation: () => Promise<T>): Promise<T> {
    if (!this.config.useLocks) {
      return operation();
    }
    
    const lockPath = this.getLockPath(id);
    
    try {
      // 尝试获取锁
      const acquired = await acquireLock(lockPath, this.config.lockTimeout);
      
      if (!acquired) {
        throw new Error(`Failed to acquire lock for ${id}`);
      }
      
      try {
        // 执行操作
        return await operation();
      } finally {
        // 释放锁
        await releaseLock(lockPath);
      }
    } catch (error) {
      // 如果获取锁失败，尝试不使用锁执行操作
      console.warn(`Lock acquisition failed for ${id}, proceeding without lock:`, error);
      return operation();
    }
  }

  // StorageAdapter接口实现

  /**
   * 存储分片数据
   * @param chunk 要存储的分片数据
   * @returns Promise<void>
   */
  public async saveChunk(chunk: Chunk): Promise<void> {
    return this.withLock(chunk.id, async () => {
      const filePath = this.getChunkPath(chunk.id);
      const serialized = this.serializeChunk(chunk);
      
      await safeWriteFile(filePath, serialized);
    });
  }

  /**
   * 获取分片数据
   * @param id 分片ID
   * @returns Promise<Chunk | null> 返回分片数据，不存在时返回null
   */
  public async getChunk(id: string): Promise<Chunk | null> {
    return this.withLock(id, async () => {
      const filePath = this.getChunkPath(id);
      const data = await safeReadFile(filePath);
      
      if (!data) {
        return null;
      }
      
      try {
        const chunk = this.deserializeChunk(data.toString('utf-8'));
        
        // 检查分片是否过期
        if (this.isExpired(chunk)) {
          // 过期则删除并返回null
          await unlink(filePath).catch(() => {
            // 忽略删除失败的错误
          });
          return null;
        }
        
        // 更新最后访问时间
        chunk.lastAccessed = new Date();
        await this.saveChunk(chunk);
        
        return chunk;
      } catch (error) {
        console.error(`Failed to deserialize chunk ${id}:`, error);
        return null;
      }
    });
  }

  /**
   * 检查分片是否存在
   * @param id 分片ID
   * @returns Promise<boolean> 分片存在返回true，否则返回false
   */
  public async hasChunk(id: string): Promise<boolean> {
    const filePath = this.getChunkPath(id);
    
    try {
      const stats = await stat(filePath);
      return stats.isFile();
    } catch (error) {
      return false;
    }
  }

  /**
   * 删除分片
   * @param id 分片ID
   * @returns Promise<boolean> 删除成功返回true，不存在或删除失败返回false
   */
  public async deleteChunk(id: string): Promise<boolean> {
    return this.withLock(id, async () => {
      const filePath = this.getChunkPath(id);
      
      try {
        await unlink(filePath);
        return true;
      } catch (error) {
        return false;
      }
    });
  }

  /**
   * 列出所有分片
   * @param filter 可选的过滤条件
   * @returns Promise<ChunkSummary[]> 返回符合条件的分片摘要列表
   */
  public async listChunks(filter?: ChunkFilter): Promise<ChunkSummary[]> {
    const mergedFilter = mergeWithDefaultFilter(filter);
    const result: ChunkSummary[] = [];
    
    try {
      // 获取所有JSON文件
      const files = await getAllFiles(this.config.basePath);
      const jsonFiles = files.filter(file => file.endsWith('.json') && !file.endsWith('.lock'));
      
      for (const file of jsonFiles) {
        try {
          const data = await safeReadFile(file);
          
          if (!data) {
            continue;
          }
          
          const chunk = this.deserializeChunk(data.toString('utf-8'));
          
          // 应用过滤条件
          if (
            (mergedFilter.fileKey && chunk.fileKey !== mergedFilter.fileKey) ||
            (mergedFilter.type && chunk.type !== mergedFilter.type) ||
            (mergedFilter.olderThan && chunk.created >= mergedFilter.olderThan) ||
            (mergedFilter.newerThan && chunk.created <= mergedFilter.newerThan) ||
            (!mergedFilter.includeExpired && this.isExpired(chunk))
          ) {
            continue;
          }
          
          // 创建摘要
          const summary: ChunkSummary = {
            id: chunk.id,
            fileKey: chunk.fileKey,
            type: chunk.type,
            created: chunk.created,
            size: this.getChunkSize(chunk)
          };
          
          result.push(summary);
        } catch (error) {
          // 忽略单个文件的错误，继续处理其他文件
          console.warn(`Failed to process chunk file ${file}:`, error);
        }
      }
      
      // 应用排序
      if (mergedFilter.sortBy) {
        result.sort((a, b) => {
          // 确保只使用ChunkSummary中存在的字段进行排序
          if (mergedFilter.sortBy === 'created') {
            if (mergedFilter.sortDirection === 'asc') {
              return a.created.getTime() - b.created.getTime();
            } else {
              return b.created.getTime() - a.created.getTime();
            }
          } else if (mergedFilter.sortBy === 'size') {
            if (mergedFilter.sortDirection === 'asc') {
              return a.size - b.size;
            } else {
              return b.size - a.size;
            }
          }
          // 默认按ID排序
          return a.id.localeCompare(b.id);
        });
      }
      
      // 应用限制
      if (mergedFilter.limit && mergedFilter.limit > 0) {
        return result.slice(0, mergedFilter.limit);
      }
      
      return result;
    } catch (error) {
      console.error('Failed to list chunks:', error);
      return [];
    }
  }

  /**
   * 清理过期数据
   * 删除所有已过期的分片数据
   * @returns Promise<void>
   */
  public async cleanup(): Promise<void> {
    try {
      // 获取所有JSON文件
      const files = await getAllFiles(this.config.basePath);
      const jsonFiles = files.filter(file => file.endsWith('.json') && !file.endsWith('.lock'));
      
      let expiredCount = 0;
      
      for (const file of jsonFiles) {
        try {
          const data = await safeReadFile(file);
          
          if (!data) {
            continue;
          }
          
          const chunk = this.deserializeChunk(data.toString('utf-8'));
          
          // 检查分片是否过期
          if (this.isExpired(chunk)) {
            await unlink(file).catch(() => {
              // 忽略删除失败的错误
            });
            expiredCount++;
          }
        } catch (error) {
          // 忽略单个文件的错误，继续处理其他文件
          console.warn(`Failed to process chunk file during cleanup ${file}:`, error);
        }
      }
      
      // 清理空目录
      await this.cleanupEmptyDirectories();
      
      console.log(`Cleanup completed: ${expiredCount} expired chunks removed`);
    } catch (error) {
      console.error('Failed to cleanup expired chunks:', error);
    }
  }

  /**
   * 清理空目录
   * 删除没有文件的子目录
   * @returns Promise<void>
   */
  private async cleanupEmptyDirectories(): Promise<void> {
    try {
      const directories = await readdir(this.config.basePath, { withFileTypes: true });
      
      for (const entry of directories) {
        if (entry.isDirectory()) {
          const dirPath = path.join(this.config.basePath, entry.name);
          const files = await readdir(dirPath);
          
          if (files.length === 0) {
            try {
              // 删除空目录
              await promisify(fs.rmdir)(dirPath);
            } catch (error) {
              console.warn(`Failed to remove empty directory ${dirPath}:`, error);
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to cleanup empty directories:', error);
    }
  }
} 