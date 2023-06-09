import { ServitorChatLine } from "../message";

export interface ServitorMemoryProvider {
    save(line: ServitorChatLine): Promise<void>;
    recall(line: ServitorChatLine, tokens?: number): Promise<string>;
}