import * as discordJs from "discord.js";
import { DataController, InteractionController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandOptionType,
  CommandRegistrationType,
  Discord,
  Log,
} from "../core";
import { MoneyUtils } from "../money-utils";
import { MoneyState } from "../saveables";

const amountOptionName: string = "amount";
const userOptionName: string = "user";

export class MoneyAddUser implements Command {
  public readonly description: string = "Adds money to a user.";

  public readonly isAvailableToAllUsers: boolean = false;

  public readonly name: string = "moneyadduser";

  public readonly options: CommandOption[] = [
    {
      description: "The user to update.",
      isRequired: true,
      name: userOptionName,
      type: CommandOptionType.USER,
    },
    {
      description: "The money amount to add.",
      isRequired: true,
      maxValue: Number.MAX_SAFE_INTEGER / 100,
      minValue: 0,
      name: amountOptionName,
      type: CommandOptionType.NUMBER,
    },
  ];

  public readonly registrationType: CommandRegistrationType =
    CommandRegistrationType.GUILD;

  public readonly shouldReplyPrivately: boolean = true;

  public async execute(message: ChannelCommandMessage): Promise<void> {
    const member: discordJs.GuildMember | undefined =
      await message.getGuildMemberCommandOption(userOptionName);
    const amountCents: number | null = MoneyUtils.parseAmountCents(
      message.getCommandOption(amountOptionName, CommandOptionType.NUMBER),
    );
    if (member === undefined) {
      await InteractionController.informError(
        message,
        "That user is not available on this server.",
      );
      return;
    }
    if (member.user.bot) {
      await InteractionController.informError(
        message,
        "Money can only be added to human users.",
      );
      return;
    }
    if (amountCents === null) {
      await InteractionController.informError(
        message,
        "Money amount must be zero or greater.",
      );
      return;
    }

    const moneyState: MoneyState = DataController.loadOrCreateMoneyState(
      message.member.guild.id,
    );

    try {
      moneyState.addBalance(member.user.id, amountCents);
      DataController.saveMoneyState(moneyState);
    } catch (reason: unknown) {
      Log.error("Could not save user money add.", reason);
      await InteractionController.informError(
        message,
        "Could not update user money. Contact an admin.",
      );
      return;
    }

    await InteractionController.informSuccess(
      message,
      `Changed ${Discord.formatGuildMemberNameString(member)} by \`${MoneyUtils.format(amountCents)}\`. New balance: \`${MoneyUtils.format(moneyState.getBalance(member.user.id))}\`.`,
    );
  }
}
