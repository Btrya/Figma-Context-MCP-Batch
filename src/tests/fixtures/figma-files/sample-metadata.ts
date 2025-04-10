/**
 * 示例Figma元数据
 * 用于测试元数据分片策略
 */

export const sampleMetadata = {
  name: "测试设计文件",
  lastModified: "2023-05-15T10:30:45Z",
  version: "2.0.0",
  thumbnailUrl: "https://example.com/thumbnail.png",
  schemaVersion: 14.0,
  documentationLinks: [
    { title: "使用指南", url: "https://example.com/guide" },
    { title: "设计规范", url: "https://example.com/specs" }
  ],
  
  editorType: "figma",
  linkAccess: "view",
  createdAt: "2023-01-10T08:15:30Z",
  branches: ["main", "feature-a", "feature-b"],
  
  document: {
    id: "0:1",
    name: "Document",
    type: "DOCUMENT",
    children: [
      {
        id: "1:1",
        name: "页面 1",
        type: "CANVAS",
        children: [
          {
            id: "2:1",
            name: "框架 1",
            type: "FRAME",
            children: [
              { id: "3:1", name: "矩形 1", type: "RECTANGLE" },
              { id: "3:2", name: "文本 1", type: "TEXT" }
            ]
          },
          {
            id: "2:2",
            name: "组件 1",
            type: "COMPONENT",
            children: [
              { id: "3:3", name: "图标", type: "VECTOR" }
            ]
          }
        ]
      },
      {
        id: "1:2",
        name: "页面 2",
        type: "CANVAS",
        children: [
          {
            id: "2:3",
            name: "框架 2",
            type: "FRAME",
            children: [
              { id: "3:4", name: "按钮", type: "INSTANCE" }
            ]
          }
        ]
      }
    ]
  },
  
  components: {
    "4:1": { name: "按钮/主要", description: "主要按钮组件" },
    "4:2": { name: "按钮/次要", description: "次要按钮组件" },
    "4:3": { name: "图标/添加", description: "添加图标" }
  },
  
  styles: {
    "5:1": { name: "颜色/主要", description: "主要品牌色" },
    "5:2": { name: "颜色/次要", description: "次要品牌色" },
    "5:3": { name: "文本/标题", description: "标题文本样式" }
  },
  
  users: [
    { id: "user1", name: "设计师A", photoUrl: "https://example.com/user1.jpg" },
    { id: "user2", name: "设计师B", photoUrl: "https://example.com/user2.jpg" }
  ],
  
  lastUser: { id: "user1", name: "设计师A" }
}; 