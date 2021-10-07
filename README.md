# y-generic-sync

A generic sync provider for Yjs that leaves the choice of network channel (websocket, socket.io, broadcast-channel, Node.JS sockets...) entirely up to you. You provide a way to send and receive messages with other peers, and y-generic-sync will send the messages that are required to sync your document.

This library is a work in progress.