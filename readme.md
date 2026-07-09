![Logo](https://github.com/ofolis/discord-wizard/raw/main/images/wizard-logo.png "Logo")

# discord-wizard

A Discord bot that provides anonymous submissions, anonymous voting, and play-money betting tools for a Discord server.

Discord server members can submit messages anonymously to a configured channel, participate in anonymous votes, maintain server money balances, and wager those balances on administrator-created bets.

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
      - **Presence Intent**
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
   3. Optionally set `CALL_IN_HOST_ROLE_NAMES` and `CALL_IN_HOSTS_CHANNEL_NAME` if your host roles or private hosts text channel are not named `hosts`.

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
   3. Optionally set `CALL_IN_HOST_ROLE_NAMES` and `CALL_IN_HOSTS_CHANNEL_NAME` if your host roles or private hosts text channel are not named `hosts`.
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

### 3. Set Up The Server

1. Create exactly one text channel named `submissions` if you want to use anonymous submissions.
2. Create exactly one private hosts text channel named `hosts`, or configure its name with `CALL_IN_HOSTS_CHANNEL_NAME`, if you want to use call-in mode.
3. Create a host role named `hosts`, or configure comma-separated role names with `CALL_IN_HOST_ROLE_NAMES`, if you want to use call-in mode.
4. Give the bot permission to server mute and unmute members in voice channels if you want to use call-in mode.
5. Give administrators the Discord **Administrator** permission if they should be able to start/end votes, manage bets, or adjust money balances.

## Usage

1. Start the application.
   - If you downloaded the build, run the executable file.
   - If you cloned the repository, run `npm start`.
2. In your Discord server channel, execute the bot's commands.
   - `/submit` - submit a message anonymously to the `submissions` channel.
   - `/votestart` - start an anonymous vote. Administrator only.
   - `/vote` - submit or update your anonymous vote.
   - `/voteend` - end the open vote and post results. Administrator only.
   - `/money` - privately view your money balance and server ranking.
   - `/moneygive` - give some of your money to another server member.
   - `/moneyadduser` - add money to a user. Administrator only.
   - `/moneyremoveuser` - remove money from a user. Administrator only.
   - `/moneysetuser` - set a user's money. Administrator only.
   - `/moneyaddserver` - add money to every server member. Administrator only.
   - `/moneyremoveserver` - remove money from every server member. Administrator only.
   - `/moneysetserver` - set every server member's money. Administrator only.
   - `/betstart` - start a bet. Administrator only.
   - `/bet` - place, update, or remove your wager.
   - `/betall` - wager all of your available money.
   - `/betlock` - lock the open bet so wagers cannot change. Administrator only.
   - `/betunlock` - unlock the open bet. Administrator only.
   - `/betend` - end the open bet and pay winners. Administrator only.
   - `/callinstart` - start call-in mode in your current voice channel. Host only.
   - `/callin` - join the call-in queue. Non-host only.
   - `/hangup` - leave the call-in queue or leave the live call.
   - `/callinpromote` - promote a queued call-in user. Host only.
   - `/callindemote` - demote a live call-in user. Host only.
   - `/callinforce` - make a voice-channel user live even if they are not queued. Host only.
   - `/callinend` - end call-in mode and release bot-managed mutes. Host only.

---

_This project uses my [Discord bot template](https://github.com/ofolis/discord-template)._
