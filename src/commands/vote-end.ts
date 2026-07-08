import { DataController, InteractionController } from "../controllers";
import { ChannelCommandMessage, Command, CommandOption, Log } from "../core";
import { VotingState } from "../saveables";

export class VoteEnd implements Command {
  public readonly description: string = "Ends the open vote.";

  public readonly isGlobal: boolean = false;

  public readonly isGuild: boolean = true;

  public readonly isPrivate: boolean = true;

  public readonly name: string = "voteend";

  public readonly options: CommandOption[] = [];

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
      await InteractionController.informError(
        message,
        "Could not post the vote results. The vote is still open. Contact an admin.",
      );
      return;
    }
    votingState.close();
    DataController.saveVotingState(votingState);
    await InteractionController.informSuccess(message, "Vote ended.");
  }
}
