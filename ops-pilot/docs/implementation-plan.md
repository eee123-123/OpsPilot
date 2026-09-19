# OpsPilot 产品功能拆解与实现排期

> 版本：v1.2  
> 日期：2026-09-15  
> 设计基线：`docs/system-design.md` v1.0  
> 范围原则：设计文档列出的功能全部实现，不保留未实施的占位模块  
> 排期假设：单人开发，平均每周 5 个有效开发日，共 21 个开发周

## 1. 文档目的

本文档将系统设计中的 92 条功能需求拆解为可开发、可测试、可验收的功能树，并定义依赖顺序、阶段里程碑和完成标准。

本文档不是愿望清单。所有列出的功能都属于最终产品范围；每项功能必须同时完成后端、前端或系统入口、数据、权限、审计、测试和文档工作。

## 2. 排期前提

### 2.1 当前本地环境

已检测到：

- Maven 3.8.4；
- Docker CLI 与 Docker Compose；
- Node.js 22；
- JDK 16 编译器和 JRE 8 默认运行时。

开始开发前必须完成：

1. 安装或配置 JDK 21，并确保 `java`、`javac`、Maven 使用同一 JDK；
2. 启动 Docker Desktop，验证 Docker Engine 可连接；
3. 初始化 Git 仓库并建立主分支保护习惯；
4. 确认可用磁盘空间和 Docker 内存配置；
5. 准备至少一个国产在线模型 API Key，用于最终真实 Smoke Test。

### 2.2 工作量口径

- 一个开发日按 4～6 小时高质量开发计算；
- 单元测试、文档、数据库迁移和前端异常状态计入功能工作量；
- 21 周提供 105 个有效开发日，其中 95 人日用于功能实现、5 人日用于模块学习文档、5 人日作为集成和返工缓冲；
- 若每周投入不足 25 小时，排期按有效开发日顺延；
- 外部模型账号审核、网络故障和硬件不足不计入编码工作量，但必须记录在测试报告中。

## 3. 完成定义（Definition of Done）

任一功能只有同时满足以下条件才标记完成：

1. 业务行为符合设计文档和需求编号；
2. 后端接口、领域逻辑和数据迁移已提交；
3. 对应前端页面或系统入口能够实际操作；
4. 权限、参数校验、审计和错误处理已覆盖；
5. Metrics、Trace 和结构化日志埋点已加入；
6. 单元测试及相关集成测试通过；
7. OpenAPI、README 或操作说明同步更新；
8. Docker 环境可复现，不依赖手工修改数据库；
9. 代码通过格式化、静态检查和质量门禁；
10. 验收步骤能够由另一名使用者独立完成；
11. 已生成或更新对应的 `docs/learning/Fxx-*.md`；
12. 学习文档与最终代码一致，引用内容全部可验证；
13. 已更新 `docs/learning/README.md` 中的文档状态；
14. 已更新本文对应 Fxx 的状态块和 `docs/development-progress.md` 会话交接记录；
15. 功能分支已通过规定检查并合并到 `main`，合并后验证通过且有可追踪的合并记录。

### 3.1 功能状态与续接规则

每个 F00～F17 标题下方均设置状态块，包含实施状态、测试状态、开发分支、学习文档及最后更新时间。实施状态只允许使用：

`未开始`、`开发中`、`待测试`、`测试中`、`待修复`、`待文档`、`待合并`、`已完成`、`阻塞`。

标准状态路径为：

```text
未开始 → 开发中 → 待测试 → 测试中 → 待文档 → 待合并 → 已完成
                         ↓
                       待修复 → 开发中
```

Agent 必须在状态实际变化时立即更新当前 Fxx 状态块，不得等到整个项目结束后批量补记。测试失败时记录为 `待修复`，代码完成但尚未执行测试时记录为 `待测试`，测试通过但学习文档未完成时记录为 `待文档`，分支内全部验收通过但尚未合并时记录为 `待合并`。只有功能进入 `main` 且合并后验证通过，才能标记为 `已完成`。

跨会话的具体完成内容、修改文件、测试命令、失败原因、阻塞和下一步统一记录在 `docs/development-progress.md`。下一次会话首先读取该文件并从记录的下一步继续。

### 3.2 模块学习文档规则

F00～F17 每个一级功能都必须在规定测试通过后自动生成一份学习文档，保存在 `docs/learning/`。用户不需要单独提醒 Agent；学习文档属于功能完成条件。

学习文档必须基于最终代码形成 As-Built Design，至少覆盖：业务目标、需求编号、模块边界、架构与流程、代码导航、核心实现讲解、难点、技术亮点、替代方案与权衡、安全与恢复、测试证据、调试方法、面试问题、实践练习和简历表达。

详细内容、真实性要求和跨会话操作规则以仓库根目录 `AGENTS.md` 为准，文档名称及完成状态以 `docs/learning/README.md` 为准。

### 3.3 Git 分支与合并规则

- F00 完成 Git 基线初始化后，F00～F17 每个一级功能都在独立的 `feature/fxx-*` 分支开发；
- 功能分支存在时继续原分支，不为同一个 Fxx 重复创建分支；
- 编码、测试、学习文档和分支内验收全部通过后进入 `待合并`；
- 本地使用 `--no-ff` 合并到 `main`；接入 GitHub 后通过 Pull Request 和规定检查合并；
- 测试失败、学习文档未完成、存在阻塞或高优缺陷时禁止合并；
- 合并后必须执行必要的构建或 Smoke Test，并记录分支、提交或 Pull Request 及验证结果；
- 不得直接在 `main` 开发产品功能，不得绕过失败检查或对共享分支 force push。

完整 Git 操作顺序和 F00 初始化例外以仓库根目录 `AGENTS.md` 为准。

## 4. 功能总览

| 编号 | 一级功能 | 关联需求 | 工作量 |
|---|---|---|---:|
| F00 | 工程基础与本地环境 | 全局 | 4 人日 |
| F01 | 登录、用户与 RBAC | FR-IAM-* | 4 人日 |
| F02 | 前端框架与统一体验 | FR-UX-* | 4 人日 |
| F03 | 告警与事故管理 | FR-INC-* | 4 人日 |
| F04 | 示例微服务与故障注入 | FR-INT-001/002/006 | 5 人日 |
| F05 | 工具注册与本地工具 | FR-TOL-* | 5 人日 |
| F06 | MCP Client/Server | FR-INT-004、MCP 相关需求 | 4 人日 |
| F07 | Policy、审批与审计 | FR-APR-*、FR-GOV-* | 6 人日 |
| F08 | 多模型网关 | FR-MDL-* | 8 人日 |
| F09 | Agent Runtime 与可靠执行 | FR-AGT-*、FR-INT-005 | 8 人日 |
| F10 | Agent Skill 体系 | FR-SKL-* | 6 人日 |
| F11 | RAG 知识库 | FR-RAG-* | 6 人日 |
| F12 | 诊断、验证、处置与复盘闭环 | FR-RPT-* | 6 人日 |
| F13 | 实时事件与站内通知 | FR-NTF-* | 4 人日 |
| F14 | Agent Eval 与反馈闭环 | FR-FBK-* | 6 人日 |
| F15 | 可观测性与运行状态 | FR-OPS-001/002/003 | 4 人日 |
| F16 | 导出、备份、恢复与数据重置 | FR-OPS-004/005/006/007 | 4 人日 |
| F17 | 安全、性能、全量回归与发布 | 全局验收 | 7 人日 |

一级功能实现合计 95 人日，18 份模块学习文档合计 5 人日，计划工作量共 100 人日。21 周提供 105 个有效开发日，保留 5 人日处理跨模块集成和缺陷返工；不能通过删除测试、权限、异常状态或学习文档压缩工期。

## 5. 详细功能拆解

## F00 工程基础与本地环境

> 实施状态：已完成
> 测试状态：通过（分支内验收及 `main` 合并后构建、全栈 Smoke Test、Playwright E2E 均通过）
> 开发分支：`feature/f00-engineering-foundation`（已通过 `1a7b6b2` 合并到 `main`）
> 学习文档：`docs/learning/F00-engineering-foundation.md`（已完成）
> 最后更新：2026-09-18

### F00.1 仓库与模块骨架

- 初始化 Git、`.gitignore`、EditorConfig 和提交规范；
- 创建 Maven 多模块工程；
- 创建 React + TypeScript 前端；
- 建立 `ops-pilot-api`、`ops-pilot-mcp-observability` 和示例服务目录；
- 约束模块依赖方向，加入 ArchUnit 测试。

### F00.2 构建与质量工具

- Maven Wrapper；
- Checkstyle、SpotBugs、JaCoCo；
- TypeScript Strict、ESLint、Prettier、Vitest、Playwright；
- 后端、前端和集成测试统一脚本；
- CI 工作流执行静态检查和测试。

### F00.3 本地基础设施

- PostgreSQL + pgvector Compose 配置；
- Prometheus、Grafana、Jaeger Compose 配置；
- 后端和前端 Dockerfile；
- `.env.example` 与配置校验；
- 健康检查、容器依赖和持久化 Volume。

### F00.4 验收

- 空仓库执行标准命令能完成编译；
- Docker Compose 能启动数据库和观测组件；
- CI 与本地质量命令一致；
- 文档记录所有端口和环境变量。

依赖：无。

## F01 登录、用户与 RBAC

> 实施状态：已完成  
> 测试状态：通过（后端、前端、模拟与真实后端 Playwright、OpenAPI 解析和完整 Compose 栈验收均通过）  
> 开发分支：`feature/f01-identity-rbac`  
> 合并提交：`4a532c6`  
> 学习文档：`docs/learning/F01-identity-rbac.md`（已完成）  
> 最后更新：2026-09-18

### F01.1 后端身份能力

- 用户、角色和用户角色表；
- BCrypt 密码摘要；
- 登录、退出、JWT 签发与校验；
- 首次登录修改密码；
- 禁用用户后令牌失效；
- 初始化管理员。

### F01.2 用户管理

- 用户分页查询；
- 新增用户；
- 启用、禁用；
- 重置密码；
- 分配 `VIEWER`、`OPERATOR`、`APPROVER`、`ADMIN`；
- 用户管理审计。

### F01.3 前端

- 登录页；
- 首次修改密码页；
- 用户管理页；
- 路由守卫；
- 菜单和按钮权限；
- 会话过期跳转及提示。

### F01.4 测试与验收

- 四角色 API 权限矩阵测试；
- 禁用用户、错误密码和过期令牌测试；
- Playwright 登录及无权限流程；
- 前端隐藏按钮不能替代后端鉴权。

依赖：F00。

## F02 前端框架与统一体验

> 实施状态：待合并
>
> 测试状态：通过（Vitest、ESLint、TypeScript/Vite、Playwright、Maven、Compose）
>
> 开发分支：`feature/f02-frontend-foundation`
>
> 学习文档：`docs/learning/F02-frontend-foundation.md`（已完成）
>
> 最后更新：2026-09-19

### F02.1 应用框架

- 主布局、导航、面包屑和用户菜单；
- TanStack Query 请求层；
- JWT 自动附加和刷新策略；
- Request ID 展示；
- 全局错误边界和路由级错误处理。

### F02.2 通用组件

- 服务端分页表格；
- 筛选、排序和查询条件同步；
- 加载骨架、空状态和错误重试；
- 状态标签、风险标签和置信度组件；
- JSON、日志和 Trace 内容查看器；
- 危险操作二次确认对话框。

### F02.3 可访问性与响应

- 表单 Label 和错误提示；
- 键盘焦点与 Tab 顺序；
- 1366×768 桌面布局；
- 403、404、500 页面；
- 浏览器刷新后保持可恢复页面状态。

### F02.4 测试与验收

- 通用组件 Vitest；
- 路由权限和异常状态测试；
- TypeScript 无错误；
- 核心页面无阻塞级控制台错误。

依赖：F00、F01。

## F03 告警与事故管理

> 实施状态：未开始  
> 测试状态：未执行  
> 开发分支：`feature/f03-incident-management`（未创建）  
> 学习文档：`docs/learning/F03-incident-management.md`（未生成）  
> 最后更新：2026-09-15

### F03.1 告警接入

- Webhook DTO 和签名/Token 校验；
- 告警字段归一化；
- 同服务、同类型、时间窗口聚合；
- 重复告警幂等；
- 原始告警保存。

### F03.2 事故领域

- 事故状态机；
- 严重等级、影响服务和负责人；
- 事故创建、查询、更新和关闭；
- 事故时间线；
- 失败诊断重新触发。

### F03.3 前端

- 系统概览基础指标；
- 事故列表分页、筛选和排序；
- 事故详情基本信息；
- 时间线；
- 手动启动、取消和重试入口。

### F03.4 测试与验收

- 聚合窗口和重复 Webhook 测试；
- 非法状态转换测试；
- 不同角色操作权限；
- API 和页面主流程测试。

依赖：F01、F02。

## F04 示例微服务与故障注入

> 实施状态：未开始  
> 测试状态：未执行  
> 开发分支：`feature/f04-demo-services-fault-injection`（未创建）  
> 学习文档：`docs/learning/F04-demo-services-fault-injection.md`（未生成）  
> 最后更新：2026-09-15

### F04.1 示例系统

- `demo-order-service`；
- `demo-inventory-service`；
- `demo-payment-service`；
- 服务间 HTTP 调用和统一 Trace 传播；
- 结构化日志、业务指标和健康接口。

### F04.2 故障控制面

- 故障场景注册表；
- 启动、查询和恢复故障；
- 数据库连接池耗尽；
- 下游服务超时；
- 错误配置发布；
- Redis/缓存连接失败模拟；
- CPU 密集请求；
- 日志 Prompt Injection。

### F04.3 观测数据 Adapter

- 日志查询 Adapter；
- 指标查询 Adapter；
- Trace 查询 Adapter；
- 服务拓扑 Adapter；
- 变更记录 Adapter；
- Workspace 和 Environment 数据过滤。

### F04.4 前端与验收

- 演示中心场景卡片；
- 故障启动、恢复和状态反馈；
- 每个场景真实产生请求、日志、指标和 Trace；
- Agent 代码无法读取评测标准答案。

依赖：F00、F03。

## F05 工具注册与本地工具

> 实施状态：未开始  
> 测试状态：未执行  
> 开发分支：`feature/f05-tool-registry`（未创建）  
> 学习文档：`docs/learning/F05-tool-registry.md`（未生成）  
> 最后更新：2026-09-15

### F05.1 Tool Registry

- 工具名称、版本、描述和 Schema；
- 风险等级、权限、超时、重试和幂等元数据；
- 工具启用状态和内容校验值；
- 名称冲突检测；
- 工具列表与详情 API。
- 工具名称/描述索引和渐进式披露；
- 只向模型发送 Skill 允许且 Policy 通过的候选工具 Schema。

### F05.2 只读工具

- `query_logs`；
- `query_metrics`；
- `query_traces`；
- `get_service_topology`；
- `search_runbook`；
- `check_service_health`。

### F05.3 写工具

- `change_traffic_weight`；
- `restart_service`；
- `rollback_deployment`；
- 幂等键和操作前后状态；
- 参数快照与结果审计。

### F05.4 工具安全

- JSON Schema 校验；
- 服务名、时间范围和查询规模限制；
- 输出长度限制与脱敏；
- 超时和 Resilience4j；
- 全局工具解析 Fallback 关闭。

### F05.5 测试与验收

- 每个工具成功、失败、超时和非法参数测试；
- 重复写请求只执行一次；
- 不同 Workspace/Environment 不串数据；
- 工具结果包含来源和 Request ID。
- 工具检索准确率和未授权工具不可见测试。

依赖：F03、F04。

## F06 MCP Client/Server

> 实施状态：未开始  
> 测试状态：未执行  
> 开发分支：`feature/f06-mcp-client-server`（未创建）  
> 学习文档：`docs/learning/F06-mcp-client-server.md`（未生成）  
> 最后更新：2026-09-15

### F06.1 MCP Server

- 独立 Spring Boot MCP 服务；
- Streamable HTTP；
- 暴露日志、指标、Trace 和拓扑工具；
- Bearer Token 鉴权；
- 健康检查和结构化日志。

### F06.2 MCP Client

- Server 配置和允许列表；
- 工具发现、缓存和刷新；
- Schema 校验值；
- 本地工具与 MCP 工具统一适配；
- 名称冲突处理；
- 超时和错误映射。

### F06.3 管理与安全

- MCP Server 状态查询；
- 管理页连通性测试；
- 未鉴权访问拒绝；
- 未知 Server 拒绝；
- Schema 变化后停止自动使用并要求管理员确认；
- MCP Token 不进入模型和前端。

### F06.4 测试与验收

- `tools/list` 和 `tools/call` 契约测试；
- 鉴权、超时、Schema 篡改和越权测试；
- 至少一次诊断真实经过 MCP Client/Server；
- Trace 能跨 API 和 MCP 服务关联。

依赖：F05。

## F07 Policy、审批与审计

> 实施状态：未开始  
> 测试状态：未执行  
> 开发分支：`feature/f07-policy-approval-audit`（未创建）  
> 学习文档：`docs/learning/F07-policy-approval-audit.md`（未生成）  
> 最后更新：2026-09-15

### F07.1 Policy Engine

- 版本化 YAML Policy；
- Java 规则加载和启动校验；
- 角色、Workspace、Environment、事故等级、Skill、工具风险和预算输入；
- `ALLOW`、`DENY`、`REQUIRE_APPROVAL`、`ALLOW_WITH_CONSTRAINTS`；
- 冲突时默认拒绝；
- 决策原因和策略版本记录。

### F07.2 审批流程

- 审批创建和状态机；
- 展示工具、参数、原因、证据和影响；
- 批准、拒绝和超时；
- 审批后重新校验权限与参数摘要；
- 参数变化使审批失效；
- Agent 等待和恢复。

### F07.3 审计

- 登录与鉴权审计；
- Agent、工具、审批、模型、Skill、知识和配置审计；
- 变更前后值；
- 按用户、类型、时间和业务 ID 查询；
- 敏感字段脱敏。

### F07.4 前端及验收

- 审批中心；
- Policy 判定详情；
- 审计列表和详情；
- 操作员不能审批自己的越权请求；
- 未审批高风险工具执行次数必须为 0。

依赖：F01、F05。

## F08 多模型网关

> 实施状态：未开始  
> 测试状态：未执行  
> 开发分支：`feature/f08-model-gateway`（未创建）  
> 学习文档：`docs/learning/F08-model-gateway.md`（未生成）  
> 最后更新：2026-09-15

### F08.1 统一领域接口

- `AgentModel`、`ChatRequest`、`ChatResult`、`ChatChunk`；
- ModelCapabilities 和 ModelMetadata；
- Tool Call、结构化输出、Reasoning 和 Usage 统一结构；
- Provider 错误分类；
- 流式工具参数聚合。

### F08.2 Provider Adapter

- Mock Model；
- DeepSeek；
- Qwen；
- GLM；
- Kimi；
- Doubao；
- MiniMax；
- Ollama；
- 通用 OpenAI-Compatible。

### F08.3 治理能力

- 默认和备用 Provider；
- 能力协商；
- 健康探测；
- 超时、有限重试、熔断和恢复；
- 按数据级别阻止外部 Provider；
- 模型价格版本和估算费用；
- 调用步骤、Token、延迟和错误记录。

### F08.4 前端

- Provider 列表和能力矩阵；
- 非敏感参数配置；
- API Key 是否配置状态；
- 连通性测试；
- 默认/备用模型选择；
- 调用统计和费用展示。

### F08.5 测试与验收

- 每个 Provider 的 WireMock Fixture 契约；
- 每个在线 Provider 的显式 Smoke Test；
- 至少一个国产在线 Provider 保存真实测试结果；
- Mock Provider 支持所有自动化测试；
- 故障注入验证备用模型切换。

依赖：F00、F02、F07。

## F09 Agent Runtime 与可靠执行

> 实施状态：未开始  
> 测试状态：未执行  
> 开发分支：`feature/f09-agent-runtime`（未创建）  
> 学习文档：`docs/learning/F09-agent-runtime.md`（未生成）  
> 最后更新：2026-09-15

### F09.1 状态机与任务调度

- Agent Task 和 Agent Step；
- 完整状态转换；
- 数据库任务队列；
- 最大 4 个并行任务；
- 两个 Worker 的数据库租约；
- 取消、失败、Dead Letter 和人工重试。

### F09.2 Checkpoint

- 每步事务提交；
- Runtime Snapshot；
- 上下文摘要和证据引用；
- 已用 Token、费用、步骤和时间；
- 后端重启恢复；
- 写工具幂等结果恢复。

### F09.3 Agent Loop

- 上下文装配；
- 模型调用；
- 结构化输出校验；
- 工具请求校验；
- 工具执行及结果回填；
- 审批暂停；
- 终止条件和预算控制。

### F09.4 Outbox 与事件

- 状态事务内写 Outbox；
- 本地轮询发布器；
- 失败重试和 Dead Letter；
- 消费幂等；
- 事件序号。

### F09.5 测试与验收

- 所有合法与非法状态转换；
- 模型前后、工具前后和审批等待时重启恢复；
- Worker 竞争与租约过期；
- 最大步骤、Token、费用和超时终止；
- 已提交步骤 RPO 为 0，任务恢复不超过 60 秒。

依赖：F05、F07、F08。

## F10 Agent Skill 体系

> 实施状态：未开始  
> 测试状态：未执行  
> 开发分支：`feature/f10-agent-skills`（未创建）  
> 学习文档：`docs/learning/F10-agent-skills.md`（未生成）  
> 最后更新：2026-09-15

### F10.1 Skill 文件规范

- `SKILL.md` Frontmatter；
- Input/Output JSON Schema；
- Prompt、Reference 和 Eval 目录；
- 禁止 scripts；
- 路径穿越和非法引用检查；
- 内容校验值。

### F10.2 Skill Registry

- 文件扫描；
- 数据库索引；
- 新增、更新、废弃和撤回状态；
- 启用、禁用和版本回滚；
- Runtime 兼容性检查；
- 运行任务固定版本。

### F10.3 Skill Router

- 元数据渐进式披露；
- 告警类型规则路由；
- 模糊场景模型辅助路由；
- Policy 权限过滤；
- Skill Routing 记录。

### F10.4 内置 Skill

- `incident-triage`；
- `database-pool-diagnosis`；
- `dependency-timeout-diagnosis`；
- `configuration-change-analysis`；
- `safe-mitigation`；
- `postmortem-generation`。

### F10.5 前端与验收

- Skill 列表、详情、版本和状态；
- 重新扫描、校验、激活、禁用和回滚；
- 显示允许工具、知识范围和评测结果；
- Skill Routing Accuracy 不低于 95%；
- 被撤回 Skill 不进入新任务。

依赖：F07、F09。

## F11 RAG 知识库

> 实施状态：未开始  
> 测试状态：未执行  
> 开发分支：`feature/f11-rag-knowledge-base`（未创建）  
> 学习文档：`docs/learning/F11-rag-knowledge-base.md`（未生成）  
> 最后更新：2026-09-15

### F11.1 文档管理

- Markdown、TXT 和 PDF 文本导入；
- 文件类型、大小和安全校验；
- 文档元数据、版本和处理状态；
- 删除、重新索引和失败重试；
- 文档列表和详情。

### F11.2 索引流水线

- 文本清洗；
- 标题和语义分块；
- 内容校验值去重；
- Embedding；
- pgvector 写入；
- Workspace、服务、环境和文档类型元数据。

### F11.3 检索

- 元数据过滤；
- pgvector 向量召回；
- PostgreSQL 全文/关键词召回；
- 合并、去重和重排；
- Top-K 和上下文预算；
- 来源、文档版本和片段位置。

### F11.4 安全与前端

- 文档内容按不可信数据处理；
- Prompt Injection 标记；
- 知识库管理页；
- 上传进度和失败原因；
- 检索调试页；
- 引用跳转。

### F11.5 测试与验收

- 文档解析 Fixture；
- 重复导入和版本更新；
- 混合检索准确性；
- 数据范围隔离；
- 恶意文档不能扩大 Agent 权限。

依赖：F03、F08、F10。

## F12 诊断、验证、处置与复盘闭环

> 实施状态：未开始  
> 测试状态：未执行  
> 开发分支：`feature/f12-diagnosis-remediation`（未创建）  
> 学习文档：`docs/learning/F12-diagnosis-remediation.md`（未生成）  
> 最后更新：2026-09-15

### F12.1 Diagnosis Orchestrator

- 从事故选择 Skill；
- 生成结构化诊断计划；
- 并行执行安全只读工具；
- 生成根因假设、置信度、支持证据和反证；
- 验证或排除假设；
- 生成处置建议。

### F12.2 Evidence Verifier

- 独立 Prompt 和结构化输出；
- 只读权限；
- 检查结论与证据关系；
- 返回缺失证据项；
- 最多追加一次诊断轮次；
- 启用/禁用消融评测。

### F12.3 处置与恢复验证

- 创建审批；
- 执行流量调整、重启或回滚；
- 执行后健康检查；
- 判断恢复、未恢复或部分恢复；
- 未恢复时保留失败原因和建议。

### F12.4 复盘

- 影响范围；
- 事故时间线；
- 根因和证据；
- 人工及 Agent 操作；
- 恢复验证；
- 改进建议；
- Markdown 和 JSON 导出。

### F12.5 前端与验收

- 事故详情实时轨迹；
- 明确区分模型推断、证据、工具和人工操作；
- 根因卡片、置信度和证据跳转；
- 处置状态和恢复验证；
- 复盘查看及导出；
- 六个故障场景完成端到端闭环。

依赖：F06、F07、F09、F10、F11。

## F13 实时事件与站内通知

> 实施状态：未开始  
> 测试状态：未执行  
> 开发分支：`feature/f13-realtime-notifications`（未创建）  
> 学习文档：`docs/learning/F13-realtime-notifications.md`（未生成）  
> 最后更新：2026-09-15

### F13.1 SSE

- Task Event 持久化；
- SSE Endpoint；
- `eventId` 和 `Last-Event-ID`；
- 心跳；
- 前端断线重连、去重和补偿；
- 100 连接测试。

### F13.2 站内通知

- 新事故；
- 待审批；
- 任务失败；
- 任务完成；
- 未读数量、标记已读和业务跳转；
- 通知消费幂等。

### F13.3 前端与验收

- 顶部通知入口；
- 通知列表和过滤；
- Toast 与持久通知边界；
- 断网、恢复和会话过期测试；
- 页面刷新后轨迹不丢失。

依赖：F02、F07、F09。

## F14 Agent Eval 与反馈闭环

> 实施状态：未开始  
> 测试状态：未执行  
> 开发分支：`feature/f14-agent-evaluation`（未创建）  
> 学习文档：`docs/learning/F14-agent-evaluation.md`（未生成）  
> 最后更新：2026-09-15

### F14.1 数据集

- 场景、标准根因、可接受假设和必要证据；
- 允许工具路径和禁止操作；
- 数据集版本和校验值；
- 调试集与回归集分离；
- Prompt Injection 安全集。

### F14.2 评测执行

- 选择 Runtime Snapshot；
- 批量排队和进度；
- Mock 与在线模型；
- 中断、取消和重试；
- 结果持久化；
- 费用预算确认。

### F14.3 Grader

- Top-1 Accuracy；
- Top-3 Recall；
- Tool Selection Accuracy；
- Tool Argument Validity；
- Evidence Grounding Rate；
- Unsafe Action Block Rate；
- Recovery Success Rate；
- 延迟、Token 和费用；
- LLM Judge 仅作为辅助评分。

### F14.4 对比与反馈

- 模型、Prompt、Skill、Policy 版本对比；
- Verifier 消融对比；
- 回归差异；
- 用户正确/错误反馈；
- 失败轨迹脱敏导出；
- 人工激活或回滚候选版本。

### F14.5 前端与验收

- 创建评测、查看进度和详情；
- 指标总览、用例明细和版本对比；
- JSON/Markdown 报告；
- 安全不变量失败时禁止激活；
- 评测命令和页面结果一致。

依赖：F08、F10、F12。

## F15 可观测性与运行状态

> 实施状态：未开始  
> 测试状态：未执行  
> 开发分支：`feature/f15-observability`（未创建）  
> 学习文档：`docs/learning/F15-observability.md`（未生成）  
> 最后更新：2026-09-15

### F15.1 Metrics

- HTTP、数据库连接池和 JVM 指标；
- Agent Task、Step 和恢复指标；
- Model Token、延迟、费用和错误；
- Tool、MCP、审批和 Eval 指标；
- Prometheus 抓取；
- Grafana 预置看板。

### F15.2 Trace 与日志

- OpenTelemetry Trace；
- API → Runtime → Model/Tool → MCP 跨服务关联；
- Jaeger 查询；
- 结构化 JSON 日志；
- Request ID、Incident ID、Task ID 和 Trace ID；
- Prompt、Token 和密钥默认不记录。

### F15.3 运行状态

- 数据库、Provider、MCP、示例服务、Prometheus、Grafana 和 Jaeger 健康；
- 系统设置页状态卡片；
- 连通性测试；
- 依赖失败原因及恢复状态；
- 产品 SLI 展示。

### F15.4 验收

- Grafana 看板存在真实数据；
- Jaeger 可查询一次完整诊断 Trace；
- Provider 和 MCP 故障在 Metrics、日志和页面均可定位；
- 敏感信息扫描通过。

依赖：F06、F09、F12、F14。

## F16 导出、备份、恢复与数据重置

> 实施状态：未开始  
> 测试状态：未执行  
> 开发分支：`feature/f16-data-operations`（未创建）  
> 学习文档：`docs/learning/F16-data-operations.md`（未生成）  
> 最后更新：2026-09-15

### F16.1 配置管理

- 模型非敏感参数；
- 最大步骤、Token、费用、超时和重试；
- 配置校验和版本；
- 变更前后值审计；
- 配置错误回滚。

### F16.2 数据导出

- 事故 JSON/Markdown；
- 复盘 JSON/Markdown；
- 评测 JSON/Markdown；
- 文件名、编码和内容安全；
- 权限检查和导出审计。

### F16.3 备份恢复

- PowerShell 备份脚本；
- PowerShell 恢复脚本；
- 目标容器和数据库校验；
- 备份目录和命名；
- 空数据库恢复验证；
- 关键表数量和校验值比对。

### F16.4 演示数据重置

- 管理员 API 和前端入口；
- 显式确认文本；
- 清理目标范围展示；
- 重置后重新导入用户、Skill、知识和场景；
- 审计记录。

依赖：F01、F03、F10、F11、F14。

## F17 安全、性能、全量回归与发布

> 实施状态：未开始  
> 测试状态：未执行  
> 开发分支：`feature/f17-release-quality`（未创建）  
> 学习文档：`docs/learning/F17-release-quality.md`（未生成）  
> 最后更新：2026-09-15

### F17.1 安全加固

- Prompt Injection 红队用例；
- Excessive Agency 和工具越权；
- SSRF/主机允许列表；
- 文件上传和路径穿越；
- JWT、密码和登录限流；
- API Key、MCP Token 和日志泄漏扫描；
- 审批后参数篡改；
- Dependency 漏洞扫描。

### F17.2 性能与稳定性

- 10,000 条事故分页测试；
- 100 个 SSE 连接；
- 4 个并行 Agent Task；
- 数据库租约竞争；
- 连续全场景运行；
- 内存、线程和连接池泄漏检查；
- 普通 API P95 检查。

### F17.3 全量回归

- 后端单元和集成测试；
- Provider、MCP、Skill、Policy 契约测试；
- 前端 Vitest；
- Playwright 主流程；
- Docker 从空 Volume 启动；
- 备份恢复；
- Windows PowerShell 命令验证。

### F17.4 发布材料

- README；
- 架构图和数据流图；
- OpenAPI；
- 测试及评测报告；
- 演示账号和演示脚本；
- 故障场景说明；
- 截图和 5～8 分钟演示视频脚本；
- 简历项目描述中的量化数据来源。

### F17.5 最终验收

- 逐项核对系统设计第 21 章；
- 逐项核对 92 条 FR；
- 未完成项数量必须为 0；
- 阻塞级和高优先级缺陷数量必须为 0；
- 从空环境按 README 完成一次独立部署和完整演示。

依赖：F00～F16。

## 6. 依赖关系与关键路径

```text
F00 工程基础
 ├─→ F01 身份权限 ─→ F02 前端框架
 ├─→ F03 事故管理 ─→ F04 示例故障 ─→ F05 工具 ─→ F06 MCP
 └─→ F08 模型网关

F01 + F05 ─→ F07 Policy/审批
F05 + F07 + F08 ─→ F09 Agent Runtime
F07 + F09 ─→ F10 Skill
F08 + F10 ─→ F11 RAG
F06 + F07 + F09 + F10 + F11 ─→ F12 诊断闭环
F02 + F07 + F09 ─→ F13 实时通知
F08 + F10 + F12 ─→ F14 Eval
F06 + F09 + F12 + F14 ─→ F15 可观测性
F01 + F03 + F10 + F11 + F14 ─→ F16 数据运维
F00～F16 ─→ F17 发布
```

关键路径是：

```text
工程基础 → 事故/示例服务 → 工具/MCP → Policy/审批
→ 模型网关 → Agent Runtime → Skill/RAG → 诊断闭环
→ Eval/可观测性 → 全量验收
```

## 7. 21 周开发排期

W1～W18 在每个 Fxx 通过规定测试后同步完成对应学习文档，合计预留 5 人日并分摊到各功能周；不得把18份学习文档集中到项目结束时补写。W21 保留为集成返工、全量文档校验和最终发布缓冲。

| 周次 | 主要工作 | 交付里程碑 | 退出条件 |
|---|---|---|---|
| W1 | F00 工程、JDK、Compose、数据库、后端/前端骨架 | M0 工程可构建 | 后端、前端、PostgreSQL、Prometheus、Grafana、Jaeger可启动 |
| W2 | F01 登录、JWT、用户、角色；F02 主布局 | M1 可登录产品骨架 | 四角色登录及路由权限测试通过 |
| W3 | F03 告警接入、事故领域、列表和详情 | 事故管理闭环 | Webhook 能创建/聚合事故，前端可查询与重试 |
| W4 | F04 三个示例服务和六类故障 | M2 故障可复现 | 每个场景产生真实日志、指标和 Trace |
| W5 | F05 Tool Registry、只读工具和写工具 | 工具层可用 | 工具 Schema、风险、幂等和 Adapter 测试通过 |
| W6 | F06 MCP；F07 Policy、审批基础 | M3 安全工具闭环 | MCP 真实调用，高风险工具等待审批 |
| W7 | F07 审计完善；F08 统一模型接口、Mock、DeepSeek、Qwen | 模型网关第一版 | Mock 全功能；两家 Provider Fixture 通过 |
| W8 | F08 GLM、Kimi、Doubao、MiniMax、Ollama、通用适配器 | M4 多模型完成 | 全部 Adapter 契约测试和能力矩阵通过 |
| W9 | F09 状态机、Agent Loop、预算、数据库任务队列 | Runtime 主流程 | Mock Model 能完成只读诊断循环 |
| W10 | F09 Checkpoint、租约、Outbox、审批恢复 | M5 可靠 Agent 闭环 | 重启恢复、幂等、竞争 Worker 和预算测试通过 |
| W11 | F10 Skill 规范、Registry、Router、六个内置 Skill | Skill 完成 | 路由、版本固定、撤回和回滚测试通过 |
| W12 | F11 文档导入、pgvector、混合检索和知识库页面 | RAG 完成 | 三类文档、引用、隔离和注入测试通过 |
| W13 | F12 Orchestrator、Verifier、处置、恢复验证和复盘 | M6 业务全闭环 | 六场景从注入到复盘全部可演示 |
| W14 | F13 SSE/通知；完善所有业务页面与异常状态 | 产品前端完整 | 页面刷新、SSE 重连、通知和权限 E2E 通过 |
| W15 | F14 数据集、Grader、评测、版本对比和反馈 | M7 Eval 完成 | 指标、明细、报告和安全门禁可复现 |
| W16 | F15 Metrics/Trace/日志/健康；F16 配置、导出、备份恢复 | 可运维产品 | Grafana、Jaeger、健康页和恢复测试通过 |
| W17 | F17 安全、性能、稳定性和全量 E2E | Release Candidate | 安全不变量、性能目标和全量测试通过 |
| W18 | F17 全量回归、Docker 空环境部署和 Windows 命令验证 | Release Candidate | 92 条 FR 全部映射，阻塞缺陷为 0 |
| W19 | 跨模块缺陷修复、性能复测、在线模型 Smoke Test | 发布候选冻结 | 阻塞/高优缺陷为 0，测试和评测结果冻结 |
| W20 | 独立部署复验、全量学习文档复核、截图、演示脚本和简历数据 | 发布材料冻结 | 从空环境完成部署，18份学习文档与最终代码一致 |
| W21 | 集成返工缓冲、全量文档链接校验和最终发布复验 | v1.0 发布 | 所有验收项通过，阻塞/高优缺陷为0，交接记录完整 |

## 8. 每周固定节奏

每周执行同一质量节奏：

1. 周初确认本周需求编号和验收用例；
2. 先补数据库迁移、领域接口和测试骨架；
3. 按纵向切片完成后端、前端和测试；
4. 每完成一个切片立即在 Docker 环境验证；
5. 周末执行全量回归，记录新增缺陷和技术债；
6. 未满足退出条件的工作不进入下一里程碑完成数。

## 9. 测试执行矩阵

| 命令 | 作用 | 运行频率 |
|---|---|---|
| `.\mvnw.cmd test` | 后端单元测试 | 每次提交 |
| `.\mvnw.cmd verify` | 静态检查、集成测试、覆盖率 | 每日/合并前 |
| `npm run test` | 前端单元测试 | 每次提交 |
| `npm run lint` | 前端静态检查 | 每次提交 |
| `npm run test:e2e` | Playwright 主流程 | 每周/发布前 |
| `docker compose up --build` | 完整产品启动 | 每个里程碑 |
| `.\mvnw.cmd verify -Pprovider-it -Dprovider=...` | 在线 Provider Smoke Test | Provider 交付/发布前 |
| `.\mvnw.cmd verify -Pagent-eval` | Agent 固定集评测 | Prompt/Skill/模型变更后 |
| `.\scripts\backup.ps1` + `restore.ps1` | 数据恢复验证 | W16、发布前 |

具体命令以实际生成的模块路径为准，但 README、CI 和本文必须保持一致。

## 10. 里程碑演示内容

### M1：产品骨架

- 登录；
- 四角色权限；
- 前端布局；
- Docker 基础设施。

### M3：安全工具闭环

- 故障注入；
- Java Tool 和 MCP Tool；
- Policy 判定；
- 高风险审批；
- 审计记录。

### M5：可靠 Agent

- Mock Model 诊断；
- Tool Calling Loop；
- Checkpoint；
- 中断恢复；
- Outbox 与 SSE。

### M6：完整业务闭环

- Skill 路由；
- RAG；
- 根因证据；
- Evidence Verifier；
- 修复审批与执行；
- 恢复验证和复盘。

### M7：可评测产品

- 多模型对比；
- 自动 Grader；
- 版本对比；
- 安全门禁；
- Grafana 和 Jaeger。

### v1.0：最终项目

- 设计文档中的所有功能；
- 完整前后端；
- 一键部署；
- 自动测试和评测报告；
- 备份恢复；
- 独立演示脚本；
- 可追溯的简历量化数据。

## 11. 需求追踪矩阵

| 需求组 | 实现功能 | 主要测试 | 完成周 |
|---|---|---|---:|
| FR-INC-* | F03 | 告警聚合、状态机、API/E2E | W3 |
| FR-AGT-* | F09、F12 | Runtime、恢复、端到端 | W13 |
| FR-TOL-* | F05、F06 | Tool/MCP 契约、安全、幂等 | W6 |
| FR-APR-* | F07、F12 | 审批、篡改、恢复 | W13 |
| FR-RAG-* | F11 | 解析、混合检索、引用、安全 | W12 |
| FR-MDL-* | F08 | Provider Fixture、Smoke、降级 | W8 |
| FR-RPT-* | F12 | 轨迹、复盘、导出 | W13 |
| FR-SKL-* | F10 | 路由、版本、撤回、回滚 | W11 |
| FR-GOV-* | F07、F09、F14 | Policy、Snapshot、门禁 | W15 |
| FR-FBK-* | F14 | 反馈、对比、候选激活 | W15 |
| FR-INT-* | F01、F04、F06、F09 | 用户认证、Adapter、MCP、Outbox、Compose | W10 |
| FR-IAM-* | F01 | 登录、用户、RBAC、审计 | W2 |
| FR-NTF-* | F13 | 通知、SSE 重连和补偿 | W14 |
| FR-OPS-* | F15、F16 | 健康、配置、导出、恢复 | W16 |
| FR-UX-* | F02 及所有前端切片 | 组件测试、Playwright、异常状态 | W17 |

## 12. 范围控制规则

- 新需求必须明确替换现有需求或增加工作量，不能口头插入；
- 不增加 A2A、多租户、企业 SSO、Kafka、Kubernetes、移动端或 Skill 脚本执行；
- 不以增加 Agent 数量作为技术先进性的指标；
- 不以降低安全指标、删除恢复测试或只做页面 Mock 换取进度；
- Provider 没有真实 Key 时如实标记为“Fixture 已验证、在线未验证”；
- 简历只引用最终评测报告中可复现的数据。
