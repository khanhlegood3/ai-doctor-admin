/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

// Chuyển thể từ dino-pal.zip (app AI Studio "Dino pal") — cùng mô hình app
// con Vite multi-page riêng (xem vite.config.js) nhúng qua iframe cùng-origin
// như dino-jump-khanh, vision-sync-khanh, ... Đây là phiên bản "nuôi thú ảo"
// (tamagotchi) của chú khủng long Chrome Dino — cặp đôi thân thiện với
// tính năng Dino Jump: chải lông, cho ăn, chơi cùng và chăm sóc để kiếm
// tiền trong game, mua đồ ở shop và nuôi lớn tới cấp cao nhất trước khi
// "trưởng thành". Toàn bộ chạy client-side, chỉ 1 lệnh gọi AI DUY NHẤT lúc
// "nhận nuôi" (Adopt) để sinh tính cách/thoại ngẫu nhiên cho thú — lệnh gọi
// này đã được đổi từ @google/genai (Gemini trực tiếp, cần API key lộ ở
// client) sang dùng chung endpoint /api/groq-proxy (provider: 'dino-pal',
// chạy Groq miễn phí) — xem services/geminiService.ts và
// api/_lib/dinoPalProxy.js.
import React, { useState, useEffect, useCallback, useRef } from "react";
import { PetData, PetState, PetStats, AccessoryType, ShopItem } from "./types";
import { generateChromeDino } from "./services/geminiService";
import PetDisplay from "./components/PetDisplay";
import StatBar from "./components/StatBar";
import ActionsPanel from "./components/ActionsPanel";
import InfoDialog from './components/builds/infoDialog'
import { getPath } from "./utils/path";
// 3 ảnh trang trí gốc (hidden-game-dinosoar-left.png, hidden-build-dino-
// right.png, hidden-build-bg.png) trên host gstatic.com/aistudio của
// dino-pal.zip đã 404 VĨNH VIỄN (đã kiểm chứng — không phải do rate-limit
// hay chặn tạm) → tự host lại bằng SVG riêng (xem src/assets/), không còn
// phụ thuộc host ngoài.
import dinoDecorationLeft from "./assets/dino-decoration-left.svg";
import dinoDecorationRight from "./assets/dino-decoration-right.svg";
import petCardBg from "./assets/pet-card-bg.svg";

// Audio imports
import useAudio from "./hooks/useAudio";
import FooterLeftContent from "./components/FooterLeftContent";

const SHOP_ITEMS: ShopItem[] = [
  { id: "party_hat", name: "Party hat", price: 100, icon: "party-hat" },
  { id: "cool_shades", name: "Cool Shades", price: 250, icon: "cool-shades" },
  { id: "cowboy_hat", name: "Cowboy hat", price: 500, icon: "cowboy-hat" },
  { id: "top_hat", name: "Top hat", price: 1000, icon: "top-hat" },
  { id: "crown", name: "Royal crown", price: 2500, icon: "royal-crown" },
];

const GOOGLE_COLORS = [
  { hex: "#FFF", name: "White", textColor: "#000" },
  { hex: "#1A73E8", name: "Blue", textColor: "#fff" },
  { hex: "#34A853", name: "Green", textColor: "#fff" },
  { hex: "#FBBC04", name: "Yellow", textColor: "#000" },
  { hex: "#EA4335", name: "Red", textColor: "#fff" },
];

/**
 * Calculates XP multiplier based on a "bell curve" of the current stat value.
 * - 40-60 (Ideal): 3x points
 * - 20-39 or 61-80 (Good): 2x points
 * - 0-19 or 81-100 (Standard): 1x points
 */
const calculateXpMultiplier = (value: number): number => {
  if (value >= 40 && value <= 60) return 3;
  if ((value >= 20 && value < 40) || (value > 60 && value <= 80)) return 2;
  return 1;
};

const DEBUG_SKIP_START = false;

const MOCK_PET: PetData = {
  personality: {
    traits: ["Pixelated", "Curious", "Glitchy"],
    likes: ["Wifi", "Chrome"],
    dislikes: ["Offline Mode", "Lag"],
    species: "T-Rex",
    name: "DebugDino",
    adultTraits: ["Cybernetic", "High-Bandwidth", "Legendary"],
    favoriteFood: "Cookies",
    favoriteActivity: "Running",
    nightmareDescription: "The connection timed out...",
    responses: {
      feed: ["Nom nom nom!", "Bytes received!"],
      play: ["Zooming at 100mbps!", "Loading fun..."],
      injured: ["404 Health Not Found", "Lag spike!"],
      nightmare: ["No signal...", "Buffering..."],
      dream: ["Dreaming of fiber optics...", "Uploading dreams..."],
      facts: ["Did you know I can run offline?", "I love spacebar!"],
      angry: ["Connection reset!", "Ping too high!"],
      stateIdle: ["Searching for network and waiting for network and searching for network..."],
      stateHungry: ["Download speed dropping...", "Need energy bytes!"],
      stateTired: ["Low battery...", "Sleep mode imminent..."],
      stateHappy: ["Optimal performance!", "Ping is low!"],
      stateSick: ["Virus detected...", "Need antivirus..."],
      stateScared: ["Firewall breached!", "Who goes there?"],
      finalLegacy: "The server uptime was legendary.",
    },
  },
  stats: {
    hunger: 10,
    energy: 80, // Start with full energy
    cleanliness: 100,
    love: 50,
  },
  babyColor: "#EA4335",
  babySecondaryColor: "#9aa0a6",
  adultColor: "#535353",
  adultSecondaryColor: "#9aa0a6",
  stage: "BABY",
  ownedAccessories: [],
  money: 3000,
};

const App: React.FC = () => {
  const [pet, setPet] = useState<PetData | null>(DEBUG_SKIP_START ? MOCK_PET : null);
  const [name, setName] = useState("");
  const [selectedColor, setSelectedColor] = useState(GOOGLE_COLORS[0].hex);
  const [selectedTextColor, setSelectedTextColor] = useState(GOOGLE_COLORS[0].textColor);
  const [experience, setExperience] = useState(0);
  const [xpPopups, setXpPopups] = useState<{ id: number; amount: number; multiplier: number }[]>([]);
  const [loading, setLoading] = useState(false);
  const [dialogue, setDialogue] = useState("Brush, feed, play and care for your dino to earn experience points. Raise your dino to the highest level you can before it grows up.");
  const [currentState, setCurrentState] = useState<PetState>(PetState.IDLE);
  const [isAwake, setIsAwake] = useState(true);
  const [hasPoop, setHasPoop] = useState(false);
  const [daysPassed, setDaysPassed] = useState(0);
  const [currentLevel, setCurrentLevel] = useState(1);
  const [showLevelUp, setShowLevelUp] = useState(false);
  const [isGameOver, setIsGameOver] = useState(false);
  const [finalNarration, setFinalNarration] = useState<string | null>(null);
  const [showShop, setShowShop] = useState(false);
  const [money, setMoney] = useState(0);
  const [ownedAccessories, setOwnedAccessories] = useState<AccessoryType[]>([]);
  const [equippedAccessory, setEquippedAccessory] = useState<AccessoryType | undefined>();
  const shopRef = useRef<HTMLDialogElement>(null);

  // Cooldown states
  const [activeCooldowns, setActiveCooldowns] = useState<Record<string, boolean>>({});

  const statsRef = useRef<PetStats>({ hunger: 50, energy: 80, cleanliness: 100, love: 50 });
  const [displayStats, setDisplayStats] = useState<PetStats>(statsRef.current);

  const { playForeground, preloadCache } = useAudio();

  const [loadingText, setLoadingText] = useState("Growing...");
  const [slideStyle, setSlideStyle] = useState("translate-y-0 opacity-100");
  const [isMoneyBouncing, setIsMoneyBouncing] = useState(false);
  const prevMoneyRef = useRef(money);

  const playAgain = () => {
    setPet(null);
    setName("");
    setSelectedColor(GOOGLE_COLORS[0].hex);
    setSelectedTextColor(GOOGLE_COLORS[0].textColor);
    setExperience(0);
    setXpPopups([]);
    setLoading(false);
    setDialogue("Brush, feed, play and care for your dino to earn experience points. Raise your dino to the highest level you can before it grows up.");
    setCurrentState(PetState.IDLE);
    setIsAwake(true);
    setHasPoop(false);
    setDaysPassed(0);
    setCurrentLevel(1);
    setShowLevelUp(false);
    setIsGameOver(false);
    setFinalNarration(null);
    setShowShop(false);
    setMoney(0);
    setOwnedAccessories([]);
    setEquippedAccessory(undefined);
    setActiveCooldowns({});
    statsRef.current = { hunger: 50, energy: 80, cleanliness: 100, love: 50 };
    setDisplayStats(statsRef.current);
    setLoadingText("Growing...");
    setSlideStyle("translate-y-0 opacity-100");
    setIsMoneyBouncing(false);
  };

  useEffect(() => {
    let timeouts: ReturnType<typeof setTimeout>[] = [];

    const clearAllTimeouts = () => timeouts.forEach(clearTimeout);

    if (loading) {
      setLoadingText("Growing...");
      setSlideStyle("translate-y-full opacity-0 transition-none");

      // Slide in
      timeouts.push(setTimeout(() => {
        setSlideStyle("translate-y-0 opacity-100 transition-all duration-500");
      }, 50));

      // Slide out
      timeouts.push(setTimeout(() => {
        setSlideStyle("-translate-y-full opacity-0 transition-all duration-500");
      }, 1500));


      // Step 2: Hatching... (Start at 2000ms)
      timeouts.push(setTimeout(() => {
        setLoadingText("Hatching...");
        setSlideStyle("translate-y-full opacity-0 transition-none");
      }, 2000));

      timeouts.push(setTimeout(() => {
        setSlideStyle("translate-y-0 opacity-100 transition-all duration-500");
      }, 2050));

      timeouts.push(setTimeout(() => {
        setSlideStyle("-translate-y-full opacity-0 transition-all duration-500");
      }, 3500));


      // Step 3: Almost there... (Start at 4000ms)
      timeouts.push(setTimeout(() => {
        setLoadingText("Almost there...");
        setSlideStyle("translate-y-full opacity-0 transition-none");
      }, 4000));

      timeouts.push(setTimeout(() => {
        setSlideStyle("translate-y-0 opacity-100 transition-all duration-500");
      }, 4050));
    } else {
      setLoadingText("Growing...");
      setSlideStyle("translate-y-0 opacity-100");
    }

    return clearAllTimeouts;
  }, [loading]);

  const audioFiles = [
    getPath("/media/audio/sfx/pixelpal/buttonclick.mp3"),
    getPath("/media/audio/sfx/pixelpal/growup.mp3"),
    getPath("/media/audio/sfx/pixelpal/playFeed.mp3"),
    // getPath("/media/audio/sfx/pixelpal/playPet_with_dino_sound.mp3"), This one is weird
    getPath("/media/audio/sfx/pixelpal/poop.mp3"),
    getPath("/media/audio/sfx/pixelpal/cleanup.mp3"),
    getPath("/media/audio/sfx/pixelpal/levelup.mp3"),
    getPath("/media/audio/sfx/pixelpal/playHurt.mp3"),
    getPath("/media/audio/sfx/pixelpal/playPet_without_dino_sound.mp3"),
    getPath("/media/audio/sfx/pixelpal/wakeup.mp3"),
    getPath("/media/audio/sfx/pixelpal/fallasleep.mp3"),
    getPath("/media/audio/sfx/pixelpal/playBrush.mp3"),
    // getPath("/media/audio/sfx/pixelpal/playJump.mp3"), not an action
    getPath("/media/audio/sfx/pixelpal/playPurchase.mp3"),
    getPath("/media/audio/sfx/pixelpal/tiredDino.mp3"),
  ];

  useEffect(() => {
    preloadCache(audioFiles);
  }, []);

  const EVOLUTION_GOAL = 10;
  const TOTAL_SECONDS_TO_EVOLVE = 120;
  const DAYS_PER_SECOND = EVOLUTION_GOAL / TOTAL_SECONDS_TO_EVOLVE;

  /**
   * Growth scale calculation based on level milestones:
   * Level 1-5: Tiny (1/4 of max size) -> 0.325
   * Level 6-10: Growing Adult -> 0.8
   * Level 11+: Full Grown Legacy -> 1.3
   */
  const getGrowthScale = () => {
    if (currentLevel <= 5) return 0.325;
    if (currentLevel <= 10) return 0.8;
    return 0.9; // TODO: Play with this value
  };
  const currentScale = getGrowthScale();

  useEffect(() => {
    const dialog = shopRef.current;
    if(!dialog)return;
    if(showShop) {
      dialog.showModal();
    } else {
      dialog.close();
    }
  }, [showShop])

  const showXpPopup = (amount: number, multiplier: number) => {
    const id = Date.now() + Math.random();
    setXpPopups(prev => [...prev, { id, amount, multiplier }]);
    setTimeout(() => {
      setXpPopups(prev => prev.filter(p => p.id !== id));
    }, 1000);
  };

  const addExperience = (amount: number) => {
    setExperience(prevXp => {
      const newXp = prevXp + Math.floor(amount);
      const oldLevel = Math.floor(prevXp / 100) + 1;
      const newLevel = Math.floor(newXp / 100) + 1;

      if (newLevel > oldLevel) {
        setCurrentLevel(newLevel);
        setShowLevelUp(true);

        playForeground(getPath("/media/audio/sfx/pixelpal/levelup.mp3"));

        setTimeout(() => {
          setShowLevelUp(false);
        }, 1400);
        setMoney(m => m + 200);
        // audio.playLevelUp();
      }
      return newXp;
    });
  };

  const triggerCooldown = (action: string, duration: number) => {
    setActiveCooldowns(prev => ({ ...prev, [action]: true }));
    setTimeout(() => {
      setActiveCooldowns(prev => ({ ...prev, [action]: false }));
    }, duration);
  };

  const updateDialogue = useCallback(
    (action?: string) => {
      if (!pet || isGameOver) return;
      const res = pet.personality.responses;
      let list: string[] = [];

      switch (action) {
        case "Feed":
          list = res.feed;
          break;
        case "Play":
          list = res.play;
          break;
        case "Injured":
          list = res.injured;
          break;
        case "Nightmare":
          list = res.nightmare;
          break;
        case "Dream":
          list = res.dream;
          break;
        case "Fact":
          list = res.facts;
          break;
        case "Angry":
          list = res.angry;
          break;
        case "StateChange":
          if (currentState === PetState.HUNGRY) list = res.stateHungry;
          else if (currentState === PetState.TIRED) list = res.stateTired;
          else if (currentState === PetState.HAPPY) list = res.stateHappy;
          else if (currentState === PetState.SICK) list = res.stateSick;
          else if (currentState === PetState.SCARED) list = res.stateScared;
          else list = res.stateIdle;
          break;
        default:
          list = res.stateIdle;
      }

      if (list && list.length > 0) {
        const randomMsg = list[Math.floor(Math.random() * list.length)];
        setDialogue(randomMsg);
      }
    },
    [pet, currentState, isGameOver]
  );



  useEffect(() => {
    if (
      pet &&
      !isGameOver &&
      currentState !== PetState.SLEEPING &&
      currentState !== PetState.EATING
    ) {
      updateDialogue("StateChange");
    }
  }, [currentState, pet, isGameOver, updateDialogue]);

  const handleStart = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    try {
      const newPet = await generateChromeDino(name, selectedColor);
      setPet(newPet);
      statsRef.current = newPet.stats;
      setDisplayStats(newPet.stats);
      setDialogue(`*Rawr!* My name is ${newPet.personality.name}!`);
      // audio.playWake();
    } catch (err) {
      setDialogue("No internet connection... try again?");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!pet || isGameOver) return;

    const dayInterval = setInterval(() => {
      setDaysPassed(prev => {
        const next = prev + DAYS_PER_SECOND;

        if (next >= 5 && pet.stage === "BABY") {
          setPet(current => (current ? { ...current, stage: "ADULT" } : null));
          setDialogue("I evolved into my true Rainbow form!");
          playForeground(getPath("/media/audio/sfx/pixelpal/growup.mp3"));
          // audio.playEvolution();
        }
        if (next >= EVOLUTION_GOAL) {
          setIsGameOver(true);
          setFinalNarration(pet.personality.responses.finalLegacy);
          clearInterval(dayInterval);
        }
        return next;
      });
    }, 1000);

    const interval = setInterval(() => {
      const newStats = { ...statsRef.current };
      const isAdult = pet.stage === "ADULT";
      const decayMultiplier = isAdult ? 1.0 : 0.5;

      if (isAwake) {
        newStats.hunger = Math.min(100, newStats.hunger + (1.5 * decayMultiplier));
        newStats.energy = Math.max(0, newStats.energy - (0.5 * decayMultiplier));
        newStats.love = Math.max(0, newStats.love - (0.8 * decayMultiplier));
        newStats.cleanliness = Math.max(0, newStats.cleanliness - (0.8 * decayMultiplier));

        if (!hasPoop && Math.random() < 0.025) setHasPoop(true);

        if (newStats.hunger > 80) newStats.love = Math.max(0, newStats.love - 0.5);
        // if (newStats.energy < 15) newStats.cleanliness = Math.max(0, newStats.cleanliness - 1.0);
        if (hasPoop) {
          newStats.cleanliness = Math.max(0, newStats.cleanliness - 1.5);
          newStats.love = Math.max(0, newStats.love - 0.1);
        }

        if (
          currentState !== PetState.SCARED &&
          currentState !== PetState.ANGRY &&
          currentState !== PetState.INJURED
        ) {
          if (newStats.hunger > 85) setCurrentState(PetState.HUNGRY);
          else if (newStats.energy < 30) setCurrentState(PetState.TIRED);
          else if (newStats.cleanliness < 40) setCurrentState(PetState.SICK);
          else if (currentState !== PetState.EATING) setCurrentState(PetState.IDLE);
        }
      } else {
        newStats.energy = Math.min(100, newStats.energy + 10.0);

        if (newStats.energy >= 100) {
          setIsAwake(true);
          setCurrentState(PetState.IDLE);
          playForeground(getPath("/media/audio/sfx/pixelpal/wakeup.mp3"));
          // audio.playWake();
          setDialogue("Fully charged! Ready to run!");
        }

        if (newStats.hunger > 50 && Math.random() < 0.03) {
          setCurrentState(PetState.SCARED);
          setIsAwake(true);
          playForeground(getPath("/media/audio/sfx/pixelpal/playHurt.mp3"));
          // audio.playHurt();
          updateDialogue("Nightmare");
        }
      }

      statsRef.current = newStats;
      setDisplayStats({ ...newStats });
    }, 300);

    return () => {
      clearInterval(interval);
      clearInterval(dayInterval);
    };
  }, [pet, isAwake, hasPoop, currentState, isGameOver, DAYS_PER_SECOND, updateDialogue]);

  useEffect(() => {
    if (hasPoop) {
      playForeground(getPath("/media/audio/sfx/pixelpal/poop.mp3"));
    }
  }, [hasPoop]);

  useEffect(() => {
    if (money > prevMoneyRef.current) {
      setIsMoneyBouncing(true);
      const timer = setTimeout(() => setIsMoneyBouncing(false), 600);
      return () => clearTimeout(timer);
    }
    prevMoneyRef.current = money;
  }, [money]);

  const feed = () => {
    if (!pet || !isAwake || isGameOver || activeCooldowns["feed"]) return;

    // Calculate XP based on current hunger before modifying it
    const multiplier = calculateXpMultiplier(statsRef.current.hunger);
    const baseXp = 15;
    const finalXp = baseXp * multiplier;

    triggerCooldown("feed", 5000);
    setCurrentState(PetState.EATING);
    playForeground(getPath("/media/audio/sfx/pixelpal/buttonclick.mp3"));
    setTimeout(() => {
      playForeground(getPath("/media/audio/sfx/pixelpal/playFeed.mp3"));
    }, 100);
    // audio.playFeed();
    updateDialogue("Feed");

    // Apply varied XP & Show Popup
    addExperience(finalXp);
    showXpPopup(finalXp, multiplier);

    setTimeout(() => {
      statsRef.current.hunger = Math.max(0, statsRef.current.hunger - 35);
      statsRef.current.love = Math.min(100, statsRef.current.love + 5);
      statsRef.current.cleanliness = Math.max(0, statsRef.current.cleanliness - 5);
      setDisplayStats({ ...statsRef.current });
      setCurrentState(PetState.HAPPY);
    }, 1000);
  };

  const play = () => {
    if (!pet || !isAwake || isGameOver || activeCooldowns["play"]) return;

    playForeground(getPath("/media/audio/sfx/pixelpal/buttonclick.mp3"));
    if (statsRef.current.energy < 25) {
      setDialogue("*Yawn* Too tired for running...");
      setTimeout(() => {
        playForeground(getPath("/media/audio/sfx/pixelpal/tiredDino.mp3"));
      }, 100)
      return;
    }

    // Calculate XP based on current energy
    const multiplier = calculateXpMultiplier(statsRef.current.energy);
    const baseXp = 20;
    const finalXp = baseXp * multiplier;

    playForeground(getPath("/media/audio/sfx/pixelpal/playPet_without_dino_sound.mp3"));
    triggerCooldown("play", 7000);

    // Apply varied XP
    addExperience(finalXp);
    showXpPopup(finalXp, multiplier);

    if (Math.random() < 0.15) {
      setCurrentState(PetState.INJURED);
      statsRef.current.cleanliness = Math.max(0, statsRef.current.cleanliness - 15);
      playForeground(getPath("/media/audio/sfx/pixelpal/playHurt.mp3"));
      // audio.playHurt();
      updateDialogue("Injured");
    } else {
      setCurrentState(PetState.HAPPY);
      updateDialogue("Play");
    }

    statsRef.current.love = Math.min(100, statsRef.current.love + 15);
    statsRef.current.energy = Math.max(0, statsRef.current.energy - 25);
    statsRef.current.cleanliness = Math.max(0, statsRef.current.cleanliness - 10);
    setDisplayStats({ ...statsRef.current });
  };

  const toggleSleep = () => {
    playForeground(getPath("/media/audio/sfx/pixelpal/buttonclick.mp3"));
    if (!pet || isGameOver || activeCooldowns["sleep"]) return;
    triggerCooldown("sleep", 10000);
    if (isAwake) {
      setIsAwake(false);
      setCurrentState(PetState.SLEEPING);
      setTimeout(() => {
        playForeground(getPath("/media/audio/sfx/pixelpal/fallasleep.mp3"));
      }, 100);
      // audio.playSleep();
      updateDialogue("Dream");
    } else {
      setIsAwake(true);
      setCurrentState(PetState.IDLE);
      playForeground(getPath("/media/audio/sfx/pixelpal/buttonclick.mp3"));
      setTimeout(() => {
        playForeground(getPath("/media/audio/sfx/pixelpal/playWake.mp3"));
      }, 100);
      // audio.playWake();
      setDialogue("System Reboot Complete!");
    }
  };

  const petPet = () => {
    if (!pet || !isAwake || isGameOver || activeCooldowns["pet"]) return;
    if (currentState === PetState.SCARED) {
      setCurrentState(PetState.IDLE);
      playForeground(getPath("/media/audio/sfx/pixelpal/buttonclick.mp3"));
      setTimeout(() => {
        playForeground(getPath("/media/audio/sfx/pixelpal/playWake.mp3"));
      }, 100);
      // audio.playWake();
      setDialogue("Phew... thought I saw a giant bird.");
      return;
    }

    // Calculate XP based on current love level
    const multiplier = calculateXpMultiplier(statsRef.current.love);
    const baseXp = 10;
    const finalXp = baseXp * multiplier;

    triggerCooldown("pet", 3000);
    playForeground(getPath("/media/audio/sfx/pixelpal/buttonclick.mp3"));
    setTimeout(() => {
      playForeground(getPath("/media/audio/sfx/pixelpal/playPet_without_dino_sound.mp3"));
    }, 100);
    // audio.playPet();

    // Apply varied XP
    addExperience(finalXp);
    showXpPopup(finalXp, multiplier);

    setCurrentState(PetState.HAPPY);
    setDialogue(`*Happy Dino sounds*`);
    statsRef.current.love = Math.min(100, statsRef.current.love + 10);
    statsRef.current.energy = Math.max(0, statsRef.current.energy - 10);
    setDisplayStats({ ...statsRef.current });
  };

  const brush = () => {
    if (!pet || !isAwake || isGameOver || activeCooldowns["brush"]) return;

    // Calculate XP based on current cleanliness
    const multiplier = calculateXpMultiplier(statsRef.current.cleanliness);
    const baseXp = 15;
    const finalXp = baseXp * multiplier;

    triggerCooldown("brush", 4000);
    playForeground(getPath("/media/audio/sfx/pixelpal/buttonclick.mp3"));
    setTimeout(() => {
      playForeground(getPath("/media/audio/sfx/pixelpal/playBrush.mp3"));
    }, 100);
    // audio.playBrush();
    setDialogue("Gotta keep those pixels shiny!");

    // Apply varied XP & Show Popup
    addExperience(finalXp);
    showXpPopup(finalXp, multiplier);

    statsRef.current.cleanliness = Math.min(100, statsRef.current.cleanliness + 20);
    statsRef.current.love = Math.min(100, statsRef.current.love + 2);
    setDisplayStats({ ...statsRef.current });
  };

  const cleanPen = () => {
    if (hasPoop && !activeCooldowns["clean"]) {
      triggerCooldown("clean", 2000);
      playForeground(getPath("/media/audio/sfx/pixelpal/buttonclick.mp3"));
      setTimeout(() => {
        playForeground(getPath("/media/audio/sfx/pixelpal/cleanup.mp3"));
      }, 100);
      // audio.playClean();
      setHasPoop(false);
      setDialogue("Pen cleaned and pet is fresh!");
      statsRef.current.cleanliness = Math.min(100, statsRef.current.cleanliness + 35);
      statsRef.current.love = Math.min(100, statsRef.current.love + 5);
      setDisplayStats({ ...statsRef.current });
      if (currentState === PetState.IDLE) setCurrentState(PetState.HAPPY);
    }
  };

  const bandage = () => {
    if (currentState === PetState.INJURED && !activeCooldowns["bandage"]) {
      triggerCooldown("bandage", 3000);
      playForeground(getPath("/media/audio/sfx/pixelpal/buttonclick.mp3"));
      setTimeout(() => {
        playForeground(getPath("/media/audio/sfx/pixelpal/cleanup.mp3"));
      }, 100);
      // audio.playClean();
      setCurrentState(PetState.IDLE);
      statsRef.current.cleanliness = Math.min(100, statsRef.current.cleanliness + 10);
      setDisplayStats({ ...statsRef.current });
      setDialogue("Patch applied! Ready to run.");
    }
  };

  const buyItem = (item: ShopItem) => {
    if (money >= item.price && !ownedAccessories.includes(item.id)) {
      setMoney(m => m - item.price);
      setOwnedAccessories(prev => [...prev, item.id]);
      setEquippedAccessory(item.id);
      playForeground(getPath("/media/audio/sfx/pixelpal/buttonclick.mp3"));
      setTimeout(() => {
        playForeground(getPath("/media/audio/sfx/pixelpal/playPurchase.mp3"));
      }, 100);
      // audio.playPurchase();
    }
  };

  const equipItem = (id: AccessoryType) => {
    if (equippedAccessory === id) {
      setEquippedAccessory(undefined);
    } else {
      setEquippedAccessory(id);
      playForeground(getPath("/media/audio/sfx/pixelpal/buttonclick.mp3"));
      // audio.playEquip();
    }
  };

  const winModal = (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/1 backdrop-blur-2xl animate-in fade-in duration-300 animate-[fadeIn_0.3s_ease-out]">
      <div className="bg-black px-[55px] lg:px-[40px] py-[50px] gap-[40px] rounded-3xl shadow-2xl flex flex-col items-center mx-[55px] rainbow-border w-full max-w-[430px] text-center">
        <h2 className="text-[48px] font-medium text-white tracking-[-1.2px] leading-[1.1]">You won!</h2>
        <div className="flex flex-col gap-[22px]">
          <button 
            onClick={() => {
              playAgain();
            }}
            className="bg-white py-[12px] text-[18px] leading-[1.6] tracking-[-0.36px] text-black rounded-full font-medium white-button h-[64px] px-[55px] md:px-[89px]"
          >
            Retry
          </button>
        </div>
      </div>
    </div>
    )

  if (!pet) {
    return (
      <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-black font-sans font-medium text-white">
        <InfoDialog title="Raise a baby Chrome Dino" goal="Brush, feed, play and care for your Dino to earn in game currency. Redeem it in the shop and raise your Dino to the highest level you can before it grows up." onClose={() => {}} />
        <style>{`
          @keyframes wave {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-5px); }
          }
        `}</style>
          {/* Background decoration */}
        <div className="fixed top-[586px] left-10 -translate-y-106 -translate-x-1/2 pointer-events-none z-0 hidden xl:block">
          <img src={dinoDecorationLeft} />
        </div>
        <div className="fixed bottom-[0px] max-w-90 -left-[340px] translate-y-60 -translate-x-50 pointer-events-none z-0 xl:hidden" style={{width: '410px', left: '-220px'}}>
          <img src={dinoDecorationLeft} />
        </div>
        <div className="flex flex-col items-center text-center w-full">
          {/* Dino Icon */}


          {/* Headings */}
          <h1 className="text-[42px] sm:text-[54px] md:text-[116px] mb-4 mt-0 md:mt-20 md:mt-12 lg:mt-38 tracking-[-0.5px] leading-none z-10">
            <p>Raise a baby</p>
            <p>Chrome dino</p>
          </h1>
          <div className="text-[16px] md:text-[20px] mb-4 md:mb-12 tracking-[-0.36px] z-10">
            Brush, feed, play and care for your dino to earn in game currency. <br className="hidden md:block" />
            Redeem it in the shop and raise your Dino to the<br className="hidden md:block" /> highest level you can before it grows up.
          </div>

          {/* Form */}
          <form onSubmit={handleStart} className="w-full space-y-8 z-10">
            <div className="w-full space-y-2 flex justify-center flex-col md:flex-row md:gap-6">
              {/* Name Input */}
              <div className="space-y-3 text-left">
                <label className="text-sm text-neutral-400 pl-4 block min-w-80" htmlFor="DinoName">
                  Name your dino
                </label>
                <input
                  type="text"
                  value={name}
                  id="DinoName"
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Name..."
                  className="w-full bg-[#202124]  text-white px-8 py-4 rounded-full border-none font-medium focus:outline-none focus:ring-2 focus:ring-white/20 transition-all placeholder:text-white"
                  disabled={loading}
                  maxLength={20}
                />
              </div>

              {/* Color Picker */}
              <div className="space-y-3 text-left" style={{marginTop: '0'}}>
                <label className="text-sm font-medium text-neutral-400 pl-4 block">
                  Choose a color
                </label>
                <div className="flex justify-between items-center bg-[#202124] px-8 py-3 rounded-full md:gap-6">
                  {GOOGLE_COLORS.map((color) => (
                    <button
                      key={color.hex}
                      type="button"
                      onClick={() => {
                        setSelectedColor(color.hex);
                        setSelectedTextColor(color.textColor);
                      }}
                      className={`w-8 h-8 rounded-full transition-all flex items-center justify-center ${
                        selectedColor === color.hex
                          ? "outline-white outline-2 outline-offset-4"
                          : "opacity-80 hover:opacity-100 hover:scale-105"
                      }`}
                      style={{ backgroundColor: color.hex }}
                      title={color.name}
                    >
                    </button>
                  ))}
                </div>
              </div>
            </div>
            {/* Submit Button */}
            <div className="pt-0">
              <button
                type="submit"
                disabled={loading || !name.trim()}
                className={`mt-0 w-[220px] h-[70px] mx-auto py-4 rounded-full text-base font-medium transition-all hover:cursor-pointer ${
                  loading || !name.trim()
                    ? "bg-neutral-800 text-neutral-500 cursor-not-allowed"
                    : `text-white hover:brightness-110 active:scale-95`
                }`}
                style={
                  loading || !name.trim()
                    ? {}
                    : {
                        background: selectedColor,
                        color: selectedTextColor,
                      }
                }
              >
                {loading ? (
                  <div className="h-full flex items-center justify-center w-full">
                    <span
                      key={loadingText}
                      className={`flex items-center justify-center cursor-wait ${slideStyle}`}
                    >
                      {loadingText.split('').map((char, index) => (
                        <span
                          key={index}
                          style={{
                            color: '#9BA0A6',
                            display: 'inline-block',
                            animation: `wave 1.3s ease-in-out infinite`,
                            animationDelay: `${index * 0.1}s`,
                          }}
                        >
                          {char === ' ' ? '\u00A0' : char}
                        </span>
                      ))}
                    </span>
                  </div>
                ) : (
                  "Adopt"
                )}
              </button>
            </div>
          </form>
        </div>
        <div className="h-full w-full flex flex-col items-center justify-center p-6 bg-black font-sans font-medium text-white">
          {/* Background decoration */}
          <div className="fixed top-[588px] -right-8 -translate-y-52 translate-x-1/2 pointer-events-none z-0 hidden xl:block">
            <img src={dinoDecorationRight} />
          </div>
          <div className="fixed max-w-42 bottom-[180px] right-0 translate-y-60 translate-x-1/2 pointer-events-none z-0 xl:hidden" style={{ width: '180px'}}>
            <img src={dinoDecorationRight} />
          </div>
        </div>
      </div>
    );
  }

  const rawTraits = pet.stage === "BABY" ? pet.personality.traits : pet.personality.adultTraits;
  // Ensure exactly 3 traits
  const currentTraits = [...rawTraits, "Dino", "Pixel", "Cool"].slice(0, 3);
  const currentColor = pet.stage === "BABY" ? pet.babyColor : pet.babyColor; // always use baby color
  const currentSecondary = pet.stage === "BABY" ? pet.babySecondaryColor : pet.adultSecondaryColor;

  // Milestone Progress calculation for UI
  const getGrowthProgress = () => {
    if (currentLevel <= 5) {
      return { label: "Baby to adult", percent: (daysPassed / 5) * 100 };
    } else if (currentLevel <= 10) {
      return { label: "Adult to legend", percent: ((daysPassed - 5) / 5) * 100 };
    } else {
      return { label: "Legacy achieved", percent: 100 };
    }
  };
  const growthProgress = getGrowthProgress();

  return (
    <div className="flex flex-col items-center bg-black w-full font-sans font-medium relative mb-2 lg:mb-0 lg:h-full justify-center">
      <style>{`
        @keyframes bounce {
          0% { transform: translateY(0); }
          25% { transform: translateY(-6px); }
          50% { transform: translateY(0); }
          75% { transform: translateY(-3px); }
          100% { transform: translateY(0); }
        }
        .bounce {
          animation: bounce 600ms cubic-bezier(0.18, 0.89, 0.32, 1.28);
        }

        @keyframes flash {
          0% { background-color: #333; }
          50% { background-color: #555; }
          100% { background-color: #333; }
        }
        .flash-bg {
          animation: flash 600ms ease-in-out;
        }

        @keyframes floatUpFade {
          0% { opacity: 0; transform: translateY(20px) scale(0.8); }
          20% { opacity: 1; transform: translateY(0) scale(1.1); }
          40% { transform: translateY(0) scale(1); }
          80% { opacity: 1; transform: translateY(-20px); }
          100% { opacity: 0; transform: translateY(-40px); }
        }
        .xp-popup {
          animation: floatUpFade 1s ease-out forwards;
        }
        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        .game-over-fade {
          animation: fadeIn 300ms ease-out forwards;
        }
      `}</style>

      { isGameOver && winModal }
      {/* Boutique Modal */}
      {showShop && (
        <dialog className="fixed inset-0 z-[100] flex items-center m-auto bg-transparent justify-center backdrop:backdrop-blur-sm p-4 animate-in fade-in duration-300"
          ref={shopRef}
          role="dialog"
          aria-modal="true"
        >
          <div className="relative p-[2px] rounded-[32px] bg-gradient-to-tr from-[#4285F4] via-[#34A853] to-[#FBBC04] shadow-2xl animate-in zoom-in-95 duration-300 w-full max-w-2xl">
            <div className="bg-black rounded-[30px] w-full overflow-hidden flex flex-col max-h-[80vh]">

              {/* Header */}
              <div className="px-8 py-6 flex justify-between items-center shrink-0">
                <h2 className="text-2xl font-medium tracking-tight text-white">Pixel Boutique</h2>
                <div className="flex items-center gap-4">
                  <div className="bg-[#262626] px-4 py-2 rounded-full flex items-center gap-2 border border-white/10 ml-3">
                    <span className="text-white/60 text-sm">
                      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                        <mask id="mask0_7763_12616" style={{maskType: 'alpha'}} maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="20">
                          <rect width="20" height="20" fill="#D9D9D9"/>
                        </mask>
                        <g mask="url(#mask0_7763_12616)">
                          <path d="M4.16667 18.3333C3.70833 18.3333 3.31597 18.1701 2.98958 17.8437C2.66319 17.5173 2.5 17.1249 2.5 16.6666V6.66658C2.5 6.20825 2.66319 5.81589 2.98958 5.4895C3.31597 5.16311 3.70833 4.99992 4.16667 4.99992H5.83333C5.83333 3.84714 6.23958 2.8645 7.05208 2.052C7.86458 1.2395 8.84722 0.833252 10 0.833252C11.1528 0.833252 12.1354 1.2395 12.9479 2.052C13.7604 2.8645 14.1667 3.84714 14.1667 4.99992H15.8333C16.2917 4.99992 16.684 5.16311 17.0104 5.4895C17.3368 5.81589 17.5 6.20825 17.5 6.66658V16.6666C17.5 17.1249 17.3368 17.5173 17.0104 17.8437C16.684 18.1701 16.2917 18.3333 15.8333 18.3333H4.16667ZM12.9479 10.4478C13.7604 9.63533 14.1667 8.6527 14.1667 7.49992H12.5C12.5 8.19436 12.2569 8.78464 11.7708 9.27075C11.2847 9.75686 10.6944 9.99992 10 9.99992C9.30556 9.99992 8.71528 9.75686 8.22917 9.27075C7.74306 8.78464 7.5 8.19436 7.5 7.49992H5.83333C5.83333 8.6527 6.23958 9.63533 7.05208 10.4478C7.86458 11.2603 8.84722 11.6666 10 11.6666C11.1528 11.6666 12.1354 11.2603 12.9479 10.4478ZM7.5 4.99992H12.5C12.5 4.30547 12.2569 3.7152 11.7708 3.22909C11.2847 2.74297 10.6944 2.49992 10 2.49992C9.30556 2.49992 8.71528 2.74297 8.22917 3.22909C7.74306 3.7152 7.5 4.30547 7.5 4.99992Z" fill="white"/>
                        </g>
                      </svg>
                    </span>
                    <span className="font-sans font-bold text-white text-sm">${money}</span>
                  </div>
                  <button
                    onClick={() => setShowShop(false)}
                    className="w-8 h-8 flex items-center justify-center text-white/60 hover:text-white transition-colors rounded-full hover:bg-white/10"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Grid */}
              <div className="p-8 pt-2 grid grid-cols-1 md:grid-cols-2 gap-3 overflow-y-auto">
                {SHOP_ITEMS.map(item => {
                  const isOwned = ownedAccessories.includes(item.id);
                  const isEquipped = equippedAccessory === item.id;
                  const canAfford = money >= item.price;

                  return (
                    <div key={item.id} className="relative group">
                      {isEquipped && (
                        <div className="absolute -inset-[1px] rounded-[21px] bg-gradient-to-r from-[#4285F4] via-[#34A853] to-[#FBBC04] opacity-100" />
                      )}

                      <div className={`relative h-full p-4 rounded-[20px] flex items-center justify-between transition-all ${
                        isEquipped ? "bg-[#18181B]" : "bg-[#18181B] border border-white/5 hover:bg-[#202023]"
                      }`}>
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 text-2xl flex items-center justify-center">
                            {item.icon == 'party-hat' ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 18 18" fill="none">
                                <path d="M0 17.0833L4.16667 5.41667L11.6667 12.9167L0 17.0833ZM10.4583 9.20833L9.58333 8.33333L14.25 3.66667C14.6944 3.22222 15.2292 3 15.8542 3C16.4792 3 17.0139 3.22222 17.4583 3.66667L17.9583 4.16667L17.0833 5.04167L16.5833 4.54167C16.3889 4.34722 16.1458 4.25 15.8542 4.25C15.5625 4.25 15.3194 4.34722 15.125 4.54167L10.4583 9.20833ZM7.125 5.875L6.25 5L6.75 4.5C6.94444 4.30556 7.04167 4.06945 7.04167 3.79167C7.04167 3.51389 6.94444 3.27778 6.75 3.08333L6.20833 2.54167L7.08333 1.66667L7.625 2.20833C8.06944 2.65278 8.29167 3.18056 8.29167 3.79167C8.29167 4.40278 8.06944 4.93056 7.625 5.375L7.125 5.875ZM8.79167 7.54167L7.91667 6.66667L10.9167 3.66667C11.1111 3.47222 11.2083 3.22917 11.2083 2.9375C11.2083 2.64583 11.1111 2.40278 10.9167 2.20833L9.58333 0.875L10.4583 0L11.7917 1.33333C12.2361 1.77778 12.4583 2.3125 12.4583 2.9375C12.4583 3.5625 12.2361 4.09722 11.7917 4.54167L8.79167 7.54167ZM12.125 10.875L11.25 10L12.5833 8.66667C13.0278 8.22222 13.5625 8 14.1875 8C14.8125 8 15.3472 8.22222 15.7917 8.66667L17.125 10L16.25 10.875L14.9167 9.54167C14.7222 9.34722 14.4792 9.25 14.1875 9.25C13.8958 9.25 13.6528 9.34722 13.4583 9.54167L12.125 10.875Z" fill="white"/>
                              </svg>) : ''}

                            {item.icon == 'cool-shades' ? (
                              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <mask id="mask0_7763_12587" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="20">
                                <rect width="20" height="20" fill="#D9D9D9"/>
                                </mask>
                                <g mask="url(#mask0_7763_12587)">
                                <path d="M19.999 7.53017C19.9985 7.47363 19.9089 7.37615 19.8495 7.36785C17.5497 7.04272 15.2357 6.79523 12.9341 7.24423C11.9545 7.43519 10.9804 7.57238 10 7.5857C9.01959 7.57238 8.04581 7.43519 7.06593 7.24423C4.76433 6.79548 2.45027 7.04272 0.150534 7.36785C0.0911316 7.37615 0.00149699 7.47363 0.000966609 7.53017C-0.00327645 7.97616 0.00680089 8.4224 0.0243035 8.86813C0.0261599 8.91738 0.0953747 8.99578 0.146026 9.00633C0.389737 9.05733 0.492101 9.21362 0.538509 9.42493C0.684364 10.0893 0.814839 10.7574 0.983235 11.4167C1.13466 12.0099 1.32294 12.5956 1.73717 13.0861C2.34287 13.8029 3.20501 13.9466 4.08862 13.9911C4.36548 14.0049 4.65719 14.0062 5.19765 13.969C6.84104 13.8559 7.97792 13.13 8.68465 11.7524C9.03603 11.0674 9.22352 10.334 9.3707 9.5885C9.43329 9.27166 9.59983 9.16965 9.99974 9.16161C10.3996 9.16965 10.5662 9.27191 10.6288 9.5885C10.776 10.3342 10.9634 11.0677 11.3148 11.7524C12.0218 13.13 13.1584 13.8559 14.8018 13.969C15.3423 14.0062 15.634 14.0049 15.9108 13.9911C16.7945 13.9466 17.6566 13.8032 18.2623 13.0861C18.6765 12.5956 18.8648 12.0102 19.0162 11.4167C19.1846 10.7574 19.3148 10.0893 19.461 9.42493C19.5074 9.21362 19.6097 9.05759 19.8534 9.00633C19.9041 8.99578 19.973 8.91738 19.9752 8.86813C19.9932 8.42265 20.0033 7.97616 19.999 7.53017Z" fill="white"/>
                                </g>
                              </svg>

                            ) : '' }

                            {item.icon == 'cowboy-hat' ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <mask id="mask0_7763_12549" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="20">
                                  <rect width="20" height="20" fill="#D9D9D9"/>
                                </mask>
                                <g mask="url(#mask0_7763_12549)">
                                  <path d="M4.99967 16.6666C3.8469 16.6666 2.86426 16.2603 2.05176 15.4478C1.23926 14.6353 0.833008 13.6527 0.833008 12.4999C0.833008 11.3471 1.23926 10.3645 2.05176 9.552C2.86426 8.7395 3.8469 8.33325 4.99967 8.33325C6.15245 8.33325 7.13509 8.7395 7.94759 9.552C8.76009 10.3645 9.16634 11.3471 9.16634 12.4999C9.16634 13.6527 8.76009 14.6353 7.94759 15.4478C7.13509 16.2603 6.15245 16.6666 4.99967 16.6666ZM4.99967 13.7499C4.65245 13.7499 4.35731 13.6284 4.11426 13.3853C3.8712 13.1423 3.74967 12.8471 3.74967 12.4999C3.74967 12.1527 3.8712 11.8576 4.11426 11.6145C4.35731 11.3714 4.65245 11.2499 4.99967 11.2499C5.3469 11.2499 5.64204 11.3714 5.88509 11.6145C6.12815 11.8576 6.24967 12.1527 6.24967 12.4999C6.24967 12.8471 6.12815 13.1423 5.88509 13.3853C5.64204 13.6284 5.3469 13.7499 4.99967 13.7499ZM16.2497 16.6666C15.4441 16.6666 14.7566 16.3819 14.1872 15.8124C13.6177 15.243 13.333 14.5555 13.333 13.7499C13.333 12.9444 13.6177 12.2569 14.1872 11.6874C14.7566 11.118 15.4441 10.8333 16.2497 10.8333C17.0552 10.8333 17.7427 11.118 18.3122 11.6874C18.8816 12.2569 19.1663 12.9444 19.1663 13.7499C19.1663 14.5555 18.8816 15.243 18.3122 15.8124C17.7427 16.3819 17.0552 16.6666 16.2497 16.6666ZM3.33301 7.49992C3.0969 7.49992 2.89898 7.42006 2.73926 7.26033C2.57954 7.10061 2.49967 6.9027 2.49967 6.66659C2.49967 6.43047 2.57954 6.23256 2.73926 6.07284C2.89898 5.91311 3.0969 5.83325 3.33301 5.83325H5.83301C6.29134 5.83325 6.6837 5.99645 7.01009 6.32284C7.33648 6.64922 7.49967 7.04159 7.49967 7.49992H3.33301ZM6.77051 14.2708C7.25662 13.7846 7.49967 13.1944 7.49967 12.4999C7.49967 11.8055 7.25662 11.2152 6.77051 10.7291C6.2844 10.243 5.69412 9.99992 4.99967 9.99992C4.30523 9.99992 3.71495 10.243 3.22884 10.7291C2.74273 11.2152 2.49967 11.8055 2.49967 12.4999C2.49967 13.1944 2.74273 13.7846 3.22884 14.2708C3.71495 14.7569 4.30523 14.9999 4.99967 14.9999C5.69412 14.9999 6.2844 14.7569 6.77051 14.2708ZM17.1351 14.6353C17.3781 14.3923 17.4997 14.0971 17.4997 13.7499C17.4997 13.4027 17.3781 13.1076 17.1351 12.8645C16.892 12.6214 16.5969 12.4999 16.2497 12.4999C15.9025 12.4999 15.6073 12.6214 15.3643 12.8645C15.1212 13.1076 14.9997 13.4027 14.9997 13.7499C14.9997 14.0971 15.1212 14.3923 15.3643 14.6353C15.6073 14.8784 15.9025 14.9999 16.2497 14.9999C16.5969 14.9999 16.892 14.8784 17.1351 14.6353ZM9.91634 13.3333H12.5413C12.6802 12.3333 13.1143 11.5346 13.8434 10.9374C14.5726 10.3402 15.3955 10.0416 16.3122 10.0416C16.6594 10.0416 17.0031 10.0902 17.3434 10.1874C17.6837 10.2846 18.0136 10.4305 18.333 10.6249V6.66659C18.333 6.20825 18.1698 5.81589 17.8434 5.4895C17.517 5.16311 17.1247 4.99992 16.6663 4.99992H11.4163L10.5413 4.08325L11.708 2.91659L11.1247 2.33325L8.16634 5.29159L8.79134 5.87492L9.95801 4.70825L10.833 5.58325V7.49992C10.833 7.95825 10.6698 8.35061 10.3434 8.677C10.017 9.00339 9.62467 9.16658 9.16634 9.16658H8.70801C9.12467 9.62492 9.44065 10.1388 9.65593 10.7083C9.8712 11.2777 9.97884 11.8749 9.97884 12.4999C9.97884 12.6388 9.97537 12.7777 9.96843 12.9166C9.96148 13.0555 9.94412 13.1944 9.91634 13.3333Z" fill="white"/>
                                </g>
                              </svg>
                            ) : '' }

                            {item.icon == 'top-hat' ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <mask id="mask0_7763_12600" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="20">
                                  <rect width="20" height="20" fill="#D9D9D9"/>
                                </mask>
                                <g mask="url(#mask0_7763_12600)">
                                  <path d="M3.66667 17.5001L2.5 16.3334L8.77083 10.0417L5 9.10425L9.125 6.54175L8.77083 1.66675L12.5 4.81258L17 2.97925L15.1875 7.50008L18.3333 11.2084L13.4583 10.8751L10.875 15.0001L9.9375 11.2292L3.66667 17.5001ZM4.16667 6.66675L2.5 5.00008L4.16667 3.33341L5.83333 5.00008L4.16667 6.66675ZM15 17.5001L13.3333 15.8334L15 14.1667L16.6667 15.8334L15 17.5001Z" fill="white"/>
                                </g>
                              </svg>
                            ) : '' }

                            {item.icon == 'royal-crown' ? (
                              <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                                <mask id="mask0_7763_12562" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="20">
                                  <rect width="20" height="20" fill="#D9D9D9"/>
                                </mask>
                                <g mask="url(#mask0_7763_12562)">
                                  <path d="M4.64551 17.5001L2.79134 7.47925C2.27745 7.57647 1.82259 7.45841 1.42676 7.12508C1.03092 6.79175 0.833008 6.36119 0.833008 5.83341C0.833008 5.37508 0.996202 4.98272 1.32259 4.65633C1.64898 4.32994 2.04134 4.16675 2.49967 4.16675C2.95801 4.16675 3.35037 4.32994 3.67676 4.65633C4.00315 4.98272 4.16634 5.37508 4.16634 5.83341C4.16634 6.02786 4.13856 6.20841 4.08301 6.37508C4.02745 6.54175 3.94412 6.69453 3.83301 6.83342C4.13856 7.01397 4.44759 7.16328 4.76009 7.28133C5.07259 7.39939 5.40245 7.45842 5.74967 7.45842C6.36079 7.45842 6.92676 7.30564 7.44759 7.00008C7.96842 6.69453 8.37468 6.27786 8.66634 5.75008L9.18718 4.79175C8.92329 4.63897 8.71495 4.43758 8.56218 4.18758C8.4094 3.93758 8.33301 3.65286 8.33301 3.33341C8.33301 2.87508 8.4962 2.48272 8.82259 2.15633C9.14898 1.82994 9.54134 1.66675 9.99967 1.66675C10.458 1.66675 10.8504 1.82994 11.1768 2.15633C11.5031 2.48272 11.6663 2.87508 11.6663 3.33341C11.6663 3.65286 11.59 3.93758 11.4372 4.18758C11.2844 4.43758 11.0761 4.63897 10.8122 4.79175L11.333 5.75008C11.6247 6.27786 12.0309 6.69453 12.5518 7.00008C13.0726 7.30564 13.6386 7.45842 14.2497 7.45842C14.5969 7.45842 14.9268 7.40286 15.2393 7.29175C15.5518 7.18064 15.8608 7.0348 16.1663 6.85425C16.0552 6.71536 15.9719 6.55911 15.9163 6.3855C15.8608 6.21189 15.833 6.02786 15.833 5.83341C15.833 5.37508 15.9962 4.98272 16.3226 4.65633C16.649 4.32994 17.0413 4.16675 17.4997 4.16675C17.958 4.16675 18.3504 4.32994 18.6768 4.65633C19.0031 4.98272 19.1663 5.37508 19.1663 5.83341C19.1663 6.36119 18.9684 6.79175 18.5726 7.12508C18.1768 7.45841 17.7219 7.57647 17.208 7.47925L15.3538 17.5001H4.64551Z" fill="white"/>
                                </g>
                              </svg>
                            ) : '' }

                          </div>
                          <div>
                            <h3 className="text-sm font-medium text-white">{item.name}</h3>
                            <p className={`text-xs font-medium ${isOwned ? "text-white/40" : "text-white/60"}`}>
                              {isOwned ? "Owned" : `$${item.price}`}
                            </p>
                          </div>
                        </div>

                        {isOwned ? (
                          <button
                            onClick={() => equipItem(item.id)}
                            className={`px-5 py-2 rounded-full text-xs font-bold transition-all ml-3 ${
                              isEquipped 
                                ? "bg-[#262626] text-white/40 cursor-default" 
                                : "bg-[#262626] text-white hover:bg-[#333] hover:scale-105 active:scale-95"
                            }`}
                          >
                            {isEquipped ? "Equipped" : "Equip"}
                          </button>
                        ) : (
                          <button
                            onClick={() => buyItem(item)}
                            disabled={!canAfford}
                            className={`px-5 py-2 rounded-full text-xs font-bold transition-all ml-3 ${
                              canAfford 
                                ? "bg-white text-black hover:bg-neutral-200 hover:scale-105 active:scale-95" 
                                : "bg-[#262626] text-white/20 cursor-not-allowed"
                            }`}
                          >
                            Buy
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </dialog>
      )}

      {/* Main Content */}
      <div className="flex-[0.2] lg:flex-[0.3] w-full flex flex-col justify-start md:justify-center items-center relative z-10 p-2 md:p-4 lg:p-12">
        {/* Floating Shop Button (Top Right Desktop) */}


        {/* Central Grid */}
        <div className="flex flex-col lg:flex-row gap-2 md:gap-6 w-full max-w-5xl items-stretch lg:justify-center lg:h-full lg:min-h-[480px] lg:max-h-[480px]">
          {/* Left Card: Pet Display */}
          <div
            className="flex-1 bg-[#131313] rounded-[20px] relative flex flex-col items-center justify-center p-4 md:p-8 min-h-[340px] lg:min-h-0"
            style={{
              backgroundImage: `url(${petCardBg})`,
              backgroundSize: 'contain',
              backgroundPosition: 'center',
              backgroundRepeat: 'no-repeat'
            }}
          >
            {/* Days Left Counter */}
            <div className="absolute top-4 right-4 md:top-6 md:right-6 flex flex-col items-end z-10">
               <span className="text-white/60 text-[10px] font-bold uppercase tracking-widest mb-0.5">Days Left</span>
               <span className="text-white text-3xl font-sans font-medium leading-none">{
                 Math.max(0, Math.ceil(EVOLUTION_GOAL - daysPassed))
               }</span>
            </div>

            {/* XP Floating Numbers */}
            <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-full flex flex-col items-center pointer-events-none z-50">
              {xpPopups.map((popup) => (
                <div
                  key={popup.id}
                  className="xp-popup flex flex-col items-center absolute"
                >
                  <span className="text-3xl font-black text-white drop-shadow-md">
                    +{popup.amount} XP
                  </span>
                  {popup.multiplier > 1 && (
                    <span className="text-sm font-bold text-black bg-white px-2 py-0.5 rounded-full shadow-sm mt-1">
                      {popup.multiplier === 3 ? "Perfect!" : "Great!"}
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className={`flex-1 flex w-full justify-end items-center ${currentLevel < 6 ? 'pr-0 md:pr-6 pt-4 md:pt-12' : 'pr-0 pt-0 -ml-[130px] -mt-[40px]'}`}>
               <PetDisplay
                  color={currentColor}
                  secondaryColor={currentSecondary}
                  state={isGameOver ? PetState.IDLE : currentState}
                  hasPoop={hasPoop}
                  stage={pet.stage}
                  equippedAccessory={equippedAccessory}
                  scale={currentScale}
                  currentLevel={currentLevel}
                />
            </div>

            {/* Ready Button */}
            <div className="-mt-[76px] lg:-mt-[40px] min-h-[50px] max-h-[50px] z-100">
              {showLevelUp ? (
                <button
                  onClick={() => {}}
                  className="w-full p-[1px] rounded-full bg-gradient-to-r from-[#4285F4] via-[#34A853] to-[#FBBC04] shadow-lg hover:scale-[1.02] active:scale-95 transition-all pointer-events-none"
                >
                  <div className="bg-black rounded-full w-full h-full py-[10px] px-[20px] flex items-center justify-center">
                    <span className="text-white font-medium text-[18px]">Level Up +$200</span>
                  </div>
                </button>
              ) : (
                <button
                  onClick={() => updateDialogue("StateChange")}
                  className="w-full py-[10px] px-[6px] rounded-bl-[20px] rounded-br-[20px] rounded-tr-[20px] rounded-tl-none font-medium text-[16px] lg:text-[18px] tracking-[-0.36px] hover:brightness-110 active:scale-95 transition-all pointer-events-none"
                style={{
                  background: currentColor,
                  color: GOOGLE_COLORS.find(c => c.hex === currentColor)?.textColor || "#000"
                }}
                >
                  {currentState === PetState.SLEEPING ? "Zzz..." : dialogue}
                </button>
              )}
            </div>
          </div>

          {/* Right Card: Controls & Stats */}
          <div className="flex-1 flex flex-col gap-4 relative">
            {/* Shop & Money Pill - Moved outside */}
            <div className="hidden lg:flex lg:self-end bg-[#262626] rounded-full pl-4 items-center gap-3 border border-white/5 absolute top-0 right-0 -translate-y-[calc(100%+16px)] z-20">
               <span className="font-medium text-white tracking-wider text-sm">${money}</span>
               <button
                onClick={() => setShowShop(true)}
                className={`${isMoneyBouncing ? "flash-bg" : "bg-[#333] hover:bg-[#444]"} text-white p-2 px-6 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95`}
               >
                 <span className="text-sm">
                  <svg className={isMoneyBouncing ? "bounce" : ""} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <mask id="mask0_7759_17057" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="20">
                      <rect width="20" height="20" fill="white"/>
                    </mask>
                    <g mask="url(#mask0_7759_17057)">
                      <path d="M4.16667 18.3333C3.70833 18.3333 3.31597 18.1701 2.98958 17.8437C2.66319 17.5173 2.5 17.1249 2.5 16.6666V6.66658C2.5 6.20825 2.66319 5.81589 2.98958 5.4895C3.31597 5.16311 3.70833 4.99992 4.16667 4.99992H5.83333C5.83333 3.84714 6.23958 2.8645 7.05208 2.052C7.86458 1.2395 8.84722 0.833252 10 0.833252C11.1528 0.833252 12.1354 1.2395 12.9479 2.052C13.7604 2.8645 14.1667 3.84714 14.1667 4.99992H15.8333C16.2917 4.99992 16.684 5.16311 17.0104 5.4895C17.3368 5.81589 17.5 6.20825 17.5 6.66658V16.6666C17.5 17.1249 17.3368 17.5173 17.0104 17.8437C16.684 18.1701 16.2917 18.3333 15.8333 18.3333H4.16667ZM12.9479 10.4478C13.7604 9.63533 14.1667 8.6527 14.1667 7.49992H12.5C12.5 8.19436 12.2569 8.78464 11.7708 9.27075C11.2847 9.75686 10.6944 9.99992 10 9.99992C9.30556 9.99992 8.71528 9.75686 8.22917 9.27075C7.74306 8.78464 7.5 8.19436 7.5 7.49992H5.83333C5.83333 8.6527 6.23958 9.63533 7.05208 10.4478C7.86458 11.2603 8.84722 11.6666 10 11.6666C11.1528 11.6666 12.1354 11.2603 12.9479 10.4478ZM7.5 4.99992H12.5C12.5 4.30547 12.2569 3.7152 11.7708 3.22909C11.2847 2.74297 10.6944 2.49992 10 2.49992C9.30556 2.49992 8.71528 2.74297 8.22917 3.22909C7.74306 3.7152 7.5 4.30547 7.5 4.99992Z" fill="white"/>
                    </g>
                  </svg>
                 </span>
               </button>
            </div>

            {/* Right Card: Controls & Stats */}
            <div className="bg-[#131313] rounded-[20px] p-[20px] md:p-[40px] px-[20px] flex flex-col gap-4 md:gap-8 justify-center relative w-full h-full">

            {/* Actions Grid */}
            <div className="w-full">
              <ActionsPanel
                isAwake={isAwake}
                currentState={currentState}
                activeCooldowns={activeCooldowns}
                hasPoop={hasPoop}
                onFeed={feed}
                onPlay={play}
                onBrush={brush}
                onPet={petPet}
                onToggleSleep={toggleSleep}
                onCleanPen={cleanPen}
                onBandage={bandage}
                money={money}
                onShop={() => setShowShop(true)}
              />
            </div>

            {/* Stats Bars */}
            <div className="grid grid-cols-2 gap-4 space-y-0 md:block md:space-y-5 px-2 w-full max-w-md mx-auto mt-0 lg:mt-2 md:mt-4">
              {/* Using generic white/grey colors for bars to match dark theme per ref, or keeping colorful? Keeping colorful but with white text (handled in StatBar) */}

              <StatBar label="Hunger" value={displayStats.hunger} color="#fff" icon="food" />
              <StatBar label="Energy" value={displayStats.energy} color="#fff" icon="energy" />
              <StatBar label="Hygiene" value={displayStats.cleanliness} color="#fff" icon="clean" />
              <StatBar label="Love" value={displayStats.love} color="#fff" icon="love" />
            </div>
            <div className="flex px-2 w-full max-w-md mx-auto">
              <StatBar 
                label="Growth Progress" 
                value={experience % 100} 
                color="linear-gradient(90deg, #4285F4, #34A853, #FBBC04, #EA4335)"
              />
            </div>
          </div>
        </div>
      </div>

      </div>
      <div className="flex justify-center w-full">
        {/* Bottom Status */}
          <FooterLeftContent
            currentColor={currentColor}
            pet={pet}
            currentLevel={currentLevel}
            experience={experience}
            textColor={GOOGLE_COLORS.find(c => c.hex === currentColor)?.textColor || "#000"}
          />
        </div>
    </div>
  );
};

export default App;
