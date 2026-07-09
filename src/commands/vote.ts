import { DataController, InteractionController } from "../controllers";
import {
  AppError,
  AppErrorCode,
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandOptionType,
  CommandRegistrationType,
  Log,
} from "../core";
import { VotingState } from "../saveables";

const letterOptionName: string = "letter";

export class Vote implements Command {
  public readonly description: string = "Submits your anonymous vote.";

  public readonly isAvailableToAllUsers: boolean = true;

  public readonly name: string = "vote";

  public readonly options: CommandOption[] = [
    {
      description: "The vote option letter.",
      isRequired: true,
      maxLength: 1,
      minLength: 1,
      name: letterOptionName,
      type: CommandOptionType.STRING,
    },
  ];

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

    const option: string | null = votingState.castVote(
      message.user.id,
      message.getCommandOption(letterOptionName, CommandOptionType.STRING),
    );
    if (option === null) {
      await InteractionController.informError(
        message,
        "That is not one of the vote option letters.",
      );
      return;
    }

    try {
      DataController.saveVotingState(votingState);
    } catch (reason: unknown) {
      Log.error("Could not save vote.", reason);
      await InteractionController.informError(
        message,
        "Could not save your vote. Contact an admin.",
      );
      return;
    }
    try {
      await InteractionController.updateVoteStart(votingState);
    } catch (reason: unknown) {
      Log.error("Could not update vote total.", reason);
      const isMissingChannel: boolean = AppError.is(
        reason,
        AppErrorCode.DISCORD_CHANNEL_NOT_FOUND,
      );
      await InteractionController.informError(
        message,
        isMissingChannel
          ? "Your vote was cast, but the vote channel was not found. Contact an admin."
          : "Your vote was cast, but the vote message could not be updated. Contact an admin.",
      );
      return;
    }
    await InteractionController.informSuccess(
      message,
      `Your vote was cast for \`${option}\`.`,
    );
  }
}
