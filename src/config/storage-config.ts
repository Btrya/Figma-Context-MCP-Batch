/**
 * 存储系统配置文件
 * 包含存储系统的默认配置和类型定义
 */

import { BaseStorageAdapterConfig } from '../services/storage/adapters/storage-adapter.js';
import path from 'path';
import os from 'os';

/**
 * 文件系统存储适配器配置
 */
export interface FileSystemAdapterConfig extends BaseStorageAdapterConfig {
  /**
   * 存储根目录
   * 默认为系统临时目录下的figma-chunks子目录
   */
  basePath: string;
  
  /**
   * 是否启用文件锁定
   * 防止并发写入冲突
   */
  useLocks: boolean;
  
  /**
   * 文件锁超时时间（毫秒）
   * 超过此时间的锁将被视为过期
   */
  lockTimeout: number;
  
  /**
   * 默认过期时间（毫秒）
   * 默认为24小时
   */
  defaultTTL: number;
  
  /**
   * 文件名hash算法
   * 用于生成文件名
   */
  hashAlgorithm: 'md5' | 'sha1' | 'sha256';
}

/**
 * Redis存储适配器配置
 */
export interface RedisAdapterConfig extends BaseStorageAdapterConfig {
  /**
   * Redis连接选项
   */
  connection: {
    host: string;
    port: number;
    password?: string;
    db?: number;
    username?: string;
  };
  
  /**
   * 是否使用集群模式
   * 默认为false
   */
  cluster?: boolean;
  
  /**
   * 集群节点配置（如果使用集群模式）
   */
  nodes?: Array<{
    host: string;
    port: number;
  }>;
  
  /**
   * 默认过期时间（秒）
   * 默认为24小时
   */
  defaultTTL: number;
  
  /**
   * 键前缀（用于隔离不同应用的数据）
   */
  keyPrefix: string;
  
  /**
   * 连接超时时间（毫秒）
   */
  connectTimeout?: number;
  
  /**
   * 命令执行超时时间（毫秒）
   */
  commandTimeout?: number;
  
  /**
   * 重试策略
   */
  retryStrategy?: {
    /**
     * 最大重试次数
     */
    maxRetryCount: number;
    
    /**
     * 重试间隔（毫秒）
     */
    retryInterval: number;
  };
}

/**
 * MongoDB存储适配器配置
 */
export interface MongoAdapterConfig extends BaseStorageAdapterConfig {
  /**
   * 连接URI
   */
  uri: string;
  
  /**
   * 数据库名称
   */
  database: string;
  
  /**
   * 集合名称
   */
  collection: string;
  
  /**
   * 连接选项
   */
  options?: {
    /**
     * 最大连接池大小
     */
    maxPoolSize?: number;
    
    /**
     * 服务器选择超时时间（毫秒）
     */
    serverSelectionTimeoutMS?: number;
    
    /**
     * 连接超时时间（毫秒）
     */
    connectTimeoutMS?: number;
    
    /**
     * 套接字超时时间（毫秒）
     */
    socketTimeoutMS?: number;
    
    /**
     * TLS/SSL CA文件路径
     */
    tlsCAFile?: string;
  };
  
  /**
   * 索引配置
   */
  indexes?: Array<{
    /**
     * 索引字段
     * 键为字段名，值为排序方向（1为升序，-1为降序）
     */
    fields: Record<string, 1 | -1>;
    
    /**
     * 索引选项
     */
    options?: {
      /**
       * 是否唯一索引
       */
      unique?: boolean;
      
      /**
       * 是否稀疏索引
       */
      sparse?: boolean;
      
      /**
       * 是否创建后台索引
       */
      background?: boolean;
      
      /**
       * 过期时间（秒）
       * 用于TTL索引
       */
      expireAfterSeconds?: number;
    };
  }>;
  
  /**
   * 默认过期时间（秒）
   * 默认为0表示不过期
   */
  defaultTTL: number;
  
  /**
   * 重试策略
   */
  retryStrategy?: {
    /**
     * 最大重试次数
     */
    maxRetryCount: number;
    
    /**
     * 重试间隔（毫秒）
     */
    retryInterval: number;
  };
}

/**
 * 存储管理器配置
 */
export interface StorageManagerConfig {
  /**
   * 默认存储适配器名称
   */
  defaultAdapter: string;
  
  /**
   * 文件系统适配器配置
   */
  fileSystem?: FileSystemAdapterConfig;
  
  /**
   * Redis适配器配置
   */
  redis?: RedisAdapterConfig;
  
  /**
   * MongoDB适配器配置
   */
  mongo?: MongoAdapterConfig;
}

/**
 * 默认的文件系统适配器配置
 */
export const DEFAULT_FILE_SYSTEM_CONFIG: FileSystemAdapterConfig = {
  basePath: path.join(os.tmpdir(), 'figma-chunks'),
  useLocks: true,
  lockTimeout: 30000, // 30秒
  defaultTTL: 24 * 60 * 60 * 1000, // 24小时
  hashAlgorithm: 'md5',
  cleanupOnStart: true,
  cleanupInterval: 60 * 60 * 1000 // 1小时
};

/**
 * 默认的Redis适配器配置
 */
export const DEFAULT_REDIS_CONFIG: RedisAdapterConfig = {
  connection: {
    host: 'localhost',
    port: 6379,
    db: 0
  },
  cluster: false,
  defaultTTL: 24 * 60 * 60, // 24小时（秒）
  keyPrefix: 'figma:chunk:',
  connectTimeout: 10000, // 10秒
  commandTimeout: 5000, // 5秒
  retryStrategy: {
    maxRetryCount: 3,
    retryInterval: 1000 // 1秒
  },
  cleanupOnStart: true,
  cleanupInterval: 60 * 60 * 1000 // 1小时
};

/**
 * 默认的MongoDB适配器配置
 */
export const DEFAULT_MONGO_CONFIG: MongoAdapterConfig = {
  uri: 'mongodb://localhost:27017',
  database: 'figma_cache',
  collection: 'chunks',
  options: {
    maxPoolSize: 10,
    serverSelectionTimeoutMS: 5000,
    connectTimeoutMS: 10000,
    socketTimeoutMS: 30000
  },
  indexes: [
    {
      fields: { fileKey: 1 },
      options: { background: true }
    },
    {
      fields: { type: 1 },
      options: { background: true }
    },
    {
      fields: { lastAccessed: 1 },
      options: { background: true, expireAfterSeconds: 86400 } // 默认1天后过期
    }
  ],
  defaultTTL: 24 * 60 * 60, // 24小时（秒）
  retryStrategy: {
    maxRetryCount: 3,
    retryInterval: 1000 // 1秒
  },
  cleanupOnStart: true,
  cleanupInterval: 60 * 60 * 1000 // 1小时
};

/**
 * 默认的存储管理器配置
 */
export const DEFAULT_STORAGE_MANAGER_CONFIG: StorageManagerConfig = {
  defaultAdapter: 'fileSystem',
  fileSystem: DEFAULT_FILE_SYSTEM_CONFIG
};

/**
 * 合并用户配置与默认配置
 * @param userConfig 用户提供的配置
 * @returns 合并后的配置
 */
export function mergeWithDefaultConfig(userConfig?: Partial<StorageManagerConfig>): StorageManagerConfig {
  if (!userConfig) {
    return { ...DEFAULT_STORAGE_MANAGER_CONFIG };
  }
  
  const result: StorageManagerConfig = {
    defaultAdapter: userConfig.defaultAdapter || DEFAULT_STORAGE_MANAGER_CONFIG.defaultAdapter,
  };
  
  // 合并文件系统配置
  if (userConfig.fileSystem || DEFAULT_STORAGE_MANAGER_CONFIG.fileSystem) {
    result.fileSystem = {
      ...DEFAULT_FILE_SYSTEM_CONFIG,
      ...userConfig.fileSystem
    };
  }
  
  // 合并Redis配置
  if (userConfig.redis) {
    result.redis = {
      ...DEFAULT_REDIS_CONFIG,
      ...userConfig.redis,
      connection: {
        ...DEFAULT_REDIS_CONFIG.connection,
        ...userConfig.redis.connection
      },
      retryStrategy: userConfig.redis.retryStrategy ? {
        ...DEFAULT_REDIS_CONFIG.retryStrategy,
        ...userConfig.redis.retryStrategy
      } : DEFAULT_REDIS_CONFIG.retryStrategy
    };
  }
  
  // 合并MongoDB配置
  if (userConfig.mongo) {
    result.mongo = {
      ...DEFAULT_MONGO_CONFIG,
      ...userConfig.mongo,
      options: {
        ...DEFAULT_MONGO_CONFIG.options,
        ...userConfig.mongo.options
      },
      retryStrategy: userConfig.mongo.retryStrategy ? {
        ...DEFAULT_MONGO_CONFIG.retryStrategy,
        ...userConfig.mongo.retryStrategy
      } : DEFAULT_MONGO_CONFIG.retryStrategy
    };
  }
  
  return result;
} 