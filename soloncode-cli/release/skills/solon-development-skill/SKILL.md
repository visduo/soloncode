---
name: solon-development-skill
description: "Specialized knowledge for developing Java applications with the Solon framework. Covers core concepts, web, data, security, remoting, AI, flow orchestration, cloud-native, testing, and more. Use when the user asks to create/build/debug Solon apps, Solon AI (ChatModel/RAG/MCP/Agent/Harness/Talent), Solon Flow, Solon Cloud, Nami RPC, data access (SqlUtils/MyBatis), or when writing Java code with Solon annotations (@Mapping, @Inject, @SolonMain, @Component). Solon is an independent Java enterprise framework (NOT based on Spring) with its own annotation system, IoC/AOP container, and plugin ecosystem — never use Spring annotations or spring-boot dependencies."
---

# Solon Development Skill

为使用 **Solon 框架** 构建 Java 应用提供专家级指导。Solon 是独立的全场景 Java 企业应用框架 — **与 Spring 不兼容**，拥有自研架构、注解体系与生态。

**官网**: https://solon.noear.org  
**GitHub**: https://github.com/opensolon/solon  
**License**: Apache 2.0  
**JDK**: Java 8 ~ 26，GraalVM Native Image  
**当前版本**: **4.0.3**

## Critical Rules

1. **Solon 不是 Spring。** 禁止混用 Spring 注解（`@Autowired`、`@SpringBootApplication`、`@RestController`、`@RequestMapping`、`@Service`、`@Repository`、`@Value`、`@ComponentScan` 等）。
2. **禁止 Spring 依赖。** 不要引入 `spring-boot-starter-*`、`spring-*`。Solon 坐标 groupId 为 `org.noear`。
3. **配置文件是 `app.yml`**（或 `app.properties`），**不是** `application.yml`。
4. **入口**是 `Solon.start(App.class, args)`，不是 `SpringApplication.run()`。
5. **组件注解用 `@Component`**，不要用 `@Service` / `@Repository`。
6. **示例默认目标版本 4.0.3**（除非用户指定其它版本）。
7. **Parent POM** 为 `solon-parent`（`groupId=org.noear`）。
8. **中文支持。** 用户使用中文时，回复与代码注释使用中文。
9. **不确定的 API 不要臆造。** 优先查本 skill 的 reference；仍不确定时查官网/源码，禁止用 Spring 习惯补全。

## 执行流程

1. **判定场景** → 只 `read` 下表中对应的 1～2 个 reference（**禁止一次加载全部**，合计约 6000 行）。
2. **生成代码前**核对 Critical Rules（尤其：`app.yml`、`@Component`、`@Inject`、无 Spring 依赖）。
3. **数据访问**优先读 `references/data_access.md`（SqlUtils / 事务 / MyBatis / `@Cache`）。
4. **AI 场景**：Chat/RAG/MCP → `ai_chat_rag_mcp.md`；Agent/Talent/Harness/Loop/A2A → `ai_agent_harness.md`。
5. **从 Spring 迁移** → 使用 `spring-to-solon-skill`，本 skill 仅保留精简对照。
6. 用户中文提问 → 中文回复与注释；默认版本 **4.0.3**。
7. **API 不确定时**查 reference 或源码；禁止用 Spring 习惯或臆造坐标补全（例如不存在 `solon-ai-rag` / `solon-ai-a2a`）。

## Scene Navigation

> 根据用户场景读取对应 reference。

### 基础与核心

| Scenario | Reference File | Grep Keywords |
|---|---|---|
| 项目初始化 / Maven / 构建 / 部署 / AOT / Native Image | `references/quick_start.md` | `pom.xml`, `Solon.start`, `solon-maven-plugin`, `solon-aot`, `native-image` |
| 注解对照 / IoC / 配置 / 插件 SPI / SnEL / 与 Spring 差异 | `references/core_concepts.md` | `@Inject`, `@Configuration`, `app.yml`, `SnEL`, `SpiLoader` |
| 依赖选择 (web/lib) / 模块列表 / 序列化 / 视图 / ORM 索引 | `references/modules_reference.md` | `solon-web`, `solon-lib`, `solon-serialization`, `MyBatis` |
| 数据源 / SqlUtils / 事务 / MyBatis 用法 | `references/data_access.md` | `SqlUtils`, `solon.dataSources`, `@Transaction`, `@Db`, `DataSource` |
| 注解完整参考 / 配置属性 / WebSocket·EventBus API | `references/api_annotations.md` | `@Mapping`, `@Bean`, `@Param`, `server.port`, `EventBus`, `WebSocket` |

### Web 开发

| Scenario | Reference File | Grep Keywords |
|---|---|---|
| REST API / MVC / Filter / 定时任务 / 全局异常 / 模式速查 | `references/common_patterns.md` | `@Controller`, `@Component`, `Filter`, `@Mapping`, `@Scheduled` |
| SSE / Reactive / I18n | `references/web_advanced.md` | `SseEmitter`, `Flux`, `Mono`, `solon-web-sse`, `solon-web-rx`, `I18nUtil` |

### 安全

| Scenario | Reference File | Grep Keywords |
|---|---|---|
| 认证 / 鉴权 / CORS / 角色权限 / 参数校验 / 配置加密 | `references/security.md` | `AuthAdapter`, `AuthProcessor`, `@CrossOrigin`, `@AuthPermissions`, `solon-security` |

### 数据与通信

| Scenario | Reference File | Grep Keywords |
|---|---|---|
| RPC / Nami / Socket.D / 负载均衡 | `references/remoting.md` | `@NamiClient`, `@Remoting`, `Socket.D`, `LoadBalance`, `ClientSession` |

### 运维与可观测

| Scenario | Reference File | Grep Keywords |
|---|---|---|
| 日志配置 / 自定义添加器 / Slf4j | `references/logging.md` | `solon-logging`, `AppenderBase`, `logback` |

### 测试

| Scenario | Reference File | Grep Keywords |
|---|---|---|
| 单元测试 / 集成测试 / HTTP 测试 / Mock | `references/testing.md` | `@SolonTest`, `HttpTester`, `@Rollback`, `@Import`, `mockito` |

### 云原生 / 微服务

| Scenario | Reference File | Grep Keywords |
|---|---|---|
| 配置中心 / 注册发现 / 事件 / 分布式任务 / 文件 / 熔断 / 网关 / 链路 / 锁 | `references/cloud_native.md` | `nacos`, `kafka`, `minio`, `xxl-job`, `CloudClient`, `@CloudJob`, `@CloudEvent` |

### AI 开发

| Scenario | Reference File | Grep Keywords |
|---|---|---|
| ChatModel / Tool Call / RAG / MCP / GenerateModel / 方言 | `references/ai_chat_rag_mcp.md` | `ChatModel`, `RAG`, `MCP`, `ToolMapping`, `GenerateModel` |
| Agent / Talent / Harness / AI UI / ACP / A2A / Loop | `references/ai_agent_harness.md` | `ReActAgent`, `HarnessEngine`, `Talent`, `AiSdkStreamWrapper`, `ACP`, `A2A`, `solon-ai-loop` |

### 流程编排

| Scenario | Reference File | Grep Keywords |
|---|---|---|
| Flow 流程编排（规则 / 工作流 / 状态机 / 图编排） | `references/flow_orchestration.md` | `FlowEngine`, `FlowContext`, `Graph`, `YAML`, `StateMachine` |

## 4.0.3 要点（相对 4.0.2）

- 官网当前稳定版：**4.0.3**；JDK **8 ~ 26**
- AI：`solon-ai-loop`；`solon-ai-talent-code`（从 harness 拆出）；`GenerateTool` → `GenerateTalent`
- A2A：`TeamProtocols.A2A`（`solon-ai-agent`），无独立 `solon-ai-a2a` 模块
- RAG：核心在 `solon-ai-core`；loader=`solon-ai-load-*`；repo=`solon-ai-repo-*`；写入 API 为 `save`（非 `insert`）
- Harness Builder：`modelAdd(ChatConfig)`；运行时才是 `engine.addModel(...)`
- Nami 默认 snack4：`Snack4Decoder` / `Snack4Encoder`
- 核心：`ScopeLocal` 等能力持续演进；服务器可选 `solon-server-feathttp`
- 详细 AI 变更见 `ai_chat_rag_mcp.md` / `ai_agent_harness.md`

## Reference 阅读优先级（Agent 友好）

| 优先级 | 文件 | 何时读 |
|---|---|---|
| 必读入口 | `quick_start.md` / `common_patterns.md` | 新建项目、REST/MVC |
| 按需 | `data_access.md` / `testing.md` / `security.md` | 数据、测试、鉴权 |
| 按需 | `ai_chat_rag_mcp.md` / `ai_agent_harness.md` | AI 相关 |
| 按需 | `remoting.md` / `cloud_native.md` / `flow_orchestration.md` | RPC/云/流程 |
| 查阅 | `api_annotations.md` / `modules_reference.md` | 注解/依赖索引 |
| 进阶 | `core_concepts.md` 后半 SPI/E-SPI/H-SPI | 插件开发时再读 |
