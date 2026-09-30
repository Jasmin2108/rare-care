# Rare Care

A cozy Tamagotchi starring your connected Rare Friend. The shell, the voice, and the care rules all come from that Generations NFT.

**SDK:** FriendSDK v0.1.2 · **Category:** Character Spotlight

Your Friend lives inside a colored handheld shell, sits in a tiny garden room, and keeps a simulated wallet jar. Caring costs a little simulated $RAREFRIENDS. A happy Friend idles better and the jar drips.

Family traits change care, not just color. Skeleton hoards (jar drips faster, play barely moves it). Mask hides its need bars until the shell is tapped. Colossus barely feels a snack. Hoverer rests. Hollow only fills on rest.

No-wallet family gallery: https://Jasmin2108.github.io/rare-care-preview/families.html

## Run it

From a FriendSDK v0.1.2 checkout (Node.js 22+):

```sh
npm ci
npm run build
npm run dev:game -- games/rare-care --host 0.0.0.0 --port 4173
```

Open the printed URL (normally `http://localhost:4173`). Preview play needs a hardwired Generations NFT on Robinhood mainnet (chain 4663). No RF funding and no signature.

## How to play

1. Connect the wallet and pick your owned Friend.
2. The official on-chain 16×16 sprite appears on the Tamagotchi screen. The opening card names this Friend's family, shell, and trait.
3. Feed, play, or rest from the device buttons, the room props, or keys `1/F`, `2/P`, `3/R`. A Mask hides its need bars until you tap the shell.
4. Keep Hunger, Mood and Energy above 70% to start Collecting. Below 20% the Friend looks sad and collecting pauses.
5. Hats (`H`, 2 RF) and Shell Paint (`C`, 3 RF) are local cosmetics. Protocol desk is `G`.

Base decay is Hunger 8%/min, Mood 6%/min, Energy 5%/min, then multiplied by the family trait. Care Snack is 1 RF. Expected prize 0.3625 RF, max 1.2 RF, so care is a net sink.

`friendsdk check games/rare-care` passed. The SDK sandbox cannot keep localStorage across an iframe refresh.
