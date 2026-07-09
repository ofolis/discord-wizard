import type { Json, Saveable } from "../core";
import { Log } from "../core";
import type { CallInStateJson } from "../types";

export class CallInState implements Saveable {
  public readonly channelId: string;

  public readonly guildId: string;

  public readonly voiceChannelId: string;

  private readonly __botMutedUserIds: string[];

  private __isOpen: boolean;

  private readonly __queuedUserIds: string[];

  private readonly __speakingUserIds: string[];

  public constructor(state: {
    readonly channelId: string;
    readonly guildId: string;
    readonly voiceChannelId: string;
  }) {
    this.channelId = state.channelId;
    this.guildId = state.guildId;
    this.voiceChannelId = state.voiceChannelId;
    this.__botMutedUserIds = [];
    this.__isOpen = true;
    this.__queuedUserIds = [];
    this.__speakingUserIds = [];
  }

  public get botMutedUserIds(): readonly string[] {
    return this.__botMutedUserIds;
  }

  public get isOpen(): boolean {
    return this.__isOpen;
  }

  public get queuedUserIds(): readonly string[] {
    return this.__queuedUserIds;
  }

  public get speakingUserIds(): readonly string[] {
    return this.__speakingUserIds;
  }

  public static fromJson(json: Json, expectedGuildId: string): CallInState {
    const callInStateJson: CallInStateJson = this.__parseJson(
      json,
      expectedGuildId,
    );
    const callInState: CallInState = new CallInState({
      channelId: callInStateJson.channelId,
      guildId: callInStateJson.guildId,
      voiceChannelId: callInStateJson.voiceChannelId,
    });
    callInState.__isOpen = callInStateJson.isOpen;
    callInState.__botMutedUserIds.push(
      ...callInState.__normalizeUserIds(callInStateJson.botMutedUserIds ?? []),
    );
    callInState.__queuedUserIds.push(
      ...callInState.__normalizeUserIds(callInStateJson.queuedUserIds ?? []),
    );
    callInState.__speakingUserIds.push(
      ...callInState.__normalizeUserIds(callInStateJson.speakingUserIds ?? []),
    );
    return callInState;
  }

  private static __isValidUserIdArray(value: unknown): boolean {
    return (
      value === undefined ||
      (Array.isArray(value) && value.every(item => typeof item === "string"))
    );
  }

  private static __parseJson(
    json: Json,
    expectedGuildId: string,
  ): CallInStateJson {
    if (
      typeof json.channelId !== "string" ||
      typeof json.guildId !== "string" ||
      json.guildId !== expectedGuildId ||
      typeof json.isOpen !== "boolean" ||
      typeof json.voiceChannelId !== "string" ||
      !this.__isValidUserIdArray(json.botMutedUserIds) ||
      !this.__isValidUserIdArray(json.queuedUserIds) ||
      !this.__isValidUserIdArray(json.speakingUserIds)
    ) {
      Log.throw(
        "Cannot load call-in state. Stored call-in state JSON is invalid.",
        {
          expectedGuildId,
          json,
        },
      );
    }
    return {
      botMutedUserIds: json.botMutedUserIds as string[] | undefined,
      channelId: json.channelId,
      guildId: json.guildId,
      isOpen: json.isOpen,
      queuedUserIds: json.queuedUserIds as string[] | undefined,
      speakingUserIds: json.speakingUserIds as string[] | undefined,
      voiceChannelId: json.voiceChannelId,
    };
  }

  public addBotMutedUser(userId: string): void {
    if (!this.__botMutedUserIds.includes(userId)) {
      this.__botMutedUserIds.push(userId);
    }
  }

  public addSpeakingUser(userId: string): void {
    this.removeQueuedUser(userId);
    if (!this.__speakingUserIds.includes(userId)) {
      this.__speakingUserIds.push(userId);
    }
  }

  public close(): void {
    this.__isOpen = false;
    this.__queuedUserIds.length = 0;
    this.__speakingUserIds.length = 0;
  }

  public hasQueuedUser(userId: string): boolean {
    return this.__queuedUserIds.includes(userId);
  }

  public hasSpeakingUser(userId: string): boolean {
    return this.__speakingUserIds.includes(userId);
  }

  public removeBotMutedUser(userId: string): void {
    this.__removeUserId(this.__botMutedUserIds, userId);
  }

  public removeQueuedUser(userId: string): void {
    this.__removeUserId(this.__queuedUserIds, userId);
  }

  public removeSpeakingUser(userId: string): void {
    this.__removeUserId(this.__speakingUserIds, userId);
  }

  public toJson(): CallInStateJson {
    return {
      botMutedUserIds: [...this.__botMutedUserIds],
      channelId: this.channelId,
      guildId: this.guildId,
      isOpen: this.__isOpen,
      queuedUserIds: [...this.__queuedUserIds],
      speakingUserIds: [...this.__speakingUserIds],
      voiceChannelId: this.voiceChannelId,
    };
  }

  public toggleQueuedUser(userId: string): boolean {
    if (this.hasQueuedUser(userId)) {
      this.removeQueuedUser(userId);
      return false;
    }
    this.__queuedUserIds.push(userId);
    return true;
  }

  private __normalizeUserIds(userIds: readonly string[]): string[] {
    return [...new Set(userIds)];
  }

  private __removeUserId(userIds: string[], userId: string): void {
    const index: number = userIds.indexOf(userId);
    if (index >= 0) {
      userIds.splice(index, 1);
    }
  }
}
