<div align="center">

# 👾 WorkBuddy 小队模式

**一条口令，让你的 WorkBuddy 变成一支四人专业团队**

[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Platform](https://img.shields.io/badge/platform-WorkBuddy-5B5BD6.svg)](https://workbuddy.cn)
[![Self-Check](https://img.shields.io/badge/structure%20check-32%2F32%20PASS-16A34A.svg)](scripts/check-package.cjs)
[![Version](https://img.shields.io/badge/version-1.0.0-D97706.svg)](experts/.codebuddy-plugin/plugin.json)

*主理人拆解任务 · 探索定位 · 执行实现 · 评审把关 · 专家顾问攻坚*

</div>

---

## 这是什么

**WorkBuddy 小队模式**是一个分享包：装进你的 [WorkBuddy](https://workbuddy.cn)（腾讯桌面 AI 办公工作台）后，只要在聊天里发一句口令，你当前的 WorkBuddy 就会化身为一支分工明确的小队——

主理人（就是你的 WorkBuddy 自己）负责拆解任务和验收，再把子任务派给四个专职角色：

| 角色 | 职责 | 什么时候被派 |
|---|---|---|
| 🔍 **探索** | 只读定位文件、入口、调用关系 | 面对大型代码库，需要先摸清结构 |
| ⚡ **执行** | 在明确文件归属内实现并验证 | 需求明确，要动手改代码 |
| ✅ **评审** | 独立只读评审稳定产物 | 改动完成，需要有证据的把关 |
| 🎓 **专家顾问** | 复杂决策、疑难诊断 | 架构选择、疑难 bug、复杂建模 |

一条口令开启，任务完成不退出；`退出小队模式` 随时关闭。

## 三步上手

```text
① 解压本仓库（或直接把 zip 发给 WorkBuddy）
        ↓
② 打开 PROMPT-TO-SEND.md，复制提示词发给你的 WorkBuddy
        ↓
③ 跟着引导完成一次性角色模型选型
        ↓
  以后每次：单独一行发「开启小队模式」即可
```

安装全程由你的 WorkBuddy 自己完成：导入技能本体 → 导入专家团 → 跑结构自检 → 带你做模型选型。你几乎不用动手。

> 📖 首次使用请读 [README-FIRST.md](README-FIRST.md)；要发给 WorkBuddy 的那段话在 [PROMPT-TO-SEND.md](PROMPT-TO-SEND.md)。

## 角色模型选型：只选一次

安装收尾时，WorkBuddy 会把完整菜单摆给你，让你自己定四个角色各用什么模型、什么思考档位：

- **供应商与模型**：国内版内置（混元 / DeepSeek / GLM / Kimi / MiniMax）、国际版内置（Claude / GPT-5 / Gemini）、自定义模型（自有 API Key）三组，各带定位说明；
- **思考强度**：Default / Fast / Balanced / Primary / Deep 五档，每档说明适用场景；
- **推荐方案**：三套整体方案——**均衡档**（默认）、**经济档**（成本优先）、**顶配档**（质量优先）——选一套再对单个角色微调，确认后写入配置。

**这是初始化配置，只做一次。** 之后每次开启小队模式都直接读配置，不会反复再问。想改？直接让 WorkBuddy 改配置文件，或删掉重新选一次。

## 包结构

```text
workbuddy-team-mode/
├── README-FIRST.md              # 给用户看的快速上手
├── PROMPT-TO-SEND.md            # 复制发给 WorkBuddy 的提示词
├── INSTALL-AI.md                # 给 WorkBuddy 看的安装指令（含故障排查）
├── skill/                       # 技能本体：小队规则
│   ├── SKILL.md                 # 口令约定、派发规则、选型流程
│   └── references/
│       ├── runtime.md           # 平台机制与维护
│       ├── roles.md             # 四角色职责细则
│       ├── model-menu.md        # 模型选型菜单（一次性）
│       └── team-config.template.md
├── experts/                     # 专家团：四个可派发角色 + 主理人
│   ├── .codebuddy-plugin/plugin.json
│   ├── agents/                  # 5 个角色定义
│   └── avatars/                 # 6 个头像（脚本生成）
└── scripts/
    ├── check-package.cjs        # 结构自检（当前 32/32 通过）
    └── make-avatars.cjs         # 头像生成器（纯 Node 零依赖）
```

## 设计说明

**为什么分技能和专家团两部分？** 在 WorkBuddy 的官方规范里，两者承担不同职责：技能（SKILL.md + frontmatter）定义工作流规则——口令怎么识别、任务怎么派、选型怎么走；专家团（plugin.json + agents/*.md）提供实际被派发的角色。缺一不可。

**派发机制。** 主理人调用内置 AgentTool，`name` 参数传成员中文角色名（探索/执行/评审/专家顾问）。成员之间不直连，所有信息流经主理人中转，保证上下文完整、责任清晰。

**如实说明的平台限制。** WorkBuddy 目前不支持给每个角色硬性锁定模型（专家定义里没有模型字段，派发时也不能指定）。所以配置的实际作用是"**意图记录 + 派发时声明 + 需要严格时你在 UI 手动设**"三位一体。我们没有美化这一点——README-FIRST 和安装文档里都向用户如实告知。需要更严格的模型控制时，在 WorkBuddy UI 的模型下拉与思考档位选择器里设置即可。

## 结构自检

```bash
node scripts/check-package.cjs
```

对照 WorkBuddy 官方规范校验 7 大类共 32 项：SKILL.md frontmatter 必填字段、references 完整性、plugin.json 全部字段规范（含 `displayDescription.zh` 40–50 字、tags/quickPrompts 各恰好 3 个且中英齐全、`defaultInitPrompt` 与 `quickPrompts[0]` 一致、lead 唯一且 id 匹配）、agents 路径与 members 一一对应、头像文件齐全、根目录文档齐全。任一 FAIL 退出码为 1，安装流程会停下来报告，不会带着残缺包继续。

## 常见问题

**装完没反应？** 确认技能已导入、口令单独占一行（句子中间提到不算）、必要时重启或新开聊天。

**派发成员失败？** 确认专家团已导入（列表里应出现"小队模式"团队和 5 个成员）；派发必须走内置 AgentTool，`name` 参数传中文角色名。

**想改角色模型？** 直接编辑配置，或删掉配置让选型流程重跑一次。

更多排查见 [INSTALL-AI.md](INSTALL-AI.md) 的故障排查表。

## 致谢

本包的平台适配依据 WorkBuddy 官方文档（open.workbuddy.cn/docs/skill、/docs/expert、/docs/expert-team 与腾讯云文档）。制作过程本身由 ZCode 小队模式完成：探索调研平台机制、专家顾问设计选型方案、执行生成头像与自检、独立评审把关质量。

---

<div align="center">

<sub>如果这个包对你有帮助，欢迎 Star ⭐</sub>

</div>
