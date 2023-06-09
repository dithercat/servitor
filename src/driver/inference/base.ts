export interface ServitorEmbedArguments {
    prompt: string
}

export interface ServitorEmbedResult {
    embedding: number[],

    // the model used to compute the embedding
    model: string,
    // number of dimensions in the embedding
    dimensions: number
}

export interface ServitorTokenizeArguments {
    prompt: string
}

export interface ServitorTokenizeResult {
    tokens: number[],

    // the string representations of the tokens
    fragments: string[]
}

export interface ServitorInferenceArguments {
    prompt: string,

    // the usual sampling arguments
    temperature?: number,
    top_k?: number,
    top_p?: number,
    min_p?: number,

    // stopping criteria
    min_length?: number,
    max_new_tokens?: number,
    stopping_strings?: string[],

    // base presence(?) penalty 
    token_repetition_penalty_max?: number,
    // maintain penalty over this many tokens
    token_repetition_penalty_sustain?: number,
    // after sustain period, decay over this many tokens
    token_repetition_penalty_decay?: number,

    // providing an array of token sequences from previous inferences here
    // penalizes repetitive patterns utilizing the same token at the same
    // position as previous inferences
    positional_repeat_inhibit?: number[][],
    // base positional repeat penalty
    positional_repetition_penalty?: number,

    // convert <s> to STX and </s> to ETX?
    // you should avoid this if possible by using STX and ETX directly
    special_convert?: boolean
}

export interface ServitorInferenceResult {
    text: string,
    tokens: number[]
}

export interface ServitorInferenceDriver {
    ping(): Promise<boolean>;
    defaults(): Promise<Partial<ServitorInferenceArguments>>;
    tokenize(prompt: string): Promise<number[]>;
    infer(params: Partial<ServitorInferenceArguments>): Promise<ServitorInferenceResult>;
}

export interface ServitorEmbeddingDriver {
    embed(prompt: string): Promise<number[]>;
    dimensions(): Promise<number>;
}