/**
 * Redis存储适配器
 * 提供基于Redis的分片数据存储功能
 */

import IORedis, { Cluster, ClusterOptions, RedisOptions, Redis } from 'ioredis';
import { StorageAdapter } from './storage-adapter.js';
import { Chunk, ChunkSummary, ChunkType } from '../models/chunk.js';
import { ChunkFilter, mergeWithDefaultFilter } from '../models/chunk-filter.js';
import { RedisAdapterConfig } from '../../../config/storage-config.js';

// 类型别名，避免使用命名空间作为类型
type RedisClient = Redis | Cluster;

/**
 * Redis存储适配器实现
 * 使用Redis存储分片数据
 */
export class RedisAdapter implements StorageAdapter {
  private client: RedisClient | null = null;
  private config: RedisAdapterConfig;
  private connected: boolean = false;
  private connecting: Promise<void> | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * 构造函数
   * @param config Redis适配器配置
   */
  constructor(config: RedisAdapterConfig) {
    this.config = config;
    
    // 如果配置了启动时清理，执行清理
    if (this.config.cleanupOnStart) {
      this.connect().then(() => {
        return this.cleanup();
      }).catch(error => {
        console.error('Failed to cleanup on start:', error);
      });
    }
    
    // 如果配置了清理间隔，设置定时器
    if (this.config.cleanupInterval && this.config.cleanupInterval > 0) {
      this.cleanupInterval = setInterval(() => {
        this.connect().then(() => {
          return this.cleanup();
        }).catch(error => {
          console.error('Failed to cleanup:', error);
        });
      }, this.config.cleanupInterval);
      
      // 确保Node.js进程可以正常退出
      this.cleanupInterval.unref();
    }
  }

  /**
   * 连接到Redis
   * 如果已经连接或正在连接，返回现有连接
   * @returns Promise<void>
   */
  private async connect(): Promise<void> {
    // 如果已经连接，直接返回
    if (this.connected && this.client) {
      return;
    }
    
    // 如果正在连接，等待连接完成
    if (this.connecting) {
      return this.connecting;
    }
    
    // 创建新连接
    this.connecting = new Promise<void>((resolve, reject) => {
      try {
        // 配置Redis客户端选项
        const options: RedisOptions = {
          host: this.config.connection.host,
          port: this.config.connection.port,
          username: this.config.connection.username,
          password: this.config.connection.password,
          db: this.config.connection.db || 0,
          connectTimeout: this.config.connectTimeout,
          commandTimeout: this.config.commandTimeout,
          retryStrategy: (times: number) => {
            const retryStrategy = this.config.retryStrategy;
            if (!retryStrategy || times >= retryStrategy.maxRetryCount) {
              // 超过最大重试次数，停止重试
              return null;
            }
            return retryStrategy.retryInterval;
          }
        };
        
        // 创建Redis客户端
        if (this.config.cluster && this.config.nodes && this.config.nodes.length > 0) {
          // 集群模式
          this.client = new Cluster(
            this.config.nodes.map(node => ({ host: node.host, port: node.port })),
            { 
              redisOptions: options,
              clusterRetryStrategy: (times: number) => {
                const retryStrategy = this.config.retryStrategy;
                if (!retryStrategy || times >= retryStrategy.maxRetryCount) {
                  return null;
                }
                return retryStrategy.retryInterval;
              }
            } as ClusterOptions
          );
        } else {
          // 单节点模式
          this.client = new Redis(options);
        }
        
        // 监听连接事件
        this.client.on('connect', () => {
          this.connected = true;
          console.log('Connected to Redis');
        });
        
        // 监听错误事件
        this.client.on('error', (error: Error) => {
          console.error('Redis connection error:', error);
          this.connected = false;
        });
        
        // 监听断开连接事件
        this.client.on('close', () => {
          console.warn('Redis connection closed');
          this.connected = false;
        });
        
        // 监听重新连接事件
        this.client.on('reconnecting', () => {
          console.log('Reconnecting to Redis...');
        });
        
        // 等待连接就绪
        this.client.on('ready', () => {
          this.connected = true;
          resolve();
        });
        
        // 处理连接超时
        setTimeout(() => {
          if (!this.connected) {
            reject(new Error('Redis connection timeout'));
          }
        }, this.config.connectTimeout || 10000);
        
      } catch (error) {
        this.connected = false;
        reject(error);
      } finally {
        this.connecting = null;
      }
    });
    
    return this.connecting;
  }

  /**
   * 断开与Redis的连接
   * @returns Promise<void>
   */
  private async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.quit();
      this.client = null;
      this.connected = false;
    }
  }

  /**
   * 释放资源
   * 清理定时器和连接
   */
  public async dispose(): Promise<void> {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
      this.cleanupInterval = null;
    }
    
    await this.disconnect();
  }

  /**
   * 获取分片键名
   * @param id 分片ID
   * @returns Redis键名
   */
  private getChunkKey(id: string): string {
    return `${this.config.keyPrefix}${id}`;
  }

  /**
   * 获取分片索引键名
   * 用于存储所有分片ID的集合
   * @returns Redis键名
   */
  private getChunkIndexKey(): string {
    return `${this.config.keyPrefix}index`;
  }

  /**
   * 获取分片类型索引键名
   * 用于存储特定类型分片ID的集合
   * @param type 分片类型
   * @returns Redis键名
   */
  private getChunkTypeIndexKey(type: ChunkType): string {
    return `${this.config.keyPrefix}type:${type}`;
  }

  /**
   * 获取分片文件索引键名
   * 用于存储特定文件的分片ID集合
   * @param fileKey 文件键
   * @returns Redis键名
   */
  private getChunkFileIndexKey(fileKey: string): string {
    return `${this.config.keyPrefix}file:${fileKey}`;
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
   * 计算分片过期时间（秒）
   * @param chunk 分片数据
   * @returns 过期时间（秒）
   */
  private getExpireTime(chunk: Chunk): number {
    if (chunk.expires) {
      const now = new Date();
      const expireTime = Math.max(0, Math.floor((chunk.expires.getTime() - now.getTime()) / 1000));
      return expireTime;
    }
    return this.config.defaultTTL;
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
   * 从Redis获取分片数据
   * @param key Redis键名
   * @returns 分片数据或null
   */
  private async fetchChunk(key: string): Promise<Chunk | null> {
    await this.connect();
    
    if (!this.client) {
      throw new Error('Redis client is not available');
    }
    
    const data = await this.client.get(key);
    
    if (!data) {
      return null;
    }
    
    try {
      return this.deserializeChunk(data);
    } catch (error) {
      console.error(`Failed to deserialize chunk from key ${key}:`, error);
      return null;
    }
  }

  /**
   * 更新分片访问时间并保存
   * @param chunk 分片数据
   * @returns 是否成功
   */
  private async updateLastAccessed(chunk: Chunk): Promise<boolean> {
    chunk.lastAccessed = new Date();
    return this.storeChunk(chunk);
  }

  /**
   * 将分片数据存储到Redis
   * @param chunk 分片数据
   * @returns 是否成功
   */
  private async storeChunk(chunk: Chunk): Promise<boolean> {
    await this.connect();
    
    if (!this.client) {
      throw new Error('Redis client is not available');
    }
    
    const key = this.getChunkKey(chunk.id);
    const data = this.serializeChunk(chunk);
    const expireTime = this.getExpireTime(chunk);
    
    // 使用pipeline批量执行操作
    const pipeline = this.client.pipeline();
    
    // 存储分片数据并设置过期时间
    pipeline.setex(key, expireTime, data);
    
    // 添加到全局索引
    pipeline.sadd(this.getChunkIndexKey(), chunk.id);
    
    // 添加到类型索引
    pipeline.sadd(this.getChunkTypeIndexKey(chunk.type), chunk.id);
    
    // 添加到文件索引
    pipeline.sadd(this.getChunkFileIndexKey(chunk.fileKey), chunk.id);
    
    try {
      await pipeline.exec();
      return true;
    } catch (error) {
      console.error('Failed to store chunk:', error);
      return false;
    }
  }

  // StorageAdapter接口实现
  /**
   * 存储分片数据
   * @param chunk 要存储的分片数据
   * @returns Promise<void>
   */
  public async saveChunk(chunk: Chunk): Promise<void> {
    await this.connect();
    
    if (!(await this.storeChunk(chunk))) {
      throw new Error(`Failed to save chunk ${chunk.id}`);
    }
  }

  /**
   * 获取分片数据
   * @param id 分片ID
   * @returns Promise<Chunk | null> 返回分片数据，不存在时返回null
   */
  public async getChunk(id: string): Promise<Chunk | null> {
    await this.connect();
    
    const key = this.getChunkKey(id);
    const chunk = await this.fetchChunk(key);
    
    if (!chunk) {
      return null;
    }
    
    // 检查分片是否过期
    if (this.isExpired(chunk)) {
      await this.deleteChunk(id);
      return null;
    }
    
    // 更新最后访问时间
    await this.updateLastAccessed(chunk);
    
    return chunk;
  }

  /**
   * 检查分片是否存在
   * @param id 分片ID
   * @returns Promise<boolean> 分片存在返回true，否则返回false
   */
  public async hasChunk(id: string): Promise<boolean> {
    await this.connect();
    
    if (!this.client) {
      throw new Error('Redis client is not available');
    }
    
    const key = this.getChunkKey(id);
    return (await this.client.exists(key)) > 0;
  }

  /**
   * 删除分片
   * @param id 分片ID
   * @returns Promise<boolean> 删除成功返回true，不存在或删除失败返回false
   */
  public async deleteChunk(id: string): Promise<boolean> {
    await this.connect();
    
    if (!this.client) {
      throw new Error('Redis client is not available');
    }
    
    // 获取分片信息，用于从索引中删除
    const key = this.getChunkKey(id);
    const chunk = await this.fetchChunk(key);
    
    if (!chunk) {
      return false;
    }
    
    // 使用pipeline批量执行操作
    const pipeline = this.client.pipeline();
    
    // 删除分片数据
    pipeline.del(key);
    
    // 从索引中删除
    pipeline.srem(this.getChunkIndexKey(), id);
    pipeline.srem(this.getChunkTypeIndexKey(chunk.type), id);
    pipeline.srem(this.getChunkFileIndexKey(chunk.fileKey), id);
    
    try {
      const results = await pipeline.exec();
      // 检查第一个操作（删除分片数据）的结果
      return results && results[0] && results[0][1] === 1;
    } catch (error) {
      console.error(`Failed to delete chunk ${id}:`, error);
      return false;
    }
  }

  /**
   * 列出所有分片
   * @param filter 可选的过滤条件
   * @returns Promise<ChunkSummary[]> 返回符合条件的分片摘要列表
   */
  public async listChunks(filter?: ChunkFilter): Promise<ChunkSummary[]> {
    await this.connect();
    
    if (!this.client) {
      throw new Error('Redis client is not available');
    }
    
    // 合并默认过滤器
    const finalFilter = mergeWithDefaultFilter(filter);
    
    let chunkIds: string[] = [];
    
    // 根据过滤条件确定查询方式
    if (finalFilter.fileKey) {
      // 按文件键过滤
      chunkIds = await this.client.smembers(this.getChunkFileIndexKey(finalFilter.fileKey));
    } else if (finalFilter.type) {
      // 按类型过滤
      chunkIds = await this.client.smembers(this.getChunkTypeIndexKey(finalFilter.type));
    } else {
      // 获取所有分片ID
      chunkIds = await this.client.smembers(this.getChunkIndexKey());
    }
    
    // 没有符合条件的分片
    if (chunkIds.length === 0) {
      return [];
    }
    
    // 获取所有分片详情
    const pipeline = this.client.pipeline();
    for (const id of chunkIds) {
      pipeline.get(this.getChunkKey(id));
    }
    
    const results = await pipeline.exec();
    if (!results) {
      return [];
    }
    
    const chunks: Chunk[] = [];
    
    for (const result of results) {
      const [error, data] = result;
      
      if (!error && data) {
        try {
          const chunk = this.deserializeChunk(data as string);
          chunks.push(chunk);
        } catch (error) {
          console.error('Failed to deserialize chunk:', error);
        }
      }
    }
    
    // 应用日期过滤器
    let filteredChunks = chunks;
    
    if (finalFilter.olderThan) {
      filteredChunks = filteredChunks.filter(chunk => chunk.created < finalFilter.olderThan!);
    }
    
    if (finalFilter.newerThan) {
      filteredChunks = filteredChunks.filter(chunk => chunk.created > finalFilter.newerThan!);
    }
    
    // 删除已过期的分片并创建摘要列表
    const summaries: ChunkSummary[] = [];
    
    for (const chunk of filteredChunks) {
      if (this.isExpired(chunk)) {
        // 异步删除过期分片，不等待完成
        this.deleteChunk(chunk.id).catch(error => {
          console.error(`Failed to delete expired chunk ${chunk.id}:`, error);
        });
        continue;
      }
      
      // 创建分片摘要
      const summary: ChunkSummary = {
        id: chunk.id,
        fileKey: chunk.fileKey,
        type: chunk.type,
        created: chunk.created,
        size: Buffer.byteLength(this.serializeChunk(chunk)) // 计算序列化后的大小
      };
      
      summaries.push(summary);
    }
    
    return summaries;
  }

  /**
   * 清理过期数据
   * 删除所有已过期的分片数据
   * @returns Promise<void>
   */
  public async cleanup(): Promise<void> {
    await this.connect();
    
    if (!this.client) {
      throw new Error('Redis client is not available');
    }
    
    const now = new Date();
    const chunkIds = await this.client.smembers(this.getChunkIndexKey());
    
    if (chunkIds.length === 0) {
      return;
    }
    
    // 获取所有分片
    const pipeline = this.client.pipeline();
    for (const id of chunkIds) {
      pipeline.get(this.getChunkKey(id));
    }
    
    const results = await pipeline.exec();
    if (!results) {
      return;
    }
    
    const expiredIds: string[] = [];
    
    for (let i = 0; i < results.length; i++) {
      const [error, data] = results[i];
      
      if (error || !data) {
        continue;
      }
      
      try {
        const chunk = this.deserializeChunk(data as string);
        
        if (this.isExpired(chunk)) {
          expiredIds.push(chunkIds[i]);
        }
      } catch (error) {
        console.error(`Failed to deserialize chunk ${chunkIds[i]}:`, error);
        // 对于无法反序列化的分片，也将其视为过期
        expiredIds.push(chunkIds[i]);
      }
    }
    
    // 删除过期分片
    for (const id of expiredIds) {
      await this.deleteChunk(id).catch(error => {
        console.error(`Failed to delete expired chunk ${id}:`, error);
      });
    }
    
    console.log(`Cleaned up ${expiredIds.length} expired chunks`);
  }
} 