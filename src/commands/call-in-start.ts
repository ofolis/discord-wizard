import type * as discordJs from "discord.js";
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

export class CallInStart implements Command {
  public readonly description: string = "Starts call-in mode.";

  public readonly isAvailableToAllUsers: boolean = false;

  public readonly name: string = "callinstart";

  public readonly options: CommandOption[] = [];

  public readonly registrationType: CommandRegistrationType =
    CommandRegistrationType.GUILD;

  public readonly shouldReplyPrivately: boolean = true;

  public async authorizeUse(message: ChannelCommandMessage): Promise<boolean> {
    return await CallInUtils.requireCallInManager(message);
  }

  public async execute(message: ChannelCommandMessage): Promise<void> {
    if (
      DataController.loadActiveCallInState(message.member.guild.id) !== null
    ) {
      await InteractionController.informError(
        message,
        "Call-in mode is already active.",
      );
      return;
    }
    const voiceChannel: discordJs.VoiceBasedChannel | null =
      await CallInUtils.resolveStartVoiceChannel(message);
    if (voiceChannel === null) {
      await InteractionController.informError(
        message,
        "Run this command from a voice channel chat, or join a voice channel first.",
      );
      return;
    }

    const callInState: CallInState = new CallInState({
      channelId: message.channelId,
      guildId: message.member.guild.id,
      voiceChannelId: voiceChannel.id,
    });
    try {
      await CallInUtils.muteNonHostVoiceMembers(voiceChannel, callInState);
      DataController.saveCallInState(callInState);
      if (
        !(await CallInUtils.postQueueToHosts(message.member.guild, callInState))
      ) {
        Log.throw("Could not post call-in queue to hosts.");
      }
      await InteractionController.announceCallInStart(callInState.channelId);
    } catch (reason: unknown) {
      Log.error("Could not start call-in mode.", reason);
      callInState.close();
      try {
        await CallInUtils.unmuteTrackedMembers(
          message.member.guild,
          callInState,
        );
        DataController.saveCallInState(callInState);
      } catch (rollbackReason: unknown) {
        Log.error("Could not roll back failed call-in start.", rollbackReason);
      }
      await InteractionController.informError(
        message,
        "Could not start call-in mode. Contact an admin.",
      );
      return;
    }
    await InteractionController.informSuccess(message, "Call-in mode started.");
  }
}
