import { ServitorContextFormatter } from "./format.js";
import { ServitorChatLine } from "./log.js";

const SIMPLE_CHANNEL = "servitor:simple";

export class ServitorContextMemory {
    readonly buffers = new Map<string, ServitorChatLine[]>();

    constructor(
        readonly formatter: ServitorContextFormatter,
        readonly limit: number = 2048
    ) { }

    getWindowSize(buffer: ServitorChatLine[]): number {
        var t = 0;
        for (var i = 0; i < buffer.length; i++) {
            t += buffer[i].message.tokens.length;
        }
        return t;
    }

    purgeWindow(
        buffer: ServitorChatLine[], overhead: number, copy = true
    ): ServitorChatLine[] {
        if (copy) {
            buffer = buffer.concat();
        }
        while (this.getWindowSize(buffer) + overhead >= this.limit) {
            buffer.shift();
        }
        return buffer;
    }

    protected _warmupChannel(ring: ServitorChatLine[]): void { }

    insert(line: ServitorChatLine) {
        const id = line.channel.id;

        // get channel buffer
        var buffer: ServitorChatLine[] = [];
        if (this.buffers.has(id)) {
            buffer = this.buffers.get(id);
        }
        else {
            this._warmupChannel(buffer);
            this.buffers.set(id, buffer);
        }

        // abort if we already have this message in the buffer
        for (const oline of buffer) {
            if (oline.message.id === line.message.id) {
                return;
            }
        }

        // push new event into the ring
        buffer.push(line);

        // truncate to limit
        this.purgeWindow(buffer, 0, false);
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

    getCount(channel: string): number {
        if (this.buffers.has(channel)) {
            return this.buffers.get(channel).length;
        }
        return 0;
    }

    private _sinsert = 0;
    generateSimple(
        username: string,
        content: string, tokens: number[],
        self = false
    ): ServitorChatLine {
        return {
            actor: { friendlyname: username, self },
            channel: {
                id: SIMPLE_CHANNEL,
                friendlyname: "bot",
                isprivate: true
            },
            message: {
                id: (this._sinsert++).toString(),
                content, tokens
            }
        };
    }

    insertSimple(
        username: string,
        content: string, tokens: number[],
        self = false
    ) {
        this.insert(this.generateSimple(username, content, tokens, self));
    }

    format(channel: string, overhead = 0): string {
        // get buffer
        if (!this.buffers.has(channel)) {
            return "";
        }
        var buffer = this.buffers.get(channel);

        // limit buffer based on overhead
        buffer = this.purgeWindow(buffer, overhead);

        // assemble lines
        var lines: string[] = [];
        for (const line of buffer) {
            lines.push(this.formatter.formatLine(line));
        }
        return lines.join("");
    }

    formatSimple(overhead = 0): string {
        return this.format(SIMPLE_CHANNEL, overhead);
    }
}