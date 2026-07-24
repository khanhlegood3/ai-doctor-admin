import React, { useEffect, useRef } from 'react';
import './Hero3DMap/index.css'; // Import các style gốc
import { initHero3DMap } from './Hero3DMap/initMap'; 

export default function Hero3DMapPanel() {
    const containerRef = useRef(null);

    useEffect(() => {
        if (containerRef.current) {
            initHero3DMap(containerRef.current);
        }
    }, []);

    return <div ref={containerRef} className="hero3dmap-scope" style={{ width: '100%', height: '100vh' }}></div>;
}