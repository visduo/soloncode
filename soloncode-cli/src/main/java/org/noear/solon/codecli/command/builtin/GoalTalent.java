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
import org.noear.solon.ai.chat.ChatSession;
import org.noear.solon.ai.chat.prompt.Prompt;
import org.noear.solon.ai.chat.talent.AbsTalent;
import org.noear.solon.annotation.Param;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * Goal 工具 — 模型侧 Goal 生命周期控制（Codex CLI 对齐）
 *
 * <p>提供两个工具（Goal 的创建由 /loop goal: 命令驱动，模型侧只读+更新）：
 * <ul>
 *   <li>{@code get_goal} — 查询当前 goal 状态</li>
 *   <li>{@code update_goal} — 标记 complete 或 blocked（模型驱动，对齐 Codex）</li>
 * </ul>
 *
 * <p>动态控制：{@link #isSupported(Prompt)} 仅在存在活跃 goal 时返回 true，
 * 无 goal 时工具不暴露，避免工具列表噪音。
 *
 * @author noear
 * @since 3.9.3
 */
public class GoalTalent extends AbsTalent {

    private static final Logger log = LoggerFactory.getLogger(GoalTalent.class);

    private final LoopScheduler scheduler;

    public GoalTalent(LoopScheduler scheduler) {
        this.scheduler = scheduler;
    }

    @Override
    public boolean isSupported(Prompt prompt) {
        String __sessionId = prompt.attrAs(ChatSession.ATTR_SESSIONID);

        if (__sessionId != null) {
            LoopTask existing = scheduler.findActiveGoalInSession(__sessionId);
            return existing != null;
        }

        return false;
    }

    /**
     * 获取当前 goal 状态
     */
    @ToolMapping(name = "goal_get",
            description = "获取当前活跃目标的状态，若无活跃目标则返回 null。")
    public String goal_get(String __sessionId,
                          String __cwd) {
        LoopTask task = scheduler.findActiveGoalInSession(__sessionId);

        // isSupported 保证有活跃 goal 时才暴露此工具，task 不会为 null
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
     * 更新 goal 状态
     *
     * <p>complete: 通过 ValidatorFactory 执行客观校验后标记完成。
     * blocked: 模型主动声明阻塞（同一困境尝试了 3 次后），暂停调度等待 resume。
     */
    @ToolMapping(name = "goal_update",
            description = "更新当前活跃目标的状态。" +
                    "status='complete' 标记目标已完成；" +
                    "status='blocked' 声明遇到阻塞（同一困境尝试了3次后使用）。")
    public String goal_update(
            @Param(name = "status", description = "状态值：complete 或 blocked") String status,
            String __sessionId,
            String __cwd) {

        if (status == null) {
            return errJson("INVALID_PARAMETER", "status 参数必填（complete 或 blocked）");
        }

        if (__sessionId == null) {
            return errJson("NO_SESSION", "无活跃会话");
        }

        LoopTask task = scheduler.findActiveGoalInSession(__sessionId);
        if (task == null) {
            return errJson("NO_GOAL", "未找到活跃目标");
        }

        GoalState gs = task.getGoalState();
        if (!gs.getStatus().isActive()) {
            return errJson("GOAL_NOT_ACTIVE",
                    "目标不在活跃状态（" + gs.getStatus() + "），无法更新");
        }

        ONode root = new ONode(Options.of(Feature.Write_PrettyFormat));
        root.set("taskId", task.getId());
        root.set("objective", gs.getCondition());
        root.set("consumedTokens", gs.getConsumedTokens());
        if (gs.getMaxTokens() > 0) {
            root.set("maxTokens", gs.getMaxTokens());
        }

        // ---- complete ----
        if ("complete".equals(status)) {
            LoopConfig config = new LoopConfig();
            if (config.isValidatorEnabled()) {
                GoalValidator validator = ValidatorFactory.forCondition(gs.getCondition());
                GoalValidator.ValidationResult vr = validator.validate(gs.getCondition(), __sessionId);
                if (!vr.isPassed()) {
                    log.warn("updateGoal: 验证失败 for goal '{}': {}", task.getId(), vr.detail());
                    return errJson("VALIDATION_FAILED",
                            "目标尚未完成：验证失败 - " + vr.detail()
                                    + "。请继续改进后重新调用 update_goal(complete)。");
                }
            }

            gs.achieve();
            scheduler.clearGoal(__sessionId, task.getId());

            root.set("status", "achieved");
            return root.toJson();
        }

        // ---- blocked ----
        if ("blocked".equals(status)) {
            gs.markBlocked();
            scheduler.pauseGoal(__sessionId, task.getId());
            log.info("updateGoal: goal '{}' marked as BLOCKED by model", task.getId());

            root.set("status", "blocked");
            return root.toJson();
        }

        return errJson("INVALID_PARAMETER",
                "未知状态 '" + status + "'. 仅支持 'complete' 或 'blocked'.");
    }

    // ===== 辅助方法 =====

    /**
     * 统一错误 JSON 格式
     */
    private static String errJson(String code, String message) {
        ONode root = new ONode();
        root.set("error", true);
        root.set("code", code);
        root.set("message", message);
        return root.toJson();
    }
}