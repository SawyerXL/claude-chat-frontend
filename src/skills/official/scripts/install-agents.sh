#!/usr/bin/env bash
set -euo pipefail

repo_dir="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
target="${AI_SKILLS_TARGET:-$PWD}"
mode="project"
link_mode="copy"
install_all_globals="false"

usage() {
  cat <<USAGE
Usage: ./scripts/install-agents.sh [options]

Installs adapter files so AI agents can discover this skill library.

Options:
  --target PATH       Project/workspace to receive agent files (default: current directory)
  --global            Install global adapters under HOME where supported
  --all-globals       Also copy skills to common global skills directories
  --link              Symlink skill directories instead of copying
  -h, --help          Show this help

Supported adapters include Claude Code, Cursor, Codex CLI, Gemini CLI,
Antigravity, Kiro, OpenCode, GitHub Copilot, and generic AGENTS.md agents.
USAGE
}

while [ "$#" -gt 0 ]; do
  case "$1" in
    --target) target="$2"; shift 2 ;;
    --global) mode="global"; shift ;;
    --all-globals) install_all_globals="true"; shift ;;
    --link) link_mode="link"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown option: $1" >&2; usage; exit 1 ;;
  esac
done

if [ "$mode" = "global" ]; then
  target="$HOME"
else
  mkdir -p "$target"
  target="$(cd "$target" && pwd)"
fi

skill_names=""
for skill_file in "$repo_dir"/*/SKILL.md; do
  [ -f "$skill_file" ] || continue
  skill_dir="$(basename "$(dirname "$skill_file")")"
  skill_names="$skill_names$skill_dir "
done
if [ -z "$skill_names" ]; then
  echo "No SKILL.md directories found in $repo_dir" >&2
  exit 1
fi

managed_block() {
  cat <<BLOCK

<!-- BEGIN claude.ai-skills installer -->
# claude.ai-skills
Skill library path: $repo_dir

Available skills: $skill_names

When a task involves documents, spreadsheets, slides, PDFs, file reading, or frontend design, inspect the relevant SKILL.md in the skill library before acting. Follow each skill's instructions and use its scripts when helpful.
<!-- END claude.ai-skills installer -->
BLOCK
}

write_managed_file() {
  local file="$1"
  mkdir -p "$(dirname "$file")"
  if [ -f "$file" ]; then
    awk 'BEGIN{skip=0} /<!-- BEGIN claude\.ai-skills installer -->/{skip=1; next} /<!-- END claude\.ai-skills installer -->/{skip=0; next} !skip{print}' "$file" > "$file.tmp"
    mv "$file.tmp" "$file"
  fi
  managed_block >> "$file"
}

write_cursor_rule() {
  local file="$1"
  local globs_line="$2"
  mkdir -p "$(dirname "$file")"
  cat > "$file" <<CURSOR
---
description: Use claude.ai-skills for document, spreadsheet, slide, PDF, file-reading, and frontend-design work
$globs_line
alwaysApply: true
---
$(managed_block)
CURSOR
}

install_skills() {
  local dest="$1"
  mkdir -p "$dest"
  for d in $skill_names; do
    rm -rf "$dest/$d"
    if [ "$link_mode" = "link" ]; then
      ln -s "$repo_dir/$d" "$dest/$d"
    else
      cp -R "$repo_dir/$d" "$dest/$d"
    fi
  done
}

if [ "$mode" = "global" ]; then
  # Instruction files / rules
  write_managed_file "$HOME/CLAUDE.md"
  write_managed_file "$HOME/.codex/AGENTS.md"
  write_managed_file "$HOME/.gemini/GEMINI.md"
  write_cursor_rule "$HOME/.cursor/rules/claude-ai-skills.mdc" ""
  write_managed_file "$HOME/.kiro/steering/claude-ai-skills.md"
  write_managed_file "$HOME/.agents/agents.md"
  write_managed_file "$HOME/.config/opencode/AGENTS.md"
  write_managed_file "$HOME/.copilot/copilot-instructions.md"

  # Skills directories used by hosts that support filesystem skills.
  install_skills "$HOME/.claude/skills/claude.ai-skills"
  install_skills "$HOME/.agents/skills/claude.ai-skills"
  if [ "$install_all_globals" = "true" ]; then
    install_skills "$HOME/.cursor/skills/claude.ai-skills"
    install_skills "$HOME/.gemini/skills/claude.ai-skills"
    install_skills "${CODEX_HOME:-$HOME/.codex}/skills/claude.ai-skills"
    install_skills "$HOME/.kiro/skills/claude.ai-skills"
  fi
  echo "Installed global adapters under HOME."
else
  # Broadly supported project instructions
  write_managed_file "$target/AGENTS.md"
  write_managed_file "$target/CLAUDE.md"
  write_managed_file "$target/GEMINI.md"

  # IDE / agent specific instruction locations
  write_cursor_rule "$target/.cursor/rules/claude-ai-skills.mdc" "globs: **/*"
  write_managed_file "$target/.kiro/steering/claude-ai-skills.md"
  write_managed_file "$target/.agents/agents.md"
  write_managed_file "$target/.github/copilot-instructions.md"
  write_managed_file "$target/.github/instructions/claude-ai-skills.instructions.md"
  write_managed_file "$target/.opencode/AGENTS.md"

  # Local skill directories. Antigravity/OpenCode-style hosts commonly read .agents/skills;
  # Claude Code reads .claude/skills.
  install_skills "$target/.claude/skills/claude.ai-skills"
  install_skills "$target/.agents/skills/claude.ai-skills"
  echo "Installed project adapters in $target."
fi

echo "Skills: $skill_names"
echo "Source: $repo_dir"
