/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React, { useState, useRef, useEffect } from "react";
import { PetState } from "../types";
import DinoAction from "./DinoAction";

interface ActionsPanelProps {
  isAwake: boolean;
  currentState: PetState;
  activeCooldowns: Record<string, boolean>;
  hasPoop: boolean;
  onFeed: () => void;
  onPlay: () => void;
  onBrush: () => void;
  onPet: () => void;
  onToggleSleep: () => void;
  onCleanPen: () => void;
  onBandage: () => void;
  money: number;
  onShop: () => void;
}

const ActionsPanel: React.FC<ActionsPanelProps> = ({
  isAwake,
  currentState,
  activeCooldowns,
  hasPoop,
  onFeed,
  onPlay,
  onBrush,
  onPet,
  onToggleSleep,
  onCleanPen,
  onBandage,
  money,
  onShop,
}) => {
  const [isMoneyBouncing, setIsMoneyBouncing] = useState(false);
  const prevMoneyRef = useRef(money);

  useEffect(() => {
    if (money > prevMoneyRef.current) {
      setIsMoneyBouncing(true);
      const timer = setTimeout(() => setIsMoneyBouncing(false), 600);
      return () => clearTimeout(timer);
    }
    prevMoneyRef.current = money;
  }, [money]);

  return (
    <div className="grid grid-cols-4 lg:grid-cols-3 place-items-center justify-center gap-x-4 gap-y-3 md:gap-y-6 w-full">
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
      `}</style>
      <DinoAction
        onClick={onFeed}
        label="Feed"
        icon="food"
        disabled={!isAwake || activeCooldowns["feed"]}
        onCooldown={activeCooldowns["feed"]}
        cooldownMs={5000}
      />
      <DinoAction
        onClick={onPlay}
        label="Play"
        icon="play"
        disabled={!isAwake || currentState === PetState.INJURED || activeCooldowns["play"]}
        onCooldown={activeCooldowns["play"]}
        cooldownMs={7000}
      />
      <DinoAction
        onClick={onBrush}
        label="Brush"
        icon="brush"
        disabled={!isAwake || activeCooldowns["brush"]}
        onCooldown={activeCooldowns["brush"]}
        cooldownMs={4000}
      />
      <DinoAction
        onClick={onPet}
        label="Pet"
        icon="pet"
        disabled={!isAwake || activeCooldowns["pet"]}
        onCooldown={activeCooldowns["pet"]}
        cooldownMs={3000}
      />
      <DinoAction
        onClick={onToggleSleep}
        label={isAwake ? "Sleep" : "Wake"}
        icon={isAwake ? "sleep" : "⚡"}
        disabled={activeCooldowns["sleep"]}
        onCooldown={activeCooldowns["sleep"]}
        cooldownMs={2000}
      />

      {currentState === PetState.INJURED ? (
        <DinoAction
          onClick={onBandage}
          label="Aid"
          icon="aid"
          disabled={activeCooldowns["bandage"]}
          onCooldown={activeCooldowns["bandage"]}
          cooldownMs={3000}
        />
      ) : (
        <DinoAction
          onClick={onCleanPen}
          label="Clean"
          icon="clean"
          disabled={!hasPoop || activeCooldowns["clean"]}
          onCooldown={activeCooldowns["clean"]}
          cooldownMs={2000}
        />
      )}

      <div className="lg:hidden col-span-2 flex justify-end w-full md:mr-20 mr-0">
         <div className="bg-[#262626] rounded-full pl-4 flex items-center gap-3 border border-white/5 w-auto p-1">
           <span className="font-medium text-white tracking-wider text-sm pl-1">${money}</span>
           <button
            onClick={onShop}
            className={`${isMoneyBouncing ? "flash-bg" : "bg-[#333] hover:bg-[#444]"} text-white p-2 px-6 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95`}
           >
             <span className="text-sm">
              <svg className={isMoneyBouncing ? "bounce" : ""} xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 20 20" fill="none">
                <mask id="mask0_7759_17057_panel" style={{ maskType: 'alpha' }} maskUnits="userSpaceOnUse" x="0" y="0" width="20" height="20">
                  <rect width="20" height="20" fill="white"/>
                </mask>
                <g mask="url(#mask0_7759_17057_panel)">
                  <path d="M4.16667 18.3333C3.70833 18.3333 3.31597 18.1701 2.98958 17.8437C2.66319 17.5173 2.5 17.1249 2.5 16.6666V6.66658C2.5 6.20825 2.66319 5.81589 2.98958 5.4895C3.31597 5.16311 3.70833 4.99992 4.16667 4.99992H5.83333C5.83333 3.84714 6.23958 2.8645 7.05208 2.052C7.86458 1.2395 8.84722 0.833252 10 0.833252C11.1528 0.833252 12.1354 1.2395 12.9479 2.052C13.7604 2.8645 14.1667 3.84714 14.1667 4.99992H15.8333C16.2917 4.99992 16.684 5.16311 17.0104 5.4895C17.3368 5.81589 17.5 6.20825 17.5 6.66658V16.6666C17.5 17.1249 17.3368 17.5173 17.0104 17.8437C16.684 18.1701 16.2917 18.3333 15.8333 18.3333H4.16667ZM12.9479 10.4478C13.7604 9.63533 14.1667 8.6527 14.1667 7.49992H12.5C12.5 8.19436 12.2569 8.78464 11.7708 9.27075C11.2847 9.75686 10.6944 9.99992 10 9.99992C9.30556 9.99992 8.71528 9.75686 8.22917 9.27075C7.74306 8.78464 7.5 8.19436 7.5 7.49992H5.83333C5.83333 8.6527 6.23958 9.63533 7.05208 10.4478C7.86458 11.2603 8.84722 11.6666 10 11.6666C11.1528 11.6666 12.1354 11.2603 12.9479 10.4478ZM7.5 4.99992H12.5C12.5 4.30547 12.2569 3.7152 11.7708 3.22909C11.2847 2.74297 10.6944 2.49992 10 2.49992C9.30556 2.49992 8.71528 2.74297 8.22917 3.22909C7.74306 3.7152 7.5 4.30547 7.5 4.99992Z" fill="white"/>
                </g>
              </svg>
             </span>
           </button>
         </div>
      </div>
    </div>
  );
};


export default ActionsPanel;
