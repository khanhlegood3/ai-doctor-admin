/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from "react";
import { PetState, AccessoryType } from "../types";
import { ICON_PATHS, IconWrapper } from "./Icons";

interface PetDisplayProps {
  color: string;
  secondaryColor: string;
  state: PetState;
  hasPoop: boolean;
  stage: "BABY" | "ADOLESCENT" | "TEENAGER" | "ADULT";
  equippedAccessory?: AccessoryType;
  scale?: number;
  currentLevel: number;
}

const PetDisplay: React.FC<PetDisplayProps> = ({
  color,
  state,
  hasPoop,
  stage,
  equippedAccessory,
  scale = 1,
  currentLevel,
}) => {
  const isSleeping = state === PetState.SLEEPING;
  const isHappy = state === PetState.HAPPY;
  const isEating = state === PetState.EATING;
  const isScared = state === PetState.SCARED;
  const isAngry = state === PetState.ANGRY;
  const isInjured = state === PetState.INJURED;
  const isSick = state === PetState.SICK;
  const isAdult = stage === "ADULT";

  // Determine main animation class
  let animationClass = "animate-breathe";
  if (isEating) animationClass = "animate-chomp";
  else if (isHappy) animationClass = "animate-happy-bounce";
  else if (isSleeping) animationClass = "animate-snooze";
  else if (isScared || isSick) animationClass = "animate-tremble";
  else if (isAngry) animationClass = "animate-jitter";

  let finalColor = color;
  if(isAdult) {
    // should import and use GOOGLE_COLORS
    if(color == '#FFF') {
      finalColor = 'url(#whiteGradient)';
    } else if(color == '#1A73E8') {
      finalColor = 'url(#blueGradient)';
    } else if(color == '#34A853') {
      finalColor = 'url(#greenGradient)';
    } else if(color == '#FBBC04') {
      finalColor = 'url(#yellowGradient)';
    } else if (color == '#EA4335') {
      finalColor = 'url(#redGradient)';
    }
  }

  return (
    <div
      className={`relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center pixel-render transition-all duration-1000 ${animationClass}`}
      style={{ transform: `scale(${scale})` }}
    >
      {/* Poop Icon */}
      {hasPoop && (
        <div className="absolute text-4xl z-20 animate-bounce bottom-[0%] left-[5%]">💩</div>
      )}

      <svg
        viewBox="0 0 137 144"
        className="w-full h-full drop-shadow-[0_20px_30px_rgba(0,0,0,0.15)] overflow-visible"
      >
        <defs>
          <linearGradient id="rainbowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#38bdf8" }} />
            <stop offset="25%" style={{ stopColor: "#a855f7" }} />
            <stop offset="50%" style={{ stopColor: "#ec4899" }} />
            <stop offset="75%" style={{ stopColor: "#f97316" }} />
            <stop offset="100%" style={{ stopColor: "#eab308" }} />
          </linearGradient>
          <linearGradient id="blueGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#4275F4" }} />
            <stop offset="95.67%" style={{ stopColor: "#34A853" }} />
          </linearGradient>
          <linearGradient id="whiteGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#FFF" }} />
            <stop offset="77.74%" style={{ stopColor: "#BB55A1" }} />
          </linearGradient>
          <linearGradient id="greenGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#34A853" }} />
            <stop offset="100%" style={{ stopColor: "#FB0" }} />
          </linearGradient>
          <linearGradient id="yellowGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#FB0" }} />
            <stop offset="100%" style={{ stopColor: "#EA4335" }} />
          </linearGradient>
          <linearGradient id="redGradient" x1="0%" y1="0%" x2="0%" y2="100%">
            <stop offset="0%" style={{ stopColor: "#EA4335" }} />
            <stop offset="100%" style={{ stopColor: "#4279E9" }} />
          </linearGradient>
        </defs>

        {/* New High-Res Dino Body */}
        <path
          d={
            `M103.051 70.2276H96.2477V93.6367H89.4442V103.669H82.6408V110.358H75.8375V137.111H82.6408V143.799H69.034V123.734H62.2306V117.046H55.4273V123.734H48.6238V130.423H41.8204V137.111H48.6238V143.799H35.0171V117.046H28.2136V110.358H21.4102V103.669H14.6068V96.9809H7.8034V90.2926H1V50.1626H7.8034V63.5391H14.6068V70.2276H21.4102V76.9158H35.0171V70.2276H41.8204V63.5391H52.0255V56.8509H62.2306V50.1626H69.034V6.68833H75.8375V0H130.265V6.68833H137.068V36.7859H103.051V43.4741H123.461V50.1626H96.2477V63.5391H109.854V76.9158H103.051V70.2276ZM82.6408 ${
              isSleeping? "15V16.7208H89.4442V15H82.6408Z" : "10.0325V16.7208H89.4442V10.0325H82.6408Z"}`
            }
          fill={finalColor}
          style={{
            transform: !isAdult ? "scale(1, 0.85)" : "none",
            transformOrigin: "50% 100%",
          }}
        />

        {/* Scaled Group for Accessories & Features (mapping 24x24 grid to ~144x144) */}
        <g
          transform={
            !isAdult ? "translate(3.5, 2) scale(6)" : "translate(3.5, -20) scale(6)"
          }
        >
          {/* Accessory Rendering */}
          {equippedAccessory && (
            <g transform="translate(0, 0)">
              {equippedAccessory === "party_hat" && (
                <path d="M 14 3 L 16 0 L 18 3 Z" fill="#FBBC04" />
              )}
              {equippedAccessory === "cool_shades" && (
                <g fill="#000">
                  {/* Big Square Lens */}
                  <rect x="12.5" y="3.5" width="2.5" height="3.5" fill="#000"></rect>

                  {/* Arm extending back */}
                  <rect x="10" y="4.25" width="2.5" height="1" fill="#000"></rect>

                  {/* Shine/Glint */}
                  {/* <rect x="13.2" y="5.2" width="0.8" height="0.8" fill="#fff" opacity="0.6" /> */}
                </g>
              )}
              {equippedAccessory === "cowboy_hat" && (
                <g fill="#78350f">
                  <rect x="10" y="3" width="10" height="1" />
                  <rect x="13" y="1.5" width="5" height="2" />
                </g>
              )}
              {equippedAccessory === "top_hat" && (
                <g fill="#1e293b">
                  <rect x="11" y="3" width="8" height="0.8" />
                  <rect x="13" y="0.5" width="4" height="2.5" />
                  <rect x="13" y="2.2" width="4" height="0.3" fill="#ef4444" />
                </g>
              )}
              {equippedAccessory === "crown" && (
                <g fill="#facc15">
                  <rect x="13" y="1.5" width="5" height="2" />
                  <rect x="13" y="0.5" width="1" height="1" />
                  <rect x="15" y="0.5" width="1" height="1" />
                  <rect x="17" y="0.5" width="1" height="1" />
                  <rect x="15" y="2" width="1" height="1" fill="#ef4444" />
                </g>
              )}
            </g>
          )}

          {/* Eye */}
          <g transform={!isAdult ? "translate(13.5, 5.5) scale(1.5) translate(-13.5, -5.6)" : undefined}>
            {isSleeping ? (
              <g></g>
            ) : isScared ? (
              <g>
                <rect x="13" y="4.5" width="2" height="2" fill="#fff" />
                <rect x="13.5" y="5" width="1" height="1" fill="#000" className="animate-pulse" />
              </g>
            ) : isInjured ? (
              <g>
                <path d="M 12.8 4.8 L 14.2 6.2 M 14.2 4.8 L 12.8 6.2" stroke="#000" strokeWidth="0.5" />
              </g>
            ) : isAngry ? (
              <g>
                <rect x="13" y="5" width="1.5" height="1.5" fill="#fff" />
                <rect x="13" y="5" width="1" height="1" fill="#000" />
                <path d="M 12.5 4 L 15.5 5" stroke="#EA4335" strokeWidth="0.5" />
              </g>
            ) : equippedAccessory === "cool_shades" ? (
              <g></g>
            ) : (
              <g>
                {/* <rect x="13" y="5" width="1" height="1" fill="#fff" /> */}
                {/* <rect x="13.5" y="5.5" width="0.5" height="0.5" fill="#000" /> */}
              </g>
            )}
          </g>

          {/* Emotions Overlays */}
          {isInjured && (
            <g>
              <rect x="9" y="14.5" width="3" height="1" fill="#FF4500" />
              <rect x="10" y="13.5" width="1" height="3" fill="#FF4500" />
            </g>
          )}

          {isSick && (
            <>
              <g transform="translate(-6, 7) scale(0.3,0.3) rotate(-30,0,0)" className="animate-pulse hover:rotate">
                <path d={ICON_PATHS.bug} fill="#34A853"/>
              </g>
              <g transform="translate(16, -6) scale(0.3,0.3) rotate(30,0,0)" className="animate-pulse">
                <path d={ICON_PATHS.bug} fill="#34A853"/>
              </g>
              <g transform="translate(8, -2) scale(0.25,0.25)" className="animate-pulse">
                <path d={ICON_PATHS.swiggle} stroke="#34A853" stroke-width="1.5"/>
                <g transform="translate(-10, 10)">
                  <path d={ICON_PATHS.swiggle} stroke="#34A853" stroke-width="1.5"/>
                </g>
                <g transform="translate(-20, 20)">
                  <path d={ICON_PATHS.swiggle} stroke="#34A853" stroke-width="1.5"/>
                </g>
              </g>
            </>
          )}

          {isHappy && (
            <g transform="translate(14, 2) scale(0.1,0.1)">
              <text fontSize="40" className="animate-bounce">
                ❤️
              </text>
            </g>
          )}

          {isScared && (
            <g transform="translate(9.5, 6.5)">
              <text fontSize="4" className="animate-pulse">
                💧
              </text>
            </g>
          )}

          {isEating && (
            <g>
              <rect x="18" y="8.5" width="1" height="1" fill="#FBBC04" className="animate-reverse-ping" />
              <rect
                x="20"
                y="8.5"
                width="1"
                height="1"
                fill="#FBBC04"
                className="animate-reverse-ping"
                style={{ animationDelay: "0.1s" }}
              />
            </g>
          )}
        </g>
      </svg>
    </div>
  );
};

export default PetDisplay;
