import React, { useEffect, useRef, useState } from 'react'
import * as THREE from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'
import { FBXLoader } from 'three/examples/jsm/loaders/FBXLoader.js'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js'
import { VRMLoaderPlugin } from '@pixiv/three-vrm'
import { Pointer } from 'lucide-react'
import { retargetMixamoClip } from '../lib/vrm/loadMixamoAnimation'

// Builds a small billboarded text label (canvas -> texture -> Sprite),
// used for the height-ruler's meter markings and the "actual height" tag.
// Kept tiny/dependency-free rather than pulling in a text-geometry lib.
export function makeRulerLabelSprite(text, { color = '#e2e8f0', bg = null, fontSize = 46, bold = false } = {}) {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 96
  const ctx = canvas.getContext('2d')
  if (bg) {
    ctx.fillStyle = bg
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }
  ctx.font = `${bold ? '900' : '700'} ${fontSize}px 'Segoe UI', Arial, sans-serif`
  ctx.fillStyle = color
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  ctx.fillText(text, 6, canvas.height / 2)
  const texture = new THREE.CanvasTexture(canvas)
  texture.minFilter = THREE.LinearFilter
  texture.needsUpdate = true
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false, depthWrite: false })
  const sprite = new THREE.Sprite(material)
  sprite.renderOrder = 1001
  sprite.scale.set(0.34, 0.34 * (canvas.height / canvas.width), 1)
  return sprite
}

// Builds the full height-ruler group: a vertical scale from 0m to 2m with
// minor ticks every 0.1m and labeled major ticks every 0.5m, positioned just
// to the left of the avatar. Purely a visual reference scale (world units in
// this viewer are meters, matching VRM/glTF convention).
export function buildHeightRulerGroup(isDark) {
  const group = new THREE.Group()
  group.name = 'osaHeightRuler'
  const lineColor = isDark ? 0x64748b : 0x475569
  const majorColor = isDark ? 0xcbd5e1 : 0x1e293b

  const points = [new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 2, 0)]
  const baseline = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: lineColor, transparent: true, opacity: 0.65 })
  )
  baseline.renderOrder = 999
  group.add(baseline)

  for (let mm = 0; mm <= 20; mm += 1) {
    const y = mm / 10
    const isMajor = mm % 5 === 0
    const tickLen = isMajor ? 0.09 : 0.04
    const tickGeom = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(0, y, 0),
      new THREE.Vector3(tickLen, y, 0),
    ])
    const tick = new THREE.Line(tickGeom, new THREE.LineBasicMaterial({
      color: isMajor ? majorColor : lineColor, transparent: true, opacity: isMajor ? 0.9 : 0.5,
    }))
    group.add(tick)
    if (isMajor) {
      const label = makeRulerLabelSprite(`${y.toFixed(1)}m`, { color: isDark ? '#cbd5e1' : '#1e293b', fontSize: 40 })
      label.position.set(tickLen + 0.09, y, 0)
      group.add(label)
    }
  }
  return group
}

// Real three.js viewer: loads the avatar with GLTFLoader (registering
// @pixiv/three-vrm's VRMLoaderPlugin so VRM 0.x/1.0 humanoid rigs are parsed
// out of the glTF extensions, not just rendered as a dumb mesh), loads the
// fetched Mixamo animation file with FBXLoader, retargets it onto the VRM's
// normalized humanoid bones (see src/lib/vrm/loadMixamoAnimation.js), and
// drives it all with a genuine THREE.AnimationMixer. Nothing here is a
// canned/fake log — every console line only fires when the corresponding
// loader step actually runs, and every reported number (blob size, track
// count) comes from the real parsed data.
export default function AnimatedAvatarViewer({
  modelUrl,
  modelKind, // 'gltf' (includes VRM) | 'fbx'
  animationBlobUrl,
  animationLabel,
  isDark,
  autoRotate,
  showGrid,
  showHeightRuler = false,
  showBones = false,
  showWireframe = false,
  showTextures = true,
  showDragHint = true,
  onLog,
  onStatusChange,
}) {
  const containerRef = useRef(null)
  const stateRef = useRef({})
  const [interacted, setInteracted] = useState(false)
  const [modelReady, setModelReady] = useState(false)

  // A brand-new model (or a fresh mount) should show the drag hint again.
  useEffect(() => {
    setInteracted(false)
    setModelReady(false)
  }, [modelUrl])

  const log = (...args) => {
    console.log(...args)
    onLog?.(args.join(' '))
  }

  const applyBoneVisibility = (visible) => {
    ;(stateRef.current.boneHelpers || []).forEach((helper) => { helper.visible = !!visible })
    ;(stateRef.current.boneMarkers || []).forEach(({ marker }) => { marker.visible = !!visible })
    ;(stateRef.current.modelMaterials || []).forEach((material) => {
      const originalOpacity = material.userData?.osaOriginalOpacity ?? 1
      const originalTransparent = material.userData?.osaOriginalTransparent ?? false
      const originalDepthWrite = material.userData?.osaOriginalDepthWrite ?? true
      material.transparent = visible ? true : originalTransparent
      material.opacity = visible ? Math.min(originalOpacity, 0.38) : originalOpacity
      material.depthWrite = visible ? false : originalDepthWrite
      material.needsUpdate = true
    })
  }

  // Scene / renderer bootstrap — runs once per mount, rebuilt if the model changes.
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const scene = new THREE.Scene()
    const camera = new THREE.PerspectiveCamera(35, container.clientWidth / Math.max(container.clientHeight, 1), 0.1, 100)
    camera.position.set(0, 1.4, 3.1)

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2))
    renderer.setSize(container.clientWidth, container.clientHeight)
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.innerHTML = ''
    container.appendChild(renderer.domElement)

    const hemi = new THREE.HemisphereLight(0xffffff, isDark ? 0x101018 : 0x8a94a6, 1.1)
    const key = new THREE.DirectionalLight(0xffffff, 1.4)
    key.position.set(2, 4, 3)
    scene.add(hemi, key)

    const grid = new THREE.GridHelper(4, 16, isDark ? 0x334155 : 0xc9cfd8, isDark ? 0x1e293b : 0xe2e6ea)
    grid.visible = !!showGrid
    scene.add(grid)

    // Height ruler: a static 0–2m vertical scale to the avatar's left, plus
    // a highlighted line/label (filled in once the model loads, see
    // frameAndStore below) marking where this avatar's real height lands.
    const heightRuler = buildHeightRulerGroup(isDark)
    heightRuler.position.set(-0.85, 0, 0)
    heightRuler.visible = !!showHeightRuler
    scene.add(heightRuler)
    const heightMarker = new THREE.Group()
    heightMarker.visible = !!showHeightRuler
    scene.add(heightMarker)

    const controls = new OrbitControls(camera, renderer.domElement)
    controls.target.set(0, 1, 0)
    controls.enableDamping = true
    controls.dampingFactor = 0.08
    controls.minDistance = 1.2
    controls.maxDistance = 6
    controls.autoRotate = !!autoRotate
    controls.autoRotateSpeed = 1.6

    const markInteracted = () => setInteracted(true)
    renderer.domElement.addEventListener('pointerdown', markInteracted)
    renderer.domElement.addEventListener('wheel', markInteracted, { passive: true })
    renderer.domElement.addEventListener('touchstart', markInteracted, { passive: true })

    let raf = 0
    const clock = new THREE.Clock()

    stateRef.current = {
      scene, camera, renderer, controls, grid, heightRuler, heightMarker,
      mixer: null, avatarRoot: null, vrm: null, currentAction: null, boneHelpers: [], boneMarkers: [], boneMarkerGeometry: null, boneMarkerMaterial: null, modelMaterials: [], disposed: false,
    }

    function animate() {
      raf = requestAnimationFrame(animate)
      const delta = clock.getDelta()
      if (stateRef.current.mixer) stateRef.current.mixer.update(delta)
      // vrm.update() must run *after* the mixer so it can copy the freshly
      // animated normalized-bone pose onto the raw skeleton (spring bones,
      // look-at, and expressions are also ticked here).
      if (stateRef.current.vrm) stateRef.current.vrm.update(delta)
      ;(stateRef.current.boneMarkers || []).forEach(({ bone, marker }) => {
        bone.getWorldPosition(marker.position)
      })
      controls.update()
      renderer.render(scene, camera)
    }
    animate()

    const resizeObserver = new ResizeObserver(() => {
      if (!container.clientWidth || !container.clientHeight) return
      camera.aspect = container.clientWidth / container.clientHeight
      camera.updateProjectionMatrix()
      renderer.setSize(container.clientWidth, container.clientHeight)
    })
    resizeObserver.observe(container)

    function frameAndStore(avatarRoot, vrm) {
      const box = new THREE.Box3().setFromObject(avatarRoot)
      const size = box.getSize(new THREE.Vector3())
      const center = box.getCenter(new THREE.Vector3())
      const height = size.y || 1.7
      const scale = 1.7 / height
      avatarRoot.scale.setScalar(scale)
      avatarRoot.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale)
      scene.add(avatarRoot)

      // Height-ruler marker: this viewer always normalizes the avatar's
      // *displayed* height to 1.7 world units (see `scale` above) so every
      // model frames consistently in the camera regardless of its real
      // scale — so the marker line always sits at y=1.7 (the true visual
      // top-of-head here), while the label text reports the avatar's real,
      // un-normalized height as read from its own model data.
      const heightMarker = stateRef.current.heightMarker
      if (heightMarker) {
        heightMarker.children.forEach((child) => {
          child.geometry?.dispose?.()
          child.material?.map?.dispose?.()
          child.material?.dispose?.()
        })
        heightMarker.clear()
        const markerY = 1.7
        const markLine = new THREE.Line(
          new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-0.85, markerY, 0), new THREE.Vector3(0.18, markerY, 0)]),
          new THREE.LineDashedMaterial({ color: 0x00e5ff, dashSize: 0.045, gapSize: 0.03, transparent: true, opacity: 0.9 })
        )
        markLine.computeLineDistances()
        heightMarker.add(markLine)
        const label = makeRulerLabelSprite(`${height.toFixed(2)} m`, { color: '#00e5ff', bold: true, fontSize: 44 })
        label.position.set(0.26, markerY, 0)
        heightMarker.add(label)
      }
      onStatusChange?.({ realHeightMeters: Number(height.toFixed(3)) })
      const mixer = new THREE.AnimationMixer(avatarRoot)
      stateRef.current.mixer = mixer
      stateRef.current.avatarRoot = avatarRoot
      stateRef.current.vrm = vrm || null

      const boneHelpers = []
      const boneMarkers = []
      const markerGeometry = new THREE.SphereGeometry(0.018, 12, 12)
      const markerMaterial = new THREE.MeshBasicMaterial({ color: 0xff3b4f, depthTest: false, depthWrite: false })
      const seenBones = new Set()
      const addBoneMarker = (bone) => {
        if (!bone || seenBones.has(bone.uuid)) return
        seenBones.add(bone.uuid)
        const marker = new THREE.Mesh(markerGeometry, markerMaterial)
        marker.visible = !!showBones
        marker.renderOrder = 1000
        scene.add(marker)
        boneMarkers.push({ bone, marker })
      }
      const modelMaterials = []
      avatarRoot.traverse((obj) => {
        if (obj.isMesh && obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
          materials.forEach((material) => {
            material.userData = material.userData || {}
            if (typeof material.userData.osaOriginalWireframe !== 'boolean') material.userData.osaOriginalWireframe = !!material.wireframe
            if (typeof material.userData.osaOriginalOpacity !== 'number') material.userData.osaOriginalOpacity = material.opacity ?? 1
            if (typeof material.userData.osaOriginalTransparent !== 'boolean') material.userData.osaOriginalTransparent = !!material.transparent
            if (typeof material.userData.osaOriginalDepthWrite !== 'boolean') material.userData.osaOriginalDepthWrite = material.depthWrite !== false
            if (!material.userData.osaOriginalTextureMaps) {
              material.userData.osaOriginalTextureMaps = {
                map: material.map || null, normalMap: material.normalMap || null, roughnessMap: material.roughnessMap || null,
                metalnessMap: material.metalnessMap || null, emissiveMap: material.emissiveMap || null, aoMap: material.aoMap || null, alphaMap: material.alphaMap || null,
              }
            }
            material.wireframe = !!showWireframe
            Object.entries(material.userData.osaOriginalTextureMaps).forEach(([mapKey, originalMap]) => { material[mapKey] = showTextures ? originalMap : null })
            material.transparent = showBones ? true : material.userData.osaOriginalTransparent
            material.opacity = showBones ? Math.min(material.userData.osaOriginalOpacity, 0.38) : material.userData.osaOriginalOpacity
            material.depthWrite = showBones ? false : material.userData.osaOriginalDepthWrite
            material.needsUpdate = true
            modelMaterials.push(material)
          })
        }
        if (obj.isSkinnedMesh && obj.skeleton) {
          const helper = new THREE.SkeletonHelper(obj)
          helper.visible = !!showBones
          helper.material.depthTest = false
          helper.material.depthWrite = false
          helper.material.transparent = true
          helper.material.opacity = 1
          helper.material.color?.set?.(0x00e5ff)
          helper.renderOrder = 999
          scene.add(helper)
          boneHelpers.push(helper)
          obj.skeleton.bones.forEach(addBoneMarker)
        }
      })
      if (!boneHelpers.length) {
        const helper = new THREE.SkeletonHelper(avatarRoot)
        helper.visible = !!showBones
        helper.material.depthTest = false
        helper.material.depthWrite = false
        helper.material.transparent = true
        helper.material.opacity = 1
        helper.material.color?.set?.(0x00e5ff)
        helper.renderOrder = 999
        scene.add(helper)
        boneHelpers.push(helper)
        avatarRoot.traverse((obj) => { if (obj.isBone) addBoneMarker(obj) })
      }
      stateRef.current.boneHelpers = boneHelpers
      stateRef.current.boneMarkers = boneMarkers
      stateRef.current.boneMarkerGeometry = markerGeometry
      stateRef.current.boneMarkerMaterial = markerMaterial
      stateRef.current.modelMaterials = modelMaterials

      onStatusChange?.({ modelLoaded: true, isVrm: !!vrm, boneCount: boneHelpers.length })
      setModelReady(true)

      let vertices = 0
      let triangles = 0
      avatarRoot.traverse((obj) => {
        if (obj.isMesh && obj.geometry) {
          const geom = obj.geometry
          vertices += geom.attributes?.position?.count || 0
          triangles += geom.index ? geom.index.count / 3 : (geom.attributes?.position?.count || 0) / 3
        }
      })
      onStatusChange?.({ stats: { vertices, triangles: Math.round(triangles) } })
    }

    if (modelUrl) {
      if (modelKind === 'fbx') {
        // Plain FBX avatar (e.g. the "FBX"/"Voxel FBX" format buttons) — no
        // VRM humanoid extension to parse, so it's used as-is.
        const fbxModelLoader = new FBXLoader()
        fbxModelLoader.load(
          modelUrl,
          (fbx) => {
            if (stateRef.current.disposed) return
            frameAndStore(fbx, null)
          },
          undefined,
          (err) => {
            console.warn('Failed to load FBX avatar model', err)
            onStatusChange?.({ modelLoaded: false, error: err?.message || 'model load failed' })
          }
        )
      } else {
        const gltfLoader = new GLTFLoader()
        gltfLoader.register((parser) => new VRMLoaderPlugin(parser))
        gltfLoader.load(
          modelUrl,
          (gltf) => {
            if (stateRef.current.disposed) return
            const vrm = gltf.userData.vrm
            const avatarRoot = vrm ? vrm.scene : gltf.scene
            // VRM materials should not respond to frustum culling glitches
            // from the retargeted, possibly-oversized animation bounds.
            avatarRoot.traverse((obj) => { obj.frustumCulled = false })
            frameAndStore(avatarRoot, vrm)
          },
          undefined,
          (err) => {
            console.warn('Failed to load avatar model', err)
            onStatusChange?.({ modelLoaded: false, error: err?.message || 'model load failed' })
          }
        )
      }
    }

    return () => {
      stateRef.current.disposed = true
      cancelAnimationFrame(raf)
      resizeObserver.disconnect()
      renderer.domElement.removeEventListener('pointerdown', markInteracted)
      renderer.domElement.removeEventListener('wheel', markInteracted)
      renderer.domElement.removeEventListener('touchstart', markInteracted)
      controls.dispose()
      renderer.dispose()
      ;(stateRef.current.modelMaterials || []).forEach((material) => {
        if (typeof material.userData?.osaOriginalWireframe === 'boolean') {
          material.wireframe = material.userData.osaOriginalWireframe
        }
        if (material.userData?.osaOriginalTextureMaps) {
          Object.entries(material.userData.osaOriginalTextureMaps).forEach(([mapKey, originalMap]) => { material[mapKey] = originalMap })
        }
        if (typeof material.userData?.osaOriginalOpacity === 'number') material.opacity = material.userData.osaOriginalOpacity
        if (typeof material.userData?.osaOriginalTransparent === 'boolean') material.transparent = material.userData.osaOriginalTransparent
        if (typeof material.userData?.osaOriginalDepthWrite === 'boolean') material.depthWrite = material.userData.osaOriginalDepthWrite
      })
      ;(stateRef.current.boneHelpers || []).forEach((helper) => {
        scene.remove(helper)
        helper.geometry?.dispose?.()
        helper.material?.dispose?.()
      })
      ;(stateRef.current.boneMarkers || []).forEach(({ marker }) => { scene.remove(marker) })
      stateRef.current.boneMarkerGeometry?.dispose?.()
      stateRef.current.boneMarkerMaterial?.dispose?.()
      scene.traverse((obj) => {
        if (obj.geometry) obj.geometry.dispose()
        if (obj.material) {
          const materials = Array.isArray(obj.material) ? obj.material : [obj.material]
          materials.forEach((m) => { m.map?.dispose?.(); m.dispose?.() })
        }
      })
      if (container) container.innerHTML = ''
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [modelUrl, modelKind])

  // Keep auto-rotate / grid-visibility toggles live without reloading the model.
  useEffect(() => {
    if (stateRef.current.controls) stateRef.current.controls.autoRotate = !!autoRotate
  }, [autoRotate])
  useEffect(() => {
    if (stateRef.current.grid) stateRef.current.grid.visible = !!showGrid
  }, [showGrid])
  useEffect(() => {
    if (stateRef.current.heightRuler) stateRef.current.heightRuler.visible = !!showHeightRuler
    if (stateRef.current.heightMarker) stateRef.current.heightMarker.visible = !!showHeightRuler
  }, [showHeightRuler])
  useEffect(() => {
    applyBoneVisibility(showBones)
  }, [showBones])
  useEffect(() => {
    ;(stateRef.current.modelMaterials || []).forEach((material) => {
      material.wireframe = !!showWireframe
      material.needsUpdate = true
    })
  }, [showWireframe])
  useEffect(() => {
    ;(stateRef.current.modelMaterials || []).forEach((material) => {
      const originalMaps = material.userData?.osaOriginalTextureMaps
      if (!originalMaps) return
      Object.entries(originalMaps).forEach(([mapKey, originalMap]) => { material[mapKey] = showTextures ? originalMap : null })
      material.needsUpdate = true
    })
  }, [showTextures])

  // Animation loading — runs whenever a new FBX blob URL comes in.
  useEffect(() => {
    if (!animationBlobUrl) {
      // T-Pose (Default) or a cleared selection: stop whatever clip is
      // currently playing and let the mixer settle back to the bind pose.
      if (stateRef.current.currentAction) {
        stateRef.current.currentAction.fadeOut(0.2)
        stateRef.current.currentAction = null
      }
      return
    }
    let cancelled = false
    const safetyTimer = setTimeout(() => {
      if (cancelled) return
      log('🔍 DEBUG - Safety timeout reached, forcing loading indicator off')
      onStatusChange?.({ loading: false, timedOut: true })
    }, 6000)

    function attachWhenModelReady() {
      if (cancelled) return
      if (!stateRef.current.mixer) {
        // Model still loading — retry shortly instead of failing.
        setTimeout(attachWhenModelReady, 100)
        return
      }
      log('Loading FBX animation')
      const fbxLoader = new FBXLoader()
      fbxLoader.load(
        animationBlobUrl,
        (fbx) => {
          if (cancelled) return
          log('FBX loaded, processing animation')
          log('Processing animation tracks')

          const { vrm, mixer } = stateRef.current
          let clip
          try {
            if (vrm) {
              // Real VRM humanoid: retarget the raw Mixamo clip onto the
              // VRM's normalized bone nodes (handles bind-pose differences,
              // hip-height rescaling, and the VRM 0.x +Z-facing sign flips).
              clip = retargetMixamoClip(fbx, vrm)
            } else {
              // Non-VRM model (plain FBX/glTF) — play the Mixamo clip as-is.
              clip = THREE.AnimationClip.findByName(fbx.animations || [], 'mixamo.com') || fbx.animations?.[0]
            }
          } catch (retargetErr) {
            console.warn(`Retargeting failed for ${animationLabel}`, retargetErr)
            onStatusChange?.({ loading: false, error: retargetErr?.message || 'retargeting failed' })
            clearTimeout(safetyTimer)
            return
          }

          if (!clip || !clip.tracks.length) {
            console.warn(`No animation clip found inside ${animationLabel} FBX`)
            onStatusChange?.({ loading: false, error: 'no clip found in FBX' })
            clearTimeout(safetyTimer)
            return
          }

          log('Processing individual tracks')
          if (stateRef.current.currentAction) stateRef.current.currentAction.stop()
          const action = mixer.clipAction(clip)
          action.reset().fadeIn(0.25).play()
          stateRef.current.currentAction = action
          log(`Animation processed: ${clip.tracks.length} tracks created`)
          onStatusChange?.({ loading: false, trackCount: clip.tracks.length, clipName: clip.name })
        },
        undefined,
        (err) => {
          if (cancelled) return
          console.warn(`Animation load failed for ${animationLabel}`, err)
          onStatusChange?.({ loading: false, error: err?.message || 'animation load failed' })
          clearTimeout(safetyTimer)
        }
      )
    }
    attachWhenModelReady()

    return () => {
      cancelled = true
      clearTimeout(safetyTimer)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [animationBlobUrl])

  const showHint = showDragHint && modelReady && !interacted

  return (
    <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: 300 }}>
      <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
      {showHint && (
        <div
          aria-hidden="true"
          style={{
            position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
            pointerEvents: 'none', zIndex: 2,
          }}
        >
          <style>{`
            @keyframes osaDragSlide {
              0%   { transform: translateX(-18px); opacity: 0; }
              15%  { opacity: 1; }
              50%  { transform: translateX(18px); opacity: 1; }
              85%  { opacity: 1; }
              100% { transform: translateX(-18px); opacity: 0; }
            }
            @keyframes osaDragPulse {
              0%   { transform: scale(0.85); opacity: 0.55; }
              70%  { transform: scale(1.35); opacity: 0; }
              100% { transform: scale(1.35); opacity: 0; }
            }
          `}</style>
          <span style={{ position: 'relative', width: 64, height: 64, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <span style={{
              position: 'absolute', inset: 0, borderRadius: '50%',
              background: 'rgba(0,229,255,0.35)', animation: 'osaDragPulse 1.8s ease-out infinite',
            }} />
            <span style={{
              position: 'relative', display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
              width: 40, height: 40, borderRadius: '50%',
              background: 'rgba(20,26,38,0.82)', boxShadow: '0 6px 18px rgba(0,0,0,0.35)',
              animation: 'osaDragSlide 1.8s ease-in-out infinite',
            }}>
              <Pointer size={18} color="#ffffff" strokeWidth={2.25} />
            </span>
          </span>
        </div>
      )}
    </div>
  )
}
