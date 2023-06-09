import format from "string-format";

import {
    ServitorEmbeddingDriver,
    ServitorVectorStoreDriver
} from "../driver/index.js";
import { ServitorContextFormatter } from "../format.js";
import { ServitorChatLine } from "../message.js";
import { getOrCreateWindow, windowHasDupe } from "../util.js";

import { ServitorMemoryProvider } from "./base.js";

const RECALL_TEMPLATE = "\n\nrecalled excerpt from previous conversation ({date}):\n{fragment}";

export class ServitorVectorMemory implements ServitorMemoryProvider {

    readonly buffers = new Map<string, ServitorChatLine[]>();

    constructor(
        readonly embed: ServitorEmbeddingDriver,
        readonly storage: ServitorVectorStoreDriver,
        readonly formatter: ServitorContextFormatter,
        readonly windowsize = 128,
        readonly windowview = 3
    ) { }

    async save(line: ServitorChatLine): Promise<void> {
        // get channel buffer
        const id = line.channel.id;
        const [buffer] = getOrCreateWindow(this.buffers, id);

        // abort if we already have this message in the buffer
        if (windowHasDupe(buffer, line.message.id)) { return; }

        // push new event into the ring
        buffer.push(line);

        // truncate to limit
        while (buffer.length > this.windowsize) {
            buffer.shift();
        }

        // actually save
        if (buffer.length >= this.windowview) {
            // truncate all but the last 3 lines of the window
            const view = buffer.concat();
            while (view.length > this.windowview) {
                view.shift();
            }

            // create embedding from view
            const doc = view.map(x => this.formatter.formatLine(x))
                .join("").trim();
            const embedding = await this.embed.embed(doc);

            // commit to database
            await this.storage.store(view, embedding);
        }
    }

    async recall(line: ServitorChatLine, tokens: number = 256): Promise<string> {
        var memories = "";

        // get channel buffer
        const id = line.channel.id;
        const [buffer] = getOrCreateWindow(this.buffers, id);

        // get date of oldest line in window
        var date = new Date();
        if (buffer.length >= 1) {
            date = new Date(buffer[0].message.timestamp);
        }

        // create embedding
        const embedding = await this.embed.embed(
            this.formatter.formatLine(line).trim()
        );

        // retrieve most salient fragment
        const doc = await this.storage.retrieve(embedding, 1, tokens, date);

        // if we got something, format it in
        if (doc != null && doc.length > 0) {
            memories = doc.map(x =>
                format(RECALL_TEMPLATE, {
                    date: x[1].toDateString(),
                    fragment: x[0]
                })
            ).join("\n\n");
        }

        return memories;
    }

}