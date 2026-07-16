# AI Agent / Talent / Harness — Solon AI 智能体

> 适用场景：Agent（Simple/ReAct/Team）、Talent 才能、Harness 马具、AI UI、ACP、A2A、Loop。
>
> 目标版本：4.0.3。ChatModel / RAG / MCP / 方言见 `ai_chat_rag_mcp.md`。

## Agent — 智能体

Dependency: `solon-ai-agent`

v3.8.1 后支持。框架内置三种模式的智能体：

| 智能体 | 模式描述 |
|---|---|
| `SimpleAgent` | 简单模式，适用于简单的指令响应 |
| `ReActAgent` | 自省模式，“思考-行动-观察”循环的自反思智能体，支持工具调用 |
| `TeamAgent` | 协作模式，指挥成员按协议（如 A2A、Swarm、Sequential、Hierarchical）进行协作 |

### SimpleAgent Hello World

```java
ChatModel chatModel = ChatModel.of("https://api.moark.com/v1/chat/completions")
        .apiKey("***")
        .model("Qwen3-32B")
        .build();

SimpleAgent robot = SimpleAgent.of(chatModel)
        .defaultToolAdd(new TimeTool()) // v4：POJO 需用 MethodToolProvider 包装
        .build();

String answer = robot.prompt("现在几点了？")
        .call()
        .getContent();

public static class TimeTool extends AbsToolProvider {
    @ToolMapping(description = "获取当前系统时间")
    public String getTime() {
        return LocalDateTime.now().toString();
    }
}
```

### ReActAgent（自主推理 + 工具调用）

```java
ReActAgent agent = ReActAgent.of(chatModel)
    .name("assistant")
    .defaultToolAdd(new MethodToolProvider(new SearchTools())) // v4：POJO 需用 MethodToolProvider 包装
    .maxTurns(5)        // v4：原 maxSteps 已更名为 maxTurns
    .autoRethink(true)  // 最大步数自动续航（由 LLM 反思控制）
    .build();
String answer = agent.prompt("搜索并总结...").call().getContent();
```

### TeamAgent（多 Agent 协作）

```java
TeamAgent team = TeamAgent.of(chatModel)
    .name("DevTeam")
    .protocol(TeamProtocols.SEQUENTIAL) // 支持 SEQUENTIAL, A2A, SWARM, HIERARCHICAL, NONE
    .agentAdd(coder, reviewer)
    .build();
String result = team.prompt("写一个单例模式").call().getContent();
```

### Agent 接口核心属性

| 维度 | 属性 | 描述 |
|---|---|---|
| 身份 | `name` | 唯一标识：智能体在团队中的名字 |
| 角色 | `role` | 智能体角色职责（用于 Prompt 提示与协作分发参考） |
| 画像 | `profile` | 交互契约：定义能力画像、输入限制等约束条件 |
| 执行 | `call` | 核心逻辑：具体的推理与工具执行过程 |

## AI UI — 对接 Vercel AI SDK

Dependency: `solon-ai-ui-aisdk`

将 `ChatModel.prompt().stream()` 的 `Flux<ChatResponse>` 自动转换为 [UI Message Stream Protocol v1](https://ai-sdk.dev/docs/ai-sdk-ui/stream-protocol) 格式的 SSE 事件流，前端可直接使用 `@ai-sdk/vue` 或 `@ai-sdk/react` 的 `useChat`。

支持：文本流、深度思考(reasoning)、工具调用(tool-calls)、搜索结果引用(source-url)、文档引用(source-document)、文件(file)、自定义数据(data-*)、元数据(metadata)。

### 后端示例

```java
@Controller
public class AiChatController {
    @Inject ChatModel chatModel;
    private final AiSdkStreamWrapper wrapper = AiSdkStreamWrapper.of();

    @Produces(MimeType.TEXT_EVENT_STREAM_UTF8_VALUE)
    @Mapping("/ai/chat/stream")
    public Flux<SseEvent> stream(String prompt, Context ctx) {
        ctx.headerSet("x-vercel-ai-ui-message-stream", "v1");
        return wrapper.toAiSdkStream(chatModel.prompt(prompt).stream());
    }
}
```

### 带会话记忆 + 元数据

```java
@Controller
public class AiChatController {
    @Inject ChatModel chatModel;
    private final AiSdkStreamWrapper wrapper = AiSdkStreamWrapper.of();
    private final Map<String, ChatSession> sessionMap = new ConcurrentHashMap<>();

    @Produces(MimeType.TEXT_EVENT_STREAM_UTF8_VALUE)
    @Mapping("/ai/chat/stream")
    public Flux<SseEvent> stream(@Header("sessionId") String sessionId,
                                 String prompt, Context ctx) {
        ctx.headerSet("x-vercel-ai-ui-message-stream", "v1");
        ChatSession session = sessionMap.computeIfAbsent(sessionId,
                k -> InMemoryChatSession.builder().sessionId(k).build());
        Map<String, Object> metadata = Map.of("sessionId", sessionId);
        return wrapper.toAiSdkStream(
                chatModel.prompt(prompt).session(session).stream(), metadata);
    }
}
```

### 前端对接（Vue 3 + @ai-sdk/vue）

```vue
<script setup lang="ts">
import { useChat } from '@ai-sdk/vue'
const { messages, input, handleSubmit, status } = useChat({
  api: '/ai/chat/stream'
})
</script>
```

### 核心 Part 类

| Part 类 | type 值 | 说明 |
|---|---|---|
| `StartPart` | `start` | 流开始（含 messageId） |
| `TextStartPart` / `TextDeltaPart` / `TextEndPart` | `text-start` / `text-delta` / `text-end` | 正文流 |
| `ReasoningStartPart` / `ReasoningDeltaPart` / `ReasoningEndPart` | `reasoning-*` | 深度思考流 |
| `ToolInputStartPart` / `ToolInputDeltaPart` / `ToolInputAvailablePart` / `ToolOutputAvailablePart` | `tool-*` | 工具调用流 |
| `SourceUrlPart` / `SourceDocumentPart` | `source-url` / `source-document` | 引用来源 |
| `FilePart` | `file` | 文件附件 |
| `DataPart` | `data-*` | 自定义数据 |
| `FinishPart` | `finish` | 流结束（含 usage） |
| `ErrorPart` | `error` | 错误 |

### 自定义 Data Part

```java
DataPart weatherPart = DataPart.of("weather", Map.of("location", "SF", "temperature", 100));
// → {"type":"data-weather","data":{"location":"SF","temperature":100}}
```

## ACP — Agent Client Protocol

Dependency: `solon-ai-acp`

提供 ACP 协议支持（stdio、websocket），支持完整的 ACP 能力开发。

```xml
<dependency>
    <groupId>org.noear</groupId>
    <artifactId>solon-ai-acp</artifactId>
</dependency>
```

## A2A — Agent to Agent

Dependency: `solon-ai-a2a`

提供智能体间通信协议支持。

```xml
<dependency>
    <groupId>org.noear</groupId>
    <artifactId>solon-ai-a2a</artifactId>
</dependency>
```

## AI Talents — 才能体系

Dependency: 各 `solon-ai-talent-*` 插件

v4.0.0 起，原 "Skill 技能" 体系正式更名为 "Talent 才能" 体系（概念原型参考 Claude Code Agent Skills，但从"运行时学习"翻转为"开发时注入"）。Talent 是一种可插拔的能力扩展机制，可动态加载到 ChatModel 或 Agent 中使用。

> 命名迁移提示（v3 → v4）：插件 `solon-ai-skill-*` → `solon-ai-talent-*`；添加方法 `defaultSkillAdd(...)` → `defaultTalentAdd(...)`。

### Talent 接口（开发时注入）

Talent 通过生命周期钩子，在开发时定义激活条件、指令策略与工具集。常用做法是继承 `AbsTalent`：

```java
@Component
public class WeatherTalent extends AbsTalent {
    // 准入检查：当前对话上下文中该才能是否被激活
    @Override
    public boolean isSupported(Prompt prompt) {
        String role = prompt.attrAs("role"); // 可取属性做准入控制
        return prompt.getUserContent().contains("天气");
    }

    // 动态指令注入：生成并注入到 System Message 的描述性文本
    @Override
    public String getInstruction(Prompt prompt) {
        return "如果有什么天气问题，可以问我";
    }

    // 动态能力注入：通过 @ToolMapping 暴露工具方法
    @ToolMapping(description = "查询天气预报")
    public String getWeather(@Param(description = "城市位置") String location) {
        return "晴，14度";
    }
}
```

Talent 接口核心方法：`name()`、`description()`、`metadata()`、`isSupported(Prompt)`、`onAttach(Prompt)`、`getInstruction(Prompt)`、`getTools(Prompt)`。

### Talent 注册（添加方式与 tool 一致）

```java
@Bean
public ChatModel chatModel(WeatherTalent weatherTalent) {
    return ChatModel.of(config)
            .defaultTalentAdd(weatherTalent) // v4：原 defaultSkillAdd
            .build();
}
```

### 预置才能（部分常用包）

Solon AI 预置了一批 Talent 模块，按职责归入不同依赖包，按需引入：

| Artifact | 代表 Talent | 描述 |
|---|---|---|
| `solon-ai-talent-cli` | `TerminalTalent` / `SkillTalent` / `TodoTalent` | 终端命令、技能管理、任务进度 |
| `solon-ai-talent-web` | `WebsearchTalent` / `WebfetchTalent` / `CodeSearchTalent` | 网络搜索、网页抓取、代码搜索 |
| `solon-ai-talent-gateway` | `ToolGatewayTalent` / `McpGatewayTalent` / `OpenApiGatewayTalent` | 工具/MCP/OpenAPI 网关 |
| `solon-ai-talent-text2sql` | `Text2SqlTalent` | 自然语言转 SQL |
| `solon-ai-talent-data` | `RedisTalent` | Redis 长期记忆 |
| `solon-ai-talent-file` | `FileReadWriteTalent` / `ZipTalent` | 文件读写、压缩归档 |
| `solon-ai-talent-pdf` | `PdfTalent` | PDF 读取与排版生成 |
| `solon-ai-talent-generation` | `ImageGenerationTalent` / `VideoGenerationTalent` | 图片/视频生成 |
| `solon-ai-talent-mail` | `MailTalent` | 邮件发送 |
| `solon-ai-talent-social` | `DingTalkTalent` / `FeishuTalent` / `WeComTalent` | 钉钉/飞书/企业微信推送 |
| `solon-ai-talent-sys` | `NodejsTalent` / `PythonTalent` / `ShellTalent` / `SystemClockTalent` | 脚本与系统运维 |

## Harness — 智能体马具框架

Dependency: `solon-ai-harness`

v4.0.0 起完善。通过 `solon-ai-talent-*` 插件组合并定制而成的高性能智能体执行框架。理论上可嵌入到任意 Java 项目中。

综合示例项目：
- [SolonCode（基于 Java 8 实现的 "Claude Code" 或 "OpenCode"）](https://gitee.com/opensolon/soloncode)
- [SolonClaw（基于 Java 8 实现的 "OpenClaw" 或 "Moltbot"）](https://gitee.com/opensolon/solonclaw)

### 核心职责

- **工具使用 (Tool Steering)**: 动态挂载、MCP 协议、安全拦截
- **记忆与会话 (Memory & Session)**: 持久化、短期/长期记忆、快照恢复
- **上下文工程 (Context Engineering)**: 窗口滑窗、语义压缩、意图聚焦
- **环境隔离 (Sandbox)**: 影子空间、自愈循环

### 依赖

```xml
<dependency>
    <groupId>org.noear</groupId>
    <artifactId>solon-ai-harness</artifactId>
</dependency>
```

### Helloworld

```java
import org.noear.solon.ai.agent.AgentSession;
import org.noear.solon.ai.agent.AgentSessionProvider;
import org.noear.solon.ai.agent.react.ReActAgent;
import org.noear.solon.ai.agent.session.InMemoryAgentSession;
import org.noear.solon.ai.chat.ChatConfig;
import org.noear.solon.ai.harness.HarnessEngine;
import org.noear.solon.ai.harness.agent.AgentDefinition;
import org.noear.solon.ai.harness.permission.ToolPermission;

import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;

public class DemoApp {
    public static void main(String[] arg) throws Throwable {
        AgentSessionProvider sessionProvider = new AgentSessionProvider() {
            private Map<String, AgentSession> sessionMap = new ConcurrentHashMap<>();

            @Override
            public AgentSession getSession(String instanceId) {
                return sessionMap.computeIfAbsent(instanceId, k -> InMemoryAgentSession.of(k));
            }
        };

        //--- 1. 初始化（v4：流式构建，不再使用 HarnessProperties）
        HarnessEngine engine = HarnessEngine.of("work", ".soloncode/") // 工作区、马具主目录
                .systemPrompt("xxx")                  // 主代理系统提示词
                .addModel(new ChatConfig())           // 添加大模型配置（可多个，第一个为默认）
                .toolsAdd(ToolPermission.TOOL_WEBSEARCH) // 设定工具权限
                .sessionProvider(sessionProvider)
                .build();

        //--- 用主代理执行
        case1(engine, "hello");

        //--- 动态创建子代理执行（可以动态创建不同的工具权限）
        case2(engine, "hello");
    }

    private static void case1(HarnessEngine engine, String prompt) throws Throwable {
        AgentSession session = engine.getSession("default");

        //--- 用主代理模式
        engine.prompt(prompt)
                .session(session) //没有，则为临时会话
                .options(o -> {
                    //按需，动态指定工作区（没有，则为默认工作区）
                    o.toolContextPut(HarnessEngine.ATTR_CWD, "xxx");
                })
                .call();
    }

    private static void case2(HarnessEngine engine, String prompt) throws Throwable {
        AgentSession session = engine.getSession("default");

        //动态定义智能体
        AgentDefinition definition = new AgentDefinition();
        definition.setSystemPrompt("xxx"); //系统提示词
        definition.getMetadata().addTools(ToolPermission.TOOL_BASH); //工具权限

        ReActAgent subagent = engine.createSubagent(definition).build();
        subagent.prompt(prompt)
                .session(session) //没有，则为临时会话
                .options(o -> {
                    //按需，动态指定工作区（没有，则为默认工作区）
                    o.toolContextPut(HarnessEngine.ATTR_CWD, "xxx");
                })
                .call();
    }
}
```

### 核心配置项（v4 流式构建）

```java
HarnessEngine engine = HarnessEngine.of("work", ".soloncode/")
        .systemPrompt("你是一个 AI 助手")
        .sessionWindowSize(8)
        .compressionThreshold(30, 30_000) // 消息条数阈值、token 阈值
        .maxTurns(30)
        .autoRethink(true)
        .toolsAdd(ToolPermission.TOOL_ALL_FULL) // 设定工具权限
        .sessionProvider(sessionProvider)
        .build();
```

构建完成后仍可在运行时动态调整（变更后自动重建主代理立即生效）：

```java
engine.allowTool("websearch");      // 动态授权工具
engine.disallowTool("bash");        // 动态禁用工具
engine.setMaxTurns(30);
engine.setCompressionThreshold(30, 30_000);
engine.setSandboxEnabled(true);
engine.addModel(new ChatConfig());  // 添加模型
engine.setDefaultModel("deepseek-v4-flash"); // 设定默认模型
```

#### 核心配置

> v4 字段更名提示：`maxSteps`→`maxTurns`、`maxStepsAutoExtensible`→`autoRethink`、`summaryWindowSize`→`compressionMaxMessages`、`summaryWindowToken`→`compressionMaxTokens`、`summaryModel`→`compressionModel`、`sandboxMode`→`sandboxEnabled`、`mountPools`→`mounts`。`models` 由 `List` 改为 `Map`。

| 配置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `workspace` | `String` | `work` | 工作区 |
| `harnessHome` | `String` | `.solon/` | 马具主目录（例：`.soloncode`） |
| `systemPrompt` | `String` | / | 系统提示词 |
| `tools` | `Set<String>` | / | 工具权限配置（`**`=所有工具；`*`=仅公域工具） |
| `disallowedTools` | `Set<String>` | / | 禁用工具配置（使用具体工具名） |
| `defaultModel` | `String` | / | 默认模型名（不指定则取 models 中第一个） |
| `models` | `Map<String, ChatConfig>` | / | 大模型配置 |
| `maxTurns` | int | `20` | 根代理最大循环步数 |
| `autoRethink` | bool | `true` | 最大步数自动续航（由 LLM 反思控制） |
| `sessionWindowSize` | int | `8` | 会话历史窗口大小（新指令时使用几条历史消息） |
| `compressionMaxMessages` | int | `30` | 触发上下文压缩的消息条数阈值 |
| `compressionMaxTokens` | int | `30000` | 触发上下文压缩的内容长度阈值 |
| `compressionModel` | `String` | / | 压缩用大模型（不指定则使用主模型） |

#### 安全与行为配置

| 配置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `sandboxEnabled` | bool | `true` | 沙盒模式，启用时禁止访问绝对路径（只能访问工作区与用户主目录） |
| `sandboxAllowUserHome` | bool | `true` | 沙盒模式下允许访问用户主目录 |
| `sandboxSystemRestrict` | bool | `true` | 沙盒系统级限制 |
| `hitlEnabled` | bool | `false` | 是否启用人工审核（危险操作需人工确认） |
| `subagentEnabled` | bool | `true` | 是否启用子代理模式（自动委派任务给专家代理） |
| `bashAsyncEnabled` | bool | `false` | 是否启用 Bash 异步执行 |
| `memoryEnabled` | bool | `true` | 是否启用心智记忆 |
| `userAgent` | `String` | / | 用户代理标识（会自动传播给所有模型） |
| `apiRetries` | int | `3` | API 重试次数 |
| `mcpRetries` | int | `3` | MCP 重试次数 |
| `modelRetries` | int | `3` | 模型重试次数 |

#### 扩展配置

| 配置项 | 类型 | 默认值 | 描述 |
|---|---|---|---|
| `mounts` | `MountDir` | / | 挂载配置（alias 须以 `@` 开头） |
| `mcpServers` | `Map<String, McpServerParameters>` | / | MCP 服务配置 |
| `apiServers` | `Map<String, ApiSource>` | / | Web API 服务配置 |
| `lspServers` | `Map<String, LspServerParameters>` | / | LSP 服务配置 |
| `extensions` | `List<HarnessExtension>` | / | 扩展接口配置 |

### 工具权限配置 (ToolPermission)

| 工具名 | 枚举常量 | 类型 | 描述 |
|---|---|---|---|
| `**` | `TOOL_ALL_FULL` | - | 所有公域 + 私域工具（约 19 个） |
| `*` | `TOOL_ALL_PUBLIC` | - | 仅所有公域工具（约 15 个） |
| `pi` | `TOOL_PI` | 聚合 | 微形命令行工具（read, write, edit, bash） |
| `hitl` | `TOOL_HITL` | 私域 | 人工介入审核 |
| `generate` | `TOOL_GENERATE` | 私域 | 动态生成子代理 |
| `restapi` | `TOOL_RESTAPI` | 私域 | Web 服务 API 接入 |
| `mcp` | `TOOL_MCP` | 私域 | MCP 服务接入 |
| `lsp` | `TOOL_LSP` | 公域 | LSP 代码理解服务 |
| `code` | `TOOL_CODE` | 公域 | 编码指引（自动分析项目类型、编译指令等） |
| `codesearch` | `TOOL_CODESEARCH` | 公域 | 网络代码搜索 |
| `websearch` | `TOOL_WEBSEARCH` | 公域 | 网络搜索 |
| `webfetch` | `TOOL_WEBFETCH` | 公域 | 网页内容抓取 |
| `todo` | `TOOL_TODO` | 公域 | 任务清单管理 |
| `skill` | `TOOL_SKILL` | 公域 | 专家技能调用 |
| `task` | `TOOL_TASK` | 公域 | 子代理任务委派 |
| `bash` | `TOOL_BASH` | 公域 | Shell 命令执行 |
| `ls` | `TOOL_LS` | 公域 | 列出目录内容 |
| `grep` | `TOOL_GREP` | 公域 | 递归内容搜索 |
| `glob` | `TOOL_GLOB` | 公域 | 通配符文件搜索 |
| `edit` | `TOOL_EDIT` | 公域 | 文件编辑（含 write、edit、read） |
| `read` | `TOOL_READ` | 公域 | 读取文件内容 |
| `write` | `TOOL_WRITE` | 公域 | 写入文件内容 |

### 调用与流式请求

`engine.prompt(...)` 返回 `ReActRequest` 接口（与 `ReActAgent::prompt` 一致）。

```java
// 同步调用
engine.prompt("hello").call();

// 流式调用
engine.prompt("hello").stream();
```

主代理也可直接使用：

```java
engine.getMainAgent().prompt("hello")
        .session(session)
        .call();
```

### 扩展定制

#### 动态添加 Web API (Rest API) 数据源

```java
HarnessEngine engine = HarnessEngine.of("work", ".soloncode/")
        .sessionProvider(sessionProvider)
        .build();

// v4：在 engine 上动态注册（原 harnessProps.addApiSource 已移除）
// 以文档地址 docUrl 为唯一标识
engine.addApiServer(new ApiSource().then(s -> {
            s.setDocUrl("http://xx.xx.xx/doc");
            s.setApiBaseUrl("http://xx.xx.xx/");
        }));
```

#### 注册自定义业务工具

```java
HarnessEngine engine = HarnessEngine.of("work", ".soloncode/")
        .sessionProvider(sessionProvider)
        .extensionAdd((agentName, agentBuilder) -> {
            agentBuilder.defaultToolAdd(new BizTool());
        })
        .build();
```

#### 动态配置系统提示词

```java
HarnessEngine engine = HarnessEngine.of("work", ".soloncode/")
        .sessionProvider(sessionProvider)
        .extensionAdd((agentName, agentBuilder) -> {
            if ("main".equals(agentName)) {
                agentBuilder.systemPrompt(context -> "你是一个专业的业务助手...");
            }
        })
        .build();
```

#### 子代理定制

子代理有两种使用场景：
- 被主代理调度时，不可定制，只能通过 `{workspace}/{harnessHome}/agents/xxx.md` 定义
- 使用代码调度时（可以进一步定制）

```java
AgentDefinition definition = new AgentDefinition();
        definition.setSystemPrompt("xxx");
        definition.getMetadata().addTools(ToolPermission.TOOL_BASH);

// createSubagent 返回 ReActAgent.Builder，可继续定制
ReActAgent subagent = engine.createSubagent(definition)
        .defaultToolAdd(new OrderTool())
        .build();

subagent.prompt(prompt)
        .session(session)
        .options(o -> {
            o.toolContextPut(HarnessEngine.ATTR_CWD, "xxx");
        })
        .call();
```

### 内置拦截器

- `compressionInterceptor` — 上下文压缩处理
- `hitlInterceptor` — 人工介入处理（含七层安全审计策略）

#### 修改内置拦截器

```java
HarnessEngine engine = HarnessEngine.of("work", ".soloncode/")
        .sessionProvider(sessionProvider)
        .compressionInterceptor(new ContextCompressionInterceptor()) // v4：原 SummarizationInterceptor
        .hitlInterceptor(new HITLInterceptor())
        .build();
```

#### 添加新的拦截器

```java
HarnessEngine engine = HarnessEngine.of("work", ".soloncode/")
        .sessionProvider(sessionProvider)
        .extensionAdd((agentName, agentBuilder) -> {
            agentBuilder.defaultInterceptorAdd(new ReActInterceptor() {
                @Override
                public void onAgentStart(ReActTrace trace) {
                    ReActInterceptor.super.onAgentStart(trace);
                }
            });
        })
        .build();
```

### 模型运行时切换

```java
// 设定默认模型（影响主代理时自动重建）
engine.setDefaultModel("model-name"); // v4：原 switchMainModel

// 运行时增/删模型
engine.addModel(new ChatConfig());
engine.removeModel("model-name");
```

### 命令系统

支持基于 Markdown 模板的命令加载机制（兼容 Claude Code Custom Commands 规范），支持 `$ARGUMENTS` 和 `$1`/`$2` 位置变量替换。

```java
CommandRegistry registry = engine.getCommandRegistry();
registry.load(Path.of(".solon/commands"));  // 从目录加载 Markdown 命令
registry.register(myCommand);                // 注册自定义命令

Command cmd = registry.find("/compact");
CommandResult result = cmd.execute(ctx);
```

命令类型：

| CommandType | 描述 |
|---|---|
| `SYSTEM` | 系统级：`/exit`, `/clear` |
| `CONFIG` | 配置级：`/model` |
| `AGENT` | Agent 级：`/resume`, `/compact` |

### 内置代理

AgentManager 内置 4 个代理：`bash`, `explore`, `plan`, `general`。可通过 `agentPools` 扩展。

```java
AgentManager agentManager = engine.getAgentManager();
agentManager.addAgent(myAgentDefinition);           // 注册自定义代理
agentManager.agentPool(Path.of(".solon/agents"));    // 从目录加载
```

### 典型示例：PiAgent

网上传说的 PiAgent 只有四个工具："read", "write", "edit", "bash"，框架特意定义了 `ToolPermission.TOOL_PI` 枚举方便使用。

```java
HarnessEngine engine = HarnessEngine.of("work", ".soloncode/")
        .toolsAdd(ToolPermission.TOOL_PI) //微形命令行工具
        .addModel(new ChatConfig()) //设定大模型配置
        .sessionProvider(sessionProvider)
        .build();

engine.prompt("网络调查 ai mcp 协议，生成一个 mcp.md 报告").call();
```

### 典型示例：Code 知识问答智能体

```java
HarnessEngine engine = HarnessEngine.of("work", ".soloncode/")
        .toolsAdd(ToolPermission.TOOL_CODESEARCH,
                ToolPermission.TOOL_WEBSEARCH, ToolPermission.TOOL_WEBFETCH)
        .addModel(new ChatConfig()) //设定大模型配置
        .sessionProvider(sessionProvider)
        .build();

engine.prompt("solon ai 有哪些常用的注解？").call();
```

---



## Agent / Harness 依赖索引

| Artifact | Description |
|---|---|
| `solon-ai-agent` | Agent 框架（Simple/ReAct/Team） |
| `solon-ai-ui-aisdk` | AI UI — Vercel AI SDK 协议 |
| `solon-ai-acp` | ACP 协议（stdio/websocket） |
| `solon-ai-a2a` | A2A 智能体间通信 |
| `solon-ai-harness` | 智能体马具框架 |
| `solon-ai-loop` | 循环执行引擎（4.0.3+） |
| `solon-ai-talent-cli` | CLI 才能 |
| `solon-ai-talent-code` | 代码工程规范才能（4.0.3+） |
| `solon-ai-talent-web` | Web 才能 |
| `solon-ai-talent-gateway` | 网关才能 |
| `solon-ai-talent-*` | 其它预置才能（见上文表格） |

## 4.0.3 AI 增量要点

| 能力 | 说明 |
|---|---|
| `solon-ai-loop` | 循环执行引擎（借鉴 oh-my-claudecode 设计；依赖 flow/expression/ai/harness） |
| `solon-ai-talent-code` | 代码工程规范才能（从 harness 拆出） |
| `GenerateTalent` | 原 harness 内 `GenerateTool` 更名为 `GenerateTalent`，便于动态启停 |
| `Talent.setEnabled` | 接口级开关 |

### 依赖示例

```xml
<dependency>
    <groupId>org.noear</groupId>
    <artifactId>solon-ai-loop</artifactId>
</dependency>
<dependency>
    <groupId>org.noear</groupId>
    <artifactId>solon-ai-talent-code</artifactId>
</dependency>
```

