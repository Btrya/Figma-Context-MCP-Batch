/**
 * Redis存储适配器单元测试
 */

import { RedisAdapter } from '~/services/storage/adapters/redis-adapter.js';
import { Chunk, ChunkType } from '~/services/storage/models/chunk.js';
import { RedisAdapterConfig } from '~/config/storage-config.js';

// 创建管道模拟
const createMockPipeline = () => {
  const pipeline = {
    setex: jest.fn().mockReturnThis(),
    sadd: jest.fn().mockReturnThis(),
    del: jest.fn().mockReturnThis(),
    srem: jest.fn().mockReturnThis(),
    get: jest.fn().mockReturnThis(),
    exec: jest.fn().mockResolvedValue([
      [null, 1], // 第一个操作的结果 [错误, 结果]
      [null, 1]  // 第二个操作的结果
    ])
  };
  return pipeline;
};

// 创建模拟的 Redis 客户端对象
const mockRedisClient = {
  on: jest.fn(function(event, callback) {
    if (event === 'ready') {
      setTimeout(() => callback(), 0);
    }
    return this;
  }),
  quit: jest.fn().mockResolvedValue(undefined),
  set: jest.fn().mockResolvedValue('OK'),
  setex: jest.fn().mockResolvedValue('OK'),
  get: jest.fn(),
  exists: jest.fn(),
  del: jest.fn(),
  keys: jest.fn(),
  expire: jest.fn().mockResolvedValue(1),
  pipeline: jest.fn().mockImplementation(() => createMockPipeline()),
  sadd: jest.fn().mockResolvedValue(1),
  srem: jest.fn().mockResolvedValue(1),
  smembers: jest.fn().mockResolvedValue([])
};

// 模拟 ioredis 模块
jest.mock('ioredis', () => {
  // 创建一个模拟的 Redis 构造函数
  const MockRedis = jest.fn().mockImplementation(() => mockRedisClient);
  
  // 模拟 Cluster 构造函数
  const MockCluster = jest.fn().mockImplementation(() => mockRedisClient);
  
  // 返回包含所有需要的导出
  return {
    __esModule: true,
    default: MockRedis,
    Redis: MockRedis,
    Cluster: MockCluster
  };
});

// 测试配置
const testConfig: RedisAdapterConfig = {
  connection: {
    host: 'localhost',
    port: 6379
  },
  connectTimeout: 5000,
  commandTimeout: 3000,
  keyPrefix: 'test:',
  defaultTTL: 86400, // 1天
  retryStrategy: {
    maxRetryCount: 3,
    retryInterval: 1000
  }
};

describe('RedisAdapter', () => {
  // 在每次测试前重置模拟函数
  beforeEach(() => {
    jest.clearAllMocks();
    mockRedisClient.get.mockReset();
    mockRedisClient.set.mockReset();
    mockRedisClient.exists.mockReset();
    mockRedisClient.keys.mockReset();
    mockRedisClient.del.mockReset();
    mockRedisClient.smembers.mockReset();
    
    // 设置默认行为
    mockRedisClient.set.mockResolvedValue('OK');
    mockRedisClient.get.mockResolvedValue(null);
    mockRedisClient.exists.mockResolvedValue(1);
    mockRedisClient.del.mockResolvedValue(1);
    mockRedisClient.keys.mockResolvedValue([]);
    mockRedisClient.smembers.mockResolvedValue([]);
  });

  describe('constructor', () => {
    it('应该正确初始化RedisAdapter', () => {
      const adapter = new RedisAdapter(testConfig);
      expect(adapter).toBeInstanceOf(RedisAdapter);
    });
  });

  describe('saveChunk', () => {
    it('应该成功保存块数据', async () => {
      const adapter = new RedisAdapter(testConfig);
      const chunk: Chunk = {
        id: 'test-id',
        fileKey: 'test-file',
        type: ChunkType.NODE,
        data: { test: 'data' },
        created: new Date(),
        lastAccessed: new Date(),
        links: []
      };

      await adapter.saveChunk(chunk);
      
      expect(mockRedisClient.pipeline).toHaveBeenCalled();
    });
  });

  describe('getChunk', () => {
    it('应该成功获取存在的块', async () => {
      const adapter = new RedisAdapter(testConfig);
      
      // 直接设置序列化后的JSON字符串，模拟Redis返回
      mockRedisClient.get.mockResolvedValue(JSON.stringify({
        id: 'test-id',
        fileKey: 'test-file',
        type: 'node', // 使用字符串而不是枚举
        data: { test: 'data' },
        created: { __date: true, value: '2023-01-01T00:00:00.000Z' },
        lastAccessed: { __date: true, value: '2023-01-01T00:00:00.000Z' },
        links: []
      }));
      
      const result = await adapter.getChunk('test-id');
      
      expect(mockRedisClient.get).toHaveBeenCalled();
      expect(result).not.toBeNull();
      
      if (result) {
        // 验证基本字段
        expect(result.id).toBe('test-id');
        expect(result.fileKey).toBe('test-file');
        expect(result.type).toBe(ChunkType.NODE);
        expect(result.data).toEqual({ test: 'data' });
        expect(result.links).toEqual([]);
        
        // 验证日期字段
        expect(result.created).toBeInstanceOf(Date);
        expect(result.lastAccessed).toBeInstanceOf(Date);
        expect(result.created.toISOString()).toBe('2023-01-01T00:00:00.000Z');
      }
    });

    it('应该返回null当块不存在时', async () => {
      const adapter = new RedisAdapter(testConfig);
      mockRedisClient.get.mockResolvedValue(null);
      
      const result = await adapter.getChunk('non-existent');
      
      expect(mockRedisClient.get).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('hasChunk', () => {
    it('应该返回true当块存在时', async () => {
      const adapter = new RedisAdapter(testConfig);
      mockRedisClient.exists.mockResolvedValue(1);
      
      const result = await adapter.hasChunk('test-id');
      
      expect(mockRedisClient.exists).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('应该返回false当块不存在时', async () => {
      const adapter = new RedisAdapter(testConfig);
      mockRedisClient.exists.mockResolvedValue(0);
      
      const result = await adapter.hasChunk('non-existent');
      
      expect(mockRedisClient.exists).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('deleteChunk', () => {
    it('应该成功删除块', async () => {
      const adapter = new RedisAdapter(testConfig);
      
      // 创建一个确定的日期
      const fixedDate = new Date('2023-01-01T00:00:00Z');
      
      // 模拟获取块
      const chunk: Chunk = {
        id: 'test-id',
        fileKey: 'test-file',
        type: ChunkType.NODE,
        data: { test: 'data' },
        created: fixedDate,
        lastAccessed: fixedDate,
        links: []
      };
      
      mockRedisClient.get.mockImplementation(() => {
        return Promise.resolve(JSON.stringify(chunk, (key, value) => {
          if (value instanceof Date) {
            return { __date: true, value: value.toISOString() };
          }
          return value;
        }));
      });
      
      const result = await adapter.deleteChunk('test-id');
      
      expect(mockRedisClient.pipeline).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('应该返回false当块不存在时', async () => {
      const adapter = new RedisAdapter(testConfig);
      mockRedisClient.get.mockResolvedValue(null);
      
      const result = await adapter.deleteChunk('non-existent');
      
      expect(mockRedisClient.get).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('listChunks', () => {
    it('应该返回所有块的摘要信息', async () => {
      const adapter = new RedisAdapter(testConfig);
      const ids = ['test-id-1', 'test-id-2'];
      
      // 创建一个确定的日期
      const fixedDate = new Date('2023-01-01T00:00:00Z').toISOString();
      
      // 模拟 smembers 返回 ID 列表
      mockRedisClient.smembers.mockResolvedValue(ids);
      
      // 模拟 pipeline.exec 返回块数据
      const mockPipeline = createMockPipeline();
      mockPipeline.exec.mockResolvedValue([
        [null, JSON.stringify({
          id: 'test-id-1',
          fileKey: 'test-file',
          type: ChunkType.NODE,
          data: { test: 'data1' },
          created: { __date: true, value: fixedDate },
          lastAccessed: { __date: true, value: fixedDate },
          links: []
        })],
        [null, JSON.stringify({
          id: 'test-id-2',
          fileKey: 'test-file',
          type: ChunkType.NODE,
          data: { test: 'data2' },
          created: { __date: true, value: fixedDate },
          lastAccessed: { __date: true, value: fixedDate },
          links: []
        })]
      ]);
      
      mockRedisClient.pipeline.mockImplementation(() => mockPipeline);
      
      const result = await adapter.listChunks();
      
      expect(mockRedisClient.smembers).toHaveBeenCalled();
      expect(mockRedisClient.pipeline).toHaveBeenCalled();
      expect(mockPipeline.get).toHaveBeenCalledTimes(2);
      expect(mockPipeline.exec).toHaveBeenCalled();
      expect(result).toHaveLength(2);
    });
  });
}); 