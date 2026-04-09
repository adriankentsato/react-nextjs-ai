---
description: Create comprehensive TDD-style test files with negative testing focus
---

# Create TDD Tests Workflow

Create thorough test coverage for any source file using TDD principles with emphasis on error conditions and edge cases.

## Prerequisites

- Source file to be tested exists
- Testing framework already configured (vitest/jest)
- Existing test patterns available in codebase (check `**/__tests__/*.test.ts`)

## Execution Steps

### 1. Analyze Source File

Read the source file completely. Identify:

- **Exports**: Functions, classes, types, constants
- **Logic branches**: if/else, switch, try/catch, loops
- **Error handling**: Throws, error returns, edge cases
- **Dependencies**: What it imports/uses
- **Async patterns**: Promises, async/await
- **Constructor/function signatures**: Overloads, options objects

### 2. Discover Test Patterns

Find existing test files in the codebase. Read at least one to understand:

- Testing framework (vitest/jest)
- Mocking strategy (vi.fn, jest.fn)
- Test structure (describe/it nesting)
- Import patterns
- Assertion style (expect.toBe vs expect.toEqual)
- Setup/teardown patterns (beforeEach, afterEach)

### 3. Plan Test Coverage

Create test categories in priority order:

1. **Constructor/Signature tests** - All ways to instantiate/call
2. **Happy path tests** - Normal expected behavior
3. **Error/Negative tests** - All error conditions (aim for 60%+ negative)
4. **Edge cases** - Empty inputs, null, undefined, boundaries
5. **Async behavior** - Promises, resolve/reject, sequential execution
6. **Integration** - Interaction between components

For each exported symbol, create:
- At least 1 happy path test
- At least 2 error/edge case tests
- Boundary condition tests

### 4. Create Test File

Create file at `path/to/source/__tests__/filename.test.ts`

Structure:
```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ThingToTest } from '../source';

describe('ThingToTest', () => {
  // Setup helpers
  const createFixture = () => ({ /* ... */ });
  
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('category', () => {
    it('should ... when ...', async () => {
      // Arrange
      // Act
      // Assert
    });
  });
});
```

### 5. Implement Tests TDD-Style

For each test:
1. Write test description first (what it should do)
2. Write assertion (expected outcome)
3. Write setup code
4. Write execution code
5. Run test - expect failure (TDD)
6. Verify test fails for right reason
7. Adjust if test reveals implementation detail

### 6. Fix Lint/Type Errors

Run lint command. Fix:

- Unused variables (prefix with `_`)
- Missing imports
- Trailing commas
- Type mismatches
- Formatting issues

### 7. Run and Verify

Execute tests:
```bash
npm test -- path/to/test.test.ts --run
```

All tests should pass. If failures:
- Check if test expectation is wrong (adjust to match actual behavior)
- Check for environment limitations (happy-dom vs real browser)
- Document intentional skips

### 8. Coverage Review

Ensure tests cover:

- [ ] All exported functions/classes
- [ ] All branches (if/else paths)
- [ ] All error throws
- [ ] Async resolve/reject paths
- [ ] Edge cases (empty, null, undefined, max values)
- [ ] Boundary conditions

## Commit Format

```
test(scope): add comprehensive tests for [module]

- Add TDD-style test coverage
- Focus on negative testing (errors, edge cases)
- Cover all branches and async paths
```

## Anti-Patterns to Avoid

- **DON'T** test implementation details (private methods)
- **DON'T** duplicate production logic in tests
- **DON'T** write all tests then run - do TDD per test
- **DON'T** mock what you don't own (external APIs)
- **DON'T** skip error handling tests
- **DON'T** use brittle assertions (exact object matching when order varies)

## Decision Tree

```
Testing a function?
├── Does it throw? → Add error test for each throw
├── Does it return? → Add happy path + null/undefined return tests
├── Does it use promises? → Add resolve + reject tests
└── Does it mutate state? → Add before/after state tests

Testing a class?
├── Constructor args? → Test each signature variation
├── Public methods? → Test each method separately
├── Instance state? → Test state transitions
└── Static methods? → Test like functions

Testing async?
├── Promise resolve? → Test resolved value
├── Promise reject? → Test rejection handling
├── Sequential calls? → Test execution order
└── Concurrent calls? → Test race conditions
```

## Verification Checklist

- [ ] `npm test` passes
- [ ] `npm run lint` passes
- [ ] No TypeScript errors
- [ ] Tests are independent (no shared mutable state)
- [ ] Tests describe behavior, not implementation
- [ ] Negative tests outnumber happy path tests
- [ ] All edge cases documented in test names
