import { IO, Json, Log } from "../core";
import { ChannelState, VotingState } from "../saveables";
import { VotingStateJson } from "../types";

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

    const options: unknown = votingStateJson["options"];
    const votesByUserId: unknown = votingStateJson["votesByUserId"];
    const hasValidVotesByUserId: boolean =
      votesByUserId === undefined ||
      (typeof votesByUserId === "object" &&
        votesByUserId !== null &&
        !Array.isArray(votesByUserId) &&
        Object.values(votesByUserId as Record<string, unknown>).every(
          vote => typeof vote === "string",
        ));

    if (
      typeof votingStateJson["channelId"] !== "string" ||
      typeof votingStateJson["guildId"] !== "string" ||
      votingStateJson["guildId"] !== guildId ||
      typeof votingStateJson["isOpen"] !== "boolean" ||
      !Array.isArray(options) ||
      !options.every(option => typeof option === "string") ||
      !hasValidVotesByUserId
    ) {
      Log.throw("Cannot load voting state. Stored voting state JSON is invalid.", {
        guildId,
        votingStateJson,
      });
    }

    return new VotingState(votingStateJson as unknown as VotingStateJson);
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
