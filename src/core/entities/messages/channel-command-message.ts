import * as discordJs from "discord.js";
import { ChannelMessage } from ".";
import type { CommandOptionTypeMap } from "../..";
import { CommandOptionType, Log } from "../..";

export class ChannelCommandMessage extends ChannelMessage {
  private __commandOptions: discordJs.CommandInteractionOption[] | undefined;

  private __guildMember: discordJs.GuildMember;

  private __user: discordJs.User;

  private constructor(
    interactionResponse: discordJs.InteractionResponse,
    channelId: string,
    user: discordJs.User,
    guildMember: discordJs.GuildMember,
    commandOptions?: discordJs.CommandInteractionOption[],
  ) {
    super(interactionResponse, channelId);
    this.__commandOptions = commandOptions;
    this.__guildMember = guildMember;
    this.__user = user;
    this._buttonInteractionFilter = (i): boolean =>
      i.user.id === this.__user.id;
    Log.debug("Channel command message context added.");
  }

  public get member(): discordJs.GuildMember {
    return this.__guildMember;
  }

  public get user(): discordJs.User {
    return this.__user;
  }

  public static async create(
    commandInteraction: discordJs.CommandInteraction,
    shouldReplyPrivately: boolean,
  ): Promise<ChannelCommandMessage> {
    if (!(commandInteraction.member instanceof discordJs.GuildMember)) {
      Log.throw(
        "Cannot create channel command message. Member is not a Discord guild member instance.",
      );
    }
    Log.debug("Deferring command interaction...");
    const interactionResponse: discordJs.InteractionResponse =
      await commandInteraction.deferReply({
        ephemeral: shouldReplyPrivately,
      });
    Log.debug("Command interaction deferred successfully.");
    return new ChannelCommandMessage(
      interactionResponse,
      commandInteraction.channelId,
      commandInteraction.user,
      commandInteraction.member,
      [...commandInteraction.options.data],
    );
  }

  private static __isMissingOptionValue(
    option: discordJs.CommandInteractionOption,
    type: CommandOptionType,
  ): boolean {
    if (type === CommandOptionType.USER) {
      const userOption: discordJs.User | null | undefined = (
        option as { readonly user?: discordJs.User | null }
      ).user;
      return userOption === null || userOption === undefined;
    }
    return option.value === undefined;
  }

  public getCommandOption<T extends CommandOptionType>(
    name: string,
    type: T,
  ): CommandOptionTypeMap[T] | undefined {
    if (this.__commandOptions === undefined) {
      Log.throw(
        "Cannot get command option. Command options have not been set.",
      );
    }
    const option: discordJs.CommandInteractionOption | undefined =
      this.__commandOptions.find(opt => opt.name === name);
    if (
      option === undefined ||
      ChannelCommandMessage.__isMissingOptionValue(option, type)
    ) {
      // Option is intentionally undefined
      return undefined;
    }
    const isValidType: boolean =
      (type === CommandOptionType.BOOLEAN &&
        option.type === discordJs.ApplicationCommandOptionType.Boolean &&
        typeof option.value === "boolean") ||
      (type === CommandOptionType.INTEGER &&
        option.type === discordJs.ApplicationCommandOptionType.Integer &&
        typeof option.value === "number") ||
      (type === CommandOptionType.NUMBER &&
        option.type === discordJs.ApplicationCommandOptionType.Number &&
        typeof option.value === "number") ||
      (type === CommandOptionType.STRING &&
        option.type === discordJs.ApplicationCommandOptionType.String &&
        typeof option.value === "string") ||
      (type === CommandOptionType.USER &&
        option.type === discordJs.ApplicationCommandOptionType.User &&
        option.user instanceof discordJs.User);
    if (!isValidType) {
      Log.throw("Cannot get command option. Type mismatch.", {
        expectedType: type,
        receivedData: option,
      });
    }
    if (type === CommandOptionType.USER) {
      return option.user as CommandOptionTypeMap[T];
    }
    return option.value as CommandOptionTypeMap[T];
  }
}
