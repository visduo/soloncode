package org.noear.solon.codecli.config.entity;

import org.noear.solon.ai.talents.lsp.LspServerParameters;
import org.noear.solon.codecli.config.AgentFlags;

/**
 * LSP 服务器配置实体
 *
 * @author noear
 */
public class LspServerDo extends LspServerParameters {
    //作用域（全局或本地）
    private String scope = AgentFlags.SCOPE_GLOBAL;

    //是否系统级（不可删除）
    private boolean primary;

    public void setScope(String scope) {
        this.scope = scope;
    }

    public String getScope() {
        return scope;
    }

    public boolean isPrimary() {
        return primary;
    }

    public void setPrimary(boolean primary) {
        this.primary = primary;
    }
}
