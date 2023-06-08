import format from "string-format";

import {
    ServitorChatLine,
    ServitorContextFormatter,
    ServitorContextMemory
} from "./context/index.js";
import {
    ServitorInferenceArguments,
    ServitorEmbeddingDriver,
    ServitorInferenceDriver
} from "./driver/index.js";
import { ServitorVectorStore } from "./storage/vector/index.js";

const HEADER_MULTIUSER = "the following is a real conversation between {char} and users in {channel} on {date}.";
const HEADER_DIRECT = "the following is a real conversation between {char} and {user} on {date}.";
const HEADER_TIMESTAMPS = "all timestamps are in {timezone}.";
const HEADER_SUFFIX = " the conversation transcript continues for the remainder of this document without any other text.";

const RECALL_TEMPLATE = "\n\nrecalled excerpt from previous conversation ({date}):\n{fragment}";

const CONTEXT_TEMPLATE = "{prompt}{injected}\n\n{header}\n\n";

export interface ServitorBridgeParameters {
    char?: string,
    timezone?: string,
    prompt?: string,
    args?: Partial<ServitorInferenceArguments>,
    driver: {
        inference: ServitorInferenceDriver,
        embedding?: ServitorEmbeddingDriver
    },
    memory: {
        context: ServitorContextMemory,
        vector?: ServitorVectorStore
    },
    formatter: ServitorContextFormatter
}

export class ServitorBridge {

    readonly char: string;
    readonly timezone: string;
    readonly prompt: string;
    readonly args: Partial<ServitorInferenceArguments>;

    readonly inference: ServitorInferenceDriver;
    readonly embedding: ServitorEmbeddingDriver;

    readonly context: ServitorContextMemory;
    readonly vectors: ServitorVectorStore;

    readonly formatter: ServitorContextFormatter;

    constructor({
        char = "ASSISTANT",
        timezone = null,
        prompt = "",
        args = {},
        driver,
        memory,
        formatter
    }: ServitorBridgeParameters) {
        this.char = char;
        this.timezone = timezone;
        this.prompt = prompt;
        this.args = args;

        this.inference = driver.inference;
        this.embedding = driver.embedding;

        this.context = memory.context;
        this.vectors = memory.vector;

        this.formatter = formatter;
    }

    async remember(line: ServitorChatLine, longterm = false): Promise<void> {
        if (line.message.tokens.length === 0) {
            line.message.tokens = await this.inference.tokenize(
                this.formatter.formatLine(line)
            );
        }
        this.context.insert(line);

        // insert into long-term memory if possible and desired
        if (longterm && this.embedding != null && this.vectors != null) {
            const win = this.context.getWindow(line.channel.id).slice(-3);
            if (win.length === 3) {
                const wins = win.map(x => this.formatter.formatLine(x))
                    .join("").trim();
                console.debug("MEMORY PUT");
                await this.vectors.store(wins);
            }
        }
    }

    async infer(line: ServitorChatLine): Promise<ServitorChatLine> {
        // select appropriate header template
        const header = line.channel.isprivate ?
            HEADER_DIRECT :
            HEADER_MULTIUSER;
        const suffix = this.timezone != null ?
            format(HEADER_TIMESTAMPS, { timezone: this.timezone }) + HEADER_SUFFIX :
            HEADER_SUFFIX

        // normalize channel name
        const channel = "#" + this.formatter.normalize(line.channel.friendlyname);

        // do vector recall
        var memories = "";
        if (this.embedding != null && this.vectors != null) {
            await this.embedding.embed(line.message.content);
            const doc = await this.vectors.retrieve(
                this.formatter.formatLine(line).trim()
            );
            if (doc != null && doc.length > 0) {
                memories = doc.map(x =>
                    format(RECALL_TEMPLATE, {
                        date: x[1].toDateString(),
                        fragment: x[0]
                    })
                ).join("\n\n");
            }
        }

        // format header
        const top = format(CONTEXT_TEMPLATE, {
            prompt: format(this.prompt.trim(), {
                char: this.char
            }),
            injected: memories, // TODO: ReAct stuff
            header: format(header + suffix, {
                char: this.char,
                user: this.formatter.normalize(line.actor.friendlyname),
                channel,
                date: new Date().toDateString()
            })
        });
        const toptoks = await this.inference.tokenize(top);

        if (this.args.max_new_tokens == null) {
            // have to ask inference server about its defaults
            const config = await this.inference.defaults();
            this.args.max_new_tokens = config.max_new_tokens;
        }

        // build full body
        const window = this.context.format(line.channel.id,
            toptoks.length + this.args.max_new_tokens);
        const prompt = top + window + this.formatter.formatPrompt(this.char);

        // do inference
        const result = await this.inference.infer(Object.assign({}, this.args, {
            prompt
        }));

        return this.context.generateSimple(
            this.char,
            result.text, result.tokens,
            true
        );
    }

}