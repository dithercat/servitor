export interface ServitorActorInfo {
    // username shown to the LLM
    friendlyname: string,

    // flags this actor as the simulacrum itself
    self: boolean
}

export interface ServitorChannelInfo {
    // opaque identifier used for indexing channel state
    // example: discord channel id
    id: string,

    // "friendly" channel name, as may be exposed to the LLM
    friendlyname: string;

    // is this a one-on-one channel or a multiuser one?
    isprivate: boolean;
}

export interface ServitorMessageInfo {
    // opaque message identifier for deduplication
    id: string;

    // message contents
    content: string;

    // message tokens
    tokens: number[];

    // raw content tokens
    tokens_raw: number[];

    // ISO timestamp
    timestamp?: string;
}

export interface ServitorChatLine {
    actor: ServitorActorInfo;
    channel: ServitorChannelInfo;
    message: ServitorMessageInfo;
}