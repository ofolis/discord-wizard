import type * as discordJs from "discord.js";
import { DataController, InteractionController } from "../controllers";
import { ChannelCommandMessage, Command, CommandOption, Log } from "../core";
import { CallInState } from "../saveables";
import { CallInUtils } from "./call-in-utils";

export class CallInStart implements Command {
  public readonly description: string = "Starts call-in mode.";

  public readonly isGlobal: boolean = false;

  public readonly isGuild: boolean = true;

  public readonly isPrivate: boolean = true;

  public readonly name: string = "callinstart";

  public readonly options: CommandOption[] = [];

  public async execute(message: ChannelCommandMessage): Promise<void> {
    if (!(await CallInUtils.requireHost(message))) {
      return;
    }
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
      message.member.voice.channel;
    if (voiceChannel === null) {
      await InteractionController.informError(
        message,
        "You need to be in a voice channel to start call-in mode.",
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
