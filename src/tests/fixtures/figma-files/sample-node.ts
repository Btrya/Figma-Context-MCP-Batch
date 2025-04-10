/**
 * 示例Figma节点数据
 * 用于测试节点分片策略
 */

// 定义类型接口
interface FigmaColor {
  r: number;
  g: number;
  b: number;
  a?: number;
}

interface FigmaFill {
  type: string;
  visible: boolean;
  opacity: number;
  color: FigmaColor;
}

interface FigmaStroke {
  type: string;
  visible: boolean;
  opacity: number;
  color: FigmaColor;
}

interface FigmaEffect {
  type: string;
  visible: boolean;
  color: FigmaColor;
  offset?: { x: number; y: number };
  radius?: number;
  spread?: number;
}

// 导出示例节点
export const sampleNode = {
  id: "2:1",
  name: "主屏幕",
  type: "FRAME",
  x: 0,
  y: 0,
  width: 375,
  height: 812,
  backgroundColor: { r: 1, g: 1, b: 1 },
  cornerRadius: 0,
  layoutMode: "VERTICAL",
  primaryAxisSizingMode: "FIXED",
  counterAxisSizingMode: "FIXED",
  itemSpacing: 10,
  paddingLeft: 16,
  paddingRight: 16,
  paddingTop: 20,
  paddingBottom: 20,
  fills: [
    {
      type: "SOLID",
      visible: true,
      opacity: 1,
      color: { r: 1, g: 1, b: 1 }
    }
  ] as FigmaFill[],
  strokes: [] as FigmaStroke[],
  effects: [
    {
      type: "DROP_SHADOW",
      visible: true,
      color: { r: 0, g: 0, b: 0, a: 0.1 },
      offset: { x: 0, y: 2 },
      radius: 4,
      spread: 0
    }
  ] as FigmaEffect[],
  children: [
    {
      id: "3:1",
      name: "标题",
      type: "TEXT",
      x: 16,
      y: 20,
      width: 343,
      height: 36,
      characters: "欢迎使用我们的应用",
      fontSize: 24,
      fontName: { family: "Roboto", style: "Medium" },
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      letterSpacing: 0,
      lineHeight: { unit: "PIXELS", value: 36 },
      fills: [
        {
          type: "SOLID",
          visible: true,
          opacity: 1,
          color: { r: 0, g: 0, b: 0 }
        }
      ] as FigmaFill[],
      strokes: [] as FigmaStroke[],
      effects: [] as FigmaEffect[]
    },
    {
      id: "3:2",
      name: "描述",
      type: "TEXT",
      x: 16,
      y: 66,
      width: 343,
      height: 48,
      characters: "这是一个示例应用，用于演示Figma数据分片算法的工作原理。",
      fontSize: 16,
      fontName: { family: "Roboto", style: "Regular" },
      textAlignHorizontal: "LEFT",
      textAlignVertical: "TOP",
      letterSpacing: 0,
      lineHeight: { unit: "PIXELS", value: 24 },
      fills: [
        {
          type: "SOLID",
          visible: true,
          opacity: 1,
          color: { r: 0.4, g: 0.4, b: 0.4 }
        }
      ] as FigmaFill[],
      strokes: [] as FigmaStroke[],
      effects: [] as FigmaEffect[]
    },
    {
      id: "3:3",
      name: "按钮容器",
      type: "FRAME",
      x: 16,
      y: 134,
      width: 343,
      height: 50,
      layoutMode: "HORIZONTAL",
      primaryAxisSizingMode: "FIXED",
      counterAxisSizingMode: "FIXED",
      itemSpacing: 16,
      paddingLeft: 0,
      paddingRight: 0,
      paddingTop: 0,
      paddingBottom: 0,
      fills: [] as FigmaFill[],
      strokes: [] as FigmaStroke[],
      effects: [] as FigmaEffect[],
      children: [
        {
          id: "4:1",
          name: "主要按钮",
          type: "RECTANGLE",
          x: 0,
          y: 0,
          width: 163.5,
          height: 50,
          cornerRadius: 8,
          fills: [
            {
              type: "SOLID",
              visible: true,
              opacity: 1,
              color: { r: 0.2, g: 0.4, b: 0.9 }
            }
          ] as FigmaFill[],
          strokes: [] as FigmaStroke[],
          effects: [] as FigmaEffect[]
        },
        {
          id: "4:2",
          name: "次要按钮",
          type: "RECTANGLE",
          x: 179.5,
          y: 0,
          width: 163.5,
          height: 50,
          cornerRadius: 8,
          fills: [
            {
              type: "SOLID",
              visible: true,
              opacity: 1,
              color: { r: 0.9, g: 0.9, b: 0.9 }
            }
          ] as FigmaFill[],
          strokes: [
            {
              type: "SOLID",
              visible: true,
              opacity: 1,
              color: { r: 0.2, g: 0.4, b: 0.9 }
            }
          ] as FigmaStroke[],
          effects: [] as FigmaEffect[]
        }
      ]
    },
    {
      id: "3:4",
      name: "内容容器",
      type: "FRAME",
      x: 16,
      y: 204,
      width: 343,
      height: 400,
      layoutMode: "VERTICAL",
      primaryAxisSizingMode: "FIXED",
      counterAxisSizingMode: "FIXED",
      itemSpacing: 16,
      paddingLeft: 16,
      paddingRight: 16,
      paddingTop: 16,
      paddingBottom: 16,
      cornerRadius: 8,
      fills: [
        {
          type: "SOLID",
          visible: true,
          opacity: 1,
          color: { r: 0.97, g: 0.97, b: 0.97 }
        }
      ] as FigmaFill[],
      strokes: [] as FigmaStroke[],
      effects: [
        {
          type: "DROP_SHADOW",
          visible: true,
          color: { r: 0, g: 0, b: 0, a: 0.05 },
          offset: { x: 0, y: 1 },
          radius: 2,
          spread: 0
        }
      ] as FigmaEffect[],
      children: [
        {
          id: "4:3",
          name: "项目1",
          type: "FRAME",
          x: 16,
          y: 16,
          width: 311,
          height: 60,
          layoutMode: "HORIZONTAL",
          primaryAxisSizingMode: "FIXED",
          counterAxisSizingMode: "FIXED",
          itemSpacing: 12,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 12,
          paddingBottom: 12,
          cornerRadius: 6,
          fills: [
            {
              type: "SOLID",
              visible: true,
              opacity: 1,
              color: { r: 1, g: 1, b: 1 }
            }
          ] as FigmaFill[],
          strokes: [] as FigmaStroke[],
          effects: [] as FigmaEffect[]
        },
        {
          id: "4:4",
          name: "项目2",
          type: "FRAME",
          x: 16,
          y: 92,
          width: 311,
          height: 60,
          layoutMode: "HORIZONTAL",
          primaryAxisSizingMode: "FIXED",
          counterAxisSizingMode: "FIXED",
          itemSpacing: 12,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 12,
          paddingBottom: 12,
          cornerRadius: 6,
          fills: [
            {
              type: "SOLID",
              visible: true,
              opacity: 1,
              color: { r: 1, g: 1, b: 1 }
            }
          ] as FigmaFill[],
          strokes: [] as FigmaStroke[],
          effects: [] as FigmaEffect[]
        },
        {
          id: "4:5",
          name: "项目3",
          type: "FRAME",
          x: 16,
          y: 168,
          width: 311,
          height: 60,
          layoutMode: "HORIZONTAL",
          primaryAxisSizingMode: "FIXED",
          counterAxisSizingMode: "FIXED",
          itemSpacing: 12,
          paddingLeft: 12,
          paddingRight: 12,
          paddingTop: 12,
          paddingBottom: 12,
          cornerRadius: 6,
          fills: [
            {
              type: "SOLID",
              visible: true,
              opacity: 1,
              color: { r: 1, g: 1, b: 1 }
            }
          ] as FigmaFill[],
          strokes: [] as FigmaStroke[],
          effects: [] as FigmaEffect[]
        }
      ]
    }
  ]
}; 