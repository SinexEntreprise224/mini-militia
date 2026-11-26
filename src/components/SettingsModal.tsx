import React, { useEffect, useState } from 'react';
import { ConnectedGamepadInfo, DEFAULT_GAME_SETTINGS } from '../game/input/InputManager';
import { GameSettings, KeyBindings, SplitScreenMode } from '../game/types';

interface Props {
  settings: GameSettings;
  gamepads: ConnectedGamepadInfo[];
  onChange: (next: GameSettings) => void;
  onClose: () => void;
}

const KEY_LABELS: { key: keyof KeyBindings; label: string }[] = [
  { key: 'left', label: 'Move Left' },
  { key: 'right', label: 'Move Right' },
  { key: 'down', label: 'Drop Through Platform' },
  { key: 'jump', label: 'Jump / Hold Jetpack' },
  { key: 'reload', label: 'Reload' },
  { key: 'pickup', label: 'Pick Up Weapon' },
  { key: 'switchWeapon', label: 'Switch Weapon' },
  { key: 'grenade', label: 'Throw Grenade' },
  { key: 'melee', label: 'Melee Strike' },
  { key: 'secondary', label: 'Secondary Function' },
  { key: 'scoreboard', label: 'Scoreboard' },
  { key: 'pause', label: 'Pause Menu' },
];

export const SettingsModal: React.FC<Props> = ({
  settings,
  gamepads,
  onChange,
  onClose,
}) => {
  const [tab, setTab] = useState<'controller' | 'keyboard' | 'audio' | 'camera'>('controller');
  const [rebinding, setRebinding] = useState<keyof KeyBindings | null>(null);

  useEffect(() => {
    if (!rebinding) return;
    const handler = (e: KeyboardEvent) => {
      e.preventDefault();
      e.stopPropagation();
      onChange({
        ...settings,
        keyBindings: {
          ...settings.keyBindings,
          [rebinding]: e.code,
        },
      });
      setRebinding(null);
    };
    window.addEventListener('keydown', handler, { capture: true });
    return () => window.removeEventListener('keydown', handler, { capture: true });
  }, [rebinding, settings, onChange]);

  const updateCtrl = (patch: Partial<GameSettings['controller']>) =>
    onChange({ ...settings, controller: { ...settings.controller, ...patch } });

  const updateAudio = (patch: Partial<GameSettings['audio']>) =>
    onChange({ ...settings, audio: { ...settings.audio, ...patch } });

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/92 flex items-center justify-center p-4">
      <div className="w-full max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <h2 className="text-lg font-black tracking-wider text-white">SETTINGS & CONTROLS</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onChange(DEFAULT_GAME_SETTINGS)}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-semibold text-slate-300 cursor-pointer"
            >
              RESET DEFAULTS
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 text-xs font-black cursor-pointer"
            >
              CLOSE [ESC]
            </button>
          </div>
        </div>

        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 gap-3">
          {(
            [
              ['controller', 'Xbox Controller'],
              ['keyboard', 'Keyboard & Mouse'],
              ['audio', 'Audio'],
              ['camera', 'Split-Screen & Camera'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`py-3 px-2 text-xs font-bold border-b-2 cursor-pointer ${
                tab === id
                  ? 'border-sky-400 text-sky-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-5 text-sm">
          {tab === 'controller' && (
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 flex items-center justify-between text-xs">
                <span className="text-slate-300 font-semibold">Connected Gamepads:</span>
                <span className="text-sky-400 font-bold">
                  {gamepads.length > 0 ? gamepads.map((g) => g.label).join(' | ') : 'No controller detected (plug in or press a button)'}
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {[
                  ['Horizontal Sensitivity', 'horizontalSensitivity', 0.4, 2.5, 0.05],
                  ['Vertical Sensitivity', 'verticalSensitivity', 0.4, 2.5, 0.05],
                  ['Aim Dead Zone', 'aimDeadZone', 0.05, 0.4, 0.01],
                  ['Move Dead Zone', 'moveDeadZone', 0.05, 0.4, 0.01],
                  ['Aim Acceleration', 'aimAcceleration', 0.8, 2.2, 0.05],
                  ['Aim Assist Strength', 'aimAssistStrength', 0.0, 1.0, 0.05],
                  ['Zoom Sensitivity', 'zoomSensitivity', 0.25, 1.2, 0.05],
                ].map(([label, key, min, max, step]) => {
                  const k = key as keyof GameSettings['controller'];
                  const val = settings.controller[k] as number;
                  return (
                    <div key={String(key)} className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                      <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1.5">
                        <span>{label}</span>
                        <span className="text-sky-400 tabular-nums">{val.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={Number(min)}
                        max={Number(max)}
                        step={Number(step)}
                        value={val}
                        onChange={(e) => updateCtrl({ [k]: Number(e.target.value) })}
                        className="w-full accent-sky-400"
                      />
                    </div>
                  );
                })}
              </div>

              <div className="flex flex-wrap gap-4">
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.controller.vibrationEnabled}
                    onChange={(e) => updateCtrl({ vibrationEnabled: e.target.checked })}
                    className="accent-sky-400 w-4 h-4"
                  />
                  Controller Vibration (Rumble)
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.controller.invertY}
                    onChange={(e) => updateCtrl({ invertY: e.target.checked })}
                    className="accent-sky-400 w-4 h-4"
                  />
                  Invert Right Stick Y
                </label>
              </div>

              <div className="p-3 rounded-xl bg-slate-950 border border-slate-800 text-[11px] text-slate-400 grid grid-cols-2 sm:grid-cols-3 gap-2">
                <div><b className="text-slate-200">L-Stick:</b> Move / Drop</div>
                <div><b className="text-slate-200">R-Stick:</b> 360° Aim</div>
                <div><b className="text-slate-200">RT / LT:</b> Fire / Zoom</div>
                <div><b className="text-slate-200">A:</b> Jump & Jetpack</div>
                <div><b className="text-slate-200">B / X:</b> Melee / Reload-Pickup</div>
                <div><b className="text-slate-200">Y / RB / LB:</b> Swap / Nade / Alt</div>
                <div><b className="text-slate-200">D-Pad U/D:</b> Manual Zoom</div>
                <div><b className="text-slate-200">D-Pad L/R:</b> Cycle Grenade</div>
                <div><b className="text-slate-200">Start / View:</b> Pause / Scores</div>
              </div>
            </div>
          )}

          {tab === 'keyboard' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {KEY_LABELS.map((item) => {
                const isWaiting = rebinding === item.key;
                return (
                  <div
                    key={item.key}
                    className="flex items-center justify-between bg-slate-950 border border-slate-800 rounded-xl px-3 py-2"
                  >
                    <span className="text-xs font-semibold text-slate-300">{item.label}</span>
                    <button
                      onClick={() => setRebinding(item.key)}
                      className={`px-3 py-1 rounded text-xs font-mono font-bold cursor-pointer ${
                        isWaiting
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-800 text-sky-300 hover:bg-slate-700'
                      }`}
                    >
                      {isWaiting ? 'PRESS KEY...' : settings.keyBindings[item.key]}
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {tab === 'audio' && (
            <div className="space-y-4">
              {(
                [
                  ['Master Volume', 'masterVolume'],
                  ['SFX & Weapons', 'sfxVolume'],
                  ['UI Clicks', 'uiVolume'],
                ] as const
              ).map(([label, key]) => (
                <div key={key} className="bg-slate-950 p-3 rounded-xl border border-slate-800">
                  <div className="flex justify-between text-xs font-semibold text-slate-300 mb-1.5">
                    <span>{label}</span>
                    <span className="text-sky-400 tabular-nums">
                      {Math.round(settings.audio[key] * 100)}%
                    </span>
                  </div>
                  <input
                    type="range"
                    min={0}
                    max={1}
                    step={0.05}
                    value={settings.audio[key]}
                    onChange={(e) => updateAudio({ [key]: Number(e.target.value) })}
                    className="w-full accent-sky-400"
                  />
                </div>
              ))}
              <label className="flex items-center gap-2 text-xs font-semibold text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={settings.audio.muted}
                  onChange={(e) => updateAudio({ muted: e.target.checked })}
                  className="accent-rose-500 w-4 h-4"
                />
                Mute All Audio
              </label>
            </div>
          )}

          {tab === 'camera' && (
            <div className="space-y-4">
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-300">2-Player Local Split-Screen Behavior</div>
                <select
                  value={settings.splitScreenMode}
                  onChange={(e) =>
                    onChange({ ...settings, splitScreenMode: e.target.value as SplitScreenMode })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="dynamic">Dynamic (Shared Camera Close / Auto-Split When Separated)</option>
                  <option value="always_split">Always Split-Screen</option>
                  <option value="shared">Always Shared Camera</option>
                </select>
              </div>
              <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-2">
                <div className="text-xs font-bold text-slate-300">Split Viewport Orientation</div>
                <select
                  value={settings.splitOrientation}
                  onChange={(e) =>
                    onChange({
                      ...settings,
                      splitOrientation: e.target.value as 'vertical' | 'horizontal',
                    })
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="vertical">Side-by-Side (Left | Right)</option>
                  <option value="horizontal">Stacked (Top / Bottom)</option>
                </select>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
