import {
  DataController,
  GuildMemberController,
  InteractionController,
} from "../controllers";
import { ChannelCommandMessage, Command, CommandOption, Log } from "../core";
import { MoneyState } from "../saveables";

const maxMoneyRankingEntries: number = 100;
type BalanceEntry = ReturnType<MoneyState["getBalanceEntries"]>[number];
type GuildMembers = Awaited<
  ReturnType<typeof GuildMemberController.getGuildMembers>
>;
type RankingMembersResult = {
  readonly isCapped: boolean;
  readonly members: GuildMembers;
};

export class Money implements Command {
  public readonly description: string = "Shows your money and server ranking.";

  public readonly isGlobal: boolean = false;

  public readonly isGuild: boolean = true;

  public readonly isPrivate: boolean = true;

  public readonly name: string = "money";

  public readonly options: CommandOption[] = [];

  public async execute(message: ChannelCommandMessage): Promise<void> {
    const userId: string = message.user.id;
    const moneyState: MoneyState = DataController.loadOrCreateMoneyState(
      message.member.guild.id,
    );
    const balanceEntries: BalanceEntry[] = moneyState
      .getBalanceEntries()
      .sort((a, b) => {
        if (a.balanceCents !== b.balanceCents) {
          return b.balanceCents - a.balanceCents;
        }
        return a.userId.localeCompare(b.userId);
      });

    let rankingMembersResult: RankingMembersResult;
    try {
      rankingMembersResult = await this.__getRankingMembers(
        message.member.guild.id,
        balanceEntries,
        userId,
      );
    } catch (reason: unknown) {
      Log.error("Could not load server members for money ranking.", reason);
      await InteractionController.informError(
        message,
        "Could not load server users. Contact an admin.",
      );
      return;
    }

    await InteractionController.showMoney(message, {
      isRankingCapped: rankingMembersResult.isCapped,
      maxRankingEntries: maxMoneyRankingEntries,
      members: rankingMembersResult.members,
      moneyState,
      userId,
    });
  }

  private async __getRankingMembers(
    guildId: string,
    balanceEntries: BalanceEntry[],
    currentUserId: string,
  ): Promise<RankingMembersResult> {
    const guildMembers: GuildMembers =
      await GuildMemberController.getGuildMembers(guildId);
    const guildMembersById: Map<string, GuildMembers[number]> = new Map(
      guildMembers.map(member => [member.id, member]),
    );
    const membersById: Map<string, GuildMembers[number]> = new Map();

    for (const balanceEntry of balanceEntries) {
      if (membersById.size >= maxMoneyRankingEntries) {
        break;
      }
      const member: GuildMembers[number] | undefined = guildMembersById.get(
        balanceEntry.userId,
      );
      if (member !== undefined) {
        membersById.set(member.id, member);
      }
    }
    const isCapped: boolean =
      balanceEntries.filter(
        balanceEntry => guildMembersById.get(balanceEntry.userId) !== undefined,
      ).length > maxMoneyRankingEntries;

    if (!membersById.has(currentUserId)) {
      const member: GuildMembers[number] | undefined =
        guildMembersById.get(currentUserId);
      if (member !== undefined) {
        membersById.set(member.id, member);
      }
    }
    return {
      isCapped,
      members: [...membersById.values()],
    };
  }
}
