import { DataController, InteractionController } from "../controllers";
import {
  AppError,
  AppErrorCode,
  ChannelCommandMessage,
  ChannelMessage,
  Command,
  CommandOption,
  CommandOptionType,
  Log,
} from "../core";
import { BettingState } from "../saveables";

const optionsOptionName: string = "options";

export class BetStart implements Command {
  public readonly description: string = "Starts a bet.";

  public readonly isGlobal: boolean = false;

  public readonly isGuild: boolean = true;

  public readonly isPrivate: boolean = true;

  public readonly name: string = "betstart";

  public readonly options: CommandOption[] = [
    {
      description: "Comma-separated bet options.",
      isRequired: true,
      name: optionsOptionName,
      type: CommandOptionType.STRING,
    },
  ];

  public async execute(message: ChannelCommandMessage): Promise<void> {
    if (
      DataController.loadActiveBettingState(message.member.guild.id) !== null
    ) {
      await InteractionController.informError(
        message,
        "A bet is already open.",
      );
      return;
    }

    const parsedOptions: string[] = this.__parseOptions(
      message.getCommandOption(optionsOptionName, CommandOptionType.STRING),
    );
    if (parsedOptions.length < BettingState.minOptionCount) {
      await InteractionController.informError(
        message,
        "A bet needs at least two options.",
      );
      return;
    }
    if (parsedOptions.length > BettingState.maxOptionCount) {
      await InteractionController.informError(
        message,
        `A bet can have at most ${String(BettingState.maxOptionCount)} options.`,
      );
      return;
    }

    const bettingState: BettingState = new BettingState({
      channelId: message.channelId,
      guildId: message.member.guild.id,
      options: parsedOptions,
    });
    try {
      DataController.saveBettingState(bettingState);
    } catch (reason: unknown) {
      Log.error("Could not save new betting state.", reason);
      await InteractionController.informError(
        message,
        "Could not start the bet. Contact an admin.",
      );
      return;
    }

    let betMessage: ChannelMessage;
    try {
      betMessage = await InteractionController.announceBetStart(
        message.channelId,
        bettingState,
        {},
      );
    } catch (reason: unknown) {
      Log.error("Could not post bet.", reason);
      const isTooLong: boolean = AppError.is(
        reason,
        AppErrorCode.DISCORD_CARD_DESCRIPTION_TOO_LONG,
      );
      let didCloseFailedBet: boolean = true;
      bettingState.close();
      try {
        DataController.saveBettingState(bettingState);
      } catch (rollbackReason: unknown) {
        didCloseFailedBet = false;
        Log.error("Could not close failed bet.", rollbackReason);
      }
      await InteractionController.informError(
        message,
        this.__formatPostBetError(isTooLong, didCloseFailedBet),
      );
      return;
    }

    bettingState.messageId = betMessage.id;
    try {
      DataController.saveBettingState(bettingState);
    } catch (reason: unknown) {
      Log.error("Could not save bet message ID.", reason);
      await InteractionController.informSuccess(
        message,
        "Bet started, but total wager updates will not be available. Contact an admin.",
      );
      return;
    }
    await InteractionController.informSuccess(message, "Bet started.");
  }

  private __formatPostBetError(
    isTooLong: boolean,
    didCloseFailedBet: boolean,
  ): string {
    if (!didCloseFailedBet) {
      return "Could not post the bet, and the failed bet could not be closed. Contact an admin.";
    }
    if (isTooLong) {
      return "Bet options are too long to display. Please shorten the options and try again.";
    }
    return "Could not post the bet. Contact an admin.";
  }

  private __parseOptions(optionString: string | undefined): string[] {
    if (optionString === undefined) {
      return [];
    }
    return optionString
      .split(",")
      .map(option => option.trim())
      .filter(option => option.length > 0);
  }
}
