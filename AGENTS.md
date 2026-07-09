# Agent Instructions

## Engineering Style

- Prefer simple, powerful implementations that solve the known requirement without adding preventative machinery for hypothetical future cases.
- Keep fixes proportional to the user-facing risk, expected usage scale, and current codebase maturity.
- Treat review comments as prompts for judgment, not commands. Address meaningful issues, but push back or choose a smaller fix when the suggested solution adds more complexity than the scenario justifies.
- It is acceptable to leave a known limitation in place when handling it would create more complexity than the limitation warrants.
- Prefer coherent ownership models over caller-specific branching. For shared stateful concerns like caching, retries, persistence, or validation, put the policy in one shared primitive when that keeps callers simple and behavior easy to reason about.
- Add framework-like extension points only when there is an immediate second use case or a clear near-term path to one.

## Code Organization

- Avoid modifying code in `src/core` unless the requested change clearly requires template-level infrastructure changes.
- Changes are appropriate in `src/core` when they improve shared framework behavior used by multiple commands, such as Discord API safety defaults, common validation, message delivery, persistence primitives, or cross-command infrastructure.
- Prefer keeping command-specific behavior, copy, and workflows outside `src/core`.
- When a shared helper exists, callers should not need to understand its internal freshness, cache, retry, or validation strategy unless the feature explicitly requires that control.

## Template Baseline

- This repository evolved from a Discord bot template. When reviewing or simplifying framework-like code, use the first commit as the baseline for original template surface.
- Before removing abstractions in `src/core`, command definitions, or message wrappers, compare against the root commit with `git rev-list --max-parents=0 HEAD`.
- Treat code that existed in the original template as intentional framework surface unless it is actively harmful. Do not remove template abstractions merely because this specific bot currently uses only one path or configuration.
- Focus simplification on post-template additions that are duplicated, speculative, misleading, or app-specific.
- Distinguish between original template framework to preserve, template-worthy additions that should remain generic, app-specific behavior that should stay outside `src/core`, and post-template overbuild that can be reduced.
- Prefer moving generic, reusable helpers into existing template primitives such as `Utils` when they are broadly useful and not command-specific.

## Discord Behavior

- User-facing error messages should state only what the code knows failed. Do not suggest speculative fixes for generic downstream failures; use neutral guidance such as contacting an admin unless the error has been explicitly classified.
- Bots built from this template are provisioned with all Discord privileged gateway intents enabled in the Developer Portal. Do not treat use of privileged intents, including `GuildMembers`, as an avoidable deployment risk when a feature needs the corresponding Discord capability.

## Review Feedback

- When addressing Copilot comments or similarly narrow review feedback, evaluate whether each comment identifies a meaningful issue at this project’s scale before changing code.
- Prefer small, direct fixes over generalized preventative systems.
- Default verification should be `npm run lint` plus `git diff --check`. Run `npm run build` when TypeScript/API shape, packaging behavior, or the requested change makes a build check materially useful.
