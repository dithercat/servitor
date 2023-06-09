import format from "string-format";

import {
    ServitorEmbeddingDriver,
    ServitorVectorStoreDriver
} from "../../driver/index.js";
import { ServitorContextFormatter } from "../../format.js";
import { ServitorChatLine } from "../../message.js";
import { getOrCreateWindow, windowHasDupe } from "../../util.js";

import { ServitorMemory } from "./../base.js";

const RECALL_TEMPLATE = "recalled excerpt from previous conversation on {date}:\n\n{fragment}";

export class ServitorConversationVectorMemory implements ServitorMemory {

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

            // create embedding from second to last message
            const embedding = await this.embed.embed(
                this.formatter.formatLine(view[view.length - 2]).trim()
            );

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
        const doc = await this.storage.retrieve(
            embedding,
            line.channel.id,
            1,
            tokens,
            date
        );

        // if we got something, format it in
        if (doc != null && doc.length > 0) {
            memories = doc.map(x =>
                format(RECALL_TEMPLATE, {
                    date: x.date.toDateString(),
                    fragment: x.lines.map(x =>
                        this.formatter.formatLine(x)
                    ).join("").trim()
                })
            ).join("");
        }

        return memories;
    }

}