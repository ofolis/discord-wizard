import * as discordJs from "discord.js";
import { ICONS } from "../constants";
import {
  AppErrorCode,
  ChannelCommandMessage,
  ChannelMessage,
  Discord,
  Log,
  Utils,
} from "../core";
import { IconName } from "../enums";
import { VotingState } from "../saveables";

type VotingResult = ReturnType<VotingState["getSortedResults"]>[number];

const letterEmojis: string[] = [
  "🇦",
  "🇧",
  "🇨",
  "🇩",
  "🇪",
  "🇫",
  "🇬",
  "🇭",
  "🇮",
  "🇯",
  "🇰",
  "🇱",
  "🇲",
  "🇳",
  "🇴",
  "🇵",
  "🇶",
  "🇷",
  "🇸",
  "🇹",
  "🇺",
  "🇻",
  "🇼",
  "🇽",
  "🇾",
  "🇿",
];
const numberEmojis: string[] = [
  "0️⃣",
  "1️⃣",
  "2️⃣",
  "3️⃣",
  "4️⃣",
  "5️⃣",
  "6️⃣",
  "7️⃣",
  "8️⃣",
  "9️⃣",
  "🔟",
];

enum CardColor {
  ERROR = 0xdd2e44,
  INFO = 0x808080,
  SUCCESS = 0x57f287,
}

export class InteractionController {
  public static async announceSubmission(
    channelId: string,
    submission: string,
  ): Promise<void> {
    await this.__createChannelCard(channelId, {
      color: CardColor.INFO,
      description: Utils.linesToString([
        `# ${ICONS[IconName.SUBMISSION]} New Submission`,
        submission,
      ]),
    });
  }

  public static async announceVoteResults(
    channelId: string,
    results: VotingResult[],
  ): Promise<void> {
    await this.__createChannelCard(channelId, {
      color: CardColor.INFO,
      description: Utils.linesToString([
        `# ${ICONS[IconName.VOTE_RESULTS]} Vote Results`,
        this.__formatVoteWinnerString(results),
        this.__hasVotes(results) ? "### Rankings" : null,
        this.__hasVotes(results)
          ? this.__formatVotingResultsString(results)
          : null,
      ]),
    });
  }

  public static async announceVoteStart(
    channelId: string,
    votingState: VotingState,
  ): Promise<ChannelMessage> {
    return await this.__createChannelCard(channelId, {
      color: CardColor.INFO,
      description: this.__formatVoteStartDescription(votingState),
    });
  }

  public static async informError(
    message: ChannelCommandMessage,
    description: string,
  ): Promise<void> {
    await this.__setMessageCard(message, {
      color: CardColor.ERROR,
      description: Utils.linesToString([
        `## ${ICONS[IconName.ERROR]} Error`,
        description,
      ]),
    });
  }

  public static async informSuccess(
    message: ChannelCommandMessage,
    description: string,
  ): Promise<void> {
    await this.__setMessageCard(message, {
      color: CardColor.SUCCESS,
      description: Utils.linesToString([
        `## ${ICONS[IconName.SUCCESS]} Success`,
        description,
      ]),
    });
  }

  public static async updateVoteStart(votingState: VotingState): Promise<void> {
    if (votingState.messageId === null) {
      Log.debug("Skipping vote start message update. Message ID is missing.", {
        channelId: votingState.channelId,
        guildId: votingState.guildId,
      });
      return;
    }
    await Discord.updateChannelMessage(
      votingState.channelId,
      votingState.messageId,
      {
        embeds: [
          this.__buildCard({
            color: CardColor.INFO,
            description: this.__formatVoteStartDescription(votingState),
          }),
        ],
      },
    );
  }

  private static __buildCard(
    embedData: discordJs.EmbedData,
  ): discordJs.EmbedBuilder {
    if (
      embedData.description !== undefined &&
      embedData.description.length > Discord.embedDescriptionMaxLength
    ) {
      Log.throwError(
        AppErrorCode.DISCORD_CARD_DESCRIPTION_TOO_LONG,
        "Cannot build Discord card. Description is too long.",
        {
          embedData,
          maxLength: Discord.embedDescriptionMaxLength,
        },
      );
    }
    return new discordJs.EmbedBuilder(embedData);
  }

  private static async __createChannelCard(
    channelId: string,
    embedData: discordJs.EmbedData,
  ): Promise<ChannelMessage> {
    return await Discord.sendChannelMessage(channelId, {
      embeds: [this.__buildCard(embedData)],
    });
  }

  private static __formatRankEmoji(rank: number): string {
    return numberEmojis[rank] ?? `#${rank.toString()}`;
  }

  private static __formatVoteStartDescription(
    votingState: VotingState,
  ): string {
    return Utils.linesToString([
      `# ${ICONS[IconName.VOTE_START]} Vote Started`,
      "Use the `/vote` command to vote for an option below.",
      "### Options",
      this.__formatVotingOptionsString(votingState.options),
      `### Total Votes: \`${votingState.totalVotes.toString()}\``,
    ]);
  }

  private static __formatVoteWinnerString(results: VotingResult[]): string {
    if (!this.__hasVotes(results)) {
      return "No votes were cast.";
    }
    const winningVoteCount: number = results[0].voteCount;
    const winners: VotingResult[] = results.filter(
      result => result.voteCount === winningVoteCount,
    );
    if (winners.length > 1) {
      return "The vote ended in a **tie**.";
    }
    return Utils.linesToString([
      "The winner is...",
      `# ${winners[0].option} 👑`,
    ]);
  }

  private static __formatVotingOptionsString(
    options: readonly string[],
  ): string {
    return Utils.linesToString(
      options.map(
        (option, index) =>
          `- ${letterEmojis[index] ?? (index + 1).toString()} **${option}**`,
      ),
    );
  }

  private static __formatVotingResultsString(results: VotingResult[]): string {
    return Utils.linesToString(
      results.map(result => {
        const rank: number =
          results.findIndex(
            rankedResult => rankedResult.voteCount === result.voteCount,
          ) + 1;
        const voteLabel: string = result.voteCount === 1 ? "vote" : "votes";
        return `- ${this.__formatRankEmoji(rank)} **${result.option}** (\`${result.voteCount.toString()}\` ${voteLabel})`;
      }),
    );
  }

  private static __hasVotes(results: VotingResult[]): boolean {
    return results.length > 0 && results[0].voteCount > 0;
  }

  private static async __setMessageCard(
    message: ChannelCommandMessage,
    embedData: discordJs.EmbedData,
  ): Promise<void> {
    await message.update({
      embeds: [this.__buildCard(embedData)],
    });
  }
}
