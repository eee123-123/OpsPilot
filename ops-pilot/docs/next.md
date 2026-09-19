# 下一次会话

## 当前状态（2026-09-19）

F02 前端框架与统一体验已完成实现、验收、远程分支推送、`main` 合并和合并后验证，实施状态为 `已完成`。下一阶段按用户要求优先改进项目文档，不启动运行环境，也暂不开始 F03。

| 项目 | 值 |
|---|---|
| 已完成 | F00 工程基础、F01 登录与 RBAC、F02 前端框架与统一体验 |
| 当前工作 | 基于当前实现继续改进文档、导航与跨文档一致性 |
| 当前分支 | `main` |
| F02 功能提交 | `00d60f5`，已推送到 `origin/feature/f02-frontend-foundation` |
| F02 合并提交 | `c1fc8fe`（`--no-ff`），已推送到 `origin/main` |
| 分支内验收 | Vitest 25 项、ESLint、Prettier、TypeScript/Vite、Playwright、全仓 Maven `verify`、Compose 运行态均通过 |
| 合并后验证 | ESLint、TypeScript/Vite 构建、Vitest 25 项、Playwright 2 项通过；真实 API 场景按设计跳过 |
| 学习文档 | `docs/learning/F02-frontend-foundation.md`（已完成） |
| 当前环境 | 已按用户要求关闭；Compose 数据卷保留 |
| 阻塞 | 无 |

## 下一会话提示词

> 基于最新 `main` 继续改进 OpsPilot 文档：以实际代码和已完成的 F00～F02 为准，系统检查 README、系统设计、实施计划、开发进度、next、OpenAPI 和学习文档的导航、重复、缺失与不一致；只修改文档，不启动前后端或 Docker 环境，不开始 F03。完成后执行链接、路径、状态词、`git diff --check` 和新增文件检查，并停在人工 Git 审查卡点。

## 后续关注事项

- F02 生产构建通过，但 Ant Design 所在初始 JavaScript chunk 约 1.12 MB（gzip 约 352.73 kB），超过 Vite 默认警戒线；它不阻塞 F02 验收，后续真实业务页面增长前应进行路由级代码拆分；
- 仓库外层目录 `D:\code\VScode\.vscode\settings.json` 为用户现有未跟踪文件，不属于 `ops-pilot` 仓库，本次不得提交；
- 默认真实 API Playwright 场景需要隔离数据库并显式设置 `E2E_LIVE=true`，日常回归保持跳过，避免修改保留中的本地管理员与用户数据；
- Docker 构建阶段若 `npm ci` 遇到 registry 网络重置，应保留已有数据卷并重试，不要在无备份时删除 volumes。

## 历史提示词

F00、F01 与 F02 的启动、实现、测试和合并证据保留在 Git 历史、`docs/development-progress.md` 和对应学习文档中，不再重复列出。
