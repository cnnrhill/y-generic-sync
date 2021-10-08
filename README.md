[![NPM Version](http://img.shields.io/npm/v/y-generic-sync.svg?style=flat)](https://www.npmjs.org/package/y-generic-sync)
[![Install Size](https://packagephobia.now.sh/badge?p=y-generic-sync)](https://packagephobia.now.sh/result?p=y-generic-sync)

# y-generic-sync

Sync Yjs over any communication channel.

y-generic-sync is a sync provider for Yjs that leaves the choice of network channel (such as websocket, WebRTC, socket.io, broadcast-channel, Node.JS sockets...) entirely up to you. You provide a compatible interface to send and receive messages with other peers, and y-generic-sync will send the messages that are required to sync your document.

This library is a work in progress.

# Get started

## Installation

    npm install y-generic-sync --save

## Example

    import * as Y from 'yjs';
    import GenericSyncProvider from 'y-generic-sync';

    const doc = Y.Doc();

    const syncProvider = new GenericSyncProvider(doc);

    syncProvider.on('broadcast', (bytes, origin) => {
        // implement your own code to broadcast `bytes` (a Uint8Array) to all peers
    });

    // use callbacks to pass messages and other events into the sync provider:
    syncProvider.onConnecting();
    syncProvider.onConnect();

    myCustomChannelImplementation.on('message', (bytes, origin) => {
        if (origin !== syncProvider.id) {
            syncProvider.onMessage(bytes);
        }
    });

    syncProvider.onDisconnect();