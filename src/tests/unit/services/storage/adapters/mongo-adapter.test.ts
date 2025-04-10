/**
 * MongoDB存储适配器单元测试
 */

import { MongoAdapter } from '~/services/storage/adapters/mongo-adapter.js';
import { Chunk, ChunkType } from '~/services/storage/models/chunk.js';
import { MongoAdapterConfig } from '~/config/storage-config.js';

// 创建模拟的MongoDB客户端对象
const mockCollection = {
  createIndex: jest.fn().mockResolvedValue('index1'),
  updateOne: jest.fn().mockResolvedValue({ acknowledged: true, modifiedCount: 1, upsertedCount: 0 }),
  findOne: jest.fn(),
  countDocuments: jest.fn(),
  deleteOne: jest.fn(),
  deleteMany: jest.fn().mockResolvedValue({ acknowledged: true, deletedCount: 1 }),
  find: jest.fn(),
  bulkWrite: jest.fn().mockResolvedValue({ ok: 1 }),
  aggregate: jest.fn().mockImplementation(() => ({
    toArray: jest.fn().mockResolvedValue([])
  }))
};

// 模拟find返回值
mockCollection.find.mockImplementation(() => ({
  sort: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  project: jest.fn().mockReturnThis(),
  toArray: jest.fn().mockResolvedValue([])
}));

const mockDb = {
  collection: jest.fn().mockReturnValue(mockCollection)
};

const mockClient = {
  connect: jest.fn().mockResolvedValue(undefined),
  db: jest.fn().mockReturnValue(mockDb),
  close: jest.fn().mockResolvedValue(undefined)
};

// 模拟 mongodb 模块
jest.mock('mongodb', () => {
  return {
    MongoClient: jest.fn().mockImplementation(() => mockClient)
  };
});

// 测试配置
const testConfig: MongoAdapterConfig = {
  uri: 'mongodb://localhost:27017',
  database: 'figma_test',
  collection: 'chunks_test',
  options: {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 1000,
    connectTimeoutMS: 2000,
    socketTimeoutMS: 5000
  },
  defaultTTL: 86400, // 1天
  retryStrategy: {
    maxRetryCount: 3,
    retryInterval: 1000
  },
  cleanupOnStart: false,
  cleanupInterval: 0
};

describe('MongoAdapter', () => {
  // 在每次测试前重置模拟函数
  beforeEach(() => {
    jest.clearAllMocks();
    mockCollection.findOne.mockReset();
    mockCollection.countDocuments.mockReset();
    mockCollection.deleteOne.mockReset();
    
    // 设置默认行为
    mockCollection.findOne.mockResolvedValue(null);
    mockCollection.countDocuments.mockResolvedValue(0);
    mockCollection.deleteOne.mockResolvedValue({ acknowledged: true, deletedCount: 0 });
  });

  describe('constructor', () => {
    it('应该正确初始化MongoAdapter', () => {
      const adapter = new MongoAdapter(testConfig);
      expect(adapter).toBeInstanceOf(MongoAdapter);
    });
  });

  describe('saveChunk', () => {
    it('应该成功保存块数据', async () => {
      const adapter = new MongoAdapter(testConfig);
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
      
      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockCollection.updateOne).toHaveBeenCalled();
    });
  });

  describe('getChunk', () => {
    it('应该成功获取存在的块', async () => {
      const adapter = new MongoAdapter(testConfig);
      
      const created = new Date('2023-01-01T00:00:00.000Z');
      const lastAccessed = new Date('2023-01-01T00:00:00.000Z');
      
      // 模拟返回的文档
      mockCollection.findOne.mockResolvedValue({
        _id: 'test-id',
        fileKey: 'test-file',
        type: 'node',
        data: { test: 'data' },
        created,
        lastAccessed,
        links: [],
        size: 100
      });
      
      const result = await adapter.getChunk('test-id');
      
      expect(mockCollection.findOne).toHaveBeenCalled();
      expect(result).not.toBeNull();
      
      if (result) {
        expect(result.id).toBe('test-id');
        expect(result.fileKey).toBe('test-file');
        expect(result.type).toBe(ChunkType.NODE);
        expect(result.data).toEqual({ test: 'data' });
        expect(result.links).toEqual([]);
        expect(result.created).toEqual(created);
        expect(result.lastAccessed).not.toEqual(lastAccessed); // 应该被更新为当前时间
      }
    });

    it('应该返回null当块不存在时', async () => {
      const adapter = new MongoAdapter(testConfig);
      mockCollection.findOne.mockResolvedValue(null);
      
      const result = await adapter.getChunk('non-existent');
      
      expect(mockCollection.findOne).toHaveBeenCalled();
      expect(result).toBeNull();
    });
  });

  describe('hasChunk', () => {
    it('应该返回true当块存在时', async () => {
      const adapter = new MongoAdapter(testConfig);
      mockCollection.countDocuments.mockResolvedValue(1);
      
      const result = await adapter.hasChunk('test-id');
      
      expect(mockCollection.countDocuments).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('应该返回false当块不存在时', async () => {
      const adapter = new MongoAdapter(testConfig);
      mockCollection.countDocuments.mockResolvedValue(0);
      
      const result = await adapter.hasChunk('non-existent');
      
      expect(mockCollection.countDocuments).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('deleteChunk', () => {
    it('应该成功删除块', async () => {
      const adapter = new MongoAdapter(testConfig);
      mockCollection.deleteOne.mockResolvedValue({ acknowledged: true, deletedCount: 1 });
      
      const result = await adapter.deleteChunk('test-id');
      
      expect(mockCollection.deleteOne).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('应该返回false当块不存在时', async () => {
      const adapter = new MongoAdapter(testConfig);
      mockCollection.deleteOne.mockResolvedValue({ acknowledged: true, deletedCount: 0 });
      
      const result = await adapter.deleteChunk('non-existent');
      
      expect(mockCollection.deleteOne).toHaveBeenCalled();
      expect(result).toBe(false);
    });
  });

  describe('listChunks', () => {
    it('应该返回空数组当没有块时', async () => {
      const adapter = new MongoAdapter(testConfig);
      const findMock = mockCollection.find.mockImplementationOnce(() => ({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        project: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue([])
      }));
      
      const result = await adapter.listChunks();
      
      expect(mockCollection.find).toHaveBeenCalled();
      expect(result).toHaveLength(0);
    });

    it('应该返回块摘要列表', async () => {
      const adapter = new MongoAdapter(testConfig);
      
      // 创建一个确定的日期
      const fixedDate = new Date('2023-01-01T00:00:00Z');
      
      const chunksData = [
        {
          _id: 'test-id-1',
          fileKey: 'test-file',
          type: 'node',
          created: fixedDate,
          size: 100
        },
        {
          _id: 'test-id-2',
          fileKey: 'test-file',
          type: 'metadata',
          created: fixedDate,
          size: 200
        }
      ];
      
      const findMock = mockCollection.find.mockImplementationOnce(() => ({
        sort: jest.fn().mockReturnThis(),
        limit: jest.fn().mockReturnThis(),
        project: jest.fn().mockReturnThis(),
        toArray: jest.fn().mockResolvedValue(chunksData)
      }));
      
      const result = await adapter.listChunks();
      
      expect(mockCollection.find).toHaveBeenCalled();
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('test-id-1');
      expect(result[1].id).toBe('test-id-2');
      expect(result[0].type).toBe(ChunkType.NODE);
      expect(result[1].type).toBe(ChunkType.METADATA);
    });
  });

  describe('cleanup', () => {
    it('应该删除过期的块', async () => {
      const adapter = new MongoAdapter(testConfig);
      
      await adapter.cleanup();
      
      expect(mockCollection.deleteMany).toHaveBeenCalled();
      // 验证查询条件包含过期时间比较
      expect(mockCollection.deleteMany.mock.calls[0][0]).toHaveProperty('expires');
    });
  });

  // 测试其他特有方法
  describe('bulkSaveChunks', () => {
    it('应该成功批量保存块数据', async () => {
      const adapter = new MongoAdapter(testConfig);
      const chunks: Chunk[] = [
        {
          id: 'test-id-1',
          fileKey: 'test-file',
          type: ChunkType.NODE,
          data: { test: 'data1' },
          created: new Date(),
          lastAccessed: new Date(),
          links: []
        },
        {
          id: 'test-id-2',
          fileKey: 'test-file',
          type: ChunkType.METADATA,
          data: { test: 'data2' },
          created: new Date(),
          lastAccessed: new Date(),
          links: []
        }
      ];

      await adapter.bulkSaveChunks(chunks);
      
      expect(mockClient.connect).toHaveBeenCalled();
      expect(mockCollection.bulkWrite).toHaveBeenCalled();
      expect(mockCollection.bulkWrite.mock.calls[0][0]).toHaveLength(2);
    });
    
    it('应该不执行操作当chunks数组为空时', async () => {
      const adapter = new MongoAdapter(testConfig);
      await adapter.bulkSaveChunks([]);
      
      expect(mockCollection.bulkWrite).not.toHaveBeenCalled();
    });
  });
}); 