import { DataController, InteractionController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  Discord,
  Log,
} from "../core";
import { CallInState } from "../saveables";
import { CallInUtils } from "./call-in-utils";

export class CallIn implements Command {
  public readonly description: string = "Toggles you on the call-in queue.";

  public readonly isGlobal: boolean = false;

  public readonly isGuild: boolean = true;

  public readonly isPrivate: boolean = true;

  public readonly name: string = "callin";

  public readonly options: CommandOption[] = [];

  public async execute(message: ChannelCommandMessage): Promise<void> {
    if (!(await CallInUtils.requireNonHost(message))) {
      return;
    }
    const callInState: CallInState | null =
      await CallInUtils.requireActiveCallInState(message);
    if (callInState === null) {
      return;
    }
    if (!CallInUtils.isInCallInVoiceChannel(message.member, callInState)) {
      await InteractionController.informError(
        message,
        "You need to be in the active call-in voice channel to call in.",
      );
      return;
    }
    if (callInState.hasSpeakingUser(message.user.id)) {
      await InteractionController.informError(
        message,
        "You are already live on the call.",
      );
      return;
    }

    const wasAdded: boolean = callInState.toggleQueuedUser(message.user.id);
    try {
      DataController.saveCallInState(callInState);
      await CallInUtils.postQueueToHosts(message.member.guild, callInState);
      if (wasAdded) {
        await InteractionController.announceCallInQueueAdd(
          callInState.channelId,
          {
            userName: message.member.displayName,
          },
        );
      }
    } catch (reason: unknown) {
      Log.error("Could not update call-in queue.", reason);
      await InteractionController.informError(
        message,
        "Could not update the call-in queue. Contact an admin.",
      );
      return;
    }

    await InteractionController.informSuccess(
      message,
      wasAdded ? "You are calling in." : "You hung up from the call-in queue.",
    );
    if (wasAdded) {
      Log.info("User joined call-in queue.", {
        user: Discord.formatUserNameString(message.user),
      });
    }
  }
}
