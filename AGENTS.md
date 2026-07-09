# Agent Instructions

- Avoid modifying code in `src/core` unless the requested change clearly requires template-level infrastructure changes.
- Changes are appropriate in `src/core` when they improve shared framework behavior used by multiple commands, such as Discord API safety defaults, common validation, message delivery, persistence primitives, or cross-command infrastructure.
- Prefer keeping command-specific behavior, copy, and workflows outside `src/core`.
- User-facing error messages should state only what the code knows failed. Do not suggest speculative fixes for generic downstream failures; use neutral guidance such as contacting an admin unless the error has been explicitly classified.
- Bots built from this template are provisioned with all Discord privileged gateway intents enabled in the Developer Portal. Do not treat use of privileged intents, including `GuildMembers`, as an avoidable deployment risk when a feature needs the corresponding Discord capability.
- When addressing Copilot comments or similarly narrow review feedback, default verification should be `npm run lint` plus `git diff --check`. Run `npm run build` when TypeScript/API shape, packaging behavior, or the requested change makes a build check materially useful.
