import { ToolHandler } from './tool-handler.js';
import { Logger } from '../../utils/logger.js';

/**
 * 工具管理器
 * 负责注册、管理和调用MCP工具
 */
export class ToolManager {
  /**
   * 工具处理器映射
   */
  private handlers: Map<string, ToolHandler> = new Map();
  
  /**
   * 构造函数
   */
  constructor() {
    Logger.info('初始化ToolManager');
  }
  
  /**
   * 注册工具处理器
   * @param name 工具名称
   * @param handler 工具处理器
   */
  registerHandler(name: string, handler: ToolHandler): void {
    if (this.handlers.has(name)) {
      Logger.warn(`工具'${name}'已经注册，将被覆盖`);
    }
    
    this.handlers.set(name, handler);
    Logger.info(`注册工具: ${name}`);
  }
  
  /**
   * 获取工具处理器
   * @param name 工具名称
   * @returns 工具处理器，如果不存在则返回undefined
   */
  getHandler(name: string): ToolHandler | undefined {
    return this.handlers.get(name);
  }
  
  /**
   * 获取所有工具描述
   * @returns 工具描述列表
   */
  getToolDescriptions(): any[] {
    const descriptions: any[] = [];
    
    for (const [name, handler] of this.handlers) {
      descriptions.push(handler.getToolDescription());
    }
    
    return descriptions;
  }
  
  /**
   * 处理工具调用
   * @param name 工具名称
   * @param parameters 参数
   * @returns 响应数据
   */
  async handleToolCall(name: string, parameters: Record<string, any>): Promise<any> {
    try {
      Logger.info(`调用工具: ${name}`);
      
      const handler = this.getHandler(name);
      if (!handler) {
        throw new Error(`未找到工具: ${name}`);
      }
      
      const description = handler.getToolDescription();
      
      // 验证参数
      this.validateParameters(description, parameters);
      
      // 调用处理器
      const response = await handler.handle(parameters);
      
      Logger.info(`工具调用成功: ${name}`);
      return response;
    } catch (error) {
      Logger.error(`工具调用失败: ${name}`, error);
      throw error;
    }
  }
  
  /**
   * 验证工具调用参数
   * @param description 工具描述
   * @param parameters 参数
   * @returns 是否有效
   */
  private validateParameters(description: any, parameters: Record<string, any>): boolean {
    // 检查必需参数
    const requiredParams = description.parameters?.required || [];
    
    for (const paramName of requiredParams) {
      if (parameters[paramName] === undefined) {
        throw new Error(`缺少必需参数: ${paramName}`);
      }
    }
    
    // 检查参数类型
    const properties = description.parameters?.properties || {};
    
    for (const [paramName, paramValue] of Object.entries(parameters)) {
      const paramSchema = properties[paramName];
      
      if (!paramSchema) {
        Logger.warn(`未知参数: ${paramName}`);
        continue;
      }
      
      // 检查类型
      if (paramSchema.type && !this.checkType(paramValue, paramSchema.type)) {
        throw new Error(`参数'${paramName}'类型无效，应为${paramSchema.type}`);
      }
    }
    
    return true;
  }
  
  /**
   * 检查值类型
   * @param value 值
   * @param type 类型
   * @returns 是否匹配
   */
  private checkType(value: any, type: string): boolean {
    switch (type) {
      case 'string':
        return typeof value === 'string';
      case 'number':
        return typeof value === 'number';
      case 'boolean':
        return typeof value === 'boolean';
      case 'object':
        return typeof value === 'object' && value !== null && !Array.isArray(value);
      case 'array':
        return Array.isArray(value);
      default:
        return true;
    }
  }
} 