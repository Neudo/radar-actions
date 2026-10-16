# Curated agency design roles for investment-radar

Installed Hermes skill: **`agency-design-workflow`**, in the **default profile** at:

```text
/home/debian/.hermes/skills/creative/agency-design-workflow/
```

This is one reusable workflow skill with five lazily loaded role prompts. It does **not** install persistent agents, start processes, register plugins, or change the provider/personality/configuration. The default workflow is sequential passes in the current session; an existing authorized delegate may instead receive a role's text as bounded task context. Delegation is not free merely because the persona is open source: do not spawn additional calls beyond the existing budget.

## Provenance and license

- Upstream repository: `https://github.com/msitarzewski/agency-agents`
- Pinned commit: `652b2692f8d8ec2b1f1a38e559073e287dfdc469`
- License: **MIT**, **Copyright (c) 2025 AgentLand Contributors**.
- Full original license: `vendor/agency-agents/LICENSE`.
- License accompanying adaptations: `hermes/agency-design-workflow/references/LICENSE.md`.
- Machine-readable source paths, SHA-256 checksums, review decisions, installed paths and verification: `PROVENANCE.json`.

Only five selected upstream Markdown files and LICENSE are vendored. Raw files are byte-identical upstream originals for provenance, **not loaded runbooks**. The project mirror under `hermes/agency-design-workflow/` contains the sanitized/adapted installed skill and references, ready for review and future reinstallation with `skill_manage`.

## Exact role mapping

Paths below are relative to this `agents/` directory. Installed role reference paths have the same `references/<role>.md` suffix under the skill directory shown above.

| Selected role | Exact upstream file (also under `vendor/agency-agents/`) | Adapted project file |
| --- | --- | --- |
| UX Researcher | `design/design-ux-researcher.md` | `hermes/agency-design-workflow/references/ux-researcher.md` |
| UI Designer | `design/design-ui-designer.md` | `hermes/agency-design-workflow/references/ui-designer.md` |
| Frontend Developer | `engineering/engineering-frontend-developer.md` | `hermes/agency-design-workflow/references/frontend-developer.md` |
| Accessibility Auditor | `testing/testing-accessibility-auditor.md` | `hermes/agency-design-workflow/references/accessibility-auditor.md` |
| Reality Checker | `testing/testing-reality-checker.md` | `hermes/agency-design-workflow/references/reality-checker.md` |

Other project skill files:

```text
hermes/agency-design-workflow/SKILL.md
hermes/agency-design-workflow/references/provenance.md
hermes/agency-design-workflow/references/LICENSE.md
```

## How implementation loads the roles

Load the workflow and only the needed role via Hermes's supported tools:

```text
skill_view(name="agency-design-workflow")
skill_view(name="agency-design-workflow", file_path="references/ui-designer.md")
skill_view(name="agency-design-workflow", file_path="references/frontend-developer.md")
```

The other role filenames are `ux-researcher.md`, `accessibility-auditor.md`, and `reality-checker.md`. Source/review details load with `references/provenance.md`.

A user can invoke `/agency-design-workflow` in a supported Hermes chat surface, or explicitly ask the agent to load the skill. For a delegate, the **parent loads a reference and includes its text in the task context** along with the project path, exact goal, acceptance criteria, evidence inputs, allowed files, forbidden actions, and output format. Do not invent a named persistent-agent API or assume children inherit the loaded skill. If no delegation tool is available, run the role pass in-session and disclose that this is not independent review.

Suggested ordering: research → design → explicitly authorized frontend implementation → accessibility review → evidence-based reality check. Keep concurrent write scopes disjoint. Do not run all five roles automatically for every small task.

## Safety review and adaptations

The five selected role files were read in full and checked for destructive/remote execution patterns, prompt overrides, and environment/credential references. No secret-exfiltration or system-override directive was found in this selected set. This is not a whole-repository security certification.

Adaptations deliberately remove or constrain:

- Identity, memory and mandatory-rule framing: roles remain lower-priority task guidance, never a global personality or safety override.
- Reality Checker's Laravel/HTML assumptions and `qa-playwright-capture.sh` commands: not applicable, not installed, not executed.
- Accessibility Auditor's `npx` package-download examples: use existing/free local tooling; missing tools are reported, not implicitly installed.
- Illustrative frontend/table/CSS snippets, unrelated editor/RPC scope, old FID targets, fixed revision counts, arbitrary grades and unsupported success claims.
- Fabricated user research, performance improvements, QA evidence and blanket accessibility claims. Missing manual/screen-reader tests remain NOT TESTED.

Upstream was fetched with Git into scratch without checkout or hooks; selected blobs were copied as text. No remote installer, converter, plugin, script or hook was run. No paid services or new dependencies were used.

## Scope and verification

Official Hermes skill format consulted: `https://hermes-agent.nousresearch.com/docs/user-guide/features/skills`. The installed skill uses YAML-frontmatter `SKILL.md`, the documented procedure/pitfalls/verification sections, and on-demand `references/`; all skill writes used `skill_manage`.

Verified:
- Hermes successfully resolved the installed main skill and all five role references, plus provenance and license.
- Vendored source files and LICENSE match the pinned Git blobs byte-for-byte.
- The project skill mirror matches the installed skill content; checksums are recorded in `PROVENANCE.json`.

This installation does not test or certify the radar application. No application source edits, commit/push, deployment, live-data mutation, global config/provider/personality change, other-profile change, or cron operation was performed. Existing paused crons must remain paused. Protected production access must never be bypassed or printed with credentials.

## Refresh or reinstall

Review the project mirror and provenance first. Use `skill_manage` to create the skill from the mirrored `SKILL.md` when absent, or targeted `patch` operations when present; add supporting documents using `write_file` operations with their `references/` paths. Do not copy over unrelated existing skills or change global skill directories. Load the main skill and each role again to verify.

For upstream refreshes, pin a new commit in scratch, inspect the selected files and license, update the condensed adaptations, checksums and mirror, and re-run the load/blob checks. Do not bulk-install the repository or silently follow upstream HEAD.
