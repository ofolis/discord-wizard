import {
  Bet,
  BetAll,
  BetEnd,
  BetLock,
  BetStart,
  BetUnlock,
  CallIn,
  CallInDemote,
  CallInEnd,
  CallInForce,
  CallInPromote,
  CallInStart,
  HangUp,
  Money,
  MoneyAddServer,
  MoneyAddUser,
  MoneyGive,
  MoneyRemoveServer,
  MoneyRemoveUser,
  MoneySetServer,
  MoneySetUser,
  Submit,
  Vote,
  VoteEnd,
  VoteStart,
} from "./commands";
import { AccessUtils } from "./commands/access-utils";
import { CallInUtils } from "./commands/call-in-utils";
import { ChannelCache } from "./controllers";
import {
  ChannelCommandMessage,
  Command,
  Discord,
  Environment,
  Log,
} from "./core";

const commands: Command[] = [
  new Bet(),
  new BetAll(),
  new BetEnd(),
  new BetLock(),
  new BetStart(),
  new BetUnlock(),
  new CallIn(),
  new CallInDemote(),
  new CallInEnd(),
  new CallInForce(),
  new CallInPromote(),
  new CallInStart(),
  new HangUp(),
  new Money(),
  new MoneyAddServer(),
  new MoneyAddUser(),
  new MoneyGive(),
  new MoneyRemoveServer(),
  new MoneyRemoveUser(),
  new MoneySetServer(),
  new MoneySetUser(),
  new Submit(),
  new Vote(),
  new VoteEnd(),
  new VoteStart(),
];

function initializeApp(): void {
  if (Environment.config.devMode) {
    Log.info("Running in development mode.");
  }
  Log.info(
    `Initializing ${Environment.packageContext.name} (${Environment.packageContext.version ?? "NO VERSION"})...`,
  );

  // Ready Event
  Discord.client.once("ready", () => {
    ChannelCache.cacheGuilds(Discord.client.guilds.cache.values()).catch(
      (reason: unknown) => {
        Log.error("Failed to cache guild channels on ready.", reason);
      },
    );
    Discord.deployCommands(commands)
      .then(() => {
        Log.success("Discord bot is ready.");
      })
      .catch((reason: unknown) => {
        Log.error("Failed to initialize Discord bot.", reason);
      });
  });

  // Guild Create Event
  Discord.client.on("guildCreate", guild => {
    ChannelCache.cacheGuild(guild).catch((reason: unknown) => {
      Log.error("Failed to cache guild channels on guild create.", reason, {
        guild,
      });
    });
    Discord.deployCommands(commands, [guild.id])
      .then(() => {
        Log.success("Discord bot deployed to new guild.", { guild });
      })
      .catch((reason: unknown) => {
        Log.error("Failed to deploy Discord bot on new guild.", reason, {
          guild,
        });
      });
  });

  // Guild Delete Event
  Discord.client.on("guildDelete", guild => {
    ChannelCache.removeGuild(guild.id);
  });

  // Interaction Create Event
  Discord.client.on("interactionCreate", interaction => {
    if (!interaction.isCommand()) {
      return;
    }
    const interactionInfo: Record<string, unknown> = {
      channelId: interaction.channelId,
      command: interaction.commandName,
      createdAt: interaction.createdAt.toUTCString(),
      guild:
        interaction.guild !== null
          ? {
              id: interaction.guild.id,
              name: interaction.guild.name,
            }
          : null,
      id: interaction.id,
      user: {
        displayName: interaction.user.displayName,
        globalName: interaction.user.globalName,
        id: interaction.user.id,
        username: interaction.user.username,
      },
    };
    Log.info(`New interaction ${interaction.id}.`, interactionInfo);
    const interactionCommand: Command | undefined = commands.find(
      command => command.name === interaction.commandName,
    );
    if (interactionCommand === undefined) {
      Log.error(
        "Cannot handle interaction. Unknown command was provided.",
        interaction,
      );
      return;
    }
    ChannelCommandMessage.create(
      interaction,
      interactionCommand.shouldReplyPrivately,
    )
      .then(privateChannelMessage => {
        AccessUtils.authorizeCommandUse(
          interactionCommand,
          privateChannelMessage,
        )
          .then(hasAccess => {
            if (!hasAccess) {
              return;
            }
            return interactionCommand.execute(privateChannelMessage);
          })
          .then(() => {
            Log.success(`Completed interaction ${interaction.id}.`);
          })
          .catch((reason: unknown) => {
            Log.error("Could not complete command execution.", reason);
          });
      })
      .catch((reason: unknown) => {
        Log.error(
          "Could not create user channel interaction from command interaction.",
          reason,
        );
      });
  });

  // Voice State Update Event
  Discord.client.on("voiceStateUpdate", (oldState, newState) => {
    CallInUtils.enforceVoiceState(oldState, newState).catch(
      (reason: unknown) => {
        Log.error("Could not enforce call-in voice state.", reason, {
          guildId: newState.guild.id,
          userId: newState.member?.id ?? null,
        });
      },
    );
  });

  // Login
  Discord.client
    .login(Environment.config.discordBotToken)
    .then(() => {
      Log.debug("Discord bot logged in successfully.");
    })
    .catch((reason: unknown) => {
      Log.error("Failed to log into Discord.", reason);
    });
}

initializeApp();
