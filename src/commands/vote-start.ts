import { DataController, InteractionController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandOptionType,
  Log,
} from "../core";
import { VotingState } from "../saveables";

const optionsOptionName: string = "options";
const maxVotingOptions: number = 26;

export class VoteStart implements Command {
  public readonly description: string = "Starts a vote.";

  public readonly isGlobal: boolean = false;

  public readonly isGuild: boolean = true;

  public readonly isPrivate: boolean = true;

  public readonly name: string = "votestart";

  public readonly options: CommandOption[] = [
    {
      description: "Comma-separated vote options.",
      isRequired: true,
      name: optionsOptionName,
      type: CommandOptionType.STRING,
    },
  ];

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

    const optionString: string | undefined = message.getCommandOption(
      optionsOptionName,
      CommandOptionType.STRING,
    );
    const parsedOptions: string[] = this.__parseOptions(optionString);
    if (parsedOptions.length < 2) {
      await InteractionController.informError(
        message,
        "A vote needs at least two options.",
      );
      return;
    }
    if (parsedOptions.length > maxVotingOptions) {
      await InteractionController.informError(
        message,
        `A vote can have at most ${String(maxVotingOptions)} options.`,
      );
      return;
    }

    const votingState: VotingState = new VotingState({
      channelId: message.channelId,
      guildId: message.member.guild.id,
      options: parsedOptions,
    });
    try {
      await InteractionController.announceVoteStart(
        message.channelId,
        votingState,
      );
    } catch (reason: unknown) {
      Log.error("Could not post vote.", reason);
      const isTooLong: boolean =
        reason instanceof Error &&
        reason.message.includes("Description is too long");
      await InteractionController.informError(
        message,
        isTooLong
          ? "Vote options are too long to display. Please shorten the options and try again."
          : "Could not post the vote. Contact an admin.",
      );
      return;
    }
    DataController.saveVotingState(votingState);
    await InteractionController.informSuccess(message, "Vote started.");
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
