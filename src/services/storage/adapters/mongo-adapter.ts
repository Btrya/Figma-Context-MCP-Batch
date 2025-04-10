/**
 * MongoDB存储适配器
 * 提供基于MongoDB的分片数据存储功能
 */

import { MongoClient, Collection, Db, Document } from 'mongodb';
import { StorageAdapter } from './storage-adapter.js';
import { Chunk, ChunkSummary, ChunkType } from '../models/chunk.js';
import { ChunkFilter, mergeWithDefaultFilter } from '../models/chunk-filter.js';
import { MongoAdapterConfig } from '../../../config/storage-config.js';

/**
 * MongoDB文档模型
 * 表示MongoDB中的分片文档
 */
interface ChunkDocument {
  _id: string;              // 分片ID作为文档ID
  fileKey: string;          // Figma文件键
  type: string;             // 分片类型（字符串形式）
  created: Date;            // 创建时间
  expires?: Date;           // 过期时间（可选）
  lastAccessed: Date;       // 最后访问时间
  data: any;                // 分片实际数据
  links: string[];          // 相关联的其他分片ID
  size: number;             // 数据大小（字节）
  metadata?: Record<string, any>; // 额外元数据
}

/**
 * MongoDB存储适配器实现
 * 使用MongoDB存储分片数据
 */
export class MongoAdapter implements StorageAdapter {
  private client: MongoClient | null = null;
  private db: Db | null = null;
  private collection: Collection<ChunkDocument> | null = null;
  private config: MongoAdapterConfig;
  private connected: boolean = false;
  private connecting: Promise<void> | null = null;
  private cleanupInterval: NodeJS.Timeout | null = null;

  /**
   * 构造函数
   * @param config MongoDB适配器配置
   */
  constructor(config: MongoAdapterConfig) {
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
   * 连接到MongoDB
   * 如果已经连接或正在连接，返回现有连接
   * @returns Promise<void>
   */
  private async connect(): Promise<void> {
    // 如果已经连接，直接返回
    if (this.connected && this.client && this.db && this.collection) {
      return;
    }
    
    // 如果正在连接，等待连接完成
    if (this.connecting) {
      return this.connecting;
    }
    
    // 创建新连接
    this.connecting = new Promise<void>(async (resolve, reject) => {
      try {
        // 创建MongoDB客户端
        this.client = new MongoClient(this.config.uri, {
          maxPoolSize: this.config.options?.maxPoolSize,
          serverSelectionTimeoutMS: this.config.options?.serverSelectionTimeoutMS,
          connectTimeoutMS: this.config.options?.connectTimeoutMS,
          socketTimeoutMS: this.config.options?.socketTimeoutMS
        });
        
        // 连接到MongoDB
        await this.client.connect();
        
        // 获取数据库和集合
        this.db = this.client.db(this.config.database);
        this.collection = this.db.collection<ChunkDocument>(this.config.collection);
        
        // 设置索引
        await this.setupIndices();
        
        this.connected = true;
        console.log('Connected to MongoDB');
        resolve();
      } catch (error) {
        this.connected = false;
        console.error('MongoDB connection error:', error);
        reject(error);
      } finally {
        this.connecting = null;
      }
    });
    
    return this.connecting;
  }

  /**
   * 断开与MongoDB的连接
   * @returns Promise<void>
   */
  private async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.collection = null;
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
   * 设置集合索引
   * 根据配置创建所需的索引
   * @returns Promise<void>
   */
  private async setupIndices(): Promise<void> {
    if (!this.collection) {
      throw new Error('MongoDB collection not initialized');
    }
    
    // 检查配置的索引
    if (this.config.indexes && this.config.indexes.length > 0) {
      for (const indexConfig of this.config.indexes) {
        await this.collection.createIndex(indexConfig.fields, indexConfig.options);
      }
    }
    
    // 创建默认索引（如果不存在于配置中）
    const hasLastAccessedIndex = this.config.indexes?.some(idx => 
      Object.keys(idx.fields).includes('lastAccessed') && 
      idx.options?.expireAfterSeconds !== undefined
    );
    
    if (!hasLastAccessedIndex) {
      await this.collection.createIndex(
        { lastAccessed: 1 }, 
        { expireAfterSeconds: this.config.defaultTTL, background: true }
      );
    }
  }

  /**
   * 将Chunk对象转换为MongoDB文档
   * @param chunk 分片数据
   * @returns MongoDB文档
   */
  private chunkToDocument(chunk: Chunk): ChunkDocument {
    // 计算数据大小（近似值）
    const dataSize = JSON.stringify(chunk.data).length;
    
    return {
      _id: chunk.id,
      fileKey: chunk.fileKey,
      type: chunk.type.toString(),
      created: chunk.created,
      expires: chunk.expires,
      lastAccessed: chunk.lastAccessed,
      data: chunk.data,
      links: chunk.links || [],
      size: dataSize,
      metadata: {
        // 可以添加其他元数据
      }
    };
  }

  /**
   * 将MongoDB文档转换为Chunk对象
   * @param doc MongoDB文档
   * @returns 分片数据
   */
  private documentToChunk(doc: ChunkDocument): Chunk {
    return {
      id: doc._id,
      fileKey: doc.fileKey,
      type: doc.type as ChunkType,
      created: doc.created,
      expires: doc.expires,
      lastAccessed: doc.lastAccessed,
      data: doc.data,
      links: doc.links || []
    };
  }

  /**
   * 获取过期时间
   * 根据配置的默认TTL计算过期时间
   * @param chunk 分片数据
   * @returns 过期时间（Date对象）
   */
  private getExpireTime(chunk: Chunk): Date | undefined {
    if (chunk.expires) {
      return chunk.expires;
    }
    
    if (this.config.defaultTTL > 0) {
      const expireDate = new Date();
      expireDate.setSeconds(expireDate.getSeconds() + this.config.defaultTTL);
      return expireDate;
    }
    
    return undefined;
  }

  /**
   * 检查分片是否过期
   * @param chunk 分片数据
   * @returns 是否过期
   */
  private isExpired(chunk: Chunk): boolean {
    if (!chunk.expires) {
      return false;
    }
    
    return chunk.expires < new Date();
  }

  /**
   * 更新最后访问时间
   * @param id 分片ID
   * @param lastAccessed 最后访问时间
   * @returns Promise<boolean> 更新成功返回true，否则返回false
   */
  private async updateLastAccessed(id: string, lastAccessed: Date): Promise<boolean> {
    if (!this.collection) {
      await this.connect();
    }
    
    if (!this.collection) {
      throw new Error('MongoDB collection not initialized');
    }
    
    const result = await this.collection.updateOne(
      { _id: id },
      { $set: { lastAccessed } }
    );
    
    return result.modifiedCount > 0;
  }

  /**
   * 保存分片数据
   * @param chunk 要存储的分片数据
   * @returns Promise<void>
   */
  public async saveChunk(chunk: Chunk): Promise<void> {
    if (!this.collection) {
      await this.connect();
    }
    
    if (!this.collection) {
      throw new Error('MongoDB collection not initialized');
    }
    
    // 设置过期时间
    const chunkWithExpires = { ...chunk };
    if (!chunkWithExpires.expires) {
      chunkWithExpires.expires = this.getExpireTime(chunk);
    }
    
    // 转换为文档并插入/更新
    const doc = this.chunkToDocument(chunkWithExpires);
    await this.collection.updateOne(
      { _id: doc._id },
      { $set: doc },
      { upsert: true }
    );
  }

  /**
   * 批量保存分片数据
   * @param chunks 要存储的分片数据数组
   * @returns Promise<void>
   */
  public async bulkSaveChunks(chunks: Chunk[]): Promise<void> {
    if (chunks.length === 0) {
      return;
    }
    
    if (!this.collection) {
      await this.connect();
    }
    
    if (!this.collection) {
      throw new Error('MongoDB collection not initialized');
    }
    
    // 准备批量操作
    const operations = chunks.map(chunk => {
      // 设置过期时间
      const chunkWithExpires = { ...chunk };
      if (!chunkWithExpires.expires) {
        chunkWithExpires.expires = this.getExpireTime(chunk);
      }
      
      // 转换为文档
      const doc = this.chunkToDocument(chunkWithExpires);
      
      return {
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: doc },
          upsert: true
        }
      };
    });
    
    // 执行批量写入
    await this.collection.bulkWrite(operations);
  }

  /**
   * 获取分片数据
   * @param id 分片ID
   * @returns Promise<Chunk | null> 返回分片数据，不存在时返回null
   */
  public async getChunk(id: string): Promise<Chunk | null> {
    if (!this.collection) {
      await this.connect();
    }
    
    if (!this.collection) {
      throw new Error('MongoDB collection not initialized');
    }
    
    // 查询分片文档
    const doc = await this.collection.findOne({ _id: id });
    
    if (!doc) {
      return null;
    }
    
    // 转换为Chunk对象
    const chunk = this.documentToChunk(doc);
    
    // 检查是否过期
    if (this.isExpired(chunk)) {
      // 异步删除过期数据，不阻塞当前操作
      this.deleteChunk(id).catch(err => {
        console.error('Failed to delete expired chunk:', err);
      });
      return null;
    }
    
    // 更新最后访问时间
    const now = new Date();
    this.updateLastAccessed(id, now).catch(err => {
      console.error('Failed to update lastAccessed:', err);
    });
    
    // 同时更新内存中对象的最后访问时间
    chunk.lastAccessed = now;
    
    return chunk;
  }

  /**
   * 检查分片是否存在
   * @param id 分片ID
   * @returns Promise<boolean> 分片存在返回true，否则返回false
   */
  public async hasChunk(id: string): Promise<boolean> {
    if (!this.collection) {
      await this.connect();
    }
    
    if (!this.collection) {
      throw new Error('MongoDB collection not initialized');
    }
    
    // 检查分片是否存在
    const count = await this.collection.countDocuments({ _id: id }, { limit: 1 });
    return count > 0;
  }

  /**
   * 删除分片
   * @param id 分片ID
   * @returns Promise<boolean> 删除成功返回true，不存在或删除失败返回false
   */
  public async deleteChunk(id: string): Promise<boolean> {
    if (!this.collection) {
      await this.connect();
    }
    
    if (!this.collection) {
      throw new Error('MongoDB collection not initialized');
    }
    
    // 删除分片
    const result = await this.collection.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  /**
   * 根据过滤条件获取分片摘要列表
   * @param filter 分片过滤条件
   * @returns Promise<ChunkSummary[]> 返回分片摘要列表
   */
  public async listChunks(filter?: ChunkFilter): Promise<ChunkSummary[]> {
    if (!this.collection) {
      await this.connect();
    }
    
    if (!this.collection) {
      throw new Error('MongoDB collection not initialized');
    }
    
    // 应用默认过滤条件
    const finalFilter = mergeWithDefaultFilter(filter);
    
    // 构建查询条件
    const query: Document = {};
    
    if (finalFilter.fileKey) {
      query.fileKey = finalFilter.fileKey;
    }
    
    if (finalFilter.type) {
      query.type = finalFilter.type;
    }
    
    // 执行查询
    const docs = await this.collection.find(query).toArray();
    
    // 转换为摘要对象
    return docs.map((doc: ChunkDocument) => ({
      id: doc._id,
      fileKey: doc.fileKey,
      type: doc.type as ChunkType,
      created: doc.created,
      size: doc.size
    }));
  }

  /**
   * 查找分片
   * 使用MongoDB查询语法查找分片
   * @param query MongoDB查询条件
   * @returns Promise<Chunk[]> 返回符合条件的分片数据列表
   */
  public async findChunks(query: Document): Promise<Chunk[]> {
    if (!this.collection) {
      await this.connect();
    }
    
    if (!this.collection) {
      throw new Error('MongoDB collection not initialized');
    }
    
    // 执行查询
    const docs = await this.collection.find(query).toArray();
    
    // 转换为Chunk对象
    return docs.map((doc: ChunkDocument) => this.documentToChunk(doc));
  }

  /**
   * 执行聚合查询
   * 使用MongoDB聚合管道进行高级查询
   * @param pipeline MongoDB聚合管道
   * @returns Promise<any[]> 返回聚合结果
   */
  public async aggregate(pipeline: Document[]): Promise<any[]> {
    if (!this.collection) {
      await this.connect();
    }
    
    if (!this.collection) {
      throw new Error('MongoDB collection not initialized');
    }
    
    // 执行聚合查询
    return await this.collection.aggregate(pipeline).toArray();
  }

  /**
   * 清理过期数据
   * 删除所有已过期的分片数据
   * @returns Promise<void>
   */
  public async cleanup(): Promise<void> {
    if (!this.collection) {
      await this.connect();
    }
    
    if (!this.collection) {
      throw new Error('MongoDB collection not initialized');
    }
    
    const now = new Date();
    
    // 删除已过期的分片
    await this.collection.deleteMany({
      expires: { $lt: now }
    });
    
    console.log('MongoDB cleanup completed');
  }
} 