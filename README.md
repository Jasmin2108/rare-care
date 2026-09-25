# Rare Care

A cozy Tamagotchi / familiar-care game starring your connected Rare Friend.

**SDK:** FriendSDK v0.1.2 · **Category:** Character Spotlight

Your Friend lives inside a colored handheld shell, sits in a tiny garden room, and keeps a simulated wallet jar. Caring costs a little simulated $RAREFRIENDS. A happy Friend idles better and the jar drips.

## Run it

From a FriendSDK v0.1.2 checkout (Node.js 22+):

```sh
npm ci
npm run build
npm run dev:game -- games/rare-care --host 0.0.0.0 --port 4173
```

Open the printed URL (normally `http://localhost:4173`). On a phone, use your computer's LAN address on the same network.

You need a browser wallet holding a hardwired Rare Friends Generations NFT (generation ≥ 1) on Robinhood mainnet (chain 4663). Preview play needs no RF funding and no signature.

## How to play

1. Connect the wallet and pick your owned Friend.
2. The official on-chain 16×16 sprite appears on the Tamagotchi screen.
3. Feed, play, or rest from the device buttons, the room props, or keys `1/F`, `2/P`, `3/R`.
4. Keep Hunger, Mood and Energy above 70% to start **Collecting**. If any need falls below 20%, the Friend looks sad, the screen dims, and collecting pauses.
5. Optional: buy a hat at **Matt's Hats** (`H`) or preview/lock **Shell Paint** (`C`).
6. Open the **Protocol desk** (`G` or **Earn**) to hardwire / promote / upgrade / buy RF / claim RF+WETH and watch the Friend's earnings.

Needs decay with elapsed time even while idle (Hunger 8%/min, Mood 6%/min, Energy 5%/min).

## Colored shells

Shell color is deterministic for that Friend:

| Family | Shell |
| --- | --- |
| Skeleton | bone white / gray |
| Mask | deep purple |
| Family | warm peach |
| Cellular | slime green |
| Asymmetry | split pink + teal |
| Hoverer | sky blue |
| Colossus | stone brown |
| Sparkling | gold / glitter yellow |
| Hollow | void black with a faint glow |

If family data is missing, the token id hashes into mint, coral, grape, butter, ice, charcoal, strawberry or lime. Buttons, bezel and strap charm follow the shell. The inner screen stays a readable pixel stage so the official sprite is unchanged.

## Costs and live RF map

Everything in this preview is **simulated** and labeled as such.

| Action | Preview | Intended live mapping |
| --- | --- | --- |
| Feed / Play / Rest | 1 Care Snack via `client.buy` + `play` + `settle` | 1 RF each from the Friend's canonical wallet |
| Matt's Hats | local cosmetic, 2 RF deducted from the on-screen balance | 2 RF cosmetic spend; does not change on-chain art |
| Shell Paint | local cosmetic, 3 RF, session lock only | 3 RF cosmetic spend; default color remains family / token id |
| Wallet jar drip | local simulated RF while all needs ≥ 70% | future Friend-wallet yield; not redeemable in v0.1.2 |
| Hardwire | reads on-chain generation; already-hardwired Friends stay marked permanent | live hardwire spends the generation's hardwire price (1–100,000 RF) |
| Promote | preview gen step toward 1, official price table, resets tier | live promote pays the hardwire difference; cannot enter Genesis |
| Upgrade | preview tiers 0–4 with official RF prices and weights | live upgrade; 50% burn / 50% RF rewards |
| Buy tokens | preview bag swap at 1 WETH = 1,000 RF | live protocol market; 5% WETH-side fee → WETH rewards |
| Claim RF / WETH | moves preview claimable into the Friend bag | live claim pays the NFT's own wallet, then withdraw in portfolio |

On-chain generation is read with `readGenerationEligibility`. Preview promote, upgrade, buy and claim use a **Friend bag** so they do not collide with Care Snacks. Live signing of those protocol actions is not available inside the SDK iframe; use [rarefriends.com/portfolio](https://rarefriends.com/portfolio) for real transactions.

Preview earnings: this Friend's official weight / 20,000,000 demo network weight. A happy Friend streams faster; a sad Friend pauses the stream. Numbers are labeled simulated and are not your live claimable balance.

The SDK chance-game client supports one consumable and one weighted table. Rare Care uses that slot for **Care Snack** (1 RF). Snack outcomes are flavor only (`Warm crumb`, `Play spark`, `Dream mote`, `Lucky marble`) with a maximum prize of 1.2 RF and an expected reward of 0.3625 RF, so care is a net sink.

Hats and shell colors stay local cosmetics because the runtime has no cosmetic or persistence action API yet.

## Persistence

The game writes hunger, mood, energy, equipped hat, chosen paint and jar drip to `localStorage` keyed by Friend id, and also keeps an in-memory copy.

FriendSDK's opaque sandbox (`sandbox="allow-scripts"`, no storage) cannot use `localStorage` or IndexedDB. Inside the official runtime, a refresh of the child frame drops that storage. Needs still decay from the last in-session timestamp, and the same save format will persist across refresh if the game is hosted outside that sandbox later.

## Checks and limits

- No combat, account system or overworld map.
- Wallet connection and ownership checks stay in the SDK runtime.
- Canonical Friend pixels are loaded with `createFriendReader()`.
- Audio uses the SDK sound kit; mute and reduced motion live in Settings.

Known issues: child-frame storage cannot survive an iframe reload; hat and paint spends are local overlays on the simulated RF readout; the jar drip does not credit the SDK ledger because the bridge cannot mint RF.
