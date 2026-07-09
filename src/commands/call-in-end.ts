import { DataController, InteractionController } from "../controllers";
import { ChannelCommandMessage, Command, CommandOption, Log } from "../core";
import { CallInState } from "../saveables";
import { CallInUtils } from "./call-in-utils";

export class CallInEnd implements Command {
  public readonly description: string = "Ends call-in mode.";

  public readonly isGlobal: boolean = false;

  public readonly isGuild: boolean = true;

  public readonly isPrivate: boolean = true;

  public readonly name: string = "callinend";

  public readonly options: CommandOption[] = [];

  public async execute(message: ChannelCommandMessage): Promise<void> {
    if (!(await CallInUtils.requireHost(message))) {
      return;
    }
    const callInState: CallInState | null =
      await CallInUtils.requireActiveCallInState(message);
    if (callInState === null) {
      return;
    }

    try {
      await CallInUtils.unmuteTrackedMembers(message.member.guild, callInState);
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
