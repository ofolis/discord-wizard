import { DataController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandOptionType,
  Discord,
  Log,
} from "../core";
import { PollState } from "../saveables";

const optionsOptionName: string = "options";
const maxPollOptions: number = 26;

export class PollOpen implements Command {
  public readonly description: string = "Opens a poll.";

  public readonly isGlobal: boolean = false;

  public readonly isGuild: boolean = true;

  public readonly isPrivate: boolean = true;

  public readonly name: string = "pollopen";

  public readonly options: CommandOption[] = [
    {
      description: "Comma-separated poll options.",
      isRequired: true,
      maxLength: 6000,
      minLength: 1,
      name: optionsOptionName,
      type: CommandOptionType.STRING,
    },
  ];

  public async execute(message: ChannelCommandMessage): Promise<void> {
    if (DataController.loadActivePollState(message.member.guild.id) !== null) {
      await message.update({
        content: "A poll is already open.",
      });
      return;
    }

    const optionString: string | undefined = message.getCommandOption(
      optionsOptionName,
      CommandOptionType.STRING,
    );
    const parsedOptions: string[] = this.__parseOptions(optionString);
    if (parsedOptions.length < 2) {
      await message.update({
        content: "A poll needs at least two options.",
      });
      return;
    }
    if (parsedOptions.length > maxPollOptions) {
      await message.update({
        content: `A poll can have at most ${String(maxPollOptions)} options.`,
      });
      return;
    }

    const pollState: PollState = new PollState({
      channelId: message.channelId,
      guildId: message.member.guild.id,
      options: parsedOptions,
    });
    const pollMessage: string = `Poll Opened:\n${pollState.formatOptions()}`;
    try {
      await Discord.sendChannelMessage(message.channelId, {
        content: pollMessage,
      });
    } catch (reason: unknown) {
      Log.error("Could not post poll.", reason);
      await message.update({
        content:
          "Could not post the poll. Please shorten the options or check the channel configuration and try again.",
      });
      return;
    }
    DataController.savePollState(pollState);
    await message.update({
      content: "Poll opened.",
    });
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
