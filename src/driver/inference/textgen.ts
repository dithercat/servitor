import fetch from "node-fetch";

import {
    ServitorInferenceDriver,
    ServitorInferenceArguments,
    ServitorInferenceResult
} from "./base.js";
import { defaults } from "./defaults.js";

export class TextgenDriver implements ServitorInferenceDriver {

    constructor(
        private readonly endpoint: string = "http://127.0.0.1:5000/api/v1/"
    ) { }

    // TODO
    async ping(): Promise<boolean> {
        return true;
    }

    async defaults(): Promise<Partial<ServitorInferenceArguments>> {
        return defaults;
    }

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
        params = Object.assign({}, defaults, params, {
            prompt: params.prompt
                .replace(/\x03/g, "</s>")
                .replace(/\x02/g, ""),
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
        const text = result.results[0].text;
        return {
            text,
            tokens: await this.tokenize(text),
            stop_reason: -1
        };
    }

}