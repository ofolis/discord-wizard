import * as discordJs from "discord.js";
import { ICONS } from "../constants";
import {
  ChannelCommandMessage,
  ChannelMessage,
  Discord,
  InteractionUtils,
  Log,
  Utils,
} from "../core";
import { IconName } from "../enums";
import { MoneyUtils } from "../money-utils";
import {
  BettingState,
  CallInState,
  MoneyState,
  VotingState,
} from "../saveables";

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
    await InteractionUtils.createChannelCard(channelId, {
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
    await InteractionUtils.createChannelCard(channelId, {
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
    return await InteractionUtils.createChannelCard(channelId, {
      color: CardColor.INFO,
      description: this.__formatBetStartDescription(
        bettingState,
        userLabelsById,
      ),
    });
  }

  public static async announceCallInEnd(channelId: string): Promise<void> {
    await InteractionUtils.createChannelCard(channelId, {
      color: CardColor.INFO,
      description: Utils.linesToString([
        `# ${ICONS[IconName.CALL_IN]} Call-In Mode Inactive`,
        "You can mute and unmute yourself as normal.",
      ]),
    });
  }

  public static async announceCallInOffAir(
    channelId: string,
    data: {
      readonly userName: string;
    },
  ): Promise<void> {
    await InteractionUtils.createChannelCard(channelId, {
      color: CardColor.INFO,
      description: `# ${ICONS[IconName.CALL_IN]} Off Air\n**${data.userName}** is no longer on the air.`,
    });
  }

  public static async announceCallInOnAir(
    channelId: string,
    data: {
      readonly userMention: string;
    },
  ): Promise<void> {
    await InteractionUtils.createChannelCard(channelId, {
      color: CardColor.INFO,
      description: `# ${ICONS[IconName.CALL_IN]} On Air\n${data.userMention} is now on the air.`,
    });
  }

  public static async announceCallInQueueAdd(
    channelId: string,
    data: {
      readonly userName: string;
    },
  ): Promise<void> {
    await InteractionUtils.createChannelCard(channelId, {
      color: CardColor.INFO,
      description: `# ${ICONS[IconName.CALL_IN]} Calling In\n**${data.userName}** is calling in.`,
    });
  }

  public static async announceCallInQueueRemove(
    channelId: string,
    data: {
      readonly userName: string;
    },
  ): Promise<void> {
    await InteractionUtils.createChannelCard(channelId, {
      color: CardColor.INFO,
      description: `# ${ICONS[IconName.CALL_IN]} Hung Up\n**${data.userName}** hung up.`,
    });
  }

  public static async announceCallInStart(channelId: string): Promise<void> {
    await InteractionUtils.createChannelCard(channelId, {
      color: CardColor.INFO,
      description: Utils.linesToString([
        `# ${ICONS[IconName.CALL_IN]} Call-In Mode Active`,
        "Non-host users in the voice channel will be muted until they call in with `/callin` and a host puts them on the air.",
      ]),
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
    await InteractionUtils.createChannelCard(channelId, {
      color: CardColor.INFO,
      description: `# ${ICONS[IconName.MONEY_GIVE]} ${data.senderName} gave ${data.recipientName} \`${MoneyUtils.format(data.amountCents)}\`.`,
    });
  }

  public static async announceSubmission(
    channelId: string,
    submission: string,
  ): Promise<void> {
    await InteractionUtils.createChannelCard(channelId, {
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
    await InteractionUtils.createChannelCard(channelId, {
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
    return await InteractionUtils.createChannelCard(channelId, {
      color: CardColor.INFO,
      description: this.__formatVoteStartDescription(votingState),
    });
  }

  public static async informError(
    message: ChannelCommandMessage,
    description: string,
  ): Promise<void> {
    await InteractionUtils.setMessageCard(message, {
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
    await InteractionUtils.setMessageCard(message, {
      color: CardColor.SUCCESS,
      description: Utils.linesToString([
        `## ${ICONS[IconName.SUCCESS]} Success`,
        description,
      ]),
    });
  }

  public static async showCallInQueue(
    channelId: string,
    callInState: CallInState,
    userLabelsById: Record<string, string>,
  ): Promise<ChannelMessage> {
    return await InteractionUtils.createChannelCard(channelId, {
      color: CardColor.INFO,
      description: this.__formatCallInQueueDescription(
        callInState,
        userLabelsById,
      ),
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
    const descriptionPrefix: string = Utils.linesToString([
      "### Your Balance",
      `# ${MoneyUtils.format(data.moneyState.getBalance(data.userId))}`,
      "### Server Ranking",
    ]);
    await InteractionUtils.setMessageCard(message, {
      color: CardColor.INFO,
      description: Utils.linesToString([
        descriptionPrefix,
        this.__formatMoneyRankingsString(
          data.members,
          data.moneyState,
          data.isRankingCapped,
          data.maxRankingEntries,
          Discord.embedDescriptionMaxLength - descriptionPrefix.length - 1,
        ),
      ]),
    });
  }

  public static async updateBetCanceled(
    bettingState: BettingState,
  ): Promise<void> {
    if (bettingState.messageId === null) {
      Log.debug("Skipping bet cancel message update. Message ID is missing.", {
        channelId: bettingState.channelId,
        guildId: bettingState.guildId,
      });
      return;
    }
    await InteractionUtils.updateChannelCard(
      bettingState.channelId,
      bettingState.messageId,
      {
        color: CardColor.ERROR,
        description: Utils.linesToString([
          `# ${ICONS[IconName.BET_START]} Bet Canceled`,
          "This bet was canceled. All wagers have been refunded.",
        ]),
      },
    );
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
    await InteractionUtils.updateChannelCard(
      bettingState.channelId,
      bettingState.messageId,
      {
        color: CardColor.INFO,
        description: this.__formatBetStartDescription(
          bettingState,
          userLabelsById,
        ),
      },
    );
  }

  public static async updateCallInQueue(
    channelId: string,
    messageId: string,
    callInState: CallInState,
    userLabelsById: Record<string, string>,
  ): Promise<void> {
    await InteractionUtils.updateChannelCard(channelId, messageId, {
      color: CardColor.INFO,
      description: this.__formatCallInQueueDescription(
        callInState,
        userLabelsById,
      ),
    });
  }

  public static async updateVoteCanceled(
    votingState: VotingState,
  ): Promise<void> {
    if (votingState.messageId === null) {
      Log.debug("Skipping vote cancel message update. Message ID is missing.", {
        channelId: votingState.channelId,
        guildId: votingState.guildId,
      });
      return;
    }
    await InteractionUtils.updateChannelCard(
      votingState.channelId,
      votingState.messageId,
      {
        color: CardColor.ERROR,
        description: Utils.linesToString([
          `# ${ICONS[IconName.VOTE_START]} Vote Canceled`,
          "This vote was canceled.",
        ]),
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
    await InteractionUtils.updateChannelCard(
      votingState.channelId,
      votingState.messageId,
      {
        color: CardColor.INFO,
        description: this.__formatVoteStartDescription(votingState),
      },
    );
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

  private static __formatCallInQueueDescription(
    callInState: CallInState,
    userLabelsById: Record<string, string>,
  ): string {
    const heading: string = `# ${ICONS[IconName.CALL_IN]} Call-In Queue`;
    return Utils.linesToString([
      heading,
      callInState.queuedUserIds.length > 0
        ? this.__formatCallInQueueString(
            callInState,
            userLabelsById,
            Discord.embedDescriptionMaxLength - heading.length - 1,
          )
        : "The queue is empty.",
    ]);
  }

  private static __formatCallInQueueString(
    callInState: CallInState,
    userLabelsById: Record<string, string>,
    maxLength: number,
  ): string {
    const lines: string[] = [];
    for (
      let index: number = 0;
      index < callInState.queuedUserIds.length;
      index++
    ) {
      const userId: string = callInState.queuedUserIds[index];
      const line: string = `${(index + 1).toString()}. ${this.__formatUserLabel(userId, userLabelsById)}`;
      if (Utils.linesToString([...lines, line]).length <= maxLength) {
        lines.push(line);
        continue;
      }
      const remainingCount: number = callInState.queuedUserIds.length - index;
      const truncationLine: string = `...and ${remainingCount.toString()} more.`;
      if (Utils.linesToString([...lines, truncationLine]).length <= maxLength) {
        lines.push(truncationLine);
      }
      break;
    }
    return Utils.linesToString(lines);
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
    maxLength: number,
  ): string {
    const rankedEntries: MoneyRankingEntry[] = members
      .map(member => ({
        balanceCents: moneyState.getBalance(member.id),
        displayName: Discord.formatGuildMemberNameString(member),
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
    const lines: string[] = [];
    if (isCapped) {
      this.__pushMoneyRankingLine(
        lines,
        `Only showing the top **${maxRankingEntries.toString()}** users, plus you if you are outside that group.`,
        maxLength,
      );
    }

    for (const entry of rankedEntries) {
      const badges: string[] = [];
      if (entry.balanceCents === highestBalanceCents) {
        badges.push("👑");
      }
      if (entry.balanceCents === 0) {
        badges.push("💀");
      }

      const line: string = `- **${entry.displayName}**${badges.length > 0 ? ` ${badges.join(" ")}` : ""} - \`${MoneyUtils.format(entry.balanceCents)}\``;
      if (!this.__pushMoneyRankingLine(lines, line, maxLength)) {
        break;
      }
    }
    return Utils.linesToString(lines);
  }

  private static __formatRankEmoji(rank: number): string {
    return numberEmojis[rank] ?? `#${rank.toString()}`;
  }

  private static __formatUserLabel(
    userId: string,
    userLabelsById: Record<string, string>,
  ): string {
    return (
      userLabelsById[userId] ??
      Discord.formatUnknownUserNameString({ id: userId })
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

  private static __pushMoneyRankingLine(
    lines: string[],
    line: string,
    maxLength: number,
  ): boolean {
    const nextValue: string = Utils.linesToString([...lines, line]);
    if (nextValue.length <= maxLength) {
      lines.push(line);
      return true;
    }

    const truncationLine: string = "...";
    if (Utils.linesToString([...lines, truncationLine]).length <= maxLength) {
      lines.push(truncationLine);
    }
    return false;
  }
}
