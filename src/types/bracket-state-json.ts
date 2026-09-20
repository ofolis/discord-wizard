export type BracketMatchParticipantJson =
  | {
      readonly participantIndex: number;
      readonly type: "participant";
    }
  | {
      readonly matchNumber: number;
      readonly type: "winner";
    };

export type BracketMatchJson = {
  readonly number: number;
  readonly participant1: BracketMatchParticipantJson;
  readonly participant2: BracketMatchParticipantJson;
  readonly winnerPosition?: number;
};

export type BracketStateJson = {
  readonly channelId: string;
  readonly guildId: string;
  readonly isOpen: boolean;
  readonly matches: BracketMatchJson[];
  readonly messageId?: string;
  readonly participants: string[];
};
