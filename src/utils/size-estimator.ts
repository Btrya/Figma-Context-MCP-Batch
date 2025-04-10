/**
 * 大小估算工具
 * 提供用于估计JavaScript对象序列化后大小的工具函数
 */

/**
 * 估计对象序列化后的字节大小
 * 使用JSON.stringify并计算结果字符串的字节长度
 * @param obj 要估计大小的对象
 * @returns 估计的字节大小
 */
export function estimateSize(obj: any): number {
  try {
    // 对于简单类型，直接转换
    const json = JSON.stringify(obj);
    return Buffer.byteLength(json, 'utf8');
  } catch (error) {
    // 对于无法直接序列化的复杂对象，使用递归估算
    return estimateComplexObjectSize(obj);
  }
}

/**
 * 递归估算复杂对象的大小
 * 处理可能包含循环引用的复杂对象
 * @param obj 要估计大小的复杂对象
 * @param seen 已处理过的对象集合，用于处理循环引用
 * @returns 估计的字节大小
 */
function estimateComplexObjectSize(obj: any, seen = new WeakSet()): number {
  // 处理null和undefined
  if (obj === null || obj === undefined) {
    return 4; // "null" 或 "undefined" 的大致长度
  }
  
  // 处理基本类型
  const type = typeof obj;
  if (type === 'boolean') return 5; // "true" 或 "false"
  if (type === 'number') return String(obj).length;
  if (type === 'string') return obj.length * 2; // 近似估计UTF-8字符平均2字节
  
  // 处理循环引用
  if (typeof obj === 'object') {
    if (seen.has(obj)) {
      return 8; // 对于已处理过的对象，返回固定大小避免循环
    }
    seen.add(obj);
  }
  
  // 处理数组
  if (Array.isArray(obj)) {
    let size = 2; // [] 的大小
    for (const item of obj) {
      size += estimateComplexObjectSize(item, seen) + 1; // +1 for comma
    }
    return size;
  }
  
  // 处理普通对象
  if (type === 'object') {
    let size = 2; // {} 的大小
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        size += key.length + 3; // 键名 + 引号 + 冒号
        size += estimateComplexObjectSize(obj[key], seen) + 1; // +1 for comma
      }
    }
    return size;
  }
  
  // 处理函数和其他类型（如Symbol）
  if (type === 'function') {
    // 函数通常在JSON中被忽略，但这里我们返回一个近似值
    return obj.toString().length;
  }
  
  // 其他类型（Symbol等）
  return 8; // 默认大小
}

/**
 * 检查对象是否超过指定大小
 * @param obj 要检查的对象
 * @param maxSize 最大允许大小（字节）
 * @returns 如果超过最大大小返回true，否则返回false
 */
export function isOverSize(obj: any, maxSize: number): boolean {
  return estimateSize(obj) > maxSize;
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