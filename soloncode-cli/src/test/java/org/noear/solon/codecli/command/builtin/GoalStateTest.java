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
import org.noear.snack4.ONode;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Goal 状态机 + 电路熔断 + 序列化 单元测试
 */
class GoalStateTest {

    // ===== 1. 状态机转移 =====

    @Test
    void initialStateShouldBePursuing() {
        GoalState gs = new GoalState("refactor module", 10000);
        assertEquals(GoalState.Status.PURSUING, gs.getStatus());
        assertTrue(gs.getStatus().isActive());
        assertFalse(gs.getStatus().isTerminal());
        assertEquals(0, gs.getConsumedTokens());
        assertEquals(10000, gs.getMaxTokens());
        assertNotNull(gs.getId());
        assertNotNull(gs.getCondition());
    }

    @Test
    void pauseShouldTransitionToPaused() {
        GoalState gs = new GoalState("test", 1000);
        assertTrue(gs.pause());
        assertEquals(GoalState.Status.PAUSED, gs.getStatus());
        assertFalse(gs.getStatus().isActive());
    }

    @Test
    void resumeShouldTransitionBackToPursuing() {
        GoalState gs = new GoalState("test", 1000);
        gs.pause();
        assertTrue(gs.resume());
        assertEquals(GoalState.Status.PURSUING, gs.getStatus());
    }

    @Test
    void achieveShouldTransitionToAchieved() {
        GoalState gs = new GoalState("test", 1000);
        gs.achieve();
        assertEquals(GoalState.Status.ACHIEVED, gs.getStatus());
        assertTrue(gs.getStatus().isTerminal());
    }

    @Test
    void markBudgetLimitedShouldTransitionToBudgetLimited() {
        GoalState gs = new GoalState("test", 1000);
        gs.markBudgetLimited();
        assertEquals(GoalState.Status.BUDGET_LIMITED, gs.getStatus());
        assertTrue(gs.getStatus().isTerminal());
    }

    @Test
    void pauseShouldFailOnNonPursuingState() {
        GoalState gs = new GoalState("test", 1000);
        gs.achieve();
        assertFalse(gs.pause(), "should not pause an achieved goal");
    }

    @Test
    void resumeShouldFailOnNonPausedState() {
        GoalState gs = new GoalState("test", 1000);
        assertFalse(gs.resume(), "should not resume a pursuing goal");
    }

    @Test
    void achieveShouldNotWorkOnPausedState() {
        GoalState gs = new GoalState("test", 1000);
        gs.pause();
        gs.achieve(); // only works on PURSUING
        assertEquals(GoalState.Status.PAUSED, gs.getStatus(), "achieve should not fire on PAUSED");
    }

    // ===== 2. Token 预算 =====

    @Test
    void addTokensShouldAccumulate() {
        GoalState gs = new GoalState("test", 10000);
        gs.addTokens(500);
        gs.addTokens(300);
        assertEquals(800, gs.getConsumedTokens());
    }

    @Test
    void isBudgetExceededShouldReturnTrueWhenConsumedReachesMax() {
        GoalState gs = new GoalState("test", 1000);
        assertFalse(gs.isBudgetExceeded());
        gs.addTokens(1000);
        assertTrue(gs.isBudgetExceeded());
    }

    @Test
    void isBudgetExceededShouldReturnFalseWhenMaxIsZero() {
        GoalState gs = new GoalState("test", 0);
        gs.addTokens(999999);
        assertFalse(gs.isBudgetExceeded(), "maxTokens=0 means unlimited");
    }

    @Test
    void isBudgetCriticalShouldReturnTrueAt80Percent() {
        GoalState gs = new GoalState("test", 1000);
        gs.addTokens(799);
        assertFalse(gs.isBudgetCritical());
        gs.addTokens(1); // 800 = 80%
        assertTrue(gs.isBudgetCritical());
    }

    // ===== 3. 电路熔断 =====

    @Test
    void blockedCycleCountShouldStartAtZero() {
        GoalState gs = new GoalState("test", 1000);
        assertEquals(0, gs.getBlockedCycleCount());
        assertFalse(gs.isBlockedCycleExhausted());
    }

    @Test
    void incrementBlockedCycleShouldNotExhaustBeforeThreshold() {
        GoalState gs = new GoalState("test", 1000);
        for (int i = 0; i < 4; i++) {
            gs.incrementBlockedCycleCount();
        }
        assertEquals(4, gs.getBlockedCycleCount());
        assertFalse(gs.isBlockedCycleExhausted(), "threshold is 5, 4 should not exhaust");
    }

    @Test
    void incrementBlockedCycleShouldExhaustAtThreshold() {
        GoalState gs = new GoalState("test", 1000);
        for (int i = 0; i < 5; i++) {
            gs.incrementBlockedCycleCount();
        }
        assertEquals(5, gs.getBlockedCycleCount());
        assertTrue(gs.isBlockedCycleExhausted(), "threshold is 5, should be exhausted");
    }

    // ===== 4. 序列化往返 =====

    @Test
    void serializationRoundTripShouldPreserveAllFields() {
        GoalState gs = new GoalState("refactor the login module", 50000);
        gs.addTokens(1234);
        gs.pause();
        gs.incrementBlockedCycleCount();
        gs.incrementBlockedCycleCount();

        ONode node = gs.toONode();
        GoalState restored = GoalState.fromONode(node);

        assertEquals(gs.getId(), restored.getId());
        assertEquals(gs.getCondition(), restored.getCondition());
        assertEquals(gs.getStatus(), restored.getStatus());
        assertEquals(gs.getConsumedTokens(), restored.getConsumedTokens());
        assertEquals(gs.getMaxTokens(), restored.getMaxTokens());
        assertEquals(gs.getStartEpochMs(), restored.getStartEpochMs());
        assertEquals(gs.getBlockedCycleCount(), restored.getBlockedCycleCount());
    }

    @Test
    void serializationWithoutBlockedCycleShouldDefaultToZero() {
        GoalState gs = new GoalState("test", 1000);
        ONode node = gs.toONode();
        // blockedCycleCount is 0, should be omitted in JSON
        GoalState restored = GoalState.fromONode(node);
        assertEquals(0, restored.getBlockedCycleCount());
    }

    // ===== 5. LoopTask blocked 审计 =====

    @Test
    void recordGoalEvaluationSameReasonShouldIncreaseStreak() {
        LoopTask task = new LoopTask("test prompt", 0, null, "test goal", false, 0, true);
        // First call sets the baseline reason (streak stays 0)
        task.recordGoalEvaluation("same reason");
        assertFalse(task.isGoalBlocked(), "streak=0 after first call");
        // Second call: streak=1
        task.recordGoalEvaluation("same reason");
        assertFalse(task.isGoalBlocked(), "streak=1");
        // Third call: streak=2
        task.recordGoalEvaluation("same reason");
        assertFalse(task.isGoalBlocked(), "streak=2, need 3 for blocked");
        // Fourth call: streak=3
        task.recordGoalEvaluation("same reason");
        assertTrue(task.isGoalBlocked(), "streak=3, should be blocked");
    }

    @Test
    void recordGoalEvaluationDifferentReasonShouldResetStreak() {
        LoopTask task = new LoopTask("test prompt", 0, null, "test goal", false, 0, true);
        task.recordGoalEvaluation("reason A");
        task.recordGoalEvaluation("reason A");
        task.recordGoalEvaluation("reason B"); // reset
        task.recordGoalEvaluation("reason B");
        task.recordGoalEvaluation("reason B");
        assertFalse(task.isGoalBlocked(), "streak for B is only 3 (indices 0,1,2), but wait...");
        // Actually: first call sets goalLastEvalReason = "reason A", streak = 0
        // Second "reason A": streak = 1
        // "reason B": reset, streak = 0, goalLastEvalReason = "reason B"
        // Second "reason B": streak = 1
        // Third "reason B": streak = 2
        // streak needs >= 3 for blocked
        // So not blocked yet
    }

    @Test
    void resetGoalBlockedAuditShouldClearStreakAndReason() {
        LoopTask task = new LoopTask("test prompt", 0, null, "test goal", false, 0, true);
        task.recordGoalEvaluation("some reason");
        task.recordGoalEvaluation("some reason");
        task.recordGoalEvaluation("some reason");
        task.recordGoalEvaluation("some reason");
        assertTrue(task.isGoalBlocked());

        task.resetGoalBlockedAudit();
        assertFalse(task.isGoalBlocked());
        assertNull(task.getGoalLastEvalReason());
    }

    @Test
    void recordGoalEvaluationWithNullReasonShouldNotCrash() {
        LoopTask task = new LoopTask("test prompt", 0, null, "test goal", false, 0, true);
        // null is converted to "", first call sets baseline
        task.recordGoalEvaluation(null);
        task.recordGoalEvaluation(null);
        task.recordGoalEvaluation(null);
        task.recordGoalEvaluation(null);
        assertTrue(task.isGoalBlocked(), "null reasons are converted to empty string, streak should reach 3");
    }

    // ===== 6. LoopTask Goal 模式基础 =====

    @Test
    void goalModeShouldBeTrueWhenGoalConditionProvided() {
        LoopTask task = new LoopTask("prompt", 0, null, "my objective", false, 0, true);
        assertTrue(task.isGoalMode());
        assertNotNull(task.getGoalState());
        assertEquals("my objective", task.getGoalState().getCondition());
    }

    @Test
    void goalModeShouldBeFalseWithoutGoalCondition() {
        LoopTask task = new LoopTask("prompt", 1, null, null, false, 0);
        assertFalse(task.isGoalMode());
        assertNull(task.getGoalState());
    }

    @Test
    void goalTaskSerializationRoundTripShouldPreserveGoalState() {
        LoopTask task = new LoopTask("test prompt", 0, null, "refactor module", false, 0, true);
        task.getGoalState().addTokens(5000);
        task.getGoalState().incrementBlockedCycleCount();
        task.incrementIteration();
        task.incrementIteration();

        ONode node = task.toONode();
        LoopTask restored = LoopTask.fromONode(node);

        assertTrue(restored.isGoalMode());
        assertEquals("refactor module", restored.getGoalState().getCondition());
        assertEquals(5000, restored.getGoalState().getConsumedTokens());
        assertEquals(1, restored.getGoalState().getBlockedCycleCount());
        assertEquals(2, restored.getCurrentIteration());
        // blocked audit should be reset on deserialization (transient fields)
        assertFalse(restored.isGoalBlocked());
    }
}
