---
description: AI-agnostic commit planning protocol for any assistant
---

# AI Commit Planning Protocol

## Purpose
Standardized workflow for AI assistants to analyze git changes and create proper commit sequences. Model-agnostic instructions any AI can follow.

## Pre-execution

**Required analysis commands:**
```bash
git status
git diff --stat
git diff [modified-files]
```

**Required file inspection:**
- Read all new files completely
- Read diff content for modified files
- Identify dependencies between changes

## Change Categorization (Priority Order)

Process changes in this sequence:

1. **FOUNDATION** - Config, tooling
   - Build configs, lint configs, type configs
   - Must be committed before code that depends on them

2. **LIBRARIES** - Shared utilities
   - HTTP clients, database utilities, shared types
   - No dependencies on application code

3. **SERVICES** - Business logic
   - API routes, backend handlers, services
   - May depend on libraries

4. **PRESENTATION** - UI components
   - Pages, components, styling
   - Depends on services and libraries

5. **TESTS** - Validation
   - Unit tests, integration tests
   - Always after code they test

6. **DOCUMENTATION** - Examples, guides
   - Usage examples, README updates
   - Last, non-breaking

## Commit Planning Steps

For each logical change group:

**STEP 1: Determine dependencies**
- Does this change depend on other uncommitted changes?
- Are there config changes required first?

**STEP 2: Create commit message**
Format: `<type>: <description>`

| Type | Use when |
|------|----------|
| `feat` | New feature, enhancement |
| `fix` | Bug fix |
| `refactor` | Code restructuring, no behavior change |
| `test` | Adding/updating tests |
| `docs` | Documentation, examples, comments |
| `chore` | Config, deps, tooling |

**STEP 3: Write description rules**
- Imperative mood: "Add feature" not "Added feature"
- No period at end
- Under 50 characters for subject
- Describe WHAT and WHY, not HOW

**STEP 4: Execute commit**
```bash
git add <specific-file(s)>
git commit -m "<type>: <description>"
```

**STEP 5: Verify state**
- Run available tests
- Run linter if configured
- Check `git status`
- Confirm no staged changes remain

## Dependency Ordering Rules

1. If file A uses types/globals from file B, B must commit first
2. If file A has tests in file B, A must commit before B
3. Config changes (ESLint, TSConfig) always commit before code using new settings
4. New utilities/libraries commit before code that imports them
5. Examples/docs commit after the code they document

## Output Format

Present plan as:

| Order | Commit | Files | Dependencies |
|-------|--------|-------|--------------|
| 1 | `type: description` | `file.ts` | None |
| 2 | `type: description` | `file2.ts` | Depends on #1 |

## Completion Criteria

- [ ] All files categorized by type
- [ ] Dependency order determined
- [ ] Commit messages written per convention
- [ ] Each commit executed sequentially
- [ ] `git status` shows clean working directory
- [ ] Build/test passes after each commit (if available)

## Anti-patterns to Avoid

- **DON'T** commit tests before the code they test
- **DON'T** commit features before their dependencies
- **DON'T** mix unrelated changes in one commit
- **DON'T** commit broken/incomplete states
- **DON'T** use vague messages like "update files" or "fix stuff"

## Example Execution

**Scenario:** Adding HTTP client with tests and ESLint updates

**Analysis:**
```
Modified: eslint.config.mjs    (adds fetch globals)
New:      http-client.ts       (uses fetch)
New:      http-client.test.ts  (tests http-client)
```

**Plan:**
| Order | Commit | Files |
|-------|--------|-------|
| 1 | `chore: add fetch globals to eslint config` | `eslint.config.mjs` |
| 2 | `feat: implement HTTP client with retry logic` | `http-client.ts` |
| 3 | `test: add unit tests for HTTP client` | `http-client.test.ts` |

**Execution:**
```bash
git add eslint.config.mjs && git commit -m "chore: add fetch globals to eslint config"
git add http-client.ts && git commit -m "feat: implement HTTP client with retry logic"
git add http-client.test.ts && git commit -m "test: add unit tests for HTTP client"
```
