import { FigmaNode, FigmaMetadata, FigmaGlobalVars } from '../../models/figma/figma-node.js';
import { Logger } from '../../utils/logger.js';

/**
 * Figma节点提取结果
 */
export interface FigmaExtractionResult {
  /**
   * 节点映射 (nodeId -> FigmaNode)
   */
  nodes: Map<string, FigmaNode>;
  
  /**
   * 元数据信息
   */
  metadata: FigmaMetadata;
  
  /**
   * 全局变量
   */
  globalVars: FigmaGlobalVars;
  
  /**
   * 顶层节点ID列表
   */
  rootNodeIds: string[];
}

/**
 * Figma节点提取器
 * 负责从Figma API响应数据中提取和构建节点树结构
 */
export class FigmaNodeExtractor {
  /**
   * 提取Figma数据中的节点、元数据和全局变量
   * @param figmaData Figma API响应数据
   * @returns 提取结果
   */
  extractNodes(figmaData: any): FigmaExtractionResult {
    try {
      Logger.info('开始提取Figma节点');
      
      // 创建节点映射
      const nodeMap = new Map<string, FigmaNode>();
      
      // 提取元数据
      const metadata: FigmaMetadata = figmaData.metadata || {
        name: 'Unknown',
        lastModified: new Date().toISOString()
      };
      
      // 提取全局变量
      const globalVars: FigmaGlobalVars = figmaData.globalVars || {};
      
      // 提取根节点
      const rootNodeIds: string[] = [];
      
      // 如果有nodes数组，处理它
      if (Array.isArray(figmaData.nodes)) {
        figmaData.nodes.forEach((node: any) => {
          if (node && node.id) {
            this.processNode(node, nodeMap);
            rootNodeIds.push(node.id);
          }
        });
      } 
      // 如果有document属性，处理它
      else if (figmaData.document) {
        this.processNode(figmaData.document, nodeMap);
        rootNodeIds.push(figmaData.document.id);
      }
      
      Logger.info(`提取完成：找到 ${nodeMap.size} 个节点，${rootNodeIds.length} 个根节点`);
      
      return {
        nodes: nodeMap,
        metadata,
        globalVars,
        rootNodeIds
      };
    } catch (error) {
      Logger.error('提取Figma节点失败', error);
      throw new Error(`提取Figma节点失败: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  /**
   * 递归处理单个节点及其子节点
   * @param node 原始节点数据
   * @param nodeMap 节点映射表
   * @param parentId 父节点ID（可选）
   * @returns 处理后的节点
   */
  private processNode(node: any, nodeMap: Map<string, FigmaNode>, parentId?: string): FigmaNode {
    if (!node || !node.id) {
      throw new Error('无效的节点数据: 缺少ID');
    }
    
    // 创建基本节点对象
    const figmaNode: FigmaNode = {
      id: node.id,
      name: node.name || '',
      type: node.type || 'UNKNOWN'
    };
    
    // 复制其他属性
    Object.keys(node).forEach(key => {
      // 跳过children属性，我们将单独处理它
      if (key !== 'children') {
        figmaNode[key] = node[key];
      }
    });
    
    // 处理子节点
    if (Array.isArray(node.children) && node.children.length > 0) {
      figmaNode.children = [];
      
      // 提取子节点ID并处理每个子节点
      node.children.forEach((childNode: any) => {
        if (childNode && childNode.id) {
          figmaNode.children!.push(childNode.id);
          this.processNode(childNode, nodeMap, node.id);
        }
      });
    }
    
    // 将节点添加到映射表
    nodeMap.set(node.id, figmaNode);
    
    return figmaNode;
  }
} 