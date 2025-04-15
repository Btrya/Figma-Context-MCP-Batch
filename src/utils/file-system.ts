import fs from 'fs';
import path from 'path';
import { Logger } from './logger.js';

/**
 * 文件系统工具类
 */
export class FileSystem {
  /**
   * 确保目录存在，如果不存在则创建
   * @param dirPath 目录路径
   */
  static ensureDir(dirPath: string): void {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
        Logger.debug(`创建目录: ${dirPath}`);
      }
    } catch (error) {
      Logger.error(`创建目录失败: ${dirPath}`, error);
      throw error;
    }
  }

  /**
   * 写入JSON文件
   * @param filePath 文件路径
   * @param data 要写入的数据
   */
  static writeJsonFile(filePath: string, data: any): void {
    try {
      const dirPath = path.dirname(filePath);
      this.ensureDir(dirPath);
      
      const jsonContent = JSON.stringify(data, null, 2);
      fs.writeFileSync(filePath, jsonContent, 'utf8');
      Logger.debug(`写入文件: ${filePath}`);
    } catch (error) {
      Logger.error(`写入文件失败: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 读取JSON文件
   * @param filePath 文件路径
   * @returns 文件内容对象，如果文件不存在则返回null
   */
  static readJsonFile<T>(filePath: string): T | null {
    try {
      if (!fs.existsSync(filePath)) {
        Logger.debug(`文件不存在: ${filePath}`);
        return null;
      }
      
      const content = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(content) as T;
    } catch (error) {
      Logger.error(`读取文件失败: ${filePath}`, error);
      return null;
    }
  }

  /**
   * 删除文件
   * @param filePath 文件路径
   */
  static deleteFile(filePath: string): void {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        Logger.debug(`删除文件: ${filePath}`);
      }
    } catch (error) {
      Logger.error(`删除文件失败: ${filePath}`, error);
      throw error;
    }
  }

  /**
   * 列出目录中的所有文件
   * @param dirPath 目录路径
   * @param extension 可选的文件扩展名过滤
   * @returns 文件路径列表
   */
  static listFiles(dirPath: string, extension?: string): string[] {
    try {
      if (!fs.existsSync(dirPath)) {
        return [];
      }
      
      const files = fs.readdirSync(dirPath);
      return files
        .filter(file => !extension || file.endsWith(extension))
        .map(file => path.join(dirPath, file));
    } catch (error) {
      Logger.error(`列出目录失败: ${dirPath}`, error);
      return [];
    }
  }

  /**
   * 获取文件最后修改时间
   * @param filePath 文件路径
   * @returns 最后修改时间的时间戳，如果文件不存在则返回0
   */
  static getFileModifiedTime(filePath: string): number {
    try {
      if (!fs.existsSync(filePath)) {
        return 0;
      }
      
      const stats = fs.statSync(filePath);
      return stats.mtimeMs;
    } catch (error) {
      Logger.error(`获取文件时间失败: ${filePath}`, error);
      return 0;
    }
  }
} 