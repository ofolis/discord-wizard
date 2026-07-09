import { DataController, InteractionController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  Discord,
  Log,
} from "../core";
import { MoneyState } from "../saveables";

const maxMoneyRankingEntries: number = 25;

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
    const balanceEntries: ReturnType<MoneyState["getBalanceEntries"]> =
      moneyState.getBalanceEntries();
    const rankedUserIds: string[] = balanceEntries
      .sort((a, b) => {
        if (a.balanceCents !== b.balanceCents) {
          return b.balanceCents - a.balanceCents;
        }
        return a.userId.localeCompare(b.userId);
      })
      .slice(0, maxMoneyRankingEntries)
      .map(entry => entry.userId);
    const rankingUserIds: string[] = [...new Set([...rankedUserIds, userId])];
    const rankingUserIdSet: Set<string> = new Set(rankingUserIds);

    let members: Awaited<ReturnType<typeof Discord.getHumanGuildMembersByIds>>;
    try {
      members = await Discord.getHumanGuildMembersByIds(
        message.member.guild.id,
        rankingUserIds,
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
      hiddenRankingEntryCount: Math.max(
        0,
        balanceEntries.filter(entry => !rankingUserIdSet.has(entry.userId))
          .length,
      ),
      members,
      moneyState,
      userId,
    });
  }
}
