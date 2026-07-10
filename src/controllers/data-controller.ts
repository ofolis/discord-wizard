import type { Json } from "../core";
import { IO, Log } from "../core";
import {
  BettingState,
  CallInState,
  ChannelState,
  MoneyState,
  VotingState,
} from "../saveables";

export class DataController {
  public static deleteBettingState(guildId: string): void {
    Log.debug("Deleting betting state.");
    IO.deleteData(this.__getBettingStateId(guildId));
  }

  public static deleteVotingState(guildId: string): void {
    Log.debug("Deleting voting state.");
    IO.deleteData(this.__getVotingStateId(guildId));
  }

  public static loadActiveBettingState(guildId: string): BettingState | null {
    Log.debug("Loading active betting state.");
    const bettingState: BettingState | null = this.loadBettingState(guildId);
    if (bettingState === null || !bettingState.isOpen) {
      return null;
    }
    return bettingState;
  }

  public static loadActiveCallInState(guildId: string): CallInState | null {
    Log.debug("Loading active call-in state.");
    const callInState: CallInState | null = this.loadCallInState(guildId);
    if (callInState === null || !callInState.isOpen) {
      return null;
    }
    return callInState;
  }

  public static loadActiveVotingState(guildId: string): VotingState | null {
    Log.debug("Loading active voting state.");
    const votingState: VotingState | null = this.loadVotingState(guildId);
    if (votingState === null || !votingState.isOpen) {
      return null;
    }
    return votingState;
  }

  public static loadBettingState(guildId: string): BettingState | null {
    Log.debug("Loading betting state.");
    const bettingStateJson: Json | null = IO.loadData(
      this.__getBettingStateId(guildId),
    );
    if (bettingStateJson === null) {
      return null;
    }

    return BettingState.fromJson(bettingStateJson, guildId);
  }

  public static loadCallInState(guildId: string): CallInState | null {
    Log.debug("Loading call-in state.");
    const callInStateJson: Json | null = IO.loadData(
      this.__getCallInStateId(guildId),
    );
    if (callInStateJson === null) {
      return null;
    }

    return CallInState.fromJson(callInStateJson, guildId);
  }

  public static loadChannelState(channelId: string): ChannelState | null {
    Log.debug("Loading channel state.");
    const channelStateJson: Json | null = IO.loadData(channelId);
    if (channelStateJson === null) {
      return null;
    }
    return new ChannelState(channelStateJson);
  }

  public static loadMoneyState(guildId: string): MoneyState | null {
    Log.debug("Loading money state.");
    const moneyStateJson: Json | null = IO.loadData(
      this.__getMoneyStateId(guildId),
    );
    if (moneyStateJson === null) {
      return null;
    }

    return MoneyState.fromJson(moneyStateJson, guildId);
  }

  public static loadOrCreateMoneyState(guildId: string): MoneyState {
    Log.debug("Loading or creating money state.");
    return this.loadMoneyState(guildId) ?? new MoneyState(guildId);
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

  public static saveBetCancelStateChange(
    bettingState: BettingState,
    moneyState: MoneyState,
    previousMoneyStateJson: Json,
  ): void {
    Log.debug("Saving bet cancel state change.");
    this.saveMoneyState(moneyState);
    try {
      this.deleteBettingState(bettingState.guildId);
    } catch (reason: unknown) {
      try {
        IO.saveData(
          this.__getMoneyStateId(moneyState.guildId),
          previousMoneyStateJson,
        );
      } catch (rollbackReason: unknown) {
        Log.error("Could not roll back money state.", rollbackReason);
      }
      throw reason;
    }
  }

  public static saveBetResultStateChange(
    bettingState: BettingState,
    moneyState: MoneyState,
    previousBettingStateJson: Json,
  ): void {
    Log.debug("Saving bet result state change.");
    this.saveBettingState(bettingState);
    try {
      this.saveMoneyState(moneyState);
    } catch (reason: unknown) {
      try {
        IO.saveData(
          this.__getBettingStateId(bettingState.guildId),
          previousBettingStateJson,
        );
      } catch (rollbackReason: unknown) {
        Log.error("Could not roll back betting state.", rollbackReason);
      }
      throw reason;
    }
  }

  public static saveBettingState(bettingState: BettingState): void {
    Log.debug("Saving betting state.");
    IO.saveData(
      this.__getBettingStateId(bettingState.guildId),
      bettingState.toJson(),
    );
  }

  public static saveCallInState(callInState: CallInState): void {
    Log.debug("Saving call-in state.");
    IO.saveData(
      this.__getCallInStateId(callInState.guildId),
      callInState.toJson(),
    );
  }

  public static saveChannelState(channelState: ChannelState): void {
    Log.debug("Saving channel state.");
    IO.saveData(channelState.channelId, channelState.toJson());
  }

  public static saveMoneyState(moneyState: MoneyState): void {
    Log.debug("Saving money state.");
    IO.saveData(
      this.__getMoneyStateId(moneyState.guildId),
      moneyState.toJson(),
    );
  }

  public static saveVotingState(votingState: VotingState): void {
    Log.debug("Saving voting state.");
    IO.saveData(
      this.__getVotingStateId(votingState.guildId),
      votingState.toJson(),
    );
  }

  public static saveWagerStateChange(
    bettingState: BettingState,
    moneyState: MoneyState,
    previousMoneyStateJson: Json,
  ): void {
    Log.debug("Saving wager state change.");
    this.saveMoneyState(moneyState);
    try {
      this.saveBettingState(bettingState);
    } catch (reason: unknown) {
      try {
        IO.saveData(
          this.__getMoneyStateId(moneyState.guildId),
          previousMoneyStateJson,
        );
      } catch (rollbackReason: unknown) {
        Log.error("Could not roll back money state.", rollbackReason);
      }
      throw reason;
    }
  }

  private static __getBettingStateId(guildId: string): string {
    return `bet-${guildId}`;
  }

  private static __getCallInStateId(guildId: string): string {
    return `call-in-${guildId}`;
  }

  private static __getMoneyStateId(guildId: string): string {
    return `money-${guildId}`;
  }

  private static __getVotingStateId(guildId: string): string {
    return `vote-${guildId}`;
  }
}
