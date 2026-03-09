# 渠道归因与线索看板自动化方案 v1（dev）

日期：2026-03-04
负责人：dev（阿杰）

## 1. 目标
- 将落地页线索从“仅手机号”升级为“手机号 + 关键归因字段 + 用户决策上下文”。
- 可基于本地文件直接做渠道看板（MVP），后续可平滑迁移到数据库/BI。

## 2. 数据链路（v1）
1) 前端采集
- URL参数：utm_source / utm_medium / utm_campaign
- 用户行为：风格测试结果（quizStyleResult）、预算测算（budgetArea/budgetLevel）
- 留资信息：phone/name/city/need

2) 后端入库（本地）
- 接口：`POST /api/lead`
- 存储：`leads.json`
- 去重规则：手机号去重（重复返回已提交）

3) 行为日志（事件）
- 接口：`POST /api/track`
- 存储：`track-events.jsonl`
- 关键事件：style_quiz_complete / budget_calculate / lead_submit / lead_submit_fail

## 3. 线索看板字段（MVP）
- 时间：createdAt
- 线索主键：phone
- 渠道：source, utm_medium, utm_campaign
- 意向：selectedStyleId, quizStyleResult
- 预算：budgetArea, budgetLevel
- 备注：city, need

## 4. 自动化产出（v1）
当前可直接做：
- 渠道线索量统计（按 source）
- 活动线索量统计（按 utm_campaign）
- 预算层级分布（budgetLevel）
- 风格偏好分布（selectedStyleId / quizStyleResult）
- 提交失败率（lead_submit_fail / lead_submit）

## 5. 验收方式
- 验收1：`leads.json` 每条新线索含 source + utm + budget + style 字段。
- 验收2：`track-events.jsonl` 出现 style_quiz_complete / budget_calculate / lead_submit 事件。
- 验收3：同手机号重复提交时，不新增重复线索。

## 6. 限制与下一步
- v1限制：本地文件存储，不支持多人并发写冲突控制。
- 下一步：
  1) 增加`/api/dashboard/summary`聚合接口；
  2) 日报自动生成（渠道转化、预算分布、风格偏好）；
  3) 接入正式数据库和可视化面板。
