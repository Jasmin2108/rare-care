"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import type { GameComponentProps } from "@rarefriends/friendsdk/runtime";
import { GameMenu } from "@rarefriends/friendsdk/frame";
import { formatGameAmount } from "@rarefriends/friendsdk/ui";
import { maximumPrize, RF, type GameSnapshot } from "@rarefriends/friendsdk/game";
import { createFriendSoundKit, type FriendSoundKit, type FriendSoundCue } from "@rarefriends/friendsdk/sounds";
import { createFriendReader, spriteFrame, type GenerationSprites } from "@rarefriends/friendsdk/sprites";
import { readGenerationEligibility } from "@rarefriends/friendsdk/identity";
import { createFriendPublicClient } from "@rarefriends/friendsdk/wallet";
import {
  HARDWIRE_RF,
  PREVIEW_NETWORK_WEIGHT,
  PREVIEW_WETH_PER_RF,
  clampGen,
  clampTier,
  formatToken,
  formatWeight,
  promoteCost,
  reactivateCost,
  rewardWeight,
  upgradeCost,
} from "./protocol";
import "@rarefriends/friendsdk/frame.css";
import "./style.css";

const FAMILY_SHELLS: Record<string, { name: string; a: string; b: string; glow: string; screen: string; ink: string }> = {
  Skeleton: { name: "bone", a: "#e8e2d6", b: "#9a9488", glow: "#d7d1c6", screen: "#1b1a17", ink: "#3b3832" },
  Mask: { name: "violet", a: "#4a1f73", b: "#1b0a33", glow: "#8a4ad4", screen: "#14081f", ink: "#f0e6ff" },
  Family: { name: "peach", a: "#f4b184", b: "#d9784a", glow: "#ffd2b0", screen: "#2a160e", ink: "#3a2216" },
  Cellular: { name: "slime", a: "#8fd96a", b: "#3d8a2f", glow: "#c6ff9a", screen: "#10240c", ink: "#163012" },
  Asymmetry: { name: "split", a: "#f48fb1", b: "#2ec4b6", glow: "#ffe0f0", screen: "#1a1220", ink: "#201018" },
  Hoverer: { name: "sky", a: "#7ec8e3", b: "#2f6f9a", glow: "#c5f0ff", screen: "#0b1c28", ink: "#123040" },
  Colossus: { name: "stone", a: "#a18463", b: "#5c4630", glow: "#d7c09a", screen: "#1c140c", ink: "#2a1c10" },
  Sparkling: { name: "gold", a: "#f0c14b", b: "#b8860b", glow: "#ffe9a0", screen: "#2a2208", ink: "#3a2c08" },
  Hollow: { name: "void", a: "#16161c", b: "#050508", glow: "#6e7cff", screen: "#05050a", ink: "#dce0ff" },
};

const PAINT_SHELLS = [
  { id: "mint", a: "#9fe8c3", b: "#2f8f6a", glow: "#d9ffe9", screen: "#10241c", ink: "#143028" },
  { id: "coral", a: "#ff8a73", b: "#c44536", glow: "#ffd2c8", screen: "#2a100c", ink: "#3a1812" },
  { id: "grape", a: "#b48cff", b: "#5b3d9a", glow: "#e6d6ff", screen: "#180e28", ink: "#f4ecff" },
  { id: "butter", a: "#ffe08a", b: "#d0a12a", glow: "#fff3c4", screen: "#2a2208", ink: "#3a2c08" },
  { id: "ice", a: "#b9e7ff", b: "#4c8fb8", glow: "#e7f7ff", screen: "#0c1c28", ink: "#123040" },
  { id: "charcoal", a: "#5b5b63", b: "#222228", glow: "#c8c8d0", screen: "#101014", ink: "#f0f0f4" },
  { id: "strawberry", a: "#ff6b8a", b: "#b02048", glow: "#ffd0da", screen: "#2a0c14", ink: "#3a1018" },
  { id: "lime", a: "#c6f04a", b: "#6a9a12", glow: "#e8ff9a", screen: "#16240a", ink: "#1c3010" },
] as const;

const HATS = [
  { id: "none", name: "Bare head", price: 0 },
  { id: "beanie", name: "Wool beanie", price: 2 },
  { id: "bow", name: "Garden bow", price: 2 },
  { id: "cap", name: "Soft cap", price: 2 },
  { id: "crown", name: "Play crown", price: 2 },
  { id: "propeller", name: "Propeller hat", price: 2 },
] as const;

type HatId = (typeof HATS)[number]["id"];
type PaintId = (typeof PAINT_SHELLS)[number]["id"];
type FamilyName = keyof typeof FAMILY_SHELLS;
type CareAction = "feed" | "play" | "rest";
type Menu = "settings" | "hats" | "paint" | "protocol" | null;

type CareSave = {
  hunger: number;
  mood: number;
  energy: number;
  hat: HatId;
  paint: PaintId | null;
  jarRf: number;
  cosmeticRf: number;
  previewGen: number | null;
  previewTier: number;
  bagRf: number;
  bagWeth: number;
  claimableRf: number;
  claimableWeth: number;
  claimedRf: number;
  claimedWeth: number;
  updatedAt: number;
};

const memorySaves = new Map<string, CareSave>();
const clamp = (value: number, min = 0, max = 100) => Math.max(min, Math.min(max, value));
const rfText = (value: bigint) => `${formatGameAmount(value, 18)} RF`;
const saveKey = (friendId: bigint) => `rare-care:v1:${friendId.toString()}`;

function hashToPaint(friendId: bigint): PaintId {
  const n = Number(friendId % 8n);
  return PAINT_SHELLS[Number.isFinite(n) ? n : 0]!.id;
}

function defaultSave(): CareSave {
  return {
    hunger: 74,
    mood: 72,
    energy: 76,
    hat: "none",
    paint: null,
    jarRf: 0,
    cosmeticRf: 0,
    previewGen: null,
    previewTier: 0,
    bagRf: 25,
    bagWeth: 0.4,
    claimableRf: 0,
    claimableWeth: 0,
    claimedRf: 0,
    claimedWeth: 0,
    updatedAt: Date.now(),
  };
}

function decaySave(save: CareSave, now = Date.now(), trait: FamilyTrait = FAMILY_TRAITS.Family!): CareSave {
  const minutes = Math.max(0, (now - save.updatedAt) / 60_000);
  const hunger = clamp(save.hunger - minutes * 8 * trait.hunger);
  const mood = clamp(save.mood - minutes * 6 * trait.mood);
  const energy = clamp(save.energy - minutes * 5 * trait.energy);
  const sad = hunger < 20 || mood < 20 || energy < 20;
  const collecting = !sad && hunger >= 70 && mood >= 70 && energy >= 70;
  const jarRf = collecting ? save.jarRf + minutes * 0.045 * trait.jar : save.jarRf;
  const generation = clampGen(save.previewGen ?? 6);
  const weight = rewardWeight(generation, save.previewTier);
  const share = weight / PREVIEW_NETWORK_WEIGHT;
  const moodMul = sad ? 0 : collecting ? 1.35 : 0.55;
  const claimableRf = save.claimableRf + minutes * share * 12 * moodMul;
  const claimableWeth = save.claimableWeth + minutes * share * 0.004 * moodMul;
  return {
    ...save,
    hunger,
    mood,
    energy,
    jarRf,
    previewGen: save.previewGen,
    previewTier: clampTier(save.previewTier ?? 0),
    bagRf: save.bagRf ?? 25,
    bagWeth: save.bagWeth ?? 0.4,
    claimableRf,
    claimableWeth,
    claimedRf: save.claimedRf ?? 0,
    claimedWeth: save.claimedWeth ?? 0,
    updatedAt: now,
  };
}

function readSave(friendId: bigint): CareSave {
  const key = saveKey(friendId);
  try {
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw) as CareSave;
      const next = decaySave({ ...defaultSave(), ...parsed });
      memorySaves.set(key, next);
      return next;
    }
  } catch {
    /* sandbox iframe cannot use localStorage */
  }
  const cached = memorySaves.get(key);
  return decaySave(cached ?? defaultSave());
}

function writeSave(friendId: bigint, save: CareSave) {
  const next = { ...save, updatedAt: Date.now() };
  const key = saveKey(friendId);
  memorySaves.set(key, next);
  try {
    window.localStorage.setItem(key, JSON.stringify(next));
  } catch {
    /* expected inside the opaque sandbox */
  }
}

const LINES: Record<string, Record<CareAction | "idle" | "sad" | "collect", readonly string[]>> = {
  Skeleton: {
    feed: ["Bones don't chew. I stored it.", "Calories are a rumor. Still mine."],
    play: ["I moved. Don't make it a thing.", "Joy is a finite resource."],
    rest: ["Horizontal. Efficient.", "I will haunt this pillow."],
    idle: ["Inventory: one Friend."],
    sad: ["Needs low. Collection paused."],
    collect: ["Jar ticks. I am keeping it."],
  },
  Mask: {
    feed: ["You didn't see me eat that.", "The bowl knows my secrets."],
    play: ["A game inside a game.", "Smile stays behind the mask."],
    rest: ["Curtain down.", "Dreams are classified."],
    idle: ["Watch the jar. Not me."],
    sad: ["Dim the lights. I prefer it."],
    collect: ["Quiet drip. Good."],
  },
  Family: {
    feed: ["Thank you. Warm tummy.", "Shared snacks taste better."],
    play: ["Again? Yes. Again.", "You make the room brighter."],
    rest: ["Tucked in. Love you.", "Soft blanket, full heart."],
    idle: ["Home is this little shell."],
    sad: ["Could use a hug… and a snack."],
    collect: ["We're saving together."],
  },
  Cellular: {
    feed: ["Glucose acquired.", "Mitosis later. Snack now."],
    play: ["Dopamine cascade initiated.", "Chaotic but statistically fun."],
    rest: ["Entering low-power mode.", "Repair cycle: green."],
    idle: ["Observing substrate."],
    sad: ["Metrics critical. Pause harvest."],
    collect: ["Yield within expected range."],
  },
  Asymmetry: {
    feed: ["Left tooth liked that.", "Right eye wants dessert."],
    play: ["Rules? Never heard of them.", "Whoops. That was the toy."],
    rest: ["Sleep sideways. Always.", "Dreaming in two directions."],
    idle: ["This shell is two shells."],
    sad: ["Half of me is sad. The other half also."],
    collect: ["Jar go brr. Unevenly."],
  },
  Hoverer: {
    feed: ["I nibble while floating.", "Gravity can wait."],
    play: ["We skipped the ground.", "Air tag: you're it."],
    rest: ["Hover-nap. Do not poke.", "Clouds make decent pillows."],
    idle: ["Drifting above the bowl."],
    sad: ["Altitude dropping."],
    collect: ["Coins rise to meet me."],
  },
  Colossus: {
    feed: ["A crumb for a mountain.", "I felt that. Barely."],
    play: ["Gentle. The floor is small.", "Toy survived. Impressive."],
    rest: ["The bed is a suggestion.", "Stone sleeps slowly."],
    idle: ["I am the furniture now."],
    sad: ["Even stone slumps."],
    collect: ["The jar is a pebble. Still mine."],
  },
  Sparkling: {
    feed: ["Crumbs, but make them glitter.", "Snack, then shine."],
    play: ["Confetti optional. I am the confetti.", "Sparkle combo!"],
    rest: ["Lights down, shimmer on.", "Gold dreams."],
    idle: ["Catch the light, catch the drip."],
    sad: ["Dimmer than I like."],
    collect: ["The jar is basically jewelry."],
  },
  Hollow: {
    feed: ["It vanished into me.", "Full of nothing, plus snack."],
    play: ["A game echoing in a cave.", "Toy fell through. It's fine."],
    rest: ["Sleep is a darker dark.", "Zzz from the void."],
    idle: ["The glow is the friend."],
    sad: ["Hollow and hungry."],
    collect: ["RF dripping into the dark."],
  },
};

const OPENERS: Record<string, string> = {
  Skeleton: "Bone shell. I hoard. Don't touch the jar.",
  Mask: "Violet shell. You didn't see me arrive.",
  Family: "Peach shell. This is home. Come sit.",
  Cellular: "Slime shell. Specimen contained. Snack pending.",
  Asymmetry: "Split shell. Pink half waved. Teal half didn't.",
  Hoverer: "Sky shell. Gravity can wait.",
  Colossus: "Stone shell. I am the furniture now.",
  Sparkling: "Gold shell. I am the confetti.",
  Hollow: "Void shell. The glow is the friend.",
};

function pickLine(family: string, key: CareAction | "idle" | "sad" | "collect") {
  const pack = LINES[family] ?? LINES.Family;
  const lines = pack[key];
  return lines[Math.floor(Math.random() * lines.length)] ?? "";
}

type FamilyTrait = {
  label: string;
  blurb: string;
  hunger: number;
  mood: number;
  energy: number;
  jar: number;
  feed: number;
  play: number;
  rest: number;
  veil: boolean;
};

const FAMILY_TRAITS: Record<string, FamilyTrait> = {
  Skeleton: { label: "Hoard", blurb: "The jar drips faster. Play barely moves it.", hunger: 0.7, mood: 1, energy: 1, jar: 1.7, feed: 28, play: 14, rest: 32, veil: false },
  Mask: { label: "Veil", blurb: "Needs stay hidden until you tap the shell.", hunger: 1, mood: 0.7, energy: 1, jar: 1, feed: 34, play: 34, rest: 36, veil: true },
  Family: { label: "Home", blurb: "Every care lands a little warmer.", hunger: 0.9, mood: 0.75, energy: 0.9, jar: 1.1, feed: 40, play: 40, rest: 40, veil: false },
  Cellular: { label: "Specimen", blurb: "Snacks hit harder. It is running an experiment.", hunger: 1.1, mood: 1, energy: 1, jar: 1, feed: 46, play: 28, rest: 30, veil: false },
  Asymmetry: { label: "Split", blurb: "Play swings mood hard, both ways.", hunger: 1, mood: 1.15, energy: 1, jar: 1.1, feed: 30, play: 48, rest: 30, veil: false },
  Hoverer: { label: "Drift", blurb: "Energy falls slowly. Rest is the right care.", hunger: 1, mood: 1, energy: 0.55, jar: 1, feed: 30, play: 32, rest: 46, veil: false },
  Colossus: { label: "Stone", blurb: "Hunger falls slowly, but a snack is a crumb.", hunger: 0.55, mood: 0.85, energy: 0.8, jar: 0.9, feed: 18, play: 22, rest: 28, veil: false },
  Sparkling: { label: "Shine", blurb: "A happy jar drips like jewelry.", hunger: 1, mood: 0.9, energy: 1, jar: 1.45, feed: 32, play: 42, rest: 30, veil: false },
  Hollow: { label: "Void", blurb: "Energy drains. Rest is the only real fill.", hunger: 1, mood: 1, energy: 1.4, jar: 0.85, feed: 26, play: 24, rest: 50, veil: false },
};

function openerFor(family: string) {
  return OPENERS[family] ?? OPENERS.Family;
}

function traitFor(family: string) {
  return FAMILY_TRAITS[family] ?? FAMILY_TRAITS.Family!;
}

function shellTitle(family: string, shellName: string, painted: boolean) {
  if (painted) return `Painted ${shellName} shell · ${family} underneath`;
  return `${family} · ${shellName} shell`;
}

function resolveShell(familyName: string | undefined, friendId: bigint, paint: PaintId | null) {
  if (paint) {
    const painted = PAINT_SHELLS.find(item => item.id === paint)!;
    return { ...painted, name: painted.id, painted: true as const };
  }
  if (familyName && FAMILY_SHELLS[familyName]) {
    return { ...FAMILY_SHELLS[familyName], painted: false as const };
  }
  const fallback = PAINT_SHELLS.find(item => item.id === hashToPaint(friendId))!;
  return { ...fallback, name: fallback.id, painted: false as const };
}

function headAnchor(pixels: Array<[number, number]>) {
  if (!pixels.length) return { x: 8, y: 2 };
  const minY = Math.min(...pixels.map(point => point[1]));
  const crown = pixels.filter(point => point[1] <= minY + 3);
  const minX = Math.min(...crown.map(point => point[0]));
  const maxX = Math.max(...crown.map(point => point[0]));
  return { x: (minX + maxX + 1) / 2, y: minY };
}

function drawHat(ctx: CanvasRenderingContext2D, hat: HatId, left: number, top: number, scale: number, t: number) {
  if (hat === "none") return;
  const px = (x: number, y: number, w = 1, h = 1, color = "#222") => {
    ctx.fillStyle = color;
    ctx.fillRect(Math.round(left + x * scale), Math.round(top + y * scale), w * scale, h * scale);
  };
  if (hat === "beanie") {
    px(4, 1, 8, 3, "#3d6ea8");
    px(3, 3, 10, 2, "#2b4f7a");
    px(7, 0, 2, 2, "#dfe7f2");
  } else if (hat === "bow") {
    px(5, 1, 2, 2, "#d23b6d");
    px(9, 1, 2, 2, "#d23b6d");
    px(7, 2, 2, 2, "#ff7aa2");
  } else if (hat === "cap") {
    px(4, 2, 8, 2, "#2c6b4a");
    px(8, 3, 5, 1, "#1d4a33");
  } else if (hat === "crown") {
    px(4, 1, 8, 2, "#f0c14b");
    px(4, 0, 1, 2, "#f0c14b");
    px(7, 0, 2, 2, "#ffe28a");
    px(11, 0, 1, 2, "#f0c14b");
  } else if (hat === "propeller") {
    const spin = Math.sin(t / 120);
    px(7, 1, 2, 3, "#666");
    px(spin > 0 ? 3 : 9, 1, 6, 1, "#d94b4b");
  }
}

function FriendScreen({
  sprites,
  hat,
  action,
  sad,
  collecting,
  reducedMotion,
}: {
  sprites: GenerationSprites;
  hat: HatId;
  action: CareAction | null;
  sad: boolean;
  collecting: boolean;
  reducedMotion: boolean;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const node = canvas.current;
    const ctx = node?.getContext("2d");
    if (!node || !ctx) return;
    let frame = 0;
    const render = (now: number) => {
      const size = 16 * 7;
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, node.width, node.height);
      ctx.fillStyle = sad ? "#0a0c10" : "#f4f1e8";
      ctx.fillRect(0, 0, node.width, node.height);
      const actionBob = action === "rest" ? 2 : action ? Math.round(Math.sin(now / 90) * 3) : 0;
      const idleBob = !action && !reducedMotion ? Math.round(Math.sin(now / 180) * 2) : 0;
      const bob = reducedMotion ? 0 : actionBob + idleBob;
      const facing = action === "play" && Math.floor(now / 220) % 2 ? "left" : "down";
      const walking = action === "play" && !reducedMotion;
      const index = reducedMotion ? 0 : Math.floor(now / 140) % 8;
      const rows = spriteFrame(sprites, facing, walking, index).frame.rows;
      const left = Math.round((node.width - size) / 2);
      const top = Math.round((node.height - size) / 2) + bob + (action === "rest" ? 6 : 0);
      const pixels: Array<[number, number]> = [];
      rows.forEach((row, y) => {
        [...row].forEach((cell, x) => {
          if (cell === "#") pixels.push([x, y]);
        });
      });
      ctx.fillStyle = sad ? "#8a90a0" : "#ffffff";
      for (const [x, y] of pixels) ctx.fillRect(left + x * 7 - 2, top + y * 7 - 2, 11, 11);
      ctx.fillStyle = sad ? "#1b1e26" : "#111";
      for (const [x, y] of pixels) ctx.fillRect(left + x * 7, top + y * 7, 7, 7);
      const head = headAnchor(pixels);
      const faceShift = facing === "left" ? -1 : facing === "right" ? 1 : 0;
      drawHat(ctx, hat, left + (head.x - 8 + faceShift) * 7, top + (head.y - 2) * 7, 7, now);
      if (action === "feed") {
        ctx.fillStyle = "#d9784a";
        ctx.fillRect(left + 4 * 7, top + 15 * 7, 8, 6);
        ctx.fillStyle = "#f4b184";
        ctx.fillRect(left + 10 * 7, top + 12 * 7 + Math.round(Math.sin(now / 80) * 4), 5, 5);
      }
      if (action === "rest") {
        ctx.fillStyle = "#6e7cff";
        ctx.font = "12px monospace";
        ctx.fillText("z", left + size - 8, top + 10);
        ctx.fillText("Z", left + size + 2, top - 2);
      }
      if (collecting && !sad) {
        ctx.fillStyle = "#2f8f6a";
        ctx.fillRect(node.width - 16, 8, 8, 8);
      }
      frame = requestAnimationFrame(render);
    };
    frame = requestAnimationFrame(render);
    return () => cancelAnimationFrame(frame);
  }, [sprites, hat, action, sad, collecting, reducedMotion]);
  return <canvas ref={canvas} className="care-sprite" width={168} height={168} aria-hidden="true" />;
}

export default function RareCare({ friendId, client, paused }: GameComponentProps) {
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [sprites, setSprites] = useState<GenerationSprites | null>(null);
  const [save, setSave] = useState<CareSave>(() => readSave(friendId));
  const [menu, setMenu] = useState<Menu>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [line, setLine] = useState("A little Friend lives in this shell.");
  const [action, setAction] = useState<CareAction | null>(null);
  const [muted, setMuted] = useState(true);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [paintPreview, setPaintPreview] = useState<PaintId | null>(null);
  const [chainGen, setChainGen] = useState<number | null>(null);
  const [chainHardwired, setChainHardwired] = useState(false);
  const [buyAmount, setBuyAmount] = useState("10");
  const [showShellCard, setShowShellCard] = useState(true);
  const [veilOpen, setVeilOpen] = useState(false);
  const sound = useRef<FriendSoundKit | null>(null);
  const locked = useRef(false);
  const epoch = useRef(0);
  const definition = client.definition;

  const familyName = (sprites?.familyName ?? "Family") as FamilyName;
  const shell = resolveShell(sprites?.familyName, friendId, paintPreview ?? save.paint);
  const trait = traitFor(familyName);
  const veiled = trait.veil && !veilOpen;
  const sad = save.hunger < 20 || save.mood < 20 || save.energy < 20;
  const collecting = !sad && save.hunger >= 70 && save.mood >= 70 && save.energy >= 70;
  const displayRf = snapshot ? snapshot.rfBalance - BigInt(Math.round(save.cosmeticRf)) * RF : 0n;
  const canCare = Boolean(snapshot && displayRf >= RF && snapshot.freeStake >= maximumPrize(definition));
  const liveGen = clampGen(save.previewGen ?? chainGen ?? 6);
  const liveTier = clampTier(save.previewTier);
  const weight = rewardWeight(liveGen, liveTier);
  const sharePct = (weight / PREVIEW_NETWORK_WEIGHT) * 100;
  const nextPromote = promoteCost(liveGen);
  const nextUpgrade = upgradeCost(liveGen, liveTier);

  const persist = useCallback((next: CareSave) => {
    writeSave(friendId, next);
    setSave(next);
  }, [friendId]);

  useEffect(() => {
    const version = ++epoch.current;
    sound.current = createFriendSoundKit({ muted: true });
    setSprites(null);
    setSnapshot(null);
    setMenu(null);
    setError("");
    setAction(null);
    setPaintPreview(null);
    setShowShellCard(true);
    setVeilOpen(false);
    setSave(readSave(friendId));
    setLine("Every Rare Friend gets its own Tamagotchi color.");
    void client.read().then(value => {
      if (version === epoch.current) setSnapshot(value);
    }).catch(cause => {
      if (version === epoch.current) setError(cause instanceof Error ? cause.message : "Could not load the preview.");
    });
    void createFriendReader().read(friendId).then(value => {
      if (version === epoch.current) {
        setSprites(value);
        setLine(openerFor(value.familyName));
        window.setTimeout(() => {
          if (version === epoch.current) setShowShellCard(false);
        }, 5600);
      }
    }).catch(cause => {
      if (version === epoch.current) setError(cause instanceof Error ? cause.message : "Friend artwork could not load.");
    });
    void readGenerationEligibility(createFriendPublicClient(), friendId).then(info => {
      if (version !== epoch.current) return;
      const generation = Number(info.generation);
      setChainGen(Number.isFinite(generation) ? generation : null);
      setChainHardwired(Boolean(info.hardwired));
      setSave(current => {
        const next = {
          ...current,
          previewGen: current.previewGen ?? (Number.isFinite(generation) && generation >= 1 ? generation : 6),
        };
        writeSave(friendId, next);
        return next;
      });
    }).catch(() => {
      if (version === epoch.current) setChainHardwired(true);
    });
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReducedMotion(preference.matches);
    update();
    preference.addEventListener("change", update);
    return () => {
      epoch.current++;
      sound.current?.dispose();
      sound.current = null;
      preference.removeEventListener("change", update);
    };
  }, [client, friendId]);

  useEffect(() => {
    const tick = window.setInterval(() => {
      setSave(current => {
        const next = decaySave(current, Date.now(), traitFor(familyName));
        writeSave(friendId, next);
        return next;
      });
    }, 1000);
    return () => window.clearInterval(tick);
  }, [friendId, familyName]);

  async function spendSnack(workAfter?: () => void, cue: FriendSoundCue = "purchase") {
    if (locked.current || paused || busy) return;
    const version = epoch.current;
    locked.current = true;
    setBusy(true);
    setError("");
    void sound.current?.unlock();
    try {
      const before = await client.read();
      const pending = before.plays.find(play => play.outcomeId === null);
      if (!pending && before.consumables === 0n) await client.buy(1n);
      const latest = await client.read();
      const play = latest.plays.find(item => item.outcomeId === null) ?? (await client.play(1n))[0];
      await client.settle(play.id);
      const value = await client.read();
      if (version === epoch.current) {
        setSnapshot(value);
        sound.current?.play(cue);
        workAfter?.();
      }
    } catch (cause) {
      if (version === epoch.current) setError(cause instanceof Error ? cause.message : "The care action failed.");
    } finally {
      if (version === epoch.current) {
        locked.current = false;
        setBusy(false);
      }
    }
  }

  function care(kind: CareAction) {
    if (!canCare) {
      setError(displayRf < RF ? "Not enough simulated RF for a Care Snack." : "Need free backing for one Care Snack.");
      return;
    }
    const trait = traitFor(familyName);
    void spendSnack(() => {
      setSave(current => {
        const boosted = {
          ...current,
          hunger: kind === "feed" ? clamp(current.hunger + trait.feed) : current.hunger,
          mood: kind === "play" ? clamp(current.mood + trait.play) : current.mood,
          energy: kind === "rest" ? clamp(current.energy + trait.rest) : current.energy,
        };
        const next = decaySave(boosted, Date.now(), trait);
        writeSave(friendId, next);
        return next;
      });
      setAction(kind);
      setLine(pickLine(familyName, kind));
      window.setTimeout(() => setAction(null), reducedMotion ? 200 : 1400);
    }, kind === "feed" ? "purchase" : kind === "play" ? "action-ready" : "reward");
  }

  function buyHat(id: HatId) {
    if (id === save.hat) return;
    const offer = HATS.find(item => item.id === id)!;
    if (offer.price > 0) {
      const cost = BigInt(offer.price) * RF;
      if (displayRf < cost) {
        setError("Not enough simulated RF for a hat.");
        return;
      }
    }
    persist({ ...save, hat: id, cosmeticRf: save.cosmeticRf + offer.price });
    setLine(id === "none" ? "Hat back on the peg." : "Matt nodded. It stays on.");
    setMenu(null);
    sound.current?.play("purchase");
  }

  function lockPaint(id: PaintId | null) {
    if (id && id !== save.paint) {
      if (displayRf < 3n * RF) {
        setError("Not enough simulated RF to paint the shell.");
        return;
      }
      persist({ ...save, paint: id, cosmeticRf: save.cosmeticRf + 3 });
      setLine("Paint locked for this session. On-chain art is unchanged.");
    } else {
      persist({ ...save, paint: null });
      setLine("Back to the Friend's own shell color.");
    }
    setPaintPreview(null);
    setMenu(null);
  }

  function spendBag(cost: number, reason: string, next: Partial<CareSave>) {
    if (save.bagRf + 1e-9 < cost) {
      setError(`Need ${formatToken(cost)} RF in the Friend bag. Buy tokens first (preview).`);
      return false;
    }
    persist({ ...save, ...next, bagRf: save.bagRf - cost });
    setLine(reason);
    sound.current?.play("purchase");
    return true;
  }

  function hardwireFriend() {
    if (chainHardwired || liveGen >= 1 && chainGen !== 0) {
      setLine(`Already hardwired. On-chain generation ${chainGen ?? liveGen}.`);
      return;
    }
    const cost = HARDWIRE_RF[6];
    spendBag(cost, "Hardwired at Generation 6, tier 0. Permanent Friend wallet is now active (preview).", {
      previewGen: 6,
      previewTier: 0,
    });
  }

  function promoteFriend() {
    if (!nextPromote) {
      setLine("Generation 1 is the top Generations rung. Cannot promote into Genesis.");
      return;
    }
    spendBag(nextPromote, `Promoted ${liveGen} → ${liveGen - 1}. Tier reset to 0. Identity kept (preview).`, {
      previewGen: liveGen - 1,
      previewTier: 0,
    });
  }

  function upgradeFriend() {
    if (nextUpgrade == null) {
      setLine("Already tier 4 for this generation.");
      return;
    }
    spendBag(nextUpgrade, `Upgraded to tier ${liveTier + 1}. Weight is now ${formatWeight(rewardWeight(liveGen, liveTier + 1))} (preview).`, {
      previewTier: liveTier + 1,
    });
  }

  function buyTokens() {
    const rf = Number(buyAmount);
    if (!Number.isFinite(rf) || rf <= 0) {
      setError("Enter a positive RF amount.");
      return;
    }
    const weth = rf * PREVIEW_WETH_PER_RF;
    if (save.bagWeth + 1e-12 < weth) {
      setError(`Need ${formatToken(weth, 6)} WETH in the preview bag.`);
      return;
    }
    persist({ ...save, bagWeth: save.bagWeth - weth, bagRf: save.bagRf + rf });
    setLine(`Bought ${formatToken(rf)} RF for ${formatToken(weth, 6)} WETH at the preview desk. Live price is the protocol market.`);
    sound.current?.play("purchase");
  }

  function claimRewards() {
    if (save.claimableRf <= 0 && save.claimableWeth <= 0) {
      setLine("Nothing to claim yet. Keep the Friend happy so the stream ticks.");
      return;
    }
    persist({
      ...save,
      claimedRf: save.claimedRf + save.claimableRf,
      claimedWeth: save.claimedWeth + save.claimableWeth,
      bagRf: save.bagRf + save.claimableRf,
      bagWeth: save.bagWeth + save.claimableWeth,
      claimableRf: 0,
      claimableWeth: 0,
    });
    setLine("Claimed RF + WETH into this Friend's preview wallet.");
    sound.current?.play("reward");
  }

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (paused || busy || menu) {
        if (event.key === "Escape") setMenu(null);
        return;
      }
      const key = event.key.toLowerCase();
      if (key === "1" || key === "f") care("feed");
      if (key === "2" || key === "p") care("play");
      if (key === "3" || key === "r") care("rest");
      if (key === "h") setMenu("hats");
      if (key === "c") setMenu("paint");
      if (key === "g") setMenu("protocol");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  });

  const status = useMemo(() => {
    if (sad) return "Sad · collecting paused";
    if (collecting) return "Collecting · jar dripping";
    return "Idle · keep needs above 70%";
  }, [sad, collecting]);

  if (!snapshot) {
    return (
      <div className="care-boot" role={error ? "alert" : "status"}>
        <p>{error || "Warming the shell…"}</p>
        {error && <button type="button" onClick={() => void client.read().then(setSnapshot)}>Retry</button>}
      </div>
    );
  }
  if (snapshot.friendId !== friendId) {
    return <p className="care-boot" role="alert">This game session does not match the selected Friend.</p>;
  }

  const theme = {
    "--shell-a": shell.a,
    "--shell-b": shell.b,
    "--shell-glow": shell.glow,
    "--shell-screen": shell.screen,
    "--shell-ink": shell.ink,
  } as CSSProperties;

  return (
    <section className={`care-root${sad ? " is-sad" : ""}${collecting ? " is-collecting" : ""}`} style={theme} aria-label="Rare Care" aria-busy={busy}>
      <div className="care-room" inert={Boolean(menu) || paused || undefined}>
        <div className="care-sky" />
        <div className="care-wall" />
        <div className="care-floor" />
        <button type="button" className="prop prop-bed" disabled={busy || paused} onClick={() => care("rest")}>
          <span>Bed</span><small>Rest · 1 RF</small>
        </button>
        <button type="button" className="prop prop-bowl" disabled={busy || paused} onClick={() => care("feed")}>
          <span>Bowl</span><small>Feed · 1 RF</small>
        </button>
        <button type="button" className="prop prop-toy" disabled={busy || paused} onClick={() => care("play")}>
          <span>Toy</span><small>Play · 1 RF</small>
        </button>
        <div className="prop prop-plant" aria-hidden="true"><span>Plant</span></div>
        <button type="button" className="prop prop-hats" disabled={busy || paused} onClick={() => setMenu("hats")}>
          <span>Matt's Hats</span><small>2 RF · local</small>
        </button>
        <button type="button" className="prop prop-paint" disabled={busy || paused} onClick={() => setMenu("paint")}>
          <span>Shell Paint</span><small>3 RF · local</small>
        </button>
        <button type="button" className="prop prop-desk" disabled={busy || paused} onClick={() => setMenu("protocol")}>
          <span>Protocol desk</span>
          <small>Gen {liveGen} · T{liveTier}</small>
        </button>
        <button type="button" className={`prop prop-jar${collecting ? " is-drip" : ""}`} disabled={busy || paused} onClick={() => setMenu("protocol")}>
          <span>Friend wallet</span>
          <small>{formatToken(save.claimableRf)} RF · {formatToken(save.claimableWeth, 5)} WETH</small>
        </button>

        <div className={`tama${sad ? " dim" : ""}${veiled ? " is-veiled" : ""}`} role="img" aria-label={`${familyName} Tamagotchi in a ${shell.name} shell`} onClick={() => trait.veil && setVeilOpen(open => !open)}>
          <div className="tama-strap" />
          <div className="tama-charm" />
          <div className="tama-body">
            <div className="tama-bezel">
              <div className="tama-screen">
                {sprites ? (
                  <FriendScreen
                    sprites={sprites}
                    hat={save.hat}
                    action={action}
                    sad={sad}
                    collecting={collecting}
                    reducedMotion={reducedMotion}
                  />
                ) : (
                  <p className="tama-loading">{error || "Loading on-chain sprite…"}</p>
                )}
                <div className={`tama-meters${veiled ? " is-veiled" : ""}`} aria-label="Needs">
                  <Meter label="Hunger" value={save.hunger} />
                  <Meter label="Mood" value={save.mood} />
                  <Meter label="Energy" value={save.energy} />
                  {veiled && <span className="veil-note">Tap shell</span>}
                </div>
              </div>
            </div>
            <div className="tama-keys">
              <button type="button" disabled={busy || paused} onClick={() => care("feed")}>A Feed</button>
              <button type="button" disabled={busy || paused} onClick={() => care("play")}>B Play</button>
              <button type="button" disabled={busy || paused} onClick={() => care("rest")}>C Rest</button>
            </div>
          </div>
        </div>
      </div>

      {line && <p className="care-bubble" role="status">{line}</p>}
      <p className="care-postcard">{familyName} · {trait.label}. {openerFor(familyName)}</p>

      {showShellCard && sprites && (
        <aside className="shell-card" aria-live="polite">
          <i className="shell-swatch" aria-hidden="true" />
          <div>
            <strong>{shellTitle(familyName, shell.name, shell.painted)}</strong>
            <small>{trait.label} · {trait.blurb}</small>
          </div>
        </aside>
      )}

      <header className="care-hud">
        <p className="hud-shell">
          <i className="shell-swatch" aria-hidden="true" />
          <strong>{shellTitle(familyName, shell.name, shell.painted)}</strong>
          {" · "}
          #{friendId.toString()}
          {" · "}
          gen {chainGen ?? liveGen}{chainHardwired ? " hardwired" : ""}
        </p>
        <p>{rfText(displayRf < 0n ? 0n : displayRf)} care · bag {formatToken(save.bagRf)} RF · {status}</p>
        <button type="button" onClick={() => setMenu("protocol")}>Earn</button>
        <button type="button" onClick={() => setMenu("settings")}>Settings</button>
      </header>
      <p className="care-hint">
        <span className="desk">1 / F feed · 2 / P play · 3 / R rest · H hats · C paint · G protocol</span>
        <span className="phone">Tap the bowl, toy, bed, or the A B C buttons</span>
      </p>
      {error && <p className="care-error" role="alert">{error}</p>}

      {menu && (
        <GameMenu
          title={menu === "hats" ? "Matt's Hats" : menu === "paint" ? "Shell Paint" : menu === "protocol" ? "Friend protocol desk" : "Settings"}
          onClose={busy ? undefined : () => { setMenu(null); setPaintPreview(null); }}
        >
          {menu === "protocol" ? (
            <>
              <p>
                On-chain generation {chainGen ?? "—"} {chainHardwired ? "(hardwired, playable)" : ""}.
                Preview tier and bag are session-local. Live hardwire / promote / upgrade / market / claim stay on the Rare Friends portfolio — the SDK sandbox cannot sign those transactions.
              </p>
              <div className="earn-grid">
                <p><strong>Position</strong><small>Gen {liveGen} · tier {liveTier} / 4</small></p>
                <p><strong>Weight</strong><small>{formatWeight(weight)}</small></p>
                <p><strong>Preview share</strong><small>{sharePct.toFixed(4)}% of {formatWeight(PREVIEW_NETWORK_WEIGHT)}</small></p>
                <p><strong>Care jar</strong><small>{formatToken(save.jarRf, 3)} RF drip</small></p>
                <p><strong>Claimable</strong><small>{formatToken(save.claimableRf)} RF · {formatToken(save.claimableWeth, 5)} WETH</small></p>
                <p><strong>Claimed into bag</strong><small>{formatToken(save.claimedRf)} RF · {formatToken(save.claimedWeth, 5)} WETH</small></p>
                <p><strong>Friend bag</strong><small>{formatToken(save.bagRf)} RF · {formatToken(save.bagWeth, 5)} WETH</small></p>
                <p><strong>Reactivate</strong><small>{formatToken(reactivateCost(liveGen))} RF if a transfer clears activation</small></p>
              </div>
              <div className="care-grid">
                <button type="button" disabled={busy || paused} onClick={hardwireFriend}>
                  Hardwire
                  <small>{chainHardwired || (chainGen ?? 0) >= 1 ? "already permanent" : `${formatToken(HARDWIRE_RF[6])} RF → gen 6`}</small>
                </button>
                <button type="button" disabled={busy || paused || !nextPromote} onClick={promoteFriend}>
                  Promote generation
                  <small>{nextPromote ? `${liveGen} → ${liveGen - 1} · ${formatToken(nextPromote)} RF` : "already gen 1"}</small>
                </button>
                <button type="button" disabled={busy || paused || nextUpgrade == null} onClick={upgradeFriend}>
                  Upgrade tier
                  <small>{nextUpgrade == null ? "tier 4 max" : `${liveTier} → ${liveTier + 1} · ${formatToken(nextUpgrade)} RF`}</small>
                </button>
                <button type="button" disabled={busy || paused || (save.claimableRf <= 0 && save.claimableWeth <= 0)} onClick={claimRewards}>
                  Claim RF / WETH
                  <small>pays this Friend's wallet</small>
                </button>
              </div>
              <p>Buy RF from the preview bag (1 WETH = {formatToken(1 / PREVIEW_WETH_PER_RF)} RF here). Live swaps use the protocol market 5% WETH fee.</p>
              <label className="buy-row">
                RF to buy
                <input inputMode="decimal" value={buyAmount} onChange={event => setBuyAmount(event.target.value)} />
                <button type="button" className="rf-frame-primary" disabled={busy || paused} onClick={buyTokens}>Buy tokens</button>
              </label>
              <p>
                Payments split 50% burn / 50% RF rewards on live hardwire, promote and upgrade.
                A happy Friend (needs ≥ 70%) streams faster in this preview; a sad Friend pauses the stream.
              </p>
            </>
          ) : menu === "hats" ? (
            <>
              <p>Hats are local cosmetics for this session. Live RF mapping: 2 RF per hat. They do not change on-chain art.</p>
              <div className="care-grid">
                {HATS.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className={save.hat === item.id ? "is-on" : undefined}
                    disabled={busy || paused || (item.price > 0 && displayRf < BigInt(item.price) * RF && save.hat !== item.id)}
                    onClick={() => buyHat(item.id)}
                  >
                    {item.name}
                    <small>{item.price ? `${item.price} RF` : "unequip"}</small>
                  </button>
                ))}
              </div>
            </>
          ) : menu === "paint" ? (
            <>
              <p>Preview a shell color, then lock it for 3 RF (local). Default color still comes from family / token id. On-chain sprite stays the same.</p>
              <div className="care-swatches">
                <button type="button" className={!paintPreview && !save.paint ? "is-on" : undefined} onClick={() => setPaintPreview(null)}>
                  Family default
                </button>
                {PAINT_SHELLS.map(item => (
                  <button
                    key={item.id}
                    type="button"
                    className={(paintPreview ?? save.paint) === item.id ? "is-on" : undefined}
                    style={{ background: `linear-gradient(135deg, ${item.a}, ${item.b})` }}
                    onClick={() => setPaintPreview(item.id)}
                  >
                    {item.id}
                  </button>
                ))}
              </div>
              <button type="button" className="rf-frame-primary" disabled={busy || paused} onClick={() => lockPaint(paintPreview)}>
                {paintPreview ? `Lock ${paintPreview} · 3 RF` : "Use default family color"}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                aria-pressed={!muted}
                onClick={() => {
                  const next = !muted;
                  setMuted(next);
                  sound.current?.setMuted(next);
                  if (!next) void sound.current?.unlock();
                }}
              >
                {muted ? "Sound off" : "Sound on"}
              </button>
              <label>
                <input type="checkbox" checked={reducedMotion} onChange={event => setReducedMotion(event.target.checked)} />
                Reduce motion
              </label>
              <p>
                Care Snacks cost 1 RF via the SDK preview client. Hats (2 RF) and Shell Paint (3 RF) are local cosmetics.
                Protocol desk actions (hardwire / promote / upgrade / buy / claim) use official price tables and a preview
                Friend bag. Live portfolio transactions cannot be signed from this sandbox. Needs decay with elapsed time.
              </p>
            </>
          )}
        </GameMenu>
      )}
    </section>
  );
}

function Meter({ label, value }: { label: string; value: number }) {
  return (
    <div className={`meter${value < 20 ? " low" : value >= 70 ? " high" : ""}`}>
      <span>{label}</span>
      <div className="meter-track" aria-hidden="true"><i style={{ width: `${Math.round(value)}%` }} /></div>
      <b>{Math.round(value)}</b>
    </div>
  );
}
