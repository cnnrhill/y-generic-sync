import * as Y from 'yjs';
import MemorySyncProvider from './MemorySyncProvider';

function sleep(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

(async () => {
    const doc1 = new Y.Doc();
    const map1 = doc1.getMap("test");
    map1.set("key1", 1);

    const doc2 = new Y.Doc();
    const map2 = doc2.getMap("test");
    map2.set("key2", 1);

    new MemorySyncProvider(doc1, "test");
    await sleep(1000);
    new MemorySyncProvider(doc2, "test");

    await sleep(1000);
    map1.set('key1', 2);
    await sleep(1000);
    map1.set('key1', 3);

    setInterval(() => {
        console.log("Map 1", doc1.toJSON());
        console.log("Map 2", doc2.toJSON());
    }, 5000);
})();