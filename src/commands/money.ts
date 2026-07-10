import {
  DataController,
  GuildMemberController,
  InteractionController,
} from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandRegistrationType,
  Log,
} from "../core";
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

  public readonly isAvailableToAllUsers: boolean = true;

  public readonly name: string = "money";

  public readonly options: CommandOption[] = [];

  public readonly registrationType: CommandRegistrationType =
    CommandRegistrationType.GUILD;

  public readonly shouldReplyPrivately: boolean = true;

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

  private async __getGuildMembersById(
    guildId: string,
    currentUserId: string,
  ): Promise<Map<string, GuildMembers[number]>> {
    const guildMembers: GuildMembers =
      await GuildMemberController.getGuildMembers(guildId);
    let guildMembersById: Map<string, GuildMembers[number]> =
      this.__mapGuildMembersById(guildMembers);
    if (guildMembersById.has(currentUserId)) {
      return guildMembersById;
    }

    const refreshedGuildMembers: GuildMembers =
      await GuildMemberController.getGuildMembers(guildId, {
        forceRefresh: true,
      });
    guildMembersById = this.__mapGuildMembersById(refreshedGuildMembers);
    if (!guildMembersById.has(currentUserId)) {
      Log.throw(
        "Cannot load money ranking. Current user is not a guild member.",
        {
          currentUserId,
          guildId,
        },
      );
    }
    return guildMembersById;
  }

  private async __getRankingMembers(
    guildId: string,
    balanceEntries: BalanceEntry[],
    currentUserId: string,
  ): Promise<RankingMembersResult> {
    const guildMembersById: Map<string, GuildMembers[number]> =
      await this.__getGuildMembersById(guildId, currentUserId);
    const membersById: Map<string, GuildMembers[number]> = new Map();
    let isCapped: boolean = false;
    let rankedMemberCount: number = 0;

    for (const balanceEntry of balanceEntries) {
      const member: GuildMembers[number] | undefined = guildMembersById.get(
        balanceEntry.userId,
      );
      if (member === undefined) {
        continue;
      }
      rankedMemberCount += 1;
      if (rankedMemberCount > maxMoneyRankingEntries) {
        isCapped = true;
        break;
      }
      if (!membersById.has(member.id)) {
        membersById.set(member.id, member);
      }
    }

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

  private __mapGuildMembersById(
    guildMembers: GuildMembers,
  ): Map<string, GuildMembers[number]> {
    return new Map(guildMembers.map(member => [member.id, member]));
  }
}
