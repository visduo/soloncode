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

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * 预算压缩测试：验证 LoopPromptBuilder 根据预算剩余比率切换完整/精简/极简模式。
 *
 * <p>预算阈值：
 * <ul>
 *   <li>剩余 ≥ 30% → 完整 7 章节（含目标延续、证据驱动、忠于目标、审计完成、阻塞审计等）</li>
 *   <li>15% ≤ 剩余 &lt; 30% → 精简 3 章节</li>
 *   <li>剩余 &lt; 15% → 极简单段落</li>
 * </ul>
 *
 * @since 3.9.3
 */
class LoopPromptBuilderTest {

    private final LoopPromptBuilder builder = new LoopPromptBuilder(3);

    // ===== 辅助方法 =====

    /**
     * 创建指定预算消耗的 Goal 任务
     *
     * @param maxTokens       Token 预算上限
     * @param consumedTokens  已消耗 Token
     * @param iteration       迭代次数（影响上一轮摘要是否出现）
     */
    private LoopTask createGoalTask(long maxTokens, long consumedTokens, int iteration) {
        LoopTask task = new LoopTask("test goal objective here", 0, null, LoopTask.TaskType.GOAL, true);
        // maxTokens=0 时 GoalState 初始为 0；通过 setMaxTokens 同步
        task.setMaxTokens(maxTokens);
        GoalState gs = task.getGoalState();
        if (consumedTokens > 0) {
            gs.addTokens(consumedTokens);
        }
        for (int i = 0; i < iteration; i++) {
            task.incrementIteration();
        }
        return task;
    }

    /**
     * 计算当前 budgetRatio（用于辅助断言）
     */
    private double computeRemainingRatio(LoopTask task) {
        GoalState gs = task.getGoalState();
        if (gs.getMaxTokens() <= 0) return 1.0;
        return (double) (gs.getMaxTokens() - gs.getConsumedTokens()) / gs.getMaxTokens();
    }

    // ===== 完整模式（剩余 ≥ 30%） =====

    @Test
    void fullModeWhenBudgetAbove30Percent() {
        // 消耗 2000 / 10000 → 剩余 80% → 完整模式
        LoopTask task = createGoalTask(10000, 2000, 0);
        double ratio = computeRemainingRatio(task);
        assertTrue(ratio >= 0.30, "budget ratio should be >= 0.30 for full mode, got " + ratio);

        String result = builder.buildEffectivePrompt(task);

        // 7 章节标记
        assertTrue(result.contains("目标延续 (Goal Continuation)"), "should contain Goal Continuation chapter");
        assertTrue(result.contains("证据驱动 (Evidence-Based)"), "should contain Evidence-Based chapter");
        assertTrue(result.contains("忠于目标 (Goal Fidelity)"), "should contain Goal Fidelity chapter");
        assertTrue(result.contains("审计完成 (Audit Check)"), "should contain Audit Check chapter");
        assertTrue(result.contains("阻塞审计 (Blocked Audit)"), "should contain Blocked Audit chapter");

        // 目标条件
        assertTrue(result.contains("test goal objective here"), "should contain goal condition");

        // 预算信息
        assertTrue(result.contains("已消耗 2.0k / 10.0k"), "should contain budget info");
    }

    @Test
    void fullModeWhenBudgetExactlyAtThreshold() {
        // 消耗 7000 / 10000 → 剩余 0.30 → 完整模式（阈值边界，≥ 0.30 走 full）
        LoopTask task = createGoalTask(10000, 7000, 0);
        double ratio = computeRemainingRatio(task);
        assertTrue(ratio >= 0.30, "ratio at boundary should be full mode");

        String result = builder.buildEffectivePrompt(task);
        assertTrue(result.contains("目标延续 (Goal Continuation)"), "should be full mode at 0.30 boundary");
    }

    @Test
    void fullModeIncludesStagnationCheckWhenTriggered() {
        LoopPromptBuilder builderWithLowThreshold = new LoopPromptBuilder(2);
        LoopTask task = createGoalTask(10000, 2000, 3);
        // 模拟 3 次停滞
        task.recordStagnation();
        task.recordStagnation();
        task.recordStagnation();

        String result = builderWithLowThreshold.buildEffectivePrompt(task);
        assertTrue(result.contains("进展质疑 (Stagnation Check)"), "should include stagnation check");
        assertTrue(result.contains("3 轮执行未产生实质性进展"), "should mention stagnation count");
    }

    // ===== 精简模式（15% ≤ 剩余 < 30%） =====

    @Test
    void compactModeWhenBudgetBetween15And30Percent() {
        // 消耗 8000 / 10000 → 剩余 20% → 精简模式
        LoopTask task = createGoalTask(10000, 8000, 2);
        task.updateLastExecution("previous step result with some data");
        double ratio = computeRemainingRatio(task);
        assertTrue(ratio >= 0.15 && ratio < 0.30, "ratio should be in compact range, got " + ratio);

        String result = builder.buildEffectivePrompt(task);

        // 精简模式应包含目标延续和审计完成
        assertTrue(result.contains("目标延续 (Goal Continuation)"), "compact should have Goal Continuation");
        assertTrue(result.contains("审计完成 (Audit Check)"), "compact should have Audit Check");

        // 不应包含完整模式的章节
        assertFalse(result.contains("证据驱动 (Evidence-Based)"), "compact should NOT have Evidence-Based");
        assertFalse(result.contains("忠于目标 (Goal Fidelity)"), "compact should NOT have Goal Fidelity");
        assertFalse(result.contains("阻塞审计 (Blocked Audit)"), "compact should NOT have Blocked Audit");

        // 应包含上一轮摘要（源码格式："上一轮（第 2轮）"，2 后面无空格）
        assertTrue(result.contains("上一轮（第 2轮）"), "compact should include last round summary");
    }

    @Test
    void compactModeShowsBudgetInfo() {
        LoopTask task = createGoalTask(10000, 8000, 0);
        String result = builder.buildEffectivePrompt(task);
        assertTrue(result.contains("80%"), "should show consumed percentage");
    }

    // ===== 极简模式（剩余 < 15%） =====

    @Test
    void minimalModeWhenBudgetBelow15Percent() {
        // 消耗 9000 / 10000 → 剩余 10% → 极简模式
        LoopTask task = createGoalTask(10000, 9000, 0);
        double ratio = computeRemainingRatio(task);
        assertTrue(ratio < 0.15, "ratio should be in minimal range, got " + ratio);

        String result = builder.buildEffectivePrompt(task);

        // 极简模式：单行，不含章节标题
        assertTrue(result.contains("目标:"), "minimal should contain '目标:'");
        assertTrue(result.contains("test goal objective here"), "minimal should contain condition");

        // 不应包含章节标题
        assertFalse(result.contains("目标延续 (Goal Continuation)"), "minimal should NOT have chapters");
        assertFalse(result.contains("审计完成 (Audit Check)"), "minimal should NOT have Audit Check");
    }

    @Test
    void minimalModeAtExactThresholdBoundary() {
        // 消耗 8501 / 10000 → 剩余 14.99% → < 15% → 极简
        LoopTask task = createGoalTask(10000, 8501, 0);
        double ratio = computeRemainingRatio(task);
        assertTrue(ratio < 0.15, "ratio 0.1499 should trigger minimal, got " + ratio);

        String result = builder.buildEffectivePrompt(task);
        assertFalse(result.contains("审计完成"), "should be minimal at 0.1499 boundary");
    }

    @Test
    void minimalModeDoesNotShowPreviousSummary() {
        LoopTask task = createGoalTask(10000, 9000, 5);
        task.updateLastExecution("some previous work");
        String result = builder.buildEffectivePrompt(task);
        // 极简模式不应包含上一轮摘要
        assertFalse(result.contains("上一轮"), "minimal should not show previous round summary");
    }

    // ===== 非 Goal 模式 =====

    @Test
    void nonGoalTaskReturnsPromptAsIs() {
        LoopTask heartbeat = new LoopTask("check status", 5);
        String result = builder.buildEffectivePrompt(heartbeat);
        assertEquals("check status", result, "heartbeat should return prompt unchanged");
    }

    // ===== budgetRatio 工具方法 =====

    @Test
    void budgetRatioReturns1WhenMaxTokensIsZero() {
        GoalState gs = new GoalState("test", 0);
        gs.addTokens(99999);
        assertEquals(1.0, LoopPromptBuilder.budgetRatio(gs), 0.001,
                "maxTokens=0 means unlimited, ratio should be 1.0");
    }

    @Test
    void budgetRatioReturnsCorrectValue() {
        GoalState gs = new GoalState("test", 10000);
        gs.addTokens(2500);
        assertEquals(0.75, LoopPromptBuilder.budgetRatio(gs), 0.001);
    }
}
