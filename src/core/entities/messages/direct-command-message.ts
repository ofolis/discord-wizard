import * as discordJs from "discord.js";
import { DirectMessage } from ".";
import type { CommandOptionTypeMap } from "../..";
import { CommandOptionType, Log } from "../..";

export class DirectCommandMessage extends DirectMessage {
  private __commandOptions: discordJs.CommandInteractionOption[] | undefined;

  private constructor(
    interactionResponse: discordJs.InteractionResponse,
    user: discordJs.User,
    commandOptions?: discordJs.CommandInteractionOption[],
  ) {
    super(interactionResponse, user);
    this.__commandOptions = commandOptions;
    Log.debug("Direct command message context added.");
  }

  public static async create(
    commandInteraction: discordJs.CommandInteraction,
    shouldReplyPrivately: boolean,
  ): Promise<DirectCommandMessage> {
    Log.debug("Deferring command interaction...");
    const interactionResponse: discordJs.InteractionResponse =
      await commandInteraction.deferReply({
        ephemeral: shouldReplyPrivately,
      });
    Log.debug("Command interaction deferred successfully.");
    return new DirectCommandMessage(
      interactionResponse,
      commandInteraction.user,
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
      DirectCommandMessage.__isMissingOptionValue(option, type)
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
