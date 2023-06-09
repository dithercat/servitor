import { ServitorContextFormatter } from "../format.js";
import { ServitorChatLine } from "../message.js";
import { getOrCreateWindow, slideWindow, windowHasDupe } from "../util.js";

import { ServitorMemoryProvider } from "./base.js";

export class ServitorWindowMemory implements ServitorMemoryProvider {

    readonly buffers = new Map<string, ServitorChatLine[]>();

    constructor(
        readonly formatter: ServitorContextFormatter
    ) { }

    protected _warmupChannel(ring: ServitorChatLine[]): void { }

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