import { ServitorChatLine } from "./message";

var _sinsert = 0;
export function spoof(
    username: string,
    content: string, tokens: number[],
    self = false
): ServitorChatLine {
    return {
        actor: { friendlyname: username, self },
        channel: {
            id: "servitor:spoof",
            friendlyname: "bot",
            isprivate: true
        },
        message: {
            id: (_sinsert++).toString(),
            content, tokens
        }
    };
}

export function getWindowSize(buffer: ServitorChatLine[]): number {
    var t = 0;
    for (var i = 0; i < buffer.length; i++) {
        t += buffer[i].message.tokens.length;
    }
    return t;
}

export function slideWindow(
    buffer: ServitorChatLine[],
    dontcopy = false, limit = 2048
): ServitorChatLine[] {
    if (!dontcopy) {
        buffer = buffer.concat();
    }
    while (getWindowSize(buffer) >= limit) {
        buffer.shift();
    }
    return buffer;
}

export function getOrCreateWindow(
    windows: Map<string, ServitorChatLine[]>,
    id: string
): [ServitorChatLine[], boolean] {
    var buffer: ServitorChatLine[] = [];
    if (windows.has(id)) {
        buffer = windows.get(id);
        return [buffer, false];
    }
    windows.set(id, buffer);
    return [buffer, true];
}

export function windowHasDupe(
    window: ServitorChatLine[],
    id: string
): boolean {
    for (const bline of window) {
        if (bline.message.id === id) {
            return true;
        }
    }
    return false;
}