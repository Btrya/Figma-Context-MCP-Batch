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
   * 其他适配器配置（将在后续故事中添加）
   */
  // redis?: RedisAdapterConfig;
  // mongo?: MongoAdapterConfig;
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
    return DEFAULT_STORAGE_MANAGER_CONFIG;
  }
  
  return {
    ...DEFAULT_STORAGE_MANAGER_CONFIG,
    ...userConfig,
    fileSystem: userConfig.fileSystem
      ? { ...DEFAULT_FILE_SYSTEM_CONFIG, ...userConfig.fileSystem }
      : DEFAULT_FILE_SYSTEM_CONFIG
  };
} 