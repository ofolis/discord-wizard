import { ChannelCommandMessage } from ".";
import { CommandRegistrationType } from "../enums";
import type { CommandOption } from "../types";

export abstract class Command {
  abstract description: string;

  abstract isAvailableToAllUsers: boolean;

  abstract name: string;

  abstract options: CommandOption[];

  abstract registrationType: CommandRegistrationType;

  abstract shouldReplyPrivately: boolean;

  abstract execute(message: ChannelCommandMessage): Promise<void>;
}
