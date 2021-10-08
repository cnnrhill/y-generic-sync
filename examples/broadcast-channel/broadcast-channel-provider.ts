import {BroadcastChannel} from 'broadcast-channel';
import * as Y from "yjs";
import * as awarenessProtocol from "y-protocols/awareness";

import GenericSyncProvider from "../../src/index";

export interface MessageWrapper {
    origin: number,
    message: Uint8Array,
}

export default class BroadcastChannelProvider extends GenericSyncProvider {
    private broadcastChannel: BroadcastChannel;

    constructor(doc: Y.Doc,
                private readonly room: string,
                awareness?: awarenessProtocol.Awareness) {
        super(doc, { awareness });

        this.broadcastChannel = new BroadcastChannel(room);

        this.on('broadcast', (message: Uint8Array, origin: number) => {
            this.broadcastChannel.postMessage({ message, origin }).then(() => {});
        });

        this.broadcastChannel.onmessage = (wrapper: MessageWrapper) => {
            this.onMessage(wrapper.message, wrapper.origin);
        }

        this.onConnecting();
        this.onConnect();
    }
}