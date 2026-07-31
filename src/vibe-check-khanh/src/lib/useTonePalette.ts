/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import * as Tone from "tone";

declare global {
  interface Window {
    Tone: typeof Tone;
  }
}

interface SoundPreset {
  name: string;
  notes: string[];
  attack: number;
  decay: number;
  sustain: number;
  release: number;
  volume: number; // in decibels
}

const presets: Record<string, SoundPreset> = {
  typing: {
    name: "TYPING",
    notes: ["G2"],
    attack: 0.002,
    decay: 0.01,
    sustain: 0.2,
    release: 0.003,
    volume: -10,
  },
  new_line: {
    name: "NEW_LINE",
    notes: ["C3"],
    attack: 0.002,
    decay: 0.01,
    sustain: 0.2,
    release: 0.2,
    volume: -10,
  },
  action: {
    name: "ACTION",
    notes: ["G3"],
    attack: 0.005,
    decay: 0.05,
    sustain: 0.2,
    release: 0.5,
    volume: 0,
  },
  success: {
    name: "SUCCESS",
    notes: ["C5"],
    attack: 0.01,
    decay: 0.05,
    sustain: 0.2,
    release: 0.6,
    volume: 0,
  },
};

let synth: any = null; // Will hold our Tone.PolySynth instance.
let isInitialized = false;

export const initializeAudio = async () => {
  if (isInitialized) return;
  try {
    await Tone.start();
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "sine" },
    }).toDestination();
    isInitialized = true;

  } catch (error) {
    console.error("Failed to initialize audio:", error);
  }
};

export const playSound = (_name: string) => {
  const name = _name.toLowerCase();
  if (!isInitialized || !synth || !presets[name]) return;

  const sound = presets[name];

  // Set the volume and ADSR envelope for this specific sound
  synth.set({
    volume: sound.volume,
    envelope: {
      attack: sound.attack,
      decay: sound.decay,
      sustain: sound.sustain,
      release: sound.release,
    },
  });

  const now = Tone.now();
  synth.triggerAttack(sound.notes, now);
  // The release is triggered after the attack and decay phases complete.
  // This allows the envelope to shape the sound without an arbitrary hold duration.
  synth.triggerRelease(sound.notes, now + sound.attack + sound.decay);
};
