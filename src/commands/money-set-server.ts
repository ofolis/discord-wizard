import { DataController, InteractionController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandOptionType,
  Discord,
  Log,
} from "../core";
import { MoneyUtils } from "../money-utils";
import { MoneyState } from "../saveables";
import { AdminUtils } from "./admin-utils";

const amountOptionName: string = "amount";

export class MoneySetServer implements Command {
  public readonly description: string =
    "Sets every current server user's money.";

  public readonly isGlobal: boolean = false;

  public readonly isGuild: boolean = true;

  public readonly isPrivate: boolean = true;

  public readonly name: string = "moneysetserver";

  public readonly options: CommandOption[] = [
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
    if (!(await AdminUtils.requireAdministrator(message))) {
      return;
    }

    const amountCents: number | null = MoneyUtils.parseAmountCents(
      message.getCommandOption(amountOptionName, CommandOptionType.NUMBER),
    );
    if (amountCents === null) {
      await InteractionController.informError(
        message,
        "Money amount must be zero or greater.",
      );
      return;
    }

    let members: Awaited<ReturnType<typeof Discord.getGuildMembers>>;
    try {
      members = await Discord.getGuildMembers(message.member.guild.id);
    } catch (reason: unknown) {
      Log.error("Could not load server members for money update.", reason);
      await InteractionController.informError(
        message,
        "Could not load server users. Contact an admin.",
      );
      return;
    }

    const moneyState: MoneyState = DataController.loadOrCreateMoneyState(
      message.member.guild.id,
    );
    members.forEach(member => {
      moneyState.setBalance(member.user.id, amountCents);
    });

    try {
      DataController.saveMoneyState(moneyState);
    } catch (reason: unknown) {
      Log.error("Could not save server money update.", reason);
      await InteractionController.informError(
        message,
        "Could not update server money. Contact an admin.",
      );
      return;
    }

    await InteractionController.informSuccess(
      message,
      `Set ${members.length.toString()} users to \`${MoneyUtils.format(amountCents)}\`.`,
    );
  }
}
