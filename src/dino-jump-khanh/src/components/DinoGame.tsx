/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useEffect, useRef, useState } from 'react';
import { MEDIAPIPE_VISION_WASM_URL } from '../../../lib/mediapipeWasmPath';
import { MEDIAPIPE_MODEL_URLS } from '../../../lib/mediapipeModelPath';

// --- TYPES & INTERFACES ---

interface ExtendedWindow extends Window {
    webkitAudioContext?: typeof AudioContext;
}

interface VisionState {
    poseLandmarker: any;
    lastVideoTime: number;
    results: any;
    prevY: number;
    prevTime: number;
    smoothedVelocity: number;
    peakVelocity: number;
    JUMP_VELOCITY_THRESHOLD: number;
    lastPredictionTime: number;
    lastGestureJumpTime: number;
}

// --- CAMERA MODE (1 toggle nhiều trạng thái) ---
type CameraMode = 'background' | 'below' | 'hidden' | 'off';

const CAMERA_MODE_ORDER: CameraMode[] = ['background', 'below', 'hidden', 'off'];

const CAMERA_MODE_INFO: Record<CameraMode, { icon: string; label: string; hint: string }> = {
    background: { icon: '🖼️', label: 'Camera: Background', hint: 'Live camera fills the game background' },
    below: { icon: '📷', label: 'Camera: Below', hint: 'Small camera preview under the game' },
    hidden: { icon: '🙈', label: 'Camera: Hidden', hint: 'Camera hidden — gesture indicator only' },
    off: { icon: '⌨️', label: 'Camera: Off (Space/Tap)', hint: 'No camera — use the Space key or the on-screen button' },
};



type BodyTheme = {
    id: string;
    name: string;
    icon: string;
    label: string;
    primary: string;
    accent: string;
    bg: string;
    bgOverlay: string;
    vessel: string;
    vesselDark: string;
    organ: string;
    hazard: string;
    helper: string;
    terrainText: string;
};

const BODY_THEMES: BodyTheme[] = [
    { id: 'heart', name: 'Tim', icon: '❤️', label: 'Hệ tuần hoàn', primary: '#7f1d1d', accent: '#ef4444', bg: '#fff1f2', bgOverlay: 'rgba(255, 241, 242, 0.78)', vessel: '#dc2626', vesselDark: '#991b1b', organ: '#fb7185', hazard: '#7c2d12', helper: '#22c55e', terrainText: 'Mạch máu chủ · van tim · hồng cầu · oxy', },
    { id: 'lung', name: 'Phổi', icon: '🫁', label: 'Hệ hô hấp', primary: '#0f766e', accent: '#38bdf8', bg: '#ecfeff', bgOverlay: 'rgba(236, 254, 255, 0.78)', vessel: '#0891b2', vesselDark: '#0e7490', organ: '#67e8f9', hazard: '#64748b', helper: '#22d3ee', terrainText: 'Mạch phổi · phế nang · khí quản · oxy', },
    { id: 'liver', name: 'Gan', icon: '🟤', label: 'Hệ giải độc', primary: '#92400e', accent: '#f59e0b', bg: '#fffbeb', bgOverlay: 'rgba(255, 251, 235, 0.8)', vessel: '#b45309', vesselDark: '#78350f', organ: '#fbbf24', hazard: '#a16207', helper: '#84cc16', terrainText: 'Mạch gan · mật · chuyển hoá · thải độc', },
    { id: 'stomach', name: 'Dạ dày', icon: '🫃', label: 'Hệ tiêu hoá', primary: '#7e22ce', accent: '#c084fc', bg: '#faf5ff', bgOverlay: 'rgba(250, 245, 255, 0.78)', vessel: '#9333ea', vesselDark: '#6b21a8', organ: '#d8b4fe', hazard: '#be123c', helper: '#facc15', terrainText: 'Niêm mạc · enzyme · dịch vị · hấp thu', },
    { id: 'kidney', name: 'Thận', icon: '🫘', label: 'Hệ tiết niệu', primary: '#065f46', accent: '#34d399', bg: '#ecfdf5', bgOverlay: 'rgba(236, 253, 245, 0.78)', vessel: '#059669', vesselDark: '#047857', organ: '#6ee7b7', hazard: '#0f766e', helper: '#60a5fa', terrainText: 'Mạch thận · nephron · lọc máu · cân bằng nước', },
    { id: 'intestine', name: 'Ruột', icon: '🧬', label: 'Hệ đường ruột', primary: '#be123c', accent: '#fb7185', bg: '#fff7ed', bgOverlay: 'rgba(255, 247, 237, 0.8)', vessel: '#e11d48', vesselDark: '#9f1239', organ: '#fdba74', hazard: '#f97316', helper: '#22c55e', terrainText: 'Mạch ruột · lợi khuẩn · nhung mao · hấp thu', },
];

const DEFAULT_BODY_THEME = BODY_THEMES[0];

// Entity Interfaces for Pooling
interface GameObject {
    active: boolean;
    x: number;
    y: number;
    width: number;
    height: number;
    // Specific props
    color?: string;
}

interface GameEngineState {
    gameRunning: boolean;
    canRestart: boolean;
    score: number;
    gameSpeed: number;
    lastTime: number;
    // Pools
    obstaclePool: Cactus[];
    groundPool: GroundDetail[];
    platformPool: OrganPlatform[];
    powerUpPool: BacteriaPowerUp[];
    spawnTimer: number;
    groundSpawnTimer: number;
    animationId: number;
    visionAnimationId: number;
    dino: DinoEntity;
    hasStarted: boolean;
    cameraReady: boolean;
    shieldRemaining: number;
    powerUpSpawnTimer: number;
    platformSpawnTimer: number;
}

interface DinoEntity {
    x: number;
    y: number;
    width: number;
    height: number;
    dy: number;
    grounded: boolean;
    jumpTimer: number;
    legState: boolean;
    animTimer: number;
    jump: () => boolean;
    update: (dt: number, onStep?: () => void) => void;
    draw: (ctx: CanvasRenderingContext2D, theme: BodyTheme) => void;
    reset: () => void;
}

// --- CONSTANTS ---

const GAME_CONFIG = {
    CANVAS_WIDTH: 800,
    CANVAS_HEIGHT: 300,
    GROUND_Y: 242,
    GRAVITY: 4000,
    JUMP_FORCE: 1350,
    INITIAL_SPEED: 400,
    MAX_SPEED: 1200,
    SPEED_INCREMENT: 10,
    DINO_START_X: 50,
    DINO_GROUND_Y: 200,
    VISION_FPS: 30,
    COLORS: {
        PRIMARY: '#535353',
        ACCENT: '#ff5252',
        FOCUS: '#F59E0B',
        WHITE: '#ffffff',
        VESSEL: '#b91c1c',
        VIRUS: '#8b5cf6',
        CANCER: '#ef4444',
        BACTERIA: '#22c55e',
        ORGAN: '#0ea5e9',
        SHIELD: '#38bdf8',
    }
};

// --- AUDIO SYNTHESIS ---

const OBSTACLE_TYPES = ['virus', 'virus', 'cancer', 'cancer', 'cancer'] as const;
type ObstacleType = typeof OBSTACLE_TYPES[number];

const ORGAN_PLATFORMS = [
    { name: 'Tim', icon: '♥', color: '#ef4444' },
    { name: 'Phổi', icon: '☁', color: '#38bdf8' },
    { name: 'Gan', icon: '◖', color: '#f59e0b' },
    { name: 'Dạ dày', icon: '◡', color: '#a855f7' },
    { name: 'Thận', icon: '◔', color: '#22c55e' },
    { name: 'Ruột', icon: '∿', color: '#fb7185' },
];

const SHIELD_DURATION = 20;
const GESTURE_JUMP_COOLDOWN_MS = 450;
const HAND_GESTURE_VERTICAL_GAP = 0.1;
const HAND_GESTURE_SIDE_DRIFT_LIMIT = 0.24;

const isFingerPointingUp = (wrist: any, tip: any) => {
    if (!wrist || !tip) return false;
    const verticalGap = wrist.y - tip.y;
    const sideDrift = Math.abs(tip.x - wrist.x);
    return verticalGap >= HAND_GESTURE_VERTICAL_GAP && sideDrift <= HAND_GESTURE_SIDE_DRIFT_LIMIT;
};

const isIndexOrThumbPointingUp = (landmarks: any[]) => {
    const leftWrist = landmarks[15];
    const rightWrist = landmarks[16];
    const leftIndex = landmarks[19];
    const rightIndex = landmarks[20];
    const leftThumb = landmarks[21];
    const rightThumb = landmarks[22];

    return (
        isFingerPointingUp(leftWrist, leftIndex) ||
        isFingerPointingUp(rightWrist, rightIndex) ||
        isFingerPointingUp(leftWrist, leftThumb) ||
        isFingerPointingUp(rightWrist, rightThumb)
    );
};

const SoundSynth = {
    ctx: null as AudioContext | null,
    bufferCache: {} as Record<string, AudioBuffer>,
    
    init: () => {
        if (!SoundSynth.ctx) {
            const Win = window as ExtendedWindow;
            SoundSynth.ctx = new (window.AudioContext || Win.webkitAudioContext)();
        }
        if (SoundSynth.ctx.state === 'suspended') {
            SoundSynth.ctx.resume();
        }

        if (!SoundSynth.bufferCache['step']) {
            SoundSynth.bufferCache['step'] = SoundSynth.createNoiseBuffer(0.04);
        }
        if (!SoundSynth.bufferCache['roar']) {
            SoundSynth.bufferCache['roar'] = SoundSynth.createNoiseBuffer(0.8);
        }
    },

    createNoiseBuffer: (duration: number): AudioBuffer => {
        const ctx = SoundSynth.ctx!;
        const bufferSize = ctx.sampleRate * duration;
        const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) {
            data[i] = Math.random() * 2 - 1;
        }
        return buffer;
    },

    playJump: () => {
        const ctx = SoundSynth.ctx;
        if (!ctx) return;
        
        const t = ctx.currentTime;
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.type = 'square';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.exponentialRampToValueAtTime(600, t + 0.1);
        
        gain.gain.setValueAtTime(0.1, t);
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.1);
        
        osc.start(t);
        osc.stop(t + 0.1);
    },

    playStep: () => {
        const ctx = SoundSynth.ctx;
        if (!ctx || !SoundSynth.bufferCache['step']) return;
        
        const t = ctx.currentTime;
        const noise = ctx.createBufferSource();
        noise.buffer = SoundSynth.bufferCache['step'];
        
        const filter = ctx.createBiquadFilter();
        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(1200, t);
        filter.frequency.exponentialRampToValueAtTime(100, t + 0.04);

        const gain = ctx.createGain();
        gain.gain.setValueAtTime(0.3, t); 
        gain.gain.exponentialRampToValueAtTime(0.01, t + 0.04);
        
        noise.connect(filter);
        filter.connect(gain);
        gain.connect(ctx.destination);
        
        noise.start(t);
    },

    playRoar: () => {
        const ctx = SoundSynth.ctx;
        if (!ctx || !SoundSynth.bufferCache['roar']) return;
        
        const t = ctx.currentTime;
        
        const noise = ctx.createBufferSource();
        noise.buffer = SoundSynth.bufferCache['roar'];
        
        const noiseFilter = ctx.createBiquadFilter();
        noiseFilter.type = 'lowpass';
        noiseFilter.frequency.setValueAtTime(800, t);
        noiseFilter.frequency.linearRampToValueAtTime(100, t + 0.6);

        const noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(0.08, t);
        noiseGain.gain.linearRampToValueAtTime(0, t + 0.6);

        noise.connect(noiseFilter);
        noiseFilter.connect(noiseGain);
        noiseGain.connect(ctx.destination);

        const osc = ctx.createOscillator();
        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(150, t);
        osc.frequency.linearRampToValueAtTime(50, t + 0.6);
        
        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0.08, t);
        oscGain.gain.linearRampToValueAtTime(0, t + 0.6);

        osc.connect(oscGain);
        oscGain.connect(ctx.destination);

        noise.start(t);
        osc.start(t);
        noise.stop(t + 0.6);
        osc.stop(t + 0.6);
    }
};

// --- GAME ENTITIES (POOLED) ---

class GroundDetail {
    active: boolean = false;
    x: number = 0;
    y: number = 0;
    width: number = 0;
    height: number = 2;
    organIndex: number = 0;

    spawn(startX: number) {
        this.x = startX;
        this.y = GAME_CONFIG.GROUND_Y + 4 + Math.random() * 36;
        this.width = 28 + Math.random() * 54;
        this.height = 3 + Math.random() * 3;
        this.organIndex = Math.floor(Math.random() * ORGAN_PLATFORMS.length);
        this.active = true;
    }

    update(dt: number, speed: number) {
        if (!this.active) return;
        this.x -= speed * dt;
        if (this.x < -this.width) this.active = false;
    }

    draw(ctx: CanvasRenderingContext2D, theme: BodyTheme) {
        if (!this.active) return;
        const organ = ORGAN_PLATFORMS[this.organIndex];
        const ix = Math.floor(this.x);
        const iy = Math.floor(this.y);
        ctx.fillStyle = theme.vesselDark;
        ctx.fillRect(ix, iy, this.width, this.height);
        ctx.fillStyle = organ.color;
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(organ.icon, ix + 2, iy - 2);
        ctx.fillStyle = GAME_CONFIG.COLORS.PRIMARY;
    }
}

class Cactus {
    active: boolean = false;
    x: number = 0;
    y: number = 210;
    width: number = 0;
    height: number = 0;
    kind: ObstacleType = 'virus';

    spawn(startX: number) {
        this.x = startX;
        this.kind = OBSTACLE_TYPES[Math.floor(Math.random() * OBSTACLE_TYPES.length)];
        this.width = this.kind === 'virus' ? 30 + Math.random() * 10 : 26 + Math.random() * 16;
        this.height = this.kind === 'virus' ? 30 + Math.random() * 10 : 34 + Math.random() * 20;
        this.y = GAME_CONFIG.GROUND_Y - this.height;
        this.active = true;
    }

    update(dt: number, speed: number) {
        if (!this.active) return;
        this.x -= speed * dt;
        if (this.x < -this.width) this.active = false;
    }

    draw(ctx: CanvasRenderingContext2D, theme: BodyTheme) {
        if (!this.active) return;
        const ix = Math.floor(this.x);
        const iy = Math.floor(this.y);
        const cx = ix + this.width / 2;
        const cy = iy + this.height / 2;

        if (this.kind === 'virus') {
            ctx.fillStyle = theme.hazard;
            ctx.beginPath();
            ctx.arc(cx, cy, this.width / 2.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = theme.hazard;
            for (let i = 0; i < 8; i++) {
                const a = (Math.PI * 2 * i) / 8;
                ctx.beginPath();
                ctx.moveTo(cx + Math.cos(a) * 10, cy + Math.sin(a) * 10);
                ctx.lineTo(cx + Math.cos(a) * 18, cy + Math.sin(a) * 18);
                ctx.stroke();
            }
            ctx.fillStyle = theme.bg;
            ctx.fillText('V', cx - 4, cy + 4);
        } else {
            ctx.fillStyle = theme.accent;
            ctx.beginPath();
            ctx.arc(cx - 5, cy, this.width / 3, 0, Math.PI * 2);
            ctx.arc(cx + 6, cy - 3, this.width / 3.4, 0, Math.PI * 2);
            ctx.arc(cx + 3, cy + 9, this.width / 3.6, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = theme.bg;
            ctx.fillText('CA', cx - 8, cy + 5);
        }
        ctx.fillStyle = theme.primary;
        ctx.strokeStyle = theme.primary;
    }
}

class OrganPlatform {
    active = false; x = 0; y = 0; width = 92; height = 12; organIndex = 0;
    spawn(startX: number) {
        this.x = startX; this.y = 145 + Math.random() * 55;
        this.width = 74 + Math.random() * 50; this.organIndex = Math.floor(Math.random() * ORGAN_PLATFORMS.length);
        this.active = true;
    }
    update(dt: number, speed: number) { if (!this.active) return; this.x -= speed * dt; if (this.x < -this.width) this.active = false; }
    draw(ctx: CanvasRenderingContext2D, theme: BodyTheme) {
        if (!this.active) return; const organ = ORGAN_PLATFORMS[this.organIndex];
        ctx.fillStyle = organ.color; ctx.fillRect(Math.floor(this.x), Math.floor(this.y), this.width, this.height);
        ctx.fillStyle = GAME_CONFIG.COLORS.WHITE; ctx.font = '10px monospace'; ctx.textAlign = 'center';
        ctx.fillText(`${organ.icon} ${organ.name}`, this.x + this.width / 2, this.y - 3); ctx.fillStyle = theme.primary;
    }
}

class BacteriaPowerUp {
    active = false; x = 0; y = 0; baseY = 0; radius = 13; phase = 0;
    spawn(startX: number) { this.x = startX; this.baseY = 105 + Math.random() * 70; this.y = this.baseY; this.phase = Math.random() * Math.PI * 2; this.active = true; }
    update(dt: number, speed: number) { if (!this.active) return; this.x -= speed * dt; this.phase += dt * 5; this.y = this.baseY + Math.sin(this.phase) * 18; if (this.x < -this.radius * 2) this.active = false; }
    draw(ctx: CanvasRenderingContext2D, theme: BodyTheme) {
        if (!this.active) return; ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.phase);
        ctx.fillStyle = theme.helper; ctx.beginPath(); ctx.ellipse(0, 0, 18, 10, 0, 0, Math.PI * 2); ctx.fill();
        ctx.strokeStyle = theme.helper; ctx.beginPath(); ctx.arc(0, 0, 26, 0, Math.PI * 1.7); ctx.stroke();
        ctx.fillStyle = GAME_CONFIG.COLORS.WHITE; ctx.font = '10px monospace'; ctx.textAlign = 'center'; ctx.fillText('+', 0, 4); ctx.restore();
        ctx.fillStyle = theme.primary; ctx.strokeStyle = theme.primary;
    }
}

// Pool Helpers
const getFromPool = <T extends { active: boolean }>(pool: T[], factory: () => T): T => {
    const item = pool.find(p => !p.active);
    if (item) return item;
    const newItem = factory();
    pool.push(newItem);
    return newItem;
};

const createDino = (): DinoEntity => ({
    x: GAME_CONFIG.DINO_START_X,
    y: GAME_CONFIG.DINO_GROUND_Y,
    width: 40,
    height: 43,
    dy: 0,
    grounded: false,
    jumpTimer: 0,
    legState: false,
    animTimer: 0,
    
    reset() {
        this.y = GAME_CONFIG.DINO_GROUND_Y;
        this.dy = 0;
        this.grounded = true;
        this.jumpTimer = 0;
        this.legState = false;
        this.animTimer = 0;
    },

    draw(ctx: CanvasRenderingContext2D, theme: BodyTheme) {
        // Optimization: Use Math.floor for sharp pixels
        const ix = Math.floor(this.x);
        const iy = Math.floor(this.y);

        ctx.fillStyle = theme.primary;
        // Body
        ctx.fillRect(ix + 10, iy, 20, 25);
        // Head
        ctx.fillRect(ix + 15, iy - 10, 25, 18);
        // Tail
        ctx.fillRect(ix, iy + 5, 10, 5);
        
        // Legs Animation
        if (!this.grounded) {
            ctx.fillRect(ix + 10, iy + 25, 5, 10);
            ctx.fillRect(ix + 25, iy + 25, 5, 10);
        } else if (this.legState) {
            ctx.fillRect(ix + 10, iy + 25, 5, 18);
            ctx.fillRect(ix + 25, iy + 25, 5, 10);
        } else {
            ctx.fillRect(ix + 10, iy + 25, 5, 10);
            ctx.fillRect(ix + 25, iy + 25, 5, 18);
        }

        ctx.fillStyle = GAME_CONFIG.COLORS.WHITE;
        ctx.fillRect(ix + 30, iy - 5, 3, 3); // Eye
        
        // Reset color to primary for next draw calls
        ctx.fillStyle = theme.primary;
    },

    jump() {
        if (this.grounded && this.jumpTimer <= 0) {
            this.dy = -GAME_CONFIG.JUMP_FORCE;
            this.grounded = false;
            this.jumpTimer = 0.1;
            return true;
        }
        return false;
    },

    update(dt: number, onStep?: () => void) {
        if (this.jumpTimer > 0) this.jumpTimer -= dt;

        this.animTimer += dt;
        if (this.animTimer > 0.1) {
            this.legState = !this.legState;
            this.animTimer = 0;
            if (this.grounded && onStep) onStep();
        }

        this.dy += GAME_CONFIG.GRAVITY * dt;
        this.y += this.dy * dt;

        if (this.y > GAME_CONFIG.DINO_GROUND_Y) {
            this.y = GAME_CONFIG.DINO_GROUND_Y;
            this.dy = 0;
            this.grounded = true;
        } else {
            this.grounded = false;
        }
    }
});


const DinoGame: React.FC = () => {
    // --- REFS ---
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const videoRef = useRef<HTMLVideoElement>(null);
    const outputCanvasRef = useRef<HTMLCanvasElement>(null);
    const jumpSignalRef = useRef<HTMLDivElement>(null);
    // Cache riêng cho khung camera nền (mode 'background'): vẽ+lật gương
    // (mirror) từ <video> tốn hơn vẽ lại 1 canvas tĩnh, nên chỉ redraw
    // cache này ~15fps (đủ mượt cho hiệu ứng nền mờ) thay vì redraw mỗi
    // frame game loop (~60fps) — game loop chỉ blit lại canvas cache có
    // sẵn (rẻ hơn nhiều), giúp mode 'background' đỡ giật khi bật.
    const bgCacheCanvasRef = useRef<HTMLCanvasElement | null>(null);
    const bgCacheLastDrawRef = useRef(0);
    
    // --- REACT STATE ---
    const [isLoading, setIsLoading] = useState(true);
    const [status, setStatus] = useState("Stand back and JUMP — or point index/thumb up!");
    const [gameRunning, setGameRunning] = useState(false);
    const [canRestart, setCanRestart] = useState(false);
    const [modelLoaded, setModelLoaded] = useState(false);
    const [hasStarted, setHasStarted] = useState(false);
    const [cameraReady, setCameraReady] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    // --- CAMERA MODE (1 toggle nhiều trạng thái, thay cho 2 toggle cũ
    // showVision + cameraAsBackground) ---
    // 'background' (mặc định): camera mở sẵn, làm nền mờ của canvas game.
    // 'below'                : camera mở, hiển thị khung xem nhỏ bên dưới game.
    // 'hidden'                : camera mở, KHÔNG hiển thị hình ảnh camera —
    //                           chỉ còn chấm báo hiệu cử chỉ (vẫn "thấy cử chỉ").
    // 'off'                   : tắt hẳn camera — chơi bằng phím Space vật lý
    //                           hoặc nút bấm ảo luôn hiển thị trên màn hình.
    const [cameraMode, setCameraMode] = useState<CameraMode>('background');
    const cameraModeRef = useRef<CameraMode>('background');
    const mutedRef = useRef(false);
    const [bodyTheme, setBodyTheme] = useState<BodyTheme>(DEFAULT_BODY_THEME);
    const bodyThemeRef = useRef<BodyTheme>(DEFAULT_BODY_THEME);

    // --- ENGINE STATE (Mutable) ---
    const engineRef = useRef<GameEngineState>({
        gameRunning: false,
        canRestart: false,
        score: 0,
        gameSpeed: GAME_CONFIG.INITIAL_SPEED,
        lastTime: 0,
        // Pre-allocate pools
        obstaclePool: Array.from({ length: 10 }, () => new Cactus()),
        groundPool: Array.from({ length: 50 }, () => new GroundDetail()),
        platformPool: Array.from({ length: 8 }, () => new OrganPlatform()),
        powerUpPool: Array.from({ length: 4 }, () => new BacteriaPowerUp()),
        spawnTimer: 0,
        groundSpawnTimer: 0,
        animationId: 0,
        visionAnimationId: 0,
        dino: createDino(),
        hasStarted: false,
        cameraReady: false,
        shieldRemaining: 0,
        powerUpSpawnTimer: 5,
        platformSpawnTimer: 1.4
    });

    // --- VISION STATE (Mutable) ---
    const visionRef = useRef<VisionState>({
        poseLandmarker: null,
        lastVideoTime: -1,
        results: undefined,
        prevY: 0,
        prevTime: 0,
        smoothedVelocity: 0,
        peakVelocity: 0,
        JUMP_VELOCITY_THRESHOLD: 0.35,
        lastPredictionTime: 0,
        lastGestureJumpTime: 0
    });

    useEffect(() => {
        mutedRef.current = isMuted;
    }, [isMuted]);

    useEffect(() => {
        bodyThemeRef.current = bodyTheme;
    }, [bodyTheme]);

    useEffect(() => {
        cameraModeRef.current = cameraMode;
    }, [cameraMode]);

    // --- GAME LOGIC ---

    const spawnObstacle = (dt: number) => {
        const engine = engineRef.current;
        engine.spawnTimer -= dt;
        
        if (engine.spawnTimer <= 0) {
            const r = Math.random();
            let count = r > 0.8 ? 3 : (r > 0.5 ? 2 : 1);

            let nextX = GAME_CONFIG.CANVAS_WIDTH; 

            for (let i = 0; i < count; i++) {
                const cactus = getFromPool(engine.obstaclePool, () => new Cactus());
                cactus.spawn(nextX);
                nextX += cactus.width + (5 + Math.random() * 20); 
            }
            
            engine.spawnTimer = 1.0 + (count * 0.4) + Math.random() * 1.2; 
            
            if(engine.gameSpeed < GAME_CONFIG.MAX_SPEED) {
                engine.gameSpeed += GAME_CONFIG.SPEED_INCREMENT; 
            }
        }
    };

    const spawnPlatforms = (dt: number) => {
        const engine = engineRef.current;
        engine.platformSpawnTimer -= dt;
        if (engine.platformSpawnTimer <= 0) {
            const platform = getFromPool(engine.platformPool, () => new OrganPlatform());
            platform.spawn(GAME_CONFIG.CANVAS_WIDTH + Math.random() * 120);
            engine.platformSpawnTimer = 2.6 + Math.random() * 1.8;
        }
    };

    const spawnPowerUps = (dt: number) => {
        const engine = engineRef.current;
        engine.powerUpSpawnTimer -= dt;
        if (engine.powerUpSpawnTimer <= 0) {
            const powerUp = getFromPool(engine.powerUpPool, () => new BacteriaPowerUp());
            powerUp.spawn(GAME_CONFIG.CANVAS_WIDTH + 80);
            engine.powerUpSpawnTimer = 9 + Math.random() * 7;
        }
    };

    const spawnGroundDetails = (dt: number) => {
        const engine = engineRef.current;
        engine.groundSpawnTimer -= dt;
        if (engine.groundSpawnTimer <= 0) {
            const detail = getFromPool(engine.groundPool, () => new GroundDetail());
            detail.spawn(GAME_CONFIG.CANVAS_WIDTH);
            engine.groundSpawnTimer = 0.05 + Math.random() * 0.2; 
        }
    };

    const gameOver = () => {
        const engine = engineRef.current;
        engine.gameRunning = false;
        engine.canRestart = false;
        
        setGameRunning(false);
        setCanRestart(false); 
        
        if (!mutedRef.current) {
            SoundSynth.playRoar();
        }
        
        setTimeout(() => {
            engine.canRestart = true;
            setCanRestart(true);
        }, 1000);
    };

    const runGameLoop = (timestamp: number) => {
        const engine = engineRef.current;
        if (!engine.gameRunning) return;

        if (!engine.lastTime) engine.lastTime = timestamp;
        // Cap Delta Time to prevent huge jumps on frame drops (0.1s max)
        const dt = Math.min((timestamp - engine.lastTime) / 1000, 0.1); 
        engine.lastTime = timestamp;
        if (engine.shieldRemaining > 0) engine.shieldRemaining = Math.max(0, engine.shieldRemaining - dt);
        const effectiveSpeed = engine.gameSpeed * (engine.shieldRemaining > 0 ? 2 : 1);
        const theme = bodyThemeRef.current;

        const canvas = canvasRef.current!;
        const ctx = canvas.getContext('2d', { alpha: false })!; // Optimize for no transparency

        // 1. Draw Background (Clear)
        // "Camera làm nền" ON: vẽ khung camera (mirror) mờ phủ kín canvas
        // game rồi phủ thêm 1 lớp trắng bán trong suốt để chữ/vật thể
        // trong game vẫn đọc được rõ — thay thế cho khung camera nhỏ
        // riêng, tiết kiệm không gian màn hình. Nếu camera chưa sẵn sàng,
        // fallback về nền trắng như cũ.
        const video = videoRef.current;
        if (cameraModeRef.current === 'background' && video && video.readyState >= 2 && video.videoWidth > 0) {
            // Chỉ vẽ lại (mirror) từ <video> vào canvas cache mỗi ~66ms
            // (~15fps) — hiệu ứng nền mờ không cần mượt 60fps, trong khi
            // ctx.drawImage(video,...) + scale(-1,1) mỗi frame game loop
            // là phần tốn CPU/GPU nhất khiến mode 'background' bị chậm.
            const nowTs = performance.now();
            if (!bgCacheCanvasRef.current) {
                bgCacheCanvasRef.current = document.createElement('canvas');
                bgCacheCanvasRef.current.width = canvas.width;
                bgCacheCanvasRef.current.height = canvas.height;
            }
            const bgCache = bgCacheCanvasRef.current;
            if (nowTs - bgCacheLastDrawRef.current > 66) {
                bgCacheLastDrawRef.current = nowTs;
                const bgCtx = bgCache.getContext('2d')!;
                bgCtx.save();
                bgCtx.scale(-1, 1);
                bgCtx.drawImage(video, -bgCache.width, 0, bgCache.width, bgCache.height);
                bgCtx.restore();
            }
            ctx.save();
            ctx.globalAlpha = 0.5;
            ctx.drawImage(bgCache, 0, 0);
            ctx.restore();
            ctx.fillStyle = theme.bgOverlay;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        } else {
            ctx.fillStyle = theme.bg;
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        // Set global styles for the frame
        ctx.strokeStyle = theme.primary;
        ctx.fillStyle = theme.primary;
        ctx.lineWidth = 2;

        // 2. Draw Ground Line
        ctx.beginPath();
        ctx.moveTo(0, GAME_CONFIG.GROUND_Y);
        ctx.lineTo(canvas.width, GAME_CONFIG.GROUND_Y);
        ctx.stroke();
        ctx.fillStyle = theme.vessel;
        ctx.fillRect(0, GAME_CONFIG.GROUND_Y + 4, canvas.width, 9);
        ctx.fillStyle = GAME_CONFIG.COLORS.WHITE;
        ctx.font = '10px monospace';
        ctx.textAlign = 'left';
        ctx.fillText(theme.terrainText, 12, GAME_CONFIG.GROUND_Y + 12);
        ctx.fillStyle = theme.primary;

        // 3. Logic & Draw Ground Details
        spawnGroundDetails(dt);
        // Using For loop instead of forEach for perf
        for(let i = 0; i < engine.groundPool.length; i++) {
            const detail = engine.groundPool[i];
            if (detail.active) {
                detail.update(dt, effectiveSpeed);
                detail.draw(ctx, theme);
            }
        }

        // 4. Floating organ platforms — nội tạng làm bậc thang lơ lửng
        spawnPlatforms(dt);
        for (let i = 0; i < engine.platformPool.length; i++) {
            const platform = engine.platformPool[i];
            if (!platform.active) continue;
            platform.update(dt, effectiveSpeed);
            platform.draw(ctx, theme);
        }

        const dino = engine.dino;

        // 5. Logic & Draw Dino
        engine.dino.update(dt, () => {
            if (!mutedRef.current) SoundSynth.playStep();
        });
        for (let i = 0; i < engine.platformPool.length; i++) {
            const platform = engine.platformPool[i];
            if (!platform.active) continue;
            const fallingOntoPlatform = dino.dy >= 0 && dino.y + dino.height >= platform.y && dino.y + dino.height <= platform.y + 18;
            if (fallingOntoPlatform && dino.x + dino.width > platform.x && dino.x < platform.x + platform.width) {
                dino.y = platform.y - dino.height;
                dino.dy = 0;
                dino.grounded = true;
            }
        }
        engine.dino.draw(ctx, theme);
        if (engine.shieldRemaining > 0) {
            ctx.save();
            ctx.globalAlpha = 0.45 + Math.sin(timestamp / 80) * 0.25;
            ctx.strokeStyle = GAME_CONFIG.COLORS.SHIELD;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(dino.x + dino.width / 2, dino.y + dino.height / 2 - 4, 34, 0, Math.PI * 2);
            ctx.stroke();
            ctx.restore();
        }

        // 5. Logic & Draw Obstacles
        spawnObstacle(dt);
        const padding = 10;
        
        for(let i = 0; i < engine.obstaclePool.length; i++) {
            const obs = engine.obstaclePool[i];
            if (obs.active) {
                obs.update(dt, effectiveSpeed);
                obs.draw(ctx, theme);
                
                // Collision Detection (Active obstacles only)
                if (
                    dino.x < obs.x + obs.width - padding &&
                    dino.x + dino.width > obs.x + padding &&
                    dino.y < obs.y + obs.height - padding &&
                    dino.y + dino.height > obs.y + padding
                ) {
                    if (engine.shieldRemaining <= 0) {
                        gameOver();
                    } else {
                        obs.active = false;
                    }
                    // Don't return, let the frame finish drawing
                }
            }
        }

        // 6. Lợi khuẩn xanh bay vòng vòng: ăn để có khiên 20s, xuyên virus/ung thư và tốc độ x2
        spawnPowerUps(dt);
        for (let i = 0; i < engine.powerUpPool.length; i++) {
            const powerUp = engine.powerUpPool[i];
            if (!powerUp.active) continue;
            powerUp.update(dt, effectiveSpeed);
            powerUp.draw(ctx, theme);
            if (dino.x < powerUp.x + 22 && dino.x + dino.width > powerUp.x - 22 && dino.y < powerUp.y + 18 && dino.y + dino.height > powerUp.y - 18) {
                powerUp.active = false;
                engine.shieldRemaining = SHIELD_DURATION;
            }
        }

        if (engine.shieldRemaining > 0) {
            const ratio = engine.shieldRemaining / SHIELD_DURATION;
            const color = ratio > 0.5 ? '#22c55e' : (ratio > 0.25 ? '#facc15' : '#ef4444');
            ctx.fillStyle = 'rgba(0,0,0,0.12)';
            ctx.fillRect(20, 42, 180, 12);
            ctx.fillStyle = color;
            ctx.fillRect(20, 42, 180 * ratio, 12);
            ctx.fillStyle = GAME_CONFIG.COLORS.PRIMARY;
            ctx.font = '10px monospace';
            ctx.textAlign = 'left';
            ctx.fillText(`KHIÊN ${Math.ceil(engine.shieldRemaining)}s · SPEED x2`, 20, 68);
        }

        // 7. Draw Score
        if (engine.gameRunning) { // Double check in case of game over mid-loop
            engine.score += 60 * dt;
            const scoreStr = `HI ${Math.floor(engine.score/10)}`;
            // Font is set once ideally, but to be safe:
            ctx.font = "16px 'Press Start 2P'";
            ctx.textAlign = "right";
            ctx.fillText(scoreStr, canvas.width - 20, 30);
            
            engine.animationId = requestAnimationFrame(runGameLoop);
        }
    };

    const resetGame = () => {
        const engine = engineRef.current;
        
        // Deactivate all pool items
        engine.obstaclePool.forEach(p => p.active = false);
        engine.groundPool.forEach(p => p.active = false);
        engine.platformPool.forEach(p => p.active = false);
        engine.powerUpPool.forEach(p => p.active = false);
        
        // Populate initial ground
        for (let x = 0; x < GAME_CONFIG.CANVAS_WIDTH; x += 30 + Math.random() * 60) {
            const detail = getFromPool(engine.groundPool, () => new GroundDetail());
            detail.spawn(x);
        }

        engine.score = 0;
        engine.canRestart = false;
        engine.gameSpeed = GAME_CONFIG.INITIAL_SPEED;
        engine.spawnTimer = 0;
        engine.groundSpawnTimer = 0;
        engine.platformSpawnTimer = 1.1;
        engine.powerUpSpawnTimer = 4;
        engine.shieldRemaining = 0;
        engine.dino.reset();
        engine.lastTime = 0;
        engine.gameRunning = true;
        
        setGameRunning(true);
        setCanRestart(false);
        
        runGameLoop(0);
    };

    const manualStart = () => {
        SoundSynth.init();
        setHasStarted(true);
        engineRef.current.hasStarted = true;
        resetGame();
    };

    const handleJumpSignal = () => {
        if (jumpSignalRef.current) {
            jumpSignalRef.current.classList.add('active');
            setTimeout(() => jumpSignalRef.current?.classList.remove('active'), 200);
        }

        const engine = engineRef.current;
        if (engine.gameRunning) {
            const jumped = engine.dino.jump();
            if (jumped && !mutedRef.current) {
                SoundSynth.playJump();
            }
        } else if (!engine.gameRunning && engine.canRestart) {
            resetGame();
        } else if (!engine.hasStarted && (engine.cameraReady || cameraModeRef.current === 'off')) {
            manualStart();
        }
    };

    // --- VISION LOGIC ---

    const predictWebcam = () => {
        const video = videoRef.current;
        const outCanvas = outputCanvasRef.current;
        const engine = engineRef.current;
        
        if (!video || !outCanvas || !visionRef.current.poseLandmarker) {
            engine.visionAnimationId = requestAnimationFrame(predictWebcam);
            return;
        }

        const now = performance.now();
        const timeSinceLast = now - visionRef.current.lastPredictionTime;
        const frameInterval = 1000 / GAME_CONFIG.VISION_FPS;

        if (timeSinceLast < frameInterval) {
            engine.visionAnimationId = requestAnimationFrame(predictWebcam);
            return;
        }
        visionRef.current.lastPredictionTime = now;

        const state = visionRef.current;
        const { poseLandmarker } = state;

        if (video.videoWidth > 0 && video.videoHeight > 0) {
             if (outCanvas.width !== video.videoWidth || outCanvas.height !== video.videoHeight) {
                outCanvas.width = video.videoWidth;
                outCanvas.height = video.videoHeight;
             }
        }

        const outCtx = outCanvas.getContext('2d', { alpha: true })!;
        
        // FIX: log lỗi thật gửi lên cho thấy MediaPipe SẬP HẲN graph khi
        // gọi detectForVideo() lúc video KHÔNG có frame hợp lệ (video bị
        // mất frame tạm thời — ví dụ chuyển tab rồi quay lại, camera giật
        // 1 nhịp): "ROI width and height must be > 0" (Uncaught Error),
        // sau đó pose landmarker coi như hỏng luôn, không nhận diện được
        // nữa cho tới khi tải lại trang. Chặn: chỉ gọi detectForVideo khi
        // video thực sự sẵn sàng (readyState >= 2 nghĩa là có đủ dữ liệu
        // cho ít nhất 1 frame, và có kích thước > 0) + bọc try/catch để 1
        // lần lỗi thoáng qua không làm chết hẳn vòng lặp requestAnimationFrame.
        const videoReady =
            video.readyState >= 2 && video.videoWidth > 0 && video.videoHeight > 0;

        let didUpdate = false;
        if (videoReady && state.lastVideoTime !== video.currentTime) {
            state.lastVideoTime = video.currentTime;
            try {
                state.results = poseLandmarker.detectForVideo(video, now);
                didUpdate = true;
            } catch (err) {
                console.warn('[dino-jump] detectForVideo lỗi thoáng qua, bỏ qua frame này:', err);
            }
        }
        
        outCtx.clearRect(0, 0, outCanvas.width, outCanvas.height);
        
        if (state.results && state.results.landmarks && state.results.landmarks.length > 0) {
            const landmarks = state.results.landmarks[0];
            const leftShoulder = landmarks[11];
            const rightShoulder = landmarks[12];

            outCtx.beginPath();
            outCtx.moveTo(leftShoulder.x * outCanvas.width, leftShoulder.y * outCanvas.height);
            outCtx.lineTo(rightShoulder.x * outCanvas.width, rightShoulder.y * outCanvas.height);
            outCtx.strokeStyle = GAME_CONFIG.COLORS.ACCENT;
            outCtx.lineWidth = 3;
            outCtx.stroke();

            outCtx.fillStyle = '#00FF00';
            // Simple loop
            const shoulders = [leftShoulder, rightShoulder];
            for (let i = 0; i < shoulders.length; i++) {
                outCtx.beginPath();
                outCtx.arc(shoulders[i].x * outCanvas.width, shoulders[i].y * outCanvas.height, 5, 0, 2 * Math.PI);
                outCtx.fill();
            }

            if (didUpdate) {
                // FIX: trước đây tính currentY và shoulderDist bằng toạ độ
                // normalized (0..1) THẲNG, tức là trộn lẫn đơn vị trục X và
                // trục Y — sai vì camera xin ở độ phân giải 320x240 (KHÔNG
                // vuông, tỉ lệ 4:3), nên "1 đơn vị normalized theo chiều
                // rộng" và "1 đơn vị normalized theo chiều cao" không đại
                // diện cho cùng 1 khoảng cách vật lý thật. Kết quả: tỉ số
                // dy/shoulderDist bị lệch tỉ lệ khung hình, khiến ngưỡng
                // nhảy (JUMP_VELOCITY_THRESHOLD) không phản ánh đúng độ
                // nhảy thật ngoài đời — nhảy thật có thể không bao giờ vượt
                // ngưỡng (hoặc ngược lại quá nhạy), tuỳ camera. Sửa: quy
                // đổi cả 2 đại lượng về cùng đơn vị PIXEL THẬT (dùng
                // video.videoWidth/videoHeight) trước khi tính tỉ số, để
                // dy và shoulderDist luôn cùng thang đo bất kể tỉ lệ khung
                // hình camera.
                const vw = video.videoWidth || outCanvas.width;
                const vh = video.videoHeight || outCanvas.height;
                const currentY = ((leftShoulder.y + rightShoulder.y) / 2) * vh;
                const shoulderDist = Math.hypot(
                    (leftShoulder.x - rightShoulder.x) * vw,
                    (leftShoulder.y - rightShoulder.y) * vh,
                );
                
                const currentTime = video.currentTime;
                let currentVelocity = 0;
                let dt = 0;
                let dy = 0;

                if (state.prevTime > 0 && currentTime > state.prevTime && shoulderDist > 0) {
                    dt = currentTime - state.prevTime;
                    dy = state.prevY - currentY;
                    const normalizedDy = dy / shoulderDist;
                    currentVelocity = normalizedDy / dt;
                }

                state.smoothedVelocity = state.smoothedVelocity * 0.5 + currentVelocity * 0.5;

                if (state.smoothedVelocity > state.peakVelocity) {
                    state.peakVelocity = state.smoothedVelocity;
                } else {
                    state.peakVelocity *= 0.95;
                }

                // Giữ log debug đã throttle để dễ canh độ nhạy thực tế.
                // Ngưỡng hiện được đặt thấp hơn để camera bắt lệnh JUMP dễ
                // hơn, song song với cử chỉ ngón trỏ/ngón cái chỉ lên trời.
                if (Math.random() < 0.1) {
                    console.debug('[dino-jump] vel-debug', {
                        dt: dt.toFixed(4),
                        dy: dy.toFixed(2),
                        shoulderDist: shoulderDist.toFixed(1),
                        rawVelocity: currentVelocity.toFixed(3),
                        smoothedVelocity: state.smoothedVelocity.toFixed(3),
                        peakVelocity: state.peakVelocity.toFixed(3),
                        threshold: state.JUMP_VELOCITY_THRESHOLD,
                    });
                }

                state.prevY = currentY;
                state.prevTime = currentTime;

                const upwardFingerGesture = isIndexOrThumbPointingUp(landmarks);
                const canTriggerGestureJump = now - state.lastGestureJumpTime > GESTURE_JUMP_COOLDOWN_MS;

                if (state.smoothedVelocity > state.JUMP_VELOCITY_THRESHOLD || (upwardFingerGesture && canTriggerGestureJump)) {
                    state.lastGestureJumpTime = now;
                    handleJumpSignal();
                }
            }

            drawDebugOverlay(outCtx, state);
        }

        engine.visionAnimationId = requestAnimationFrame(predictWebcam);
    };

    const drawDebugOverlay = (ctx: CanvasRenderingContext2D, state: VisionState) => {
        const barH = 100;
        const barW = 15;
        const barX = 20; 
        const barY = 50;
        const maxVal = state.JUMP_VELOCITY_THRESHOLD * 1.5;

        ctx.fillStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.fillRect(barX, barY, barW, barH);

        const threshPixel = (state.JUMP_VELOCITY_THRESHOLD / maxVal) * barH;
        const threshY = barY + barH - threshPixel;
        ctx.fillStyle = 'red';
        ctx.fillRect(barX - 5, threshY, barW + 10, 2);

        const fillRatio = Math.min(Math.max(state.smoothedVelocity / maxVal, 0), 1);
        const currentH = fillRatio * barH;
        
        const isCrossing = state.smoothedVelocity > state.JUMP_VELOCITY_THRESHOLD;
        ctx.fillStyle = isCrossing ? '#00FF00' : '#FFFF00';
        ctx.fillRect(barX, barY + barH - currentH, barW, currentH);

        const peakRatio = Math.min(Math.max(state.peakVelocity / maxVal, 0), 1);
        const peakH = peakRatio * barH;
        ctx.fillStyle = 'rgba(0, 255, 0, 0.7)'; 
        ctx.fillRect(barX, barY + barH - peakH, barW, 2);

        ctx.save();
        ctx.scale(-1, 1); 
        ctx.fillStyle = '#00FF00';
        ctx.font = '12px monospace';
        ctx.fillText(`VEL : ${state.smoothedVelocity.toFixed(2)}`, -(barX + 70), barY + barH + 20);
        ctx.fillStyle = 'red';
        ctx.fillText(`THR : ${state.JUMP_VELOCITY_THRESHOLD.toFixed(2)}`, -(barX + 70), barY + barH + 35);
        ctx.restore();
    };

    const enableCam = async () => {
        SoundSynth.init();
        if (!visionRef.current.poseLandmarker) return;

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: 320, height: 240 }
            });
            
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                videoRef.current.addEventListener("loadeddata", () => {
                    predictWebcam();
                    setCameraReady(true);
                    engineRef.current.cameraReady = true;
                });
            }
        } catch(err) {
            console.error(err);
            alert("Please enable camera access to play!");
        }
    };

    // Dừng hẳn camera + vòng lặp nhận diện pose — dùng khi chuyển sang
    // cameraMode 'off' (không cần webcam nữa, điều khiển bằng Space/nút ảo).
    const stopCamera = () => {
        const video = videoRef.current;
        const stream = video?.srcObject as MediaStream | null;
        if (stream) {
            stream.getTracks().forEach((tr) => tr.stop());
        }
        if (video) video.srcObject = null;
        cancelAnimationFrame(engineRef.current.visionAnimationId);
        setCameraReady(false);
        engineRef.current.cameraReady = false;
    };

    // 1 toggle nhiều trạng thái: background -> below -> hidden -> off -> (lặp).
    // Gọi enableCam()/stopCamera() NGAY TRONG cùng lần click (user-gesture)
    // để trình duyệt không chặn prompt xin quyền camera (getUserMedia cần
    // gesture thật, không thể gọi an toàn từ useEffect).
    const cycleCameraMode = () => {
        const currentIndex = CAMERA_MODE_ORDER.indexOf(cameraModeRef.current);
        const next = CAMERA_MODE_ORDER[(currentIndex + 1) % CAMERA_MODE_ORDER.length];
        if (next === 'off') {
            stopCamera();
        } else if (!engineRef.current.cameraReady && visionRef.current.poseLandmarker) {
            enableCam();
        }
        setCameraMode(next);
    };

    useEffect(() => {
        // Trước đây: import cả thư viện lẫn WASM từ CDN jsdelivr, và model từ
        // storage.googleapis.com — 3 lần gọi mạng ngoài, không timeout, không
        // fallback. Giờ: dùng package @mediapipe/tasks-vision đã cài (không
        // qua CDN), WASM local (public/wasm/, xem scripts-copy-mediapipe-wasm.mjs),
        // và model tự host (public/models/, xem scripts-copy-mediapipe-models.mjs)
        // — thử local trước, rơi về CDN gốc nếu local lỗi/thiếu. Mọi bước đều
        // có timeout để tránh treo vô hạn như bug đã gặp ở Remix Sức Khỏe KOL.
        const INIT_STEP_TIMEOUT_MS = 15_000;

        function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
            return new Promise((resolve, reject) => {
                const timer = setTimeout(() => {
                    reject(new Error(`${label} timed out after ${Math.round(ms / 1000)}s`));
                }, ms);
                promise.then(
                    (value) => { clearTimeout(timer); resolve(value); },
                    (err) => { clearTimeout(timer); reject(err); },
                );
            });
        }

        const initMediaPipe = async () => {
            try {
                const { PoseLandmarker, FilesetResolver } = await import('@mediapipe/tasks-vision');

                const vision = await withTimeout(
                    FilesetResolver.forVisionTasks(MEDIAPIPE_VISION_WASM_URL),
                    INIT_STEP_TIMEOUT_MS,
                    'MediaPipe WASM fileset load',
                );

                const createPoseLandmarker = (modelAssetPath: string, delegate: 'GPU' | 'CPU') =>
                    withTimeout(
                        PoseLandmarker.createFromOptions(vision, {
                            baseOptions: { modelAssetPath, delegate },
                            runningMode: 'VIDEO',
                            numPoses: 1,
                        }),
                        INIT_STEP_TIMEOUT_MS,
                        `Pose model init (${delegate}, ${modelAssetPath})`,
                    );

                let poseLandmarker;
                try {
                    // Thử model tự host trước, GPU trước rồi CPU nếu GPU treo/lỗi.
                    try {
                        poseLandmarker = await createPoseLandmarker(MEDIAPIPE_MODEL_URLS.pose.local, 'GPU');
                    } catch (gpuErr) {
                        console.warn('MediaPipe GPU delegate failed/timed out (local model), falling back to CPU:', gpuErr);
                        poseLandmarker = await createPoseLandmarker(MEDIAPIPE_MODEL_URLS.pose.local, 'CPU');
                    }
                } catch (localErr) {
                    console.warn('MediaPipe local pose model failed, falling back to CDN:', localErr);
                    try {
                        poseLandmarker = await createPoseLandmarker(MEDIAPIPE_MODEL_URLS.pose.cdn, 'GPU');
                    } catch (gpuErr) {
                        console.warn('MediaPipe GPU delegate failed/timed out (CDN model), falling back to CPU:', gpuErr);
                        poseLandmarker = await createPoseLandmarker(MEDIAPIPE_MODEL_URLS.pose.cdn, 'CPU');
                    }
                }

                visionRef.current.poseLandmarker = poseLandmarker;

                setIsLoading(false);
                setModelLoaded(true);
            } catch (err) {
                console.error(err);
                setStatus("Failed to load AI.");
            }
        };

        initMediaPipe();

        return () => {
            cancelAnimationFrame(engineRef.current.animationId);
            cancelAnimationFrame(engineRef.current.visionAnimationId);
        };
    }, []);

    // Phím Space vật lý — điều khiển thay thế, luôn hoạt động (không chỉ khi
    // cameraMode = 'off'), song song với AI camera. handleJumpSignal chỉ đọc
    // từ refs nên đóng gói 1 lần ở đây vẫn luôn "current".
    useEffect(() => {
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.code !== 'Space' && e.key !== ' ') return;
            // Không chặn Space khi người dùng đang gõ vào input/textarea khác trên trang.
            const target = e.target as HTMLElement | null;
            if (target && ['INPUT', 'TEXTAREA'].includes(target.tagName)) return;
            e.preventDefault();
            handleJumpSignal();
        };
        window.addEventListener('keydown', onKeyDown);
        return () => window.removeEventListener('keydown', onKeyDown);
    }, []);

    return (
        <div className="flex flex-col items-center gap-5 w-full max-w-4xl relative">

            {/* STATUS — chuyển lên đầu trang cùng toggle chế độ camera, để
                khung game và khung camera preview (mode 'below') nằm sát
                nhau hơn, không còn bị chữ trạng thái + toggle chen ở giữa. */}
            <div className="text-sm text-[#666] min-h-[1.25rem] font-['Press_Start_2P'] text-center w-full px-2">
                {status}
            </div>

            {/* CONTROLS */}
            <div className="text-xs text-[#888] text-center font-['Press_Start_2P'] flex flex-wrap items-center justify-center gap-4">
                {/* 1 toggle nhiều trạng thái thay cho 2 toggle cũ (Show Camera
                    Feed checkbox + Camera as Background button): click để
                    xoay vòng background -> below -> hidden -> off. */}
                <button
                    type="button"
                    onClick={cycleCameraMode}
                    className={`px-2 py-1 rounded border transition-colors ${cameraMode === 'off' ? 'border-[#ccc] text-[#888] hover:text-[#535353] hover:border-[#535353]' : 'text-white'}`}
                    style={cameraMode === 'off' ? undefined : { background: bodyTheme.primary, borderColor: bodyTheme.primary }}
                    title={`${CAMERA_MODE_INFO[cameraMode].hint} — click to switch camera mode`}
                >
                    {CAMERA_MODE_INFO[cameraMode].icon} {CAMERA_MODE_INFO[cameraMode].label}
                </button>
            </div>

            <div className="w-full max-w-2xl -mt-2">
                <div className="text-[9px] text-[#888] text-center font-['Press_Start_2P'] mb-2">Chọn hệ nội tạng để đổi theme</div>
                <div className="grid grid-cols-3 sm:grid-cols-6 gap-2" role="group" aria-label="Body organ theme selector">
                    {BODY_THEMES.map((themeOption) => {
                        const selected = bodyTheme.id === themeOption.id;
                        return (
                            <button
                                key={themeOption.id}
                                type="button"
                                onClick={() => setBodyTheme(themeOption)}
                                className={`rounded-xl border-2 px-2 py-2 text-center shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-offset-2 ${selected ? 'scale-105 text-white' : 'bg-white text-[#535353] hover:-translate-y-0.5'}`}
                                style={{
                                    borderColor: themeOption.accent,
                                    background: selected ? `linear-gradient(135deg, ${themeOption.primary}, ${themeOption.accent})` : themeOption.bg,
                                    boxShadow: selected ? `0 0 0 3px ${themeOption.bg}, 0 8px 18px ${themeOption.accent}55` : undefined,
                                }}
                                aria-pressed={selected}
                                title={`${themeOption.name} · ${themeOption.label}`}
                            >
                                <div className="text-lg leading-none">{themeOption.icon}</div>
                                <div className="mt-1 text-[8px] font-['Press_Start_2P'] leading-tight">{themeOption.name}</div>
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* GAME CANVAS */}
            <div className="relative">
                <canvas 
                    ref={canvasRef} 
                    width={GAME_CONFIG.CANVAS_WIDTH} 
                    height={GAME_CONFIG.CANVAS_HEIGHT}
                    className="border-2 rounded-lg shadow-md max-w-full"
                    style={{ background: bodyTheme.bg, borderColor: bodyTheme.primary }}
                />

                {/* GESTURE INDICATOR — tách khỏi khung camera 320x240 để vẫn
                    hiển thị được ở cameraMode 'hidden' (ẩn camera, vẫn thấy
                    cử chỉ) lẫn 'background'/'below'. Ẩn hẳn khi mode = 'off'. */}
                {cameraMode !== 'off' && (
                    <div
                        ref={jumpSignalRef}
                        title="Gesture detected"
                        className="absolute top-[4%] right-[2.5%] z-20 w-4 h-4 bg-[#ccc] rounded-full transition-all duration-100 [&.active]:bg-[#ff5252] [&.active]:shadow-[0_0_10px_#ff5252]"
                    ></div>
                )}

                {/* MUTE BUTTON */}
                <button
                    onClick={() => setIsMuted(!isMuted)}
                    className={`group absolute top-[4%] left-[2.5%] z-20 w-[3%] h-auto text-[#535353] hover:text-[#333] transition-colors focus:outline-none focus:ring-2 focus:ring-[${GAME_CONFIG.COLORS.FOCUS}] rounded-sm aspect-square`}
                    aria-label={isMuted ? "Unmute" : "Mute"}
                    style={{ minWidth: '1px' }}
                >
                    {isMuted ? (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                            <path d="M11 5L6 9H2v6h4l5 4V5z"></path>
                            <line x1="23" y1="9" x2="17" y2="15"></line>
                            <line x1="17" y1="9" x2="23" y2="15"></line>
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-full h-full">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                    )}
                    <span className="absolute left-full top-1/2 -translate-y-1/2 ml-2 px-2 py-1 bg-[#333] text-white text-[0.65rem] font-['Press_Start_2P'] rounded opacity-0 group-hover:opacity-100 group-focus:opacity-100 transition-opacity duration-200 pointer-events-none whitespace-nowrap shadow-sm z-30">
                        {isMuted ? "Unmute" : "Mute"}
                    </span>
                </button>
                
                {/* START SCREEN */}
                {(!gameRunning && !canRestart && !hasStarted) && (
                    <div className="absolute top-0 left-0 w-full h-full bg-white/80 flex flex-col items-center justify-center z-10 rounded-lg">
                        {(isLoading && cameraMode !== 'off') ? (
                            <>
                                <div className="w-8 h-8 border-4 border-[#f3f3f3] border-t-[#535353] rounded-full animate-spin mb-5"></div>
                                <p className="font-['Press_Start_2P'] text-xs text-[#535353]">Loading AI Model...</p>
                            </>
                        ) : (
                            <div className="flex flex-col items-center gap-4">
                                {(!cameraReady && cameraMode !== 'off') ? (
                                    <button 
                                        onClick={enableCam} 
                                        className={`px-5 py-3 bg-transparent border-2 border-[#535353] text-[#535353] font-['Press_Start_2P'] text-base cursor-pointer hover:bg-[#535353] hover:text-white transition-colors focus:outline-none focus:ring-2 focus:ring-[${GAME_CONFIG.COLORS.FOCUS}] focus:ring-offset-2`}
                                    >
                                        ENABLE CAMERA
                                    </button>
                                ) : (
                                    <>
                                        <button 
                                            onClick={manualStart} 
                                            className={`px-5 py-3 bg-[#535353] border-2 border-[#535353] text-white font-['Press_Start_2P'] text-base cursor-pointer hover:bg-[${GAME_CONFIG.COLORS.FOCUS}] hover:border-[${GAME_CONFIG.COLORS.FOCUS}] transition-colors focus:outline-none focus:ring-2 focus:ring-[${GAME_CONFIG.COLORS.FOCUS}] focus:ring-offset-2`}
                                        >
                                            START GAME
                                        </button>
                                        <p className="font-['Press_Start_2P'] text-xs text-[#535353] animate-pulse">
                                            {cameraMode === 'off' ? 'OR PRESS SPACE / TAP TO START' : 'OR JUMP / POINT UP TO START'}
                                        </p>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {/* GAME OVER SCREEN */}
                {(hasStarted && !gameRunning) && (
                    <div className="absolute top-0 left-0 w-full h-full bg-black/50 flex flex-col items-center justify-center z-10 rounded-lg text-center p-2 md:p-4">
                        <div className="text-white text-xl md:text-3xl font-['Press_Start_2P'] mb-3 md:mb-6 drop-shadow-md">GAME OVER</div>
                        <div className="text-white text-xs md:text-sm font-['Press_Start_2P'] mb-2 md:mb-4 animate-pulse drop-shadow-md">
                            {canRestart ? "JUMP / POINT UP TO RESTART" : "..."}
                        </div>
                        <div className="text-white/90 text-[8px] font-['Press_Start_2P'] bg-black/40 p-1 md:p-2 rounded">
                            <a href="/?page=gameSucKhoe" target="_top" className={`text-[${GAME_CONFIG.COLORS.FOCUS}] no-underline hover:underline focus:outline-none focus:ring-2 focus:ring-[${GAME_CONFIG.COLORS.FOCUS}] rounded-sm`}>Game Sức Khỏe by Zero to Forever Foundation</a>
                        </div>
                    </div>
                )}
            </div>

            {/* VISION CONTAINER — chỉ HIỂN THỊ (CSS) khung xem camera nhỏ ở
                mode 'below'; các mode khác dùng class "hidden" chứ KHÔNG
                unmount <video>/<canvas>, để camera vẫn tiếp tục stream và
                predictWebcam() vẫn tiếp tục nhận diện pose bình thường ở mode
                'background' (vẽ thẳng vào canvas game, xem runGameLoop) và
                'hidden' (không vẽ gì, chỉ còn chấm báo hiệu cử chỉ ở trên). */}
            <div 
                className={`relative w-[320px] h-[240px] border-2 border-[#ccc] rounded-lg overflow-hidden bg-black ${cameraMode === 'below' ? 'block' : 'hidden'}`}
            >
                <video 
                    ref={videoRef} 
                    autoPlay 
                    playsInline 
                    className="w-full h-full object-cover scale-x-[-1]"
                ></video>
                <canvas 
                    ref={outputCanvasRef} 
                    className="absolute top-0 left-0 w-full h-full scale-x-[-1]"
                ></canvas>
            </div>

            {/* NÚT NHẢY ẢO — luôn hiển thị trên màn hình (không chỉ khi tắt
                camera), để chơi được bằng cảm ứng bất cứ lúc nào, song song
                với AI camera và phím Space vật lý. */}
            <button
                type="button"
                onClick={handleJumpSignal}
                onTouchStart={(e) => { e.preventDefault(); handleJumpSignal(); }}
                className={`w-full max-w-xs py-4 rounded-xl text-white font-['Press_Start_2P'] text-xs tracking-wide select-none touch-manipulation transition-colors focus:outline-none focus:ring-2 focus:ring-[${GAME_CONFIG.COLORS.FOCUS}] focus:ring-offset-2`}
                style={{ background: bodyTheme.primary }}
                aria-label="Jump (Space key)"
            >
                ⬆ JUMP (SPACE / 👆👍)
            </button>
        </div>
    );
};

export default DinoGame;