import type { UserStateJson } from "./user-state-json";

export type ChannelStateJson = {
  readonly channelId: string;
  readonly userStates: Record<string, UserStateJson>;
};
