import {
  DataController,
  GuildMemberController,
  InteractionController,
} from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandOptionType,
  Log,
} from "../core";
import { MoneyUtils } from "../money-utils";
import { MoneyState } from "../saveables";
import { AdminUtils } from "./admin-utils";

const amountOptionName: string = "amount";

export class MoneyRemoveServer implements Command {
  public readonly description: string =
    "Removes money from every current server user.";

  public readonly isGlobal: boolean = false;

  public readonly isGuild: boolean = true;

  public readonly isPrivate: boolean = true;

  public readonly name: string = "moneyremoveserver";

  public readonly options: CommandOption[] = [
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

    let members: Awaited<
      ReturnType<typeof GuildMemberController.getGuildMembers>
    >;
    try {
      members = await GuildMemberController.getGuildMembers(
        message.member.guild.id,
      );
    } catch (reason: unknown) {
      Log.error("Could not load server members for money remove.", reason);
      await InteractionController.informError(
        message,
        "Could not load server users. Contact an admin.",
      );
      return;
    }

    const moneyState: MoneyState = DataController.loadOrCreateMoneyState(
      message.member.guild.id,
    );
    const removals: {
      readonly amountCents: number;
      readonly userId: string;
    }[] = members.map(member => ({
      amountCents: Math.min(moneyState.getBalance(member.user.id), amountCents),
      userId: member.user.id,
    }));
    let totalRemovedCents: number = 0;
    for (const removal of removals) {
      totalRemovedCents += removal.amountCents;
      if (!Number.isSafeInteger(totalRemovedCents)) {
        await InteractionController.informError(
          message,
          "Could not calculate the server money removal. Contact an admin.",
        );
        return;
      }
    }
    removals.forEach(removal => {
      moneyState.addBalance(removal.userId, -removal.amountCents);
    });

    try {
      DataController.saveMoneyState(moneyState);
    } catch (reason: unknown) {
      Log.error("Could not save server money remove.", reason);
      await InteractionController.informError(
        message,
        "Could not update server money. Contact an admin.",
      );
      return;
    }

    await InteractionController.informSuccess(
      message,
      `Removed up to \`${MoneyUtils.format(amountCents)}\` from ${members.length.toString()} users. Total removed: \`${MoneyUtils.format(totalRemovedCents)}\`.`,
    );
  }
}
