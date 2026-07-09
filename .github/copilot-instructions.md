# Copilot Review Instructions

## Review Calibration

This project favors simple, powerful solutions sized to the current bot and its
small-server use case. Flag meaningful correctness, safety, and maintainability
risks, but avoid recommending generalized infrastructure or preventative
machinery for hypothetical future scale.

Treat review comments as prompts for engineering judgment. If an issue is mostly
theoretical at this project's scale, call out the tradeoff instead of presenting
the larger solution as required.

For shared stateful behavior such as caching, retries, persistence, or
validation, prefer comments that clarify ownership and simplify the mental model.
Avoid pushing caller-specific policy branches unless they address a demonstrated
need.

## Template Baseline

This repository evolved from a Discord bot template. Do not recommend deleting
original template framework surface merely because the current bot uses only one
path or configuration.

When reviewing architecture or simplification work, use the root commit as the
template baseline. Prefer comments that distinguish between original template
framework, template-worthy generic additions, app-specific behavior, and
post-template overbuild.

Framework-like changes in `src/core`, command definitions, and message wrappers
should preserve original template abstractions unless they are actively harmful.
Focus reduction comments on post-template complexity that is duplicated,
speculative, misleading, or app-specific.

## Discord Context

This is an owner-operated Discord bot for a small, informal server. Logging Discord
user IDs, submitted content, embeds, and message payloads is intentional for audit
and moderation troubleshooting.

Do not flag user/content payload logging as a privacy or anonymity issue unless the
code logs credentials, tokens, API keys, or other authentication secrets.

Bots using this template are provisioned with all Discord privileged gateway
intents enabled in the Discord Developer Portal. Do not flag requested privileged
intents, including `GuildMembers`, as unnecessary deployment risk when the code
uses the corresponding Discord capability.
