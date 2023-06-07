import { BasiliskInferenceArguments, BasiliskInferenceResult } from "./basilisk/api";

export interface ServitorInferenceDriver {
    ping(): Promise<boolean>;
    defaults(): Promise<Partial<BasiliskInferenceArguments>>;
    tokenize(prompt: string): Promise<number[]>;
    infer(params: Partial<BasiliskInferenceArguments>): Promise<BasiliskInferenceResult>;
}

export interface ServitorEmbeddingDriver {
    embed(prompt: string): Promise<number[]>;
}