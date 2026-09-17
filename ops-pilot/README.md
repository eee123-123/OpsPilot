# OpsPilot

OpsPilot 是一个面向微服务故障的智能诊断与应急处置平台。本仓库当前首先提供可复现的工程基础：Java 21 模块化后端、React + TypeScript 前端、PostgreSQL + pgvector，以及 Prometheus、Grafana、Jaeger 本地观测栈。

## 环境要求

- JDK 21；
- Node.js 22（最低 22.13，低于 23）；
- Docker Engine / Docker Desktop；
- Docker Compose；
- PowerShell 7 或兼容的 POSIX Shell。

项目固定使用 Maven Wrapper 3.9.16，不依赖全局 Maven。默认测试和演示不需要任何模型 API Key。

## 快速启动

复制本地配置并按需修改占位密码：

```powershell
Copy-Item .env.example .env
docker compose up --build -d
docker compose ps
```

启动完成后访问：

| 服务 | 地址 | 用途 |
|---|---|---|
| OpsPilot Web | <http://localhost:3000> | 产品前端 |
| OpsPilot API | <http://localhost:8080> | 核心后端 |
| API Health | <http://localhost:8080/actuator/health> | 后端健康状态 |
| MCP Observability | <http://localhost:8090/actuator/health> | MCP 服务骨架健康状态 |
| Demo Order | <http://localhost:8081/actuator/health> | 订单示例服务 |
| Demo Inventory | <http://localhost:8082/actuator/health> | 库存示例服务 |
| Demo Payment | <http://localhost:8083/actuator/health> | 支付示例服务 |
| Grafana | <http://localhost:3001> | 指标可视化 |
| Prometheus | <http://localhost:9090> | 指标查询 |
| Jaeger | <http://localhost:16686> | Trace 查询 |
| PostgreSQL | `localhost:5432` | 业务数据与 pgvector |

停止服务但保留数据：

```powershell
docker compose down
```

只有明确需要清空本地数据时才执行 `docker compose down --volumes`。

## 本地开发

后端：

```powershell
java -version
.\mvnw.cmd test
.\mvnw.cmd verify
```

如果 `java -version` 不是 21，请先把 `JAVA_HOME` 和 `PATH` 指向 JDK 21。项目的 Maven Enforcer 会拒绝错误的 JDK，避免产生不可复现构建。

前端：

```powershell
Set-Location web
npm ci
npx playwright install chromium
npm run dev
npm run lint
npm run test
npm run build
npm run test:e2e
```

Playwright 官方浏览器下载受网络限制时，可以显式使用兼容的本机 Chromium/Chrome；CI 仍使用锁文件对应的 Playwright Chromium：

```powershell
$env:PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH='C:\Program Files\Google\Chrome\Application\chrome.exe'
npm run test:e2e
```

在仓库根目录执行统一质量命令：

```powershell
.\scripts\verify.ps1
```

Linux/macOS 使用：

```bash
./scripts/verify.sh
```

## 配置

| 变量 | 默认值 | 说明 |
|---|---|---|
| `POSTGRES_DB` | `ops_pilot` | PostgreSQL 数据库名 |
| `POSTGRES_USER` | `ops_pilot` | PostgreSQL 用户 |
| `POSTGRES_PASSWORD` | `local-only-change-me` | 仅限本地的占位密码，非真实密钥 |
| `GRAFANA_ADMIN_USER` | `admin` | Grafana 本地管理员 |
| `GRAFANA_ADMIN_PASSWORD` | `local-only-change-me` | Grafana 本地占位密码 |
| `DB_URL` | `jdbc:postgresql://localhost:5432/ops_pilot` | API 数据库连接 |
| `DB_USER` | `ops_pilot` | API 数据库用户 |
| `DB_PASSWORD` | `local-only-change-me` | API 数据库密码 |
| `OTEL_EXPORTER_ENABLED` | `false` | 本地 Maven 启动时是否导出 Trace |
| `OTEL_EXPORTER_OTLP_ENDPOINT` | `http://localhost:4318` | OTLP HTTP Collector 基础地址（应用追加 `/v1/traces`） |
| `TRACING_SAMPLING_PROBABILITY` | `1.0` | 本地 Trace 采样率 |
| `VITE_API_BASE_URL` | 空 | 前端 API 基址；空值使用同源代理 |

`.env`、日志、构建产物、测试报告和本地数据不会进入 Git。提交的 `.env.example` 只包含无效的本地占位值。

## 工程结构

```text
apps/ops-pilot-api                 Spring Boot 模块化单体入口
apps/ops-pilot-mcp-observability   MCP Observability 独立服务入口
demo-services/                     三个可控示例服务入口
web/                               React + TypeScript 前端
infra/                             Prometheus 与 Grafana 配置
docker/                            后端容器构建定义
config/checkstyle/                 Java 代码规范
scripts/                           跨平台质量验证脚本
docs/                              设计、计划、进度和学习文档
```

业务模块只能通过明确的应用服务、领域接口或事件协作。`ops-pilot-api` 不得依赖 MCP 或示例服务的内部代码，ArchUnit 在构建中验证这一边界。

## 质量门禁

- Maven Enforcer：JDK 21 与 Maven 3.9.x；
- Checkstyle 与 SpotBugs；
- JaCoCo 行覆盖率不低于 80%；
- ArchUnit 模块依赖测试；
- TypeScript strict、ESLint、Prettier；
- Vitest 覆盖率门禁；
- Playwright Chromium 冒烟测试；
- `docker compose config` 配置校验；
- GitHub Actions 使用与本地相同的命令。

详细产品范围见 [系统设计](docs/system-design.md)，实施顺序见 [实现计划](docs/implementation-plan.md)，当前事实见 [开发进度](docs/development-progress.md)。
