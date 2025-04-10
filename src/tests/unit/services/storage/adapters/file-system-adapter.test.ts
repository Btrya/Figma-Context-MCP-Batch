/**
 * 文件系统存储适配器单元测试
 */

// 首先创建所有的模拟函数
const mockUnlink = jest.fn().mockResolvedValue(undefined);
const mockStat = jest.fn();
const mockReaddir = jest.fn().mockResolvedValue([]);
const mockRmdir = jest.fn().mockResolvedValue(undefined);
const mockEnsureDirectoryExists = jest.fn().mockResolvedValue(undefined);
const mockSafeWriteFile = jest.fn().mockResolvedValue(undefined);
const mockSafeReadFile = jest.fn();
const mockGenerateHashName = jest.fn().mockImplementation((id: string) => `hashed_${id}`);
const mockGetAllFiles = jest.fn();
const mockAcquireLock = jest.fn().mockResolvedValue(true);
const mockReleaseLock = jest.fn().mockResolvedValue(true);
const mockJoin = jest.fn().mockImplementation((...args: string[]) => args.join('/'));
const mockDirname = jest.fn().mockImplementation((p: string) => p.split('/').slice(0, -1).join('/'));

// 创建函数映射，绕过name属性限制
const mockFsUnlink = jest.fn();
const mockFsReaddir = jest.fn();
const mockFsStat = jest.fn();

// 模拟promisify的实现
jest.mock('util', () => ({
  promisify: jest.fn((fn) => {
    if (fn === mockFsUnlink) return mockUnlink;
    if (fn === mockFsReaddir) return mockReaddir;
    if (fn === mockFsStat) return mockStat;
    return jest.fn();
  })
}));

// 模拟fs模块
jest.mock('fs', () => ({
  constants: { F_OK: 0 },
  promises: {
    stat: mockStat,
    unlink: mockUnlink,
    readdir: mockReaddir,
    rmdir: mockRmdir
  },
  // 使用预先创建的函数
  unlink: mockFsUnlink,
  readdir: mockFsReaddir,
  stat: mockFsStat
}));

// 模拟path模块
jest.mock('path', () => ({
  join: (...args: string[]) => mockJoin(...args),
  dirname: (p: string) => mockDirname(p)
}));

// 模拟文件工具函数
jest.mock('~/utils/file-utils.js', () => ({
  ensureDirectoryExists: (...args: unknown[]) => mockEnsureDirectoryExists(...args),
  safeWriteFile: (...args: unknown[]) => mockSafeWriteFile(...args),
  safeReadFile: (...args: unknown[]) => mockSafeReadFile(...args),
  generateHashName: (...args: unknown[]) => mockGenerateHashName(...args),
  getAllFiles: (...args: unknown[]) => mockGetAllFiles(...args),
  acquireLock: (...args: unknown[]) => mockAcquireLock(...args),
  releaseLock: (...args: unknown[]) => mockReleaseLock(...args)
}));

// 然后导入被测试的模块和其他依赖
import { FileSystemAdapter } from '~/services/storage/adapters/file-system-adapter.js';
import { Chunk, ChunkType } from '~/services/storage/models/chunk.js';
import { FileSystemAdapterConfig } from '~/config/storage-config.js';

describe('FileSystemAdapter', () => {
  let adapter: FileSystemAdapter;
  let config: FileSystemAdapterConfig;
  
  beforeEach(() => {
    // 重置所有模拟
    jest.clearAllMocks();
    
    // 重新设置stat函数的行为模拟
    mockStat.mockImplementation((path: string) => {
      if (path.includes('hashed_test-id.json')) {
        return Promise.resolve({
          isFile: () => true
        });
      }
      return Promise.reject(new Error('Not found'));
    });
    
    // 创建测试配置
    config = {
      basePath: '/test/path',
      useLocks: true,
      lockTimeout: 1000,
      defaultTTL: 3600000,
      hashAlgorithm: 'md5',
      cleanupOnStart: false,
      cleanupInterval: 0
    };
    
    // 创建适配器实例
    adapter = new FileSystemAdapter(config);
  });
  
  describe('constructor', () => {
    it('should create base directory on initialization', () => {
      expect(mockEnsureDirectoryExists).toHaveBeenCalledWith(config.basePath);
    });
    
    it('should run cleanup on start if configured', () => {
      const cleanupSpy = jest.spyOn(FileSystemAdapter.prototype, 'cleanup').mockResolvedValue();
      const configWithCleanup = { ...config, cleanupOnStart: true };
      
      new FileSystemAdapter(configWithCleanup);
      
      expect(cleanupSpy).toHaveBeenCalled();
      cleanupSpy.mockRestore();
    });
    
    it('should setup cleanup interval if configured', () => {
      jest.useFakeTimers();
      const cleanupSpy = jest.spyOn(FileSystemAdapter.prototype, 'cleanup').mockResolvedValue();
      const configWithInterval = { ...config, cleanupInterval: 1000 };
      
      new FileSystemAdapter(configWithInterval);
      
      jest.advanceTimersByTime(1000);
      
      expect(cleanupSpy).toHaveBeenCalled();
      cleanupSpy.mockRestore();
      jest.useRealTimers();
    });
  });
  
  describe('saveChunk', () => {
    it('should write chunk to file system', async () => {
      const chunk: Chunk = {
        id: 'test-id',
        fileKey: 'test-file',
        type: ChunkType.METADATA,
        created: new Date(),
        lastAccessed: new Date(),
        data: { test: 'data' },
        links: []
      };
      
      await adapter.saveChunk(chunk);
      
      expect(mockAcquireLock).toHaveBeenCalled();
      expect(mockSafeWriteFile).toHaveBeenCalled();
      expect(mockReleaseLock).toHaveBeenCalled();
      
      // 验证文件路径
      const expectedPath = mockJoin(config.basePath, 'ha', 'hashed_test-id.json');
      expect(mockSafeWriteFile.mock.calls[0][0]).toBe(expectedPath);
    });
    
    it('should handle lock acquisition failure', async () => {
      mockAcquireLock.mockResolvedValueOnce(false);
      
      const chunk: Chunk = {
        id: 'test-id',
        fileKey: 'test-file',
        type: ChunkType.METADATA,
        created: new Date(),
        lastAccessed: new Date(),
        data: { test: 'data' },
        links: []
      };
      
      await expect(adapter.saveChunk(chunk)).resolves.not.toThrow();
    });
  });
  
  describe('getChunk', () => {
    it('should return null if file does not exist', async () => {
      mockSafeReadFile.mockResolvedValueOnce(null);
      
      const result = await adapter.getChunk('test-id');
      
      expect(result).toBeNull();
    });
    
    it('should return chunk if file exists and is not expired', async () => {
      const now = new Date();
      const future = new Date(now.getTime() + 10000);
      
      const chunk: Chunk = {
        id: 'test-id',
        fileKey: 'test-file',
        type: ChunkType.METADATA,
        created: now,
        expires: future,
        lastAccessed: now,
        data: { test: 'data' },
        links: []
      };
      
      const serialized = JSON.stringify(chunk, (key, value) => {
        if (value instanceof Date) {
          return { __date: true, value: value.toISOString() };
        }
        return value;
      });
      
      mockSafeReadFile.mockResolvedValueOnce(Buffer.from(serialized));
      
      const result = await adapter.getChunk('test-id');
      
      expect(result).not.toBeNull();
      expect(result?.id).toBe('test-id');
      expect(result?.fileKey).toBe('test-file');
      expect(result?.data).toEqual({ test: 'data' });
    });
    
    it('should delete and return null if chunk is expired', async () => {
      // 创建一个过期的日期 - 使用真正的过去时间
      const now = new Date();
      const past = new Date(now.getTime() - 10000);
      
      // 修改isExpired函数的实现，确保返回true
      jest.spyOn(adapter as any, 'isExpired').mockReturnValueOnce(true);
      
      const chunk: Chunk = {
        id: 'test-id',
        fileKey: 'test-file',
        type: ChunkType.METADATA,
        created: past,
        expires: past, // 已经过期
        lastAccessed: past,
        data: { test: 'data' },
        links: []
      };
      
      const serialized = JSON.stringify(chunk, (key, value) => {
        if (value instanceof Date) {
          return { __date: true, value: value.toISOString() };
        }
        return value;
      });
      
      mockSafeReadFile.mockResolvedValueOnce(Buffer.from(serialized));
      
      // 获取测试用的文件路径
      const filePath = mockJoin(config.basePath, 'ha', 'hashed_test-id.json');
      
      const result = await adapter.getChunk('test-id');
      
      expect(result).toBeNull();
      expect(mockUnlink).toHaveBeenCalledWith(filePath);
    });
  });
  
  describe('hasChunk', () => {
    it('should return true if file exists', async () => {
      // 模拟stat返回一个带有isFile方法的对象
      mockStat.mockResolvedValueOnce({
        isFile: () => true
      });
      
      const result = await adapter.hasChunk('test-id');
      
      expect(result).toBe(true);
      expect(mockStat).toHaveBeenCalledWith(mockJoin(config.basePath, 'ha', 'hashed_test-id.json'));
    });
    
    it('should return false if file does not exist', async () => {
      // 模拟stat返回一个错误
      mockStat.mockRejectedValueOnce(new Error('Not found'));
      
      const result = await adapter.hasChunk('test-id');
      
      expect(result).toBe(false);
      expect(mockStat).toHaveBeenCalledWith(mockJoin(config.basePath, 'ha', 'hashed_test-id.json'));
    });
  });
  
  describe('deleteChunk', () => {
    it('should delete file and return true on success', async () => {
      // 确保acquireLock成功返回
      mockAcquireLock.mockResolvedValueOnce(true);
      
      // 确保unlink成功返回
      mockUnlink.mockResolvedValueOnce(undefined);
      
      const result = await adapter.deleteChunk('test-id');
      
      expect(result).toBe(true);
      expect(mockAcquireLock).toHaveBeenCalledWith(expect.any(String), expect.any(Number));
      expect(mockUnlink).toHaveBeenCalledWith(mockJoin(config.basePath, 'ha', 'hashed_test-id.json'));
      expect(mockReleaseLock).toHaveBeenCalled();
    });
    
    it('should return false if file does not exist', async () => {
      // 确保acquireLock成功返回
      mockAcquireLock.mockResolvedValueOnce(true);
      
      // 模拟unlink失败的情况
      mockUnlink.mockRejectedValueOnce(new Error('Not found'));
      
      const result = await adapter.deleteChunk('test-id');
      
      expect(result).toBe(false);
      expect(mockAcquireLock).toHaveBeenCalledWith(expect.any(String), expect.any(Number));
      expect(mockUnlink).toHaveBeenCalledWith(mockJoin(config.basePath, 'ha', 'hashed_test-id.json'));
      expect(mockReleaseLock).toHaveBeenCalled();
    });
  });
}); 