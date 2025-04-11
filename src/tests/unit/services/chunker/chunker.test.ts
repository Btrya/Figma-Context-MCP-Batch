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
import { OptimizationLevel } from '../../../../services/chunker/chunk-optimizer.js';

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
      expect(config.optimizationLevel).toBe(OptimizationLevel.MEDIUM);
      expect(config.collectMetrics).toBe(false);
      expect(config.detectCircularReferences).toBe(true);
    });
    
    it('应使用自定义配置创建实例', () => {
      const customConfig: ChunkerConfig = {
        maxChunkSize: 50 * 1024, // 50KB
        debug: true,
        optimizationLevel: OptimizationLevel.HIGH,
        collectMetrics: true,
        detectCircularReferences: false
      };
      
      const customChunker = new Chunker(customConfig);
      
      // @ts-ignore 访问私有属性进行测试
      const config = customChunker.config;
      
      expect(config.maxChunkSize).toBe(50 * 1024);
      expect(config.debug).toBe(true);
      expect(config.optimizationLevel).toBe(OptimizationLevel.HIGH);
      expect(config.collectMetrics).toBe(true);
      expect(config.detectCircularReferences).toBe(false);
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
  
  // 测试策略注册和获取
  describe('registerStrategy和getStrategy', () => {
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
      
      // 验证策略已经注册
      const strategy = chunker.getStrategy(ChunkType.METADATA);
      
      expect(strategy).toBe(customStrategy);
    });
    
    it('获取不存在的策略应返回undefined', () => {
      // @ts-ignore 使用无效的分片类型
      const strategy = chunker.getStrategy('INVALID_TYPE');
      expect(strategy).toBeUndefined();
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
      expect(result.chunks).toHaveLength(1);
      expect(result.primaryChunkId).toBe('test-chunk');
      expect(mockChunkFn.mock.calls.length).toBe(1);
      
      // 验证传递给策略的上下文
      const context = mockChunkFn.mock.calls[0][1];
      expect(context.fileKey).toBe(fileKey);
      expect(context.chunkType).toBe(ChunkType.NODE);
    });
    
    it('应使用指定的数据类型而不进行自动检测', async () => {
      // 创建mock策略和结果
      const nodeResult: ChunkResult = {
        chunks: [{
          id: 'node-chunk',
          fileKey,
          type: ChunkType.NODE,
          created: new Date(),
          lastAccessed: new Date(),
          data: {},
          links: []
        }],
        primaryChunkId: 'node-chunk',
        references: []
      };
      
      const metadataResult: ChunkResult = {
        chunks: [{
          id: 'metadata-chunk',
          fileKey,
          type: ChunkType.METADATA,
          created: new Date(),
          lastAccessed: new Date(),
          data: {},
          links: []
        }],
        primaryChunkId: 'metadata-chunk',
        references: []
      };
      
      const nodeChunkFn = mockFn().mockResolvedValue(nodeResult);
      const metadataChunkFn = mockFn().mockResolvedValue(metadataResult);
      
      // 注册mock策略
      chunker.registerStrategy(new MockStrategy(ChunkType.NODE, nodeChunkFn));
      chunker.registerStrategy(new MockStrategy(ChunkType.METADATA, metadataChunkFn));
      
      // 使用元数据数据但指定为节点类型
      const result = await chunker.chunk(testMetadata, fileKey, ChunkType.NODE);
      
      // 验证是否调用了NODE策略而不是基于数据自动检测
      expect(result).toStrictEqual(nodeResult);
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
  
  // 测试优化功能
  describe('优化功能', () => {
    it('应根据配置的优化级别处理分片', async () => {
      // 创建一个包含大量数据的分片结果
      const largeData = {
        backgroundColor: { r: 1, g: 1, b: 1 },
        children: [
          { id: 'child1', name: 'Child 1' },
          { id: 'child2', name: 'Child 2' }
        ],
        cornerRadius: 0,
        counterAxisSizingMode: 'FIXED',
        effects: [
          { type: 'DROP_SHADOW', color: { r: 0, g: 0, b: 0, a: 0.1 }, offset: { x: 0, y: 2 }, radius: 4, spread: 0, visible: true }
        ],
        fills: [
          { type: 'SOLID', color: { r: 1, g: 1, b: 1 }, opacity: 1, visible: true }
        ],
        height: 812,
        id: '2:1',
        itemSpacing: 10,
        layoutMode: 'VERTICAL',
        name: '主屏幕',
        paddingBottom: 20,
        paddingLeft: 16,
        paddingRight: 16,
        paddingTop: 20,
        primaryAxisSizingMode: 'FIXED',
        strokes: [] as any[],
        type: 'FRAME',
        width: 375,
        x: 0,
        y: 0,
        // 添加一个大字符串属性以确保分片大小超过限制
        _largeProperty: 'x'.repeat(5000)
      };
      
      // 创建mock结果
      const mockResult: ChunkResult = {
        chunks: [{
          id: 'test-large',
          fileKey,
          type: ChunkType.NODE,
          created: new Date(),
          lastAccessed: new Date(),
          data: largeData,
          links: []
        }],
        primaryChunkId: 'test-large',
        references: []
      };
      
      // 创建策略
      const mockChunkFn = mockFn().mockResolvedValue(mockResult);
      chunker.registerStrategy(new MockStrategy(ChunkType.NODE, mockChunkFn));
      
      // 设置高级优化
      // @ts-ignore 访问私有属性
      chunker.config.optimizationLevel = OptimizationLevel.HIGH;
      
      // 执行分片
      const result = await chunker.chunk(largeData, fileKey);
      
      // 验证分片已被优化
      expect(result.chunks[0].data).not.toMatchObject(largeData);
      
      // 优化应该移除了_largeProperty
      expect(result.chunks[0].data._largeProperty).toBeUndefined();
    });
    
    it('优化级别NONE不应改变分片', async () => {
      // 创建一个不进行优化的Chunker
      const noOptChunker = new Chunker({
        optimizationLevel: OptimizationLevel.NONE
      });
      
      // 创建mock策略和结果
      const mockResult: ChunkResult = {
        chunks: [{
          id: 'no-opt-chunk',
          fileKey,
          type: ChunkType.NODE,
          created: new Date(),
          lastAccessed: new Date(),
          data: { test: 'no-opt-data' },
          links: []
        }],
        primaryChunkId: 'no-opt-chunk',
        references: []
      };
      
      const mockChunkFn = mockFn().mockResolvedValue(mockResult);
      const mockStrategy = new MockStrategy(ChunkType.NODE, mockChunkFn);
      
      // 注册mock策略
      noOptChunker.registerStrategy(mockStrategy);
      
      // 执行分片
      const result = await noOptChunker.chunk(sampleNode, fileKey);
      
      // 验证分片未被修改
      expect(result).toBe(mockResult);
    });
  });
  
  // 测试指标收集
  describe('指标收集', () => {
    it('应收集和提供性能指标', async () => {
      // 创建启用指标收集的Chunker
      const metricsChunker = new Chunker({
        collectMetrics: true
      });
      
      // 创建mock策略和结果
      const mockResult: ChunkResult = {
        chunks: [{
          id: 'metrics-chunk',
          fileKey,
          type: ChunkType.NODE,
          created: new Date(),
          lastAccessed: new Date(),
          data: { test: 'metrics-data' },
          links: []
        }],
        primaryChunkId: 'metrics-chunk',
        references: []
      };
      
      const mockChunkFn = mockFn().mockResolvedValue(mockResult);
      const mockStrategy = new MockStrategy(ChunkType.NODE, mockChunkFn);
      
      // 注册mock策略
      metricsChunker.registerStrategy(mockStrategy);
      
      // 执行分片
      await metricsChunker.chunk(sampleNode, fileKey);
      
      // 获取指标
      const metrics = metricsChunker.getMetrics();
      
      // 验证指标记录
      expect(metrics.chunkCounts[ChunkType.NODE]).toBe(1);
      expect(metrics.processingTime[ChunkType.NODE].length).toBe(1);
      expect(metrics.chunkSizes[ChunkType.NODE].length).toBe(1);
    });
    
    it('应重置指标', async () => {
      // 创建启用指标收集的Chunker
      const metricsChunker = new Chunker({
        collectMetrics: true
      });
      
      // 创建mock策略和结果
      const mockResult: ChunkResult = {
        chunks: [{
          id: 'metrics-chunk',
          fileKey,
          type: ChunkType.NODE,
          created: new Date(),
          lastAccessed: new Date(),
          data: { test: 'metrics-data' },
          links: []
        }],
        primaryChunkId: 'metrics-chunk',
        references: []
      };
      
      const mockChunkFn = mockFn().mockResolvedValue(mockResult);
      const mockStrategy = new MockStrategy(ChunkType.NODE, mockChunkFn);
      
      // 注册mock策略
      metricsChunker.registerStrategy(mockStrategy);
      
      // 执行分片
      await metricsChunker.chunk(sampleNode, fileKey);
      
      // 验证指标记录
      let metrics = metricsChunker.getMetrics();
      expect(metrics.chunkCounts[ChunkType.NODE]).toBe(1);
      
      // 重置指标
      metricsChunker.resetMetrics();
      
      // 验证指标已重置
      metrics = metricsChunker.getMetrics();
      expect(metrics.chunkCounts[ChunkType.NODE]).toBe(0);
      expect(metrics.processingTime[ChunkType.NODE].length).toBe(0);
    });
  });
  
  // 测试引用图功能
  describe('引用图功能', () => {
    it('应构建和提供分片引用图', async () => {
      // 创建mock策略和带引用的结果
      const mockResult: ChunkResult = {
        chunks: [
          {
            id: 'parent-chunk',
            fileKey,
            type: ChunkType.NODE,
            created: new Date(),
            lastAccessed: new Date(),
            data: { id: 'parent', type: 'FRAME' },
            links: ['child-chunk-1', 'child-chunk-2']
          },
          {
            id: 'child-chunk-1',
            fileKey,
            type: ChunkType.NODE,
            created: new Date(),
            lastAccessed: new Date(),
            data: { id: 'child1', type: 'RECTANGLE' },
            links: []
          },
          {
            id: 'child-chunk-2',
            fileKey,
            type: ChunkType.NODE,
            created: new Date(),
            lastAccessed: new Date(),
            data: { id: 'child2', type: 'TEXT' },
            links: []
          }
        ],
        primaryChunkId: 'parent-chunk',
        references: ['child-chunk-1', 'child-chunk-2']
      };
      
      const mockChunkFn = mockFn().mockResolvedValue(mockResult);
      const mockStrategy = new MockStrategy(ChunkType.NODE, mockChunkFn);
      
      // 注册mock策略
      chunker.registerStrategy(mockStrategy);
      
      // 执行分片
      await chunker.chunk(sampleNode, fileKey);
      
      // 获取引用图
      const referenceGraph = chunker.getReferenceGraph();
      
      // 验证引用图结构
      expect(referenceGraph['parent-chunk']).toEqual(['child-chunk-1', 'child-chunk-2']);
      expect(referenceGraph['child-chunk-1']).toEqual([]);
      expect(referenceGraph['child-chunk-2']).toEqual([]);
    });
    
    it('应检测循环引用', async () => {
      // 监控console.warn
      const originalConsoleWarn = console.warn;
      const consoleWarnMock = mockFn();
      console.warn = consoleWarnMock;
      
      // 创建启用调试的Chunker
      const debugChunker = new Chunker({ 
        debug: true,
        detectCircularReferences: true
      });
      
      // 创建mock策略和带循环引用的结果
      const mockResult: ChunkResult = {
        chunks: [
          {
            id: 'chunk-a',
            fileKey,
            type: ChunkType.NODE,
            created: new Date(),
            lastAccessed: new Date(),
            data: { id: 'a' },
            links: ['chunk-b']
          },
          {
            id: 'chunk-b',
            fileKey,
            type: ChunkType.NODE,
            created: new Date(),
            lastAccessed: new Date(),
            data: { id: 'b' },
            links: ['chunk-c']
          },
          {
            id: 'chunk-c',
            fileKey,
            type: ChunkType.NODE,
            created: new Date(),
            lastAccessed: new Date(),
            data: { id: 'c' },
            links: ['chunk-a'] // 形成循环
          }
        ],
        primaryChunkId: 'chunk-a',
        references: ['chunk-b', 'chunk-c']
      };
      
      const mockChunkFn = mockFn().mockResolvedValue(mockResult);
      const mockStrategy = new MockStrategy(ChunkType.NODE, mockChunkFn);
      
      // 注册mock策略
      debugChunker.registerStrategy(mockStrategy);
      
      // 执行分片
      await debugChunker.chunk(sampleNode, fileKey);
      
      // 验证检测到循环引用并输出警告
      expect(consoleWarnMock.mock.calls.some(args => 
        args[0] === 'Circular references detected:'
      )).toBe(true);
      
      // 恢复原始console.warn
      console.warn = originalConsoleWarn;
    });
  });
}); 