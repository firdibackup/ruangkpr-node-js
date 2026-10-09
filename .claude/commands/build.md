# Build

Implement the requested feature using the repository's CLAUDE.md rules.

1. Use Graphify first to map the requested feature/symbol/file/route to its relevant files, consumers, dependencies, domain logic, and tests. Avoid broad repository scanning when Graphify can identify the context.
2. Inspect the Graphify-identified source files and existing architecture; reuse existing components, hooks, utilities, domain rules, and data boundaries.
3. Apply the project's visual baseline and Impeccable UI/UX principles.
4. Apply Ponytail simplicity principles: smallest reasonable implementation, no unnecessary dependencies or abstractions.
5. Before changing shared logic, use Graphify to check affected consumers and tests so the implementation covers the real dependency chain.
6. Keep changes focused and do not refactor unrelated code.
7. Run relevant lint/tests/build checks.
8. Review the final diff and remove unnecessary changes.

Task:

$ARGUMENTS
