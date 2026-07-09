import type { Json, Saveable } from "../core";
import { Log } from "../core";
import type { MoneyStateJson } from "../types";

export class MoneyState implements Saveable {
  public readonly guildId: string;

  private readonly __balancesByUserId: Record<string, number>;

  public constructor(guildId: string) {
    this.guildId = guildId;
    this.__balancesByUserId = {};
  }

  public static fromJson(json: Json, expectedGuildId: string): MoneyState {
    const moneyStateJson: MoneyStateJson = this.__parseJson(
      json,
      expectedGuildId,
    );
    const moneyState: MoneyState = new MoneyState(moneyStateJson.guildId);
    Object.entries(moneyStateJson.balancesByUserId ?? {}).forEach(
      ([userId, balanceCents]) => {
        moneyState.setBalance(userId, balanceCents);
      },
    );
    return moneyState;
  }

  private static __parseJson(
    json: Json,
    expectedGuildId: string,
  ): MoneyStateJson {
    const balancesByUserId: unknown = json.balancesByUserId;
    const hasValidBalancesByUserId: boolean =
      balancesByUserId === undefined ||
      (typeof balancesByUserId === "object" &&
        balancesByUserId !== null &&
        !Array.isArray(balancesByUserId) &&
        Object.values(balancesByUserId as Record<string, unknown>).every(
          balance => Number.isInteger(balance),
        ));

    if (
      typeof json.guildId !== "string" ||
      json.guildId !== expectedGuildId ||
      !hasValidBalancesByUserId
    ) {
      Log.throw(
        "Cannot load money state. Stored money state JSON is invalid.",
        {
          expectedGuildId,
          json,
        },
      );
    }

    return {
      balancesByUserId: balancesByUserId as Record<string, number> | undefined,
      guildId: json.guildId,
    };
  }

  public addBalance(userId: string, amountCents: number): void {
    this.setBalance(userId, this.getBalance(userId) + amountCents);
  }

  public getBalance(userId: string): number {
    return this.__balancesByUserId[userId] ?? 0;
  }

  public setBalance(userId: string, amountCents: number): void {
    if (!Number.isInteger(amountCents)) {
      Log.throw("Cannot set user money. Amount is not an integer.", {
        amountCents,
        userId,
      });
    }
    this.__balancesByUserId[userId] = Math.max(0, amountCents);
  }

  public toJson(): MoneyStateJson {
    return {
      balancesByUserId: { ...this.__balancesByUserId },
      guildId: this.guildId,
    };
  }
}
