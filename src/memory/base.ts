import { ServitorChatLine } from "../message";

export interface ServitorMemory {
    save(line: ServitorChatLine): Promise<void>;
    recall(line: ServitorChatLine, tokens?: number): Promise<string>;
}