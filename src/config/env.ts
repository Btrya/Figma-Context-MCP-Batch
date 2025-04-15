/**
 * 环境配置文件 - Figma分块相关配置
 */

/**
 * 获取环境变量，如果不存在则返回默认值
 */
function getEnvVar(name: string, defaultValue: string): string {
  return process.env[name] || defaultValue;
}

/**
 * 获取数字类型环境变量，如果不存在或不是数字则返回默认值
 */
function getNumericEnvVar(name: string, defaultValue: number): number {
  const value = process.env[name];
  if (!value) return defaultValue;
  
  const numValue = parseInt(value, 10);
  return isNaN(numValue) ? defaultValue : numValue;
}

/**
 * Figma分块配置
 */
export const FigmaChunkConfig = {
  /**
   * 单个分块的最大字符数
   */
  MAX_CHUNK_SIZE: getNumericEnvVar('FIGMA_MAX_CHUNK_SIZE', 12000),
  
  /**
   * 缓存目录路径
   */
  CACHE_DIR: getEnvVar('FIGMA_CACHE_DIR', '.cache/figma-data'),
  
  /**
   * 缓存保留时间（毫秒）
   */
  CACHE_TTL: getNumericEnvVar('FIGMA_CACHE_TTL', 86400000), // 默认24小时
  
  /**
   * 是否启用日志
   */
  ENABLE_LOGS: getEnvVar('FIGMA_ENABLE_LOGS', 'true') === 'true',
  
  /**
   * 日志级别
   */
  LOG_LEVEL: getEnvVar('FIGMA_LOG_LEVEL', 'info'),
}; 