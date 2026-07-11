import type * as discordJs from "discord.js";
import { AppEnvironment } from "../app-environment";
import { Discord, Log } from "../core";
import { AiClient } from "./ai-client";

type ActiveResponseState = {
  hasOverlappingInvocation: boolean;
  readonly messageId: string;
};

type AiPromptContext = {
  readonly mentionTargets: readonly MentionTarget[];
  readonly prompt: string;
};

type AiResponseTrigger = "mention" | "organic";

type MentionReplacement = {
  readonly content: string;
  readonly userIds: readonly string[];
};

type MentionTarget = {
  readonly name: string;
  readonly userId: string;
};

export class AiMessageController {
  private static readonly __activeResponseStateByChannelId: Map<
    string,
    ActiveResponseState
  > = new Map();

  private static readonly __lastOrganicResponseAtMsByGuildId: Map<
    string,
    number
  > = new Map();

  private static readonly __maxBufferMilliseconds: number = 8000;

  private static readonly __maxContextCharacters: number = 6000;

  private static readonly __messageContextLimit: number = 20;

  private static readonly __millisecondsPerMinute: number = 60 * 1000;

  private static readonly __minBufferMilliseconds: number = 2000;

  private static readonly __typingLeadOutMilliseconds: number = 1500;

  public static async handleMessage(message: discordJs.Message): Promise<void> {
    if (
      !AppEnvironment.config.chatbotEnabled ||
      message.author.bot ||
      message.guildId === null
    ) {
      return;
    }
    const botUser: discordJs.ClientUser | null = Discord.client.user;
    if (botUser === null) {
      return;
    }
    const trigger: AiResponseTrigger | null = this.__getResponseTrigger(
      message,
      botUser,
    );
    if (trigger === null) {
      return;
    }
    const activeResponseState: ActiveResponseState | undefined =
      this.__activeResponseStateByChannelId.get(message.channelId);
    if (activeResponseState !== undefined) {
      if (trigger === "mention") {
        activeResponseState.hasOverlappingInvocation = true;
      }
      Log.info("Ignored overlapping AI message invocation.", {
        activeMessageId: activeResponseState.messageId,
        channelId: message.channelId,
        messageId: message.id,
        trigger,
        userId: message.author.id,
      });
      return;
    }
    const responseState: ActiveResponseState = {
      hasOverlappingInvocation: false,
      messageId: message.id,
    };
    this.__activeResponseStateByChannelId.set(message.channelId, responseState);
    const stopTyping: () => void = this.__startTyping(message);
    try {
      const promptContext: AiPromptContext = await this.__buildPromptContext(
        message,
        botUser.id,
        trigger,
      );
      Log.info("Generating AI message response.", {
        channelId: message.channelId,
        guildId: message.guildId,
        messageId: message.id,
        mentionTargetCount: promptContext.mentionTargets.length,
        promptLength: promptContext.prompt.length,
        trigger,
        userId: message.author.id,
      });
      const response: string = await AiClient.generateResponse(
        promptContext.prompt,
      );
      const mentionReplacement: MentionReplacement = this.__replaceUserNames(
        this.__formatResponse(response),
        promptContext.mentionTargets,
      );
      const bufferMilliseconds: number = this.__calculateBufferMilliseconds(
        mentionReplacement.content,
      );
      Log.info("Buffering AI message response.", {
        bufferMilliseconds,
        hasOverlappingInvocation: responseState.hasOverlappingInvocation,
        mentionUserIds: mentionReplacement.userIds,
        messageId: message.id,
        responseLength: mentionReplacement.content.length,
      });
      await this.__sleepWithTypingLeadOut(bufferMilliseconds, stopTyping);
      await this.__sendResponse(
        message,
        mentionReplacement.content,
        responseState.hasOverlappingInvocation,
        mentionReplacement.userIds,
      );
      this.__recordOrganicResponse(message, trigger);
    } catch (reason: unknown) {
      Log.error("Could not generate AI message response.", reason);
      // Intentionally vague and in-character: errors are logged, but Discord only gets the bot's "tell".
      await this.__sendResponse(
        message,
        "...",
        responseState.hasOverlappingInvocation,
        [],
      );
      this.__recordOrganicResponse(message, trigger);
    } finally {
      stopTyping();
      if (
        this.__activeResponseStateByChannelId.get(message.channelId) ===
        responseState
      ) {
        this.__activeResponseStateByChannelId.delete(message.channelId);
      }
    }
  }

  private static async __buildContextMessages(
    message: discordJs.Message,
  ): Promise<discordJs.Message[]> {
    const messages: discordJs.Collection<string, discordJs.Message> =
      await message.channel.messages.fetch({
        before: message.id,
        limit: this.__messageContextLimit,
      });
    return [...messages.values()].sort(
      (leftMessage, rightMessage) =>
        leftMessage.createdTimestamp - rightMessage.createdTimestamp,
    );
  }

  private static __buildContextTranscript(
    messages: readonly discordJs.Message[],
    botUserId: string,
  ): string {
    const transcriptLines: string[] = messages
      .map(contextMessage =>
        this.__formatTranscriptLine(contextMessage, botUserId),
      )
      .filter(line => line.length > 0);
    return this.__truncateContext(transcriptLines.join("\n"));
  }

  private static __buildMentionTargets(
    messages: readonly discordJs.Message[],
    latestMessage: discordJs.Message,
    botUserId: string,
  ): MentionTarget[] {
    const namesByUserId: Map<string, Set<string>> = new Map();
    [...messages, latestMessage].forEach(message => {
      if (message.author.id === botUserId) {
        return;
      }
      const names: Set<string> =
        namesByUserId.get(message.author.id) ?? new Set<string>();
      this.__getAuthorMentionNames(message).forEach(name => {
        names.add(name);
      });
      namesByUserId.set(message.author.id, names);
    });
    const userIdsByNormalizedName: Map<string, Set<string>> = new Map();
    namesByUserId.forEach((names, userId) => {
      names.forEach(name => {
        const normalizedName: string = this.__normalizeMentionName(name);
        const userIds: Set<string> =
          userIdsByNormalizedName.get(normalizedName) ?? new Set<string>();
        userIds.add(userId);
        userIdsByNormalizedName.set(normalizedName, userIds);
      });
    });
    const mentionTargets: MentionTarget[] = [];
    namesByUserId.forEach((names, userId) => {
      names.forEach(name => {
        const normalizedName: string = this.__normalizeMentionName(name);
        if (userIdsByNormalizedName.get(normalizedName)?.size !== 1) {
          return;
        }
        mentionTargets.push({
          name,
          userId,
        });
      });
    });
    return mentionTargets.sort(
      (leftTarget, rightTarget) =>
        rightTarget.name.length - leftTarget.name.length,
    );
  }

  private static async __buildPromptContext(
    message: discordJs.Message,
    botUserId: string,
    trigger: AiResponseTrigger,
  ): Promise<AiPromptContext> {
    const contextMessages: discordJs.Message[] =
      await this.__buildContextMessages(message);
    const contextTranscript: string = this.__buildContextTranscript(
      contextMessages,
      botUserId,
    );
    const mentionTargets: MentionTarget[] = this.__buildMentionTargets(
      contextMessages,
      message,
      botUserId,
    );
    const request: string = this.__stripBotMention(message.content, botUserId);
    const normalizedRequest: string =
      request.length > 0
        ? request
        : trigger === "mention"
          ? "The user mentioned you without adding a prompt. Reply briefly and ask what they need."
          : "";
    const latestMessageLabel: string =
      trigger === "mention"
        ? "Latest request to answer:"
        : "Latest message to react to organically:";
    if (contextTranscript.length === 0) {
      return {
        mentionTargets,
        prompt: [
          this.__formatInvocationFlag(trigger),
          `${latestMessageLabel}\n${this.__formatTranscriptLineWithContent(message, normalizedRequest)}`,
        ].join("\n"),
      };
    }
    return {
      mentionTargets,
      prompt: [
        this.__formatInvocationFlag(trigger),
        "",
        "Recent Discord conversation, oldest to newest:",
        contextTranscript,
        "",
        latestMessageLabel,
        this.__formatTranscriptLineWithContent(message, normalizedRequest),
      ].join("\n"),
    };
  }

  private static __calculateBufferMilliseconds(response: string): number {
    const responseScale: number = Math.min(response.length / 1200, 1);
    return Math.round(
      this.__minBufferMilliseconds +
        (this.__maxBufferMilliseconds - this.__minBufferMilliseconds) *
          responseScale,
    );
  }

  private static __escapeRegex(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
  }

  private static __formatAttachmentText(message: discordJs.Message): string {
    if (message.attachments.size === 0) {
      return "";
    }
    const attachmentDescriptions: string[] = message.attachments.map(
      attachment => {
        const contentType: string = attachment.contentType ?? "unknown type";
        return `${attachment.name} (${contentType}, ${attachment.size.toString()} bytes)`;
      },
    );
    return ` [attachment(s): ${attachmentDescriptions.join("; ")}]`;
  }

  private static __formatAuthorName(message: discordJs.Message): string {
    return (
      message.member?.displayName ??
      message.author.globalName ??
      message.author.username
    );
  }

  private static __formatInvocationFlag(trigger: AiResponseTrigger): string {
    if (trigger === "organic") {
      return "[Invocation: unsolicited]";
    }
    return "[Invocation: mention]";
  }

  private static __formatMentionRegex(name: string): RegExp {
    return new RegExp(
      `(?<![\\p{L}\\p{N}_@])@${this.__escapeRegex(name)}(?![\\p{L}\\p{N}_])`,
      "giu",
    );
  }

  private static __formatResponse(response: string): string {
    return this.__trimDanglingMarkdown(this.__truncateResponse(response));
  }

  private static __formatTranscriptLine(
    message: discordJs.Message,
    botUserId: string,
  ): string {
    const content: string = this.__stripBotMention(message.content, botUserId);
    return this.__formatTranscriptLineWithContent(message, content);
  }

  private static __formatTranscriptLineWithContent(
    message: discordJs.Message,
    content: string,
  ): string {
    const attachmentText: string = this.__formatAttachmentText(message);
    const lineContent: string = `${content}${attachmentText}`.trim();
    if (lineContent.length === 0) {
      return "";
    }
    return `${this.__formatAuthorName(message)}: ${lineContent}`;
  }

  private static __getAuthorMentionNames(message: discordJs.Message): string[] {
    return [
      message.member?.displayName,
      message.author.globalName,
      message.author.username,
    ].flatMap(name => {
      if (typeof name !== "string" || name.trim().length < 3) {
        return [];
      }
      return [name.trim()];
    });
  }

  private static __getChannelName(
    channel: discordJs.TextBasedChannel,
  ): string | null {
    if (!("name" in channel) || typeof channel.name !== "string") {
      return null;
    }
    return channel.name;
  }

  private static __getResponseTrigger(
    message: discordJs.Message,
    botUser: discordJs.ClientUser,
  ): AiResponseTrigger | null {
    if (message.mentions.has(botUser)) {
      return "mention";
    }
    if (this.__shouldGenerateOrganicResponse(message)) {
      return "organic";
    }
    return null;
  }

  private static __normalizeMentionName(name: string): string {
    return name.trim().toLocaleLowerCase();
  }

  private static __recordOrganicResponse(
    message: discordJs.Message,
    trigger: AiResponseTrigger,
  ): void {
    if (trigger !== "organic" || message.guildId === null) {
      return;
    }
    this.__lastOrganicResponseAtMsByGuildId.set(message.guildId, Date.now());
  }

  private static __replaceUserNames(
    content: string,
    mentionTargets: readonly MentionTarget[],
  ): MentionReplacement {
    let replacedContent: string = content;
    const userIds: Set<string> = new Set();
    mentionTargets.forEach(target => {
      const regex: RegExp = this.__formatMentionRegex(target.name);
      replacedContent = replacedContent.replace(regex, () => {
        userIds.add(target.userId);
        return Discord.formatUserMentionString({
          id: target.userId,
        });
      });
    });
    return {
      content: replacedContent,
      userIds: [...userIds],
    };
  }

  private static async __sendResponse(
    message: discordJs.Message,
    content: string,
    shouldReferenceMessage: boolean,
    mentionUserIds: readonly string[],
  ): Promise<void> {
    const options: discordJs.MessageCreateOptions = {
      allowedMentions: {
        parse: [],
        repliedUser: false,
        users: [...mentionUserIds],
      },
      content,
    };
    if (shouldReferenceMessage) {
      await message.reply(options);
      return;
    }
    await Discord.sendChannelMessage(message.channelId, options);
  }

  private static async __sendTyping(message: discordJs.Message): Promise<void> {
    const channel: discordJs.TextBasedChannel = message.channel;
    if ("sendTyping" in channel && typeof channel.sendTyping === "function") {
      await channel.sendTyping();
    }
  }

  private static __shouldGenerateOrganicResponse(
    message: discordJs.Message,
  ): boolean {
    if (message.guildId === null) {
      return false;
    }
    if (message.content.trim().length === 0 && message.attachments.size === 0) {
      return false;
    }
    const organicChannelNames: readonly string[] =
      AppEnvironment.config.chatbotOrganicChannelNames;
    if (organicChannelNames.length > 0) {
      const channelName: string | null = this.__getChannelName(message.channel);
      if (channelName === null) {
        return false;
      }
      if (
        !organicChannelNames
          .map(name => name.toLocaleLowerCase())
          .includes(channelName.toLocaleLowerCase())
      ) {
        return false;
      }
    }
    const cooldownMilliseconds: number =
      AppEnvironment.config.chatbotOrganicCooldownMinutes *
      this.__millisecondsPerMinute;
    if (cooldownMilliseconds > 0) {
      const lastOrganicResponseAtMs: number | undefined =
        this.__lastOrganicResponseAtMsByGuildId.get(message.guildId);
      if (
        lastOrganicResponseAtMs !== undefined &&
        Date.now() - lastOrganicResponseAtMs < cooldownMilliseconds
      ) {
        return false;
      }
    }
    const replyChance: number = AppEnvironment.config.chatbotOrganicReplyChance;
    if (replyChance <= 0) {
      return false;
    }
    if (replyChance >= 1) {
      return true;
    }
    return Math.random() < replyChance;
  }

  private static __sleep(milliseconds: number): Promise<void> {
    return new Promise(resolve => {
      setTimeout(resolve, milliseconds);
    });
  }

  private static async __sleepWithTypingLeadOut(
    bufferMilliseconds: number,
    stopTyping: () => void,
  ): Promise<void> {
    const quietMilliseconds: number = Math.min(
      this.__typingLeadOutMilliseconds,
      bufferMilliseconds,
    );
    await this.__sleep(bufferMilliseconds - quietMilliseconds);
    stopTyping();
    await this.__sleep(quietMilliseconds);
  }

  private static __startTyping(message: discordJs.Message): () => void {
    let shouldContinue: boolean = true;
    const sendTyping: () => void = () => {
      this.__sendTyping(message).catch((reason: unknown) => {
        shouldContinue = false;
        Log.error("Could not send AI typing indicator.", reason);
      });
    };
    sendTyping();
    const interval: NodeJS.Timeout = setInterval(() => {
      if (shouldContinue) {
        sendTyping();
      }
    }, 4000);
    return () => {
      if (!shouldContinue) {
        return;
      }
      shouldContinue = false;
      clearInterval(interval);
    };
  }

  private static __stripBotMention(content: string, botUserId: string): string {
    const mentionPattern: RegExp = new RegExp(`<@!?${botUserId}>`, "gu");
    return content.replace(mentionPattern, "[bot mention]").trim();
  }

  private static __trimDanglingMarkdown(response: string): string {
    let formattedResponse: string = response.trim();
    if ((formattedResponse.match(/\*\*/gu)?.length ?? 0) % 2 !== 0) {
      formattedResponse = formattedResponse.replace(/\s*\*\*$/u, "");
    }
    return formattedResponse;
  }

  private static __truncateContext(context: string): string {
    if (context.length <= this.__maxContextCharacters) {
      return context;
    }
    return context.slice(context.length - this.__maxContextCharacters).trim();
  }

  private static __truncateResponse(response: string): string {
    if (response.length <= Discord.messageContentMaxLength) {
      return response;
    }
    return `${response.slice(0, Discord.messageContentMaxLength - 3)}...`;
  }
}
