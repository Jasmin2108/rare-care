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
import { HARDWIRE_RF, PREVIEW_NETWORK_WEIGHT, PREVIEW_WETH_PER_RF, clampGen, clampTier, formatToken, formatWeight, promoteCost, reactivateCost, rewardWeight, upgradeCost } from "./protocol";
import "@rarefriends/friendsdk/frame.css";
import "./style.css";

export default function RareCare() {
  return null;
}
