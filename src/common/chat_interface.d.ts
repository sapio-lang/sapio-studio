export type EnvelopeIn = {
    msg: {
        Data: string;
    };
    channel: string;
    sent_time_ms: number;
};

export type EnvelopeOut = {
    msg: {
        Data: string;
    };
    channel: string;
    key: number[];
    sent_time_ms: number;
    signatures: {};
};
