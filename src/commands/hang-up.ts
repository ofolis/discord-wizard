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

export class HangUp implements Command {
  public readonly description: string =
    "Leaves the call-in queue or live call.";

  public readonly isAvailableToAllUsers: boolean = true;

  public readonly name: string = "hangup";

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

    if (callInState.hasQueuedUser(message.user.id)) {
      await this.__removeFromQueue(message, callInState);
      return;
    }
    if (callInState.hasSpeakingUser(message.user.id)) {
      await this.__leaveLiveCall(message, callInState);
      return;
    }

    await InteractionController.informError(
      message,
      "You are not calling in or on the air.",
    );
  }

  private async __leaveLiveCall(
    message: ChannelCommandMessage,
    callInState: CallInState,
  ): Promise<void> {
    try {
      callInState.removeSpeakingUser(message.user.id);
      if (CallInUtils.isInCallInVoiceChannel(message.member, callInState)) {
        await CallInUtils.muteForCallIn(message.member, callInState);
      }
      DataController.saveCallInState(callInState);
      await InteractionController.announceCallInOffAir(callInState.channelId, {
        userName: Discord.formatGuildMemberNameString(message.member),
      });
    } catch (reason: unknown) {
      Log.error("Could not hang up call-in user.", reason);
      await InteractionController.informError(
        message,
        "Could not hang up. Contact an admin.",
      );
      return;
    }
    await InteractionController.informSuccess(
      message,
      "You are no longer on the air.",
    );
  }

  private async __removeFromQueue(
    message: ChannelCommandMessage,
    callInState: CallInState,
  ): Promise<void> {
    try {
      callInState.removeQueuedUser(message.user.id);
      DataController.saveCallInState(callInState);
      if (
        !(await CallInUtils.postQueueToHosts(message.member.guild, callInState))
      ) {
        Log.throw("Could not update call-in queue for hosts.");
      }
      await InteractionController.announceCallInQueueRemove(
        callInState.channelId,
        {
          userName: Discord.formatGuildMemberNameString(message.member),
        },
      );
    } catch (reason: unknown) {
      Log.error("Could not remove user from call-in queue.", reason);
      await InteractionController.informError(
        message,
        "Could not hang up from the call-in queue. Contact an admin.",
      );
      return;
    }
    await InteractionController.informSuccess(
      message,
      "You hung up from the call-in queue.",
    );
  }
}
