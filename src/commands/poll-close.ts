import { DataController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  Discord,
  Log,
} from "../core";
import { PollState } from "../saveables";

type PollResult = ReturnType<PollState["getSortedResults"]>[number];

const discordMessageMaxLength: number = 2000;

export class PollClose implements Command {
  public readonly description: string = "Closes the open poll.";

  public readonly isGlobal: boolean = false;

  public readonly isGuild: boolean = true;

  public readonly isPrivate: boolean = true;

  public readonly name: string = "pollclose";

  public readonly options: CommandOption[] = [];

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

    const pollResultsMessage: string = `Poll Results:\n${this.__formatResults(
      pollState.getSortedResults(),
    )}`;
    if (pollResultsMessage.length > discordMessageMaxLength) {
      await message.update({
        content:
          "The poll results are too long to post. The poll is still open.",
      });
      return;
    }
    try {
      await Discord.sendChannelMessage(pollState.channelId, {
        allowedMentions: {
          parse: [],
        },
        content: pollResultsMessage,
      });
    } catch (reason: unknown) {
      Log.error("Could not post poll results.", reason);
      await message.update({
        content:
          "Could not post the poll results. The poll is still open. Please check the channel configuration and try again.",
      });
      return;
    }
    pollState.close();
    DataController.savePollState(pollState);
    await message.update({
      content: "Poll closed.",
    });
  }

  private __formatResults(results: PollResult[]): string {
    return results
      .map(result => {
        const rank: number =
          results.findIndex(
            rankedResult => rankedResult.voteCount === result.voteCount,
          ) + 1;
        const voteLabel: string = result.voteCount === 1 ? "vote" : "votes";
        return `#${String(rank)}: ${result.option} (${String(result.voteCount)} ${voteLabel})`;
      })
      .join("\n");
  }
}
