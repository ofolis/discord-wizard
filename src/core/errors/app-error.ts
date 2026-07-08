import { AppErrorCode } from "../enums";

export class AppError extends Error {
  public readonly code: AppErrorCode;

  public readonly data: readonly unknown[];

  public constructor(
    code: AppErrorCode,
    message: string,
    data: readonly unknown[] = [],
  ) {
    super(message);
    this.name = "AppError";
    this.code = code;
    this.data = data;
  }

  public static is(reason: unknown, code: AppErrorCode): boolean {
    return reason instanceof AppError && reason.code === code;
  }
}
