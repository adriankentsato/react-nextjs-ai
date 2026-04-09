---
description: Analyze changes and create step-by-step commit plan
---

# Commit Planning and Staging Workflow

Use this workflow to analyze uncommitted changes, categorize them logically, and execute commits in the correct dependency order.

## Steps

1. **Analyze current state**
   ```bash
   git status
   git diff --stat
   ```

2. **Review all changes**
   - Read modified files to understand what changed
   - For new files, determine their purpose and dependencies
   - Identify which changes depend on others

3. **Categorize changes**

   | Category | Description | Typical Order |
   |----------|-------------|---------------|
   | Tooling | Config files (ESLint, TS, build) | 1st - foundation |
   | Libraries | Shared utilities, clients | 2nd - core deps |
   | API | Backend routes, handlers | 3rd - after libs |
   | UI | Components, pages | 4th - after APIs |
   | Tests | Unit, integration tests | After code they test |
   | Docs | README, comments, examples | Last |

4. **Determine commit order**
   - Dependencies first (config → libs → features → tests)
   - Each commit should leave codebase buildable
   - Group related changes together
   - Keep commits atomic and focused

5. **Write commit messages**
   - Use conventional commits format: `type: description`
   - Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`
   - Keep subject line under 50 characters
   - Describe what and why, not how

6. **Execute commits**
   ```bash
   git add <file(s)> && git commit -m "type: description"
   ```
   - Commit one logical group at a time
   - Verify `git status` after each commit
   - Run tests/lint if available before/after

7. **Verify completion**
   ```bash
   git log --oneline -<n>
   git status  # should be clean
   ```

## Example Output

| Order | Commit | Files | Rationale |
|-------|--------|-------|-----------|
| 1 | `chore: add DOM globals to ESLint config` | `eslint.config.mjs` | Required for test files |
| 2 | `feat: implement HTTP client` | `http-client.ts` | Core library, no deps |
| 3 | `test: add HTTP client tests` | `http-client.test.ts` | Depends on http-client |

## Tips

- When in doubt, commit dependencies first
- If a file has both feature and test changes, split them
- Use `git add -p` for granular staging if needed
- Verify build/test passes after each commit
