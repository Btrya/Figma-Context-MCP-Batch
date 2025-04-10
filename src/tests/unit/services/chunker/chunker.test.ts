/**
 * Chunker类单元测试
 */

import { Chunker, ChunkerConfig } from '../../../../services/chunker/chunker.js';
import { ChunkType } from '../../../../services/storage/models/chunk.js';
import { ChunkingStrategy } from '../../../../services/chunker/strategies/chunking-strategy.js';
import { ChunkingContext } from '../../../../services/chunker/chunking-context.js';
import { ChunkResult } from '../../../../models/chunker/chunk-result.js';
import { sampleNode } from '../../../fixtures/figma-files/sample-node.js';
import { sampleMetadata } from '../../../fixtures/figma-files/sample-metadata.js';
import { sampleVariables } from '../../../fixtures/figma-files/sample-variables.js';

// 为测试准备修改后的样本数据
const testMetadata = { 
  name: "测试设计文件",
  lastModified: "2023-05-15T10:30:45Z",
  version: "2.0.0",
  schemaVersion: 14.0,
  thumbnailUrl: "https://example.com/thumbnail.png",
  documentationLinks: [
    { title: "使用指南", url: "https://example.com/guide" },
    { title: "设计规范", url: "https://example.com/specs" }
  ],
  editorType: "figma",
  linkAccess: "view",
  createdAt: "2023-01-10T08:15:30Z",
  branches: ["main", "feature-a", "feature-b"],
  
  components: {
    "4:1": { name: "按钮/主要", description: "主要按钮组件" },
    "4:2": { name: "按钮/次要", description: "次要按钮组件" },
    "4:3": { name: "图标/添加", description: "添加图标" }
  },
  
  styles: {
    "5:1": { name: "颜色/主要", description: "主要品牌色" },
    "5:2": { name: "颜色/次要", description: "次要品牌色" },
    "5:3": { name: "文本/标题", description: "标题文本样式" }
  }
};

// 为测试准备全局变量样本
const testVariables = {
  variables: { ...sampleVariables }
};

// Mock jest功能
const mockFn = () => {
  const fn = (...args: any[]) => {
    fn.mock.calls.push(args);
    return fn.mockReturnValue;
  };
  fn.mock = {
    calls: [],
  };
  fn.mockReturnValue = undefined;
  fn.mockResolvedValue = (value: any) => {
    fn.mockReturnValue = Promise.resolve(value);
    return fn;
  };
  fn.mockImplementation = (implementation: (...args: any[]) => any) => {
    const originalFn = fn;
    const newFn = (...args: any[]) => {
      newFn.mock.calls.push(args);
      return implementation(...args);
    };
    newFn.mock = originalFn.mock;
    newFn.mockReturnValue = originalFn.mockReturnValue;
    newFn.mockResolvedValue = originalFn.mockResolvedValue;
    newFn.mockImplementation = originalFn.mockImplementation;
    return newFn;
  };
  return fn;
};

// 自定义测试策略
class MockStrategy implements ChunkingStrategy {
  private type: ChunkType;
  private mockChunkFn: ReturnType<typeof mockFn>;

  constructor(type: ChunkType, mockChunkFn: ReturnType<typeof mockFn>) {
    this.type = type;
    this.mockChunkFn = mockChunkFn;
  }

  async chunk(data: any, context: ChunkingContext): Promise<ChunkResult> {
    return this.mockChunkFn(data, context);
  }

  shouldChunk(data: any, context: ChunkingContext): boolean {
    return true;
  }

  getType(): ChunkType {
    return this.type;
  }
}

describe('Chunker', () => {
  let chunker: Chunker;
  const fileKey = 'test-file';
  
  beforeEach(() => {
    // 每个测试前创建新的Chunker实例
    chunker = new Chunker();
  });
  
  // 测试构造函数和配置
  describe('构造函数', () => {
    it('应使用默认配置创建实例', () => {
      // @ts-ignore 访问私有属性进行测试
      const config = chunker.config;
      
      expect(config.maxChunkSize).toBe(30 * 1024); // 默认30KB
      expect(config.debug).toBe(false);
    });
    
    it('应使用自定义配置创建实例', () => {
      const customConfig: ChunkerConfig = {
        maxChunkSize: 50 * 1024, // 50KB
        debug: true
      };
      
      const customChunker = new Chunker(customConfig);
      
      // @ts-ignore 访问私有属性进行测试
      const config = customChunker.config;
      
      expect(config.maxChunkSize).toBe(50 * 1024);
      expect(config.debug).toBe(true);
    });
    
    it('应注册默认策略', () => {
      // @ts-ignore 访问私有属性进行测试
      const strategies = chunker.strategies;
      
      // 验证默认策略是否已注册
      expect(strategies.has(ChunkType.METADATA)).toBe(true);
      expect(strategies.has(ChunkType.NODE)).toBe(true);
      expect(strategies.has(ChunkType.GLOBAL_VARS)).toBe(true);
    });
  });
  
  // 测试策略注册
  describe('registerStrategy', () => {
    it('应注册自定义策略', () => {
      // 创建mock策略
      const mockChunkFn = mockFn().mockResolvedValue({
        chunks: [],
        primaryChunkId: 'mock-chunk',
        references: []
      });
      
      const customStrategy = new MockStrategy(ChunkType.METADATA, mockChunkFn);
      
      // 注册自定义策略以覆盖默认策略
      chunker.registerStrategy(customStrategy);
      
      // @ts-ignore 访问私有属性进行测试
      const strategy = chunker.strategies.get(ChunkType.METADATA);
      
      expect(strategy).toBe(customStrategy);
    });
  });
  
  // 测试数据类型检测
  describe('detectDataType', () => {
    it('对于null或undefined数据应默认为元数据类型', () => {
      // @ts-ignore 私有方法测试
      expect(chunker.detectDataType(null)).toBe(ChunkType.METADATA);
      // @ts-ignore 私有方法测试
      expect(chunker.detectDataType(undefined)).toBe(ChunkType.METADATA);
    });
    
    it('应识别元数据类型', () => {
      // @ts-ignore 私有方法测试
      expect(chunker.detectDataType(testMetadata)).toBe(ChunkType.METADATA);
    });
    
    it('应识别节点类型', () => {
      // @ts-ignore 私有方法测试
      expect(chunker.detectDataType(sampleNode)).toBe(ChunkType.NODE);
    });
    
    it('应识别全局变量类型', () => {
      // @ts-ignore 私有方法测试
      expect(chunker.detectDataType(testVariables)).toBe(ChunkType.GLOBAL_VARS);
    });
  });
  
  // 测试chunk方法
  describe('chunk', () => {
    it('当没有注册对应类型的策略时应抛出错误', async () => {
      // 创建一个新的Chunker并清空所有策略
      const emptyChunker = new Chunker();
      // @ts-ignore 私有属性修改
      emptyChunker.strategies = new Map();
      
      await expect(emptyChunker.chunk(sampleNode, fileKey)).rejects.toThrow(/No chunking strategy registered/);
    });
    
    it('应调用对应类型的策略进行分片', async () => {
      // 创建mock策略和结果
      const mockResult: ChunkResult = {
        chunks: [{
          id: 'test-chunk',
          fileKey,
          type: ChunkType.NODE,
          created: new Date(),
          lastAccessed: new Date(),
          data: { test: 'data' },
          links: []
        }],
        primaryChunkId: 'test-chunk',
        references: []
      };
      
      const mockChunkFn = mockFn().mockResolvedValue(mockResult);
      const mockStrategy = new MockStrategy(ChunkType.NODE, mockChunkFn);
      
      // 注册mock策略
      chunker.registerStrategy(mockStrategy);
      
      // 执行分片
      const result = await chunker.chunk(sampleNode, fileKey);
      
      // 验证结果
      expect(result).toBe(mockResult);
      expect(mockChunkFn.mock.calls.length).toBe(1);
      
      // 验证传递给策略的上下文
      const context = mockChunkFn.mock.calls[0][1];
      expect(context.fileKey).toBe(fileKey);
      expect(context.maxSize).toBe(30 * 1024);
    });
    
    it('应使用指定的数据类型而不进行自动检测', async () => {
      // 创建两个不同类型的mock策略
      const nodeResult: ChunkResult = {
        chunks: [{ id: 'node-chunk', fileKey, type: ChunkType.NODE, created: new Date(), lastAccessed: new Date(), data: {}, links: [] }],
        primaryChunkId: 'node-chunk',
        references: []
      };
      
      const metadataResult: ChunkResult = {
        chunks: [{ id: 'metadata-chunk', fileKey, type: ChunkType.METADATA, created: new Date(), lastAccessed: new Date(), data: {}, links: [] }],
        primaryChunkId: 'metadata-chunk',
        references: []
      };
      
      const nodeChunkFn = mockFn().mockResolvedValue(nodeResult);
      const metadataChunkFn = mockFn().mockResolvedValue(metadataResult);
      
      const nodeStrategy = new MockStrategy(ChunkType.NODE, nodeChunkFn);
      const metadataStrategy = new MockStrategy(ChunkType.METADATA, metadataChunkFn);
      
      chunker.registerStrategy(nodeStrategy);
      chunker.registerStrategy(metadataStrategy);
      
      // 使用NODE类型调用，即使数据类型可能是其他类型
      const result = await chunker.chunk(testMetadata, fileKey, ChunkType.NODE);
      
      // 验证是否调用了NODE策略而不是基于数据自动检测
      expect(result).toBe(nodeResult);
      expect(nodeChunkFn.mock.calls.length).toBe(1);
      expect(metadataChunkFn.mock.calls.length).toBe(0);
    });
    
    it('当开启调试模式时应输出调试信息', async () => {
      // 监控console.log
      const originalConsoleLog = console.log;
      const consoleLogMock = mockFn();
      console.log = consoleLogMock;
      
      // 创建启用调试的Chunker
      const debugChunker = new Chunker({ debug: true });
      
      // 创建mock策略和结果
      const mockResult: ChunkResult = {
        chunks: [{
          id: 'debug-chunk',
          fileKey,
          type: ChunkType.NODE,
          created: new Date(),
          lastAccessed: new Date(),
          data: { test: 'debug-data' },
          links: ['link1', 'link2']
        }],
        primaryChunkId: 'debug-chunk',
        references: ['ref1', 'ref2']
      };
      
      const mockChunkFn = mockFn().mockResolvedValue(mockResult);
      const mockStrategy = new MockStrategy(ChunkType.NODE, mockChunkFn);
      
      // 注册mock策略
      debugChunker.registerStrategy(mockStrategy);
      
      // 执行分片
      await debugChunker.chunk(sampleNode, fileKey);
      
      // 验证是否输出了调试信息
      expect(consoleLogMock.mock.calls.some(args => args[0] === '=== Chunking Debug ===')).toBe(true);
      expect(consoleLogMock.mock.calls.some(args => args[0] === 'Total chunks: 1')).toBe(true);
      expect(consoleLogMock.mock.calls.some(args => args[0] === 'Primary chunk: debug-chunk')).toBe(true);
      expect(consoleLogMock.mock.calls.some(args => args[0] === 'References: 2')).toBe(true);
      
      // 恢复原始console.log
      console.log = originalConsoleLog;
    });
  });
}); 