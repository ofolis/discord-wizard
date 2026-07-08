import { Log, Saveable } from "../core";
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
      this.__votesByUserId = { ...(stateOrJson.votesByUserId ?? {}) };
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
    const optionIndex: number = this.__letterToIndex(normalizedLetter);
    return optionIndex >= 0 && optionIndex < this.__options.length;
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

  private __indexToLetter(index: number): string {
    return String.fromCharCode("A".charCodeAt(0) + index);
  }

  private __letterToIndex(letter: string): number {
    return letter.charCodeAt(0) - "A".charCodeAt(0);
  }

  private __normalizeLetter(letter: string): string {
    return letter.toUpperCase();
  }
}
