import React, { useState } from 'react';
import {
  BookOpen,
  Camera,
  ChevronDown,
  ChevronUp,
  Download,
  Film,
  Layers,
  Link2,
  RotateCcw,
  Sliders,
  Sparkles,
  Wand2,
} from 'lucide-react';
import { VISUAL_FX_PRESETS } from '../data/presetScenes';
import {
  DrawerTabId,
  SceneAsset,
  VisualEffectSettings,
  VisualFxPreset,
} from '../types/studio';

interface BottomControlDockProps {
  scenes: SceneAsset[];
  activeScene: SceneAsset;
  onSelectScene: (scene: SceneAsset) => void;
  settings: VisualEffectSettings;
  onChangeSettings: (next: VisualEffectSettings) => void;
  onResetSettings: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onQuickExportWebP: () => void;
  onQuickExportMP4: () => void;
  isExportingMP4: boolean;
  mp4Progress: number;
  onCopyCompactLink: () => void;
  linkCopied: boolean;
  onOpenDrawerTab: (tab: DrawerTabId) => void;
}

export const BottomControlDock: React.FC<BottomControlDockProps> = ({
  scenes,
  activeScene,
  onSelectScene,
  settings,
  onChangeSettings,
  onResetSettings,
  isCollapsed,
  onToggleCollapse,
  onQuickExportWebP,
  onQuickExportMP4,
  isExportingMP4,
  mp4Progress,
  onCopyCompactLink,
  linkCopied,
  onOpenDrawerTab,
}) => {
  const [dockMode, setDockMode] = useState<'core' | 'fx'>('core');

  const updateField = <K extends keyof VisualEffectSettings>(
    key: K,
    val: VisualEffectSettings[K]
  ) => {
    onChangeSettings({
      ...settings,
      [key]: val,
    });
  };

  const applyFxPreset = (preset: VisualFxPreset) => {
    onChangeSettings({
      ...settings,
      ...preset.settings,
    });
  };

  return (
    <div
      className="fixed bottom-4 left-1/2 -translate-x-1/2 z-30 w-[min(1080px,96vw)] transition-transform duration-200 ease-out"
      style={{
        transform: isCollapsed
          ? 'translate(-50%, calc(100% - 36px))'
          : 'translate(-50%, 0)',
      }}
    >
      {/* Top Collapse / Zen Mode Handle */}
      <div className="flex justify-center mb-1.5">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="inline-flex items-center gap-2 px-4 py-1.5 rounded-t-lg bg-[#0d0f14] border border-b-0 border-white/15 text-xs font-medium text-[#e5dec9] hover:text-white transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          title="Skrót klawiszowy: H"
        >
          {isCollapsed ? (
            <>
              <ChevronUp className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>Pokaż panel głębi, efektów FX i wideo z 4 kadrów (H)</span>
            </>
          ) : (
            <>
              <ChevronDown className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>Ukryj panel — Tryb Studyjny Zen (H)</span>
            </>
          )}
        </button>
      </div>

      {/* Main Dock Container — Solid/RGBA surface (No backdrop-filter over WebGL) */}
      <div className="rounded-xl bg-[#0c0e13]/96 border border-white/12 shadow-2xl px-5 py-3.5 text-[#f4f1ea] space-y-3">
        {/* Top Row: Scene Switcher, Dock Mode Selector & Quick Actions */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 pb-2.5 border-b border-white/10">
          {/* Scene Selector */}
          <div className="flex items-center gap-1 bg-[#151821] p-1 rounded-lg border border-white/8">
            {scenes.map((sc, idx) => {
              const active = sc.id === activeScene.id;
              return (
                <button
                  key={sc.id}
                  type="button"
                  onClick={() => onSelectScene(sc)}
                  className={`px-2.5 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#d4af37] text-[#090a0d] font-semibold'
                      : 'text-[#b8b2a6] hover:text-white'
                  }`}
                >
                  {idx === 0
                    ? '01. Lobby z Rzeźbą'
                    : idx === 1
                      ? '02. Lobby z Kwiatami'
                      : sc.title.slice(0, 16)}
                </button>
              );
            })}
          </div>

          {/* 2-Mode Real-Time Panel Switcher: Core Depth & Lighting / Visual FX Library */}
          <div className="flex items-center gap-1 bg-[#151821] p-1 rounded-lg border border-white/8">
            <button
              type="button"
              onClick={() => setDockMode('core')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                dockMode === 'core'
                  ? 'bg-white/14 text-white font-semibold'
                  : 'text-[#9e988c] hover:text-white'
              }`}
            >
              <Sliders className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>Głębia 3D i Oświetlenie</span>
            </button>
            <button
              type="button"
              onClick={() => setDockMode('fx')}
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-md text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                dockMode === 'fx'
                  ? 'bg-white/14 text-white font-semibold'
                  : 'text-[#9e988c] hover:text-white'
              }`}
            >
              <Wand2 className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>Biblioteka Efektów FX</span>
            </button>
          </div>

          {/* Quick 3D Camera Model, Story, Sequence Video & Export Actions */}
          <div className="flex items-center gap-1.5 shrink-0">
            <button
              type="button"
              onClick={() => onOpenDrawerTab('blocking3d')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#171b24] hover:bg-[#1f2430] border border-[#d4af37]/50 text-xs font-semibold text-[#e8ca64] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Otwórz makietę 3D ruchu kamery, rotacji i ujęć filmowych do komunikacji z reżyserem"
            >
              <Camera className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>Model 3D Kamery</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenDrawerTab('sequence')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#171b24] hover:bg-[#1f2430] border border-[#d4af37]/35 text-xs font-medium text-[#f4f1ea] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Otwórz studio 4 wyrenderowanych kadrów i generowania wideo"
            >
              <Layers className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>Studio 4 Kadrów</span>
            </button>

            <button
              type="button"
              onClick={() => onOpenDrawerTab('story')}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#171b24] hover:bg-[#1f2430] border border-white/10 text-xs font-medium text-[#f4f1ea] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Generuj narrację i historię dla załączonych obrazów"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>Narracja</span>
            </button>

            <button
              type="button"
              onClick={onCopyCompactLink}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#171b24] hover:bg-[#1f2430] border border-white/10 text-xs font-medium text-[#f4f1ea] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Link2 className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>{linkCopied ? 'Skopiowano!' : 'Lekki Link'}</span>
            </button>

            <button
              type="button"
              onClick={onQuickExportWebP}
              className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#171b24] hover:bg-[#1f2430] border border-white/10 text-xs font-medium text-[#f4f1ea] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Download className="w-3.5 h-3.5 text-[#d4af37]" />
              <span>WebP</span>
            </button>

            <button
              type="button"
              onClick={onQuickExportMP4}
              disabled={isExportingMP4}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#d4af37] hover:bg-[#e0be4c] disabled:opacity-50 text-xs font-semibold text-[#090a0d] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Renderuj wideo MP4 bezpośrednio z wygenerowanej sekwencji 4 kadrów"
            >
              <Film className="w-3.5 h-3.5" />
              <span>
                {isExportingMP4
                  ? `Render 4 Kadrów (${mp4Progress}%)`
                  : 'Wideo z 4 Kadrów (MP4)'}
              </span>
            </button>
          </div>
        </div>

        {/* Sub-Bar: Predefined Visual FX Presets */}
        <div className="flex items-center justify-between gap-2 pb-1">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <Wand2 className="w-3.5 h-3.5 text-[#d4af37] shrink-0" />
            <span className="text-[11px] text-[#9e988c] mr-1 whitespace-nowrap">
              Profil optyczny i kolorystyczny FX:
            </span>
            {VISUAL_FX_PRESETS.map((fx) => {
              const active = settings.activeFxPreset === fx.id;
              return (
                <button
                  key={fx.id}
                  type="button"
                  onClick={() => applyFxPreset(fx)}
                  title={fx.description}
                  className={`px-2.5 py-1 rounded text-xs transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                    active
                      ? 'bg-[#d4af37] text-[#090a0d] font-semibold'
                      : 'bg-[#151821] text-[#b8b2a6] hover:text-white border border-white/8'
                  }`}
                >
                  {fx.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Sliders Row based on active Dock Mode */}
        {dockMode === 'core' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 items-center">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#c5bfb3] font-medium truncate">Głębia optyczna 3D</span>
                <span className="font-mono-tabular text-[#d4af37] font-medium">
                  {settings.depthIntensity}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={settings.depthIntensity}
                onChange={(e) => updateField('depthIntensity', Number(e.target.value))}
                className="studio-slider w-full"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#c5bfb3] font-medium truncate">Fotorealizm PBR</span>
                <span className="font-mono-tabular text-[#d4af37] font-medium">
                  {settings.photorealism}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={settings.photorealism}
                onChange={(e) => updateField('photorealism', Number(e.target.value))}
                className="studio-slider w-full"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#c5bfb3] font-medium truncate">Światło w oknach</span>
                <span className="font-mono-tabular text-[#d4af37] font-medium">
                  {settings.windowLightIntensity}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={settings.windowLightIntensity}
                onChange={(e) => updateField('windowLightIntensity', Number(e.target.value))}
                className="studio-slider w-full"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#c5bfb3] font-medium truncate">Złota godzina LED</span>
                <span className="font-mono-tabular text-[#d4af37] font-medium">
                  {settings.warmGlow}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={settings.warmGlow}
                onChange={(e) => updateField('warmGlow', Number(e.target.value))}
                className="studio-slider w-full"
              />
            </div>

            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#c5bfb3] font-medium truncate">Rozmycie ostrości (DOF)</span>
                <span className="font-mono-tabular text-[#d4af37] font-medium">
                  {settings.blurIntensity}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={settings.blurIntensity}
                onChange={(e) => updateField('blurIntensity', Number(e.target.value))}
                className="studio-slider w-full"
              />
            </div>

            <div className="flex items-center justify-end gap-1.5">
              <button
                type="button"
                onClick={() => updateField('show3DProps', !settings.show3DProps)}
                className={`px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  settings.show3DProps
                    ? 'bg-[#d4af37]/15 border-[#d4af37]/50 text-[#e8ca64]'
                    : 'bg-[#151821] border-white/10 text-[#9e988c]'
                }`}
              >
                <span>Bryły 3D</span>
              </button>

              <button
                type="button"
                onClick={() => onOpenDrawerTab('sequence')}
                className="px-2.5 py-1.5 rounded-lg bg-[#171b24] hover:bg-[#212734] border border-white/12 text-xs font-medium text-[#f4f1ea] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 inline mr-1 text-[#d4af37]" />
                <span>4 Kadry</span>
              </button>

              <button
                type="button"
                onClick={onResetSettings}
                className="p-1.5 rounded-lg bg-[#151821] hover:bg-[#1e222d] border border-white/10 text-[#9e988c] hover:text-white transition-colors shrink-0 cursor-pointer"
                title="Przywróć domyślne parametry"
              >
                <RotateCcw className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        )}

        {dockMode === 'fx' && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 items-center">
            {/* 1. Blur / Optical DOF */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#c5bfb3] font-medium truncate">Rozmycie ostrości (DOF)</span>
                <span className="font-mono-tabular text-[#d4af37] font-medium">
                  {settings.blurIntensity}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={settings.blurIntensity}
                onChange={(e) => updateField('blurIntensity', Number(e.target.value))}
                className="studio-slider w-full"
              />
            </div>

            {/* 2. Vignette */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#c5bfb3] font-medium truncate">Winieta optyczna</span>
                <span className="font-mono-tabular text-[#d4af37] font-medium">
                  {settings.vignetteIntensity}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={settings.vignetteIntensity}
                onChange={(e) => updateField('vignetteIntensity', Number(e.target.value))}
                className="studio-slider w-full"
              />
            </div>

            {/* 3. Color Correction & Grading */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#c5bfb3] font-medium truncate">Korekcja kolorów (LUT)</span>
                <span className="font-mono-tabular text-[#d4af37] font-medium">
                  {settings.colorGrading}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={settings.colorGrading}
                onChange={(e) => updateField('colorGrading', Number(e.target.value))}
                className="studio-slider w-full"
              />
            </div>

            {/* 4. 35mm Film Grain */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#c5bfb3] font-medium truncate">Ziarno filmowe 35mm</span>
                <span className="font-mono-tabular text-[#d4af37] font-medium">
                  {settings.filmGrain}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={settings.filmGrain}
                onChange={(e) => updateField('filmGrain', Number(e.target.value))}
                className="studio-slider w-full"
              />
            </div>

            {/* 5. Warmth / Golden Hour */}
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between text-xs">
                <span className="text-[#c5bfb3] font-medium truncate">Temperatura barw</span>
                <span className="font-mono-tabular text-[#d4af37] font-medium">
                  {settings.warmGlow}%
                </span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={settings.warmGlow}
                onChange={(e) => updateField('warmGlow', Number(e.target.value))}
                className="studio-slider w-full"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
