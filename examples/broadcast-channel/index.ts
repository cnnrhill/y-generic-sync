import * as Y from 'yjs';
import BroadcastChannelProvider from "./broadcast-channel-provider";

const doc = new Y.Doc();

new BroadcastChannelProvider(doc, "example");

doc.on('update', () => {
    const value = doc.getMap("test").get('counter');
    document.querySelector("#counter").textContent = value;
});

document.querySelector("button").addEventListener('click', () => {
    const map = doc.getMap("test");
    const value = map.get("counter") || 0;
    map.set("counter", value + 1);
});