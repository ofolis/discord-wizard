import * as discordJs from "discord.js";
import { Message } from ".";
import { Log } from "../..";

export class ChannelMessage extends Message {
  private __channelId: string;

  private __id: string;

  public constructor(
    currentEntity: discordJs.Message | discordJs.InteractionResponse,
    channelId: string,
  ) {
    super(currentEntity);
    this.__channelId = channelId;
    this.__id = currentEntity.id;
    Log.debug("Channel message context added.");
  }

  public get channelId(): string {
    return this.__channelId;
  }

  public get id(): string {
    return this.__id;
  }
}
