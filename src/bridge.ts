import format from "string-format";

import {
    ServitorAgentDescriptor
} from "./character.js";
import {
    ServitorInferenceArguments,
    ServitorInferenceDriver,
    ServitorInferenceStopReason
} from "./driver/index.js";
import {
    ServitorContextFormatter
} from "./format.js";
import {
    ServitorConversationWindowMemory,
    ServitorMemory
} from "./memory/index.js";
import {
    ServitorChatLine
} from "./message.js";
import {
    decapitalize,
    spoof
} from "./util.js";

const HEADER_MULTIUSER = "the following is a real conversation between {char} and users in {channel} on {date}.";
const HEADER_DIRECT = "the following is a real conversation between {char} and {user} on {date}.";
const HEADER_TIMESTAMPS = "all timestamps are in {timezone}.";
const HEADER_SUFFIX = " the conversation transcript continues for the remainder of this document without any other text.";

const CONTEXT_TEMPLATE = "{prompt}{injected}\n\n\n{header}\n\n";

const TOKEN_LIMIT = 2048;

export interface ServitorBridgeArguments {
    agent?: Partial<ServitorAgentDescriptor>,
    baseprompt?: string,
    timezone?: string,
    args?: Partial<ServitorInferenceArguments>,
    max_tries?: number,
    driver: ServitorInferenceDriver,
    memory: {
        shortterm: ServitorConversationWindowMemory,
        longterm?: ServitorMemory[]
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
    },
    decapitalize: false
}

export class ServitorBridge {

    readonly agent: ServitorAgentDescriptor;
    readonly baseprompt: string;

    readonly timezone: string;
    readonly args: Partial<ServitorInferenceArguments>;
    readonly maxtries: number;

    readonly inference: ServitorInferenceDriver;

    readonly shortterm: ServitorConversationWindowMemory;
    readonly longterm: ServitorMemory[];

    readonly formatter: ServitorContextFormatter;

    constructor({
        agent = {},
        baseprompt = "",
        timezone = null,
        args = {},
        max_tries = 2,
        driver,
        memory,
        formatter
    }: ServitorBridgeArguments) {
        this.agent = Object.assign({}, default_agent, agent);
        this.baseprompt = baseprompt;

        this.timezone = timezone;
        this.args = args;
        this.maxtries = max_tries;

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

    async assembleContext(line: ServitorChatLine, thought?: string, trail: string = "") {
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
            const mem = await provider.recall(line);
            if (mem != null && mem.trim().length !== 0) {
                memory.push(mem);
            }
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
            injected: memory.length > 0 ? "\n\n\n" + memory.join("\n\n\n") : "",
            header: format(header + suffix, {
                char: this.agent.name,
                name: this.agent.name,
                user: this.formatter.normalize(line.actor.friendlyname),
                channel,
                date: new Date().toDateString()
            })
        });
        const input = this.formatter.formatInputLine(this.agent.name, null, thought) +
            (trail != null && !trail.startsWith(" ") ? " " : "") + trail;
        const toptoks = await this.inference.tokenize(top + input);

        if (this.args.max_new_tokens == null) {
            // have to ask inference server about its defaults
            const config = await this.inference.defaults();
            this.args.max_new_tokens = config.max_new_tokens;
        }

        // build full body
        const window = await this.shortterm.recall(line,
            TOKEN_LIMIT - (toptoks.length + this.args.max_new_tokens));
        return top + window + input;
    }

    async infer(line: ServitorChatLine): Promise<ServitorChatLine> {
        // assemble initial context
        var context = await this.assembleContext(line);

        // get positional repeat inhibits
        const positional_repeat_inhibit = (this.formatter.options.internal_monologue ? [
            // TODO: make this configurable somehow
            [1723], // ')' (don't allow immediately closing the thought)
            [376], // '"' (inhibit "planning" by simply writing what is going to be spoken aloud)
            [334], // '*' (don't allow action messages inside of the thought area)
        ] : []);

        // do inference
        const args: Partial<ServitorInferenceArguments> = Object.assign({}, this.args, {
            prompt: context,
            positional_repeat_inhibit,
            stopping_strings: (this.args.stopping_strings || [])
                // keep the model from starting a new message as another user
                .concat(this.shortterm.getRoles(line.channel.id)
                    // sometimes hallucinated usernames
                    .concat([
                        "user", "human",
                        "User", "Human",
                        "USER", "HUMAN"
                    ])
                    .map(x => "\n" + x))
        });
        var result = await this.inference.infer(args);
        const results = [result];

        // clean up
        var { thought, content } = this.formatter.cleanInference(result.text);

        // if no content was received, try to infer more
        if (content.trim().length === 0) {
            console.debug("did not get any message content, trying again");
            args.prompt = await this.assembleContext(line, thought);
            result = await this.inference.infer(args);
            content = result.text;
            results.push(result);
        }

        // if we didnt stop due to eos/stop strings, try to infer more
        for (
            var i = 1;
            (
                i < this.maxtries &&
                result.stop_reason === ServitorInferenceStopReason.TokenLimit &&
                result.fragments != null
            );
            i++
        ) {
            console.debug(`stopped due to token limit (${result.stop_reason}), trying again (${i}/${this.maxtries})`);
            // infer next chunk
            args.prompt = await this.assembleContext(line, thought, content);
            result = await this.inference.infer(args);
            // determine if there is a leading space on the first token
            const space = result.fragments[0][0] === " " ? " " : "";
            // append to content
            content += space + result.text;
            // push the result so we can tally up tokens after
            results.push(result);
        }

        // eugh
        content = content
            // malformation: kill trailing closing parentheses
            .replace(/(^[^\(]+?[\w.?!])\)/, "$1");

        // decapitalize if supposed to
        if (this.agent.decapitalize) {
            thought = decapitalize(thought);
            content = decapitalize(content);
        }

        return spoof(
            this.agent.name,
            this.formatter.composeWithThought(content, thought),
            results.map(x => x.tokens).flat(),
            true
        );
    }

}
