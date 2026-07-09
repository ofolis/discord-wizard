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

export class MoneySetUser implements Command {
  public readonly description: string = "Sets a user's money.";

  public readonly isGlobal: boolean = false;

  public readonly isGuild: boolean = true;

  public readonly isPrivate: boolean = true;

  public readonly name: string = "moneysetuser";

  public readonly options: CommandOption[] = [
    {
      description: "The user to update.",
      isRequired: true,
      name: userOptionName,
      type: CommandOptionType.USER,
    },
    {
      description: "The money amount.",
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
        "Money can only be set for human users.",
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
    moneyState.setBalance(user.id, amountCents);

    try {
      DataController.saveMoneyState(moneyState);
    } catch (reason: unknown) {
      Log.error("Could not save user money update.", reason);
      await InteractionController.informError(
        message,
        "Could not update user money. Contact an admin.",
      );
      return;
    }

    await InteractionController.informSuccess(
      message,
      `Set ${user.displayName} to \`${MoneyUtils.format(amountCents)}\`.`,
    );
  }
}
