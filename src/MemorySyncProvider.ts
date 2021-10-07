import {EventEmitter} from "events";
import * as Y from 'yjs';
import * as awarenessProtocol from "y-protocols/awareness";

import GenericSyncProvider from "./index";

interface MemorySyncMessage {
    clientID: number,
    message: any,
}

export default class MemorySyncProvider extends GenericSyncProvider {
    private static rooms = new Map<string, EventEmitter>();

    private clientID: number;
    private emitter: EventEmitter;

    public static reset() {
        // @ts-ignore
        for (const room of this.rooms.values()) {
            room.removeAllListeners();
        }
        this.rooms.clear();
    }

    constructor(doc: Y.Doc,
                private readonly room: string,
                awareness = new awarenessProtocol.Awareness(doc)) {
        super(doc, { awareness, resyncInterval: 10000 });

        this.clientID = doc.clientID;

        this.on('broadcast', (message: Uint8Array) => {
            this.logger(`broadcasting ${message.byteLength} bytes`);
            this.emitter.emit("message", {
                clientID: this.clientID,
                message,
            } as MemorySyncMessage);
        });

        if (!MemorySyncProvider.rooms.has(this.room)) {
            MemorySyncProvider.rooms.set(this.room, new EventEmitter());
        }

        this.emitter = MemorySyncProvider.rooms.get(this.room);

        this.emitter.on("message", (wrapper: MemorySyncMessage) => this.filterMessages(wrapper));

        this.onConnecting();
        this.onConnect();
    }

    private filterMessages(wrapper: MemorySyncMessage) {
        if (wrapper.clientID !== this.clientID) {
            this.logger(`received ${wrapper.message.byteLength} bytes from ${wrapper.clientID}`);
            this.onMessage(wrapper.message);
        }
    }
}