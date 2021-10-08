import debug from 'debug';
import {EventEmitter} from "events";
import * as decoding from "lib0/decoding";
import * as encoding from "lib0/encoding";
import * as Y from 'yjs';
import * as authProtocol from "y-protocols/auth";
import * as awarenessProtocol from "y-protocols/awareness";
import * as syncProtocol from "y-protocols/sync";

import {
    createAwarenessUpdateMessage,
    createSyncStep1Message,
    createUpdateMessage,
    MessageType
} from "./message-types";

export interface GenericSyncProviderConfig {
    awareness?: awarenessProtocol.Awareness,
    resyncInterval?: number,
}

export default class GenericSyncProvider extends EventEmitter {
    private awareness: awarenessProtocol.Awareness;
    private _synced: boolean = false;
    public connected = false;
    private resyncInterval: NodeJS.Timer|undefined;
    protected logger: debug.Debugger;
    public readonly id: number;

    private callbacks = {
        onDocumentUpdate: (update, origin) => {
            if (origin !== this) {
                this.logger("document updated locally, broadcasting update to peers");
                this.emit("broadcast", createUpdateMessage(update), this.id);
            }
        },

        onAwarenessUpdate: ({added, updated, removed}) => {
            const changedClients = added.concat(updated).concat(removed);
            const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients);
            this.emit("broadcast", createAwarenessUpdateMessage(awarenessUpdate), this.id);
        },

        removeSelfFromAwarenessOnUnload: () => {
            awarenessProtocol.removeAwarenessStates(this.awareness, [this.doc.clientID], 'window unload');
        },
    };

    constructor(private doc: Y.Doc, private config: GenericSyncProviderConfig) {
        super();

        this.id = doc.clientID;

        this.logger = debug("y-" + doc.clientID);
        this.logger("initializing");

        this.awareness = this.config.awareness || new awarenessProtocol.Awareness(doc);

        this.doc.on('update', this.callbacks.onDocumentUpdate);
        this.awareness.on('update', this.callbacks.onAwarenessUpdate);

        if (this.config.resyncInterval && this.config.resyncInterval > 0) {
            this.resyncInterval = setInterval(() => {
                this.logger("resyncing (resync interval elapsed)");
                this.emit("broadcast", createSyncStep1Message(this.doc), this.id);
            }, this.config.resyncInterval);
        }

        if (typeof window !== 'undefined') {
            window.addEventListener('beforeunload', this.callbacks.removeSelfFromAwarenessOnUnload);
        } else if (typeof process !== 'undefined') {
            process.on('exit', () => this.callbacks.removeSelfFromAwarenessOnUnload);
        }
    }

    get synced() {
        return this._synced;
    }

    set synced(state) {
        if (this._synced !== state) {
            this.logger("setting sync state to " + state);
            this._synced = state;
            this.emit('synced', [state]);
            this.emit('sync', [state]);
        }
    }

    public onConnecting() {
        if (!this.connected) {
            this.logger("connecting");
            this.emit('status', [{status: "connecting"}]);
        }
    }

    public onConnect() {
        this.logger("connected");

        this.connected = true;

        this.emit('status', [{status: "connected"}]);

        this.emit("broadcast", createSyncStep1Message(this.doc), this.id);

        if (this.awareness.getLocalState() !== null) {
            const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(this.awareness, [this.doc.clientID]);
            this.emit("broadcast", createAwarenessUpdateMessage(awarenessUpdate), this.id);
        }
    }

    public onDisconnect() {
        this.logger("disconnected");

        this.synced = false;

        // update awareness (keep all users except local)
        // FIXME? compare to broadcast channel behavior
        const states = Array.from(this.awareness.getStates().keys())
            .filter(client => client !== this.doc.clientID);
        awarenessProtocol.removeAwarenessStates(this.awareness, states, this);

        if (this.connected) {
            this.connected = false;
            this.emit('status', [{status: "disconnected"}]);
        }
    }

    public onMessage(message: Uint8Array, origin: number) {
        if (origin === this.id) {
            return;
        }

        this.logger(`received ${message.byteLength} bytes from ${origin}`);

        const emitSynced = true;
        const decoder = decoding.createDecoder(message);
        const messageType = decoding.readVarUint(decoder);

        let response: Uint8Array|null = null;

        switch (messageType as MessageType) {
            case MessageType.MessageSync:
                const encoder = encoding.createEncoder();
                encoding.writeVarUint(encoder, MessageType.MessageSync);
                const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, this.doc, this);
                this.logger(`processed message (type = MessageSync, subtype = ${syncMessageType}`);
                if (emitSynced && syncMessageType === syncProtocol.messageYjsSyncStep2 && !this.synced) {
                    this.synced = true;
                }
                if (encoding.length(encoder) > 1) {
                    response = encoding.toUint8Array(encoder);
                }
                break;
            case MessageType.MessageQueryAwareness:
                const awarenessUpdate = awarenessProtocol.encodeAwarenessUpdate(this.awareness,
                    Array.from(this.awareness.getStates().keys()));
                response = createAwarenessUpdateMessage(awarenessUpdate);
                this.logger("processed message (type = MessageQeuryAwareness)");
                break;
            case MessageType.MessageAwareness:
                awarenessProtocol.applyAwarenessUpdate(this.awareness, decoding.readVarUint8Array(decoder), this);
                this.logger("processed message (type = MessageAwareness)");
                break;
            case MessageType.MessageAuth:
                authProtocol.readAuthMessage(decoder, this.doc,
                    (provider, reason) => console.warn(`Permission denied to channel:\n${reason}`))
                this.logger("processed message (type = MessageAuth)");
                break;
            default:
                console.error('Unable to compute message');
        }

        if (response) {
            this.logger("sync protocol returned a response message to be broadcast");
            this.emit("broadcast", response, this.id);
        }
    }

    public destroy() {
        this.logger("destroying");

        if (this.resyncInterval) {
            clearInterval(this.resyncInterval);
        }

        if (typeof window !== 'undefined') {
            window.removeEventListener('beforeunload', this.callbacks.removeSelfFromAwarenessOnUnload);
        } else if (typeof process !== 'undefined') {
            process.off('exit', () => this.callbacks.removeSelfFromAwarenessOnUnload);
        }

        this.awareness.off('update', this.callbacks.onAwarenessUpdate);
        this.doc.off('update', this.callbacks.onDocumentUpdate);
    }
}
