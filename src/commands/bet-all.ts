import { DataController, InteractionController } from "../controllers";
import {
  AppError,
  AppErrorCode,
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandOptionType,
  Json,
  Log,
} from "../core";
import { MoneyUtils } from "../money-utils";
import { BettingState, MoneyState } from "../saveables";

const letterOptionName: string = "letter";

export class BetAll implements Command {
  public readonly description: string = "Wagers all of your money.";

  public readonly isGlobal: boolean = false;

  public readonly isGuild: boolean = true;

  public readonly isPrivate: boolean = true;

  public readonly name: string = "betall";

  public readonly options: CommandOption[] = [
    {
      description: "The bet option letter.",
      isRequired: true,
      maxLength: 1,
      minLength: 1,
      name: letterOptionName,
      type: CommandOptionType.STRING,
    },
  ];

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

    const userId: string = message.user.id;
    const previousWagerCents: number =
      bettingState.getWager(userId)?.amountCents ?? 0;
    const moneyState: MoneyState = DataController.loadOrCreateMoneyState(
      message.member.guild.id,
    );
    const previousMoneyStateJson: Json = moneyState.toJson();
    const amountCents: number =
      moneyState.getBalance(userId) + previousWagerCents;

    const option: string | null = bettingState.placeWager(
      userId,
      message.getCommandOption(letterOptionName, CommandOptionType.STRING),
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
      Log.error("Could not save all-in wager.", reason);
      await InteractionController.informError(
        message,
        "Could not save your wager. Contact an admin.",
      );
      return;
    }

    try {
      await InteractionController.updateBetStart(bettingState, {
        [userId]: message.member.displayName,
      });
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

    if (amountCents > 0) {
      try {
        await InteractionController.announceAllIn(message.channelId, {
          option,
          userName: message.member.displayName,
        });
      } catch (reason: unknown) {
        Log.error("Could not announce all-in wager.", reason);
        await InteractionController.informError(
          message,
          "Your wager was saved, but the all-in announcement could not be posted. Contact an admin.",
        );
        return;
      }
    }

    await InteractionController.informSuccess(
      message,
      amountCents === 0
        ? "Your wager was removed."
        : `Your all-in wager of \`${MoneyUtils.format(amountCents)}\` was placed on \`${option}\`.`,
    );
  }
}
