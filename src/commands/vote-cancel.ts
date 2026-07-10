import { DataController, InteractionController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandRegistrationType,
  Log,
} from "../core";
import { VotingState } from "../saveables";

export class VoteCancel implements Command {
  public readonly description: string = "Cancels the open vote.";

  public readonly isAvailableToAllUsers: boolean = false;

  public readonly name: string = "votecancel";

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
      DataController.deleteVotingState(votingState.guildId);
    } catch (reason: unknown) {
      Log.error("Could not delete voting state.", reason);
      await InteractionController.informError(
        message,
        "Could not cancel the vote. Contact an admin.",
      );
      return;
    }

    if (votingState.messageId !== null) {
      try {
        await InteractionController.updateVoteCanceled(votingState);
      } catch (reason: unknown) {
        Log.error("Could not update canceled vote post.", reason);
        await InteractionController.informSuccess(
          message,
          "Vote canceled, but the original post could not be updated. Contact an admin.",
        );
        return;
      }
    }

    await InteractionController.informSuccess(message, "Vote canceled.");
  }
}
