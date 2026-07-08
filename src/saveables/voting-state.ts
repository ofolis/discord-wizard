import type { Json, Saveable } from "../core";
import { Log } from "../core";
import type { VotingStateJson } from "../types";

type VotingOptionResult = {
  readonly letter: string;
  readonly option: string;
  readonly voteCount: number;
};

export class VotingState implements Saveable {
  public static readonly maxOptionCount: number = 26;

  public static readonly minOptionCount: number = 2;

  public readonly channelId: string;

  public readonly guildId: string;

  public messageId: string | null;

  private __isOpen: boolean;

  private readonly __options: string[];

  private __votesByUserId: Record<string, string>;

  public constructor(state: {
    readonly channelId: string;
    readonly guildId: string;
    readonly options: string[];
  }) {
    VotingState.__validateOptions(state.options);
    this.channelId = state.channelId;
    this.guildId = state.guildId;
    this.messageId = null;
    this.__isOpen = true;
    this.__options = [...state.options];
    this.__votesByUserId = {};
  }

  public get isOpen(): boolean {
    return this.__isOpen;
  }

  public get options(): readonly string[] {
    return this.__options;
  }

  public get totalVotes(): number {
    return Object.keys(this.__votesByUserId).length;
  }

  public static fromJson(json: Json, expectedGuildId: string): VotingState {
    const votingStateJson: VotingStateJson = this.__parseJson(
      json,
      expectedGuildId,
    );
    const votingState: VotingState = new VotingState({
      channelId: votingStateJson.channelId,
      guildId: votingStateJson.guildId,
      options: votingStateJson.options,
    });
    votingState.__isOpen = votingStateJson.isOpen;
    votingState.messageId = votingStateJson.messageId ?? null;
    votingState.__votesByUserId = votingState.__normalizeVotesByUserId(
      votingStateJson.votesByUserId ?? {},
    );
    return votingState;
  }

  private static __parseJson(
    json: Json,
    expectedGuildId: string,
  ): VotingStateJson {
    const votesByUserId: unknown = json.votesByUserId;
    const messageId: unknown = json.messageId;
    const hasValidOptions: boolean =
      Array.isArray(json.options) &&
      json.options.every(option => typeof option === "string") &&
      json.options.length >= this.minOptionCount &&
      json.options.length <= this.maxOptionCount;
    const hasValidVotesByUserId: boolean =
      votesByUserId === undefined ||
      (typeof votesByUserId === "object" &&
        votesByUserId !== null &&
        !Array.isArray(votesByUserId) &&
        Object.values(votesByUserId as Record<string, unknown>).every(
          vote => typeof vote === "string",
        ));
    const hasValidMessageId: boolean =
      messageId === undefined || typeof messageId === "string";

    if (
      typeof json.channelId !== "string" ||
      typeof json.guildId !== "string" ||
      json.guildId !== expectedGuildId ||
      typeof json.isOpen !== "boolean" ||
      !hasValidOptions ||
      !hasValidMessageId ||
      !hasValidVotesByUserId
    ) {
      Log.throw(
        "Cannot load voting state. Stored voting state JSON is invalid.",
        {
          expectedGuildId,
          json,
        },
      );
    }

    return {
      channelId: json.channelId,
      guildId: json.guildId,
      isOpen: json.isOpen,
      messageId: messageId as string | undefined,
      options: json.options as string[],
      votesByUserId: votesByUserId as Record<string, string> | undefined,
    };
  }

  private static __validateOptions(options: readonly string[]): void {
    if (
      options.length < this.minOptionCount ||
      options.length > this.maxOptionCount
    ) {
      Log.throw("Cannot create voting state. Option count is invalid.", {
        maxOptionCount: this.maxOptionCount,
        minOptionCount: this.minOptionCount,
        options,
      });
    }
  }

  public castVote(userId: string, letter: string | undefined): string | null {
    if (!this.__isOpen) {
      Log.throw("Cannot cast vote. Vote is not open.");
    }
    const voteOption: {
      readonly letter: string;
      readonly option: string;
    } | null = this.__getVoteOption(letter);
    if (voteOption === null) {
      return null;
    }
    this.__votesByUserId[userId] = voteOption.letter;
    return voteOption.option;
  }

  public close(): void {
    this.__isOpen = false;
  }

  public getSortedResults(): VotingOptionResult[] {
    const voteCountsByLetter: Record<string, number> = {};
    Object.values(this.__votesByUserId).forEach(letter => {
      voteCountsByLetter[letter] = (voteCountsByLetter[letter] ?? 0) + 1;
    });
    return this.__options
      .map((option, index) => ({
        index,
        letter: this.__indexToLetter(index),
        option,
        voteCount: voteCountsByLetter[this.__indexToLetter(index)] ?? 0,
      }))
      .sort((a, b) => {
        if (a.voteCount !== b.voteCount) {
          return b.voteCount - a.voteCount;
        }
        return a.index - b.index;
      })
      .map(({ letter, option, voteCount }) => ({ letter, option, voteCount }));
  }

  public toJson(): VotingStateJson {
    return {
      channelId: this.channelId,
      guildId: this.guildId,
      isOpen: this.__isOpen,
      messageId: this.messageId ?? undefined,
      options: [...this.__options],
      votesByUserId: { ...this.__votesByUserId },
    };
  }

  private __containsNormalizedLetter(letter: string | null): boolean {
    if (letter === null) {
      return false;
    }
    const optionIndex: number = this.__letterToIndex(letter);
    return optionIndex >= 0 && optionIndex < this.__options.length;
  }

  private __getVoteOption(
    letter: string | undefined,
  ): { readonly letter: string; readonly option: string } | null {
    const normalizedLetter: string | null = this.__normalizeLetter(letter);
    if (
      normalizedLetter === null ||
      !this.__containsNormalizedLetter(normalizedLetter)
    ) {
      return null;
    }
    return {
      letter: normalizedLetter,
      option: this.__options[this.__letterToIndex(normalizedLetter)],
    };
  }

  private __indexToLetter(index: number): string {
    return String.fromCharCode("A".charCodeAt(0) + index);
  }

  private __letterToIndex(letter: string): number {
    if (!/^[A-Z]$/.test(letter)) {
      return -1;
    }
    return letter.charCodeAt(0) - "A".charCodeAt(0);
  }

  private __normalizeLetter(letter: string | undefined): string | null {
    if (letter === undefined) {
      return null;
    }
    const normalizedLetter: string = letter.trim().toUpperCase();
    if (!/^[A-Z]$/.test(normalizedLetter)) {
      return null;
    }
    return normalizedLetter;
  }

  private __normalizeVotesByUserId(
    votesByUserId: Record<string, string>,
  ): Record<string, string> {
    const normalizedVotesByUserId: Record<string, string> = {};
    Object.entries(votesByUserId).forEach(([userId, letter]) => {
      const normalizedLetter: string | null = this.__normalizeLetter(letter);
      if (
        normalizedLetter === null ||
        !this.__containsNormalizedLetter(normalizedLetter)
      ) {
        Log.error("Ignoring invalid persisted vote.", {
          letter,
          normalizedLetter,
          options: this.__options,
          userId,
        });
        return;
      }
      normalizedVotesByUserId[userId] = normalizedLetter;
    });
    return normalizedVotesByUserId;
  }
}
