import * as discordJs from "discord.js";
import {
  AppErrorCode,
  ChannelMessage,
  CommandOptionType,
  CommandRegistrationType,
  Environment,
  Log,
} from ".";
import { Command } from "../core";
import {
  DISCORD_MESSAGE_CONTENT_MAX_LENGTH,
  sanitizeBaseMessageOptions,
} from "./message-options";

export class Discord {
  public static readonly embedDescriptionMaxLength: number = 4096;

  public static readonly messageContentMaxLength: number =
    DISCORD_MESSAGE_CONTENT_MAX_LENGTH;

  private static __client: discordJs.Client | null = null;

  public static get client(): discordJs.Client {
    if (this.__client === null) {
      Log.debug("Creating Discord client...");
      this.__client = new discordJs.Client({
        // This template provisions privileged intents in the Discord Developer
        // Portal up front; app-level feature flags should not mutate the shared
        // core client surface per deployment.
        intents: [
          "DirectMessages",
          "GuildMembers",
          "Guilds",
          "GuildMessages",
          "GuildVoiceStates",
          "MessageContent",
        ],
      });
      Log.debug("Discord client created successfully.", {
        client: this.__client,
      });
    }
    return this.__client;
  }

  public static async deployCommands(
    commandList: Command[],
    guildIds?: string[],
  ): Promise<void> {
    Log.debug("Deploying Discord commands...", { commandList, guildIds });
    const rest: discordJs.REST = new discordJs.REST({
      version: "10",
    }).setToken(Environment.config.discordBotToken);
    const globalCommandMap: Record<string, discordJs.SlashCommandBuilder> = {};
    const guildCommandMap: Record<string, discordJs.SlashCommandBuilder> = {};
    commandList.forEach(command => {
      const slashCommandBuilder: discordJs.SlashCommandBuilder =
        new discordJs.SlashCommandBuilder()
          .setName(command.name)
          .setDescription(command.description);
      command.options.forEach(option => {
        switch (option.type) {
          case CommandOptionType.BOOLEAN:
            slashCommandBuilder.addBooleanOption(booleanOption =>
              booleanOption
                .setName(option.name)
                .setDescription(option.description)
                .setRequired(option.isRequired),
            );
            break;
          case CommandOptionType.INTEGER:
            slashCommandBuilder.addIntegerOption(integerOption =>
              integerOption
                .setName(option.name)
                .setDescription(option.description)
                .setRequired(option.isRequired)
                .setMaxValue(option.maxValue)
                .setMinValue(option.minValue),
            );
            break;
          case CommandOptionType.NUMBER:
            slashCommandBuilder.addNumberOption(numberOption =>
              numberOption
                .setName(option.name)
                .setDescription(option.description)
                .setRequired(option.isRequired)
                .setMaxValue(option.maxValue)
                .setMinValue(option.minValue),
            );
            break;
          case CommandOptionType.STRING:
            slashCommandBuilder.addStringOption(stringOption => {
              const stringOptionBuilder: discordJs.SlashCommandStringOption =
                stringOption
                  .setName(option.name)
                  .setDescription(option.description)
                  .setRequired(option.isRequired);
              if (option.maxLength !== undefined) {
                stringOptionBuilder.setMaxLength(option.maxLength);
              }
              if (option.minLength !== undefined) {
                stringOptionBuilder.setMinLength(option.minLength);
              }
              return stringOptionBuilder;
            });
            break;
          case CommandOptionType.USER:
            slashCommandBuilder.addUserOption(userOption =>
              userOption
                .setName(option.name)
                .setDescription(option.description)
                .setRequired(option.isRequired),
            );
            break;
          default:
            Log.throw("Cannot build command. Unknown command option type.", {
              option,
            });
        }
      });
      switch (command.registrationType) {
        case CommandRegistrationType.GLOBAL:
          if (command.name in globalCommandMap) {
            Log.throw(
              "Cannot deploy global commands. Names in command list are not unique.",
              { commandList },
            );
          }
          globalCommandMap[command.name] = slashCommandBuilder;
          break;
        case CommandRegistrationType.GUILD:
          if (command.name in guildCommandMap) {
            Log.throw(
              "Cannot deploy guild commands. Names in command list are not unique.",
              { commandList },
            );
          }
          guildCommandMap[command.name] = slashCommandBuilder;
          break;
        default:
          Log.throw("Cannot deploy command. Unknown registration type.", {
            command,
          });
      }
    });
    guildIds = guildIds ?? Array.from(this.client.guilds.cache.keys());
    await this.__deployGlobalCommands(rest, Object.values(globalCommandMap));
    await this.__deployGuildCommands(
      rest,
      Object.values(guildCommandMap),
      guildIds,
    );
    Log.debug("Discord commands deployed successfully.");
  }

  public static formatAvatarUrl(
    user: Pick<discordJs.User, "avatar" | "id">,
  ): string | null {
    if (user.avatar === null) {
      return null;
    }
    return `https://cdn.discordapp.com/avatars/${user.id}/${user.avatar}.webp?size=240`;
  }

  public static formatChannelMentionString(): string {
    return "@everyone";
  }

  public static formatGuildMemberNameString(
    member: Pick<discordJs.GuildMember, "displayName">,
  ): string {
    return member.displayName;
  }

  public static formatUnknownUserNameString(
    user: Pick<discordJs.User, "id">,
  ): string {
    return `Unknown user (${user.id})`;
  }

  public static formatUserMentionString(
    user: Pick<discordJs.User, "id">,
  ): string {
    return `<@${user.id}>`;
  }

  public static formatUserNameString(
    user: Pick<discordJs.User, "globalName" | "username">,
  ): string {
    return user.globalName ?? user.username;
  }

  public static async getVoiceChannel(
    channelId: string,
  ): Promise<discordJs.VoiceBasedChannel | null> {
    const channel: discordJs.Channel | null = await this.__getRawChannel(
      channelId,
      "voice channel",
    );
    if (channel === null || !channel.isVoiceBased()) {
      return null;
    }
    return channel;
  }

  public static async sendChannelMessage(
    channelId: string,
    messageCreateOptions: discordJs.MessageCreateOptions,
  ): Promise<ChannelMessage> {
    const safeMessageCreateOptions: discordJs.MessageCreateOptions =
      sanitizeBaseMessageOptions(messageCreateOptions);
    Log.debug("Sending Discord channel message...", {
      channelId,
      messageCreateOptions: safeMessageCreateOptions,
    });
    const channel: discordJs.SendableChannels =
      await this.__getSendableChannel(channelId);
    const message: discordJs.Message = await channel.send(
      safeMessageCreateOptions,
    );
    Log.debug("Discord message sent successfully.", { message });
    const channelMessage: ChannelMessage = new ChannelMessage(
      message,
      channelId,
    );
    return channelMessage;
  }

  public static async updateChannelMessage(
    channelId: string,
    messageId: string,
    options: discordJs.MessageEditOptions,
  ): Promise<void> {
    const safeOptions: discordJs.MessageEditOptions =
      sanitizeBaseMessageOptions(options);
    Log.debug("Updating Discord channel message...", {
      channelId,
      messageId,
      options: safeOptions,
    });
    const channel: discordJs.TextBasedChannel =
      await this.__getTextBasedChannel(channelId);
    const message: discordJs.Message = await channel.messages.fetch(messageId);
    await message.edit(safeOptions);
    Log.debug("Discord channel message updated successfully.");
  }

  private static async __deployGlobalCommands(
    rest: discordJs.REST,
    commands: discordJs.SlashCommandBuilder[],
  ): Promise<void> {
    Log.debug("Deploying global commands to Discord...", { commands });
    await rest.put(
      discordJs.Routes.applicationCommands(
        Environment.config.discordApplicationId,
      ),
      {
        body: commands,
      },
    );
    Log.debug("Discord global commands deployed successfully.");
  }

  private static async __deployGuildCommands(
    rest: discordJs.REST,
    commands: discordJs.SlashCommandBuilder[],
    guildIds: string[],
  ): Promise<void> {
    Log.debug("Deploying commands to Discord guilds...", {
      commands,
      guildIds,
    });
    await Promise.all(
      guildIds.map(guildId =>
        rest.put(
          discordJs.Routes.applicationGuildCommands(
            Environment.config.discordApplicationId,
            guildId,
          ),
          {
            body: commands,
          },
        ),
      ),
    );
    Log.debug("Discord guild commands deployed successfully.");
  }

  private static async __getRawChannel(
    channelId: string,
    label: string,
  ): Promise<discordJs.Channel | null> {
    try {
      return await this.client.channels.fetch(channelId);
    } catch (reason: unknown) {
      if (this.__isUnknownChannelError(reason)) {
        Log.throwError(
          AppErrorCode.DISCORD_CHANNEL_NOT_FOUND,
          `Cannot get Discord ${label}. ID was not found.`,
          {
            channelId,
            reason,
          },
        );
      }
      Log.throw(`Cannot get Discord ${label}. Failed to fetch channel.`, {
        channelId,
        reason,
      });
    }
  }

  private static async __getSendableChannel(
    channelId: string,
  ): Promise<discordJs.SendableChannels> {
    Log.debug("Retrieving Discord sendable channel...", { channelId });
    const channel: discordJs.Channel | null = await this.__getRawChannel(
      channelId,
      "sendable channel",
    );
    if (channel === null) {
      Log.throwError(
        AppErrorCode.DISCORD_CHANNEL_NOT_FOUND,
        "Cannot get Discord sendable channel. ID was not found.",
        { channelId },
      );
    }
    if (!channel.isSendable()) {
      Log.throw(
        "Cannot get Discord sendable channel. Channel at ID was not sendable.",
        { channel },
      );
    }
    Log.debug("Discord sendable channel retrieved successfully.", { channel });
    return channel;
  }

  private static async __getTextBasedChannel(
    channelId: string,
  ): Promise<discordJs.TextBasedChannel> {
    Log.debug("Retrieving Discord text-based channel...", { channelId });
    const channel: discordJs.Channel | null = await this.__getRawChannel(
      channelId,
      "text-based channel",
    );
    if (channel === null) {
      Log.throwError(
        AppErrorCode.DISCORD_CHANNEL_NOT_FOUND,
        "Cannot get Discord text-based channel. ID was not found.",
        { channelId },
      );
    }
    if (!channel.isTextBased()) {
      Log.throw(
        "Cannot get Discord text-based channel. Channel at ID was not text-based.",
        { channel },
      );
    }
    Log.debug("Discord text-based channel retrieved successfully.", {
      channel,
    });
    return channel;
  }

  private static __isUnknownChannelError(reason: unknown): boolean {
    return (
      typeof reason === "object" &&
      reason !== null &&
      "code" in reason &&
      reason.code === 10003
    );
  }
}
