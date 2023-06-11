import format from "string-format";

import { ServitorAgentDescriptor } from "../../character.js";
import { ServitorContextFormatter } from "../../format.js";
import { ServitorChatLine } from "../../message.js";
import { getOrCreateWindow, slideWindow, windowHasDupe } from "../../util.js";

import { ServitorMemoryProvider } from "../base.js";

function timeOfDay() {
    const date = new Date();
    const hr = date.getHours();
    if (hr < 12) return "morning";
    if (hr < 12 + 6) return "afternoon";
    return "evening";
}

export class ServitorConversationWindowMemory implements ServitorMemoryProvider {

    readonly buffers = new Map<string, ServitorChatLine[]>();

    constructor(
        readonly formatter: ServitorContextFormatter,
        readonly agent?: ServitorAgentDescriptor
    ) { }

    protected _warmupChannel(ring: ServitorChatLine[]): void {
        if (this.agent != null && this.agent.warmup != null) {
            ring.push({
                actor: {
                    friendlyname: this.agent.name,
                    self: true
                },
                channel: null,
                message: {
                    id: "intro",
                    content: this.formatter.composeWithThought(
                        format(this.agent.warmup.response, {
                            timeofday: timeOfDay()
                        }),
                        this.agent.warmup.thought
                    ),
                    tokens: [],
                    tokens_raw: [],
                    timestamp: new Date().toISOString()
                }
            });
        }
    }

    async save(line: ServitorChatLine): Promise<void> {
        const id = line.channel.id;

        // get channel buffer
        const [buffer, fresh] = getOrCreateWindow(this.buffers, id)
        if (fresh) {
            this._warmupChannel(buffer);
        }

        // abort if we already have this message in the buffer
        if (windowHasDupe(buffer, line.message.id)) { return; }

        // push new event into the ring
        buffer.push(line);

        // truncate to limit
        slideWindow(buffer, true);
    }

    reset(channel: string): void {
        if (this.buffers.has(channel)) {
            this.buffers.delete(channel);
        }
    }

    getWindow(channel: string): ServitorChatLine[] {
        if (this.buffers.has(channel)) {
            return this.buffers.get(channel).concat();
        }
        return [];
    }

    getOldest(channel: string): ServitorChatLine {
        if (this.buffers.has(channel)) {
            return this.buffers.get(channel)[0];
        }
        return null;
    }

    getCount(channel: string): number {
        if (this.buffers.has(channel)) {
            return this.buffers.get(channel).length;
        }
        return 0;
    }

    getRoles(channel: string): string[] {
        if (this.buffers.has(channel)) {
            const msgs = this.buffers.get(channel)
                .map(x => this.formatter.normalizeName(x.actor.friendlyname))
            return Array.from(new Set(msgs));
        }
        return [];
    }

    async recall(line: ServitorChatLine, tokens = 2048): Promise<string> {
        // get buffer
        if (!this.buffers.has(line.channel.id)) {
            return "";
        }
        var buffer = this.buffers.get(line.channel.id);

        // limit buffer based on overhead
        buffer = slideWindow(buffer, false, tokens);

        // assemble lines
        var lines: string[] = [];
        for (const line of buffer) {
            lines.push(this.formatter.formatLine(line));
        }
        return lines.join("");
    }

}