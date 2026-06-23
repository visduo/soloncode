package org.noear.solon.codecli.command.builtin;

import org.noear.solon.ai.agent.react.ReActAgent;
import org.noear.solon.ai.harness.HarnessExtension;
import org.noear.solon.ai.harness.agent.AgentDefinition;

/**
 * Goal 工具扩展 — 注册 GoalTool 到主 Agent
 *
 * <p>使 AI 在 Goal 循环中可以调用 get_goal / update_goal / create_goal 工具（L3）。
 * 受 feature flag {@code goalsEnabled} 控制。</p>
 *
 * @author noear
 * @since 3.9.2
 */
public class GoalExtension implements HarnessExtension {
    private final GoalTool goalTool;
    private final boolean goalsEnabled;

    public GoalExtension(LoopScheduler loopScheduler) {
        this(loopScheduler, true);
    }

    public GoalExtension(LoopScheduler loopScheduler, boolean goalsEnabled) {
        this.goalTool = new GoalTool(loopScheduler);
        this.goalsEnabled = goalsEnabled;
    }

    public GoalTool getGoalTool() {
        return goalTool;
    }

    @Override
    public void configure(String agentName, ReActAgent.Builder agentBuilder) {
        if (goalsEnabled && AgentDefinition.AGENT_MAIN.equals(agentName)) {
            agentBuilder.defaultTalentAdd(goalTool);
        }
    }
}
