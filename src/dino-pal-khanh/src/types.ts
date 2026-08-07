/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

export enum PetState {
  IDLE = "IDLE",
  HAPPY = "HAPPY",
  TIRED = "TIRED", // not used in pet display?
  HUNGRY = "HUNGRY", // not used in pet display?
  EATING = "EATING",
  SLEEPING = "SLEEPING",
  SICK = "SICK",
  SCARED = "SCARED",
  ANGRY = "ANGRY",
  INJURED = "INJURED",
}

export type AccessoryType =
  | "none"
  | "party_hat"
  | "cool_shades"
  | "cowboy_hat"
  | "top_hat"
  | "crown";

export interface ShopItem {
  id: AccessoryType;
  name: string;
  price: number;
  icon: string;
}

export interface PetStats {
  hunger: number;
  energy: number;
  cleanliness: number;
  love: number;
}

export interface PetResponses {
  feed: string[];
  play: string[];
  injured: string[];
  nightmare: string[];
  dream: string[];
  facts: string[];
  angry: string[];
  stateIdle: string[];
  stateHungry: string[];
  stateTired: string[];
  stateHappy: string[];
  stateSick: string[];
  stateScared: string[];
  finalLegacy: string;
}

export interface PetPersonality {
  traits: string[];
  likes: string[];
  dislikes: string[];
  species: string;
  name: string;
  adultTraits: string[];
  favoriteFood: string;
  favoriteActivity: string;
  nightmareDescription: string;
  responses: PetResponses;
}

export interface PetData {
  personality: PetPersonality;
  stats: PetStats;
  babyColor: string;
  babySecondaryColor: string;
  adultColor: string;
  adultSecondaryColor: string;
  stage: "BABY" | "ADOLESCENT" | "TEENAGER" | "ADULT";
  equippedAccessory?: AccessoryType;
  ownedAccessories: AccessoryType[];
  money: number;
}
