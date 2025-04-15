import { describe, it, expect, beforeEach, afterEach } from '@jest/globals';
import { jest } from '@jest/globals';
import { FigmaApiClient, FigmaApiError } from '../../../../services/figma/figma-api-client.js';
import { Logger } from '../../../../utils/logger.js';

// 模拟 Logger
jest.mock('../../../../utils/logger.js', () => ({
  Logger: {
    info: jest.fn(),
    error: jest.fn(),
    debug: jest.fn()
  }
}));

describe('FigmaApiClient', () => {
  // 全局配置
  const API_KEY = 'test-api-key';
  const BASE_URL = 'https://api.figma.com/v1';
  const FILE_KEY = 'test-file-key';
  const NODE_ID = 'test-node-id';

  let client: FigmaApiClient;
  let fetchMock: any;
  
  beforeEach(() => {
    // 清除模拟
    jest.clearAllMocks();
    
    // 保存原始 fetch 方法
    fetchMock = jest.spyOn(global, 'fetch').mockImplementation(
      () => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({})
      } as Response)
    );
    
    // 创建新的客户端实例
    client = new FigmaApiClient(API_KEY);
  });
  
  afterEach(() => {
    jest.resetAllMocks();
  });
  
  it('应该在创建时需要API密钥', () => {
    expect(() => new FigmaApiClient('')).toThrow('Figma API密钥不能为空');
  });
  
  it('应该成功初始化并记录日志', () => {
    expect(client).toBeInstanceOf(FigmaApiClient);
    expect(Logger.info).toHaveBeenCalledWith('初始化Figma API客户端');
  });
  
  describe('getFileData', () => {
    it('应该使用正确的URL获取文件数据', async () => {
      // 模拟成功响应
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ test: 'data' })
      } as Response);
      
      const result = await client.getFileData(FILE_KEY);
      
      expect(result).toEqual({ test: 'data' });
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/files/${FILE_KEY}`,
        expect.objectContaining({
          headers: {
            'X-Figma-Token': API_KEY,
            'Content-Type': 'application/json'
          }
        })
      );
      expect(Logger.info).toHaveBeenCalledWith(expect.stringContaining('请求Figma数据'));
    });
    
    it('应该支持节点ID参数', async () => {
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ test: 'node-data' })
      } as Response);
      
      await client.getFileData(FILE_KEY, NODE_ID);
      
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/files/${FILE_KEY}/nodes?ids=${NODE_ID}`,
        expect.anything()
      );
    });
    
    it('应该支持深度参数', async () => {
      const depth = 2;
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ test: 'depth-data' })
      } as Response);
      
      await client.getFileData(FILE_KEY, undefined, depth);
      
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/files/${FILE_KEY}?depth=${depth}`,
        expect.anything()
      );
    });
    
    it('应该支持节点ID和深度参数', async () => {
      const depth = 3;
      fetchMock.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ test: 'combined-data' })
      } as Response);
      
      await client.getFileData(FILE_KEY, NODE_ID, depth);
      
      expect(fetchMock).toHaveBeenCalledWith(
        `${BASE_URL}/files/${FILE_KEY}/nodes?depth=${depth}&ids=${NODE_ID}`,
        expect.anything()
      );
    });
    
    it('应该处理API错误', async () => {
      const errorStatus = 404;
      const errorMessage = 'Not Found';
      
      fetchMock.mockResolvedValueOnce({
        ok: false,
        status: errorStatus,
        statusText: errorMessage
      } as Response);
      
      await expect(client.getFileData(FILE_KEY)).rejects.toThrow(
        `Figma API错误: ${errorStatus} ${errorMessage}`
      );
      expect(Logger.error).toHaveBeenCalled();
    });
    
    it('应该处理网络错误', async () => {
      const networkError = new Error('Network error');
      fetchMock.mockRejectedValueOnce(networkError);
      
      await expect(client.getFileData(FILE_KEY)).rejects.toThrow(
        `请求Figma API失败: ${networkError.message}`
      );
      expect(Logger.error).toHaveBeenCalled();
    });
  });
}); 