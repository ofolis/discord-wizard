import { DataController, InteractionController } from "../controllers";
import {
  AppError,
  AppErrorCode,
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandRegistrationType,
  Log,
} from "../core";
import { VotingState } from "../saveables";

export class VoteEnd implements Command {
  public readonly description: string = "Ends the open vote.";

  public readonly isAvailableToAllUsers: boolean = false;

  public readonly name: string = "voteend";

  public readonly options: CommandOption[] = [];

  public readonly registrationType: CommandRegistrationType =
    CommandRegistrationType.GUILD;

  public readonly shouldReplyPrivately: boolean = true;

  public async execute(message: ChannelCommandMessage): Promise<void> {
    const votingState: VotingState | null =
      DataController.loadActiveVotingState(message.member.guild.id);
    if (votingState === null) {
      await InteractionController.informError(
        message,
        "There is no open vote.",
      );
      return;
    }

    try {
      await InteractionController.announceVoteResults(
        votingState.channelId,
        votingState.getSortedResults(),
      );
    } catch (reason: unknown) {
      Log.error("Could not post vote results.", reason);
      const isMissingChannel: boolean = AppError.is(
        reason,
        AppErrorCode.DISCORD_CHANNEL_NOT_FOUND,
      );
      const isTooLong: boolean = AppError.is(
        reason,
        AppErrorCode.DISCORD_EMBED_DESCRIPTION_TOO_LONG,
      );
      if (isMissingChannel) {
        votingState.close();
        try {
          DataController.saveVotingState(votingState);
        } catch (saveReason: unknown) {
          Log.error("Could not close vote after missing channel.", saveReason);
          await InteractionController.informError(
            message,
            "Could not post the vote results, and the vote could not be ended. Contact an admin.",
          );
          return;
        }
        await InteractionController.informError(
          message,
          "Could not post the vote results because the vote channel no longer exists. The vote has been ended.",
        );
      } else if (isTooLong) {
        await InteractionController.informError(
          message,
          "The vote results are too long to display. The vote is still open. Contact an admin.",
        );
      } else {
        await InteractionController.informError(
          message,
          "Could not post the vote results. The vote is still open. Contact an admin.",
        );
      }
      return;
    }
    votingState.close();
    try {
      DataController.saveVotingState(votingState);
    } catch (reason: unknown) {
      Log.error("Could not close vote after posting results.", reason);
      await InteractionController.informError(
        message,
        "Vote results were posted, but the vote could not be ended. Contact an admin.",
      );
      return;
    }
    await InteractionController.informSuccess(message, "Vote ended.");
  }
}
