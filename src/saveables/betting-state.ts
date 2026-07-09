import type { Json, Saveable } from "../core";
import { Log } from "../core";
import type { BettingStateJson } from "../types";

type Bet = {
  readonly amountCents: number;
  readonly letter: string;
};

type BettingOptionSummary = {
  readonly letter: string;
  readonly option: string;
  readonly totalCents: number;
  readonly wagers: {
    readonly amountCents: number;
    readonly userId: string;
  }[];
};

type BettingPayout = {
  readonly amountCents: number;
  readonly letter: string;
  readonly netCents: number;
  readonly option: string;
  readonly payoutCents: number;
  readonly userId: string;
};

export class BettingState implements Saveable {
  public static readonly maxOptionCount: number = 26;

  public static readonly minOptionCount: number = 2;

  public readonly channelId: string;

  public readonly guildId: string;

  public messageId: string | null;

  private readonly __betsByUserId: Record<string, Bet>;

  private __isLocked: boolean;

  private __isOpen: boolean;

  private readonly __options: string[];

  public constructor(state: {
    readonly channelId: string;
    readonly guildId: string;
    readonly options: string[];
  }) {
    BettingState.__validateOptions(state.options);
    this.channelId = state.channelId;
    this.guildId = state.guildId;
    this.messageId = null;
    this.__betsByUserId = {};
    this.__isLocked = false;
    this.__isOpen = true;
    this.__options = [...state.options];
  }

  public get isLocked(): boolean {
    return this.__isLocked;
  }

  public get isOpen(): boolean {
    return this.__isOpen;
  }

  public get options(): readonly string[] {
    return this.__options;
  }

  public get totalPoolCents(): number {
    return Object.values(this.__betsByUserId).reduce(
      (total, bet) => total + bet.amountCents,
      0,
    );
  }

  public static fromJson(json: Json, expectedGuildId: string): BettingState {
    const bettingStateJson: BettingStateJson = this.__parseJson(
      json,
      expectedGuildId,
    );
    const bettingState: BettingState = new BettingState({
      channelId: bettingStateJson.channelId,
      guildId: bettingStateJson.guildId,
      options: bettingStateJson.options,
    });
    bettingState.__isLocked = bettingStateJson.isLocked;
    bettingState.__isOpen = bettingStateJson.isOpen;
    bettingState.messageId = bettingStateJson.messageId ?? null;
    bettingState
      .__normalizeBetsByUserId(bettingStateJson.betsByUserId ?? {})
      .forEach(([userId, bet]) => {
        bettingState.__betsByUserId[userId] = bet;
      });
    return bettingState;
  }

  private static __parseJson(
    json: Json,
    expectedGuildId: string,
  ): BettingStateJson {
    const betsByUserId: unknown = json.betsByUserId;
    const messageId: unknown = json.messageId;
    const hasValidOptions: boolean =
      Array.isArray(json.options) &&
      json.options.every(option => typeof option === "string") &&
      json.options.length >= this.minOptionCount &&
      json.options.length <= this.maxOptionCount;
    const hasValidMessageId: boolean =
      messageId === undefined || typeof messageId === "string";
    const hasValidBetsByUserId: boolean =
      betsByUserId === undefined ||
      (typeof betsByUserId === "object" &&
        betsByUserId !== null &&
        !Array.isArray(betsByUserId) &&
        Object.values(betsByUserId as Record<string, unknown>).every(
          bet =>
            typeof bet === "object" &&
            bet !== null &&
            !Array.isArray(bet) &&
            typeof (bet as Record<string, unknown>).letter === "string" &&
            Number.isInteger((bet as Record<string, unknown>).amountCents) &&
            ((bet as Record<string, unknown>).amountCents as number) > 0,
        ));

    if (
      typeof json.channelId !== "string" ||
      typeof json.guildId !== "string" ||
      json.guildId !== expectedGuildId ||
      typeof json.isLocked !== "boolean" ||
      typeof json.isOpen !== "boolean" ||
      !hasValidOptions ||
      !hasValidMessageId ||
      !hasValidBetsByUserId
    ) {
      Log.throw(
        "Cannot load betting state. Stored betting state JSON is invalid.",
        {
          expectedGuildId,
          json,
        },
      );
    }

    return {
      betsByUserId: betsByUserId as BettingStateJson["betsByUserId"],
      channelId: json.channelId,
      guildId: json.guildId,
      isLocked: json.isLocked,
      isOpen: json.isOpen,
      messageId: messageId as string | undefined,
      options: json.options as string[],
    };
  }

  private static __validateOptions(options: readonly string[]): void {
    if (
      options.length < this.minOptionCount ||
      options.length > this.maxOptionCount
    ) {
      Log.throw("Cannot create betting state. Option count is invalid.", {
        maxOptionCount: this.maxOptionCount,
        minOptionCount: this.minOptionCount,
        options,
      });
    }
  }

  public calculatePayouts(winningLetters: string[]): BettingPayout[] | null {
    const normalizedWinningLetters: string[] = [];
    for (const letter of winningLetters) {
      const normalizedLetter: string | null = this.__normalizeLetter(letter);
      if (
        normalizedLetter === null ||
        !this.__containsNormalizedLetter(normalizedLetter)
      ) {
        return null;
      }
      if (!normalizedWinningLetters.includes(normalizedLetter)) {
        normalizedWinningLetters.push(normalizedLetter);
      }
    }
    if (normalizedWinningLetters.length === 0) {
      return null;
    }

    const winningBets: [string, Bet][] = Object.entries(
      this.__betsByUserId,
    ).filter(([, bet]) => normalizedWinningLetters.includes(bet.letter));
    const winningTotalCents: number = winningBets.reduce(
      (total, [, bet]) => total + bet.amountCents,
      0,
    );
    const payoutsByUserId: Record<string, number> =
      winningTotalCents > 0
        ? this.__calculateDistributedPayouts(winningBets, winningTotalCents)
        : {};

    return Object.entries(this.__betsByUserId).map(([userId, bet]) => {
      const payoutCents: number = payoutsByUserId[userId] ?? 0;
      return {
        amountCents: bet.amountCents,
        letter: bet.letter,
        netCents: payoutCents - bet.amountCents,
        option: this.__options[this.__letterToIndex(bet.letter)],
        payoutCents,
        userId,
      };
    });
  }

  public close(): void {
    this.__isOpen = false;
  }

  public getOptionSummaries(): BettingOptionSummary[] {
    return this.__options.map((option, index) => {
      const letter: string = this.__indexToLetter(index);
      const wagers: BettingOptionSummary["wagers"] = Object.entries(
        this.__betsByUserId,
      )
        .filter(([, bet]) => bet.letter === letter)
        .map(([userId, bet]) => ({
          amountCents: bet.amountCents,
          userId,
        }))
        .sort((a, b) => b.amountCents - a.amountCents);
      return {
        letter,
        option,
        totalCents: wagers.reduce(
          (total, wager) => total + wager.amountCents,
          0,
        ),
        wagers,
      };
    });
  }

  public getParticipantUserIds(): string[] {
    return Object.keys(this.__betsByUserId);
  }

  public getWager(userId: string): Bet | null {
    return this.__betsByUserId[userId] ?? null;
  }

  public lock(): void {
    this.__isLocked = true;
  }

  public placeWager(
    userId: string,
    letter: string | undefined,
    amountCents: number,
  ): string | null {
    if (!this.__isOpen || this.__isLocked) {
      Log.throw("Cannot place wager. Bet is not accepting wagers.");
    }
    if (!Number.isInteger(amountCents) || amountCents < 0) {
      Log.throw("Cannot place wager. Amount is invalid.", {
        amountCents,
        userId,
      });
    }
    const betOption: {
      readonly letter: string;
      readonly option: string;
    } | null = this.__getBetOption(letter);
    if (betOption === null) {
      return null;
    }
    if (amountCents === 0) {
      // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- User IDs are dynamic wager keys.
      delete this.__betsByUserId[userId];
      return betOption.option;
    }
    this.__betsByUserId[userId] = {
      amountCents,
      letter: betOption.letter,
    };
    return betOption.option;
  }

  public toJson(): BettingStateJson {
    return {
      betsByUserId: { ...this.__betsByUserId },
      channelId: this.channelId,
      guildId: this.guildId,
      isLocked: this.__isLocked,
      isOpen: this.__isOpen,
      messageId: this.messageId ?? undefined,
      options: [...this.__options],
    };
  }

  public unlock(): void {
    this.__isLocked = false;
  }

  private __calculateDistributedPayouts(
    winningBets: [string, Bet][],
    winningTotalCents: number,
  ): Record<string, number> {
    const payoutEntries: {
      readonly basePayoutCents: number;
      readonly remainder: number;
      readonly userId: string;
    }[] = winningBets.map(([userId, bet]) => {
      const numerator: number = this.totalPoolCents * bet.amountCents;
      return {
        basePayoutCents: Math.floor(numerator / winningTotalCents),
        remainder: numerator % winningTotalCents,
        userId,
      };
    });
    const payoutsByUserId: Record<string, number> = {};
    let distributedCents: number = 0;
    payoutEntries.forEach(entry => {
      payoutsByUserId[entry.userId] = entry.basePayoutCents;
      distributedCents += entry.basePayoutCents;
    });
    const remainingCents: number = this.totalPoolCents - distributedCents;
    payoutEntries
      .sort((a, b) => b.remainder - a.remainder)
      .slice(0, remainingCents)
      .forEach(entry => {
        payoutsByUserId[entry.userId] += 1;
      });
    return payoutsByUserId;
  }

  private __containsNormalizedLetter(letter: string | null): boolean {
    if (letter === null) {
      return false;
    }
    const optionIndex: number = this.__letterToIndex(letter);
    return optionIndex >= 0 && optionIndex < this.__options.length;
  }

  private __getBetOption(
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

  private __normalizeBetsByUserId(
    betsByUserId: NonNullable<BettingStateJson["betsByUserId"]>,
  ): [string, Bet][] {
    return Object.entries(betsByUserId).flatMap(([userId, bet]) => {
      const normalizedLetter: string | null = this.__normalizeLetter(
        bet.letter,
      );
      if (
        normalizedLetter === null ||
        !this.__containsNormalizedLetter(normalizedLetter)
      ) {
        Log.error("Ignoring invalid persisted bet.", {
          bet,
          normalizedLetter,
          options: this.__options,
          userId,
        });
        return [];
      }
      return [
        [
          userId,
          {
            amountCents: bet.amountCents,
            letter: normalizedLetter,
          },
        ],
      ];
    });
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
}
