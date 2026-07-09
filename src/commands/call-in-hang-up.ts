import * as discordJs from "discord.js";
import { DataController, InteractionController } from "../controllers";
import {
  ChannelCommandMessage,
  Command,
  CommandOption,
  CommandOptionType,
  Log,
} from "../core";
import { CallInState } from "../saveables";
import { CallInUtils } from "./call-in-utils";

const userOptionName: string = "user";

export class CallInHangUp implements Command {
  public readonly description: string = "Hangs up a live call-in user.";

  public readonly isGlobal: boolean = false;

  public readonly isGuild: boolean = true;

  public readonly isPrivate: boolean = true;

  public readonly name: string = "callinhangup";

  public readonly options: CommandOption[] = [
    {
      description: "The live user to hang up.",
      isRequired: true,
      name: userOptionName,
      type: CommandOptionType.USER,
    },
  ];

  public async execute(message: ChannelCommandMessage): Promise<void> {
    if (!(await CallInUtils.requireHost(message))) {
      return;
    }
    const callInState: CallInState | null =
      await CallInUtils.requireActiveCallInState(message);
    if (callInState === null) {
      return;
    }
    const user: discordJs.User | undefined = message.getCommandOption(
      userOptionName,
      CommandOptionType.USER,
    );
    if (user === undefined) {
      Log.throw("Cannot hang up call-in. User option is missing.");
    }
    if (!callInState.hasSpeakingUser(user.id)) {
      await InteractionController.informError(
        message,
        "That user is not live on the call.",
      );
      return;
    }
    const member: discordJs.GuildMember | null =
      await CallInUtils.getTargetMember(message, user);
    if (
      member === null ||
      !CallInUtils.isInCallInVoiceChannel(member, callInState)
    ) {
      await InteractionController.informError(
        message,
        "That user is not in the active call-in voice channel.",
      );
      return;
    }

    try {
      callInState.removeSpeakingUser(member.id);
      await CallInUtils.muteForCallIn(member, callInState);
      DataController.saveCallInState(callInState);
    } catch (reason: unknown) {
      Log.error("Could not hang up call-in user.", reason);
      await InteractionController.informError(
        message,
        "Could not hang up that call-in user. Contact an admin.",
      );
      return;
    }
    await InteractionController.informSuccess(
      message,
      `${member.displayName} was hung up.`,
    );
  }
}
