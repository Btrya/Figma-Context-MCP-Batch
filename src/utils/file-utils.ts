/**
 * 文件操作工具函数
 * 提供文件系统操作的辅助函数
 */

import fs from 'fs';
import path from 'path';
import crypto from 'crypto';
import { promisify } from 'util';

// 将回调式API转换为Promise式API
const mkdir = promisify(fs.mkdir);
const writeFile = promisify(fs.writeFile);
const readFile = promisify(fs.readFile);
const stat = promisify(fs.stat);
const unlink = promisify(fs.unlink);
const readdir = promisify(fs.readdir);
const access = promisify(fs.access);

/**
 * 确保目录存在，如果不存在则创建
 * @param dirPath 目录路径
 * @returns Promise<void>
 */
export async function ensureDirectoryExists(dirPath: string): Promise<void> {
  try {
    await access(dirPath, fs.constants.F_OK);
  } catch (error) {
    // 目录不存在，创建它
    await mkdir(dirPath, { recursive: true });
  }
}

/**
 * 安全写入文件
 * 确保目录存在，并使用临时文件写入然后重命名，避免部分写入
 * 
 * @param filePath 文件路径
 * @param data 文件数据
 * @returns Promise<void>
 */
export async function safeWriteFile(filePath: string, data: string | Buffer): Promise<void> {
  const dirPath = path.dirname(filePath);
  const tempPath = `${filePath}.tmp`;
  
  await ensureDirectoryExists(dirPath);
  await writeFile(tempPath, data);
  
  try {
    // 在Windows上，如果目标文件已存在，fs.rename可能会失败
    // 所以先尝试删除目标文件
    await unlink(filePath).catch(() => {
      // 忽略文件不存在的错误
    });
    
    // Node.js在不同文件系统间重命名文件可能会失败
    // 使用原生的fs.renameSync，如果失败则使用复制后删除原文件的方式
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    // 重命名失败，使用读写方式复制
    const content = await readFile(tempPath);
    await writeFile(filePath, content);
    await unlink(tempPath).catch(() => {
      // 忽略删除临时文件可能的错误
    });
  }
}

/**
 * 安全读取文件
 * 读取文件，如果文件不存在则返回null
 * 
 * @param filePath 文件路径
 * @returns Promise<Buffer | null> 文件内容或null
 */
export async function safeReadFile(filePath: string): Promise<Buffer | null> {
  try {
    return await readFile(filePath);
  } catch (error) {
    return null;
  }
}

/**
 * 生成文件安全的哈希名称
 * 将字符串哈希化为文件系统安全的名称
 * 
 * @param input 输入字符串
 * @param algorithm 哈希算法，默认为md5
 * @returns 哈希后的字符串
 */
export function generateHashName(input: string, algorithm: 'md5' | 'sha1' | 'sha256' = 'md5'): string {
  return crypto.createHash(algorithm).update(input).digest('hex');
}

/**
 * 获取目录中的所有文件
 * 递归获取指定目录及其子目录中的所有文件
 * 
 * @param dirPath 目录路径
 * @param fileList 文件列表累积器（内部使用）
 * @returns Promise<string[]> 文件路径列表
 */
export async function getAllFiles(dirPath: string, fileList: string[] = []): Promise<string[]> {
  try {
    const files = await readdir(dirPath, { withFileTypes: true });
    
    for (const file of files) {
      const fullPath = path.join(dirPath, file.name);
      
      if (file.isDirectory()) {
        // 递归处理子目录
        await getAllFiles(fullPath, fileList);
      } else {
        fileList.push(fullPath);
      }
    }
    
    return fileList;
  } catch (error) {
    return fileList;
  }
}

/**
 * 创建简单的文件锁
 * @param lockPath 锁文件路径
 * @param timeout 锁超时时间（毫秒）
 * @returns Promise<boolean> 是否成功获取锁
 */
export async function acquireLock(lockPath: string, timeout: number): Promise<boolean> {
  try {
    // 尝试创建锁文件
    const lockContent = JSON.stringify({
      timestamp: Date.now(),
      pid: process.pid
    });
    
    // 检查是否已存在锁
    try {
      const lockStat = await stat(lockPath);
      const lockAge = Date.now() - lockStat.mtime.getTime();
      
      // 如果锁存在但已超时，则强制获取锁
      if (lockAge > timeout) {
        await safeWriteFile(lockPath, lockContent);
        return true;
      }
      
      // 锁存在且未超时，获取锁失败
      return false;
    } catch (error) {
      // 锁不存在，创建锁
      await safeWriteFile(lockPath, lockContent);
      return true;
    }
  } catch (error) {
    return false;
  }
}

/**
 * 释放文件锁
 * @param lockPath 锁文件路径
 * @returns Promise<boolean> 是否成功释放锁
 */
export async function releaseLock(lockPath: string): Promise<boolean> {
  try {
    await unlink(lockPath);
    return true;
  } catch (error) {
    return false;
  }
} 