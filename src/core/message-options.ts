import type * as discordJs from "discord.js";
import { AppErrorCode } from "./enums";
import { Log } from "./log";

export const DISCORD_MESSAGE_CONTENT_MAX_LENGTH: number = 2000;

type MessageOptionsWithSafetyFields = {
  readonly allowedMentions?: discordJs.MessageMentionOptions;
  readonly content?: string | null;
};

export function sanitizeBaseMessageOptions<
  T extends MessageOptionsWithSafetyFields,
>(options: T): T {
  if (
    typeof options.content === "string" &&
    options.content.length > DISCORD_MESSAGE_CONTENT_MAX_LENGTH
  ) {
    Log.throwError(
      AppErrorCode.DISCORD_MESSAGE_CONTENT_TOO_LONG,
      "Cannot send or update Discord message. Content is too long.",
      {
        maxLength: DISCORD_MESSAGE_CONTENT_MAX_LENGTH,
        options,
      },
    );
  }
  return {
    ...options,
    allowedMentions: {
      ...(options.allowedMentions ?? {}),
      parse: [],
    },
  };
}
