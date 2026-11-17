/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen, Camera, Check, Copy, Film } from 'lucide-react';
import { BottomControlDock } from './components/BottomControlDock';
import { ParallaxThreeViewport } from './components/ParallaxThreeViewport';
import { StudioWorkspaceDrawer } from './components/StudioWorkspaceDrawer';
import { CINEMATIC_NARRATIVE_SHOTS } from './data/cinematicShotsLibrary';
import {
  decodeCompactShareLink,
  encodeCompactShareLink,
  PRESET_SCENES,
} from './data/presetScenes';
import {
  CameraBlockingConfig,
  DrawerTabId,
  KeyframeItem,
  SceneAsset,
  SceneNarrative,
  VisualEffectSettings,
} from './types/studio';
import {
  exportCanvasToWebP,
  ExportResultInfo,
  generateInstantFourKeyframes,
  renderVideoFromFourKeyframes,
} from './utils/mediaExporter';

export default function App() {
  const [scenes, setScenes] = useState<SceneAsset[]>(PRESET_SCENES);
  const [activeScene, setActiveScene] = useState<SceneAsset>(PRESET_SCENES[0]);
  const [settings, setSettings] = useState<VisualEffectSettings>(
    PRESET_SCENES[0].defaultSettings
  );
  const [narrative, setNarrative] = useState<SceneNarrative>(
    PRESET_SCENES[0].defaultNarrative
  );
  const [showStoryOverlay, setShowStoryOverlay] = useState<boolean>(true);
  const [isDockCollapsed, setIsDockCollapsed] = useState<boolean>(false);

  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [activeDrawerTab, setActiveDrawerTab] = useState<DrawerTabId>('blocking3d');

  const [cameraBlocking, setCameraBlocking] = useState<CameraBlockingConfig>(() => {
    const defaultShot = CINEMATIC_NARRATIVE_SHOTS[0];
    return {
      activeShotPresetId: defaultShot.id,
      ...defaultShot.blocking,
    };
  });

  const [keyframes, setKeyframes] = useState<KeyframeItem[]>([]);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isExportingMP4, setIsExportingMP4] = useState<boolean>(false);
  const [mp4Progress, setMp4Progress] = useState<number>(0);
  const [lastExportInfo, setLastExportInfo] = useState<ExportResultInfo | null>(null);
  const [linkCopied, setLinkCopied] = useState<boolean>(false);
  const [quickPromptCopied, setQuickPromptCopied] = useState<boolean>(false);

  useEffect(() => {
    const decoded = decodeCompactShareLink(window.location.hash);
    if (decoded) {
      const found = PRESET_SCENES.find((s) => s.id === decoded.sceneId) || PRESET_SCENES[0];
      setActiveScene(found);
      setNarrative(found.defaultNarrative);
      if (decoded.settings) {
        setSettings({
          ...found.defaultSettings,
          ...decoded.settings,
        });
      }
    }
  }, []);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'h' || e.key === 'H') {
        setIsDockCollapsed((prev) => !prev);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const regenerateFourKeyframes = useCallback(
    async (
      customPrompts?: string[],
      blockingOverride?: CameraBlockingConfig
    ): Promise<KeyframeItem[]> => {
      try {
        const activeBlocking = blockingOverride ?? cameraBlocking;
        const frames = await generateInstantFourKeyframes(
          activeScene.imageUrl,
          settings,
          activeScene.windowBounds,
          customPrompts,
          activeBlocking
        );
        setKeyframes(frames);
        return frames;
      } catch (err) {
        console.error('Failed to generate 4-frame sequence:', err);
        return keyframes;
      }
    },
    [activeScene, settings, cameraBlocking, keyframes]
  );

  useEffect(() => {
    regenerateFourKeyframes();
  }, [activeScene.id]);

  const compactShareUrl = useMemo(() => {
    return encodeCompactShareLink(
      activeScene.id,
      settings,
      activeScene.curatedPrompts[0]?.id
    );
  }, [activeScene, settings]);

  const handleSelectScene = (scene: SceneAsset) => {
    setActiveScene(scene);
    setSettings(scene.defaultSettings);
    setNarrative(scene.defaultNarrative);
  };

  const handleCopyCompactLink = () => {
    window.history.replaceState(null, '', compactShareUrl);
    navigator.clipboard.writeText(compactShareUrl);
    setLinkCopied(true);
    window.setTimeout(() => setLinkCopied(false), 2200);
  };

  const handleExportSingleWebP = async (quality = 0.86) => {
    if (!canvasRef.current) return;
    const info = await exportCanvasToWebP(canvasRef.current, quality, activeScene.id);
    setLastExportInfo(info);
  };

  /**
   * Compiles and exports a lightweight MP4 video directly from the 4 generated and rendered keyframes
   * using smooth 3D camera path interpolation.
   */
  const handleExportLightweightMP4 = async (durationSec = 6, kbps = 2200) => {
    if (isExportingMP4) return;
    setIsExportingMP4(true);
    setMp4Progress(0);
    try {
      let currentFrames = keyframes;
      if (!currentFrames || currentFrames.length < 4) {
        currentFrames = await generateInstantFourKeyframes(
          activeScene.imageUrl,
          settings,
          activeScene.windowBounds,
          undefined,
          cameraBlocking
        );
        setKeyframes(currentFrames);
      }
      const info = await renderVideoFromFourKeyframes(currentFrames, {
        durationSec,
        targetKbps: kbps,
        aspectRatio: '16:9',
        transitionMode: 'smooth_camera_path',
        cameraBlocking,
        captions: narrative.frameCaptions,
        includeCaptions: showStoryOverlay,
        autoDownload: true,
        onProgress: (pct) => setMp4Progress(pct),
      });
      setLastExportInfo(info);
    } finally {
      setIsExportingMP4(false);
    }
  };

  const handleOpenTab = (tab: DrawerTabId) => {
    setActiveDrawerTab(tab);
    setDrawerOpen(true);
  };

  const activeReadyPrompt = activeScene.curatedPrompts[0];

  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#090a0d] text-[#f4f1ea] select-none">
      {/* 1. Stationary Three.js 3D Depth & Visual FX Studio Viewport */}
      <ParallaxThreeViewport
        sceneAsset={activeScene}
        settings={settings}
        onCanvasReady={(canvas) => {
          canvasRef.current = canvas;
        }}
      />

      {/* 2. Top Bar Contract: 3 Zones separated by gap-8 */}
      <header className="fixed top-0 inset-x-0 z-30 flex items-center justify-between gap-8 px-6 py-3.5 bg-[#090a0d]/92 border-b border-white/10">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          onClick={(e) => {
            e.preventDefault();
            setDrawerOpen(false);
          }}
          className="text-lg font-serif-display font-semibold tracking-wide text-[#f4f1ea] whitespace-nowrap shrink-0"
        >
          Bujok Medical Depth Studio
        </a>

        {/* Zone 2: 5 concise single-line text navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-xs font-medium text-[#c5bfb3]">
          <button
            type="button"
            onClick={() => handleOpenTab('blocking3d')}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              drawerOpen && activeDrawerTab === 'blocking3d' ? 'text-[#d4af37] underline' : 'text-[#e8ca64]'
            }`}
          >
            Model 3D Kamery
          </button>
          <button
            type="button"
            onClick={() => handleOpenTab('prompts')}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              drawerOpen && activeDrawerTab === 'prompts' ? 'text-[#d4af37] underline' : ''
            }`}
          >
            Odpowiedzi i FX
          </button>
          <button
            type="button"
            onClick={() => handleOpenTab('story')}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              drawerOpen && activeDrawerTab === 'story' ? 'text-[#d4af37] underline' : ''
            }`}
          >
            Narracja Obrazu
          </button>
          <button
            type="button"
            onClick={() => handleOpenTab('sequence')}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              drawerOpen && activeDrawerTab === 'sequence' ? 'text-[#d4af37] underline' : ''
            }`}
          >
            4 Kadry i Wideo
          </button>
          <button
            type="button"
            onClick={() => handleOpenTab('director')}
            className={`hover:text-white hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
              drawerOpen && activeDrawerTab === 'director' ? 'text-[#d4af37] underline' : ''
            }`}
          >
            Reżyser AI
          </button>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            disabled={isExportingMP4}
            onClick={() => handleExportLightweightMP4(6, 2200)}
            className="px-4 py-2 text-xs font-semibold text-[#090a0d] bg-[#d4af37] rounded-lg hover:bg-[#e3be42] disabled:opacity-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isExportingMP4
              ? `Render Wideo z 4 Kadrów (${mp4Progress}%)`
              : 'Generuj Wideo z 4 Kadrów (MP4)'}
          </button>
        </div>
      </header>

      {/* 3. Minimal Top-Left Ready-Made Prompt, Narrative & 4-Frame Video Launch Card */}
      {!isDockCollapsed && !drawerOpen && activeReadyPrompt && (
        <div className="fixed top-16 left-6 z-20 max-w-md rounded-xl bg-[#0b0d12]/92 border border-white/12 px-4 py-3 shadow-xl space-y-2.5">
          <div className="flex items-center justify-between gap-2 text-[11px] text-[#b8b2a6]">
            <span>Gotowa odpowiedź i sekwencja 4 kadrów</span>
            <span aria-hidden="true">·</span>
            <button
              type="button"
              onClick={() => handleOpenTab('prompts')}
              className="text-[#d4af37] hover:underline whitespace-nowrap shrink-0 cursor-pointer"
            >
              Wszystkie odpowiedzi (4)
            </button>
          </div>
          <p className="text-xs text-[#eae6dc] line-clamp-2 leading-relaxed">
            {activeReadyPrompt.promptPL}
          </p>

          {showStoryOverlay && (
            <div className="pt-2 border-t border-white/10 space-y-1">
              <div className="text-[11px] font-serif-display font-semibold text-[#d4af37]">
                „{narrative.title}”
              </div>
              <p className="text-[11px] text-[#cbc5b8] line-clamp-2 leading-relaxed italic">
                {narrative.leadHook}
              </p>
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(activeReadyPrompt.promptPL);
                setQuickPromptCopied(true);
                window.setTimeout(() => setQuickPromptCopied(false), 1800);
              }}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-[#d4af37] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              {quickPromptCopied ? (
                <>
                  <Check className="w-3.5 h-3.5 text-emerald-400" />
                  <span>Skopiowano odpowiedź!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3.5 h-3.5" />
                  <span>Kopiuj odpowiedź</span>
                </>
              )}
            </button>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => handleOpenTab('blocking3d')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#e8ca64] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Camera className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Makieta 3D Kamery</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenTab('story')}
                className="inline-flex items-center gap-1 text-xs text-[#cbc5b8] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <BookOpen className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>Historia</span>
              </button>

              <button
                type="button"
                onClick={() => handleOpenTab('sequence')}
                className="inline-flex items-center gap-1 text-xs font-semibold text-[#d4af37] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Film className="w-3.5 h-3.5 text-[#d4af37]" />
                <span>4 Kadry</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 4. Studio Workspace Drawer */}
      <StudioWorkspaceDrawer
        isOpen={drawerOpen}
        activeTab={activeDrawerTab}
        onChangeTab={setActiveDrawerTab}
        onClose={() => setDrawerOpen(false)}
        activeScene={activeScene}
        settings={settings}
        onApplySettings={(partial) =>
          setSettings((prev) => ({
            ...prev,
            ...partial,
          }))
        }
        onAddCustomScene={(newScene) => {
          setScenes((prev) => [...prev, newScene]);
          setActiveScene(newScene);
          setNarrative(newScene.defaultNarrative);
        }}
        cameraBlocking={cameraBlocking}
        onChangeCameraBlocking={setCameraBlocking}
        keyframes={keyframes}
        onRegenerateInstantKeyframes={regenerateFourKeyframes}
        onUpdateKeyframeImage={(index, imageUrl, prompt) => {
          setKeyframes((prev) =>
            prev.map((item, idx) =>
              idx === index ? { ...item, imageUrl, prompt, sourceType: 'ai_generated' } : item
            )
          );
        }}
        narrative={narrative}
        onUpdateNarrative={setNarrative}
        showStoryOverlayOnViewport={showStoryOverlay}
        onToggleStoryOverlay={() => setShowStoryOverlay((prev) => !prev)}
        compactShareUrl={compactShareUrl}
        onCopyCompactLink={handleCopyCompactLink}
        linkCopied={linkCopied}
        onExportSingleWebP={handleExportSingleWebP}
        onExportLightweightMP4={handleExportLightweightMP4}
        isExportingMP4={isExportingMP4}
        mp4Progress={mp4Progress}
        lastExportInfo={lastExportInfo}
      />

      {/* 5. Collapsible Real-Time Visual Effect Intensity Dock */}
      <BottomControlDock
        scenes={scenes}
        activeScene={activeScene}
        onSelectScene={handleSelectScene}
        settings={settings}
        onChangeSettings={setSettings}
        onResetSettings={() => setSettings(activeScene.defaultSettings)}
        isCollapsed={isDockCollapsed}
        onToggleCollapse={() => setIsDockCollapsed((c) => !c)}
        onQuickExportWebP={() => handleExportSingleWebP(0.86)}
        onQuickExportMP4={() => handleExportLightweightMP4(6, 2200)}
        isExportingMP4={isExportingMP4}
        mp4Progress={mp4Progress}
        onCopyCompactLink={handleCopyCompactLink}
        linkCopied={linkCopied}
        onOpenDrawerTab={handleOpenTab}
      />
    </div>
  );
}
