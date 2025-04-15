import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { jest } from '@jest/globals';
import { FigmaCacheManager } from '../../../../services/figma/figma-cache-manager.js';
import { FileSystem } from '../../../../utils/file-system.js';
import { Logger } from '../../../../utils/logger.js';
import path from 'path';
import { FigmaChunk } from '../../../../models/figma/figma-chunk.js';

// 模拟 FileSystem
jest.mock('../../../../utils/file-system.js', () => ({
  FileSystem: {
    ensureDir: jest.fn(),
    writeJsonFile: jest.fn(),
    readJsonFile: jest.fn(),
    deleteFile: jest.fn(),
    listFiles: jest.fn().mockReturnValue([])
  }
}));

// 模拟 Logger
jest.mock('../../../../utils/logger.js', () => ({
  Logger: {
    info: jest.fn(),
    debug: jest.fn(),
    warn: jest.fn(),
    error: jest.fn()
  }
}));

describe('FigmaCacheManager', () => {
  const TEST_CACHE_DIR = '.test-cache';
  let cacheManager: FigmaCacheManager;
  
  beforeEach(() => {
    jest.resetAllMocks();
    cacheManager = new FigmaCacheManager(TEST_CACHE_DIR);
    jest.clearAllMocks(); // 清除构造函数中的调用记录
  });
  
  afterEach(() => {
    jest.clearAllMocks();
  });
  
  it('应该在初始化时创建缓存目录', () => {
    // 重新创建以便测试构造函数
    new FigmaCacheManager(TEST_CACHE_DIR);
    expect(FileSystem.ensureDir).toHaveBeenCalledWith(TEST_CACHE_DIR);
    expect(Logger.info).toHaveBeenCalled();
  });
  
  describe('路径生成', () => {
    it('应该正确生成文件键目录路径', async () => {
      const fileKey = 'test-file-key';
      const expectedPath = path.join(TEST_CACHE_DIR, fileKey);
      
      // 缓存一个分块来触发内部的 getFileKeyDir 方法
      const testChunk: FigmaChunk = {
        chunkId: 'test-chunk-id',
        fileKey,
        totalChunks: 1,
        nodes: []
      };
      
      await cacheManager.cacheChunks(fileKey, [testChunk]);
      
      expect(FileSystem.ensureDir).toHaveBeenCalledWith(expectedPath);
    });
    
    it('应该正确生成分块文件路径', async () => {
      const fileKey = 'test-file-key';
      const chunkId = 'test-chunk-id';
      const expectedPath = path.join(TEST_CACHE_DIR, fileKey, `${chunkId}.json`);
      
      // 缓存分块以触发内部的 getChunkPath 方法
      const testChunk: FigmaChunk = {
        chunkId,
        fileKey,
        totalChunks: 1,
        nodes: []
      };
      
      await cacheManager.cacheChunk(fileKey, testChunk);
      
      expect(FileSystem.writeJsonFile).toHaveBeenCalledWith(expectedPath, testChunk);
    });
  });
  
  describe('缓存操作', () => {
    it('应该缓存单个分块', async () => {
      const fileKey = 'test-file-key';
      const testChunk: FigmaChunk = {
        chunkId: 'test-chunk-id',
        fileKey,
        totalChunks: 1,
        nodes: [{ id: 'node1', name: 'Node 1', type: 'TEXT' }]
      };
      
      await cacheManager.cacheChunk(fileKey, testChunk);
      
      expect(FileSystem.writeJsonFile).toHaveBeenCalled();
      expect(Logger.debug).toHaveBeenCalled();
    });
    
    it('应该缓存多个分块', async () => {
      const fileKey = 'test-file-key';
      const testChunks: FigmaChunk[] = [
        {
          chunkId: 'chunk-1',
          fileKey,
          totalChunks: 2,
          nodes: [{ id: 'node1', name: 'Node 1', type: 'TEXT' }]
        },
        {
          chunkId: 'chunk-2',
          fileKey,
          totalChunks: 2,
          nodes: [{ id: 'node2', name: 'Node 2', type: 'RECTANGLE' }]
        }
      ];
      
      await cacheManager.cacheChunks(fileKey, testChunks);
      
      expect(FileSystem.ensureDir).toHaveBeenCalled();
      expect(FileSystem.writeJsonFile).toHaveBeenCalledTimes(2);
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('缓存分块完成'));
    });
  });
  
  describe('读取操作', () => {
    it('应该获取单个分块', async () => {
      const fileKey = 'test-file-key';
      const chunkId = 'test-chunk-id';
      const testChunk: FigmaChunk = {
        chunkId,
        fileKey,
        totalChunks: 1,
        nodes: [{ id: 'node1', name: 'Node 1', type: 'TEXT' }]
      };
      
      (FileSystem.readJsonFile as jest.Mock).mockReturnValueOnce(testChunk);
      
      const cachedChunk = await cacheManager.getChunk(fileKey, chunkId);
      
      expect(cachedChunk).toEqual(testChunk);
      expect(FileSystem.readJsonFile).toHaveBeenCalled();
    });
    
    it('应该返回null当分块不存在时', async () => {
      const fileKey = 'test-file-key';
      const chunkId = 'non-existent-chunk';
      
      (FileSystem.readJsonFile as jest.Mock).mockImplementationOnce(() => {
        throw new Error('不存在');
      });
      
      const cachedChunk = await cacheManager.getChunk(fileKey, chunkId);
      
      expect(cachedChunk).toBeNull();
      expect(Logger.error).toHaveBeenCalled();
    });
    
    it('应该获取所有分块', async () => {
      const fileKey = 'test-file-key';
      const testChunks: FigmaChunk[] = [
        {
          chunkId: 'chunk-1-abc',
          fileKey,
          totalChunks: 2,
          nodes: [{ id: 'node1', name: 'Node 1', type: 'TEXT' }]
        },
        {
          chunkId: 'chunk-0-def',
          fileKey,
          totalChunks: 2,
          nodes: [{ id: 'node2', name: 'Node 2', type: 'RECTANGLE' }]
        }
      ];
      
      // 模拟 listFiles 返回两个文件
      (FileSystem.listFiles as jest.Mock).mockReturnValueOnce([
        path.join(TEST_CACHE_DIR, fileKey, 'chunk-1-abc.json'),
        path.join(TEST_CACHE_DIR, fileKey, 'chunk-0-def.json')
      ]);
      
      // 模拟 readJsonFile 依次返回两个分块
      (FileSystem.readJsonFile as jest.Mock)
        .mockReturnValueOnce(testChunks[0])
        .mockReturnValueOnce(testChunks[1]);
      
      const cachedChunks = await cacheManager.getAllChunks(fileKey);
      
      // 分块应该按照索引排序（0在前，1在后）
      expect(cachedChunks.length).toBe(2);
      expect(cachedChunks[0].chunkId).toBe('chunk-0-def');
      expect(cachedChunks[1].chunkId).toBe('chunk-1-abc');
    });
  });
  
  describe('判断和清除操作', () => {
    it('应该判断分块是否存在', async () => {
      const fileKey = 'test-file-key';
      const chunkId = 'test-chunk-id';
      
      // 模拟存在的情况
      (FileSystem.readJsonFile as jest.Mock).mockReturnValueOnce({});
      let exists = await cacheManager.hasChunk(fileKey, chunkId);
      expect(exists).toBe(true);
      
      // 模拟不存在的情况
      (FileSystem.readJsonFile as jest.Mock).mockImplementationOnce(() => {
        throw new Error('不存在');
      });
      exists = await cacheManager.hasChunk(fileKey, chunkId);
      expect(exists).toBe(false);
    });
    
    it('应该清除所有分块', async () => {
      const fileKey = 'test-file-key';
      
      // 模拟 listFiles 返回两个文件
      (FileSystem.listFiles as jest.Mock).mockReturnValueOnce([
        path.join(TEST_CACHE_DIR, fileKey, 'chunk-1.json'),
        path.join(TEST_CACHE_DIR, fileKey, 'chunk-2.json')
      ]);
      
      await cacheManager.clearChunks(fileKey);
      
      // 应该调用两次 deleteFile
      expect(FileSystem.deleteFile).toHaveBeenCalledTimes(2);
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('清除分块完成'));
    });
  });
}); 