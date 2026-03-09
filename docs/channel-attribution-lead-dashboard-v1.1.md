# 线索看板自动化方案 v1.1（dev）

日期：2026-03-05
版本：v1.1
负责人：dev（阿杰）

## v1.1 新增功能

### 1. CMF趋势专题点击事件
- 新增埋点事件：
  - `cmf_trend_click`: 用户点击CMF趋势模块
  - `cmf_color_click`: 点击颜色趋势
  - `cmf_material_click`: 点击材质趋势
  - `cmf_health_click`: 点击健康/适老趋势
  - `cmf_smart_click`: 点击智能升级趋势
  - `ai_business_click`: 点击AI商业化模块

### 2. 健康/适老需求标签采集
- 在留资表单中新增字段：
  - `elderly_need`: 是否有适老化改造需求（是/否/待定）
  - `health_concern`: 健康关注点（空气/光照/噪音/其他）
- 在线索入库时新增字段：
  - `cmf_interest`: CMF趋势兴趣标签
  - `ai_business_interest`: AI商业化兴趣标签

### 3. 线索看板扩展字段
- 新增统计维度：
  - CMF趋势专题点击量
  - AI商业化模块点击量
  - 适老化需求标签分布
  - 健康关注点分布
  - 各专题到留资的转化率

## 技术实现

### 前端埋点（track.ts）
```typescript
CMF_TREND_CLICK: 'cmf_trend_click',
CMF_COLOR_CLICK: 'cmf_color_click',
CMF_MATERIAL_CLICK: 'cmf_material_click',
CMF_HEALTH_CLICK: 'cmf_health_click',
CMF_SMART_CLICK: 'cmf_smart_click',
AI_BUSINESS_CLICK: 'ai_business_click',
```

### 后端入库（lead/route.ts）
新增字段：
- elderly_need
- health_concern
- cmf_interest（自动标记）
- ai_business_interest（自动标记）

## 验收标准
1. `track-events.jsonl` 出现新的6个CMF/AI商业化点击事件
2. `leads.json` 新线索含 elderly_need、health_concern 字段
3. 新线索自动标记 cmf_interest / ai_business_interest（基于点击行为）
4. 构建通过
