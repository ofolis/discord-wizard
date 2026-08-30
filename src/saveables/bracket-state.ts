import type { Json, Saveable } from "../core";
import { Log } from "../core";
import type {
  BracketMatchJson,
  BracketMatchParticipantJson,
  BracketStateJson,
} from "../types";

type BracketParticipant = {
  readonly participantIndex: number;
  readonly type: "participant";
};

type BracketWinner = {
  readonly matchNumber: number;
  readonly type: "winner";
};

type BracketMatchParticipant = BracketParticipant | BracketWinner;

type BracketMatch = {
  readonly number: number;
  readonly participant1: BracketMatchParticipant;
  readonly participant2: BracketMatchParticipant;
  winnerPosition: number | null;
};

export type BracketMatchSummary = {
  readonly isReady: boolean;
  readonly number: number;
  readonly participant1: string;
  readonly participant2: string;
  readonly winner: string | null;
  readonly winnerPosition: number | null;
};

export class BracketState implements Saveable {
  public static readonly maxParticipantCount: number = 64;

  public static readonly minParticipantCount: number = 2;

  public readonly channelId: string;

  public readonly guildId: string;

  public messageId: string | null;

  private __isOpen: boolean;

  private readonly __matches: BracketMatch[];

  private readonly __participants: string[];

  public constructor(state: {
    readonly channelId: string;
    readonly guildId: string;
    readonly participants: string[];
  }) {
    BracketState.__validateParticipants(state.participants);
    this.channelId = state.channelId;
    this.guildId = state.guildId;
    this.messageId = null;
    this.__isOpen = true;
    this.__participants = [...state.participants];
    this.__matches = this.__buildMatches();
  }

  public get champion(): string | null {
    if (!this.isComplete) {
      return null;
    }
    const finalMatch: BracketMatch = this.__matches[this.__matches.length - 1];
    return this.__resolveParticipant(this.__getWinningParticipant(finalMatch));
  }

  public get isComplete(): boolean {
    return this.__matches.every(match => match.winnerPosition !== null);
  }

  public get isOpen(): boolean {
    return this.__isOpen;
  }

  public get participants(): readonly string[] {
    return this.__participants;
  }

  public static fromJson(json: Json, expectedGuildId: string): BracketState {
    const bracketStateJson: BracketStateJson = this.__parseJson(
      json,
      expectedGuildId,
    );
    const bracketState: BracketState = new BracketState({
      channelId: bracketStateJson.channelId,
      guildId: bracketStateJson.guildId,
      participants: bracketStateJson.participants,
    });
    bracketState.__isOpen = bracketStateJson.isOpen;
    bracketState.messageId = bracketStateJson.messageId ?? null;
    bracketState.__matches.length = 0;
    bracketStateJson.matches.forEach(match => {
      bracketState.__matches.push({
        number: match.number,
        participant1: match.participant1,
        participant2: match.participant2,
        winnerPosition: match.winnerPosition ?? null,
      });
    });
    return bracketState;
  }

  private static __isMatchJson(value: unknown): value is BracketMatchJson {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }
    const candidate: Partial<BracketMatchJson> =
      value as Partial<BracketMatchJson>;
    return (
      Number.isSafeInteger(candidate.number) &&
      this.__isParticipantJson(candidate.participant1) &&
      this.__isParticipantJson(candidate.participant2) &&
      (candidate.winnerPosition === undefined ||
        candidate.winnerPosition === 1 ||
        candidate.winnerPosition === 2)
    );
  }

  private static __isParticipantJson(
    value: unknown,
  ): value is BracketMatchParticipantJson {
    if (typeof value !== "object" || value === null || Array.isArray(value)) {
      return false;
    }
    const candidate: Partial<BracketMatchParticipantJson> =
      value as Partial<BracketMatchParticipantJson>;
    if (
      candidate.type === "participant" &&
      Number.isSafeInteger(candidate.participantIndex)
    ) {
      return true;
    }
    return (
      candidate.type === "winner" && Number.isSafeInteger(candidate.matchNumber)
    );
  }

  private static __isValidParticipant(participant: string): boolean {
    return participant.trim().length > 0;
  }

  private static __parseJson(
    json: Json,
    expectedGuildId: string,
  ): BracketStateJson {
    const matches: unknown = json.matches;
    const messageId: unknown = json.messageId;
    const hasValidParticipants: boolean =
      Array.isArray(json.participants) &&
      json.participants.every(
        participant =>
          typeof participant === "string" &&
          this.__isValidParticipant(participant),
      ) &&
      json.participants.length >= this.minParticipantCount &&
      json.participants.length <= this.maxParticipantCount;
    const hasValidMatches: boolean =
      Array.isArray(matches) &&
      matches.every(match => this.__isMatchJson(match));
    const hasValidMessageId: boolean =
      messageId === undefined || typeof messageId === "string";

    if (
      typeof json.channelId !== "string" ||
      typeof json.guildId !== "string" ||
      json.guildId !== expectedGuildId ||
      typeof json.isOpen !== "boolean" ||
      !hasValidParticipants ||
      !hasValidMatches ||
      !hasValidMessageId
    ) {
      Log.throw(
        "Cannot load bracket state. Stored bracket state JSON is invalid.",
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
      matches: matches as BracketMatchJson[],
      messageId: messageId as string | undefined,
      participants: json.participants as string[],
    };
  }

  private static __validateParticipants(participants: readonly string[]): void {
    if (
      participants.length < this.minParticipantCount ||
      participants.length > this.maxParticipantCount ||
      !participants.every(participant => this.__isValidParticipant(participant))
    ) {
      Log.throw("Cannot create bracket state. Participants are invalid.", {
        maxParticipantCount: this.maxParticipantCount,
        minParticipantCount: this.minParticipantCount,
        participants,
      });
    }
  }

  public close(): void {
    this.__isOpen = false;
  }

  public getMatch(number: number): BracketMatchSummary | null {
    const match: BracketMatch | null = this.__getMatch(number);
    if (match === null) {
      return null;
    }
    return this.__toMatchSummary(match);
  }

  public getMatchSummaries(): BracketMatchSummary[] {
    return this.__matches.map(match => this.__toMatchSummary(match));
  }

  public getNextUnresolvedMatch(): BracketMatchSummary | null {
    const match: BracketMatch | undefined = this.__matches.find(
      candidate =>
        candidate.winnerPosition === null &&
        this.__resolveParticipant(candidate.participant1) !== null &&
        this.__resolveParticipant(candidate.participant2) !== null,
    );
    if (match === undefined) {
      return null;
    }
    return this.__toMatchSummary(match);
  }

  public setMatchResult(
    number: number,
    winnerPosition: number | null,
  ): boolean {
    if (!this.__isOpen) {
      Log.throw("Cannot set match result. Bracket is not open.");
    }
    const match: BracketMatch | null = this.__getMatch(number);
    if (match === null) {
      return false;
    }
    const normalizedWinnerPosition: number | null =
      this.__normalizeWinnerPosition(winnerPosition);
    if (
      normalizedWinnerPosition !== null &&
      (this.__resolveParticipant(match.participant1) === null ||
        this.__resolveParticipant(match.participant2) === null)
    ) {
      return false;
    }
    this.__clearDependentWinners(number);
    match.winnerPosition = normalizedWinnerPosition;
    return true;
  }

  public toJson(): BracketStateJson {
    return {
      channelId: this.channelId,
      guildId: this.guildId,
      isOpen: this.__isOpen,
      matches: this.__matches.map(match => ({
        number: match.number,
        participant1: match.participant1,
        participant2: match.participant2,
        winnerPosition: match.winnerPosition ?? undefined,
      })),
      messageId: this.messageId ?? undefined,
      participants: [...this.__participants],
    };
  }

  private __buildMatches(): BracketMatch[] {
    const matches: BracketMatch[] = [];
    let entrants: BracketMatchParticipant[] = [
      ...this.__participants.keys(),
    ].map(participantIndex => ({
      participantIndex,
      type: "participant",
    }));
    while (entrants.length > 1) {
      const nextEntrants: BracketMatchParticipant[] = [];
      for (let index: number = 0; index + 1 < entrants.length; index += 2) {
        const participant1: BracketMatchParticipant = entrants[index];
        const participant2: BracketMatchParticipant = entrants[index + 1];
        const number: number = matches.length + 1;
        matches.push({
          number,
          participant1,
          participant2,
          winnerPosition: null,
        });
        nextEntrants.push({
          matchNumber: number,
          type: "winner",
        });
      }
      if (entrants.length % 2 === 1) {
        nextEntrants.push(entrants[entrants.length - 1]);
      }
      entrants = nextEntrants;
    }
    return matches;
  }

  private __clearDependentWinners(matchNumber: number): void {
    this.__matches.forEach(match => {
      if (this.__dependsOnMatch(match, matchNumber)) {
        match.winnerPosition = null;
      }
    });
  }

  private __dependsOnMatch(match: BracketMatch, matchNumber: number): boolean {
    return (
      this.__participantDependsOnMatch(match.participant1, matchNumber) ||
      this.__participantDependsOnMatch(match.participant2, matchNumber)
    );
  }

  private __formatParticipantPlaceholder(
    participant: BracketMatchParticipant,
  ): string {
    if (participant.type === "participant") {
      return this.__participants[participant.participantIndex] ?? "Unknown";
    }
    return `#${participant.matchNumber.toString()} Winner`;
  }

  private __getMatch(number: number): BracketMatch | null {
    return this.__matches.find(match => match.number === number) ?? null;
  }

  private __getWinningParticipant(
    match: BracketMatch,
  ): BracketMatchParticipant {
    return match.winnerPosition === 1 ? match.participant1 : match.participant2;
  }

  private __normalizeWinnerPosition(position: number | null): number | null {
    if (position === null) {
      return null;
    }
    if (position !== 1 && position !== 2) {
      return null;
    }
    return position;
  }

  private __participantDependsOnMatch(
    participant: BracketMatchParticipant,
    matchNumber: number,
  ): boolean {
    if (participant.type === "participant") {
      return false;
    }
    if (participant.matchNumber === matchNumber) {
      return true;
    }
    const sourceMatch: BracketMatch | null = this.__getMatch(
      participant.matchNumber,
    );
    return (
      sourceMatch !== null && this.__dependsOnMatch(sourceMatch, matchNumber)
    );
  }

  private __resolveParticipant(
    participant: BracketMatchParticipant,
  ): string | null {
    if (participant.type === "participant") {
      return this.__participants[participant.participantIndex] ?? null;
    }
    const sourceMatch: BracketMatch | null = this.__getMatch(
      participant.matchNumber,
    );
    if (sourceMatch === null || sourceMatch.winnerPosition === null) {
      return null;
    }
    return this.__resolveParticipant(this.__getWinningParticipant(sourceMatch));
  }

  private __toMatchSummary(match: BracketMatch): BracketMatchSummary {
    const winningParticipant: BracketMatchParticipant | null =
      match.winnerPosition === null
        ? null
        : this.__getWinningParticipant(match);
    return {
      isReady:
        this.__resolveParticipant(match.participant1) !== null &&
        this.__resolveParticipant(match.participant2) !== null,
      number: match.number,
      participant1:
        this.__resolveParticipant(match.participant1) ??
        this.__formatParticipantPlaceholder(match.participant1),
      participant2:
        this.__resolveParticipant(match.participant2) ??
        this.__formatParticipantPlaceholder(match.participant2),
      winner:
        winningParticipant === null
          ? null
          : this.__resolveParticipant(winningParticipant),
      winnerPosition: match.winnerPosition,
    };
  }
}
