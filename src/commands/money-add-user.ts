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
    const user: discordJs.User | undefined = message.getCommandOption(
      userOptionName,
      CommandOptionType.USER,
    );
    const amountCents: number | null = MoneyUtils.parseAmountCents(
      message.getCommandOption(amountOptionName, CommandOptionType.NUMBER),
    );
    if (user === undefined || user.bot) {
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
      moneyState.addBalance(user.id, amountCents);
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
      `Changed ${Discord.formatUserNameString(user)} by \`${MoneyUtils.format(amountCents)}\`. New balance: \`${MoneyUtils.format(moneyState.getBalance(user.id))}\`.`,
    );
  }
}
