import { DataController, InteractionController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandRegistrationType,
  Log,
} from "../core";
import { CallInState } from "../saveables";
import { CallInUtils } from "./call-in-utils";

export class CallInEnd implements Command {
  public readonly description: string = "Ends call-in mode.";

  public readonly isAvailableToAllUsers: boolean = false;

  public readonly name: string = "callinend";

  public readonly options: CommandOption[] = [];

  public readonly registrationType: CommandRegistrationType =
    CommandRegistrationType.GUILD;

  public readonly shouldReplyPrivately: boolean = true;

  public async authorizeUse(message: ChannelCommandMessage): Promise<boolean> {
    return await CallInUtils.requireCallInManager(message);
  }

  public async execute(message: ChannelCommandMessage): Promise<void> {
    const callInState: CallInState | null =
      await CallInUtils.requireActiveCallInState(message);
    if (callInState === null) {
      return;
    }

    try {
      callInState.startEnding();
      DataController.saveCallInState(callInState);
      const didUnmuteAll: boolean = await CallInUtils.unmuteTrackedMembers(
        message.member.guild,
        callInState,
      );
      DataController.saveCallInState(callInState);
      if (!didUnmuteAll) {
        Log.throw("Could not unmute all tracked call-in members.");
      }
      callInState.close();
      DataController.saveCallInState(callInState);
      await InteractionController.announceCallInEnd(callInState.channelId);
    } catch (reason: unknown) {
      Log.error("Could not end call-in mode.", reason);
      await InteractionController.informError(
        message,
        "Could not end call-in mode. Contact an admin.",
      );
      return;
    }
    await InteractionController.informSuccess(message, "Call-in mode ended.");
  }
}
