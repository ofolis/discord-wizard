import { DataController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandOptionType,
} from "../core";
import { PollState } from "../saveables";

const letterOptionName: string = "letter";

export class Vote implements Command {
  public readonly description: string = "Votes in the open poll.";

  public readonly isGlobal: boolean = false;

  public readonly isGuild: boolean = true;

  public readonly isPrivate: boolean = true;

  public readonly name: string = "vote";

  public readonly options: CommandOption[] = [
    {
      description: "The poll option letter.",
      isRequired: true,
      maxLength: 1,
      minLength: 1,
      name: letterOptionName,
      type: CommandOptionType.STRING,
    },
  ];

  public async execute(message: ChannelCommandMessage): Promise<void> {
    const pollState: PollState | null = DataController.loadActivePollState(
      message.member.guild.id,
    );
    if (pollState === null) {
      await message.update({
        content: "There is no open poll.",
      });
      return;
    }

    const letter: string | null = this.__parseLetter(
      message.getCommandOption(letterOptionName, CommandOptionType.STRING),
    );
    if (letter === null) {
      await message.update({
        content: "Vote must be a single letter.",
      });
      return;
    }
    if (!pollState.containsLetter(letter)) {
      await message.update({
        content: "That is not one of the poll option letters.",
      });
      return;
    }

    const option: string = pollState.castVote(message.user.id, letter);
    DataController.savePollState(pollState);
    await message.update({
      content: `Your vote was cast for \`${option}\`.`,
    });
  }

  private __parseLetter(value: string | undefined): string | null {
    if (value === undefined) {
      return null;
    }
    const trimmedValue: string = value.trim();
    if (!/^[a-z]$/i.test(trimmedValue)) {
      return null;
    }
    return trimmedValue.toUpperCase();
  }
}
