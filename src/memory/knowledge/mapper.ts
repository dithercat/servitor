import { similarity } from "ml-distance";

import { ServitorEmbeddingDriver } from "../../driver";
import { ServitorChatLine } from "../../message";

import { ServitorMemory } from "../base";

export interface ServitorMapperMemoryEntry {
    content: string,
    embedding: number[],
    similarity?: number
}

export class ServitorMapperMemory implements ServitorMemory {

    private readonly vectors: ServitorMapperMemoryEntry[];

    constructor(
        private readonly driver: ServitorEmbeddingDriver,
        private readonly limit = 3
    ) { }

    async add(sections: string | string[]): Promise<void> {
        if (!Array.isArray(sections)) { sections = [sections]; }
        for (const content of sections) {
            const embedding = await this.driver.embed(content);
            this.vectors.push({ content, embedding });
        }
    }

    async save(): Promise<void> {
        // no-op
    }

    async recall(line: ServitorChatLine): Promise<string> {
        const embedding = await this.driver.embed(line.message.content);
        return this.vectors
            .map(x => ({
                content: x.content,
                embedding: x.embedding,
                similarity: similarity.cosine(embedding, x.embedding)
            }))
            .sort((a, b) => a.similarity > b.similarity ? -1 : 0)
            .slice(0, this.limit)
            .map(x => x.content)
            .join("\n\n");
    }

}