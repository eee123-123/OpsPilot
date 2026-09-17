# F00 工程基础与本地环境 As-Built Design

> 功能：F00 工程基础与本地环境
> 分支：`feature/f00-engineering-foundation`
> 文档状态：已完成
> 最后更新：2026-09-18

## 1. 业务目标

F00 不实现事故管理等业务能力，而是建立后续 F01～F17 可以复用、可以验证、可以在新环境重建的工程底座。它解决五个问题：统一运行时版本、明确可部署模块、尽早执行质量门禁、提供单机完整环境，以及让开发机和 CI 使用同一组核心命令。

完成后的最小可见结果是：Java 应用可启动并暴露健康检查和 Prometheus 指标；React 页面可显示真实 API 健康状态；PostgreSQL 已启用 pgvector；Prometheus、Grafana、Jaeger 可以随同应用由一个 Compose 项目管理。

## 2. 需求与验收映射

| 来源 | F00 落地方式 |
|---|---|
| FR-INT-006 | 集成依赖通过 `compose.yaml` 或自动化测试复现 |
| 系统设计 7.5 可移植性 | Java 21、Maven Wrapper、Windows PowerShell、Docker Compose |
| 系统设计 7.9 代码质量 | Checkstyle、SpotBugs、JaCoCo、TypeScript strict、ESLint、Vitest、Playwright |
| 系统设计 21.1 可运行性 | README、统一验证脚本、应用健康检查、Compose 一键启动 |
| F00.1 | Maven 多模块、React 工程、应用入口与 ArchUnit 边界测试 |
| F00.2 | 后端和前端质量门禁、CI、跨平台验证脚本 |
| F00.3 | PostgreSQL + pgvector、Prometheus、Grafana、Jaeger、Dockerfile、持久化卷 |
| F00.4 | 本地构建、Compose 配置与运行验收、端口和环境变量文档 |

## 3. 模块边界

- `apps/ops-pilot-api`：未来模块化单体的唯一业务 API 进程；当前只建立启动、数据库迁移和观测基础。
- `apps/ops-pilot-mcp-observability`：独立 MCP 观测服务的部署边界；F00 只提供可启动骨架，不提前实现 F06 协议能力。
- `demo-services/demo-*`：订单、库存、支付三个独立演示进程；故障注入属于 F04，不在 F00 伪造占位接口。
- `web`：React + TypeScript 控制台；F00 页面只负责证明前端构建和真实后端健康连接可工作。
- `infra` 与 `compose.yaml`：本地数据库、指标和 Trace 基础设施；不承载领域逻辑。

`ModuleBoundaryTest` 禁止 `com.opspilot.api..` 依赖 MCP 或 Demo 应用包，为后续模块增长建立最早的一条可执行边界。

## 4. 架构与启动流程

```text
浏览器 :3000
  -> Nginx 静态页面
  -> /api、/actuator 反向代理
  -> ops-pilot-api :8080
       -> PostgreSQL + pgvector :5432
       -> OTLP traces -> Jaeger :4318

Prometheus :9090
  -> 抓取 5 个 Java 应用的 /actuator/prometheus
  -> Grafana :3001 使用预置数据源查询

Jaeger UI :16686
  <- 接收应用 OTLP trace
```

Compose 使用数据库健康状态控制 API 启动顺序，使用 API 健康状态控制 Web 启动顺序。Java 容器通过 readiness endpoint 自检；数据库、Web、Prometheus、Grafana 也提供容器健康检查。PostgreSQL 18 的命名卷挂载在 `/var/lib/postgresql`，符合镜像的版本化数据目录约定；普通 `docker compose down` 不删除 PostgreSQL、Prometheus 和 Grafana 数据。

## 5. 代码导航

| 路径 | 作用 |
|---|---|
| `pom.xml` | Java 21 多模块父工程、依赖与质量插件统一配置 |
| `.mvn/wrapper/maven-wrapper.properties` | 固定 Maven 3.9.16 下载地址 |
| `apps/ops-pilot-api` | API 启动类、H2 上下文测试、ArchUnit 测试和首个 Flyway 迁移 |
| `apps/ops-pilot-mcp-observability` | MCP 服务启动骨架和上下文测试 |
| `demo-services` | 三个可独立运行的 Spring Boot 演示服务骨架 |
| `web/src/App.tsx` | 后端健康状态加载、失败提示和重试交互 |
| `web/src/App.test.tsx` | 加载、成功、失败、重试和非 UP 状态测试 |
| `web/e2e/foundation.spec.ts` | Chromium 页面烟雾测试 |
| `compose.yaml` | 全栈容器、依赖关系、端口、健康检查与卷 |
| `docker/backend.Dockerfile` | Java 模块多阶段构建和非 root 运行镜像 |
| `web/Dockerfile`、`web/nginx.conf` | 前端构建、静态托管和后端反向代理 |
| `infra/prometheus/prometheus.yml` | 5 个 Java 应用抓取目标 |
| `infra/grafana/provisioning` | Prometheus 数据源自动预置 |
| `scripts/verify.ps1`、`scripts/verify.sh` | 本地统一质量命令 |
| `.github/workflows/quality.yml` | 与本地门禁对应的后端、前端和 Compose CI |

## 6. 核心实现讲解

### 6.1 可复现的 Java 工具链

父 POM 使用 Maven Enforcer 将 JDK 限制为 21.x、Maven 限制为 3.9.x。所有模块继承同一套 Spring Boot、测试、Actuator、OpenTelemetry 和 Prometheus 依赖，避免模块各自漂移。Maven Wrapper 让构建不依赖开发机的全局 Maven 版本。API 使用 Spring Boot 4 的 `spring-boot-starter-flyway` 启用迁移自动配置，并保留 PostgreSQL 专用 Flyway 模块。

### 6.2 后端质量门禁

- Checkstyle 在 `validate` 阶段检查生产和测试源码。
- SpotBugs 在 `verify` 阶段以 `Max` effort、`Low` threshold 执行。
- JaCoCo 在 `verify` 阶段要求业务类行覆盖率至少 80%，启动类排除在覆盖率计算外。
- Spring Boot 上下文测试会实际创建 ApplicationContext；API 测试使用内存 H2 并关闭 Flyway，避免普通单元验证依赖本机数据库。
- API 的 Flyway V1 只负责启用 `vector` 扩展，后续已进入 `main` 的迁移不得改写。

F00 目前除启动类外还没有后端业务类，因此 JaCoCo 没有可计入的业务类；80% 门禁会在后续业务类加入后自动生效，不能把 F00 的“门禁通过”解释为已有业务覆盖率。

### 6.3 前端可靠状态

页面不会静态宣称后端可用，而是请求 `/actuator/health`。组件显式建模 `loading`、`up`、`down` 三态，失败时显示原因和重试按钮，并在卸载时通过 `AbortController` 取消请求。单元测试覆盖成功、网络失败后重试、以及 HTTP 成功但业务状态非 `UP` 的情况。

### 6.4 指标与 Trace 分离

所有 Java 服务通过 Prometheus endpoint 暴露拉取式指标。OTLP metrics 显式关闭，避免 Spring Boot 在本地测试时默认向 `localhost:4318` 推送指标；Trace 导出则由 `OTEL_EXPORTER_ENABLED` 控制，本机 Maven 默认关闭，Compose 中开启并将 Collector 基础地址指向 Jaeger。Spring Boot 的 OTLP exporter 会追加 `/v1/traces`，因此变量不重复携带该路径。这使测试没有外部观测依赖，同时完整环境仍能产生 Trace。

### 6.5 安全默认值

仓库只提交 `.env.example` 的无效本地占位密码，真实 `.env` 被忽略。Java 运行镜像使用 UID 10001，前后端镜像均采用构建与运行分离的多阶段构建。Actuator 只暴露 health、info、prometheus；OTLP 日志和指标不会默认外发。

## 7. 实现难点

1. 开发机默认 Java 版本低于 21。解决方式是在被 Git 忽略的 `.tools` 中准备临时 JDK 21，仅用于本次校验；仓库本身仍通过 Enforcer 和 README 要求标准 JDK 21。
2. 前端最新大版本之间存在 peer dependency 和 Node 小版本边界。最终选择相互兼容的 TypeScript、ESLint、jsdom 与相关插件组合，没有使用 `--force` 掩盖冲突。
3. Spring Boot OpenTelemetry starter 会自动提供 OTLP meter registry。通过显式关闭 OTLP metrics，避免测试产生无意义的后台推送，同时保留可配置 Trace。
4. 本机 `DEBUG=release` 环境变量会被 Spring Boot 解释为 debug 开关。Surefire 显式设置 `debug=false`，保证测试输出稳定且不受开发机环境污染。
5. PostgreSQL 18 改用了版本化数据目录。Compose 初始挂载到旧的 `/var/lib/postgresql/data` 会被入口脚本拒绝，最终改为挂载 `/var/lib/postgresql` 并以空卷重新验证初始化。
6. Playwright 官方 Chromium 下载在本机网络下长时间停滞，Microsoft 备用入口又返回 400。配置保留默认锁定浏览器，同时支持通过 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 显式使用兼容的本机 Chrome；本次使用 Chrome 153 完成测试，CI 仍安装 Playwright Chromium。
7. Playwright 最初复用 3000 端口的已有服务，Compose 运行时会掩盖本地 WebServer 参数错误。E2E 现使用独立的 `dev:e2e` 脚本和 4173 端口，并禁止复用已有服务，保证每次都验证当前工作区代码。

## 8. 技术亮点

- 一个父 POM 同时固定工具链、公共依赖和质量生命周期，新模块默认继承门禁。
- Spring 上下文测试验证真实自动配置，不是只调用 `main` 方法的表面测试。
- 前端覆盖率同时限制 line、function、branch、statement 四项，失败和恢复路径均有断言。
- Compose 通过健康条件而非固定 sleep 编排关键依赖。
- Docker 构建递归排除本地 JDK、npm 缓存和生成产物，实测 Java 构建上下文由约 396 MB 降至约 25 KB；JRE 已内置 `curl`，镜像构建不再执行多余的 `apt-get`。
- 本地脚本和 GitHub Actions 使用同一批 Maven/npm/Compose 命令，减少“本地通过、CI 失败”的分叉。
- README 明确端口、变量、保留数据的停止方式，以及具有破坏性的删卷命令边界。

## 9. 替代方案与权衡

| 选择 | 未采用方案 | 权衡 |
|---|---|---|
| Maven 多模块 | 每个服务独立仓库 | 当前单人/小团队场景下统一版本和门禁更重要 |
| 模块化单体 API | 立即拆分全部微服务 | 保留清晰边界，同时降低本地资源和分布式复杂度 |
| PostgreSQL + pgvector | 独立向量数据库 | 少一个中间件并可与业务事务共同管理 |
| Prometheus 拉取指标 | 默认 OTLP 推送全部遥测 | 本地行为更可控；Trace 仍使用 OTLP |
| Docker Compose | Kubernetes | 满足单机演示与复现目标，不引入超出范围的运维平台 |
| Nginx 同源代理 | 浏览器直连多个端口 | 避免生产容器的 CORS 配置分叉 |

## 10. 安全、失败与恢复

- 配置：真实密钥不入 Git；示例密码仅允许本地使用。
- 数据：普通停止保留命名卷；只有明确需要清空数据时执行 `docker compose down --volumes`。
- 启动：API 等待数据库健康，Web 等待 API 健康；失败服务可通过 `docker compose ps` 和 `docker compose logs <service>` 定位。
- 请求：前端健康请求支持取消、错误展示和人工重试。
- 观测：Trace 导出失败不应阻止应用启动；指标使用本地拉取，不产生默认外发。
- 回滚：F00 尚无业务数据迁移；V1 只创建 pgvector 扩展。功能尚未合并时可直接在功能分支修正，不改写 `main` 历史。

本次分支验收结束后已执行普通 `docker compose down`，所有 F00 容器与项目网络均已移除，命名卷保留。

## 11. 测试证据

| 命令 | 结果 |
|---|---|
| `mvnw.cmd -B -ntp verify`（JDK 21） | 通过；6 个测试通过，5 个模块上下文成功启动，Checkstyle 0、SpotBugs 0、JaCoCo 门禁通过 |
| `npm run lint` | 通过；0 warning |
| `npm run format:check` | 通过 |
| `npm run test` | 通过；3 个测试，line 91.3%、branch 81.25%、function 100%、statement 92% |
| `npm run build` | 通过；TypeScript build 与 Vite production build 成功 |
| `docker compose config --quiet` | 通过 |
| `npm run test:e2e` | 通过；使用 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` 指向本机 Chrome 153，Playwright Chromium 项目 1/1 通过 |
| `docker compose --progress plain build` | 通过；API、MCP、三个 Demo 服务和 Web 共 6 个应用镜像构建成功 |
| `docker compose up -d` 与全栈健康检查 | 通过；10 个服务运行，9 个声明 healthcheck 的容器均 healthy；5 个 Java readiness 为 UP，Web/Grafana/Jaeger 可访问 |
| PostgreSQL/Flyway 检查 | 通过；pgvector 0.8.6，Flyway V1 `enable vector extension` 成功 |
| Prometheus targets 检查 | 通过；API、MCP 和三个 Demo 服务共 5 个 target 均为 UP |

失败但已修复的记录：SpotBugs Maven 插件的错误版本号导致首次解析失败；TypeScript 7、ESLint 10、jsdom 30 与当前插件或 Node 版本不兼容；Vitest 首次误收集 Playwright 测试；PostgreSQL 18 使用旧卷挂载路径导致容器重启；Spring Boot 4 缺少 Flyway starter 导致迁移未运行；OTLP endpoint 重复追加 `/v1/traces` 导致 404；Prettier 扫描生成产物导致门禁受执行顺序影响；Playwright WebServer 曾被 3000 端口上的 Compose Web 掩盖，停服复核时暴露出 npm 参数解析问题，改用独立 4173 端口并禁用服务复用后通过。修复均通过正确依赖、配置或忽略边界完成，没有跳过门禁。

## 12. 调试方法

```powershell
# 确认工具链
java -version
.\mvnw.cmd -version
node --version
docker info

# 后端
.\mvnw.cmd -pl apps/ops-pilot-api -am test

# 前端
Set-Location web
npm run test
npm run test:e2e

# 完整环境
docker compose config --quiet
docker compose up --build -d
docker compose ps
docker compose logs ops-pilot-api
```

诊断顺序建议：先检查 `docker compose ps` 的健康状态，再查看最早失败的依赖日志；API 启动失败先看 PostgreSQL 和 Flyway，Web 显示不可用先直接访问 API health，然后检查 Nginx 同源代理。

## 13. 常见问题

- Enforcer 提示 JDK 版本不符：修正 `JAVA_HOME` 和当前 shell 的 `PATH`，不要绕过规则。
- Playwright 找不到浏览器：在 `web` 执行 `npx playwright install chromium`。
- Playwright 下载受网络限制：确认本机 Chrome/Chromium 与 Playwright 期望主版本兼容后，临时设置 `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH`；不要在 CI 中跳过浏览器安装。
- 端口占用：检查 3000、3001、5432、8080～8083、8090、9090、16686、4317、4318；不要静默改动仓库默认端口后提交。
- API 本机启动无法连接数据库：先启动 Compose PostgreSQL，或仅运行使用 H2 的自动化测试。
- Trace 页面为空：确认 Compose 中 `OTEL_EXPORTER_ENABLED=true`、endpoint 指向 Jaeger，并实际访问过应用。

## 14. 面试问题

1. 为什么 Maven Wrapper 与 Enforcer 需要同时存在？
2. 为什么上下文测试比调用启动类更有价值？
3. 为什么 OTLP metrics 和 OTLP traces 要独立控制？
4. Compose 的 `service_started` 与 `service_healthy` 有什么区别？
5. 为什么容器健康检查不应使用长时间固定 sleep？
6. 为什么启动类通常不计入覆盖率，而业务类不能随意排除？
7. Nginx 同源代理相比浏览器跨域直连有什么优势？
8. 命名卷给本地恢复带来什么价值，又有什么数据清理风险？

## 15. 实践练习

1. 新增一个最小 Java 业务类和测试，观察 JaCoCo 80% 门禁如何生效。
2. 临时破坏 API 到 Demo 包的依赖方向，验证 ArchUnit 能阻止构建，然后撤销实验。
3. 停止 API 容器，观察 Web 错误状态；恢复后使用按钮重试。
4. 查询 Prometheus targets，确认 5 个 Java endpoint 均为 UP。
5. 触发一次 HTTP 请求，在 Jaeger 中按服务名查询 Trace。
6. 执行普通 `down` 后重启，验证数据卷保留；不要在有价值数据上练习删卷。

## 16. 简历表达

可基于真实实现描述为：

> 从零搭建 Java 21 + Spring Boot 多模块、React + TypeScript 的可复现工程底座，统一 Maven/npm/CI 质量门禁，引入 PostgreSQL + pgvector 与 Prometheus/Grafana/Jaeger 单机 Compose 环境；通过真实 Spring 上下文、ArchUnit、静态分析、覆盖率及 Playwright 烟雾测试建立后续智能运维功能的持续交付基线。

不要宣称 F00 已实现事故诊断、MCP 协议、故障注入或 Agent 能力；这些属于后续功能。未经规模测试也不要声称性能提升比例。
