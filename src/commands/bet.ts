import { DataController, InteractionController } from "../controllers";
import {
  AppError,
  AppErrorCode,
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandOptionType,
  CommandRegistrationType,
  Json,
  Log,
} from "../core";
import { MoneyUtils } from "../money-utils";
import { BettingState, MoneyState } from "../saveables";

const amountOptionName: string = "amount";
const letterOptionName: string = "letter";

export class Bet implements Command {
  public readonly description: string = "Places or removes your wager.";

  public readonly isAvailableToAllUsers: boolean = true;

  public readonly name: string = "bet";

  public readonly options: CommandOption[] = [
    {
      description: "The money amount to wager. Use 0 to remove your wager.",
      isRequired: true,
      maxValue: Number.MAX_SAFE_INTEGER / 100,
      minValue: 0,
      name: amountOptionName,
      type: CommandOptionType.NUMBER,
    },
    {
      description: "The bet option letter.",
      isRequired: true,
      maxLength: 1,
      minLength: 1,
      name: letterOptionName,
      type: CommandOptionType.STRING,
    },
  ];

  public readonly registrationType: CommandRegistrationType =
    CommandRegistrationType.GUILD;

  public readonly shouldReplyPrivately: boolean = true;

  public async execute(message: ChannelCommandMessage): Promise<void> {
    const bettingState: BettingState | null =
      DataController.loadActiveBettingState(message.member.guild.id);
    if (bettingState === null) {
      await InteractionController.informError(message, "There is no open bet.");
      return;
    }
    if (bettingState.isLocked) {
      await InteractionController.informError(message, "The bet is locked.");
      return;
    }

    const amountCents: number | null = MoneyUtils.parseAmountCents(
      message.getCommandOption(amountOptionName, CommandOptionType.NUMBER),
    );
    if (amountCents === null) {
      await InteractionController.informError(
        message,
        "Wager amount must be zero or greater.",
      );
      return;
    }
    const letter: string | undefined = message.getCommandOption(
      letterOptionName,
      CommandOptionType.STRING,
    );
    if (letter === undefined) {
      await InteractionController.informError(
        message,
        "Enter a bet option letter.",
      );
      return;
    }

    const userId: string = message.user.id;
    const previousWagerCents: number =
      bettingState.getWager(userId, letter)?.amountCents ?? 0;
    const moneyState: MoneyState = DataController.loadOrCreateMoneyState(
      message.member.guild.id,
    );
    const previousMoneyStateJson: Json = moneyState.toJson();
    const availableCents: number =
      moneyState.getBalance(userId) + previousWagerCents;
    if (!Number.isSafeInteger(availableCents)) {
      await InteractionController.informError(
        message,
        "Could not calculate your available money. Contact an admin.",
      );
      return;
    }
    if (amountCents > availableCents) {
      await InteractionController.informError(
        message,
        `You only have \`${MoneyUtils.format(availableCents)}\` available.`,
      );
      return;
    }

    const option: string | null = bettingState.placeWager(
      userId,
      letter,
      amountCents,
    );
    if (option === null) {
      await InteractionController.informError(
        message,
        "That is not one of the bet option letters.",
      );
      return;
    }
    moneyState.addBalance(userId, previousWagerCents - amountCents);

    try {
      DataController.saveWagerStateChange(
        bettingState,
        moneyState,
        previousMoneyStateJson,
      );
    } catch (reason: unknown) {
      Log.error("Could not save wager.", reason);
      await InteractionController.informError(
        message,
        "Could not save your wager. Contact an admin.",
      );
      return;
    }

    try {
      await InteractionController.updateBetStart(bettingState);
    } catch (reason: unknown) {
      Log.error("Could not update bet total.", reason);
      const isMissingChannel: boolean = AppError.is(
        reason,
        AppErrorCode.DISCORD_CHANNEL_NOT_FOUND,
      );
      await InteractionController.informError(
        message,
        isMissingChannel
          ? "Your wager was saved, but the bet channel was not found. Contact an admin."
          : "Your wager was saved, but the bet message could not be updated. Contact an admin.",
      );
      return;
    }

    await InteractionController.informSuccess(
      message,
      amountCents === 0
        ? previousWagerCents === 0
          ? "You did not have a wager to remove."
          : "Your wager was removed."
        : `Your wager of \`${MoneyUtils.format(amountCents)}\` was placed on \`${option}\`.`,
    );
  }
}
