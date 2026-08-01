/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/

import React from 'react';
import DinoGame from './components/DinoGame';

const App: React.FC = () => {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-4 bg-[#f7f7f7] text-[#535353] font-['Press_Start_2P']">
      <h1 className="text-2xl md:text-3xl mb-6 text-center text-[#535353]">
        Dino Jump
      </h1>
      <DinoGame />
    </div>
  );
};

export default App;