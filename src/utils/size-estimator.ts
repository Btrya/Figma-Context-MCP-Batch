/**
 * 大小估算工具
 * 用于估算JavaScript对象的大小
 */

/**
 * 估算数据大小
 * 使用JSON序列化+缓冲区计算字节大小
 * @param data 要估算大小的数据
 * @returns 估算的字节大小
 */
export function estimateSize(data: any): number {
  try {
    const json = JSON.stringify(data);
    return Buffer.byteLength(json, 'utf8');
  } catch (error) {
    console.warn('无法估算对象大小，返回最大值:', error);
    // 返回一个大数作为"无法估算"的标记
    return Number.MAX_SAFE_INTEGER;
  }
}

/**
 * 检查数据是否超过指定大小
 * @param data 要检查的数据
 * @param maxSize 最大字节数
 * @returns 如果超过大小返回true，否则返回false
 */
export function isOverSize(data: any, maxSize: number): boolean {
  const size = estimateSize(data);
  return size > maxSize;
}

/**
 * 获取格式化的大小字符串
 * @param bytes 字节数
 * @returns 格式化后的大小字符串（如：1.23 MB）
 */
export function formatSize(bytes: number): string {
  if (bytes === 0) return '0 B';
  
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  
  return parseFloat((bytes / Math.pow(1024, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * 分析数据结构比例
 * 计算对象中各主要部分占用的空间比例
 * @param data 要分析的数据
 * @returns 各主要部分的大小比例
 */
export function analyzeDataStructure(data: any): Record<string, number> {
  const result: Record<string, number> = {};
  const totalSize = estimateSize(data);
  
  if (typeof data !== 'object' || data === null) {
    result['primitive'] = totalSize;
    return result;
  }
  
  // 计算对象中各主要部分的大小
  for (const key of Object.keys(data)) {
    const size = estimateSize(data[key]);
    result[key] = size;
  }
  
  // 添加一个"其他"类别，表示对象结构的开销
  const sumOfParts = Object.values(result).reduce((sum, size) => sum + size, 0);
  const overhead = Math.max(0, totalSize - sumOfParts);
  if (overhead > 0) {
    result['__overhead'] = overhead;
  }
  
  return result;
}

/**
 * 检查节点对象是否应该被单独分片
 * 基于对象大小和节点特性做判断
 * @param node Figma节点对象
 * @param maxSize 最大分片大小
 * @returns 如果应该单独分片返回true，否则返回false
 */
export function shouldSplitNode(node: any, maxSize: number): boolean {
  // 检查基本大小
  if (isOverSize(node, maxSize)) {
    return true;
  }
  
  // 检查子节点数量
  if (node.children && node.children.length > 10) {
    return true;
  }
  
  // 检查特殊节点类型（如页面或大型组件）
  if (node.type === 'PAGE' || node.type === 'CANVAS') {
    return true;
  }
  
  // 检查是否包含位图或其他大型资源
  if (node.fills && node.fills.some((fill: any) => fill.type === 'IMAGE')) {
    return true;
  }
  
  return false;
} 