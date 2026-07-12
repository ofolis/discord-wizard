import { DataController, InteractionController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandOptionType,
  CommandRegistrationType,
  Json,
  Log,
  Utils,
} from "../core";
import { BettingState, MoneyState } from "../saveables";
import { BetUtils } from "./bet-utils";

const winnersOptionName: string = "winners";

export class BetEnd implements Command {
  public readonly description: string = "Ends the open bet and pays winners.";

  public readonly isAvailableToAllUsers: boolean = false;

  public readonly name: string = "betend";

  public readonly options: CommandOption[] = [
    {
      description: "Winning letter, or comma-separated letters for a tie.",
      isRequired: true,
      name: winnersOptionName,
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

    const winnerLetters: string[] = Utils.parseCommaSeparatedList(
      message.getCommandOption(winnersOptionName, CommandOptionType.STRING),
    );
    if (winnerLetters.length === 0) {
      await InteractionController.informError(
        message,
        "Enter at least one winning option letter.",
      );
      return;
    }
    let payouts: ReturnType<BettingState["calculatePayouts"]>;
    try {
      payouts = bettingState.calculatePayouts(winnerLetters);
    } catch (reason: unknown) {
      Log.error("Could not calculate bet payouts.", reason);
      await InteractionController.informError(
        message,
        "Could not calculate bet payouts. Contact an admin.",
      );
      return;
    }
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
    try {
      payouts.forEach(payout => {
        moneyState.addBalance(payout.userId, payout.payoutCents);
      });
    } catch (reason: unknown) {
      Log.error("Could not apply bet payouts.", reason);
      await InteractionController.informError(
        message,
        "Could not end the bet. Contact an admin.",
      );
      return;
    }
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
        bettingState.getOptionSummaries(),
        await BetUtils.getParticipantLabels(bettingState),
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
}
