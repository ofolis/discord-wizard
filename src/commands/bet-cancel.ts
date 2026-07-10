import { DataController, InteractionController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandRegistrationType,
  Json,
  Log,
} from "../core";
import { BettingState, MoneyState } from "../saveables";

export class BetCancel implements Command {
  public readonly description: string =
    "Cancels the open bet and refunds wagers.";

  public readonly isAvailableToAllUsers: boolean = false;

  public readonly name: string = "betcancel";

  public readonly options: CommandOption[] = [];

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

    const moneyState: MoneyState = DataController.loadOrCreateMoneyState(
      message.member.guild.id,
    );
    const previousMoneyStateJson: Json = moneyState.toJson();
    try {
      bettingState.getRefunds().forEach(refund => {
        moneyState.addBalance(refund.userId, refund.amountCents);
      });
    } catch (reason: unknown) {
      Log.error("Could not apply bet refunds.", reason);
      await InteractionController.informError(
        message,
        "Could not cancel the bet. Contact an admin.",
      );
      return;
    }

    try {
      DataController.saveBetCancelStateChange(
        bettingState,
        moneyState,
        previousMoneyStateJson,
      );
    } catch (reason: unknown) {
      Log.error("Could not save bet cancellation.", reason);
      await InteractionController.informError(
        message,
        "Could not cancel the bet. Contact an admin.",
      );
      return;
    }

    if (bettingState.messageId !== null) {
      try {
        await InteractionController.updateBetCanceled(bettingState);
      } catch (reason: unknown) {
        Log.error("Could not update canceled bet post.", reason);
        await InteractionController.informSuccess(
          message,
          "Bet canceled and wagers refunded, but the original post could not be updated. Contact an admin.",
        );
        return;
      }
    }

    await InteractionController.informSuccess(
      message,
      "Bet canceled and wagers refunded.",
    );
  }
}
