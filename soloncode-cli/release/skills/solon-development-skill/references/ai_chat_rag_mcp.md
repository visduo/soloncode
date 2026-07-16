# AI Chat / RAG / MCP — Solon AI 基础能力

> 适用场景：LLM 调用、Tool Calling、RAG、MCP 协议、生成模型、方言与依赖。
>
> 目标版本：4.0.3。Agent / Talent / Harness / AI UI / ACP / A2A 见 `ai_agent_harness.md`。

## ChatModel — LLM 调用

Dependency: `solon-ai`（包含 `solon-ai-core` 及所有方言包）或单独使用 `solon-ai-core`。

### 配置器构建

app.yml:
```yaml
solon.ai.chat:
  demo:
    apiUrl: "http://127.0.0.1:11434/api/chat" # 使用完整地址（而不是 api_base）
    provider: "ollama" # 使用 ollama 服务时，需要配置 provider
    model: "llama3.2"
```

```java
@Configuration
public class AiConfig {
    @Bean
    public ChatModel chatModel(@Inject("${solon.ai.chat.demo}") ChatConfig config) {
        return ChatModel.of(config).build();
    }
}
```

### Builder 原始构建

```java
ChatModel chatModel = ChatModel.of("http://127.0.0.1:11434/api/chat")
        .headerSet("x-demo", "demo1")
        .provider("ollama")
        .model("llama3.2")
        .build();
```

### 调用示例

```java
// 同步调用
ChatResponse resp = chatModel.prompt("你好").call();
String content = resp.getMessage().getContent();

// 流式调用（需 solon-web-rx）
Flux<ChatResponse> stream = chatModel.prompt("你好").stream();
```

## Tool Calling

Tool Call（或 Function Call）能够让大语言模型在生成时，“按需”调用外部的工具，进而连接外部的数据和系统。通过定义一组函数作为模型可访问的工具，并根据对话历史在适当的时候使用它们。

### @ToolMapping 注解开发

```java
public class WeatherTools extends AbsToolProvider{
    @ToolMapping(description = "查询天气")
    public String getWeather(@Param(description = "城市") String location) {
        return location + "：晴，14度";
    }
}
```

### 工具注册

```java
// 方式1：通过对象注册（推荐，自动扫描 @ToolMapping）
@Bean
public ChatModel chatModel(ChatConfig config) {
    return ChatModel.of(config).defaultToolAdd(new WeatherTools()).build();
}

// 方式2：通过 ToolProvider 实例注册（如 McpClientProvider）
@Bean
public ChatModel chatModel(ChatConfig config, McpClientProvider clientProvider) {
    return ChatModel.of(config).defaultToolAdd(clientProvider).build();
}
```

### 工具属性

| 属性 | 描述 |
|---|---|
| `name` | 工具名称 |
| `title` | 标题（对接 MCP tool 的 title 属性） |
| `description` | 描述（LLM 识别用） |
| `returnDirect` | 是否直接返回给调用者（跳过 LLM 再加工） |
| `inputSchema` | 输入架构 |
| `outputSchema` | 输出架构 |
| `meta` | 元信息（可对描述语进行染色） |

## RAG — 检索增强生成

Dependency: `solon-ai-rag`

### EmbeddingModel 嵌入模型

Builder 原始构建：
```java
EmbeddingModel embeddingModel = EmbeddingModel.of("http://127.0.0.1:11434/api/embed")
    .provider("ollama").model("bge-m3:latest").build();
```

配置器构建：
```yaml
solon.ai.embed:
  demo:
    apiUrl: "http://127.0.0.1:11434/api/embed"
    provider: "ollama"
    model: "bge-m3:latest"
```

```java
@Bean
public EmbeddingModel embeddingModel(@Inject("${solon.ai.embed.demo}") EmbeddingConfig config) {
    return EmbeddingModel.of(config).build();
}
```

调用：
```java
// 标准调用
EmbeddingResponse resp = embeddingModel
        .input("比较原始的风格", "能表达内在的大概过程", "太阳升起来了")
        .call();

// 快捷调用
float[] data = embeddingModel.embed("比较原始的风格");
List<Document> documents = ...;
embeddingModel.embed(documents);
```

### RerankingModel 重排模型

为文档进行相似度排序。和聊天模型一样，也会有方言及适配。

Builder 原始构建：
```java
RerankingModel rerankingModel = RerankingModel.of("https://api.moark.com/v1/rerank")
    .apiKey("***").model("bge-reranker-v2-m3").build();
```

配置器构建：
```yaml
solon.ai.rerank:
  demo:
    apiUrl: "https://api.moark.com/v1/rerank"
    apiKey: "......"
    provider: "giteeai"
    model: "bge-reranker-v2-m3"
```

```java
@Bean
public RerankingModel rerankingModel(@Inject("${solon.ai.rerank.demo}") RerankingConfig config) {
    return RerankingModel.of(config).build();
}
```

调用：
```java
// 标准调用
RerankingResponse resp = rerankingModel
        .input("比较原始的风格", "能表达内在的大概过程", "太阳升起来了")
        .call();

// 快捷调用：为文档重新排序
documents = rerankingModel.rerank(query, documents);
```

### 文档加载与分割

```java
EmbeddingModel embeddingModel = EmbeddingModel.of("http://127.0.0.1:11434/api/embed")
    .provider("ollama").model("nomic-embed-text").build();

InMemoryRepository repository = new InMemoryRepository(embeddingModel);

// 文档加载与切分
List<Document> docs = new SplitterPipeline()
    .next(new RegexTextSplitter("\n\n"))
    .next(new TokenSizeTextSplitter(500))
    .split(new PdfLoader(new File("data.pdf")).load());
repository.save(docs);

// 检索并构造增强 Prompt
List<Document> context = repository.search("查询问题");
ChatMessage msg = ChatMessage.ofUserAugment("查询问题", context);
```

### RAG Document Loaders

| Artifact | Format | Loader 类 |
|---|---|---|
| `solon-ai-load-pdf` | PDF | `PdfLoader` |
| `solon-ai-load-word` | Word (.doc/.docx) | `WordLoader` |
| `solon-ai-load-excel` | Excel (.xls/.xlsx) | `ExcelLoader` |
| `solon-ai-load-html` | HTML | `HtmlSimpleLoader` |
| `solon-ai-load-markdown` | Markdown | `MarkdownLoader` |
| `solon-ai-load-ppt` | PowerPoint (.ppt/.pptx) | `PptLoader` |

```java
// 加载示例（各 Loader 用法一致）
PdfLoader loader = new PdfLoader(new File("data.pdf"));
List<Document> docs = loader.load();
repository.insert(docs);
```

### RAG Vector Repositories

| Artifact | Backend |
|---|---|
| `solon-ai-repo-milvus` | Milvus |
| `solon-ai-repo-pgvector` | PgVector |
| `solon-ai-repo-elasticsearch` | Elasticsearch |
| `solon-ai-repo-redis` | Redis |
| `solon-ai-repo-qdrant` | Qdrant |
| `solon-ai-repo-chroma` | Chroma |
| `solon-ai-repo-weaviate` | Weaviate |
| `solon-ai-repo-dashvector` | DashVector |

### RAG WebSearch — 联网搜索

| Artifact | 搜索引擎 | Repository 类 |
|---|---|---|
| `solon-ai-search-baidu` | 百度搜索 | `BaiduWebSearchRepository` |
| `solon-ai-search-bocha` | Bocha 搜索 | `BochaWebSearchRepository` |
| `solon-ai-search-tavily` | Tavily 搜索 | `TavilyWebSearchRepository` |

## MCP — Model Context Protocol

Dependency: `solon-ai-mcp`

支持 MCP_2025-03-26 版本协议。支持 Java 8, 11, 17, 21, 25。也可嵌入到第三方框架生态（Solon、SpringBoot、jFinal、Vert.X、Quarkus、Micronaut）。

### 四种传输方式

| 传输方式 | 说明 | 备注 |
|---|---|---|
| `STDIO` | 本地进程内通讯（通过子进程启动） | 有状态 |
| `SSE` | 远程 HTTP SSE 通讯 | 有状态（MCP 官方已标为弃用） |
| `STREAMABLE` | 远程 HTTP Streamable 通讯 | 有状态（v3.5.0 后支持） |
| `STREAMABLE_STATELESS` | 远程 HTTP Streamable 无状态通讯 | 仅 server 端（v3.8.0 后支持），集群友好 |

传输方式对应表（服务端与客户端，须使用对应的传输方式才可通讯）：

| 服务端 | 客户端 | 备注 |
|---|---|---|
| `STDIO` | `STDIO` | 有状态，支持反向通讯 |
| `SSE` | `SSE` | 有状态，支持反向通讯 |
| `STREAMABLE` | `STREAMABLE` | 有状态，支持反向通讯 |
| `STREAMABLE_STATELESS` | `STREAMABLE` | 无状态，不支持反向通讯，对 server 集群很友好 |

### Server

```java
@McpServerEndpoint(channel = McpChannel.STREAMABLE, mcpEndpoint = "/mcp")
public class McpServerTool {
    @ToolMapping(description = "查询天气")
    public String getWeather(@Param(description = "城市") String location) {
        return location + "：晴，14度";
    }
}
```

### Client

```java
McpClientProvider client = McpClientProvider.builder()
    .channel(McpChannel.STREAMABLE)
    .url("http://localhost:8080/mcp").build();

// 直接调用
String result = client.callTool("getWeather", Map.of("location", "杭州")).getContent();

// 与 ChatModel 集成
ChatModel chatModel = ChatModel.of(chatConfig)
        .defaultToolAdd(client) //绑定 MCP 工具
        .build();
```

### Client 配置器构建

```yaml
solon.ai:
  mcp:
    client:
      demo:
        channel: "streamable"
        url: "http://localhost:8080/mcp"
```

```java
@Bean
public McpClientProvider mcpClient(
        @Inject("${solon.ai.mcp.client.demo}") McpClientProvider clientProvider) {
    return clientProvider;
}

@Bean
public ChatModel chatModel(@Inject("${solon.ai.chat.demo}") ChatConfig chatConfig,
                           McpClientProvider clientProvider) {
    return ChatModel.of(chatConfig)
            .defaultToolAdd(clientProvider) //添加默认工具
            .build();
}
```

## GenerateModel — 生成模型（图/音/视）

也支持图像生成或修改模型（由 GenerateModel 体系替代原 ImageModel 体系）。

```java
// 图像生成示例
GenerateModel generateModel = GenerateModel.of(apiUrl)
        .provider(...)
        .model(...)
        .build();

GenerateResponse resp = generateModel.prompt("一只猫的插画").call();
```

## AI 注解参考

| Annotation | Target | Description |
|---|---|---|
| `@ToolMapping` | Method | 声明 AI 工具方法（必填 description） |
| `@ToolMapping(name="...")` | Method | 指定工具名称 |
| `@ToolMapping(returnDirect=true)` | Method | 工具结果直接返回给调用者（跳过 LLM 加工） |
| `@McpServerEndpoint` | Class | 声明 MCP 服务端点（必填 channel, mcpEndpoint） |
| `@Param(description="...")` | Parameter | 工具参数描述 |

## AI 核心 API 参考

| Class/Interface | Description |
|---|---|
| `ChatModel` | LLM 调用核心接口，支持 call/stream |
| `ChatConfig` | ChatModel 配置类，可从 yml 注入 |
| `ChatResponse` | 聊天响应 |
| `ChatMessage` | 消息构建（User/System/Assistant/Tool 四种类型），支持 ofUserAugment |
| `ChatSession` | 会话管理，支持多轮对话 |
| `InMemoryChatSession` | 内存会话实现 |
| `ChatDialect` | 聊天方言（用于适配不同的 LLM 接口规范） |
| `FunctionTool` | 函数工具接口 |
| `ToolProvider` | 工具提供者接口 |
| `MethodToolProvider` | 方法工具提供者（分析 @ToolMapping 注解） |
| `EmbeddingModel` | 嵌入模型接口 |
| `EmbeddingConfig` | 嵌入模型配置类 |
| `RerankingModel` | 重排模型接口 |
| `RerankingConfig` | 重排模型配置类 |
| `InMemoryRepository` | 内存向量知识库 |
| `SplitterPipeline` | 文档分割管道 |
| `McpClientProvider` | MCP 客户端（同时提供 Tool/Prompt/Resource） |
| `McpChannel` | MCP 通道类型（STDIO/SSE/STREAMABLE/STREAMABLE_STATELESS） |
| `GenerateModel` | 生成模型（图/音/视） |

> Agent / Harness / Talent / AI UI 相关 API 见 `ai_agent_harness.md`。

## AI 核心依赖

| Artifact | Description |
|---|---|
| `solon-ai-core` | AI 核心模块（ChatModel/ToolCall/ChatSession） |
| `solon-ai` | 核心 AI 模块（包含 solon-ai-core 及所有方言包） |
| `solon-ai-rag` | RAG 检索增强生成 |
| `solon-ai-mcp` | MCP 协议支持 |
| `solon-ai-flow` | AI + Flow 集成 |
| `solon-ai-search-baidu` | 百度联网搜索 |
| `solon-ai-search-bocha` | Bocha 联网搜索 |
| `solon-ai-search-tavily` | Tavily 联网搜索 |

> Agent / Harness / Talent / Loop / UI 依赖见 `ai_agent_harness.md`。

## LLM Dialects（聊天方言）

solon-ai 通过方言适配机制兼容各种不同的大模型接口。ChatConfig 通过 provider 或 apiUrl 自动识别模型服务并选择对应的方言。

| Artifact | Provider 配置值 | 描述 |
|---|---|---|
| `solon-ai-dialect-openai` | `openai`（默认） | 兼容 openai 的接口规范。DeepSeek、QWen、GLM、Kimi、GPT 等兼容 |
| `solon-ai-dialect-ollama` | `ollama` | 兼容 ollama 的接口规范 |
| `solon-ai-dialect-gemini` | `gemini` | 兼容 google gemini 的接口规范（v3.8.1 后可试用） |
| `solon-ai-dialect-anthropic` | `anthropic` | 兼容 anthropic claude 的接口规范（v3.9.1 后可试用） |
| `solon-ai-dialect-dashscope` | `dashscope` | 兼容阿里云百炼的接口规范 |

> 提醒：一般匹配不到方言时？要么是 provider 配置有问题，要么是 pom 缺少相关的依赖包。
