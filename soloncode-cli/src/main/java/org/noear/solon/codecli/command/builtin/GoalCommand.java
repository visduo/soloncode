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

import org.noear.solon.ai.harness.command.Command;
import org.noear.solon.ai.harness.command.CommandContext;
import java.util.List;
import java.util.stream.Collectors;

/**
 * /goal 命令 — Goal 生命周期管理（纯文本，100% Codex 对齐）
 *
 * <pre>
 *   /goal               → 查看所有活跃 goal
 *   /goal status &lt;id&gt;  → 查看指定 goal 详情
 *   /goal pause         → 暂停当前活跃 goal
 *   /goal resume        → 恢复暂停的 goal
 *   /goal clear [id]    → 清除 goal
 *   /goal &lt;condition&gt;   → 在最近活跃的非 goal 任务上设置 goal
 * </pre>
 */
public class GoalCommand implements Command {

    private final LoopScheduler scheduler;
    private final GoalTool goalTool;

    public GoalCommand(LoopScheduler scheduler, GoalTool goalTool) {
        this.scheduler = scheduler;
        this.goalTool = goalTool;
    }

    @Override
    public String name() { return "goal"; }

    @Override
    public String description() {
        return "Goal lifecycle management (status, pause, resume, clear, <condition>)";
    }

    @Override
    public boolean execute(CommandContext ctx) throws Exception {
        String sessionId = ctx.getSession().getSessionId();

        // 同步 sessionId 到 GoalTool（使 create_goal / update_goal 等工具能准确定位会话）
        if (goalTool != null) {
            goalTool.setCurrentSessionId(sessionId);
        }

        String sub = ctx.argAt(0);

        if (sub == null || sub.isEmpty()) {
            handleStatus(ctx, sessionId, null);
        } else if ("status".equals(sub)) {
            handleStatus(ctx, sessionId, ctx.argAt(1));
        } else if ("pause".equals(sub)) {
            handlePause(ctx, sessionId);
        } else if ("resume".equals(sub)) {
            handleResume(ctx, sessionId);
        } else if ("clear".equals(sub)) {
            handleClear(ctx, sessionId, ctx.argAt(1));
        } else {
            // /goal <condition> — 拼接所有剩余参数作为 condition
            String condition = sub;
            for (int i = 1; ; i++) {
                String arg = ctx.argAt(i);
                if (arg == null) break;
                condition += " " + arg;
            }
            handleSetGoal(ctx, sessionId, condition);
        }
        return true;
    }

    // ===== 命令处理 =====

    private void handleStatus(CommandContext ctx, String sessionId, String taskId) {
        List<LoopTask> tasks = scheduler.listActive(sessionId);
        if (tasks.isEmpty()) {
            ctx.println("No active loop tasks.");
            return;
        }

        if (taskId != null && !taskId.isEmpty()) {
            LoopTask target = scheduler.getTaskById(sessionId, taskId);
            if (target == null) {
                ctx.println("Task not found: " + taskId);
                return;
            }
            printGoal(ctx, target);
            return;
        }

        List<LoopTask> goalTasks = tasks.stream()
                .filter(LoopTask::isGoalMode)
                .collect(Collectors.toList());

        if (goalTasks.isEmpty()) {
            ctx.println("No active goals.");
            ctx.println("  Use /loop goal:\"<objective>\" <prompt> to create a goal task.");
            ctx.println("  Or /goal <objective> to set goal on active task.");
            return;
        }

        ctx.println("Active Goals:");
        for (LoopTask t : goalTasks) {
            printGoal(ctx, t);
        }
    }

    private void printGoal(CommandContext ctx, LoopTask task) {
        GoalState gs = task.getGoalState();
        StringBuilder sb = new StringBuilder();
        sb.append("  ").append(task.getId()).append(" ");
        sb.append(gs.getStatus().name().toLowerCase());
        sb.append(" iter:").append(task.getCurrentIteration());

        if (gs.getStartEpochMs() > 0) {
            long sec = (System.currentTimeMillis() - gs.getStartEpochMs()) / 1000;
            sb.append(" (").append(sec).append("s)");
        }

        sb.append("\n    ").append("Objective: ").append(gs.getCondition());

        ctx.println(sb.toString());
    }

    private void handleSetGoal(CommandContext ctx, String sessionId, String condition) {
        // 去除引号
        if ((condition.startsWith("\"") && condition.endsWith("\"")) ||
                (condition.startsWith("'") && condition.endsWith("'"))) {
            condition = condition.substring(1, condition.length() - 1);
        }

        if (condition == null || condition.isEmpty()) {
            ctx.println("Usage: /goal <objective>");
            return;
        }

        LoopTask task = new LoopTask(condition, 0, null, condition, false, 0, true);
        scheduler.schedule(sessionId, task);

        ctx.println("Goal created (" + task.getId() + "):");
        ctx.println("  " + condition);
    }

    private void handlePause(CommandContext ctx, String sessionId) {
        LoopTask active = findActiveGoal(sessionId);
        if (active == null) {
            ctx.println("No active goal to pause.");
            return;
        }

        GoalState gs = active.getGoalState();
        if (gs.getStatus() != GoalState.Status.PURSUING) {
            ctx.println("Goal is not in a pausable state: " + gs.getStatus());
            return;
        }

        scheduler.pauseGoal(sessionId, active.getId());
        ctx.println("Goal paused.  Use /goal resume to resume.");
    }

    private void handleResume(CommandContext ctx, String sessionId) {
        LoopTask task = findActiveGoal(sessionId);
        if (task == null || task.getGoalState().getStatus() != GoalState.Status.PAUSED) {
            ctx.println("No paused goal found.");
            return;
        }

        task.setSuppressed(false);
        scheduler.resumeGoal(sessionId, task.getId());
        ctx.println("Goal resumed.");
    }

    private void handleClear(CommandContext ctx, String sessionId, String taskId) {
        LoopTask target;

        if (taskId != null && !taskId.isEmpty()) {
            target = scheduler.getTaskById(sessionId, taskId);
            if (target == null) {
                ctx.println("Task not found: " + taskId);
                return;
            }
        } else {
            target = findActiveGoal(sessionId);
            if (target == null) {
                ctx.println("No active goal to clear.");
                return;
            }
        }

        if (!target.isGoalMode()) {
            ctx.println("Task '" + target.getId() + "' has no goal.");
            return;
        }

        scheduler.clearGoal(sessionId, target.getId());
        ctx.println("Goal cleared for task " + target.getId() + ". Task is preserved.");
    }

    private LoopTask findActiveGoal(String sessionId) {
        List<LoopTask> tasks = scheduler.listActive(sessionId);
        for (LoopTask t : tasks) {
            if (t.isGoalMode()) {
                GoalState.Status status = t.getGoalState().getStatus();
                if (status == GoalState.Status.PURSUING || status == GoalState.Status.PAUSED) {
                    return t;
                }
            }
        }
        return null;
    }
}
