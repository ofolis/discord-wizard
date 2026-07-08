# Agent Instructions

- Avoid modifying code in `src/core` unless the requested change clearly requires template-level infrastructure changes.
- Changes are appropriate in `src/core` when they improve shared framework behavior used by multiple commands, such as Discord API safety defaults, common validation, message delivery, persistence primitives, or cross-command infrastructure.
- Prefer keeping command-specific behavior, copy, and workflows outside `src/core`.
