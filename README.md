# Loop Goal 流程与阶段输出

## 状态机

```
PURSUING ⇄ PAUSED → ACHIEVED | BUDGET_LIMITED
```

| 状态 | 含义 |
|:---|:---|
| PURSUING | 追求中 — 正在执行迭代 |
| PAUSED | 已暂停 — 等待用户恢复 |
| ACHIEVED | 已达成 — 目标完成，调度已停止 |
| BUDGET_LIMITED | 预算耗尽 — Token 或时间超限，永久停用 |

---

## 全阶段流程与中文驱动输出

### 阶段 1: 创建 Goal

**触发**: 用户执行 `/loop goal:"<objective>" <prompt>`

**处理**:
- 校验目标条件非空
- 校验当前会话无活跃 Goal（单会话单活跃）
- 创建 LoopTask（interval=0, runNow=true）
- 注册调度、持久化到 JSON

**输出**:
```
循环任务已注册：
  ID: loop-xxxx
  间隔: 即时模式
  提示词: <用户输入>
  目标: <objective>
  状态: <路径>
  过期时间: <时间>
```

---

### 阶段 2: 调度触发（onTrigger）

**触发**: 定时器或事件驱动续行

**前置检查（三道关卡）**:

#### 2a. 会话繁忙检查
```
（无用户可见输出 — 日志记录: 跳过本次触发）
```

#### 2b. 时间预算检查
**条件**: `已用时 >= maxDurationMs`
**处理**: 标记 BUDGET_LIMITED，记录历史，停止调度
**输出**: 无用户可见输出（日志: 时间预算超限）

#### 2c. Token 预算检查
**条件**: `已消耗 Token >= maxTokens`
**处理**: 标记 BUDGET_LIMITED，记录历史，停止调度
**输出**: 无用户可见输出（日志: Token 预算超限）

---

### 阶段 3: 构建注入提示词（buildEffectivePrompt）

**处理**: 将目标条件、续行指引、预算信息注入原始 prompt

**注入内容**:
```
你正在朝向以下目标工作: <untrusted_objective>{目标条件}</untrusted_objective>
你的目标是完成此任务。

在继续之前，你应该完成以下步骤:
1. 回顾: 目标是什么? 检查已有的进展。
2. 审查: 对目标中的每一项，证明其已生效。
3. 如果你已完成所有项，说明你是如何达成每一项的。
   — 然后调用 update_goal(complete)。
4. 如果你遇到阻碍（在同一困境中尝试了 3 次），继续前进 —
   系统会检测到阻塞并自动暂停。

[紧急] 你即将耗尽 token 预算。 请集中精力高效完成目标。

已用 Token {consumed} / {max} ({percent}%)
已用时间: {duration}
```

---

### 阶段 4: AI 执行

**处理**: 将注入后的 prompt 发送给 AI Agent，等待回复

**输出**: AI 的回复文本（含可能的 `[GOAL_ACHIEVED]` 标记）

---

### 阶段 5: 执行后评估（六步顺序检查）

#### 5a. Token 累计
**处理**: 将本轮消耗的 Token 累加到 GoalState
**输出**: 无用户可见输出

#### 5b. 评估原因记录
**处理**: 提取 AI 回复末尾 200 字符作为评估原因，记录到 blocked 审计
**输出**: 无用户可见输出

#### 5c. 达成检测
**条件**: AI 回复包含 `[GOAL_ACHIEVED]`
**处理**: 标记 ACHIEVED，记录历史，停止调度
**输出**: 无用户可见输出（日志: Goal 已达成）

#### 5d. 阻塞检测（电路熔断）
**条件**: 连续 3 轮相同评估原因 → isGoalBlocked()
**处理**:
- 递增 blockedCycleCount
- 若累计 >= 5 次 → 标记 BUDGET_LIMITED，永久停用
- 否则 → 标记 PAUSED，暂停调度
**输出**: 无用户可见输出（日志: Goal 阻塞 / 阻塞周期耗尽）

#### 5e. 预算后置检查
**条件**: Token 累加后超过预算
**处理**: 标记 BUDGET_LIMITED，记录历史，停止调度
**输出**: 无用户可见输出（日志: 预算超限）

#### 5f. 无工具调用抑制
**条件**: 连续 2 轮无工具调用且迭代 > 1
**处理**: 标记 suppressed，30 秒后自动重试
**输出**: 无用户可见输出（日志: 无工具调用，抑制中）

---

### 阶段 6: 实时持久化

**处理**: 每次迭代后原子写入 loop-tasks.json（先写临时文件再 rename）
**覆盖内容**: Token 消耗、评估结果、迭代计数、抑制状态、GoalState 全量
**异常保护**: catch 块中也执行 saveToFile，防止 Token 状态丢失

---

### 阶段 7: 事件驱动续行

**条件**: Goal 活跃 && 未被抑制 && 会话不繁忙
**保护机制**:
- 最大续行深度: 3（超过后等待下次定时触发）
- 最小续行间隔: 2 秒（未满足则延迟重试）
**处理**: 启动新线程立即触发下一轮 onTrigger

---

### 阶段 8: 用户暂停

**触发**: `/loop pause <id>` 或 Web 界面暂停

**处理**: PURSUING → PAUSED，移除调度，保留任务

**输出**:
```
目标已暂停: <id>
  使用 /loop resume <id> 恢复。
```

---

### 阶段 9: 用户恢复

**触发**: `/loop resume <id>` 或 Web 界面恢复

**前置检查**:
- 电路熔断: 若 blockedCycleCount >= 5 → 拒绝恢复
- 状态检查: 仅 PAUSED 状态可恢复

**输出（成功）**:
```
目标已恢复: <id>
```

**输出（熔断拒绝）**:
```
目标已耗尽阻塞周期上限（5），无法恢复。
```

---

### 阶段 10: AI 工具调用（GoalTool）

AI 在迭代中可调用三个工具：

#### create_goal
**成功**: `已创建目标 — taskId='loop-xxxx', objective='...'. 可调用 get_goal 查看状态。`
**已有活跃目标**: `错误：已有一个活跃目标（loop-xxxx: ...）。请先使用 update_goal 或完成当前目标。`
**参数为空**: `错误：objective 参数不能为空`
**无会话**: `错误：未找到活跃会话`
**创建失败**: `错误：创建目标失败 — {原因}`

#### get_goal
**无活跃目标**: `null`
**有活跃目标**: 返回 JSON（字段名保持英文）:
```json
{
  "taskId": "loop-xxxx",
  "objective": "...",
  "status": "pursuing",
  "iteration": 3,
  "elapsedSeconds": 120,
  "consumedTokens": 5000,
  "maxTokens": 50000,
  "budgetExceeded": false
}
```

#### update_goal
**成功**: `已完成目标 '...' 已标记为完成（5000/50000 tokens 已消耗）`
**无活跃目标**: `错误：未找到活跃目标`
**非活跃状态**: `警告：目标不在活跃状态（ACHIEVED），无法标记为完成`
**状态参数错误**: `错误：未知状态 'xxx'. 仅支持 'complete'.`
**缺少参数**: `错误：status 参数必填（complete）`

---

### 阶段 11: 任务列表展示

**触发**: `/loop ls`

**输出格式**:
```
活跃循环任务：
  loop-xxxx  即时模式  运行中 ●目标 迭代:3 (12m30s)
    原因: ...检查测试结果，部分测试未通过...
  loop-yyyy  每 5m  空闲  迭代:8/10  <提示词>
```

**状态图标**:
| 图标 | 状态 |
|:---:|:---|
| ● | PURSUING（追求中） |
| ◌ | PAUSED（已暂停） |
| ✓ | ACHIEVED（已达成） |
| ⚠ | BUDGET_LIMITED（预算耗尽） |

---

### 阶段 12: JVM 关闭保护

**触发**: JVM ShutdownHook

**处理**: 遍历所有活跃 Goal，PURSUING → PAUSED，移除调度

**目的**: 确保重启后 Goal 不会自动恢复执行，需用户确认后手动恢复

---

### 阶段 13: 重启恢复

**触发**: 程序启动，从 JSON 加载任务

**处理**:
- 过滤过期/已取消任务
- 重新注册调度
- PAUSED 状态的 Goal 自动恢复（PURSUING）并重置 blocked 审计
- 持久化清理后的任务列表

---

## 预算三重保护

| 保护机制 | 触发条件 | 效果 |
|:---|:---|:---|
| Token 预算（前置） | 已消耗 >= maxTokens | BUDGET_LIMITED，停止调度 |
| 时间预算 | 已用时 >= maxDurationMs | BUDGET_LIMITED，停止调度 |
| Token 预算（后置） | 本轮累加后 >= maxTokens | BUDGET_LIMITED，停止调度 |
| 电路熔断 | 连续 3 轮相同阻塞 × 5 次 | BUDGET_LIMITED，永久停用 |

## 防重入机制

| 机制 | 说明 |
|:---|:---|
| tryStart() | 上一轮未执行完则跳过 |
| 会话繁忙检查 | 任一 BusyChecker 报告繁忙则跳过 |
| 无工具抑制 | 连续 2 轮无工具调用 → 暂停 30 秒 |
| 续行深度限制 | 最大 3 次连续续行 |
| 续行间隔限制 | 最小 2 秒间隔 |

## 电路熔断机制

```
连续 3 轮相同评估原因 → PAUSED（第 1~4 次阻塞）
累计 5 次阻塞 → BUDGET_LIMITED（第 5 次阻塞，永久停用）
恢复时重置 blocked 审计 → 连续计数归零
```
