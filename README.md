# Rare Care

A cozy Tamagotchi starring your connected Rare Friend. The shell, the voice, and the care rules all come from that Generations NFT.

**SDK:** FriendSDK v0.1.2 · **Category:** Character Spotlight

Your Friend lives inside a colored handheld shell, sits in a tiny garden room, and keeps a simulated wallet jar. Caring costs a little simulated $RAREFRIENDS. A happy Friend idles better and the jar drips.

Family traits change care, not just color. Skeleton hoards (jar drips faster, play barely moves it). Mask hides its need bars until the shell is tapped. Colossus barely feels a snack. Hoverer rests. Hollow only fills on rest.

## Run it

From a FriendSDK v0.1.2 checkout (Node.js 22+):

```sh
npm ci
npm run build
npm run dev:game -- games/rare-care --host 0.0.0.0 --port 4173
```

Open the printed URL (normally `http://localhost:4173`). On a phone, use your computer's LAN address on the same network.

You need a browser wallet holding a hardwired Rare Friends Generations NFT (generation ≥ 1) on Robinhood mainnet (chain 4663). Preview play needs no RF funding and no signature.

No-wallet family gallery: https://Jasmin2108.github.io/rare-care-preview/families.html
