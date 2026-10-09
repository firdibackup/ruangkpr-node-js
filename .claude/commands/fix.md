# Fix

Fix the requested issue using the repository's CLAUDE.md.

1. Use Graphify first to trace the bug from the reported behavior/symbol/file to its relevant implementation, consumers, dependencies, and tests.
2. Inspect the Graphify-identified source and existing patterns before making changes. Do not scan unrelated parts of the repository unless needed.
3. Identify the root cause and make the smallest safe change.
4. Use Graphify to check whether the fix affects shared consumers or related tests.
5. Do not introduce unnecessary dependencies, abstractions, or refactors.
6. After fixing, run relevant lint/tests/build checks and report the results.

Issue:

$ARGUMENTS
