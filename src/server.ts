import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { FigmaService } from "./services/figma.js";
import express, { Request, Response } from "express";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import { IncomingMessage, ServerResponse, Server } from "http";
import { Transport } from "@modelcontextprotocol/sdk/shared/transport.js";
import { SimplifiedDesign } from "./services/simplify-node-response.js";
import yaml from "js-yaml";
import { FigmaChunker } from "./services/figma/figma-chunker.js";
import { FigmaCacheManager } from "./services/figma/figma-cache-manager.js";

export const Logger = {
  log: (...args: any[]) => {},
  error: (...args: any[]) => {},
  warn: (...args: any[]) => {},
};

export class FigmaMcpServer {
  private readonly server: McpServer;
  private readonly figmaService: FigmaService;
  private readonly figmaChunker: FigmaChunker;
  private readonly figmaCacheManager: FigmaCacheManager;
  private transports: { [sessionId: string]: SSEServerTransport } = {};
  private httpServer: Server | null = null;

  constructor(figmaApiKey: string) {
    this.figmaService = new FigmaService(figmaApiKey);
    this.figmaChunker = new FigmaChunker();
    this.figmaCacheManager = new FigmaCacheManager();
    this.server = new McpServer(
      {
        name: "Figma MCP Server Batch",
        version: "0.0.1",
      },
      {
        capabilities: {
          logging: {},
          tools: {},
        },
      },
    );

    this.registerTools();
  }

  private registerTools(): void {
    // Tool to get file information and trigger chunking
    this.server.tool(
      "get_figma_data",
      "When the nodeId cannot be obtained, obtain the layout information about the entire Figma file",
      {
        fileKey: z
          .string()
          .describe(
            "The key of the Figma file to fetch, often found in a provided URL like figma.com/(file|design)/<fileKey>/...",
          ),
        nodeId: z
          .string()
          .optional()
          .describe(
            "The ID of the node to fetch, often found as URL parameter node-id=<nodeId>, always use if provided",
          ),
        depth: z
          .number()
          .optional()
          .describe(
            "How many levels deep to traverse the node tree, only use if explicitly requested by the user",
          ),
      },
      async ({ fileKey, nodeId, depth }) => {
        try {
          Logger.log(
            `Fetching ${
              depth ? `${depth} layers deep` : "all layers"
            } of ${nodeId ? `node ${nodeId} from file` : `full file`} ${fileKey}`,
          );

          let file: SimplifiedDesign;
          if (nodeId) {
            file = await this.figmaService.getNode(fileKey, nodeId, depth);
          } else {
            file = await this.figmaService.getFile(fileKey, depth);
          }

          Logger.log(`Successfully fetched file: ${file.name}`);
          const { nodes, globalVars, ...metadata } = file;

          // 创建节点Map，递归添加所有节点（包括子节点）
          const nodeMap = new Map<string, any>();
          const rootNodeIds: string[] = [];
          
          // 递归函数，用于添加节点及其所有子节点到Map中
          const addNodeToMap = (node: any, isRoot = false) => {
            try {
              if (!node) {
                Logger.error(`Node is undefined or null`);
                return;
              }
              
              // 判断节点类型
              if (typeof node !== 'object') {
                Logger.error(`Invalid node type: ${typeof node}, value: ${node}`);
                return;
              }
              
              // 处理节点ID
              let nodeId;
              if (node.id) {
                nodeId = typeof node.id === 'string' ? node.id : String(node.id);
              } else {
                // 尝试从节点属性中找到ID
                if (node.nodeId) {
                  nodeId = String(node.nodeId);
                } else if (node.id_ex) {
                  nodeId = String(node.id_ex);
                } else {
                  // 生成一个临时ID
                  nodeId = `temp-${Math.random().toString(36).substring(2, 15)}`;
                  Logger.warn(`生成临时ID ${nodeId} 给没有ID的节点: ${JSON.stringify(node).substring(0, 100)}...`);
                  node.id = nodeId; // 添加ID到节点
                }
              }
              
              // 处理children属性，将对象引用转换为ID字符串
              let originalChildren: any[] = [];
              if (node.children && Array.isArray(node.children)) {
                // 保存原始children数组（包含对象引用）
                originalChildren = [...node.children];
                
                // 将children转换为ID数组
                node.children = originalChildren.map((child) => {
                  if (child && typeof child === 'object') {
                    // 获取子节点ID
                    if (child.id) {
                      return typeof child.id === 'string' ? child.id : String(child.id);
                    } else if (child.nodeId) {
                      return String(child.nodeId);
                    } else if (child.id_ex) {
                      return String(child.id_ex);
                    } else {
                      // 生成临时ID
                      const tempId = `temp-${Math.random().toString(36).substring(2, 15)}`;
                      child.id = tempId;
                      return tempId;
                    }
                  }
                  // 如果子节点已经是字符串ID，则直接返回
                  return typeof child === 'string' ? child : String(child);
                });
              }
              
              // 添加节点到Map
              nodeMap.set(nodeId, node);
              
              // 如果是根节点，添加到rootNodeIds
              if (isRoot) {
                rootNodeIds.push(nodeId);
                Logger.log(`添加根节点: ${nodeId}`);
              }
              
              // 递归处理子节点
              if (originalChildren.length > 0) {
                Logger.log(`处理节点${nodeId}的${originalChildren.length}个子节点`);
                originalChildren.forEach((childNode: any, index: number) => {
                  try {
                    if (childNode && typeof childNode === 'object') {
                      addNodeToMap(childNode);
                    } else {
                      Logger.warn(`跳过无效子节点 [${index}]: ${childNode}`);
                    }
                  } catch (childError) {
                    Logger.error(`处理子节点[${index}]出错: ${childError}`);
                  }
                });
              } else if (node.children && Array.isArray(node.children)) {
                Logger.log(`处理节点${nodeId}的${node.children.length}个子节点ID`);
              }
            } catch (error) {
              Logger.error(`处理节点出错: ${error}`, error);
            }
          };
          
          // 处理顶级节点
          if (typeof nodes === 'object' && nodes !== null) {
            Logger.log(`节点类型: ${Array.isArray(nodes) ? 'Array' : 'Object'}, 结构: ${JSON.stringify(nodes).substring(0, 200)}...`);
            
            // 判断是否为数组
            if (Array.isArray(nodes)) {
              // 直接遍历数组
              Logger.log(`处理节点数组, 长度: ${nodes.length}`);
              nodes.forEach(node => addNodeToMap(node, true));
            } else {
              // 作为对象处理，每个key对应一个节点
              const nodeValues = Object.values(nodes);
              Logger.log(`处理节点对象, 键数量: ${Object.keys(nodes).length}, 值类型: ${typeof nodeValues[0]}`);
              nodeValues.forEach(node => addNodeToMap(node, true));
            }
          } else {
            Logger.error(`Nodes不是有效对象或数组: ${typeof nodes}`);
          }
          
          Logger.log(`创建节点Map完成: 共${nodeMap.size}个节点, ${rootNodeIds.length}个根节点`);

          // 执行分片处理
          const chunks = this.figmaChunker.createChunks(
            nodeMap,
            metadata as any,
            globalVars || {},
            rootNodeIds,
            fileKey
          );

          // 存储分片
          await this.figmaCacheManager.cacheChunks(fileKey, chunks);

          // 返回第一个分片
          const firstChunk = chunks[0];
          const result = {
            metadata: firstChunk.metadata,
            nodes: firstChunk.nodes,
            globalVars: firstChunk.globalVars,
            chunking: {
              chunkId: firstChunk.chunkId,
              totalChunks: firstChunk.totalChunks,
              nextChunkId: firstChunk.nextChunkId,
              fileKey: firstChunk.fileKey
            }
          };

          const yamlResult = yaml.dump(result);

          return {
            content: [{ type: "text", text: yamlResult }],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : JSON.stringify(error);
          Logger.error(`Error fetching file ${fileKey}:`, message);
          return {
            isError: true,
            content: [{ type: "text", text: `Error fetching file: ${message}` }],
          };
        }
      },
    );

    // Tool to get a specific Figma chunk
    this.server.tool(
      "get_figma_chunk",
      "Fetch a specific chunk of Figma data based on its chunk ID",
      {
        fileKey: z
          .string()
          .describe(
            "The key of the Figma file to fetch, often found in a provided URL like figma.com/(file|design)/<fileKey>/...",
          ),
        chunkId: z
          .string()
          .describe(
            "The unique identifier of the chunk to retrieve",
          ),
      },
      async ({ fileKey, chunkId }) => {
        try {
          Logger.log(`Fetching chunk ${chunkId} for file ${fileKey}`);

          // 从缓存获取分片
          const chunk = await this.figmaCacheManager.getChunk(fileKey, chunkId);
          
          if (!chunk) {
            throw new Error(`Chunk ${chunkId} not found for file ${fileKey}`);
          }

          // 返回分片数据
          const result = {
            nodes: chunk.nodes,
            chunking: {
              chunkId: chunk.chunkId,
              totalChunks: chunk.totalChunks,
              nextChunkId: chunk.nextChunkId,
              fileKey: chunk.fileKey
            }
          };

          const yamlResult = yaml.dump(result);

          return {
            content: [{ type: "text", text: yamlResult }],
          };
        } catch (error) {
          const message = error instanceof Error ? error.message : JSON.stringify(error);
          Logger.error(`Error fetching chunk ${chunkId} for file ${fileKey}:`, message);
          return {
            isError: true,
            content: [{ type: "text", text: `Error fetching chunk: ${message}` }],
          };
        }
      },
    );

    // TODO: Clean up all image download related code, particularly getImages in Figma service
    // Tool to download images
    this.server.tool(
      "download_figma_images",
      "Download SVG and PNG images used in a Figma file based on the IDs of image or icon nodes",
      {
        fileKey: z.string().describe("The key of the Figma file containing the node"),
        nodes: z
          .object({
            nodeId: z
              .string()
              .describe("The ID of the Figma image node to fetch, formatted as 1234:5678"),
            imageRef: z
              .string()
              .optional()
              .describe(
                "If a node has an imageRef fill, you must include this variable. Leave blank when downloading Vector SVG images.",
              ),
            fileName: z.string().describe("The local name for saving the fetched file"),
          })
          .array()
          .describe("The nodes to fetch as images"),
        localPath: z
          .string()
          .describe(
            "The absolute path to the directory where images are stored in the project. If the directory does not exist, it will be created. The format of this path should respect the directory format of the operating system you are running on. Don't use any special character escaping in the path name either.",
          ),
      },
      async ({ fileKey, nodes, localPath }) => {
        try {
          const imageFills = nodes.filter(({ imageRef }) => !!imageRef) as {
            nodeId: string;
            imageRef: string;
            fileName: string;
          }[];
          const fillDownloads = this.figmaService.getImageFills(fileKey, imageFills, localPath);
          const renderRequests = nodes
            .filter(({ imageRef }) => !imageRef)
            .map(({ nodeId, fileName }) => ({
              nodeId,
              fileName,
              fileType: fileName.endsWith(".svg") ? ("svg" as const) : ("png" as const),
            }));

          const renderDownloads = this.figmaService.getImages(fileKey, renderRequests, localPath);

          const downloads = await Promise.all([fillDownloads, renderDownloads]).then(([f, r]) => [
            ...f,
            ...r,
          ]);

          // If any download fails, return false
          const saveSuccess = !downloads.find((success) => !success);
          return {
            content: [
              {
                type: "text",
                text: saveSuccess
                  ? `Success, ${downloads.length} images downloaded: ${downloads.join(", ")}`
                  : "Failed",
              },
            ],
          };
        } catch (error) {
          Logger.error(`Error downloading images from file ${fileKey}:`, error);
          return {
            isError: true,
            content: [{ type: "text", text: `Error downloading images: ${error}` }],
          };
        }
      },
    );
  }

  async connect(transport: Transport): Promise<void> {
    // Logger.log("Connecting to transport...");
    await this.server.connect(transport);

    Logger.log = (...args: any[]) => {
      this.server.server.sendLoggingMessage({
        level: "info",
        data: args,
      });
    };
    Logger.error = (...args: any[]) => {
      this.server.server.sendLoggingMessage({
        level: "error",
        data: args,
      });
    };
    Logger.warn = (...args: any[]) => {
      this.server.server.sendLoggingMessage({
        level: "warning",
        data: args,
      });
    };

    Logger.log("Server connected and ready to process requests");
  }

  async startHttpServer(port: number): Promise<void> {
    const app = express();

    app.get("/sse", async (req: Request, res: Response) => {
      console.log("Establishing new SSE connection");
      const transport = new SSEServerTransport(
        "/messages",
        res as unknown as ServerResponse<IncomingMessage>,
      );
      console.log(`New SSE connection established for sessionId ${transport.sessionId}`);

      this.transports[transport.sessionId] = transport;
      res.on("close", () => {
        delete this.transports[transport.sessionId];
      });

      await this.server.connect(transport);
    });

    app.post("/messages", async (req: Request, res: Response) => {
      const sessionId = req.query.sessionId as string;
      if (!this.transports[sessionId]) {
        res.status(400).send(`No transport found for sessionId ${sessionId}`);
        return;
      }
      console.log(`Received message for sessionId ${sessionId}`);
      await this.transports[sessionId].handlePostMessage(req, res);
    });

    Logger.log = console.log;
    Logger.error = console.error;
    Logger.warn = console.warn;

    this.httpServer = app.listen(port, () => {
      Logger.log(`HTTP server listening on port ${port}`);
      Logger.log(`SSE endpoint available at http://localhost:${port}/sse`);
      Logger.log(`Message endpoint available at http://localhost:${port}/messages`);
    });
  }

  async stopHttpServer(): Promise<void> {
    if (!this.httpServer) {
      throw new Error("HTTP server is not running");
    }

    return new Promise((resolve, reject) => {
      this.httpServer!.close((err: Error | undefined) => {
        if (err) {
          reject(err);
          return;
        }
        this.httpServer = null;
        const closing = Object.values(this.transports).map((transport) => {
          return transport.close();
        });
        Promise.all(closing).then(() => {
          resolve();
        });
      });
    });
  }
}
