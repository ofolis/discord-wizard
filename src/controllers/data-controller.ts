import type { Json } from "../core";
import { IO, Log } from "../core";
import { ChannelState, VotingState } from "../saveables";

export class DataController {
  public static loadActiveVotingState(guildId: string): VotingState | null {
    Log.debug("Loading active voting state.");
    const votingState: VotingState | null = this.loadVotingState(guildId);
    if (votingState === null || !votingState.isOpen) {
      return null;
    }
    return votingState;
  }

  public static loadChannelState(channelId: string): ChannelState | null {
    Log.debug("Loading channel state.");
    const channelStateJson: Json | null = IO.loadData(channelId);
    if (channelStateJson === null) {
      return null;
    }
    return new ChannelState(channelStateJson);
  }

  public static loadVotingState(guildId: string): VotingState | null {
    Log.debug("Loading voting state.");
    const votingStateJson: Json | null = IO.loadData(
      this.__getVotingStateId(guildId),
    );
    if (votingStateJson === null) {
      return null;
    }

    return VotingState.fromJson(votingStateJson, guildId);
  }

  public static saveChannelState(channelState: ChannelState): void {
    Log.debug("Saving channel state.");
    IO.saveData(channelState.channelId, channelState.toJson());
  }

  public static saveVotingState(votingState: VotingState): void {
    Log.debug("Saving voting state.");
    IO.saveData(
      this.__getVotingStateId(votingState.guildId),
      votingState.toJson(),
    );
  }

  private static __getVotingStateId(guildId: string): string {
    return `vote-${guildId}`;
  }
}
