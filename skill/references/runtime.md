# 运行机制与维护

## 组成与安装位置

小队模式由两部分组成：

1. **技能本体**（本目录）：安装到 WorkBuddy 的技能目录（按用户实际平台，社区通行位置为 `~/.workbuddy/skills/workbuddy-team-mode/`；以 WorkBuddy 实际导入方式为准，见 INSTALL-AI.md）。
2. **专家团**（`experts/`）：按 WorkBuddy 开放平台规范打包（`.codebuddy-plugin/plugin.json` + `agents/*.md` + `avatars/`），通过侧边栏"专家·技能·连接器"上传 zip 导入，或由 WorkBuddy AI 按 INSTALL-AI.md 的指引完成导入。

技能与专家团是两份独立产物：技能定义小队规则（启用口令、派发规则、选型流程），专家团提供四个可派发角色。两者都要安装，缺一小队模式不完整。

## 角色注册与派发

- 四个角色 + 主理人通过 `experts/agents/*.md` 注册，`plugin.json` 的 `expertType: "team"`、`teamInfo.leadAgent`、`teamInfo.memberAgents` 声明团队结构；主理人 md 文件名须以团队名前缀开头（`workbuddy-team-mode-team-lead.md`）。
- 派发：主 Agent 调用内置 **AgentTool**，在 `name` 参数中传入成员中文角色名（探索 / 执行 / 评审 / 专家顾问）。WorkBuddy 的派发参数是 `name`，不是 `subagent_type`；工具名是 `AgentTool`，不是 `Agent`/`Task`。
- 成员 frontmatter 只有 `name`、`description`、`displayName{en,zh}`、`profession{en,zh}`、`maxTurns`、`skills`；**没有** `model`/`thoughtLevel` 字段，工具权限由系统统一分配。角色模型意图见 `references/model-menu.md` 与 `references/team-config.md`。

## 启用状态与钩子

- 本分享包**不注册 hook**。WorkBuddy 官方文档（腾讯云 product/1831 文档目录、open.workbuddy.cn）未提供 UserPromptSubmit/PreToolUse 之类事件钩子；WorkBuddy 的"自动化"是定时任务，不是事件钩子。
- 因此启用/退出依赖**口令约定 + 技能约定**：用户在单独一行输入 `$workbuddy-team-mode` / `开启小队模式` 即视为启用；主 Agent 按 SKILL.md 的"启用与退出"一节执行（输出 `👾 已开启小队模式` 等）。这是软约束，不是 hook 强制拦截——如果发现你的 WorkBuddy 版本支持 hook 或类似机制，可另行加固，但不要在未确认时声称 hook 已生效。
- 每个聊天的启用状态由会话上下文维护，任务完成不会自动退出。

## 角色模型配置

- 选型菜单：`references/model-menu.md`（仅在 `references/team-config.md` 缺失或损坏时读取）。
- 配置模板：`references/team-config.template.md`；选型结果写入 `references/team-config.md`（一次性初始化，之后直接读取，不重复询问）。
- 平台不支持按成员固定模型，详见 model-menu.md 的"平台限制"一节；不得向用户暗示配置会强制固定模型。

## 卸载

仅在用户要求时执行：删除已安装的技能目录、删除导入的专家团（专家团一般可在侧边栏"专家·技能·连接器"中删除/停用）、删除 `references/team-config.md`。

## 适配与维护

本包的机制依据为 2026-10 的 WorkBuddy 官方文档（open.workbuddy.cn/docs/skill、/docs/expert、/docs/expert-team 与腾讯云文档）。WorkBuddy 迭代较快：若导入失败或字段校验不通过，先核对官方文档的 plugin.json 与 frontmatter 规范是否变更，再修改本包；不要照搬 ZCode 的参数（ZCode 用 `Agent`/`Task` 工具、`subagent_type` 参数、model/thoughtLevel frontmatter 与 hook，这些在 WorkBuddy 均不存在）。
