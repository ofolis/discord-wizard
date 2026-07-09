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
import { MoneyUtils } from "../money-utils";
import { BettingState, MoneyState, VotingState } from "../saveables";

type VotingResult = ReturnType<VotingState["getSortedResults"]>[number];
type BettingOptionSummary = ReturnType<
  BettingState["getOptionSummaries"]
>[number];
type BettingPayout = NonNullable<
  ReturnType<BettingState["calculatePayouts"]>
>[number];
type BettingWinningOption = {
  readonly letter: string;
  readonly option: string;
};
type MoneyRankingEntry = {
  readonly balanceCents: number;
  readonly displayName: string;
  readonly userId: string;
};

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
  public static async announceAllIn(
    channelId: string,
    data: {
      readonly option: string;
      readonly userName: string;
    },
  ): Promise<void> {
    await this.__createChannelCard(channelId, {
      color: CardColor.INFO,
      description: Utils.linesToString([
        `# ${ICONS[IconName.ALL_IN]} All In!`,
        `**${data.userName}** bet everything on \`${data.option}\`!`,
      ]),
    });
  }

  public static async announceBetResults(
    channelId: string,
    payouts: BettingPayout[],
    winningOptions: BettingWinningOption[],
    userLabelsById: Record<string, string>,
    balancesByUserId: Record<string, number>,
  ): Promise<void> {
    await this.__createChannelCard(channelId, {
      color: CardColor.INFO,
      description: Utils.linesToString([
        `# ${ICONS[IconName.BET_RESULTS]} Bet Results`,
        this.__formatBetWinnerString(winningOptions),
        payouts.length > 0 ? "### Payouts" : "No wagers were placed.",
        payouts.length > 0
          ? this.__formatBettingPayoutsString(
              payouts,
              userLabelsById,
              balancesByUserId,
            )
          : null,
      ]),
    });
  }

  public static async announceBetStart(
    channelId: string,
    bettingState: BettingState,
    userLabelsById: Record<string, string>,
  ): Promise<ChannelMessage> {
    return await this.__createChannelCard(channelId, {
      color: CardColor.INFO,
      description: this.__formatBetStartDescription(
        bettingState,
        userLabelsById,
      ),
    });
  }

  public static async announceMoneyGift(
    channelId: string,
    data: {
      readonly amountCents: number;
      readonly recipientName: string;
      readonly senderName: string;
    },
  ): Promise<void> {
    await this.__createChannelCard(channelId, {
      color: CardColor.INFO,
      description: `# ${ICONS[IconName.MONEY_GIVE]} ${data.senderName} gave ${data.recipientName} ${MoneyUtils.format(data.amountCents)}.`,
    });
  }

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

  public static async showMoney(
    message: ChannelCommandMessage,
    data: {
      readonly isRankingCapped: boolean;
      readonly maxRankingEntries: number;
      readonly members: discordJs.GuildMember[];
      readonly moneyState: MoneyState;
      readonly userId: string;
    },
  ): Promise<void> {
    await this.__setMessageCard(message, {
      color: CardColor.INFO,
      description: Utils.linesToString([
        "### Your Balance",
        `# ${MoneyUtils.format(data.moneyState.getBalance(data.userId))}`,
        "### Server Ranking",
        this.__formatMoneyRankingsString(
          data.members,
          data.moneyState,
          data.isRankingCapped,
          data.maxRankingEntries,
        ),
      ]),
    });
  }

  public static async updateBetStart(
    bettingState: BettingState,
    userLabelsById: Record<string, string>,
  ): Promise<void> {
    if (bettingState.messageId === null) {
      Log.debug("Skipping bet start message update. Message ID is missing.", {
        channelId: bettingState.channelId,
        guildId: bettingState.guildId,
      });
      return;
    }
    await Discord.updateChannelMessage(
      bettingState.channelId,
      bettingState.messageId,
      {
        embeds: [
          this.__buildCard({
            color: CardColor.INFO,
            description: this.__formatBetStartDescription(
              bettingState,
              userLabelsById,
            ),
          }),
        ],
      },
    );
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

  private static __formatBetOptionString(
    summary: BettingOptionSummary,
    userLabelsById: Record<string, string>,
  ): string {
    return Utils.linesToString([
      `- ${this.__formatLetterEmoji(summary.letter)} **${summary.option}** - \`${MoneyUtils.format(summary.totalCents)}\``,
      ...summary.wagers.map(
        wager =>
          `  - ${this.__formatUserLabel(wager.userId, userLabelsById)}: \`${MoneyUtils.format(wager.amountCents)}\``,
      ),
    ]);
  }

  private static __formatBetStartDescription(
    bettingState: BettingState,
    userLabelsById: Record<string, string>,
  ): string {
    return Utils.linesToString([
      `# ${ICONS[IconName.BET_START]} Bet Started`,
      "Use the `/bet` command to wager on an option below.",
      "### Options",
      Utils.linesToString(
        bettingState
          .getOptionSummaries()
          .map(summary =>
            this.__formatBetOptionString(summary, userLabelsById),
          ),
      ),
      `### Total Pool: \`${MoneyUtils.format(bettingState.totalPoolCents)}\``,
      bettingState.isLocked
        ? "### Betting: `Locked` 🔒"
        : "### Betting: `Open` 🟢",
    ]);
  }

  private static __formatBetWinnerString(
    winningOptions: BettingWinningOption[],
  ): string {
    if (winningOptions.length > 1) {
      return Utils.linesToString([
        "The bet ended in a **tie** between...",
        `# ${winningOptions.map(winningOption => winningOption.option).join(" / ")} 👑`,
      ]);
    }
    return Utils.linesToString([
      "The winner is...",
      `# ${winningOptions[0].option} 👑`,
    ]);
  }

  private static __formatBettingPayoutsString(
    payouts: BettingPayout[],
    userLabelsById: Record<string, string>,
    balancesByUserId: Record<string, number>,
  ): string {
    return Utils.linesToString(
      payouts
        .sort((a, b) => b.netCents - a.netCents)
        .map(payout => {
          const netSign: string = payout.netCents > 0 ? "+" : "";
          const changeEmoji: string =
            payout.netCents > 0 ? " 🟢" : payout.netCents < 0 ? " 🔴" : "";
          const balanceCents: number = balancesByUserId[payout.userId] ?? 0;
          const balanceEmoji: string = balanceCents === 0 ? " 💀" : "";
          return `- **${this.__formatUserLabel(payout.userId, userLabelsById)}:** \`${netSign}${MoneyUtils.format(payout.netCents)}\`${changeEmoji} (\`${MoneyUtils.format(balanceCents)}\`${balanceEmoji})`;
        }),
    );
  }

  private static __formatLetterEmoji(letter: string): string {
    const index: number = letter.charCodeAt(0) - "A".charCodeAt(0);
    return letterEmojis[index] ?? letter;
  }

  private static __formatMoneyRankingsString(
    members: discordJs.GuildMember[],
    moneyState: MoneyState,
    isCapped: boolean,
    maxRankingEntries: number,
  ): string {
    const rankedEntries: MoneyRankingEntry[] = members
      .map(member => ({
        balanceCents: moneyState.getBalance(member.id),
        displayName: member.displayName,
        userId: member.id,
      }))
      .sort((a, b) => {
        if (a.balanceCents !== b.balanceCents) {
          return b.balanceCents - a.balanceCents;
        }
        return a.userId.localeCompare(b.userId);
      });
    const highestBalanceCents: number | null =
      rankedEntries[0]?.balanceCents ?? null;
    return Utils.linesToString([
      ...rankedEntries.map(entry => {
        const badges: string[] = [];
        if (entry.balanceCents === highestBalanceCents) {
          badges.push("👑");
        }
        if (entry.balanceCents === 0) {
          badges.push("💀");
        }
        return `- **${entry.displayName}**${badges.length > 0 ? ` ${badges.join(" ")}` : ""} - \`${MoneyUtils.format(entry.balanceCents)}\``;
      }),
      isCapped
        ? `Only showing the top **${maxRankingEntries.toString()}** users, plus you if you are outside that group.`
        : null,
    ]);
  }

  private static __formatRankEmoji(rank: number): string {
    return numberEmojis[rank] ?? `#${rank.toString()}`;
  }

  private static __formatUserLabel(
    userId: string,
    userLabelsById: Record<string, string>,
  ): string {
    return (
      userLabelsById[userId] ?? Discord.formatUserMentionString({ id: userId })
    );
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
