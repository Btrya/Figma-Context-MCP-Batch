import path from 'path';
import { FigmaChunk } from '../../models/figma/figma-chunk.js';
import { FigmaChunkConfig } from '../../config/env.js';
import { FileSystem } from '../../utils/file-system.js';
import { Logger } from '../../utils/logger.js';

/**
 * Figma缓存管理器
 * 负责将Figma分块缓存到文件系统并从中检索
 */
export class FigmaCacheManager {
  private readonly cacheDir: string;
  
  /**
   * 构造函数
   * @param cacheDir 缓存目录，默认使用环境配置
   */
  constructor(cacheDir?: string) {
    this.cacheDir = cacheDir || FigmaChunkConfig.CACHE_DIR;
    
    // 确保缓存目录存在
    FileSystem.ensureDir(this.cacheDir);
    
    Logger.info(`初始化Figma缓存管理器: 缓存目录=${this.cacheDir}`);
  }
  
  /**
   * 缓存单个分块
   * @param fileKey Figma文件键
   * @param chunk 分块
   */
  async cacheChunk(fileKey: string, chunk: FigmaChunk): Promise<void> {
    try {
      const chunkPath = this.getChunkPath(fileKey, chunk.chunkId);
      FileSystem.writeJsonFile(chunkPath, chunk);
      Logger.debug(`缓存分块: ${fileKey}/${chunk.chunkId}`);
    } catch (error) {
      Logger.error(`缓存分块失败: ${fileKey}/${chunk.chunkId}`, error);
      throw error;
    }
  }
  
  /**
   * 缓存多个分块
   * @param fileKey Figma文件键
   * @param chunks 分块列表
   */
  async cacheChunks(fileKey: string, chunks: FigmaChunk[]): Promise<void> {
    try {
      Logger.info(`开始缓存分块: 文件键=${fileKey}, 分块数量=${chunks.length}`);
      
      // 确保文件键目录存在
      const fileKeyDir = this.getFileKeyDir(fileKey);
      FileSystem.ensureDir(fileKeyDir);
      
      // 缓存每个分块
      for (const chunk of chunks) {
        await this.cacheChunk(fileKey, chunk);
      }
      
      Logger.info(`缓存分块完成: 文件键=${fileKey}, 分块数量=${chunks.length}`);
    } catch (error) {
      Logger.error(`缓存分块失败: ${fileKey}`, error);
      throw error;
    }
  }
  
  /**
   * 获取分块
   * @param fileKey Figma文件键
   * @param chunkId 分块ID
   * @returns 分块，如果不存在则返回null
   */
  async getChunk(fileKey: string, chunkId: string): Promise<FigmaChunk | null> {
    try {
      const chunkPath = this.getChunkPath(fileKey, chunkId);
      return FileSystem.readJsonFile<FigmaChunk>(chunkPath);
    } catch (error) {
      Logger.error(`获取分块失败: ${fileKey}/${chunkId}`, error);
      return null;
    }
  }
  
  /**
   * 检查分块是否存在
   * @param fileKey Figma文件键
   * @param chunkId 分块ID
   * @returns 是否存在
   */
  async hasChunk(fileKey: string, chunkId: string): Promise<boolean> {
    try {
      const chunk = await this.getChunk(fileKey, chunkId);
      return chunk !== null;
    } catch (error) {
      return false;
    }
  }
  
  /**
   * 获取文件的所有分块
   * @param fileKey Figma文件键
   * @returns 分块列表
   */
  async getAllChunks(fileKey: string): Promise<FigmaChunk[]> {
    try {
      const fileKeyDir = this.getFileKeyDir(fileKey);
      const chunkFiles = FileSystem.listFiles(fileKeyDir, '.json');
      
      const chunks: FigmaChunk[] = [];
      for (const filePath of chunkFiles) {
        const chunk = FileSystem.readJsonFile<FigmaChunk>(filePath);
        if (chunk) {
          chunks.push(chunk);
        }
      }
      
      // 按照索引排序
      chunks.sort((a, b) => {
        const indexA = this.extractChunkIndex(a.chunkId);
        const indexB = this.extractChunkIndex(b.chunkId);
        return indexA - indexB;
      });
      
      return chunks;
    } catch (error) {
      Logger.error(`获取所有分块失败: ${fileKey}`, error);
      return [];
    }
  }
  
  /**
   * 清除文件的所有分块
   * @param fileKey Figma文件键
   */
  async clearChunks(fileKey: string): Promise<void> {
    try {
      const fileKeyDir = this.getFileKeyDir(fileKey);
      const chunkFiles = FileSystem.listFiles(fileKeyDir, '.json');
      
      for (const filePath of chunkFiles) {
        FileSystem.deleteFile(filePath);
      }
      
      Logger.info(`清除分块完成: 文件键=${fileKey}`);
    } catch (error) {
      Logger.error(`清除分块失败: ${fileKey}`, error);
      throw error;
    }
  }
  
  /**
   * 获取文件键目录路径
   * @param fileKey Figma文件键
   * @returns 目录路径
   */
  private getFileKeyDir(fileKey: string): string {
    return path.join(this.cacheDir, fileKey);
  }
  
  /**
   * 获取分块文件路径
   * @param fileKey Figma文件键
   * @param chunkId 分块ID
   * @returns 文件路径
   */
  private getChunkPath(fileKey: string, chunkId: string): string {
    return path.join(this.getFileKeyDir(fileKey), `${chunkId}.json`);
  }
  
  /**
   * 从分块ID中提取索引
   * @param chunkId 分块ID
   * @returns 索引
   */
  private extractChunkIndex(chunkId: string): number {
    const match = chunkId.match(/chunk-(\d+)-/);
    return match ? parseInt(match[1], 10) : 0;
  }
} 