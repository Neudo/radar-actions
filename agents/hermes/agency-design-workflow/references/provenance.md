# Provenance and adaptation policy

Source: https://github.com/msitarzewski/agency-agents
Pinned commit: `652b2692f8d8ec2b1f1a38e559073e287dfdc469`
License: MIT; Copyright (c) 2025 AgentLand Contributors. Full notice: `LICENSE.md`.

## Exact selected upstream files
- `design/design-ux-researcher.md` → `ux-researcher.md`
- `design/design-ui-designer.md` → `ui-designer.md`
- `engineering/engineering-frontend-developer.md` → `frontend-developer.md`
- `testing/testing-accessibility-auditor.md` → `accessibility-auditor.md`
- `testing/testing-reality-checker.md` → `reality-checker.md`

These five role references are condensed, safety-scoped adaptations, not verbatim upstream persona system prompts. Project copies and checksums live in `/home/debian/.hermes/workspace/projects/investment-radar/agents/PROVENANCE.json`; byte-identical raw originals and LICENSE are under `agents/vendor/agency-agents/` for audit only.

## Inspection decisions
Full selected-file review and regex checks found no credential-exfiltration or system-override instructions in these five source documents. This is a scoped inspection, not a security audit of the whole repository.

Removed upstream identity/memory authority framing, mandatory shell runbooks, illustrative code, fictional success metrics, simplistic first-pass failure/grade rules, unrelated frontend editor/RPC tasks, and stale performance targets. Accessibility's npx examples could download packages; Reality Checker's script/path assumptions are not supported by this installation. None were run or installed. No upstream installer, plugin, converter, hooks, config, provider, personality, or scheduler settings were applied.

## Supported Hermes representation
Official format reference consulted: https://hermes-agent.nousresearch.com/docs/user-guide/features/skills

The installed artifact is one `SKILL.md` with YAML frontmatter, actionable procedure, pitfalls and verification, plus lazily loaded `references/`. Install/update with `skill_manage`; load via `skill_view`. Roles are supplied as task context to existing delegates if available and authorized, or used sequentially in the current conversation. Installing role documents does not register agents or create persistent worker processes.

## Refresh safely
Inspect upstream selected files and license at a new pinned commit in scratch without executing remote code. Re-review all changed content, update checksums/provenance, adapt role references using `skill_manage`, preserve MIT notice, and load every reference to verify. Do not silently track upstream HEAD or bulk-install all personas.
