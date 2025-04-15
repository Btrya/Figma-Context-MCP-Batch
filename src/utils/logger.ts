import fs from 'fs';
import path from 'path';
import { FigmaChunkConfig } from '../config/env.js';

/**
 * 日志级别
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3,
}

/**
 * 获取日志级别
 */
function getLogLevel(level: string): LogLevel {
  switch (level.toLowerCase()) {
    case 'debug': return LogLevel.DEBUG;
    case 'info': return LogLevel.INFO;
    case 'warn': return LogLevel.WARN;
    case 'error': return LogLevel.ERROR;
    default: return LogLevel.INFO;
  }
}

/**
 * 配置的日志级别
 */
const configuredLogLevel = getLogLevel(FigmaChunkConfig.LOG_LEVEL);

/**
 * 日志工具类
 */
export class Logger {
  /**
   * 确保日志目录存在
   */
  private static ensureLogDir(dir: string): void {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * 写入日志文件
   */
  private static writeLog(level: string, message: string, fileName: string): void {
    if (!FigmaChunkConfig.ENABLE_LOGS) return;
    
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level.toUpperCase()}] ${message}\n`;
    
    const logsDir = path.join(process.cwd(), 'logs');
    this.ensureLogDir(logsDir);
    
    const logFile = path.join(logsDir, fileName);
    fs.appendFileSync(logFile, logMessage);
    
    // 同时输出到控制台
    console.log(logMessage.trim());
  }

  /**
   * 记录调试日志
   */
  static debug(message: string, fileName: string = 'figma-chunker-debug.log'): void {
    if (configuredLogLevel <= LogLevel.DEBUG) {
      this.writeLog('debug', message, fileName);
    }
  }

  /**
   * 记录信息日志
   */
  static info(message: string, fileName: string = 'figma-chunker.log'): void {
    if (configuredLogLevel <= LogLevel.INFO) {
      this.writeLog('info', message, fileName);
    }
  }

  /**
   * 记录警告日志
   */
  static warn(message: string, fileName: string = 'figma-chunker.log'): void {
    if (configuredLogLevel <= LogLevel.WARN) {
      this.writeLog('warn', message, fileName);
    }
  }

  /**
   * 记录错误日志
   */
  static error(message: string, error?: any, fileName: string = 'figma-chunker-error.log'): void {
    if (configuredLogLevel <= LogLevel.ERROR) {
      let errorMessage = message;
      if (error) {
        if (error instanceof Error) {
          errorMessage += `\nError: ${error.message}\nStack: ${error.stack}`;
        } else {
          errorMessage += `\nError: ${JSON.stringify(error)}`;
        }
      }
      this.writeLog('error', errorMessage, fileName);
    }
  }
} 