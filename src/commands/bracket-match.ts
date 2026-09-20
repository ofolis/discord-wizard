import { DataController, InteractionController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandOptionType,
  CommandRegistrationType,
  Log,
} from "../core";
import { BracketMatchSummary, BracketState } from "../saveables";

const matchOptionName: string = "match";
const winnerOptionName: string = "winner";

export class BracketMatch implements Command {
  public readonly description: string =
    "Records or clears a bracket match result.";

  public readonly isAvailableToAllUsers: boolean = false;

  public readonly name: string = "bracketmatch";

  public readonly options: CommandOption[] = [
    {
      description: "The match number.",
      isRequired: true,
      maxValue: Number.MAX_SAFE_INTEGER,
      minValue: 1,
      name: matchOptionName,
      type: CommandOptionType.INTEGER,
    },
    {
      description: "The winning participant number: 1 or 2.",
      isRequired: false,
      maxValue: 2,
      minValue: 1,
      name: winnerOptionName,
      type: CommandOptionType.INTEGER,
    },
  ];

  public readonly registrationType: CommandRegistrationType =
    CommandRegistrationType.GUILD;

  public readonly shouldReplyPrivately: boolean = true;

  public async execute(message: ChannelCommandMessage): Promise<void> {
    const bracketState: BracketState | null =
      DataController.loadActiveBracketState(message.member.guild.id);
    if (bracketState === null) {
      await InteractionController.informError(
        message,
        "There is no active bracket.",
      );
      return;
    }

    const matchNumber: number | undefined = message.getCommandOption(
      matchOptionName,
      CommandOptionType.INTEGER,
    );
    if (matchNumber === undefined) {
      await InteractionController.informError(message, "Enter a match number.");
      return;
    }

    const winnerPosition: number | undefined = message.getCommandOption(
      winnerOptionName,
      CommandOptionType.INTEGER,
    );
    if (winnerPosition === undefined) {
      await this.__clearMatchResult(message, bracketState, matchNumber);
      return;
    }

    await this.__setMatchResult(
      message,
      bracketState,
      matchNumber,
      winnerPosition,
    );
  }

  private async __announceCompletion(
    message: ChannelCommandMessage,
    bracketState: BracketState,
    didUpdateBracketPost: boolean,
  ): Promise<void> {
    try {
      await InteractionController.announceBracketComplete(
        bracketState.channelId,
        bracketState,
      );
    } catch (reason: unknown) {
      Log.error("Could not post bracket completion.", reason);
      await InteractionController.informSuccess(
        message,
        "Bracket completed, but the result could not be posted. Contact an admin.",
      );
      return;
    }
    try {
      DataController.deleteBracketState(bracketState.guildId);
    } catch (reason: unknown) {
      Log.error("Could not delete completed bracket state.", reason);
      await InteractionController.informSuccess(
        message,
        "Bracket completed, but the completed bracket could not be deleted. Contact an admin.",
      );
      return;
    }
    await InteractionController.informSuccess(
      message,
      didUpdateBracketPost
        ? "Bracket completed."
        : "Bracket completed, but the original post could not be updated. Contact an admin.",
    );
  }

  private async __clearMatchResult(
    message: ChannelCommandMessage,
    bracketState: BracketState,
    matchNumber: number,
  ): Promise<void> {
    const match: BracketMatchSummary | null =
      bracketState.getMatch(matchNumber);
    if (match === null) {
      await InteractionController.informError(
        message,
        "That match does not exist.",
      );
      return;
    }
    if (match.winnerPosition === null) {
      await InteractionController.informSuccess(
        message,
        "No bracket result to clear.",
      );
      return;
    }

    await this.__saveAndPostMatchResult(
      message,
      bracketState,
      matchNumber,
      null,
    );
  }

  private __normalizeWinnerPosition(winnerPosition: number): number | null {
    if (winnerPosition !== 1 && winnerPosition !== 2) {
      return null;
    }
    return winnerPosition;
  }

  private async __saveAndPostMatchResult(
    message: ChannelCommandMessage,
    bracketState: BracketState,
    matchNumber: number,
    winnerPosition: number | null,
  ): Promise<void> {
    if (!bracketState.setMatchResult(matchNumber, winnerPosition)) {
      await InteractionController.informError(
        message,
        "Could not update that match result.",
      );
      return;
    }

    if (bracketState.isComplete) {
      bracketState.close();
    }
    try {
      DataController.saveBracketState(bracketState);
    } catch (reason: unknown) {
      Log.error("Could not save bracket match result.", reason);
      await InteractionController.informError(
        message,
        "Could not save the bracket result. Contact an admin.",
      );
      return;
    }

    let didUpdateBracketPost: boolean = true;
    try {
      await InteractionController.updateBracketStart(bracketState);
    } catch (reason: unknown) {
      didUpdateBracketPost = false;
      Log.error("Could not update bracket post.", reason);
    }

    if (bracketState.isComplete) {
      await this.__announceCompletion(
        message,
        bracketState,
        didUpdateBracketPost,
      );
      return;
    }

    const updatedMatch: BracketMatchSummary | null =
      bracketState.getMatch(matchNumber);
    if (updatedMatch !== null) {
      try {
        await InteractionController.announceBracketResultChange(
          bracketState.channelId,
          bracketState,
          updatedMatch,
          winnerPosition === null ? "cleared" : "set",
        );
      } catch (reason: unknown) {
        Log.error("Could not post bracket match result.", reason);
        await InteractionController.informSuccess(
          message,
          didUpdateBracketPost
            ? "Bracket result saved, but the result could not be posted. Contact an admin."
            : "Bracket result saved, but the original post and result post could not be updated. Contact an admin.",
        );
        return;
      }
    }

    await InteractionController.informSuccess(
      message,
      didUpdateBracketPost
        ? "Bracket result saved."
        : "Bracket result saved, but the original post could not be updated. Contact an admin.",
    );
  }

  private async __setMatchResult(
    message: ChannelCommandMessage,
    bracketState: BracketState,
    matchNumber: number,
    winnerPosition: number,
  ): Promise<void> {
    const normalizedWinnerPosition: number | null =
      this.__normalizeWinnerPosition(winnerPosition);
    if (normalizedWinnerPosition === null) {
      await InteractionController.informError(
        message,
        "Enter `1` or `2` as the winner.",
      );
      return;
    }
    const match: BracketMatchSummary | null =
      bracketState.getMatch(matchNumber);
    if (match === null) {
      await InteractionController.informError(
        message,
        "That match does not exist.",
      );
      return;
    }
    if (!match.isReady) {
      await InteractionController.informError(
        message,
        "That match is waiting on an earlier result.",
      );
      return;
    }

    await this.__saveAndPostMatchResult(
      message,
      bracketState,
      matchNumber,
      normalizedWinnerPosition,
    );
  }
}
