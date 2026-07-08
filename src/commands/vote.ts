import { DataController, InteractionController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandOptionType,
} from "../core";
import { VotingState } from "../saveables";

const letterOptionName: string = "letter";

export class Vote implements Command {
  public readonly description: string = "Submits your anonymous vote.";

  public readonly isGlobal: boolean = false;

  public readonly isGuild: boolean = true;

  public readonly isPrivate: boolean = true;

  public readonly name: string = "vote";

  public readonly options: CommandOption[] = [
    {
      description: "The vote option letter.",
      isRequired: true,
      maxLength: 1,
      name: letterOptionName,
      type: CommandOptionType.STRING,
    },
  ];

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

    DataController.saveVotingState(votingState);
    await InteractionController.informSuccess(
      message,
      `Your vote was cast for \`${option}\`.`,
    );
  }
}
