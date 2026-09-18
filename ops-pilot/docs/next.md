# 下一次会话

## 当前状态（2026-09-18）

F01 登录、用户与 RBAC 已实现、验证并合并到 `main`，实施状态 `已完成`。

| 项目 | 值 |
|---|---|
| 已完成 | F00 工程基础、F01 登录与 RBAC |
| 当前功能 | F01（下一会话开始前切到 F02） |
| 当前分支 | `main` |
| F01 合并提交 | `4a532c6`（`--no-ff`），已推送 |
| 远程分支 | `origin/feature/f01-identity-rbac` 保留，未删除 |
| 合并后验证 | CI run `35349477626` 通过（backend、frontend、compose 三个 job） |
| 学习文档 | `docs/learning/F01-identity-rbac.md`（已完成） |
| 阻塞 | 无 |

## 下一会话提示词

> 请先完整阅读仓库根目录 `AGENTS.md`、`docs/system-design.md`、`docs/implementation-plan.md`、`docs/development-progress.md`、`docs/learning/F01-identity-rbac.md`、`docs/learning/README.md` 和 `docs/next.md`，确认 F01 已合并到 `main`（merge commit `4a532c6`），实施状态为 `已完成`。
>
> 在开始新功能之前，先启动全部环境验证 F01 的功能完备性：
>
> 1. 确认 Docker Engine 可用，执行 `docker compose -p ops-pilot-f01-test up -d --build --wait --wait-timeout 300`；核对服务启动数量、声明 healthcheck 的容器是否 healthy，以及 Web、5 个 Java readiness、Prometheus targets、Grafana health 和 Jaeger UI 的返回；
> 2. 用真实后端走一遍 F01 主流程：管理员首次登录强制改密 → 创建 VIEWER → VIEWER 首次登录改密 → 确认前端隐藏管理入口并拦截 `/users` 深链 → 确认 VIEWER 直接请求 `/api/v1/users` 被后端 403 拒绝；
> 3. 查询 `audit_log`，核对 LOGIN、LOGOUT、PASSWORD_CHANGE、USER_CREATED、AUTHORIZATION_FAILURE 事件存在，并确认审计中没有明文密码；
> 4. 在 `web` 下执行 `$env:E2E_LIVE='true'; npm run test:e2e -- e2e/identity-live.spec.ts`；
> 5. 检查容器日志没有 error 级记录或异常堆栈；
> 6. 结束后执行 `docker compose -p ops-pilot-f01-test down -v`，删除本次隔离的容器、网络和数据卷。
>
> 以上任一项失败时，不要直接在 `main` 上修复：先报告缺陷、复现步骤和影响范围，等我确认后回到功能分支处理，并按 `AGENTS.md` 把 F01 状态降级。
>
> 全部通过后，开始 F02 前端框架与统一体验开发：从最新 `main` 创建 `feature/f02-frontend-foundation`，按实现计划的 F02.1～F02.4 更新状态后开发和验证。F02 要在 F01 已建立的登录态、四角色权限和 API 客户端之上构建统一前端框架，不要重新实现 F00 的工程基础或 F01 的身份能力。
>
> 最后把本次实际执行的命令和结果写入 `docs/development-progress.md`。

## 遗留事项

- 仓库根目录 `d:\code\VScode` 下存在未跟踪的 `.vscode/settings.json`（内容只有 `java.compile.nullAnalysis.mode`）。`ops-pilot/.gitignore` 的 `.vscode/` 规则不覆盖仓库根，仓库根目前也没有 `.gitignore`。按 `AGENTS.md` 的产物规范，建议在仓库根新增 `.gitignore` 并写入 `.vscode/`，而不是提交该文件；
- `docs/implementation-plan.md` 的 F01 状态块使用了 Markdown 行尾双空格硬换行，因此 `git diff --check` 会对这几行报 `trailing whitespace`。这是该文件绝大多数状态块的统一写法，CI 不校验此项；如需彻底统一，单独提交处理，不要混进功能提交。

## 历史提示词

F00 与 F01 的启动提示词已执行完毕，保留在 Git 历史与 `docs/development-progress.md` 的会话记录中，不再重复列出。
