/*
 * Copyright 2017-2026 noear.org and authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *   https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.noear.solon.codecli.command.builtin;

import org.noear.snack4.ONode;
import org.noear.snack4.Options;
import org.noear.snack4.Feature;
import org.noear.solon.ai.annotation.ToolMapping;
import org.noear.solon.ai.chat.talent.AbsTalent;
import org.noear.solon.annotation.Param;

/**
 * Goal 工具 — 模型侧 Goal 生命周期控制（100% Codex CLI 对齐）
 *
 * <p>提供三个工具：
 * <ul>
 *   <li>{@code create_goal} — 创建新 goal（参数：objective + token_budget）</li>
 *   <li>{@code get_goal} — 查询当前 goal 状态，无 goal 返回 null</li>
 *   <li>{@code update_goal} — 仅标记 complete（blocked 由运行时自动检测）</li>
 * </ul>
 *
 * @author noear
 * @since 3.9.3
 */
public class GoalTool extends AbsTalent {

    private final LoopScheduler scheduler;

    public GoalTool(LoopScheduler scheduler) {
        this.scheduler = scheduler;
    }


    /**
     * 创建新的 Goal（Codex 签名对齐：objective + token_budget）
     */
    @ToolMapping(name = "create_goal",
            description = "创建一个新目标，引导对话朝向特定目标推进。" +
                    "每次对话同一时间最多只能有一个活跃目标。" +
                    "如果已存在活跃目标，此操作将失败。")
    public String createGoal(
            @Param(name = "objective", description = "要达成的目标") String objective,
            @Param(name = "token_budget", description = "Token 预算上限（可选）", required = false) Long tokenBudget,
            String __sessionId,
            String __cwd) {

        if (objective == null || objective.isEmpty()) {
            return "错误：objective 参数不能为空";
        }

        String sessionId = __sessionId;
        if (sessionId == null) {
            return "错误：未找到活跃会话";
        }

        LoopTask existing = scheduler.findActiveGoalAcrossSessions();
        if (existing != null) {
            GoalState gs = existing.getGoalState();
            return "错误：已有一个活跃目标（" + existing.getId()
                    + ": " + gs.getCondition()
                    + "）。请先使用 update_goal 或完成当前目标。";
        }

        LoopTask task = new LoopTask(objective, 0, null,
                objective, false, 0, true);

        long maxTokens = tokenBudget != null ? tokenBudget : 0;
        task.setMaxTokens(maxTokens);

        try {
            scheduler.schedule(sessionId, task);
            GoalState gs = task.getGoalState();

            return "已创建目标 — taskId='" + task.getId()
                    + "', objective='" + objective
                    + "'. 可调用 get_goal 查看状态。";
        } catch (Exception e) {
            return "错误：创建目标失败 — " + e.getMessage();
        }
    }

    /**
     * 获取当前 goal 状态（无 goal 时返回 null，Codex 对齐）
     */
    @ToolMapping(name = "get_goal",
            description = "获取当前活跃目标的状态，若无活跃目标则返回 null。")
    public String getGoal(String __sessionId,
                          String __cwd) {
        LoopTask task = scheduler.findActiveGoalAcrossSessions();
        if (task == null) {
            return "null";
        }

        GoalState gs = task.getGoalState();

        ONode root = new ONode(Options.of(Feature.Write_PrettyFormat));
        root.set("taskId", task.getId());
        root.set("objective", gs.getCondition());
        root.set("status", gs.getStatus().name().toLowerCase());
        root.set("iteration", task.getCurrentIteration());

        long elapsed = (System.currentTimeMillis() - gs.getStartEpochMs()) / 1000;
        root.set("elapsedSeconds", elapsed);
        root.set("consumedTokens", gs.getConsumedTokens());
        if (gs.getMaxTokens() > 0) {
            root.set("maxTokens", gs.getMaxTokens());
        }
        root.set("budgetExceeded", gs.isBudgetExceeded());

        return root.toJson();
    }

    /**
     * 标记 goal 完成（Codex：仅接受 complete，blocked 由运行时自动检测）
     */
    @ToolMapping(name = "update_goal",
            description = "将当前活跃目标标记为已完成。" +
                    "仅当目标已成功达成时才调用此工具。" +
                    "如果遇到阻塞，请勿调用 — 系统会自动检测并暂停。")
    public String updateGoal(
            @Param(name = "status", description = "状态值：complete") String status,
            String __sessionId,
            String __cwd) {

        if (status == null) {
            return "错误：status 参数必填（complete）";
        }

        if (!"complete".equals(status)) {
            return "错误：未知状态 '" + status + "'. 仅支持 'complete'.";
        }

        LoopTask task = scheduler.findActiveGoalAcrossSessions();
        if (task == null) {
            return "错误：未找到活跃目标";
        }

        GoalState gs = task.getGoalState();
        if (!gs.getStatus().isActive()) {
            return "警告：目标不在活跃状态（" + gs.getStatus() + "），无法标记为完成";
        }

        String sessionId = __sessionId;
        if (sessionId == null) {
            return "错误：无活跃会话";
        }

        gs.achieve();
        scheduler.clearGoal(sessionId, task.getId());

        long used = gs.getConsumedTokens();
        String tokenReport = gs.getMaxTokens() > 0
                ? used + "/" + gs.getMaxTokens() + " tokens 已消耗"
                : used > 0 ? used + " tokens 已消耗" : "token 统计不可用";
        return "已完成目标 '" + gs.getCondition() + "' 已标记为完成（" + tokenReport + "）";
    }
}
