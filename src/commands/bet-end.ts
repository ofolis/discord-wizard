import { DataController, InteractionController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandOptionType,
  Json,
  Log,
} from "../core";
import { BettingState, MoneyState } from "../saveables";
import { AdminUtils } from "./admin-utils";

const winnersOptionName: string = "winners";

export class BetEnd implements Command {
  public readonly description: string = "Ends the open bet and pays winners.";

  public readonly isGlobal: boolean = false;

  public readonly isGuild: boolean = true;

  public readonly isPrivate: boolean = true;

  public readonly name: string = "betend";

  public readonly options: CommandOption[] = [
    {
      description: "Winning letter, or comma-separated letters for a tie.",
      isRequired: true,
      name: winnersOptionName,
      type: CommandOptionType.STRING,
    },
  ];

  public async execute(message: ChannelCommandMessage): Promise<void> {
    if (!(await AdminUtils.requireAdministrator(message))) {
      return;
    }

    const bettingState: BettingState | null =
      DataController.loadActiveBettingState(message.member.guild.id);
    if (bettingState === null) {
      await InteractionController.informError(message, "There is no open bet.");
      return;
    }

    const winnerLetters: string[] = this.__parseWinners(
      message.getCommandOption(winnersOptionName, CommandOptionType.STRING),
    );
    const payouts: ReturnType<BettingState["calculatePayouts"]> =
      bettingState.calculatePayouts(winnerLetters);
    if (payouts === null) {
      await InteractionController.informError(
        message,
        "That is not one of the bet option letters.",
      );
      return;
    }

    const moneyState: MoneyState = DataController.loadOrCreateMoneyState(
      message.member.guild.id,
    );
    const previousBettingStateJson: Json = bettingState.toJson();
    payouts.forEach(payout => {
      moneyState.addBalance(payout.userId, payout.payoutCents);
    });
    bettingState.close();

    try {
      DataController.saveBetResultStateChange(
        bettingState,
        moneyState,
        previousBettingStateJson,
      );
    } catch (reason: unknown) {
      Log.error("Could not save bet results.", reason);
      await InteractionController.informError(
        message,
        "Could not end the bet. Contact an admin.",
      );
      return;
    }

    try {
      await InteractionController.announceBetResults(
        bettingState.channelId,
        payouts,
        this.__getWinningOptions(bettingState, winnerLetters),
        {
          [message.user.id]: message.member.displayName,
        },
        this.__getBalancesByUserId(moneyState, payouts),
      );
    } catch (reason: unknown) {
      Log.error("Could not post bet results.", reason);
      await InteractionController.informError(
        message,
        "The bet ended, but the results could not be posted. Contact an admin.",
      );
      return;
    }

    await InteractionController.informSuccess(message, "Bet ended.");
  }

  private __getBalancesByUserId(
    moneyState: MoneyState,
    payouts: NonNullable<ReturnType<BettingState["calculatePayouts"]>>,
  ): Record<string, number> {
    const balancesByUserId: Record<string, number> = {};
    payouts.forEach(payout => {
      balancesByUserId[payout.userId] = moneyState.getBalance(payout.userId);
    });
    return balancesByUserId;
  }

  private __getWinningOptions(
    bettingState: BettingState,
    winnerLetters: string[],
  ): { readonly letter: string; readonly option: string }[] {
    const normalizedWinnerLetters: string[] = winnerLetters
      .map(winnerLetter => winnerLetter.trim().toUpperCase())
      .filter(
        (winnerLetter, index, letters) =>
          letters.indexOf(winnerLetter) === index,
      );
    return bettingState
      .getOptionSummaries()
      .filter(summary => normalizedWinnerLetters.includes(summary.letter))
      .map(summary => ({
        letter: summary.letter,
        option: summary.option,
      }));
  }

  private __parseWinners(winnerString: string | undefined): string[] {
    if (winnerString === undefined) {
      return [];
    }
    return winnerString
      .split(",")
      .map(winner => winner.trim())
      .filter(winner => winner.length > 0);
  }
}
