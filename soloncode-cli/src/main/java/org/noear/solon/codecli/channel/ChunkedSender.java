/*
 * Copyright 2017-2026 noear.org and authors
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 * https://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */
package org.noear.solon.codecli.channel;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

/**
 * 分段发送引擎 — 提供大文本的分段、限速与重试能力。
 *
 * <p>三个 IM 通道（微信/飞书/钉钉）在发送大文本时统一使用此工具，
 * 消除重复的 while 循环分段代码，并加入段间间隔与指数退避重试。</p>
 *
 * <p>使用示例：</p>
 * <pre>{@code
 * ChunkedSender.sendChunked(longText,
 *     new ChunkedSender.Config(2000, 800, 3, 500),
 *     (chunk, partIndex) -> SomeClient.send(chunk));
 * }</pre>
 *
 * @author noear 2026/6/25 created
 */
public class ChunkedSender {
    private static final Logger log = LoggerFactory.getLogger(ChunkedSender.class);

    /**
     * 分段发送配置
     */
    public static class Config {
        private final int maxLen;
        private final long intervalMs;
        private final int maxRetries;
        private final long retryBaseMs;

        public Config(int maxLen, long intervalMs, int maxRetries, long retryBaseMs) {
            if (maxLen <= 0) throw new IllegalArgumentException("maxLen must > 0");
            if (intervalMs < 0) throw new IllegalArgumentException("intervalMs must >= 0");
            if (maxRetries < 0) throw new IllegalArgumentException("maxRetries must >= 0");
            if (retryBaseMs < 0) throw new IllegalArgumentException("retryBaseMs must >= 0");
            this.maxLen = maxLen;
            this.intervalMs = intervalMs;
            this.maxRetries = maxRetries;
            this.retryBaseMs = retryBaseMs;
        }

        public int getMaxLen() { return maxLen; }
        public long getIntervalMs() { return intervalMs; }
        public int getMaxRetries() { return maxRetries; }
        public long getRetryBaseMs() { return retryBaseMs; }

        // 常用预设
        public static Config wechat()   { return new Config(2000, 800, 3, 500); }
        public static Config feishu()   { return new Config(4000, 300, 2, 500); }
        public static Config dingtalk() { return new Config(5000, 300, 2, 500); }
    }

    @FunctionalInterface
    public interface SendFunc {
        /**
         * @param chunk     当前段文本
         * @param partIndex 段序号（从 1 开始）
         * @return true 发送成功，false 发送失败（将触发重试）
         */
        boolean send(String chunk, int partIndex);
    }

    /**
     * 发送结果
     */
    public static class SendResult {
        private final int totalParts;
        private final int failedParts;

        public SendResult(int totalParts, int failedParts) {
            this.totalParts = totalParts;
            this.failedParts = failedParts;
        }

        public int getTotalParts() { return totalParts; }
        public int getFailedParts() { return failedParts; }
        public boolean allSucceeded() { return failedParts == 0; }
    }

    /**
     * 执行分段发送
     *
     * <p>如果全文不超过 maxLen，直接发送并返回。超过则分段：
     * <ol>
     *   <li>每段 maxLen 字符，从第 2 段起标注 "(2)" "(3)" 前缀</li>
     *   <li>每段发送前先等待 intervalMs（第一段不等待）</li>
     *   <li>发送失败时按指数退避重试最多 maxRetries 次</li>
     * </ol>
     *
     * @param text  待发送的文本
     * @param cfg   发送配置
     * @param func  实际发送回调
     * @return 发送结果
     */
    public static SendResult sendChunked(String text, Config cfg, SendFunc func) {
        if (text == null || text.isEmpty()) {
            return new SendResult(0, 0);
        }

        if (text.length() <= cfg.getMaxLen()) {
            boolean ok = retrySend(text, 1, cfg, func);
            return new SendResult(1, ok ? 0 : 1);
        }

        int totalParts = 0;
        int failedParts = 0;
        int pos = 0;
        int part = 1;

        while (pos < text.length()) {
            int end = Math.min(pos + cfg.getMaxLen(), text.length());
            String chunk = text.substring(pos, end);

            // 从第 2 段起加序号前缀
            if (part > 1) {
                chunk = "(" + part + ") " + chunk;
            }

            // 段间间隔（第一段不等待）
            if (part > 1 && cfg.getIntervalMs() > 0) {
                try {
                    Thread.sleep(cfg.getIntervalMs());
                } catch (InterruptedException e) {
                    Thread.currentThread().interrupt();
                    log.warn("[ChunkedSender] Interrupted during interval sleep");
                    break;
                }
            }

            boolean ok = retrySend(chunk, part, cfg, func);
            totalParts++;
            if (!ok) {
                failedParts++;
            }

            pos = end;
            part++;
        }

        if (failedParts > 0) {
            log.warn("[ChunkedSender] {} of {} part(s) failed to send", failedParts, totalParts);
        }
        return new SendResult(totalParts, failedParts);
    }

    /**
     * 带指数退避重试的发送
     */
    private static boolean retrySend(String chunk, int partIndex, Config cfg, SendFunc func) {
        for (int attempt = 0; attempt <= cfg.getMaxRetries(); attempt++) {
            try {
                if (func.send(chunk, partIndex)) {
                    if (attempt > 0) {
                        log.info("[ChunkedSender] Part {} succeeded after {} retries", partIndex, attempt);
                    }
                    return true;
                }
            } catch (Exception e) {
                log.warn("[ChunkedSender] Part {} attempt {} exception: {}", partIndex, attempt + 1, e.getMessage());
            }

            // 最后一次失败不等待
            if (attempt < cfg.getMaxRetries()) {
                long delay = cfg.getRetryBaseMs() * (1L << attempt); // 指数退避: 500, 1000, 2000, ...
                if (delay > 0) {
                    try {
                        Thread.sleep(delay);
                    } catch (InterruptedException e) {
                        Thread.currentThread().interrupt();
                        return false;
                    }
                }
            }
        }

        log.error("[ChunkedSender] Part {} failed after {} retries", partIndex, cfg.getMaxRetries());
        return false;
    }
}
