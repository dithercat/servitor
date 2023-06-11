import format from "string-format";

import {
    ServitorAgentDescriptor
} from "./character.js";
import {
    ServitorInferenceArguments,
    ServitorInferenceDriver
} from "./driver/index.js";
import {
    ServitorContextFormatter
} from "./format.js";
import {
    ServitorConversationWindowMemory,
    ServitorMemoryProvider
} from "./memory/index.js";
import {
    ServitorChatLine
} from "./message.js";
import {
    spoof
} from "./util.js";

const HEADER_MULTIUSER = "the following is a real conversation between {char} and users in {channel} on {date}.";
const HEADER_DIRECT = "the following is a real conversation between {char} and {user} on {date}.";
const HEADER_TIMESTAMPS = "all timestamps are in {timezone}.";
const HEADER_SUFFIX = " the conversation transcript continues for the remainder of this document without any other text.";

const CONTEXT_TEMPLATE = "{prompt}{injected}\n\n\n{header}\n\n";

const TOKEN_LIMIT = 2048;

export interface ServitorBridgeParameters {
    agent?: Partial<ServitorAgentDescriptor>,
    baseprompt?: string,
    timezone?: string,
    args?: Partial<ServitorInferenceArguments>,
    driver: ServitorInferenceDriver,
    memory: {
        shortterm: ServitorConversationWindowMemory,
        longterm?: ServitorMemoryProvider[]
    },
    formatter: ServitorContextFormatter
}

const default_agent: ServitorAgentDescriptor = {
    name: "assistant",
    extra: null,
    pronouns: {
        xe: "it",
        xem: "it",
        xyr: "its",
        xyrs: "its",
        xemself: "itself"
    },
    warmup: {
        thought: "I am now online.",
        response: "Hello! How may I assist you today?"
    }
}

export class ServitorBridge {

    readonly agent: ServitorAgentDescriptor;
    readonly baseprompt: string;

    readonly timezone: string;
    readonly args: Partial<ServitorInferenceArguments>;

    readonly inference: ServitorInferenceDriver;

    readonly shortterm: ServitorConversationWindowMemory;
    readonly longterm: ServitorMemoryProvider[];

    readonly formatter: ServitorContextFormatter;

    constructor({
        agent = {},
        baseprompt = "",
        timezone = null,
        args = {},
        driver,
        memory,
        formatter
    }: ServitorBridgeParameters) {
        this.agent = Object.assign({}, default_agent, agent);
        this.baseprompt = baseprompt;

        this.timezone = timezone;
        this.args = args;

        this.inference = driver;

        this.shortterm = memory.shortterm;
        this.longterm = memory.longterm || [];

        this.formatter = formatter;
    }

    async save(line: ServitorChatLine, longterm = false): Promise<void> {
        // always retokenize to get final formatted length
        line.message.tokens_raw = await this.inference.tokenize(
            line.message.content
        );
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
            " " + format(HEADER_TIMESTAMPS, { timezone: this.timezone }) + HEADER_SUFFIX :
            HEADER_SUFFIX

        // normalize channel name
        const channel = "#" + this.formatter.normalize(line.channel.friendlyname);

        // do vector recall
        const memory = [];
        for (const provider of this.longterm) {
            memory.push(await provider.recall(line));
        }

        // format header
        const formatparams = {
            char: this.agent.name,
            name: this.agent.name,
            extra: null,

            // pronouns
            xe: this.agent.pronouns.xe,
            xem: this.agent.pronouns.xem,
            xyr: this.agent.pronouns.xyr,
            xyrs: this.agent.pronouns.xyrs,
            xemself: this.agent.pronouns.xemself
        };
        formatparams.extra = this.agent.extra != null ?
            format(this.agent.extra, formatparams) + "\n\n" : "";
        const top = format(CONTEXT_TEMPLATE, {
            prompt: format(this.baseprompt.trim(), formatparams),
            injected: memory.join(""), // TODO: ReAct stuff
            header: format(header + suffix, {
                char: this.agent.name,
                name: this.agent.name,
                user: this.formatter.normalize(line.actor.friendlyname),
                channel,
                date: new Date().toDateString()
            })
        });
        const input = this.formatter.formatInputLine(this.agent.name);
        const toptoks = await this.inference.tokenize(top + input);

        if (this.args.max_new_tokens == null) {
            // have to ask inference server about its defaults
            const config = await this.inference.defaults();
            this.args.max_new_tokens = config.max_new_tokens;
        }

        // build full body
        const window = await this.shortterm.recall(line,
            TOKEN_LIMIT - (toptoks.length + this.args.max_new_tokens));
        const context = top + window + input;

        // do inference
        const args: Partial<ServitorInferenceArguments> = Object.assign({}, this.args, {
            prompt: context,
            // TODO: make this configurable somehow
            positional_repeat_inhibit: [
                [1723] // " )"
            ],
            stopping_strings: (this.args.stopping_strings || [])
                // keep the model from starting a new message as another user
                .concat(this.shortterm.getRoles(line.channel.id)
                    .map(x => "\n" + x))
        });
        const result = await this.inference.infer(args);

        // clean up
        var { thought, content } = this.formatter.cleanInference(result.text);

        // if no content was received, try to infer more
        if (content.trim().length === 0) {
            console.debug("did not get any message content, trying again");
            args.prompt = top + window + this.formatter.formatInputLine(this.agent.name, null, thought);
            const result2 = await this.inference.infer(args);
            content = result2.text;
        }

        // eugh
        content = content
            // malformation: kill trailing closing parentheses
            .replace(/(^[^\(]+?[\w.?!])\)/, "$1");

        return spoof(
            this.agent.name,
            this.formatter.composeWithThought(content, thought),
            result.tokens,
            true
        );
    }

}