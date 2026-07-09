# Copilot Review Instructions

## Review Calibration

This project favors simple, powerful solutions sized to the current bot and its
small-server use case. Flag meaningful correctness, safety, and maintainability
risks, but avoid recommending generalized infrastructure or preventative
machinery for hypothetical future scale.

Treat review comments as prompts for engineering judgment. If an issue is mostly
theoretical at this project's scale, call out the tradeoff instead of presenting
the larger solution as required.

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
