import { ServitorInferenceArguments } from "./base";

export const defaults: Partial<ServitorInferenceArguments> = {
    temperature: 0.5,
    top_k: 32,
    top_p: 0.2,
    min_p: 0,
    token_repetition_penalty_max: 1.1,
    token_repetition_penalty_sustain: 2048,
    token_repetition_penalty_decay: 0,
    min_length: 4,
    max_new_tokens: 256,
    stopping_strings: ["\n"],
    positional_repetition_penalty: 0,
    positional_repeat_inhibit: [],
    special_convert: false
};