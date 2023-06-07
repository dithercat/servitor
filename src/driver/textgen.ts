import fetch from "node-fetch";

import {
    ServitorInferenceDriver,
    ServitorInferenceArguments,
    ServitorInferenceResult
} from "./base.js";

const defaults: Partial<ServitorInferenceArguments> = {
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

export class TextgenDriver implements ServitorInferenceDriver {

    constructor(
        private readonly endpoint: string = "http://127.0.0.1:5000/api/v1/"
    ) { }

    async ping(): Promise<boolean> {
        // TODO: some ugly hack
        return true;
    }

    async defaults(): Promise<Partial<ServitorInferenceArguments>> {
        return defaults;
    }

    // !!! FAKE !!!
    // this can only be used to count length!
    async tokenize(prompt: string): Promise<number[]> {
        const res = await fetch(this.endpoint + "token-count", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ prompt })
        });
        if (!res.ok) {
            throw new Error("tokenize failure");
        }
        const result = await res.json() as any;
        const tokens: number[] = [];
        // nasty!!!
        for (var i = 0; i < result.tokens; i++) { tokens.push(0); }
        return tokens;
    }

    async infer(
        params: Partial<ServitorInferenceArguments>
    ): Promise<ServitorInferenceResult> {
        console.debug("infer", params);
        params = Object.assign({}, defaults, params, {
            repetition_penalty: params.token_repetition_penalty_max,

            length_penalty: 0,
            typical_p: 1,
            do_sample: true,
            early_stopping: true,
            skip_special_tokens: true
        });
        const res = await fetch(this.endpoint + "generate", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(params)
        });
        if (!res.ok) {
            throw new Error("inference failure");
        }
        const result = await res.json() as any;
        console.debug("result", result);
        const text = result.results[0].text;
        return { text, tokens: await this.tokenize(text) };
    }

}