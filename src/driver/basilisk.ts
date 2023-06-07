import fetch from "node-fetch";

import {
    ServitorEmbeddingDriver, ServitorInferenceDriver,
    ServitorEmbedResult,
    ServitorInferenceArguments,
    ServitorInferenceResult,
    ServitorTokenizeResult
} from "./base.js";

export class BasiliskDriver implements ServitorInferenceDriver, ServitorEmbeddingDriver {

    constructor(
        private readonly endpoint: string = "http://127.0.0.1:5000/basilisk/",
        private readonly secret?: string
    ) { }

    async ping(): Promise<boolean> {
        try {
            const res = await fetch(this.endpoint + "ping", {
                headers: {
                    "Content-Type": "application/json",
                    Authorization: this.secret
                }
            });
            return res.ok && ("pong" === await res.text());
        }
        catch (ex) { return false; }
    }

    async defaults(): Promise<Partial<ServitorInferenceArguments>> {
        const res = await fetch(this.endpoint + "config", {
            headers: {
                "Content-Type": "application/json",
                Authorization: this.secret
            }
        });
        return res.json();
    }

    async tokenize(prompt: string): Promise<number[]> {
        const res = await fetch(this.endpoint + "tokenize", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: this.secret
            },
            body: JSON.stringify({ prompt })
        });
        if (!res.ok) {
            throw new Error("tokenize failure");
        }
        const result = await (res.json() as Promise<ServitorTokenizeResult>);
        return result.tokens;
    }

    async infer(
        params: Partial<ServitorInferenceArguments>
    ): Promise<ServitorInferenceResult> {
        console.debug("infer", params);
        const res = await fetch(this.endpoint + "infer", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: this.secret
            },
            body: JSON.stringify(params)
        });
        if (!res.ok) {
            throw new Error("inference failure");
        }
        const result = await res.json() as Promise<ServitorInferenceResult>;
        console.debug("result", result);
        return result;
    }

    async embed(
        prompt: string
    ): Promise<number[]> {
        const res = await fetch(this.endpoint + "embed", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: this.secret
            },
            body: JSON.stringify({ prompt })
        });
        if (!res.ok) {
            throw new Error("embed failure");
        }
        const result = await (res.json() as Promise<ServitorEmbedResult>);
        return result.embedding;
    }

}