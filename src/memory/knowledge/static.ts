import { ServitorMemory } from "../base";

export class ServitorStaticMemory implements ServitorMemory {

    constructor(public content: string) { }

    async save(): Promise<void> {
        // no-op
    }

    async recall(): Promise<string> {
        return this.content;
    }

}