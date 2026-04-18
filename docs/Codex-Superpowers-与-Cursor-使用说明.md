# Codex Superpowers 与 Cursor 使用说明

## 一、`~/.codex/superpowers` 内容完整性确认 ✅

你的 `~/.codex/superpowers` 与 [obra/superpowers](https://github.com/obra/superpowers) 官方仓库结构一致，内容完整、准确。

### 与官方仓库对比

| 项目 | 官方仓库 | 你的本地 | 说明 |
|------|----------|----------|------|
| 根目录结构 | .claude-plugin, .codex, .gitignore, agents, commands, docs, hooks, lib, skills, tests, LICENSE, README.md, RELEASE-NOTES.md | ✅ 全部存在 | 一致 |
| Codex 入口 | .codex/INSTALL.md, superpowers-bootstrap.md, superpowers-codex | ✅ 全部存在 | 一致 |
| 技能目录 | skills/ 下各子技能（brainstorming, systematic-debugging, writing-plans 等） | ✅ 全部存在 | 一致 |

### 你的 `~/.codex/` 当前状态

- **AGENTS.md**：已包含 Superpowers 说明，并指示运行 bootstrap。
- **skills/**：个人技能目录已存在（可与 superpowers 技能并存，同名时个人优先）。
- **superpowers/**：克隆完整，可直接用于 Codex 或作为 Cursor 的“技能库”引用。

---

## 二、已知问题：`superpowers-codex` 的 Node 模块格式

在终端运行 `~/.codex/superpowers/.codex/superpowers-codex find-skills` 时，如出现：

```text
SyntaxError: Cannot use import statement outside a module
```

原因是：`superpowers-codex` 用 `require()` 加载 `lib/skills-core.js`，而 `skills-core.js` 使用 ES Module（`import`），在默认 Node 下会报错。

**可选处理方式：**

1. **升级/改用 Node 并以 ESM 运行**（若脚本支持）：在 superpowers 目录下用 `node --experimental-require-module` 或项目内 `"type": "module"` 的方式运行（需仓库后续支持）。
2. **向仓库提 issue**：这是 [obra/superpowers](https://github.com/obra/superpowers/issues) 的兼容性问题，可反馈以便维护者修复。
3. **在 Cursor 中不依赖该 CLI**：直接按下面「在 Cursor 中使用」的方式，通过规则 + 读文件使用技能内容，无需执行 `superpowers-codex`。

---

## 三、下一步（若你使用 OpenAI Codex）

若你使用 **Codex**，按官方流程即可：

1. 在 Codex 会话里按 `~/.codex/AGENTS.md` 的提示执行：
   ```bash
   ~/.codex/superpowers/.codex/superpowers-codex bootstrap
   ```
2. 列出技能：
   ```bash
   ~/.codex/superpowers/.codex/superpowers-codex find-skills
   ```
3. 使用某一技能：
   ```bash
   ~/.codex/superpowers/.codex/superpowers-codex use-skill superpowers:brainstorming
   ```

若上述命令因 Node 报错无法执行，可暂时跳过 CLI，在 Cursor 侧按下一节方式使用技能内容。

---

## 四、在 Cursor 中如何使用这套“技能框架”

Superpowers 是为 **Codex / Claude Code** 设计的，配置在 `~/.codex/`，Cursor **不会自动**读取 `~/.codex/` 或执行 `superpowers-codex`。  
在 Cursor 里要“用上”这套技能，需要**由 Cursor 的规则或对话约定**去引用它们。

### 方式一：项目级规则（推荐）

在项目里加一条 Cursor 规则，约定“在做某类事前，先看 superpowers 里的对应技能”。

1. 在项目根目录创建或编辑 **`.cursor/rules/superpowers.mdc`**（或同类规则文件），内容示例：

   ```markdown
   # Superpowers 技能库（只读参考）

   - 技能根目录：`~/.codex/superpowers/skills/`（即 `$HOME/.codex/superpowers/skills/`）。
   - 当用户请求涉及以下任一主题时，**必须先**用 Read 工具打开对应 SKILL.md，再按其中步骤执行，并在回复中声明「已按 Superpowers 技能 XXX 执行」：
     - 头脑风暴、方案发散 → `brainstorming/SKILL.md`
     - 写实现/开发计划 → `writing-plans/SKILL.md`
     - 执行已有计划 → `executing-plans/SKILL.md`
     - 系统化调试、根因分析 → `systematic-debugging/SKILL.md`
     - TDD、测试驱动 → `test-driven-development/SKILL.md`
     - 代码审查（请求/接收）→ `requesting-code-review/SKILL.md` 或 `receiving-code-review/SKILL.md`
     - 子 agent/多角色协作开发 → `subagent-driven-development/SKILL.md`
     - 写新技能、写 Cursor/Codex 技能 → `writing-skills/SKILL.md`
     - 收尾开发分支、上线前检查 → `finishing-a-development-branch/SKILL.md`、`verification-before-completion/SKILL.md`
   - 技能文件名统一为目录下的 `SKILL.md`；路径使用 `~` 或 `$HOME` 时需对应到当前用户的真实主目录。
   ```

2. 保存后，在 Cursor 中做相关任务时，Agent 会先读对应 `SKILL.md` 再按技能要求执行。

这样等于在 **Cursor 里复用了 Superpowers 的技能逻辑**，而不依赖 Codex 或 `superpowers-codex` CLI。

### 方式二：对话中直接 @ 技能文件

- 若已知道要用哪个技能，可在对话里写：
  - “请按 `~/.codex/superpowers/skills/systematic-debugging/SKILL.md` 做系统化调试”
- 或在 Cursor 中用 @ 引用该文件的路径，让模型先读再执行。

### 方式三：把常用技能迁到 Cursor 技能目录（可选）

Cursor 的用户级技能目录是 **`~/.cursor/skills-cursor/`**，格式也是目录 + `SKILL.md`。

- 可把最常用的 superpowers 技能**复制**到 `~/.cursor/skills-cursor/` 下新目录（例如 `systematic-debugging/`），并保留 `SKILL.md`。
- 工具映射需在技能里写清（Superpowers 里的 `TodoWrite` → Cursor 里对应成你实际用的任务/计划工具）。
- 这样这些技能会出现在 Cursor 的“技能”列表里，便于触发。

---

## 五、技能列表速查（`~/.codex/superpowers/skills/`）

便于你在 Cursor 规则或对话中精确引用：

| 技能目录名 | 典型用途 |
|------------|----------|
| `brainstorming` | 头脑风暴、方案发散 |
| `writing-plans` | 写实现/开发计划 |
| `executing-plans` | 按计划执行任务 |
| `systematic-debugging` | 系统化调试、根因分析 |
| `test-driven-development` | 测试驱动开发 |
| `requesting-code-review` | 请求代码审查 |
| `receiving-code-review` | 接收并处理审查意见 |
| `subagent-driven-development` | 多角色/子 agent 协作开发 |
| `writing-skills` | 编写新技能（含 Cursor/Codex） |
| `using-superpowers` | 如何查找、选择、调用技能 |
| `dispatching-parallel-agents` | 并行分发任务给多个 agent |
| `finishing-a-development-branch` | 收尾开发分支 |
| `verification-before-completion` | 完成前自检与验证 |
| `using-git-worktrees` | 使用 Git worktrees 工作流 |

每个技能目录下都有 **`SKILL.md`**，在 Cursor 中通过「规则 + Read 该文件」即可按同一套方法论工作。

---

## 六、小结

- **`~/.codex/superpowers`**：内容完整、与官方一致，可直接作为“技能库”使用。
- **下一步**：若用 Codex，按 `AGENTS.md` 和本文第三节使用；若只用 Cursor，按第四节在项目规则或对话中引用 `~/.codex/superpowers/skills/.../SKILL.md` 即可在 Cursor 中使用这套技能框架，无需依赖 `superpowers-codex` 是否在本地运行成功。
