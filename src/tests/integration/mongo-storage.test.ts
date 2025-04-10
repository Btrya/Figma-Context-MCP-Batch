/**
 * MongoDB存储适配器集成测试
 * 注意：这个测试需要一个运行中的MongoDB实例
 */

import { MongoAdapter } from '~/services/storage/adapters/mongo-adapter.js';
import { Chunk, ChunkType } from '~/services/storage/models/chunk.js';
import { MongoAdapterConfig } from '~/config/storage-config.js';
import { StorageManager } from '~/services/storage/storage-manager.js';

// 跳过集成测试，除非明确启用
const runIntegrationTests = process.env.RUN_INTEGRATION_TESTS === 'true' && process.env.SKIP_MONGO_TESTS !== 'true';

// 测试函数，用于检测MongoDB是否可用
async function isMongoAvailable(uri: string): Promise<boolean> {
  try {
    const { MongoClient } = await import('mongodb');
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 1000, // 快速超时以检测可用性
      connectTimeoutMS: 1000
    });
    
    await client.connect();
    await client.close();
    return true;
  } catch (error) {
    console.warn('MongoDB不可用，跳过集成测试。如需运行测试，请启动MongoDB实例。');
    return false;
  }
}

// 测试配置
const testConfig: MongoAdapterConfig = {
  uri: process.env.MONGO_TEST_URI || 'mongodb://localhost:27017',
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
  cleanupOnStart: true,
  cleanupInterval: 0
};

// 创建测试分片数据
function createTestChunk(id: string): Chunk {
  return {
    id,
    fileKey: 'test-file',
    type: ChunkType.NODE,
    data: { test: `data-${id}` },
    created: new Date(),
    lastAccessed: new Date(),
    links: []
  };
}

// 检测MongoDB可用性的结果
let mongoAvailable = false;

// 使用Jest的全局beforeAll跳过整个测试套件
beforeAll(async () => {
  if (runIntegrationTests) {
    mongoAvailable = await isMongoAvailable(testConfig.uri);
    
    // 如果MongoDB不可用，跳过整个测试套件
    if (!mongoAvailable) {
      // 使用console.log而不是console.warn确保消息更明显
      console.log('\n⚠️ MongoDB不可用，跳过所有MongoDB集成测试');
    }
  } else {
    console.log('\n⚠️ MongoDB集成测试未启用，设置RUN_INTEGRATION_TESTS=true以启用');
  }
}, 10000); // 增加超时时间，避免慢速网络问题

// 条件性描述整个测试套件
(runIntegrationTests && mongoAvailable ? describe : describe.skip)('MongoDB存储集成测试', () => {
  let adapter: MongoAdapter;
  
  // 在所有测试前设置
  beforeAll(async () => {
    adapter = new MongoAdapter(testConfig);
    
    // 清理测试集合
    await adapter.cleanup();
  });
  
  // 在所有测试后清理
  afterAll(async () => {
    await adapter.cleanup();
    await adapter.dispose();
  });
  
  // 在每个测试后清理
  afterEach(async () => {
    await adapter.cleanup();
  });
  
  // 现在不需要条件测试了，因为整个套件都在条件下运行
  it('应该成功存储和检索分片', async () => {
    const chunk = createTestChunk('test-1');
    
    // 存储分片
    await adapter.saveChunk(chunk);
    
    // 检查分片是否存在
    const exists = await adapter.hasChunk(chunk.id);
    expect(exists).toBe(true);
    
    // 检索分片
    const retrieved = await adapter.getChunk(chunk.id);
    expect(retrieved).not.toBeNull();
    
    if (retrieved) {
      expect(retrieved.id).toBe(chunk.id);
      expect(retrieved.fileKey).toBe(chunk.fileKey);
      expect(retrieved.type).toBe(chunk.type);
      expect(retrieved.data).toEqual(chunk.data);
      
      // 确保lastAccessed被更新
      expect(retrieved.lastAccessed.getTime()).toBeGreaterThanOrEqual(chunk.lastAccessed.getTime());
    }
  });
  
  it('应该成功删除分片', async () => {
    const chunk = createTestChunk('test-2');
    
    // 存储分片
    await adapter.saveChunk(chunk);
    
    // 检查分片是否存在
    let exists = await adapter.hasChunk(chunk.id);
    expect(exists).toBe(true);
    
    // 删除分片
    const deleted = await adapter.deleteChunk(chunk.id);
    expect(deleted).toBe(true);
    
    // 确认分片已删除
    exists = await adapter.hasChunk(chunk.id);
    expect(exists).toBe(false);
    
    // 尝试获取已删除的分片
    const retrieved = await adapter.getChunk(chunk.id);
    expect(retrieved).toBeNull();
  });
  
  it('应该成功列出所有分片', async () => {
    // 创建多个测试分片
    const chunks = [
      createTestChunk('list-test-1'),
      createTestChunk('list-test-2'),
      createTestChunk('list-test-3')
    ];
    
    // 设置不同的分片类型
    chunks[1].type = ChunkType.METADATA;
    chunks[2].type = ChunkType.GLOBAL_VARS;
    
    // 存储所有分片
    for (const chunk of chunks) {
      await adapter.saveChunk(chunk);
    }
    
    // 列出所有分片
    const allChunks = await adapter.listChunks();
    expect(allChunks.length).toBeGreaterThanOrEqual(3);
    
    // 按类型过滤
    const nodeChunks = await adapter.listChunks({ type: ChunkType.NODE });
    expect(nodeChunks.some(c => c.id === 'list-test-1')).toBe(true);
    
    const metadataChunks = await adapter.listChunks({ type: ChunkType.METADATA });
    expect(metadataChunks.some(c => c.id === 'list-test-2')).toBe(true);
  });
  
  it('应该成功批量保存分片', async () => {
    // 创建多个测试分片
    const chunks = [
      createTestChunk('bulk-test-1'),
      createTestChunk('bulk-test-2'),
      createTestChunk('bulk-test-3')
    ];
    
    // 批量存储分片
    await adapter.bulkSaveChunks(chunks);
    
    // 验证所有分片都已存储
    for (const chunk of chunks) {
      const exists = await adapter.hasChunk(chunk.id);
      expect(exists).toBe(true);
    }
  });
  
  it('应该能与StorageManager集成', async () => {
    // 创建带有MongoDB适配器的StorageManager
    const storageManager = new StorageManager({
      defaultAdapter: 'mongo',
      mongo: testConfig
    });
    
    const chunk = createTestChunk('sm-test-1');
    
    // 使用StorageManager存储分片
    await storageManager.saveChunk(chunk, 'mongo');
    
    // 检查分片是否存在
    const exists = await storageManager.hasChunk(chunk.id, 'mongo');
    expect(exists).toBe(true);
    
    // 检索分片
    const retrieved = await storageManager.getChunk(chunk.id, 'mongo');
    expect(retrieved).not.toBeNull();
    
    if (retrieved) {
      expect(retrieved.id).toBe(chunk.id);
    }
    
    // 清理
    storageManager.dispose();
  });
}); 