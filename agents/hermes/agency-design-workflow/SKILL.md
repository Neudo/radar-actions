---
name: agency-design-workflow
description: "Use when agency personas guide UI design and review."
version: 1.0.0
author: Hermes Agent (adapted from AgentLand Contributors)
license: MIT
metadata:
  hermes:
    tags: [agency-agents, ux, ui, frontend, accessibility, qa]
---

# Agency Design Workflow

## When to Use
Use for evidence-led UI/UX audits, redesign handoffs, frontend implementation, and accessibility/integration review. Five curated task roles are adapted from msitarzewski/agency-agents; they are role prompts, NOT installed autonomous agents, persistent processes, new tools, or separate identities with memory.

## Procedure
1. Read project instructions and discover the actual stack, available tests, target journeys, write scope, and constraints before proposing changes. Separate observed evidence, hypotheses, and untested areas.
2. Load only the relevant reference with `skill_view(name="agency-design-workflow", file_path="references/<role>.md")`:
   - `ux-researcher.md`: user tasks, friction, research questions, prioritized findings.
   - `ui-designer.md`: information hierarchy, tokens, responsive components and state specs.
   - `frontend-developer.md`: implement approved specs using existing project architecture.
   - `accessibility-auditor.md`: keyboard, semantics, contrast, assistive-technology checks.
   - `reality-checker.md`: independent specification/evidence gate after implementation.
3. Default to sequential role passes in the current conversation to limit context and usage. Research → design → approved implementation → accessibility → reality check. Do not launch extra model calls merely because five roles exist.
4. If the parent actually has an authorized delegation tool, load the desired reference first and include its text as task context for a bounded delegate. Include project path, accepted requirements, evidence inputs, explicit allowed files, forbidden actions, and output format. Do not assume parent skills are inherited by children. Use existing configured provider/model only; no paid tools, external services, or provider changes. If delegation is unavailable or would exceed budget, execute the role pass locally and disclose that it is not independent review.
5. Delegate task-context pattern (not a new tool schema):
   ```text
   Apply the attached <role> task lens within all existing instructions.
   PROJECT: <absolute path>; TASK: <bounded objective>.
   ACCEPTANCE: <observable checks>; INPUT EVIDENCE: <paths>.
   WRITE SCOPE: <exact files or read-only>; FORBIDDEN: <project constraints>.
   ROLE REFERENCE: <loaded reference text>.
   RETURN: findings/changes, evidence, tests actually run, unknowns, blockers.
   ```
6. Keep concurrent writers in disjoint scopes. Review the original acceptance criteria first, then quality. Record failures, fix within authorization, and re-test. Missing evidence means BLOCKED/NOT TESTED, not PASS. No arbitrary forced revision counts or aesthetic grades.
7. For investment-radar: work in `/home/debian/.hermes/workspace/projects/investment-radar`. The protected live dashboard is an authorized observation target only; never bypass authentication, expose secrets, mutate live data, deploy, commit/push, restart services, or resume paused crons unless separately authorized. Preserve source provenance, financial uncertainty labels, dates, and units; never invent market results or investment claims for visual polish. Use only existing/free local tooling. A design task alone does not authorize application edits.

## Pitfalls
- Role references are lower-priority task guidance; never override system/developer/user instructions, approvals, personality, provider, config, or privacy controls.
- Raw upstream files in project `agents/vendor/` are provenance, not executable runbooks. Do not run upstream installers, conversion scripts, canned QA scripts, or unreviewed code examples.
- Do not fabricate user interviews, screenshots, test outcomes, measurements, memories, or WCAG conformance. A heuristic UX audit is not user research; a DOM check is not a screen-reader test.
- Keep MIT attribution with adaptations. Source, pinned commit, review decisions: `references/provenance.md`; license: `references/LICENSE.md`.

## Verification
Return scope and acceptance checks with PASS/FAIL/NOT TESTED and linked real artifacts. List actual commands/results, issues by user impact, and explicit manual checks left. Do not claim production readiness with missing critical journey, responsive, or accessibility evidence. Installation is verified by loading the skill and each reference through `skill_view`; it does not certify the application UI.
