# 下一次会话

## 当前状态（2026-09-19）

F02 前端框架与统一体验已完成实现、分支内测试和 As-Built 文档，当前处于 `待合并`；本次会话已获得明确授权，将提交并推送 F02 分支，以 `--no-ff` 合并到 `main`，完成合并后验证和状态回写。

| 项目 | 值 |
|---|---|
| 已完成 | F00 工程基础、F01 登录与 RBAC |
| 当前功能 | F02 前端框架与统一体验（待本次合并） |
| 当前分支 | `feature/f02-frontend-foundation` |
| 分支基线 | 本地最新 `main`：`fe97a0c` |
| 分支内验收 | Vitest 25 项、ESLint、Prettier、TypeScript/Vite、Playwright、全仓 Maven `verify`、Compose 运行态均通过 |
| 学习文档 | `docs/learning/F02-frontend-foundation.md`（已完成） |
| 当前环境 | 已按用户要求关闭；Compose 数据卷保留 |
| 阻塞 | 无 |

## 合并完成后的下一会话提示词

> 先在 `main` 上确认 F02 合并后环境与核心前端流程正常；验证通过后，从最新 `main` 创建 `feature/f03-incident-management`，开始 F03 告警与事故管理开发。

## 后续关注事项

- F02 生产构建通过，但 Ant Design 所在初始 JavaScript chunk 约 1.12 MB（gzip 约 352.73 kB），超过 Vite 默认警戒线；它不阻塞 F02 验收，后续真实业务页面增长前应进行路由级代码拆分；
- 仓库外层目录 `D:\code\VScode\.vscode\settings.json` 为用户现有未跟踪文件，不属于 `ops-pilot` 仓库，本次不得提交；
- 默认真实 API Playwright 场景需要隔离数据库并显式设置 `E2E_LIVE=true`，日常回归保持跳过，避免修改保留中的本地管理员与用户数据；
- Docker 构建阶段若 `npm ci` 遇到 registry 网络重置，应保留已有数据卷并重试，不要在无备份时删除 volumes。

## 历史提示词

F00、F01 与 F02 的启动提示词及执行证据保留在 Git 历史、`docs/development-progress.md` 和对应学习文档中，不再重复列出。
