# OpsPilot 模块学习文档索引

本目录保存基于最终代码生成的模块学习文档。学习文档是每个一级功能 Definition of Done 的组成部分，不是可选交付物。

## 状态说明

| 状态 | 含义 |
|---|---|
| 未生成 | 功能尚未进入文档阶段 |
| 草稿 | 已建立结构，但功能实现或验证尚未完成 |
| 待校验 | 内容已经编写，正在核对代码路径和测试证据 |
| 已完成 | 内容与最终实现一致，并已通过文档验收 |

## 文档矩阵

| 功能 | 模块 | 学习文档 | 状态 |
|---|---|---|---|
| F00 | 工程基础与本地环境 | `F00-engineering-foundation.md` | 已完成 |
| F01 | 登录、用户与 RBAC | `F01-identity-rbac.md` | 已完成 |
| F02 | 前端框架与统一体验 | `F02-frontend-foundation.md` | 未生成 |
| F03 | 告警与事故管理 | `F03-incident-management.md` | 未生成 |
| F04 | 示例微服务与故障注入 | `F04-demo-services-fault-injection.md` | 未生成 |
| F05 | 工具注册与本地工具 | `F05-tool-registry.md` | 未生成 |
| F06 | MCP Client/Server | `F06-mcp-client-server.md` | 未生成 |
| F07 | Policy、审批与审计 | `F07-policy-approval-audit.md` | 未生成 |
| F08 | 多模型网关 | `F08-model-gateway.md` | 未生成 |
| F09 | Agent Runtime 与可靠执行 | `F09-agent-runtime.md` | 未生成 |
| F10 | Agent Skill 体系 | `F10-agent-skills.md` | 未生成 |
| F11 | RAG 知识库 | `F11-rag-knowledge-base.md` | 未生成 |
| F12 | 诊断、验证、处置与复盘闭环 | `F12-diagnosis-remediation.md` | 未生成 |
| F13 | 实时事件与站内通知 | `F13-realtime-notifications.md` | 未生成 |
| F14 | Agent Eval 与反馈闭环 | `F14-agent-evaluation.md` | 未生成 |
| F15 | 可观测性与运行状态 | `F15-observability.md` | 未生成 |
| F16 | 导出、备份、恢复与数据重置 | `F16-data-operations.md` | 未生成 |
| F17 | 安全、性能、全量回归与发布 | `F17-release-quality.md` | 未生成 |

## 更新要求

- Agent 在功能测试通过后自动创建或更新对应文档；
- 文档状态变化时同步更新本表；
- 文件尚未创建时只显示文件名，不创建没有实际内容的占位文档；
- 后续代码修改影响模块行为时，重新校验并更新学习文档；
- 每份文档的内容要求以仓库根目录 `AGENTS.md` 为准。
