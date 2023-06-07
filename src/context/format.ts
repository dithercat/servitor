import format from "string-format";

import { ServitorChatLine } from "./log.js";

export interface ServitorCleanedInference {
    content: string,
    thought?: string
}

export interface ServitorContextFormatter {
    normalize(name: string): string;
    normalizeName(name: string): string;
    formatLine(x: ServitorChatLine): string;
    formatPrompt(name: string): string;
    cleanInference(text: string): ServitorCleanedInference;
}

export interface ServitorSimpleContextFormatterOptions {
    name_normalize: boolean,
    name_capitalize: boolean,

    message_prefix: string,
    message_suffix: string,

    author_prefix: string,
    author_suffix: string,

    timestamps: boolean,
    append_eos: boolean,
    append_eos_all: boolean,

    internal_monologue: boolean,
    thought_prefix: string,
    thought_suffix: string,

    message_line: string,
    input_line: string,

    bos: string,
    eos: string
}

const defaults: ServitorSimpleContextFormatterOptions = {
    name_normalize: true,
    name_capitalize: true,

    message_prefix: "",
    message_suffix: "\n\n",

    author_prefix: "",
    author_suffix: ":",

    timestamps: false,
    append_eos: true,
    append_eos_all: false,

    internal_monologue: false,
    thought_prefix: "(thought:",
    thought_suffix: ")",

    message_line: "{prefix}{timestamp}{author_prefix}{author}{author_suffix} {content}{suffix}",
    input_line: "{prefix}{timestamp}{author_prefix}{author}{author_suffix}{bos} {miniprompt}",

    bos: "\x02",
    eos: "\x03"
}

export class ServitorSimpleContextFormatter implements ServitorContextFormatter {
    readonly options: ServitorSimpleContextFormatterOptions;

    constructor(options: Partial<ServitorSimpleContextFormatterOptions> = {}) {
        this.options = Object.assign({}, defaults, options);
    }

    // LLMs seem to respond best to 12 hour timestamps
    getTime(date: Date) {
        var hr = date.getHours();
        const ampm = hr >= 12 ? "pm" : "am";
        if (hr > 12) hr -= 12;
        if (hr === 0) hr = 12;
        const mn = date.getMinutes().toString().padStart(2, "0");
        return `${hr}:${mn} ${ampm}`;
    }

    normalize(name: string): string {
        return name.toLowerCase().replace(/[^A-Za-z0-9]/g, "");
    }

    normalizeName(name: string): string {
        if (this.options.name_normalize) {
            name = this.normalize(name);
        }
        if (this.options.name_capitalize) {
            name = name.toUpperCase();
        }
        return name;
    }

    formatLine(x: ServitorChatLine): string {
        // get timestamp if wanted
        const timestamp = this.options.timestamps ?
            ("[" + this.getTime(new Date(x.message.timestamp)) + "]") : "";

        // normalize username
        const author = this.normalizeName(x.actor.friendlyname);

        // add eos if needed
        var suffix = this.options.message_suffix;
        if (this.options.append_eos_all || (this.options.append_eos && x.actor.self)) {
            suffix = this.options.eos + this.options.message_suffix;
        }

        return format(this.options.message_line, {
            prefix: this.options.message_prefix,
            timestamp,
            author_prefix: this.options.author_prefix,
            author,
            author_suffix: this.options.author_suffix,
            content: x.message.content,
            suffix
        });
    }

    formatPrompt(author: string, miniprompt: string = null): string {
        // get timestamp if wanted
        const timestamp = this.options.timestamps ?
            ("[" + this.getTime(new Date()) + "]") : "";

        // add thought miniprompt if needed
        if (miniprompt == null) {
            if (this.options.internal_monologue) {
                miniprompt = this.options.thought_prefix;
            }
            else {
                miniprompt = "";
            }
        }

        author = this.normalizeName(author);

        return format(this.options.input_line, {
            prefix: this.options.message_prefix,
            timestamp,
            author_prefix: this.options.author_prefix,
            author,
            author_suffix: this.options.author_suffix,
            bos: this.options.bos,
            miniprompt
        }).trimEnd();
    }

    cleanInference(content: string): ServitorCleanedInference {
        content = content.trim();

        // monologue cleaning
        var thought: string = null;
        if (this.options.internal_monologue) {
            // TODO: do this in a less naive way
            const thoughtend = content.indexOf(this.options.thought_suffix);
            thought = content.substring(0, thoughtend).trim();
            content = content.substring(thoughtend + 1).trim();
        }

        return { content, thought };
    }
}