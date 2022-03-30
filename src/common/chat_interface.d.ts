export type EnvelopeIn = {
    msg: {
        Data: string;
    };
    channel: string;
};

export type EnvelopeOut = {
    msg: {
        Data: string;
    };
    channel: string;
    key: number[];
    signatures: {};
};
