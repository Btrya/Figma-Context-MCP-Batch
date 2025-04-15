/**
 * 工具处理器接口
 * 定义了所有MCP工具处理器必须实现的方法
 */
export interface ToolHandler<RequestType = any, ResponseType = any> {
  /**
   * 处理工具调用
   * @param request 请求参数
   * @returns 响应数据
   */
  handle(request: RequestType): Promise<ResponseType>;
  
  /**
   * 获取工具描述
   * @returns 工具描述
   */
  getToolDescription(): any;
} 