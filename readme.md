![Logo](https://github.com/ofolis/discord-wizard/raw/main/images/wizard-logo.png "Logo")

# discord-wizard

A Discord bot that provides anonymous submissions, anonymous voting, play-money betting, call-in tools, and optional AI chatbot replies for a Discord server.

Discord server members can submit messages anonymously to a configured channel, participate in anonymous votes, maintain server money balances, wager those balances on administrator-created bets, use a managed call-in queue, and receive AI-generated character responses from Wizard when the chatbot feature is enabled.

## Setup

### 1. Create The Discord Bot

1. Open your [Discord developer portal](https://discord.com/developers/applications).
2. Create a new application.
3. In the **General Information** section:
   1. Set **Name** to `Wizard` (or whatever name you want the bot to have in your server).
   2. Optionally, upload an **App Icon**.
      - Use the `wizard-logo.png` included in this project's `images` directory if you'd like.
   3. **Save the application ID value for later.**
4. In the **Installation** section:
   1. Ensure that **Guild Install** is the only context method.
   2. Disable the install link.
5. In the **OAuth2** section:
   1. Disable **Public Client**.
6. In the **Bot** section:
   1. Set any desired aesthetic items.
   2. Reset the token and **save the value for later**.
   3. Enable privileged gateway intents:
      - **Server Members Intent**
      - **Message Content Intent**
7. Back in the **OAuth2** section:
   1. Create a guild install OAuth2 URL with only the `bot` scope.
8. Open the generated URL and install the bot in your Discord server.

### 2. Set Up The Application

> [!NOTE]
> These step-by-step instructions are for local setup/usage. Since this is a Node.js app, you can also run the bot on a remote server, but I'm not including those specific steps in this readme.

**Option 1 - For Usage Only**

1. Download the build ZIP file in [the latest release](https://github.com/ofolis/discord-wizard/releases/latest) for your system.
2. Extract the folder somewhere on your machine.
3. Rename the `.env.example` file to `.env`.
4. Modify the `.env` file.
   1. Replace the `?` after `DISCORD_APPLICATION_ID=` with the value noted earlier.
   2. Replace the `?` after `DISCORD_BOT_TOKEN=` with the value noted earlier.
   3. Fill in the server-specific settings listed below.

**Option 2 - For Development & Usage**

1. Clone this repository.
2. Install the project's version of Node.js.
   1. [Install Node Version Manager.](https://github.com/nvm-sh/nvm?tab=readme-ov-file#installing-and-updating)
   2. Run `nvm use`.
3. Run `npm install`.
4. Rename the `.env.example` file to `.env`.
5. Modify the `.env` file.
   1. Replace the `?` after `DISCORD_APPLICATION_ID=` with the value noted earlier.
   2. Replace the `?` after `DISCORD_BOT_TOKEN=` with the value noted earlier.
   3. Fill in the server-specific settings listed below.
6. Set up VSCode (if applicable).
   1. Install required plugins:
      - **ESLint**
      - **Prettier**
   2. Install optional plugins:
      - **commitlint**
      - **Markdown All in One**
      - **npm Intellisense**
      - **Sort JSON objects**
7. Run `npm run build`.

**Server-Specific `.env` Settings**

- `SUBMISSION_CHANNEL_NAME` - name of the text channel that receives anonymous submissions.
- `CHATBOT_ENABLED` - set to `true` to let Wizard generate AI chatbot responses when mentioned.
- `CHATBOT_ORGANIC_CHANNEL_NAMES` - optional comma-separated channel names where Wizard may generate unprompted organic AI replies. Leave blank to allow organic replies in all channels.
- `CHATBOT_ORGANIC_COOLDOWN_MINUTES` - minimum minutes between organic AI replies in each server. Defaults to `60`; set to `0` to disable the cooldown.
- `CHATBOT_ORGANIC_REPLY_CHANCE` - chance from `0` to `1` that an eligible message in an organic channel gets an AI reply. Defaults to `0.01`; set to `0` to disable organic replies.
- `CALL_IN_HOST_CHANNEL_NAME` - name of the private text channel where the call-in queue is posted for hosts.
- `CALL_IN_HOST_ROLE_NAMES` - comma-separated role names for users who count as call-in hosts in voice channels.
- `OPENAI_API_KEY` - OpenAI API key for AI chatbot replies. Required when `CHATBOT_ENABLED=true`.
- `OPENAI_MODEL` - OpenAI model for AI chatbot replies. Required when `CHATBOT_ENABLED=true`.
- `OPENAI_PROMPT_ID` - OpenAI prompt ID for AI chatbot replies. Required when `CHATBOT_ENABLED=true`.
- `MANAGER_ROLE_NAMES` - optional comma-separated role names for users who can use restricted commands without Discord Administrator permission.

**AI Prompt Reference**

The chatbot's runtime prompt is managed in OpenAI Prompt Management and selected with `OPENAI_PROMPT_ID`. The repository also includes [docs/ai-prompt.md](docs/ai-prompt.md) as a reference copy for reviewing and editing the prompt text before updating the hosted OpenAI prompt. The application does not read this Markdown file at runtime.

### 3. Set Up The Server

1. Create one text channel for anonymous submissions, then set `SUBMISSION_CHANNEL_NAME` to that channel's name.
2. For call-in mode, create one private text channel for hosts, then set `CALL_IN_HOST_CHANNEL_NAME` to that channel's name.
3. For call-in mode, create the host role or roles, then list those role names in `CALL_IN_HOST_ROLE_NAMES`.
4. Give the bot permission to server mute and unmute members in voice channels if you want to use call-in mode.
5. Give users the Discord **Administrator** permission, or list their role in `MANAGER_ROLE_NAMES`, if they should be able to start, end, or cancel votes; manage bets; or adjust money balances.

## Usage

1. Start the application.
   - If you downloaded the build, run the executable file.
   - If you cloned the repository, run `npm start`.
2. In your Discord server channel, execute the bot's commands.
   - Mention Wizard in a message to receive an AI response when `CHATBOT_ENABLED=true`.
   - When `CHATBOT_ENABLED=true`, Wizard may also reply organically in `CHATBOT_ORGANIC_CHANNEL_NAMES` based on `CHATBOT_ORGANIC_REPLY_CHANCE` and `CHATBOT_ORGANIC_COOLDOWN_MINUTES`.
   - `/submit` - submit a message anonymously to the configured submission channel.
   - `/votestart` - start an anonymous vote. Manager or Discord admin only.
   - `/vote` - submit or update your anonymous vote.
   - `/voteend` - end the open vote and post results. Manager or Discord admin only.
   - `/votecancel` - cancel the open vote and mark the original vote post as canceled. Manager or Discord admin only.
   - `/money` - privately view your money balance and server ranking.
   - `/moneygive` - give some of your money to another server member.
   - `/moneyadduser` - add money to a user. Manager or Discord admin only.
   - `/moneyremoveuser` - remove money from a user. Manager or Discord admin only.
   - `/moneysetuser` - set a user's money. Manager or Discord admin only.
   - `/moneyaddserver` - add money to every server member. Manager or Discord admin only.
   - `/moneyremoveserver` - remove money from every server member. Manager or Discord admin only.
   - `/moneysetserver` - set every server member's money. Manager or Discord admin only.
   - `/betstart` - start a bet. Manager or Discord admin only.
   - `/bet` - place or update your wager; use amount `0` with an option letter to remove your wager.
   - `/betall` - wager all of your available money.
   - `/betlock` - lock the open bet so wagers cannot change. Manager or Discord admin only.
   - `/betunlock` - unlock the open bet. Manager or Discord admin only.
   - `/betend` - end the open bet and pay winners. Manager or Discord admin only.
   - `/betcancel` - cancel the open bet, refund all wagers, and mark the original bet post as canceled. Manager or Discord admin only.
   - `/callinstart` - start call-in mode in a voice channel. Call-in host, manager, or Discord admin only.
   - `/callin` - join the call-in queue. Non-host only.
   - `/hangup` - leave the call-in queue or leave the live call. Non-host only.
   - `/callinpromote` - promote a queued call-in user. Call-in host, manager, or Discord admin only.
   - `/callindemote` - demote a live call-in user. Call-in host, manager, or Discord admin only.
   - `/callinforce` - make a voice-channel user live even if they are not queued. Call-in host, manager, or Discord admin only.
   - `/callinend` - end call-in mode and release bot-managed mutes. Call-in host, manager, or Discord admin only.

---

_This project uses my [Discord bot template](https://github.com/ofolis/discord-template)._
