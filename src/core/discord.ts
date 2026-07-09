import * as discordJs from "discord.js";
import {
  AppErrorCode,
  ChannelMessage,
  CommandOptionType,
  Environment,
  Log,
} from ".";
import { Command } from "../core";

type GuildMembersOptions = {
  readonly includeBots?: boolean;
};

export class Discord {
  public static readonly embedDescriptionMaxLength: number = 4096;

  public static readonly messageContentMaxLength: number = 2000;

  private static __client: discordJs.Client | null = null;

  public static get client(): discordJs.Client {
    if (this.__client === null) {
      Log.debug("Creating Discord client...");
      this.__client = new discordJs.Client({
        intents: ["DirectMessages", "Guilds", "GuildMessages"],
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
      if (command.isGlobal) {
        if (command.name in globalCommandMap) {
          Log.throw(
            "Cannot deploy global commands. Names in command list are not unique.",
            { commandList },
          );
        }
        globalCommandMap[command.name] = slashCommandBuilder;
      }
      if (command.isGuild) {
        if (command.name in guildCommandMap) {
          Log.throw(
            "Cannot deploy guild commands. Names in command list are not unique.",
            { commandList },
          );
        }
        guildCommandMap[command.name] = slashCommandBuilder;
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

  public static async getGuildMembers(
    guildId: string,
    options: GuildMembersOptions = {},
  ): Promise<discordJs.GuildMember[]> {
    Log.debug("Retrieving Discord guild members...", { guildId, options });
    const guild: discordJs.Guild = await this.client.guilds.fetch(guildId);
    const members: discordJs.Collection<string, discordJs.GuildMember> =
      new discordJs.Collection();
    let after: string | undefined;
    let page: discordJs.Collection<string, discordJs.GuildMember>;
    do {
      page = await guild.members.list({
        after,
        cache: false,
        limit: 1000,
      });
      page.forEach(member => {
        members.set(member.id, member);
      });
      after = page.last()?.id;
    } while (page.size === 1000 && after !== undefined);

    const filteredMembers: discordJs.GuildMember[] = members
      .filter(member => options.includeBots === true || !member.user.bot)
      .map(member => member);
    Log.debug("Discord guild members retrieved successfully.", {
      guildId,
      memberCount: filteredMembers.length,
    });
    return filteredMembers;
  }

  public static async getGuildMembersByIds(
    guildId: string,
    userIds: string[],
    options: GuildMembersOptions = {},
  ): Promise<discordJs.GuildMember[]> {
    Log.debug("Retrieving Discord guild members by id...", {
      guildId,
      options,
      userIds,
    });
    const guild: discordJs.Guild = await this.client.guilds.fetch(guildId);
    const members: discordJs.GuildMember[] = [];
    for (const userId of userIds) {
      try {
        const member: discordJs.GuildMember = await guild.members.fetch({
          cache: false,
          force: true,
          user: userId,
        });
        if (options.includeBots === true || !member.user.bot) {
          members.push(member);
        }
      } catch (reason: unknown) {
        Log.debug("Discord guild member was not found.", {
          guildId,
          reason,
          userId,
        });
      }
    }
    Log.debug("Discord guild members retrieved successfully.", {
      guildId,
      memberCount: members.length,
    });
    return members;
  }

  public static async sendChannelMessage(
    channelId: string,
    messageCreateOptions: discordJs.MessageCreateOptions,
  ): Promise<ChannelMessage> {
    const safeMessageCreateOptions: discordJs.MessageCreateOptions =
      this.__sanitizeMessageCreateOptions(messageCreateOptions);
    Log.debug("Sending Discord channel message...", {
      channelId,
      messageCreateOptions: safeMessageCreateOptions,
    });
    const channel: discordJs.TextChannel = await this.__getChannel(channelId);
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
      this.__sanitizeBaseMessageOptions(options);
    Log.debug("Updating Discord channel message...", {
      channelId,
      messageId,
      options: safeOptions,
    });
    const channel: discordJs.TextChannel = await this.__getChannel(channelId);
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

  private static async __getChannel(
    channelId: string,
  ): Promise<discordJs.TextChannel> {
    Log.debug("Retrieving Discord channel...", { channelId });
    let channel: discordJs.Channel | null;
    try {
      channel = await this.client.channels.fetch(channelId);
    } catch (reason: unknown) {
      if (this.__isUnknownChannelError(reason)) {
        Log.throwError(
          AppErrorCode.DISCORD_CHANNEL_NOT_FOUND,
          "Cannot get Discord channel. ID was not found.",
          {
            channelId,
            reason,
          },
        );
      }
      Log.throw("Cannot get Discord channel. Failed to fetch channel.", {
        channelId,
        reason,
      });
    }
    if (channel === null) {
      Log.throwError(
        AppErrorCode.DISCORD_CHANNEL_NOT_FOUND,
        "Cannot get Discord channel. ID was not found.",
        { channelId },
      );
    }
    if (channel.type !== discordJs.ChannelType.GuildText) {
      Log.throw(
        "Cannot get Discord channel. Channel at ID was not a guild text channel.",
        { channel },
      );
    }
    Log.debug("Discord channel retrieved successfully.", { channel });
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

  private static __sanitizeBaseMessageOptions<
    T extends { allowedMentions?: discordJs.MessageMentionOptions },
  >(options: T): T {
    return {
      ...options,
      allowedMentions: {
        ...(options.allowedMentions ?? {}),
        parse: [],
      },
    } as T;
  }

  private static __sanitizeMessageCreateOptions(
    messageCreateOptions: discordJs.MessageCreateOptions,
  ): discordJs.MessageCreateOptions {
    if (
      messageCreateOptions.content !== undefined &&
      messageCreateOptions.content.length > this.messageContentMaxLength
    ) {
      Log.throwError(
        AppErrorCode.DISCORD_MESSAGE_CONTENT_TOO_LONG,
        "Cannot send Discord message. Content is too long.",
        {
          maxLength: this.messageContentMaxLength,
          messageCreateOptions,
        },
      );
    }
    return this.__sanitizeBaseMessageOptions(messageCreateOptions);
  }
}
