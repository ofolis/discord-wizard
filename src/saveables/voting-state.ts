import { Json, Log, Saveable } from "../core";
import { VotingStateJson } from "../types";

type VotingOptionResult = {
  readonly option: string;
  readonly voteCount: number;
};

export class VotingState implements Saveable {
  public readonly channelId: string;

  public readonly guildId: string;

  private __isOpen: boolean;

  private readonly __options: string[];

  private readonly __votesByUserId: Record<string, string>;

  public constructor(
    stateOrJson:
      | VotingStateJson
      | {
          readonly channelId: string;
          readonly guildId: string;
          readonly options: string[];
        },
  ) {
    if ("isOpen" in stateOrJson) {
      this.channelId = stateOrJson.channelId;
      this.guildId = stateOrJson.guildId;
      this.__isOpen = stateOrJson.isOpen;
      this.__options = [...stateOrJson.options];
      this.__votesByUserId = this.__normalizeVotesByUserId(
        stateOrJson.votesByUserId ?? {},
      );
    } else {
      this.channelId = stateOrJson.channelId;
      this.guildId = stateOrJson.guildId;
      this.__isOpen = true;
      this.__options = [...stateOrJson.options];
      this.__votesByUserId = {};
    }
  }

  public get isOpen(): boolean {
    return this.__isOpen;
  }

  public get options(): readonly string[] {
    return this.__options;
  }

  public static fromJson(json: Json, expectedGuildId: string): VotingState {
    const votingStateJson: VotingStateJson = this.__parseJson(
      json,
      expectedGuildId,
    );
    return new VotingState(votingStateJson);
  }

  private static __parseJson(
    json: Json,
    expectedGuildId: string,
  ): VotingStateJson {
    const votesByUserId: unknown = json.votesByUserId;
    const hasValidVotesByUserId: boolean =
      votesByUserId === undefined ||
      (typeof votesByUserId === "object" &&
        votesByUserId !== null &&
        !Array.isArray(votesByUserId) &&
        Object.values(votesByUserId as Record<string, unknown>).every(
          vote => typeof vote === "string",
        ));

    if (
      typeof json.channelId !== "string" ||
      typeof json.guildId !== "string" ||
      json.guildId !== expectedGuildId ||
      typeof json.isOpen !== "boolean" ||
      !Array.isArray(json.options) ||
      !json.options.every(option => typeof option === "string") ||
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
      options: json.options,
      votesByUserId: votesByUserId as Record<string, string> | undefined,
    };
  }

  public castVote(userId: string, letter: string): string {
    if (!this.__isOpen) {
      Log.throw("Cannot cast vote. Vote is not open.");
    }
    const normalizedLetter: string = this.__normalizeLetter(letter);
    const optionIndex: number = this.__letterToIndex(normalizedLetter);
    if (optionIndex < 0 || optionIndex >= this.__options.length) {
      Log.throw("Cannot cast vote. Option letter does not exist.", {
        letter,
        options: this.__options,
      });
    }
    const option: string = this.__options[optionIndex];
    this.__votesByUserId[userId] = normalizedLetter;
    return option;
  }

  public close(): void {
    this.__isOpen = false;
  }

  public containsLetter(letter: string): boolean {
    const normalizedLetter: string = this.__normalizeLetter(letter);
    return this.__containsNormalizedLetter(normalizedLetter);
  }

  public getSortedResults(): VotingOptionResult[] {
    const voteCountsByLetter: Record<string, number> = {};
    Object.values(this.__votesByUserId).forEach(letter => {
      voteCountsByLetter[letter] = (voteCountsByLetter[letter] ?? 0) + 1;
    });
    return this.__options
      .map((option, index) => ({
        index,
        option,
        voteCount: voteCountsByLetter[this.__indexToLetter(index)] ?? 0,
      }))
      .sort((a, b) => {
        if (a.voteCount !== b.voteCount) {
          return b.voteCount - a.voteCount;
        }
        return a.index - b.index;
      })
      .map(({ option, voteCount }) => ({ option, voteCount }));
  }

  public toJson(): VotingStateJson {
    return {
      channelId: this.channelId,
      guildId: this.guildId,
      isOpen: this.__isOpen,
      options: [...this.__options],
      votesByUserId: { ...this.__votesByUserId },
    };
  }

  private __containsNormalizedLetter(letter: string): boolean {
    const optionIndex: number = this.__letterToIndex(letter);
    return optionIndex >= 0 && optionIndex < this.__options.length;
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

  private __normalizeLetter(letter: string): string {
    return letter.trim().toUpperCase();
  }

  private __normalizeVotesByUserId(
    votesByUserId: Record<string, string>,
  ): Record<string, string> {
    const normalizedVotesByUserId: Record<string, string> = {};
    Object.entries(votesByUserId).forEach(([userId, letter]) => {
      const normalizedLetter: string = this.__normalizeLetter(letter);
      if (!this.__containsNormalizedLetter(normalizedLetter)) {
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
