import format from "string-format";

import {
    ServitorInferenceArguments,
    ServitorInferenceDriver
} from "./driver/index.js";
import {
    ServitorMemoryProvider
} from "./memory/index.js";
import {
    ServitorContextFormatter
} from "./format.js";
import {
    ServitorChatLine
} from "./message.js";
import { spoof } from "./util.js";

const HEADER_MULTIUSER = "the following is a real conversation between {char} and users in {channel} on {date}.";
const HEADER_DIRECT = "the following is a real conversation between {char} and {user} on {date}.";
const HEADER_TIMESTAMPS = "all timestamps are in {timezone}.";
const HEADER_SUFFIX = " the conversation transcript continues for the remainder of this document without any other text.";

const CONTEXT_TEMPLATE = "{prompt}{injected}\n\n\n{header}\n\n";

const TOKEN_LIMIT = 2048;

export interface ServitorBridgeParameters {
    char?: string,
    timezone?: string,
    prompt?: string,
    args?: Partial<ServitorInferenceArguments>,
    driver: ServitorInferenceDriver,
    memory: {
        shortterm: ServitorMemoryProvider,
        longterm?: ServitorMemoryProvider[]
    },
    formatter: ServitorContextFormatter
}

export class ServitorBridge {

    readonly char: string;
    readonly timezone: string;
    readonly prompt: string;
    readonly args: Partial<ServitorInferenceArguments>;

    readonly inference: ServitorInferenceDriver;

    readonly shortterm: ServitorMemoryProvider;
    readonly longterm: ServitorMemoryProvider[];

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

        this.inference = driver;

        this.shortterm = memory.shortterm;
        this.longterm = memory.longterm || [];

        this.formatter = formatter;
    }

    async save(line: ServitorChatLine, longterm = false): Promise<void> {
        // always retokenize to get final formatted length
        line.message.tokens = await this.inference.tokenize(
            this.formatter.formatLine(line)
        );

        // push to short-term memory
        await this.shortterm.save(line);

        // insert into long-term memories if possible and desired
        if (longterm) {
            for (const provider of this.longterm) {
                await provider.save(line);
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
        const memory = [];
        for (const provider of this.longterm) {
            memory.push(await provider.recall(line));
        }

        // format header
        const top = format(CONTEXT_TEMPLATE, {
            prompt: format(this.prompt.trim(), {
                char: this.char
            }),
            injected: memory.join(""), // TODO: ReAct stuff
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
        const window = await this.shortterm.recall(line,
            TOKEN_LIMIT - toptoks.length + this.args.max_new_tokens);
        const context = top + window + this.formatter.formatInputLine(this.char);

        // do inference
        const args: Partial<ServitorInferenceArguments> = Object.assign({}, this.args, {
            prompt: context
        });
        const result = await this.inference.infer(args);

        // clean up
        var { thought, content } = this.formatter.cleanInference(result.text);

        // if no content was received, try to infer more
        if (content.trim().length === 0) {
            console.debug("did not get any message content, trying again");
            args.prompt = top + window + this.formatter.formatInputLine(this.char, null, thought);
            const result2 = await this.inference.infer(args);
            content = result2.text;
        }

        return spoof(
            this.char,
            this.formatter.composeWithThought(content, thought),
            result.tokens,
            true
        );
    }

}