import React from 'react';
import { MAP_LIST } from '../game/data/maps';
import { ConnectedGamepadInfo } from '../game/input/InputManager';
import {
  BotDifficulty,
  GameMode,
  InputDeviceAssignment,
  MapId,
  SplitScreenMode,
} from '../game/types';

export interface MatchDraft {
  mode: GameMode;
  mapId: MapId;
  botCount: number;
  botDifficulty: BotDifficulty;
  scoreLimit: number;
  timeLimitSec: number;
  twoPlayerLocal: boolean;
  p1Input: InputDeviceAssignment;
  p2Input: InputDeviceAssignment;
  p1Name: string;
  p2Name: string;
}

interface Props {
  draft: MatchDraft;
  splitMode: SplitScreenMode;
  splitOrientation: 'vertical' | 'horizontal';
  gamepads: ConnectedGamepadInfo[];
  onChange: (patch: Partial<MatchDraft>) => void;
  onChangeSplit: (mode: SplitScreenMode, orient: 'vertical' | 'horizontal') => void;
  onLaunch: () => void;
  onCancel: () => void;
}

const MODES: { id: GameMode; label: string; desc: string }[] = [
  { id: 'deathmatch', label: 'Free-For-All', desc: 'Every pilot for themselves. Highest kills wins.' },
  { id: 'team_deathmatch', label: 'Team Deathmatch', desc: 'Cobalt vs Crimson squads battle for eliminations.' },
  { id: 'ctf', label: 'Capture the Flag', desc: 'Steal the enemy flag and return it to your base.' },
  { id: 'survival', label: 'Wave Survival', desc: 'Fight escalating waves of tactical raiders.' },
  { id: 'training', label: 'Training Range', desc: 'Practice jetpack flight, zoom, and weapon pickups offline.' },
];

export const MatchSetupModal: React.FC<Props> = ({
  draft,
  splitMode,
  splitOrientation,
  gamepads,
  onChange,
  onChangeSplit,
  onLaunch,
  onCancel,
}) => {
  return (
    <div className="fixed inset-0 z-40 bg-slate-950/92 flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black tracking-wider text-white">
              {draft.twoPlayerLocal ? 'LOCAL 2-PLAYER SPLIT-SCREEN SETUP' : 'LOCAL ARENA DEPLOYMENT'}
            </h2>
            <p className="text-xs text-slate-400">
              Detected Controllers: {gamepads.length > 0 ? gamepads.map((g) => g.label).join(' · ') : 'None (Keyboard + Mouse ready)'}
            </p>
          </div>
          <button
            onClick={onCancel}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
          >
            BACK [ESC]
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* 1P vs 2P Toggle */}
          <div className="flex flex-wrap items-center gap-3">
            <button
              onClick={() => onChange({ twoPlayerLocal: false })}
              className={`px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
                !draft.twoPlayerLocal
                  ? 'bg-sky-500 text-slate-950 border-sky-400'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              SOLO + BOTS (1 PLAYER)
            </button>
            <button
              onClick={() =>
                onChange({
                  twoPlayerLocal: true,
                  p2Input: gamepads.length >= 2 ? 'gamepad_1' : gamepads.length === 1 ? 'gamepad_0' : 'kb_arrows',
                })
              }
              className={`px-4 py-2 rounded-xl border text-xs font-bold cursor-pointer ${
                draft.twoPlayerLocal
                  ? 'bg-orange-500 text-slate-950 border-orange-400'
                  : 'bg-slate-800 text-slate-300 border-slate-700'
              }`}
            >
              2-PLAYER LOCAL SPLIT-SCREEN
            </button>
          </div>

          {/* Game Mode */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              GAME MODE
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
              {MODES.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onChange({ mode: m.id })}
                  className={`p-3 rounded-xl border text-left cursor-pointer ${
                    draft.mode === m.id
                      ? 'bg-sky-500/20 border-sky-400 text-white'
                      : 'bg-slate-950 border-slate-800 text-slate-300 hover:border-slate-600'
                  }`}
                >
                  <div className="text-xs font-extrabold">{m.label}</div>
                  <div className="text-[11px] text-slate-400 mt-1 leading-snug">{m.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {/* 6 Original Maps */}
          <div>
            <div className="text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
              SELECT ARENA (6 ORIGINAL MAPS)
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {MAP_LIST.map((m) => (
                <button
                  key={m.id}
                  onClick={() => onChange({ mapId: m.id })}
                  className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                    draft.mapId === m.id
                      ? 'bg-sky-500/15 border-sky-400'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-600'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-extrabold text-white">{m.name}</span>
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/30"
                      style={{ backgroundColor: m.theme.platformAccent }}
                    />
                  </div>
                  <div className="text-[11px] text-slate-300">{m.subtitle}</div>
                  <div className="text-[10px] text-sky-400 font-semibold mt-1 uppercase">
                    {m.combatStyle}
                  </div>
                </button>
              ))}
            </div>
          </div>

          {/* Players & Controllers */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-2.5">
              <div className="text-xs font-bold text-sky-400">PILOT 1</div>
              <input
                type="text"
                maxLength={16}
                value={draft.p1Name}
                onChange={(e) => onChange({ p1Name: e.target.value })}
                className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                placeholder="Pilot 1 Callsign"
              />
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Input Device</label>
                <select
                  value={draft.p1Input}
                  onChange={(e) => onChange({ p1Input: e.target.value as InputDeviceAssignment })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                >
                  <option value="kb_mouse">Keyboard + Mouse (and/or Controller 1)</option>
                  <option value="gamepad_0">Xbox Controller #1</option>
                  <option value="gamepad_1">Xbox Controller #2</option>
                </select>
              </div>
            </div>

            {draft.twoPlayerLocal ? (
              <div className="p-4 rounded-xl bg-slate-950 border border-orange-500/40 space-y-2.5">
                <div className="text-xs font-bold text-orange-400">PILOT 2 (LOCAL)</div>
                <input
                  type="text"
                  maxLength={16}
                  value={draft.p2Name}
                  onChange={(e) => onChange({ p2Name: e.target.value })}
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-sm text-white"
                  placeholder="Pilot 2 Callsign"
                />
                <div>
                  <label className="text-[11px] text-slate-400 block mb-1">Input Device</label>
                  <select
                    value={draft.p2Input}
                    onChange={(e) => onChange({ p2Input: e.target.value as InputDeviceAssignment })}
                    className="w-full bg-slate-900 border border-slate-700 rounded-lg px-3 py-1.5 text-xs text-white"
                  >
                    <option value="gamepad_1">Xbox Controller #2</option>
                    <option value="gamepad_0">Xbox Controller #1</option>
                    <option value="kb_arrows">Keyboard Arrows + Enter (Fallback)</option>
                  </select>
                </div>
              </div>
            ) : (
              <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 space-y-3">
                <div className="text-xs font-bold text-slate-300">BOT OPPONENTS & RULES</div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Bots ({draft.botCount})
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={7}
                      value={draft.botCount}
                      onChange={(e) => onChange({ botCount: Number(e.target.value) })}
                      className="w-full accent-sky-400"
                    />
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">Difficulty</label>
                    <select
                      value={draft.botDifficulty}
                      onChange={(e) =>
                        onChange({ botDifficulty: e.target.value as BotDifficulty })
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                    >
                      <option value="easy">Easy</option>
                      <option value="normal">Normal</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Score Limit
                    </label>
                    <select
                      value={draft.scoreLimit}
                      onChange={(e) => onChange({ scoreLimit: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={15}>15</option>
                      <option value={25}>25</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-[11px] text-slate-400 block mb-1">
                      Time Limit
                    </label>
                    <select
                      value={draft.timeLimitSec}
                      onChange={(e) => onChange({ timeLimitSec: Number(e.target.value) })}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2 py-1 text-xs text-white"
                    >
                      <option value={180}>3:00</option>
                      <option value={300}>5:00</option>
                      <option value={480}>8:00</option>
                    </select>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* 2P Dynamic Split-Screen + Bot Settings */}
          {draft.twoPlayerLocal && (
            <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Split-Screen Mode</label>
                <select
                  value={splitMode}
                  onChange={(e) =>
                    onChangeSplit(e.target.value as SplitScreenMode, splitOrientation)
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="dynamic">Dynamic (Shared Close / Split Far)</option>
                  <option value="always_split">Always Split-Screen</option>
                  <option value="shared">Shared Camera Only</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">Split Orientation</label>
                <select
                  value={splitOrientation}
                  onChange={(e) =>
                    onChangeSplit(splitMode, e.target.value as 'vertical' | 'horizontal')
                  }
                  className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1.5 text-xs text-white"
                >
                  <option value="vertical">Left | Right</option>
                  <option value="horizontal">Top / Bottom</option>
                </select>
              </div>
              <div>
                <label className="text-[11px] text-slate-400 block mb-1">
                  Bots ({draft.botCount}) · {draft.botDifficulty.toUpperCase()}
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="range"
                    min={0}
                    max={6}
                    value={draft.botCount}
                    onChange={(e) => onChange({ botCount: Number(e.target.value) })}
                    className="flex-1 accent-orange-400"
                  />
                  <select
                    value={draft.botDifficulty}
                    onChange={(e) =>
                      onChange({ botDifficulty: e.target.value as BotDifficulty })
                    }
                    className="bg-slate-900 border border-slate-700 rounded px-2 py-1 text-xs text-white"
                  >
                    <option value="easy">Easy</option>
                    <option value="normal">Normal</option>
                    <option value="hard">Hard</option>
                  </select>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex items-center justify-between">
          <div className="text-xs text-slate-400">
            Ready: <span className="text-white font-bold">{MAP_LIST.find((m) => m.id === draft.mapId)?.name}</span> ·{' '}
            <span className="text-sky-400 font-bold">{MODES.find((m) => m.id === draft.mode)?.label}</span>
          </div>
          <button
            onClick={onLaunch}
            className="px-6 py-2.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-sm tracking-wide cursor-pointer"
          >
            DEPLOY TO ARENA
          </button>
        </div>
      </div>
    </div>
  );
};
