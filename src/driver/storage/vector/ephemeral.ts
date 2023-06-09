import { similarity } from "ml-distance";

import { ServitorChatLine } from "../../../message";
import { ServitorVectorStoreDriver, ServitorVectorStoreRecall } from "./base";

export interface ServitorEphemeralVectorStoreRecall extends ServitorVectorStoreRecall {
    embedding: number[],
    similarity?: number
}

export class ServitorEphemeralVectorStoreDriver implements ServitorVectorStoreDriver {

    private readonly vectors: ServitorEphemeralVectorStoreRecall[] = [];

    async store(lines: ServitorChatLine[], embedding: number[]): Promise<void> {
        var tokens = 0;
        for (const line of lines) { tokens += line.message.tokens.length; }
        this.vectors.push({ lines, tokens, date: new Date(), embedding });
    }

    async retrieve(
        embedding: number[],
        limit?: number,
        maxtoks?: number,
        before?: Date
    ): Promise<ServitorVectorStoreRecall[]> {
        // this logic somewhat lifted from langchain's memory vector store
        return this.vectors
            .filter(x => x.tokens <= maxtoks && x.date < before)
            .map(x => ({
                lines: x.lines,
                tokens: x.tokens,
                date: x.date,
                embedding: x.embedding,
                similarity: similarity.cosine(embedding, x.embedding)
            }))
            .sort((a, b) => a.similarity > b.similarity ? -1 : 0)
            .slice(0, limit || 1);
    }
    
}