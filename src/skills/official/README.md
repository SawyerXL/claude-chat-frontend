# claude.ai-skills

Official skills used by the claude.ai chat interface, directly extracted from Claude.ai.

## One-command install for AI agents

From your project/workspace root, clone the repo and run installer:

```bash
git clone https://github.com/md-riaz/claude.ai-skills.git
./claude.ai-skills/install.sh --target "$PWD"
```

Or pass any project path:

```bash
git clone https://github.com/md-riaz/claude.ai-skills.git
./claude.ai-skills/install.sh --target /path/to/your/project
```

The installer adds project instructions/adapters for common AI IDEs and CLIs:

- Claude Code: `CLAUDE.md` and `.claude/skills/claude.ai-skills/`
- Cursor: `.cursor/rules/claude-ai-skills.mdc`
- Codex CLI, OpenCode, and generic agents: `AGENTS.md`
- Gemini CLI: `GEMINI.md`
- Antigravity-style agents: `.agents/agents.md` and `.agents/skills/claude.ai-skills/`
- Kiro: `.kiro/steering/claude-ai-skills.md`
- GitHub Copilot: `.github/copilot-instructions.md` and `.github/instructions/claude-ai-skills.instructions.md`
- OpenCode project config area: `.opencode/AGENTS.md`

After this, open target project in Claude Code, Cursor, Codex CLI, Gemini CLI, Antigravity, Kiro, OpenCode, Copilot, or another compatible agent. Agent will see installed prefix/instructions and load relevant `SKILL.md` files from this repo when work matches a skill.

## Global install

Install once for tools that read global config from home directory:

```bash
git clone https://github.com/md-riaz/claude.ai-skills.git
cd claude.ai-skills
./install.sh --global
```

Global install writes:

- `~/CLAUDE.md`
- `~/.codex/AGENTS.md`
- `~/.gemini/GEMINI.md`
- `~/.cursor/rules/claude-ai-skills.mdc`
- `~/.kiro/steering/claude-ai-skills.md`
- `~/.agents/agents.md`
- `~/.config/opencode/AGENTS.md`
- `~/.copilot/copilot-instructions.md`
- `~/.claude/skills/claude.ai-skills/`
- `~/.agents/skills/claude.ai-skills/`

Use `--all-globals` to also copy skills into `~/.cursor/skills`, `~/.gemini/skills`, `~/.codex/skills`, and `~/.kiro/skills`.

## Installer options

```bash
./install.sh [--target PATH] [--global] [--all-globals] [--link]
```

- `--target PATH`: project/workspace to receive agent adapter files. Default: current directory.
- `--global`: install under `$HOME` where supported.
- `--all-globals`: with `--global`, also copy skills to optional global skill directories for Cursor, Gemini CLI, Codex CLI, and Kiro.
- `--link`: symlink skill directories instead of copying them into skill directories.

## Included skills

- `docx`
- `file-reading`
- `frontend-design`
- `pdf`
- `pdf-reading`
- `pptx`
- `xlsx`

## Manual usage

Each skill lives in its own directory and contains `SKILL.md`. If your agent does not support any adapter above, tell it:

> Use the relevant `SKILL.md` from `claude.ai-skills` before doing document, spreadsheet, slide, PDF, file-reading, or frontend-design work.
