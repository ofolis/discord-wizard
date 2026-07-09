import { DataController, InteractionController } from "../controllers";
import {
  AppError,
  AppErrorCode,
  ChannelCommandMessage,
  Command,
  CommandOption,
  Log,
} from "../core";
import { BettingState } from "../saveables";
import { AdminUtils } from "./admin-utils";

export class BetLock implements Command {
  public readonly description: string = "Locks the open bet.";

  public readonly isGlobal: boolean = false;

  public readonly isGuild: boolean = true;

  public readonly isPrivate: boolean = true;

  public readonly name: string = "betlock";

  public readonly options: CommandOption[] = [];

  public async execute(message: ChannelCommandMessage): Promise<void> {
    if (!(await AdminUtils.requireAdministrator(message))) {
      return;
    }

    const bettingState: BettingState | null =
      DataController.loadActiveBettingState(message.member.guild.id);
    if (bettingState === null) {
      await InteractionController.informError(message, "There is no open bet.");
      return;
    }
    if (bettingState.isLocked) {
      await InteractionController.informError(
        message,
        "The bet is already locked.",
      );
      return;
    }

    bettingState.lock();
    try {
      DataController.saveBettingState(bettingState);
    } catch (reason: unknown) {
      Log.error("Could not save bet lock.", reason);
      await InteractionController.informError(
        message,
        "Could not lock the bet. Contact an admin.",
      );
      return;
    }

    try {
      await InteractionController.updateBetStart(bettingState, {});
    } catch (reason: unknown) {
      Log.error("Could not update locked bet.", reason);
      const isMissingChannel: boolean = AppError.is(
        reason,
        AppErrorCode.DISCORD_CHANNEL_NOT_FOUND,
      );
      await InteractionController.informError(
        message,
        isMissingChannel
          ? "The bet was locked, but the bet channel was not found. Contact an admin."
          : "The bet was locked, but the bet message could not be updated. Contact an admin.",
      );
      return;
    }

    await InteractionController.informSuccess(message, "Bet locked.");
  }
}
