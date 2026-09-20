import { DataController, InteractionController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandRegistrationType,
  Log,
} from "../core";
import { BracketState } from "../saveables";

export class BracketShow implements Command {
  public readonly description: string = "Shows the active bracket.";

  public readonly isAvailableToAllUsers: boolean = false;

  public readonly name: string = "bracketshow";

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
      await InteractionController.announceBracketShow(
        bracketState.channelId,
        bracketState,
      );
    } catch (reason: unknown) {
      Log.error("Could not post bracket.", reason);
      await InteractionController.informError(
        message,
        "Could not post the bracket. Contact an admin.",
      );
      return;
    }

    await InteractionController.informSuccess(message, "Bracket posted.");
  }
}
