/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
*/
import type {ModeKey} from '../lib/types'
import {memo, useEffect, useRef, useState} from 'react'
import {outputWidth} from '../lib/consts'
import {identity} from '../lib/utils'
import {use} from '../lib/store'

type RendererProps = {
  mode: ModeKey
  code: string
  isFullscreen?: boolean
}

function Renderer({mode, code, isFullscreen}: RendererProps) {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const [showError, setShowError] = useState(false)
  const [isVisible, setIsVisible] = useState(false)
  const fullscreenActiveId = use.fullscreenActiveId()
  const screensaverMode = use.screensaverMode()
  const fullscreenIsActive = Boolean(fullscreenActiveId)
  const thisIsFullscreen = Boolean(isFullscreen)

  const rendererRef = useRef<HTMLDivElement | null>(null)

  useEffect(() => {
    if (iframeRef.current?.contentWindow) {
      iframeRef.current.contentWindow.onerror = () => setShowError(true)
    }
  }, [iframeRef])

  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            setIsVisible(true)
          } else {
            setIsVisible(false)
          }
        })
      },
      {threshold: 0.1}
    )

    if (rendererRef.current) {
      observer.observe(rendererRef.current)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div
      ref={rendererRef}
      className={`renderer ${mode}Renderer bg-black`}
      style={{height: isFullscreen ? '100%' : undefined}}
    >
      {mode === 'image' ? (
        <img src={code} alt="Generated image" />
      ) : isVisible &&
        (!fullscreenIsActive || thisIsFullscreen) &&
        (!screensaverMode || thisIsFullscreen) ? (
        <iframe
          className={`w-full bg-black ${isFullscreen ? 'h-full' : 'aspect-4/3'}`}
          sandbox="allow-same-origin allow-scripts"
          loading="lazy"
          srcDoc={scaffolds[mode]?.(code) || code}
          ref={iframeRef}
          style={{border: 'none', display: 'none'}}
          onLoad={e => {
            const iframe = e.currentTarget
            iframe.style.display = 'block'
          }}
        />
      ) : (
        <div
          className={`w-full bg-black ${isFullscreen ? 'h-full' : 'aspect-4/3'}`}
        ></div>
      )}

      {showError && (
        <div className="error">
          <p>
            <span className="icon">error</span> This code produced an error.
          </p>
        </div>
      )}
    </div>
  )
}

export default memo(Renderer)

const scaffolds: {[key in ModeKey]: (code: string) => string} = {
  p5: (code: string) => `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="/vendor/p5.min.js"></script>
  <style>
    body {
      padding: 0;
      margin: 0;
      width: 100vw;
      height: 100vh;
      overflow: hidden;
      background: black;
    }
    body, main, canvas {
      width: 100vw;
      height: 100vh;
      display: block;
      margin: 0;
      padding: 0;
      position: absolute;
      top: 0;
      left: 0;
      object-fit: contain;
    }
  </style>
</head>
<body>
  <script>
    ${code}

    if (typeof window.setup === 'function') {
      new p5()
    }

    function windowResized() {
      const canvas = document.querySelector('canvas')

      if (canvas) {
        // canvas.style.scale = window.innerWidth / ${outputWidth}
        // canvas.style.transformOrigin = '0 0'
        canvas.style.width = "100%"
        canvas.style.height = "100%"
      }
    }

    setTimeout(windowResized, 10)
  </script>
</body>
</html>`,

  svg: (code: string) => `
<style>
  body {
    margin: 0;
    padding: 0;
    background: #fff;
    overflow: hidden;
  }
  svg {
    width: 100%;
    height: 100%;
  }
</style>
${code}`,

  image: identity,

  html: identity,

  wireframes: identity,

  voxels: identity,

  // three: identity,

  glsl: (code: string) => `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Fullscreen Shader – Three.js (self-hosted ESM, /vendor/three.module.js)</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      html, body { height: 100%; margin: 0; background: #000; overflow: hidden; }
      canvas { display: block; }
    </style>
  </head>
  <body>
    <script type="module">
      import * as THREE from "/vendor/three.module.js";

      // --- Your fragment shader (as provided) ---
      const fragmentShader = /* glsl */ \`
        ${code.replaceAll('glsl', '')}
      \`;

      // Minimal passthrough vertex shader for a full-screen quad
      const vertexShader = /* glsl */ \`
        precision mediump float;
        void main() {
          gl_Position = vec4(position, 1.0);
        }
      \`;

      // --- Three.js scene setup ---
      const renderer = new THREE.WebGLRenderer({ antialias: false, alpha: false });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      renderer.setPixelRatio(dpr);
      renderer.setSize(window.innerWidth, window.innerHeight);
      renderer.outputColorSpace = THREE.SRGBColorSpace;
      document.body.appendChild(renderer.domElement);

      // Ortho camera that maps a 2x2 plane to the full screen (NDC)
      const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
      const scene = new THREE.Scene();

      // Fullscreen quad (plane in NDC)
      const geometry = new THREE.PlaneGeometry(2, 2);

      const uniforms = {
        u_time: { value: 0 },
        u_resolution: { value: new THREE.Vector2(window.innerWidth * dpr, window.innerHeight * dpr) },
      };

      const material = new THREE.ShaderMaterial({
        vertexShader,
        fragmentShader,
        uniforms,
      });

      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);

      // Resize handling
      function onResize() {
        const width = window.innerWidth;
        const height = window.innerHeight;
        renderer.setSize(width, height);
        uniforms.u_resolution.value.set(width * dpr, height * dpr);
      }
      window.addEventListener("resize", onResize);

      // Animate
      const clock = new THREE.Clock();
      function render() {
        uniforms.u_time.value = clock.getElapsedTime();
        renderer.render(scene, camera);
        requestAnimationFrame(render);
      }
      render();
    </script>
  </body>
</html>
`
}
