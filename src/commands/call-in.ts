import { DataController, InteractionController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandRegistrationType,
  Discord,
  Log,
} from "../core";
import { CallInState } from "../saveables";
import { CallInUtils } from "./call-in-utils";

export class CallIn implements Command {
  public readonly description: string = "Adds you to the call-in queue.";

  public readonly isAvailableToAllUsers: boolean = true;

  public readonly name: string = "callin";

  public readonly options: CommandOption[] = [];

  public readonly registrationType: CommandRegistrationType =
    CommandRegistrationType.GUILD;

  public readonly shouldReplyPrivately: boolean = true;

  public async execute(message: ChannelCommandMessage): Promise<void> {
    if (!(await CallInUtils.requireNonCallInHost(message))) {
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
        "You are already on the air. Use `/hangup` to leave the call.",
      );
      return;
    }
    if (callInState.hasQueuedUser(message.user.id)) {
      await InteractionController.informSuccess(
        message,
        "You are already calling in.",
      );
      return;
    }

    callInState.addQueuedUser(message.user.id);
    try {
      DataController.saveCallInState(callInState);
      if (
        !(await CallInUtils.postQueueToHosts(message.member.guild, callInState))
      ) {
        Log.throw("Could not update call-in queue for hosts.");
      }
      await InteractionController.announceCallInQueueAdd(
        callInState.channelId,
        {
          userName: message.member.displayName,
        },
      );
    } catch (reason: unknown) {
      Log.error("Could not update call-in queue.", reason);
      await InteractionController.informError(
        message,
        "Could not update the call-in queue. Contact an admin.",
      );
      return;
    }

    await InteractionController.informSuccess(message, "You are calling in.");
    Log.info("User joined call-in queue.", {
      user: Discord.formatUserNameString(message.user),
    });
  }
}
