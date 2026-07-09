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
  CommandRegistrationType,
  Log,
} from "../core";
import { MoneyUtils } from "../money-utils";
import { MoneyState } from "../saveables";

const amountOptionName: string = "amount";

export class MoneyAddServer implements Command {
  public readonly description: string =
    "Adds money to every current server user.";

  public readonly isAvailableToAllUsers: boolean = false;

  public readonly name: string = "moneyaddserver";

  public readonly options: CommandOption[] = [
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
        { forceRefresh: true },
      );
    } catch (reason: unknown) {
      Log.error("Could not load server members for money add.", reason);
      await InteractionController.informError(
        message,
        "Could not load server users. Contact an admin.",
      );
      return;
    }

    const moneyState: MoneyState = DataController.loadOrCreateMoneyState(
      message.member.guild.id,
    );

    try {
      members.forEach(member => {
        moneyState.addBalance(member.user.id, amountCents);
      });
      DataController.saveMoneyState(moneyState);
    } catch (reason: unknown) {
      Log.error("Could not save server money add.", reason);
      await InteractionController.informError(
        message,
        "Could not update server money. Contact an admin.",
      );
      return;
    }

    await InteractionController.informSuccess(
      message,
      `Changed ${members.length.toString()} users by \`${MoneyUtils.format(amountCents)}\`.`,
    );
  }
}
