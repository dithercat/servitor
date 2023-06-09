import { ServitorChatLine } from "../../../message";

export interface ServitorVectorStoreRecall {
    lines: ServitorChatLine[],
    tokens: number,
    date: Date
}

export interface ServitorVectorStoreDriver {
    store(
        lines: ServitorChatLine[],
        embedding: number[]
    ): Promise<void>;
    retrieve(
        embedding: number[],
        limit?: number,
        maxtoks?: number,
        before?: Date
    ): Promise<ServitorVectorStoreRecall[]>;
}