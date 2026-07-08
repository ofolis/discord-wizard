import { IO, Json, Log } from "../core";
import { ChannelState, PollState } from "../saveables";
import { PollStateJson } from "../types";

export class DataController {
  public static loadActivePollState(guildId: string): PollState | null {
    Log.debug("Loading active poll state.");
    const pollState: PollState | null = this.loadPollState(guildId);
    if (pollState === null || !pollState.isOpen) {
      return null;
    }
    return pollState;
  }

  public static loadChannelState(channelId: string): ChannelState | null {
    Log.debug("Loading channel state.");
    const channelStateJson: Json | null = IO.loadData(channelId);
    if (channelStateJson === null) {
      return null;
    }
    return new ChannelState(channelStateJson);
  }

  public static loadPollState(guildId: string): PollState | null {
    Log.debug("Loading poll state.");
    const pollStateJson: Json | null = IO.loadData(
      this.__getPollStateId(guildId),
    );
    if (pollStateJson === null) {
      return null;
    }
    return new PollState(pollStateJson as PollStateJson);
  }

  public static saveChannelState(channelState: ChannelState): void {
    Log.debug("Saving channel state.");
    IO.saveData(channelState.channelId, channelState.toJson());
  }

  public static savePollState(pollState: PollState): void {
    Log.debug("Saving poll state.");
    IO.saveData(this.__getPollStateId(pollState.guildId), pollState.toJson());
  }

  private static __getPollStateId(guildId: string): string {
    return `poll-${guildId}`;
  }
}
