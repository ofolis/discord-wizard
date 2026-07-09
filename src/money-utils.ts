export class MoneyUtils {
  public static format(amountCents: number): string {
    const sign: string = amountCents < 0 ? "-" : "";
    const absoluteAmountCents: number = Math.abs(amountCents);
    const dollars: number = Math.floor(absoluteAmountCents / 100);
    const cents: number = absoluteAmountCents % 100;
    const dollarString: string = dollars
      .toString()
      .replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return `${sign}$${dollarString}.${cents.toString().padStart(2, "0")}`;
  }

  public static parseAmountCents(amount: number | undefined): number | null {
    if (amount === undefined || !Number.isFinite(amount) || amount < 0) {
      return null;
    }
    const amountCents: number = Math.round(amount * 100);
    if (!Number.isSafeInteger(amountCents)) {
      return null;
    }
    return amountCents;
  }
}
