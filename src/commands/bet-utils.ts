import { GuildMemberController } from "../controllers";
import { BettingState } from "../saveables";

export class BetUtils {
  public static async getParticipantLabels(
    bettingState: BettingState,
  ): Promise<Record<string, string>> {
    const members: Awaited<
      ReturnType<typeof GuildMemberController.getGuildMembersByIds>
    > = await GuildMemberController.getGuildMembersByIds(
      bettingState.guildId,
      bettingState.getParticipantUserIds(),
    );
    return Object.fromEntries(
      members.map(member => [member.id, member.displayName]),
    );
  }
}
