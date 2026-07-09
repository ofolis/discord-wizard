# Copilot Review Instructions

This is an owner-operated Discord bot for a small, informal server. Logging Discord
user IDs, submitted content, embeds, and message payloads is intentional for audit
and moderation troubleshooting.

Do not flag user/content payload logging as a privacy or anonymity issue unless the
code logs credentials, tokens, API keys, or other authentication secrets.

Bots using this template are provisioned with all Discord privileged gateway
intents enabled in the Discord Developer Portal. Do not flag requested privileged
intents, including `GuildMembers`, as unnecessary deployment risk when the code
uses the corresponding Discord capability.
