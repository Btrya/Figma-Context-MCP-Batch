<a href="https://www.framelink.ai/?utm_source=github&utm_medium=readme&utm_campaign=readme" target="_blank" rel="noopener">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="https://www.framelink.ai/github/HeaderDark.png" />
    <img alt="Framelink" src="https://www.framelink.ai/github/HeaderLight.png" />
  </picture>
</a>

<div align="center">
  <h1>Framelink Figma MCP Server</h1>
  <h3>Give your coding agent access to your Figma data.<br/>Implement designs in any framework in one-shot.</h3>
  <a href="https://npmcharts.com/compare/figma-developer-mcp?interval=30">
    <img alt="weekly downloads" src="https://img.shields.io/npm/dm/figma-developer-mcp.svg">
  </a>
  <a href="https://github.com/GLips/Figma-Context-MCP/blob/main/LICENSE">
    <img alt="MIT License" src="https://img.shields.io/github/license/GLips/Figma-Context-MCP" />
  </a>
  <a href="https://framelink.ai/discord">
    <img alt="Discord" src="https://img.shields.io/discord/1352337336913887343?color=7389D8&label&logo=discord&logoColor=ffffff" />
  </a>
  <br />
  <a href="https://twitter.com/glipsman">
    <img alt="Twitter" src="https://img.shields.io/twitter/url?url=https%3A%2F%2Fx.com%2Fglipsman&label=%40glipsman" />
  </a>
</div>

<br/>

Give [Cursor](https://cursor.sh/), [Windsurf](https://codeium.com/windsurf), [Cline](https://cline.bot/), and other AI-powered coding tools access to your Figma files with this [Model Context Protocol](https://modelcontextprotocol.io/introduction) server.

When Cursor has access to Figma design data, it's **way** better at one-shotting designs accurately than alternative approaches like pasting screenshots.

<h3><a href="https://www.framelink.ai/docs/quickstart?utm_source=github&utm_medium=readme&utm_campaign=readme">See quickstart instructions →</a></h3>

## Demo

[Watch a demo of building a UI in Cursor with Figma design data](https://youtu.be/6G9yb-LrEqg)

[![Watch the video](https://img.youtube.com/vi/6G9yb-LrEqg/maxresdefault.jpg)](https://youtu.be/6G9yb-LrEqg)

## How it works

1. Open your IDE's chat (e.g. agent mode in Cursor).
2. Paste a link to a Figma file, frame, or group.
3. Ask Cursor to do something with the Figma file—e.g. implement the design.
4. Cursor will fetch the relevant metadata from Figma and use it to write your code.

This MCP server is specifically designed for use with Cursor. Before responding with context from the [Figma API](https://www.figma.com/developers/api), it simplifies and translates the response so only the most relevant layout and styling information is provided to the model.

Reducing the amount of context provided to the model helps make the AI more accurate and the responses more relevant.

## Getting Started

Many code editors and other AI clients use a configuration file to manage MCP servers.

The `figma-developer-mcp` server can be configured by adding the following to your configuration file.

> NOTE: You will need to create a Figma access token to use this server. Instructions on how to create a Figma API access token can be found [here](https://help.figma.com/hc/en-us/articles/8085703771159-Manage-personal-access-tokens).

### MacOS / Linux

```json
{
  "mcpServers": {
    "Framelink Figma MCP": {
      "command": "npx",
      "args": ["-y", "figma-developer-mcp", "--figma-api-key=YOUR-KEY", "--stdio"]
    }
  }
}
```

### Windows

```json
{
  "mcpServers": {
    "Framelink Figma MCP": {
      "command": "cmd",
      "args": ["/c", "npx", "-y", "figma-developer-mcp", "--figma-api-key=YOUR-KEY", "--stdio"]
    }
  }
}
```

If you need more information on how to configure the Framelink Figma MCP server, see the [Framelink docs](https://www.framelink.ai/docs/quickstart?utm_source=github&utm_medium=readme&utm_campaign=readme).

## Star History

<a href="https://star-history.com/#GLips/Figma-Context-MCP"><img src="https://api.star-history.com/svg?repos=GLips/Figma-Context-MCP&type=Date" alt="Star History Chart" width="600" /></a>

## Learn More

The Framelink Figma MCP server is simple but powerful. Get the most out of it by learning more at the [Framelink](https://framelink.ai?utm_source=github&utm_medium=readme&utm_campaign=readme) site.

## 开发指南

### 环境准备

在开始开发之前，您需要满足以下条件：

1. **Node.js**: 版本 >= 18.0.0
2. **包管理器**: pnpm (推荐)、npm 或 yarn
3. **Figma API Key**: 用于访问Figma API的个人访问令牌

对于存储器功能 (story-3)，根据您选择的存储方式，您可能需要：

#### Redis 存储

1. 安装 Redis 服务器：
   - macOS: `brew install redis`
   - Linux: `sudo apt install redis-server`
   - Windows: 从[Redis官网](https://redis.io/download)下载安装
   - 使用Docker: `docker run --name redis -p 6379:6379 -d redis`

2. 启动 Redis 服务器：
   - macOS/Linux: `redis-server`
   - 使用Docker: 服务已在容器中启动

3. Redis 默认配置：
   - 主机: localhost
   - 端口: 6379
   - DB: 0
   - 密钥前缀: figma:chunk:

#### MongoDB 存储

1. 安装 MongoDB 服务器：
   - macOS: `brew install mongodb-community`
   - Linux: 参考[MongoDB官方文档](https://www.mongodb.com/docs/manual/administration/install-on-linux/)
   - Windows: 参考[MongoDB官方文档](https://www.mongodb.com/docs/manual/tutorial/install-mongodb-on-windows/)
   - 使用Docker: `docker run --name mongodb -p 27017:27017 -d mongo`

2. 启动 MongoDB 服务器：
   - macOS/Linux: `mongod --dbpath=/path/to/data/db`
   - Windows: 作为服务自动启动或使用mongod命令
   - 使用Docker: 服务已在容器中启动

3. MongoDB 默认配置：
   - 连接URI: mongodb://localhost:27017
   - 数据库名: figma_cache
   - 集合名: chunks

### 快速启动开发环境

1. **设置环境变量**：复制`.env.example`文件并重命名为`.env`，然后填入您的Figma API密钥:
   ```bash
   cp .env.example .env
   # 编辑.env文件，填入您的FIGMA_API_KEY
   ```

2. **安装依赖**：
   ```bash
   pnpm install
   ```

3. **以开发模式启动服务器**：
   ```bash
   pnpm dev
   ```

4. **以不同模式启动**：
   - HTTP模式: `pnpm start:http`
   - CLI (stdio)模式: `pnpm start:cli`

### 常见问题

- **连接Redis失败**：确保Redis服务器正在运行，且配置信息正确
- **连接MongoDB失败**：确保MongoDB服务器正在运行，且有适当的访问权限
- **Figma API错误**：验证您的Figma API密钥是否有效，并且没有超出API请求限制

### 使用Docker Compose (可选)

如果您喜欢使用Docker进行开发，可以创建`docker-compose.yml`文件：

```yaml
version: '3'

services:
  redis:
    image: redis:alpine
    ports:
      - "2333:6379"
    volumes:
      - redis_data:/data

  mongodb:
    image: mongo:latest
    ports:
      - "2334:27017"
    volumes:
      - mongo_data:/data/db
    environment:
      - MONGO_INITDB_DATABASE=figma_cache
      
  # 如果需要可视化管理工具
  mongo-express:
    image: mongo-express
    restart: always
    ports:
      - "2335:8081"
    environment:
      - ME_CONFIG_MONGODB_SERVER=mongodb
    depends_on:
      - mongodb

volumes:
  redis_data:
  mongo_data:
```

项目提供了以下命令来管理Docker环境：

```bash
# 启动Docker服务
pnpm docker:up

# 停止Docker服务
pnpm docker:down

# 重启Docker服务
pnpm docker:restart

# 查看Docker服务日志
pnpm docker:logs

# 查看Docker服务状态
pnpm docker:ps
```

使用上述端口配置时，Redis和MongoDB的连接配置应相应修改为：

- Redis: 主机=localhost, 端口=2333
- MongoDB: mongodb://localhost:2334/figma_cache

MongoDB管理界面可通过 http://localhost:2335 访问。
