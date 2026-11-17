import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { SceneAsset, VisualEffectSettings, VisualFxPresetId } from '../types/studio';

interface ParallaxThreeViewportProps {
  sceneAsset: SceneAsset;
  settings: VisualEffectSettings;
  onCanvasReady?: (canvas: HTMLCanvasElement) => void;
}

const _lookAtVec = new THREE.Vector3(0, 0, 0);

function fxPresetToIndex(id: VisualFxPresetId): number {
  switch (id) {
    case 'cinematic_gold':
      return 0;
    case 'leica_soft_dof':
      return 1;
    case 'nordic_clean':
      return 2;
    case 'analog_35mm':
      return 3;
    case 'vivid_hdr':
      return 4;
    default:
      return 0;
  }
}

const VERTEX_SHADER = `
  uniform sampler2D uTexture;
  uniform float uDepthIntensity;
  varying vec2 vUv;
  varying float vDepth;

  void main() {
    vUv = uv;
    vec4 tex = texture2D(uTexture, uv);
    float luma = dot(tex.rgb, vec3(0.299, 0.587, 0.114));

    float floorMask = smoothstep(0.45, 0.0, uv.y);
    float deskMask = smoothstep(0.36, 0.94, uv.x) * smoothstep(0.10, 0.62, uv.y) * (1.0 - smoothstep(0.62, 0.85, uv.y));
    float structuralDepth = (floorMask * 0.35 + deskMask * 0.25) + (luma - 0.5) * 0.12;

    vDepth = structuralDepth;

    vec3 pos = position;
    pos.z += structuralDepth * uDepthIntensity * 0.45;

    gl_Position = projectionMatrix * modelViewMatrix * vec4(pos, 1.0);
  }
`;

const FRAGMENT_SHADER = `
  uniform sampler2D uTexture;
  uniform float uPhotorealism;
  uniform float uWarmGlow;
  uniform float uBlurIntensity;
  uniform float uVignetteIntensity;
  uniform float uColorGrading;
  uniform float uFilmGrain;
  uniform float uWindowLight;
  uniform float uFxPresetIndex;
  uniform vec4 uWindowBounds;
  varying vec2 vUv;
  varying float vDepth;

  float hash12(vec2 p) {
    vec3 p3 = fract(vec3(p.xyx) * 0.1031);
    p3 += dot(p3, p3.yzx + 33.33);
    return fract((p3.x + p3.y) * p3.z);
  }

  vec3 sampleWithOptionalBlur(vec2 uv, float blurRadius) {
    if (blurRadius <= 0.0001) {
      return texture2D(uTexture, uv).rgb;
    }
    vec3 sum = texture2D(uTexture, uv).rgb * 0.36;
    sum += texture2D(uTexture, clamp(uv + vec2(blurRadius, 0.0), vec2(0.002), vec2(0.998))).rgb * 0.16;
    sum += texture2D(uTexture, clamp(uv - vec2(blurRadius, 0.0), vec2(0.002), vec2(0.998))).rgb * 0.16;
    sum += texture2D(uTexture, clamp(uv + vec2(0.0, blurRadius), vec2(0.002), vec2(0.998))).rgb * 0.16;
    sum += texture2D(uTexture, clamp(uv - vec2(0.0, blurRadius), vec2(0.002), vec2(0.998))).rgb * 0.16;
    return sum;
  }

  void main() {
    vec2 uv = vUv;

    // Optical Depth-of-Field (keeps reception focal center crisp, softens peripheral edges)
    float distFromFocus = distance(uv, vec2(0.56, 0.46));
    float dofFactor = smoothstep(0.18, 0.68, distFromFocus);
    float blurRadius = dofFactor * uBlurIntensity * 0.0055;

    // Floor-to-ceiling Warsaw window area for natural daylight enhancement
    float inWindowX = smoothstep(uWindowBounds.x, uWindowBounds.x + 0.03, uv.x) *
                      (1.0 - smoothstep(uWindowBounds.y - 0.04, uWindowBounds.y, uv.x));
    float inWindowY = smoothstep(uWindowBounds.z, uWindowBounds.z + 0.04, 1.0 - uv.y) *
                      (1.0 - smoothstep(uWindowBounds.w - 0.05, uWindowBounds.w, 1.0 - uv.y));
    float windowRegion = inWindowX * inWindowY;

    vec3 color = sampleWithOptionalBlur(uv, blurRadius);
    float baseLuma = dot(color, vec3(0.299, 0.587, 0.114));
    float skyAndTowersMask = windowRegion * smoothstep(0.15, 0.34, baseLuma);

    // Static natural daylight bloom through the Warsaw windows
    if (uWindowLight > 0.01 && skyAndTowersMask > 0.05) {
      float shaftWave = 0.5 + 0.5 * sin(uv.x * 6.5 + uv.y * 3.8);
      color += vec3(1.0, 0.91, 0.72) * pow(shaftWave, 2.5) * skyAndTowersMask * uWindowLight * 0.14;
    }

    // PBR Floor & Calacatta Marble specular enhancement
    float floorZone = smoothstep(0.42, 0.02, uv.y);
    float specularHighlight = smoothstep(0.52, 0.88, baseLuma) * (floorZone * 0.65 + 0.35);
    float staticSheen = 0.5 + 0.5 * cos(uv.x * 10.0);
    color += color * specularHighlight * staticSheen * uPhotorealism * 0.22;

    // Golden Hour Warm Glow & Ring Chandelier atmospheric light
    float chandelierGlow = exp(-distance(uv, vec2(0.66, 0.80)) * 4.2) * uWarmGlow * 0.22;
    float sunsetHorizon = exp(-distance(uv, vec2(0.32, 0.42)) * 3.0) * uWarmGlow * 0.16;
    color += vec3(1.0, 0.84, 0.56) * (chandelierGlow + sunsetHorizon);

    // Predefined Visual FX Color Correction & Grading Curve
    float cg = uColorGrading;
    if (cg > 0.01) {
      vec3 sCurve = color * color * (3.0 - 2.0 * color);
      vec3 graded = mix(color, sCurve, 0.42 * cg);

      if (uFxPresetIndex < 0.5) {
        graded *= mix(vec3(1.0), vec3(1.05, 1.01, 0.94), cg);
      } else if (uFxPresetIndex < 1.5) {
        graded = mix(graded, pow(clamp(graded, 0.0, 1.0), vec3(0.95, 0.97, 1.02)), cg * 0.6);
      } else if (uFxPresetIndex < 2.5) {
        graded *= mix(vec3(1.0), vec3(0.96, 1.01, 1.06), cg);
      } else if (uFxPresetIndex < 3.5) {
        graded = mix(graded, graded * 0.88 + vec3(0.045, 0.038, 0.028), cg * 0.75);
      } else {
        float l = dot(graded, vec3(0.299, 0.587, 0.114));
        graded = mix(vec3(l), graded, 1.0 + 0.35 * cg);
      }
      color = mix(color, clamp(graded, 0.0, 1.0), cg);
    }

    // Optical Lens Vignette
    if (uVignetteIntensity > 0.01) {
      vec2 centered = uv - 0.5;
      centered.x *= 1.15;
      float vig = 1.0 - smoothstep(0.28, 0.78, length(centered)) * uVignetteIntensity * 0.78;
      color *= vig;
    }

    // 35mm Organic Film Grain (static photographic grain)
    if (uFilmGrain > 0.01) {
      float grain = hash12(uv * 950.0) - 0.5;
      color += vec3(grain) * uFilmGrain * 0.14;
    }

    gl_FragColor = vec4(clamp(color, 0.0, 1.0), 1.0);
  }
`;

function createRadialContactShadowTexture(): THREE.CanvasTexture {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 128;
  const ctx = c.getContext('2d')!;
  const g = ctx.createRadialGradient(64, 64, 6, 64, 64, 60);
  g.addColorStop(0, 'rgba(0, 0, 0, 0.55)');
  g.addColorStop(0.6, 'rgba(0, 0, 0, 0.18)');
  g.addColorStop(1, 'rgba(0, 0, 0, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

function createArchitecturalPropsGroup(isSoftwareGl: boolean): THREE.Group {
  const rootGroup = new THREE.Group();

  const haloGroup = new THREE.Group();
  haloGroup.position.set(1.55, 1.72, 0.55);
  haloGroup.rotation.x = Math.PI * 0.47;
  haloGroup.rotation.y = -0.12;

  const goldMaterial = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#c8a258'),
    metalness: 0.92,
    roughness: 0.2,
    clearcoat: 0.6,
  });

  const darkBronzeMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#2a241d'),
    metalness: 0.65,
    roughness: 0.48,
  });

  const ledEmissiveMaterial = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#fff3d6'),
    emissive: new THREE.Color('#ffcf75'),
    emissiveIntensity: 2.1,
    roughness: 0.15,
    metalness: 0.1,
  });

  const outerRingGeo = new THREE.TorusGeometry(1.55, 0.042, 20, 72);
  const outerRingMesh = new THREE.Mesh(outerRingGeo, goldMaterial);
  outerRingMesh.castShadow = !isSoftwareGl;
  haloGroup.add(outerRingMesh);

  const innerLedGeo = new THREE.TorusGeometry(1.5, 0.024, 16, 72);
  const innerLedMesh = new THREE.Mesh(innerLedGeo, ledEmissiveMaterial);
  haloGroup.add(innerLedMesh);

  const trimRingGeo = new THREE.TorusGeometry(1.55, 0.018, 12, 64);
  const trimRingMesh = new THREE.Mesh(trimRingGeo, darkBronzeMaterial);
  trimRingMesh.position.z = -0.035;
  haloGroup.add(trimRingMesh);

  const cableGeo = new THREE.CylinderGeometry(0.005, 0.005, 0.9, 8);
  const anchorGeo = new THREE.CylinderGeometry(0.025, 0.018, 0.05, 12);
  for (let i = 0; i < 4; i++) {
    const angle = (i / 4) * Math.PI * 2 + 0.4;
    const rx = Math.cos(angle) * 1.54;
    const ry = Math.sin(angle) * 1.54;

    const cable = new THREE.Mesh(cableGeo, darkBronzeMaterial);
    cable.position.set(rx, ry, -0.45);
    cable.rotation.x = Math.PI * 0.5;
    haloGroup.add(cable);

    const anchor = new THREE.Mesh(anchorGeo, goldMaterial);
    anchor.position.set(rx, ry, -0.02);
    anchor.rotation.x = Math.PI * 0.5;
    haloGroup.add(anchor);
  }

  rootGroup.add(haloGroup);

  const sculptureGroup = new THREE.Group();
  sculptureGroup.position.set(2.52, -0.62, 0.82);
  sculptureGroup.scale.setScalar(0.42);

  const lathePoints = [
    new THREE.Vector2(0.0, 0.0),
    new THREE.Vector2(0.38, 0.0),
    new THREE.Vector2(0.34, 0.08),
    new THREE.Vector2(0.22, 0.14),
    new THREE.Vector2(0.0, 0.14),
  ];
  const plinthGeo = new THREE.LatheGeometry(lathePoints, 28);
  const plinthMat = new THREE.MeshStandardMaterial({
    color: new THREE.Color('#d8cfc2'),
    roughness: 0.55,
    metalness: 0.15,
  });
  const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
  sculptureGroup.add(plinthMesh);

  const waveShape = new THREE.Shape();
  waveShape.moveTo(-0.18, 0.14);
  waveShape.bezierCurveTo(-0.35, 0.48, 0.28, 0.72, 0.35, 1.05);
  waveShape.bezierCurveTo(0.12, 0.85, -0.15, 0.55, 0.05, 0.14);
  waveShape.closePath();

  const extrudeGeo = new THREE.ExtrudeGeometry(waveShape, {
    depth: 0.06,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.015,
    bevelSegments: 3,
  });
  const chromeMat = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color('#eceff4'),
    metalness: 0.95,
    roughness: 0.12,
    clearcoat: 1.0,
  });
  const waveMesh = new THREE.Mesh(extrudeGeo, chromeMat);
  sculptureGroup.add(waveMesh);

  const shadowTex = createRadialContactShadowTexture();
  const shadowPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.1, 1.1),
    new THREE.MeshBasicMaterial({
      map: shadowTex,
      transparent: true,
      depthWrite: false,
      opacity: 0.48,
    })
  );
  shadowPlane.rotation.x = -Math.PI / 2;
  shadowPlane.position.y = 0.005;
  sculptureGroup.add(shadowPlane);

  rootGroup.add(sculptureGroup);
  return rootGroup;
}

export const ParallaxThreeViewport: React.FC<ParallaxThreeViewportProps> = ({
  sceneAsset,
  settings,
  onCanvasReady,
}) => {
  const canvasMountRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<VisualEffectSettings>(settings);
  const materialRef = useRef<THREE.ShaderMaterial | null>(null);
  const propsGroupRef = useRef<THREE.Group | null>(null);
  const textureLoaderRef = useRef<THREE.TextureLoader>(new THREE.TextureLoader());

  useEffect(() => {
    settingsRef.current = settings;
    if (materialRef.current) {
      const u = materialRef.current.uniforms;
      u.uDepthIntensity.value = settings.depthIntensity / 100;
      u.uPhotorealism.value = settings.photorealism / 100;
      u.uWarmGlow.value = settings.warmGlow / 100;
      u.uBlurIntensity.value = (settings.blurIntensity ?? 18) / 100;
      u.uVignetteIntensity.value = (settings.vignetteIntensity ?? 34) / 100;
      u.uColorGrading.value = (settings.colorGrading ?? 62) / 100;
      u.uFilmGrain.value = (settings.filmGrain ?? 14) / 100;
      u.uWindowLight.value = (settings.windowLightIntensity ?? 76) / 100;
      u.uFxPresetIndex.value = fxPresetToIndex(settings.activeFxPreset);
    }
    if (propsGroupRef.current) {
      propsGroupRef.current.visible = settings.show3DProps;
    }
  }, [settings]);

  useEffect(() => {
    if (!materialRef.current) return;
    const loader = textureLoaderRef.current;
    loader.load(sceneAsset.imageUrl, (tex) => {
      tex.colorSpace = THREE.SRGBColorSpace;
      tex.minFilter = THREE.LinearFilter;
      tex.magFilter = THREE.LinearFilter;
      if (materialRef.current) {
        const oldTex = materialRef.current.uniforms.uTexture.value;
        materialRef.current.uniforms.uTexture.value = tex;
        materialRef.current.uniforms.uWindowBounds.value.set(
          sceneAsset.windowBounds.xMin,
          sceneAsset.windowBounds.xMax,
          sceneAsset.windowBounds.yMin,
          sceneAsset.windowBounds.yMax
        );
        if (oldTex && oldTex !== tex) {
          oldTex.dispose();
        }
      }
    });
  }, [sceneAsset]);

  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const isSoftwareGl = (() => {
      const gl = document.createElement('canvas').getContext('webgl2');
      if (!gl) return true;
      const ext = gl.getExtension('WEBGL_debug_renderer_info');
      const param = ext ? ext.UNMASKED_RENDERER_WEBGL : gl.RENDERER;
      const gpu = String(gl.getParameter(param));
      gl.getExtension('WEBGL_lose_context')?.loseContext();
      return /SwiftShader|llvmpipe|softpipe|Software|Basic Render/i.test(gpu);
    })();

    const renderer = new THREE.WebGLRenderer({
      antialias: !isSoftwareGl,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setPixelRatio(isSoftwareGl ? 1 : Math.min(window.devicePixelRatio, 2));
    renderer.setSize(
      container.clientWidth || window.innerWidth,
      container.clientHeight || window.innerHeight
    );
    renderer.shadowMap.enabled = !isSoftwareGl;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.innerHTML = '';
    container.appendChild(renderer.domElement);
    onCanvasReady?.(renderer.domElement);

    const scene = new THREE.Scene();
    scene.background = new THREE.Color('#090a0d');
    scene.fog = new THREE.FogExp2('#090a0d', 0.045);

    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    scene.environment = pmremGenerator.fromScene(new RoomEnvironment(), 0.04).texture;
    pmremGenerator.dispose();

    const camera = new THREE.PerspectiveCamera(
      42,
      (container.clientWidth || window.innerWidth) /
        (container.clientHeight || window.innerHeight),
      0.1,
      100
    );
    camera.position.set(0, 0, 5.32);
    camera.lookAt(_lookAtVec);

    const hemiLight = new THREE.HemisphereLight('#c4d6ff', '#2c2219', 0.85);
    scene.add(hemiLight);

    const keyLight = new THREE.DirectionalLight('#ffdfa8', 1.85);
    keyLight.position.set(-3.5, 2.8, 4.2);
    keyLight.castShadow = !isSoftwareGl;
    keyLight.shadow.bias = -0.0005;
    keyLight.shadow.normalBias = 0.02;
    scene.add(keyLight);

    const rimLight = new THREE.DirectionalLight('#ffd180', 1.1);
    rimLight.position.set(3.2, 2.4, -2.0);
    scene.add(rimLight);

    const initCanvas = document.createElement('canvas');
    initCanvas.width = 64;
    initCanvas.height = 36;
    const initCtx = initCanvas.getContext('2d')!;
    initCtx.fillStyle = '#151821';
    initCtx.fillRect(0, 0, 64, 36);
    const placeholderTex = new THREE.CanvasTexture(initCanvas);
    placeholderTex.colorSpace = THREE.SRGBColorSpace;

    const planeGeo = new THREE.PlaneGeometry(8.8, 4.95, 128, 72);
    const s = settingsRef.current;
    const shaderMat = new THREE.ShaderMaterial({
      uniforms: {
        uTexture: { value: placeholderTex },
        uDepthIntensity: { value: s.depthIntensity / 100 },
        uPhotorealism: { value: s.photorealism / 100 },
        uWarmGlow: { value: s.warmGlow / 100 },
        uBlurIntensity: { value: (s.blurIntensity ?? 18) / 100 },
        uVignetteIntensity: { value: (s.vignetteIntensity ?? 34) / 100 },
        uColorGrading: { value: (s.colorGrading ?? 62) / 100 },
        uFilmGrain: { value: (s.filmGrain ?? 14) / 100 },
        uWindowLight: { value: (s.windowLightIntensity ?? 76) / 100 },
        uFxPresetIndex: { value: fxPresetToIndex(s.activeFxPreset) },
        uWindowBounds: {
          value: new THREE.Vector4(
            sceneAsset.windowBounds.xMin,
            sceneAsset.windowBounds.xMax,
            sceneAsset.windowBounds.yMin,
            sceneAsset.windowBounds.yMax
          ),
        },
      },
      vertexShader: VERTEX_SHADER,
      fragmentShader: FRAGMENT_SHADER,
    });
    materialRef.current = shaderMat;

    const depthMesh = new THREE.Mesh(planeGeo, shaderMat);
    scene.add(depthMesh);

    textureLoaderRef.current.load(sceneAsset.imageUrl, (loadedTex) => {
      loadedTex.colorSpace = THREE.SRGBColorSpace;
      loadedTex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      shaderMat.uniforms.uTexture.value = loadedTex;
      placeholderTex.dispose();
    });

    const propsGroup = createArchitecturalPropsGroup(isSoftwareGl);
    propsGroup.visible = settingsRef.current.show3DProps;
    propsGroupRef.current = propsGroup;
    scene.add(propsGroup);

    if (!isSoftwareGl) {
      renderer.compile(scene, camera);
    }

    const onResize = () => {
      const w = container.clientWidth || window.innerWidth;
      const h = container.clientHeight || window.innerHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    window.addEventListener('resize', onResize);

    let frameId = 0;

    function afterDraw(cb: () => void) {
      const gl = renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync ? gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0) : null;
      gl.flush();
      const poll = () => {
        const state = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (state === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 120);
        }
      };
      frameId = window.setTimeout(poll, 5);
    }

    function tick() {
      renderer.render(scene, camera);

      if (isSoftwareGl) {
        afterDraw(tick);
      } else {
        frameId = requestAnimationFrame(tick);
      }
    }

    tick();

    return () => {
      window.removeEventListener('resize', onResize);
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      planeGeo.dispose();
      shaderMat.dispose();
      renderer.dispose();
    };
  }, []);

  return (
    <div
      ref={canvasMountRef}
      className="fixed inset-0 w-screen h-screen overflow-hidden bg-[#090a0d] z-0"
      aria-label="Widok studyjny głębi 3D i efektów wizualnych Bujok Medical"
    />
  );
};
