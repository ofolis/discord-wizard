import { DataController, InteractionController } from "../controllers";
import {
  AppError,
  AppErrorCode,
  ChannelCommandMessage,
  ChannelMessage,
  Command,
  CommandOption,
  CommandOptionType,
  CommandRegistrationType,
  Environment,
  Log,
  Utils,
} from "../core";
import { BracketState } from "../saveables";

const participantsOptionName: string = "participants";

export class BracketStart implements Command {
  public readonly description: string = "Starts a single-elimination bracket.";

  public readonly isAvailableToAllUsers: boolean = false;

  public readonly name: string = "bracketstart";

  public readonly options: CommandOption[] = [
    {
      description: "Comma-separated bracket participants.",
      isRequired: true,
      name: participantsOptionName,
      type: CommandOptionType.STRING,
    },
  ];

  public readonly registrationType: CommandRegistrationType =
    CommandRegistrationType.GUILD;

  public readonly shouldReplyPrivately: boolean = true;

  public async execute(message: ChannelCommandMessage): Promise<void> {
    if (
      DataController.loadActiveBracketState(message.member.guild.id) !== null
    ) {
      await InteractionController.informError(
        message,
        "A bracket is already active.",
      );
      return;
    }

    const parsedParticipants: string[] = Utils.parseCommaSeparatedList(
      message.getCommandOption(
        participantsOptionName,
        CommandOptionType.STRING,
      ),
    );
    if (parsedParticipants.length < BracketState.minParticipantCount) {
      await InteractionController.informError(
        message,
        "A bracket needs at least two participants.",
      );
      return;
    }
    if (parsedParticipants.length > BracketState.maxParticipantCount) {
      await InteractionController.informError(
        message,
        `A bracket can have at most ${String(BracketState.maxParticipantCount)} participants.`,
      );
      return;
    }

    const bracketState: BracketState = new BracketState({
      channelId: message.channelId,
      guildId: message.member.guild.id,
      participants: this.__shuffleParticipants(parsedParticipants),
    });
    try {
      DataController.saveBracketState(bracketState);
    } catch (reason: unknown) {
      Log.error("Could not save new bracket state.", reason);
      await InteractionController.informError(
        message,
        "Could not start the bracket. Contact an admin.",
      );
      return;
    }

    let bracketMessage: ChannelMessage;
    try {
      bracketMessage = await InteractionController.announceBracketStart(
        message.channelId,
        bracketState,
      );
    } catch (reason: unknown) {
      Log.error("Could not post bracket.", reason);
      const isTooLong: boolean = AppError.is(
        reason,
        AppErrorCode.DISCORD_EMBED_DESCRIPTION_TOO_LONG,
      );
      try {
        DataController.deleteBracketState(bracketState.guildId);
      } catch (rollbackReason: unknown) {
        Log.error("Could not delete failed bracket.", rollbackReason);
      }
      await InteractionController.informError(
        message,
        isTooLong
          ? "Bracket participants are too long to display. Please shorten them and try again."
          : "Could not post the bracket. Contact an admin.",
      );
      return;
    }

    bracketState.messageId = bracketMessage.id;
    try {
      DataController.saveBracketState(bracketState);
    } catch (reason: unknown) {
      Log.error("Could not save bracket message ID.", reason);
      await InteractionController.informSuccess(
        message,
        "Bracket started, but match updates will not be available. Contact an admin.",
      );
      return;
    }
    await InteractionController.informSuccess(message, "Bracket started.");
  }

  private __shuffleParticipants(participants: string[]): string[] {
    const shuffledParticipants: string[] = [...participants];
    for (
      let index: number = shuffledParticipants.length - 1;
      index > 0;
      index--
    ) {
      const swapIndex: number = Environment.random.integer(0, index);
      const participant: string = shuffledParticipants[index];
      shuffledParticipants[index] = shuffledParticipants[swapIndex];
      shuffledParticipants[swapIndex] = participant;
    }
    return shuffledParticipants;
  }
}
