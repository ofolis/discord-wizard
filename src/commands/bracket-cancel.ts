import { DataController, InteractionController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandRegistrationType,
  Log,
} from "../core";
import { BracketState } from "../saveables";

export class BracketCancel implements Command {
  public readonly description: string = "Cancels the active bracket.";

  public readonly isAvailableToAllUsers: boolean = false;

  public readonly name: string = "bracketcancel";

  public readonly options: CommandOption[] = [];

  public readonly registrationType: CommandRegistrationType =
    CommandRegistrationType.GUILD;

  public readonly shouldReplyPrivately: boolean = true;

  public async execute(message: ChannelCommandMessage): Promise<void> {
    const bracketState: BracketState | null =
      DataController.loadActiveBracketState(message.member.guild.id);
    if (bracketState === null) {
      await InteractionController.informError(
        message,
        "There is no active bracket.",
      );
      return;
    }

    try {
      DataController.deleteBracketState(bracketState.guildId);
    } catch (reason: unknown) {
      Log.error("Could not delete bracket state.", reason);
      await InteractionController.informError(
        message,
        "Could not cancel the bracket. Contact an admin.",
      );
      return;
    }

    if (bracketState.messageId !== null) {
      try {
        await InteractionController.updateBracketCanceled(bracketState);
      } catch (reason: unknown) {
        Log.error("Could not update canceled bracket post.", reason);
        await InteractionController.informSuccess(
          message,
          "Bracket canceled, but the original post could not be updated. Contact an admin.",
        );
        return;
      }
    }

    await InteractionController.informSuccess(message, "Bracket canceled.");
  }
}
