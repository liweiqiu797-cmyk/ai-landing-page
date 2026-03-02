# 落地页风格扩展与视觉升级 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 将落地页升级为“8种风格可选（含平面图方案）+ 每风格10组提示词随机注入 + 视觉升级（卡片/预览/对比/动效）”。

**Architecture:** 前端负责风格选择、样式卡片展示、提示词轮换状态管理；后端API接收`styleId`并根据提示词库生成`prompt`；`jimeng.ts`只负责调用模型。提示词策略采用“每风格10条模板 + 轮换游标（避免重复）+ 随机扰动”。

**Tech Stack:** Next.js App Router, React 19, TypeScript, TailwindCSS, existing `/api/generate` + `src/lib/jimeng.ts`

---

## 字段设计

### 1) 前端状态字段（`src/app/page.tsx`）
- `selectedStyleId: string`  当前选中的风格ID
- `stylePromptCursor: Record<string, number>`  每个风格的轮换游标
- `generationMeta: { styleId: string; styleName: string; promptIndex: number } | null`  最近一次生成使用的元信息
- `showStylePanel: boolean`  风格面板显隐（上传后显示）

### 2) API请求字段（`POST /api/generate`）
- `imageUrl: string`（已有）
- `styleId: string`（新增，必填）
- `promptIndex?: number`（新增，可选；前端可传，后端兜底）

### 3) API响应字段（`POST /api/generate`）
- `success: boolean`
- `images: string[]`
- `styleId: string`
- `styleName: string`
- `promptIndex: number`（本次用到的模板索引，便于调试）

### 4) 提示词库结构（新文件 `src/lib/style-prompts.ts`）
```ts
export type StyleId = 'modern'|'nordic'|'chinese'|'luxury'|'wabi'|'industrial'|'cream'|'floorplan'

export const STYLE_CONFIG: Record<StyleId, {
  name: string
  desc: string
  cover: string
  isFloorPlan?: boolean
  prompts: string[] // >=10
}> = { ... }
```

---

## 改动文件清单

### 新增
1. `src/lib/style-prompts.ts`
   - 8种风格配置
   - 每风格10组提示词模板
   - 平面图方案模板（强调2D floor plan / top view / zoning）

2. `src/components/StyleCard.tsx`（可选，若拆分）
   - 风格卡片组件（选中态、锁定态、hover动效）

### 修改
1. `src/app/page.tsx`
   - Hero上传后展示“风格选择面板”
   - 8风格卡片网格 + 预览区 + before/after对比
   - 生成按钮触发时携带`styleId`
   - 每次生成更新`generationMeta`与轮换游标

2. `src/app/api/generate/route.ts`
   - 接收`styleId/promptIndex`
   - 调用提示词库选择模板
   - 返回`styleName/promptIndex`

3. `src/lib/jimeng.ts`
   - `submitImageTask`参数改为接收完整prompt（不再在函数内拼接style文案）

4. `src/lib/track.ts`
   - 新增事件：`STYLE_SELECT`, `PROMPT_ROTATE`, `FLOORPLAN_SELECT`

5. `src/app/globals.css`
   - 新增卡片/对比滑块/动效样式

---

## 任务分解（90分钟内先交可运行版本）

### Task 1: 建立风格与提示词库
**Files:**
- Create: `src/lib/style-prompts.ts`

Step 1: 定义8种风格（含`floorplan`）
Step 2: 每风格写10条中文提示词模板（共80条）
Step 3: 实现`pickPrompt(styleId, cursor)`返回`{prompt, index, nextCursor}`
Step 4: 本地类型检查
Step 5: commit

### Task 2: API支持styleId与模板注入
**Files:**
- Modify: `src/app/api/generate/route.ts`
- Modify: `src/lib/jimeng.ts`

Step 1: API参数校验`styleId`
Step 2: 按`styleId`获取模板并注入
Step 3: 调整`submitImageTask`入参为`(imageUrl, fullPrompt)`
Step 4: 返回`styleName/promptIndex`
Step 5: commit

### Task 3: 前端风格选择与生成流程
**Files:**
- Modify: `src/app/page.tsx`

Step 1: 新增`selectedStyleId/stylePromptCursor/generationMeta`
Step 2: 上传后显示风格面板（8卡片）
Step 3: 生成时传`styleId`，收到响应更新预览
Step 4: floorplan选中时给明显标签
Step 5: commit

### Task 4: 视觉升级（卡片/预览/对比/动效）
**Files:**
- Modify: `src/app/page.tsx`
- Modify: `src/app/globals.css`

Step 1: 风格卡片增加封面、描述、选中边框
Step 2: 结果区增加“原图 vs 效果图”对比布局
Step 3: 增加轻量动效（hover/selected/loading）
Step 4: 移动端适配
Step 5: commit

### Task 5: 验证与交付
**Files:**
- Modify: `landing-page/PROGRESS.md`

Step 1: 运行`npx next build`
Step 2: 本地手测（上传->选风格->生成）
Step 3: push main触发Vercel部署
Step 4: 记录验收截图路径与结果
Step 5: 更新进度文档并回传lead
