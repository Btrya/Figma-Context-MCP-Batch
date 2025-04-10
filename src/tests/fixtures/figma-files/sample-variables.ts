/**
 * 示例Figma全局变量数据
 * 用于测试全局变量分片策略
 */

export const sampleVariables = {
  // 颜色变量
  "var:1:1": {
    type: "COLOR",
    name: "颜色/主要",
    value: { r: 0.2, g: 0.4, b: 0.9, a: 1 },
    description: "主要品牌色"
  },
  "var:1:2": {
    type: "COLOR",
    name: "颜色/次要",
    value: { r: 0.9, g: 0.3, b: 0.1, a: 1 },
    description: "次要品牌色"
  },
  "var:1:3": {
    type: "COLOR",
    name: "颜色/中性/100",
    value: { r: 0, g: 0, b: 0, a: 1 },
    description: "黑色"
  },
  "var:1:4": {
    type: "COLOR",
    name: "颜色/中性/0",
    value: { r: 1, g: 1, b: 1, a: 1 },
    description: "白色"
  },
  "var:1:5": {
    type: "COLOR",
    name: "颜色/中性/10",
    value: { r: 0.9, g: 0.9, b: 0.9, a: 1 },
    description: "浅灰色"
  },
  "var:1:6": {
    type: "COLOR",
    name: "颜色/中性/50",
    value: { r: 0.5, g: 0.5, b: 0.5, a: 1 },
    description: "中灰色"
  },
  
  // 数值变量
  "var:2:1": {
    type: "FLOAT",
    name: "间距/小",
    value: 4,
    description: "小间距"
  },
  "var:2:2": {
    type: "FLOAT",
    name: "间距/中",
    value: 8,
    description: "中间距"
  },
  "var:2:3": {
    type: "FLOAT",
    name: "间距/大",
    value: 16,
    description: "大间距"
  },
  "var:2:4": {
    type: "FLOAT",
    name: "圆角/小",
    value: 4,
    description: "小圆角"
  },
  "var:2:5": {
    type: "FLOAT",
    name: "圆角/中",
    value: 8,
    description: "中圆角"
  },
  "var:2:6": {
    type: "FLOAT",
    name: "圆角/大",
    value: 16,
    description: "大圆角"
  },
  
  // 字符串变量
  "var:3:1": {
    type: "STRING",
    name: "字体/主要",
    value: "Roboto",
    description: "主要字体"
  },
  "var:3:2": {
    type: "STRING",
    name: "字体/次要",
    value: "Open Sans",
    description: "次要字体"
  },
  
  // 布尔变量
  "var:4:1": {
    type: "BOOLEAN",
    name: "开关/默认",
    value: false,
    description: "默认开关状态"
  },
  
  // 文本样式变量
  "var:5:1": {
    type: "TEXT_STYLE",
    name: "文本/标题/大",
    value: {
      fontFamily: "Roboto",
      fontSize: 24,
      fontWeight: 500,
      lineHeight: 1.5,
      letterSpacing: 0,
      textCase: "ORIGINAL",
      textDecoration: "NONE"
    },
    description: "大标题文本样式"
  },
  "var:5:2": {
    type: "TEXT_STYLE",
    name: "文本/标题/中",
    value: {
      fontFamily: "Roboto",
      fontSize: 20,
      fontWeight: 500,
      lineHeight: 1.5,
      letterSpacing: 0,
      textCase: "ORIGINAL",
      textDecoration: "NONE"
    },
    description: "中标题文本样式"
  },
  "var:5:3": {
    type: "TEXT_STYLE",
    name: "文本/正文",
    value: {
      fontFamily: "Roboto",
      fontSize: 16,
      fontWeight: 400,
      lineHeight: 1.5,
      letterSpacing: 0,
      textCase: "ORIGINAL",
      textDecoration: "NONE"
    },
    description: "正文文本样式"
  },
  
  // 效果样式变量
  "var:6:1": {
    type: "EFFECT_STYLE",
    name: "阴影/小",
    value: {
      effects: [
        {
          type: "DROP_SHADOW",
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.1 },
          offset: { x: 0, y: 1 },
          radius: 2,
          spread: 0
        }
      ]
    },
    description: "小阴影效果"
  },
  "var:6:2": {
    type: "EFFECT_STYLE",
    name: "阴影/中",
    value: {
      effects: [
        {
          type: "DROP_SHADOW",
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.1 },
          offset: { x: 0, y: 2 },
          radius: 4,
          spread: 0
        }
      ]
    },
    description: "中阴影效果"
  },
  "var:6:3": {
    type: "EFFECT_STYLE",
    name: "阴影/大",
    value: {
      effects: [
        {
          type: "DROP_SHADOW",
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.15 },
          offset: { x: 0, y: 4 },
          radius: 8,
          spread: 0
        },
        {
          type: "DROP_SHADOW",
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.05 },
          offset: { x: 0, y: 1 },
          radius: 2,
          spread: 0
        }
      ]
    },
    description: "大阴影效果"
  }
}; 