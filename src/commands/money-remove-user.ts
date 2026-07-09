import * as discordJs from "discord.js";
import { DataController, InteractionController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandOptionType,
  Log,
} from "../core";
import { MoneyUtils } from "../money-utils";
import { MoneyState } from "../saveables";

const amountOptionName: string = "amount";
const userOptionName: string = "user";

export class MoneyRemoveUser implements Command {
  public readonly description: string = "Removes money from a user.";

  public readonly isGlobal: boolean = false;

  public readonly isGuild: boolean = true;

  public readonly isPrivate: boolean = true;

  public readonly name: string = "moneyremoveuser";

  public readonly options: CommandOption[] = [
    {
      description: "The user to update.",
      isRequired: true,
      name: userOptionName,
      type: CommandOptionType.USER,
    },
    {
      description: "The money amount to remove.",
      isRequired: true,
      maxValue: Number.MAX_SAFE_INTEGER / 100,
      minValue: 0,
      name: amountOptionName,
      type: CommandOptionType.NUMBER,
    },
  ];

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
        "Money can only be removed from human users.",
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
    moneyState.addBalance(user.id, -amountCents);

    try {
      DataController.saveMoneyState(moneyState);
    } catch (reason: unknown) {
      Log.error("Could not save user money remove.", reason);
      await InteractionController.informError(
        message,
        "Could not update user money. Contact an admin.",
      );
      return;
    }

    await InteractionController.informSuccess(
      message,
      `Removed \`${MoneyUtils.format(amountCents)}\` from ${user.displayName}. New balance: \`${MoneyUtils.format(moneyState.getBalance(user.id))}\`.`,
    );
  }
}
