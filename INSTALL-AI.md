# INSTALL-AI.md — WorkBuddy 小队模式安装指令（供 AI 执行）

> **给 WorkBuddy AI 的说明**：你的用户收到了一个分享包，要在**你的 WorkBuddy** 上安装"小队模式"（workbuddy-team-mode）。请严格按照本文档完成安装、一次性选型和验证。本包依据 WorkBuddy 官方规范制作（open.workbuddy.cn/docs/skill、/docs/expert、/docs/expert-team）。安装对象是用户数据（技能与专家团），复制/导入前若目标已存在同名内容，先向用户报告，不要静默覆盖。

## 一、包内容清单

```text
workbuddy-share/
├── README-FIRST.md              # 给用户本人看的快速说明（无需你处理）
├── PROMPT-TO-SEND.md            # 用户可复制给你的提示词（无需你处理）
├── INSTALL-AI.md                # 本文档
├── scripts/
│   ├── make-avatars.cjs         # 头像生成脚本（头像已随包附带，一般不用重跑）
│   └── check-package.cjs        # 打包结构自检脚本（安装前先跑）
├── skill/                       # 技能本体 → 导入为技能 workbuddy-team-mode
│   ├── SKILL.md
│   └── references/
│       ├── runtime.md
│       ├── roles.md
│       ├── model-menu.md
│       └── team-config.template.md
└── experts/                     # 专家团（expertType: team）
    ├── .codebuddy-plugin/plugin.json
    ├── avatars/                 # 6 个 PNG（team/team-lead + 4 角色）
    └── agents/                  # 5 个角色定义（1 主理人 + 4 成员）
```

## 二、前置检查（只读，先全部执行再动手）

1. **解压定位**：若用户给的是 zip，先解压到用户工作目录，确认 `INSTALL-AI.md`（本文件）与 `skill/`、`experts/` 同级存在。
2. **跑结构自检**：运行 `node scripts/check-package.cjs`（在包根目录执行）。预期全部 PASS。若有 FAIL，**停下来**，把 FAIL 项报告给用户并向分享者反馈，不要继续安装残缺的包。
3. **确认 WorkBuddy 安装入口**：WorkBuddy 的技能/专家通过侧边栏"专家·技能·连接器"导入；技能支持本地 zip 上传（"导入后系统将自动完成配置"）。若你的 WorkBuddy 界面与此描述不符，以实际界面为准，并向用户说明你采用的导入路径。
4. **检查是否已安装**：查看技能列表是否已有 `workbuddy-team-mode`、专家列表是否已有"小队模式"。任一命中即视为已安装或残留：向用户展示现状，确认是覆盖更新还是放弃，不要直接删除。

## 三、安装步骤

### 步骤 1：导入技能本体

将 `skill/` 目录打包为 zip（或直接用解压出的目录），以"上传技能/导入技能"的方式导入，使 WorkBuddy 技能列表出现 **workbuddy-team-mode**。导入后确认 `SKILL.md` 的 frontmatter 被正确解析（name/description/description_zh/description_en/version/author 齐全；若界面只显示部分字段，记录实际显示结果）。

### 步骤 2：导入专家团

将 `experts/` 目录打包为 zip（**注意 zip 内需包含 `.codebuddy-plugin/plugin.json`**；打包 zip 时不要漏掉以点开头的隐藏目录，例如 `Compress-Archive` 默认会包含，但部分工具默认排除隐藏文件，打包后请用 `node scripts/check-package.cjs` 或解压验证确认 `.codebuddy-plugin` 在包内），以导入专家/专家团的方式导入。导入后确认专家团列表出现"**小队模式**"团队，且包含 5 个成员：主理人、探索、执行、评审、专家顾问。

若 WorkBuddy 界面只支持导入"单个专家"不支持"专家团"：先尝试直接导入整个 experts zip；不行则向用户说明该限制，改为导入 4 个成员角色（agents/team-*.md 各自作为独立专家），并在汇报中注明"专家团形态未生效，小队编排规则由技能 SKILL.md 承载"。

### 步骤 3：一次性角色模型选型（安装的必选环节，只做一次）

1. 检查分享包内 `skill/references/` 下是否已有 `team-config.md`（分享者预生成的情况；正常新安装应为无）。若用户环境此前装过本技能，同时检查已安装技能的 references 目录。
2. 读取包内 `skill/references/model-menu.md`，在**同一条回复**里向用户完整展示：
   - A. 供应商与模型罗列表（国内版 / 国际版 / 自定义模型分组）；
   - B. 思考强度罗列表（Default / Fast / Balanced / Primary / Deep 五档）；
   - C. 四角色推荐表（均衡档 / 经济档 / 顶配档三套整体方案 + 单角色微调）。
3. 给出你的推荐（默认方案一"均衡档"），请用户选择整体方案、决定是否微调个别角色，然后列出最终四角色组合请用户确认。
4. 用户确认后，按 `skill/references/team-config.template.md` 生成 `team-config.md`，保存在技能 references 目录下（即与 model-menu.md 同目录；若技能安装后 references 不可直接落盘，就保存在用户工作目录下并在配置里记录实际路径），所有 `<待填：…>` 占位符全部替换。
5. 向用户复述最终配置并说明：**这是一次性初始化，之后每次使用小队模式都直接读这份配置，不会再问**。

### 步骤 4：验证

1. 重新运行 `node scripts/check-package.cjs`，确认仍全部 PASS（此时包内多了生成的 team-config.md，不影响校验）。
2. 在新聊天里单独一行发送 `开启小队模式`，确认回复以 `👾 已开启小队模式` 开头，且你能按小队规则派发四个角色。
3. 若环境允许，做一次最小派发验证：以探索角色问一个只读定位问题，确认能通过 AgentTool（`name` 参数）派发并收到结构化回复。派发失败时如实报告，不得谎称通过。

## 四、完成后告知用户

1. 已导入的技能与专家团清单、team-config.md 的实际保存路径；
2. **这是新聊天/重启后生效的配置**（如界面提示需要刷新或重启，按提示操作）；
3. 使用口令：`开启小队模式`（或 `$workbuddy-team-mode`）启用，`退出小队模式` 退出，`查看小队状态` 查询；
4. 角色模型是一次性选型写入了 team-config.md；以后每次用直接读配置。如实告知平台限制：WorkBuddy 不支持按成员固定模型，配置是"意图记录 + 派发声明 + UI 档位建议"；如需硬性固定模型/档位，引导用户在 UI 的模型下拉与思考档位选择器手动设置。

## 五、故障排查

| 现象 | 处理 |
|---|---|
| 步骤 2 自检有 FAIL | 不要继续安装；把 FAIL 原文报告给用户和分享者（可能是包在传输中损坏或打包漏了隐藏目录） |
| 技能导入后列表里看不到 | 确认 zip 内根目录就是 `skill/` 的内容或按界面要求调整结构；确认 SKILL.md frontmatter 必填字段齐全（description/description_zh/description_en/version/author） |
| 专家团导入后成员缺失 | 确认 zip 内 `.codebuddy-plugin/plugin.json` 存在且 `agents[]` 五个路径都能对应到 `agents/` 下文件；`members[]` 的 id 须与文件名一一对应，`avatar` 指向的文件须存在 |
| plugin.json 字段校验报错 | 按官方规范核对：expertType 须为 `"team"`；displayDescription.zh 须 40-50 字；tags 与 quickPrompts 各恰好 3 个且每个有 en/zh；defaultInitPrompt 须与 quickPrompts[0] 完全一致；主理人 md 文件名须以团队名前缀开头 |
| 发送口令无反应 | 确认技能已导入且在新聊天生效；确认口令单独占一行（不是句子中间提到）；把完整 prompt 原文发给 WorkBuddy 自检 |
| 派发成员失败 | 确认专家团已导入；派发须用内置 AgentTool 且 `name` 参数传成员中文角色名（探索/执行/评审/专家顾问）；把失败原文报告给用户 |
| team-config.md 写不进去技能目录 | 保存在用户工作目录，并在 team-config.md 里记录实际路径；以后每次读取按该路径 |

## 六、卸载（仅在用户要求时执行）

1. 在侧边栏"专家·技能·连接器"中删除/停用"小队模式"专家团与 workbuddy-team-mode 技能；
2. 删除生成的 `team-config.md`；
3. 向用户确认删除结果，不要动用户的其他技能和专家。
