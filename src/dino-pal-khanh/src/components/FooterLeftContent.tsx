/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

const FooterLeftContent = ({currentColor, pet, currentLevel, experience, textColor}: {currentColor: string, pet: any, currentLevel: number, experience: number, textColor: string}) => {

  return (
    <div className="flex flex-col-reverse lg:flex-row w-full justify-center pointer-events-none items-stretch lg:items-center gap-3 px-4 lg:px-0 pb-4 lg:pb-0">
      
      {/* Name Pill */}
      <div
        className="w-full lg:w-auto text-center px-6 py-3 rounded-full font-medium text-lg pointer-events-auto shadow-lg transition-colors"
        style={{
          background: currentColor,
          color: textColor || "#000"
        }}
      >
        {pet.personality.name}
      </div>

      {/* Stats Pill */}
      <div 
        className="w-full flex items-center lg:w-auto p-[1px] rounded-full rainbow-border-2 [--gradient-angle:60deg] pointer-events-auto shadow-lg" 
        style={{backgroundSize: "100% 600%", backgroundPositionY: "20%"}}
      >
        <div 
          className="bg-black rounded-full px-5 py-3 flex items-center justify-between gap-3 text-white font-medium text-md w-full" 
          style={{maxHeight: '48px'}}
        >
          <span className="whitespace-nowrap">Level {currentLevel}</span>
          <span className="text-white/40 whitespace-nowrap">–</span>
          <span className="capitalize whitespace-nowrap">{pet.stage === "BABY" ? "Baby" : "Adult"}</span>
          <span className="text-white/40 whitespace-nowrap">–</span>
          <span>{Math.floor(experience % 100)}XP</span>
        </div>
      </div>
    </div>
  )
}

export default FooterLeftContent