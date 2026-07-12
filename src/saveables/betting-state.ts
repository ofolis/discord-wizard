import type { Json, Saveable } from "../core";
import { Log } from "../core";
import type { BettingStateJson } from "../types";

type Bet = {
  readonly amountCents: number;
  readonly letter: string;
};

type BetsByLetter = Record<string, Bet>;

type UserBet = {
  readonly bet: Bet;
  readonly key: string;
  readonly userId: string;
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

type BettingRefund = {
  readonly amountCents: number;
  readonly userId: string;
};

export class BettingState implements Saveable {
  public static readonly maxOptionCount: number = 26;

  public static readonly minOptionCount: number = 2;

  public static readonly minWagerCents: number = 100;

  public readonly channelId: string;

  public readonly guildId: string;

  public messageId: string | null;

  private readonly __betsByUserId: Partial<Record<string, BetsByLetter>>;

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
    return this.__getUserBets().reduce(
      (total, { bet }) =>
        BettingState.__addSafeCents(
          total,
          bet.amountCents,
          "Cannot calculate total pool. Total is not a safe integer.",
        ),
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
      .forEach(([userId, betsByLetter]) => {
        bettingState.__betsByUserId[userId] = betsByLetter;
      });
    return bettingState;
  }

  private static __addSafeCents(
    totalCents: number,
    amountCents: number,
    errorMessage: string,
  ): number {
    const nextTotalCents: number = totalCents + amountCents;
    if (!Number.isSafeInteger(nextTotalCents)) {
      Log.throw(errorMessage, {
        amountCents,
        nextTotalCents,
        totalCents,
      });
    }
    return nextTotalCents;
  }

  private static __isStoredBetJson(value: unknown): boolean {
    return (
      typeof value === "object" &&
      value !== null &&
      !Array.isArray(value) &&
      typeof (value as Record<string, unknown>).letter === "string" &&
      Number.isSafeInteger((value as Record<string, unknown>).amountCents) &&
      ((value as Record<string, unknown>).amountCents as number) > 0
    );
  }

  private static __isStoredUserBetsJson(value: unknown): boolean {
    return (
      this.__isStoredBetJson(value) ||
      (typeof value === "object" &&
        value !== null &&
        !Array.isArray(value) &&
        Object.values(value as Record<string, unknown>).every(bet =>
          this.__isStoredBetJson(bet),
        ))
    );
  }

  private static __isValidOption(option: string): boolean {
    return option.trim().length > 0;
  }

  private static __parseJson(
    json: Json,
    expectedGuildId: string,
  ): BettingStateJson {
    const betsByUserId: unknown = json.betsByUserId;
    const messageId: unknown = json.messageId;
    const hasValidOptions: boolean =
      Array.isArray(json.options) &&
      json.options.every(
        option => typeof option === "string" && this.__isValidOption(option),
      ) &&
      json.options.length >= this.minOptionCount &&
      json.options.length <= this.maxOptionCount;
    const hasValidMessageId: boolean =
      messageId === undefined || typeof messageId === "string";
    const hasValidBetsByUserId: boolean =
      betsByUserId === undefined ||
      (typeof betsByUserId === "object" &&
        betsByUserId !== null &&
        !Array.isArray(betsByUserId) &&
        Object.values(betsByUserId as Record<string, unknown>).every(userBets =>
          this.__isStoredUserBetsJson(userBets),
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

  private static __toSafeInteger(value: bigint, errorMessage: string): number {
    const maxSafeInteger: bigint = BigInt(Number.MAX_SAFE_INTEGER);
    const minSafeInteger: bigint = BigInt(Number.MIN_SAFE_INTEGER);
    if (value > maxSafeInteger || value < minSafeInteger) {
      Log.throw(errorMessage, {
        value: value.toString(),
      });
    }
    return Number(value);
  }

  private static __validateOptions(options: readonly string[]): void {
    if (
      options.length < this.minOptionCount ||
      options.length > this.maxOptionCount ||
      !options.every(option => this.__isValidOption(option))
    ) {
      Log.throw("Cannot create betting state. Options are invalid.", {
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

    const winningBets: UserBet[] = this.__getUserBets().filter(({ bet }) =>
      normalizedWinningLetters.includes(bet.letter),
    );
    const winningTotalCents: number = winningBets.reduce(
      (total, { bet }) =>
        BettingState.__addSafeCents(
          total,
          bet.amountCents,
          "Cannot calculate winning total. Total is not a safe integer.",
        ),
      0,
    );
    const totalPoolCents: number = this.totalPoolCents;
    const payoutsByKey: Record<string, number> =
      winningTotalCents > 0
        ? this.__calculateDistributedPayouts(
            winningBets,
            totalPoolCents,
            winningTotalCents,
          )
        : {};

    return this.__getUserBets().map(({ bet, key, userId }) => {
      const payoutCents: number = payoutsByKey[key] ?? 0;
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
      const wagers: BettingOptionSummary["wagers"] = this.__getUserBets()
        .filter(({ bet }) => bet.letter === letter)
        .map(({ bet, userId }) => ({
          amountCents: bet.amountCents,
          userId,
        }))
        .sort((a, b) => b.amountCents - a.amountCents);
      return {
        letter,
        option,
        totalCents: wagers.reduce(
          (total, wager) =>
            BettingState.__addSafeCents(
              total,
              wager.amountCents,
              "Cannot summarize bet option. Total is not a safe integer.",
            ),
          0,
        ),
        wagers,
      };
    });
  }

  public getParticipantUserIds(): string[] {
    return Object.keys(this.__betsByUserId);
  }

  public getRefunds(): BettingRefund[] {
    return this.__getUserBets().map(({ bet, userId }) => ({
      amountCents: bet.amountCents,
      userId,
    }));
  }

  public getWager(userId: string, letter: string): Bet | null {
    const normalizedLetter: string | null = this.__normalizeLetter(letter);
    if (normalizedLetter === null) {
      return null;
    }
    return this.__betsByUserId[userId]?.[normalizedLetter] ?? null;
  }

  public lock(): void {
    this.__isLocked = true;
  }

  public placeWager(
    userId: string,
    letter: string,
    amountCents: number,
  ): string | null {
    if (!this.__isOpen || this.__isLocked) {
      Log.throw("Cannot place wager. Bet is not accepting wagers.");
    }
    if (
      !Number.isSafeInteger(amountCents) ||
      amountCents < 0 ||
      (amountCents > 0 && amountCents < BettingState.minWagerCents)
    ) {
      Log.throw("Cannot place wager. Amount is invalid.", {
        amountCents,
        minWagerCents: BettingState.minWagerCents,
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
      const betsByLetter: BetsByLetter | undefined =
        this.__betsByUserId[userId];
      const existingBet: Bet | null = betsByLetter?.[betOption.letter] ?? null;
      if (betsByLetter !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- User IDs and option letters are dynamic wager keys.
        delete betsByLetter[betOption.letter];
      }
      if (
        betsByLetter !== undefined &&
        Object.keys(betsByLetter).length === 0
      ) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- User IDs are dynamic wager keys.
        delete this.__betsByUserId[userId];
      }
      if (existingBet === null) {
        return "";
      }
      return this.__options[this.__letterToIndex(existingBet.letter)];
    }
    this.__betsByUserId[userId] = {
      ...this.__betsByUserId[userId],
      [betOption.letter]: {
        amountCents,
        letter: betOption.letter,
      },
    };
    return betOption.option;
  }

  public toJson(): BettingStateJson {
    return {
      betsByUserId: Object.fromEntries(
        Object.entries(this.__betsByUserId).map(([userId, betsByLetter]) => [
          userId,
          { ...(betsByLetter ?? {}) },
        ]),
      ),
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
    winningBets: UserBet[],
    totalPoolCents: number,
    winningTotalCents: number,
  ): Record<string, number> {
    const payoutEntries: {
      readonly basePayoutCents: number;
      readonly key: string;
      readonly remainder: bigint;
    }[] = winningBets.map(({ bet, key }) => {
      const numerator: bigint =
        BigInt(totalPoolCents) * BigInt(bet.amountCents);
      const basePayoutCents: bigint = numerator / BigInt(winningTotalCents);
      return {
        basePayoutCents: BettingState.__toSafeInteger(
          basePayoutCents,
          "Cannot calculate bet payout. Payout is not a safe integer.",
        ),
        key,
        remainder: numerator % BigInt(winningTotalCents),
      };
    });
    const payoutsByKey: Record<string, number> = {};
    let distributedCents: bigint = 0n;
    payoutEntries.forEach(entry => {
      payoutsByKey[entry.key] = entry.basePayoutCents;
      distributedCents += BigInt(entry.basePayoutCents);
    });
    const remainingCents: number = BettingState.__toSafeInteger(
      BigInt(totalPoolCents) - distributedCents,
      "Cannot calculate bet payout remainders. Remainder is not a safe integer.",
    );
    payoutEntries
      .sort((a, b) =>
        a.remainder === b.remainder ? 0 : a.remainder < b.remainder ? 1 : -1,
      )
      .slice(0, remainingCents)
      .forEach(entry => {
        payoutsByKey[entry.key] += 1;
      });
    return payoutsByKey;
  }

  private __containsNormalizedLetter(letter: string | null): boolean {
    if (letter === null) {
      return false;
    }
    const optionIndex: number = this.__letterToIndex(letter);
    return optionIndex >= 0 && optionIndex < this.__options.length;
  }

  private __getBetOption(
    letter: string,
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

  private __getUserBets(): UserBet[] {
    return Object.entries(this.__betsByUserId).flatMap(
      ([userId, betsByLetter]) =>
        Object.entries(betsByLetter ?? {}).map(([letter, bet]) => ({
          bet,
          key: `${userId}:${letter}`,
          userId,
        })),
    );
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
  ): [string, BetsByLetter][] {
    return Object.entries(betsByUserId).flatMap(([userId, rawUserBets]) => {
      const rawBets: unknown[] = BettingState.__isStoredBetJson(rawUserBets)
        ? [rawUserBets]
        : Object.values(rawUserBets);
      const betsByLetter: BetsByLetter = {};
      rawBets.forEach(rawBet => {
        if (!BettingState.__isStoredBetJson(rawBet)) {
          Log.error("Ignoring invalid persisted bet.", {
            rawBet,
            userId,
          });
          return;
        }
        const bet: Bet = rawBet as Bet;
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
          return;
        }
        betsByLetter[normalizedLetter] = {
          amountCents: bet.amountCents,
          letter: normalizedLetter,
        };
      });
      return Object.keys(betsByLetter).length > 0
        ? [[userId, betsByLetter]]
        : [];
    });
  }

  private __normalizeLetter(letter: string): string | null {
    const normalizedLetter: string = letter.trim().toUpperCase();
    if (!/^[A-Z]$/.test(normalizedLetter)) {
      return null;
    }
    return normalizedLetter;
  }
}
