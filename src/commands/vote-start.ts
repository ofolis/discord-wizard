import { DataController, InteractionController } from "../controllers";
import {
  AppError,
  AppErrorCode,
  ChannelCommandMessage,
  ChannelMessage,
  Command,
  CommandOption,
  CommandOptionType,
  CommandRegistrationType,
  Log,
  Utils,
} from "../core";
import { VotingState } from "../saveables";

const optionsOptionName: string = "options";

export class VoteStart implements Command {
  public readonly description: string = "Starts a vote.";

  public readonly isAvailableToAllUsers: boolean = false;

  public readonly name: string = "votestart";

  public readonly options: CommandOption[] = [
    {
      description: "Comma-separated vote options.",
      isRequired: true,
      name: optionsOptionName,
      type: CommandOptionType.STRING,
    },
  ];

  public readonly registrationType: CommandRegistrationType =
    CommandRegistrationType.GUILD;

  public readonly shouldReplyPrivately: boolean = true;

  public async execute(message: ChannelCommandMessage): Promise<void> {
    if (
      DataController.loadActiveVotingState(message.member.guild.id) !== null
    ) {
      await InteractionController.informError(
        message,
        "A vote is already open.",
      );
      return;
    }

    const parsedOptions: string[] = Utils.parseCommaSeparatedList(
      message.getCommandOption(optionsOptionName, CommandOptionType.STRING),
    );
    if (parsedOptions.length < VotingState.minOptionCount) {
      await InteractionController.informError(
        message,
        "A vote needs at least two options.",
      );
      return;
    }
    if (parsedOptions.length > VotingState.maxOptionCount) {
      await InteractionController.informError(
        message,
        `A vote can have at most ${String(VotingState.maxOptionCount)} options.`,
      );
      return;
    }

    const votingState: VotingState = new VotingState({
      channelId: message.channelId,
      guildId: message.member.guild.id,
      options: parsedOptions,
    });
    try {
      DataController.saveVotingState(votingState);
    } catch (reason: unknown) {
      Log.error("Could not save new voting state.", reason);
      await InteractionController.informError(
        message,
        "Could not start the vote. Contact an admin.",
      );
      return;
    }

    let voteMessage: ChannelMessage;
    try {
      voteMessage = await InteractionController.announceVoteStart(
        message.channelId,
        votingState,
      );
    } catch (reason: unknown) {
      Log.error("Could not post vote.", reason);
      const isTooLong: boolean = AppError.is(
        reason,
        AppErrorCode.DISCORD_EMBED_DESCRIPTION_TOO_LONG,
      );
      let didCloseFailedVote: boolean = true;
      votingState.close();
      try {
        DataController.saveVotingState(votingState);
      } catch (rollbackReason: unknown) {
        didCloseFailedVote = false;
        Log.error("Could not close failed vote.", rollbackReason);
      }
      await InteractionController.informError(
        message,
        this.__formatPostVoteError(isTooLong, didCloseFailedVote),
      );
      return;
    }

    votingState.messageId = voteMessage.id;
    try {
      DataController.saveVotingState(votingState);
    } catch (reason: unknown) {
      Log.error("Could not save vote message ID.", reason);
      await InteractionController.informSuccess(
        message,
        "Vote started, but total vote updates will not be available. Contact an admin.",
      );
      return;
    }
    await InteractionController.informSuccess(message, "Vote started.");
  }

  private __formatPostVoteError(
    isTooLong: boolean,
    didCloseFailedVote: boolean,
  ): string {
    if (!didCloseFailedVote) {
      return "Could not post the vote, and the failed vote could not be closed. Contact an admin.";
    }
    if (isTooLong) {
      return "Vote options are too long to display. Please shorten the options and try again.";
    }
    return "Could not post the vote. Contact an admin.";
  }
}
