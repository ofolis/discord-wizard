import {
  DataController,
  GuildMemberController,
  InteractionController,
} from "../controllers";
import { ChannelCommandMessage, Command, CommandOption, Log } from "../core";
import { MoneyState } from "../saveables";

const maxMoneyRankingEntries: number = 25;
type BalanceEntry = ReturnType<MoneyState["getBalanceEntries"]>[number];
type GuildMembers = Awaited<
  ReturnType<typeof GuildMemberController.getGuildMembersByIds>
>;

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

    let members: GuildMembers;
    try {
      members = await this.__getRankingMembers(
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
    const displayedUserIdSet: Set<string> = new Set(
      members.map(member => member.id),
    );

    await InteractionController.showMoney(message, {
      hiddenRankingEntryCount: Math.max(
        0,
        balanceEntries.filter(entry => !displayedUserIdSet.has(entry.userId))
          .length,
      ),
      members,
      moneyState,
      userId,
    });
  }

  private async __getRankingMembers(
    guildId: string,
    balanceEntries: BalanceEntry[],
    currentUserId: string,
  ): Promise<GuildMembers> {
    const membersById: Map<string, GuildMembers[number]> = new Map();
    for (
      let index: number = 0;
      index < balanceEntries.length &&
      membersById.size < maxMoneyRankingEntries;
      index += maxMoneyRankingEntries
    ) {
      const candidateUserIds: string[] = balanceEntries
        .slice(index, index + maxMoneyRankingEntries)
        .map(entry => entry.userId)
        .filter(userId => !membersById.has(userId));
      const members: GuildMembers =
        await GuildMemberController.getGuildMembersByIds(
          guildId,
          candidateUserIds,
        );
      members.forEach(member => {
        membersById.set(member.id, member);
      });
    }

    if (!membersById.has(currentUserId)) {
      const currentUserMembers: GuildMembers =
        await GuildMemberController.getGuildMembersByIds(guildId, [
          currentUserId,
        ]);
      currentUserMembers.forEach(member => {
        membersById.set(member.id, member);
      });
    }
    return [...membersById.values()];
  }
}
