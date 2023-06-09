import process from "process";

import { Configuration, OpenAIApi } from "openai";

import {
    ServitorEmbeddingDriver,
    ServitorInferenceArguments,
    ServitorInferenceDriver,
    ServitorInferenceResult
} from "./base";
import { defaults } from "./defaults.js";

export class OpenAIDriver implements ServitorInferenceDriver, ServitorEmbeddingDriver {

    private readonly api: OpenAIApi;

    constructor(
        private readonly endpoint: string = "http://127.0.0.1:8000/v1/",
        private readonly inferenceModel: string,
        private readonly embeddingModel: string,
        private readonly secret: string = ""
    ) {
        if (inferenceModel == null || embeddingModel == null) {
            throw new Error("an inference and embedding model are required");
        }

        if (!process.env["GPT_ME_HARDER"] && (
            endpoint.startsWith("https://api.openai.com") ||
            endpoint.startsWith("http://api.openai.com")
        )) {
            throw new Error(`don't pay for a service that could be dirt-cheap if it weren't run by profiteering gluttons.

use another OpenAI-compatible server, such as FastChat.

if you insist on giving OpenAI money, export GPT_ME_HARDER=1 to bypass this error.`);
        }
        const config = new Configuration({
            basePath: endpoint.replace(/\/+$/, ""),
            apiKey: secret
        });
        this.api = new OpenAIApi(config);
    }

    // TODO
    async ping(): Promise<boolean> {
        return true;
    }

    async defaults(): Promise<Partial<ServitorInferenceArguments>> {
        return defaults;
    }

    // TODO: fix this :/
    async tokenize(prompt: string): Promise<number[]> {
        const tokens: number[] = [];
        for (var i = 0; i < defaults.max_new_tokens; i++) { tokens.push(0); }
        return tokens;
    }

    async infer(
        params: Partial<ServitorInferenceArguments>
    ): Promise<ServitorInferenceResult> {
        params = Object.assign({}, defaults, params);

        const result = await this.api.createCompletion({
            model: this.inferenceModel,
            prompt: params.prompt.replace(/[\x02\x03]/g, ""),
            temperature: params.temperature,
            top_p: params.top_p,
            frequency_penalty: params.token_repetition_penalty_max,
            max_tokens: params.max_new_tokens,
            stop: params.stopping_strings
        });
        
        const tokens: number[] = [];
        for (var i = 0; i < result.data.usage.completion_tokens; i++) { tokens.push(0); }

        return { text: result.data.choices[0].text, tokens };
    }

    async embed(prompt: string): Promise<number[]> {
        const result = await this.api.createEmbedding({
            model: this.embeddingModel,
            input: prompt
        });
        return result.data.data[0].embedding;
    }

    async dimensions(): Promise<number> {
        const embedding = await this.embed("test");
        return embedding.length;
    }

}