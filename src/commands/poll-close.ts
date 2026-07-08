import { DataController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  Discord,
} from "../core";
import { PollState } from "../saveables";

type PollResult = ReturnType<PollState["getSortedResults"]>[number];

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

    await Discord.sendChannelMessage(pollState.channelId, {
      content: `Poll Results:\n${this.__formatResults(pollState.getSortedResults())}`,
    });
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
