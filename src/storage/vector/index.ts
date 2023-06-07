export interface ServitorVectorStore {
    store(text: string, embedding?: number[]): Promise<void>;
    retrieve(text: string, limit?: number): Promise<[string, Date][]>;
}

export * from "./postgres";