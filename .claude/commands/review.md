# Review

Review the requested area against the repository's CLAUDE.md.

1. Use Graphify first to map the requested area/change and identify relevant files, consumers, dependencies, domain logic, and tests.
2. Review the Graphify-identified dependency chain before expanding the search scope.

Check:
- architecture and existing patterns
- UI/UX and responsive behavior
- accessibility
- unnecessary abstraction or duplication
- unnecessary dependencies
- data/API boundary violations
- loading, empty, error, and disabled states
- relevant tests
- whether shared logic changes affect all Graphify-identified consumers
- whether the implementation reads more repository context than necessary

Apply Impeccable principles to UI and Ponytail principles to code.

Do not modify files unless explicitly requested.

Context:

$ARGUMENTS
