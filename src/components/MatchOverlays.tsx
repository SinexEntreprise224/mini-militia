import React from 'react';
import { MatchSnapshot } from '../game/types';

export const PauseModal: React.FC<{
  onResume: () => void;
  onSettings: () => void;
  onLeave: () => void;
}> = ({ onResume, onSettings, onLeave }) => (
  <div className="fixed inset-0 z-50 bg-slate-950/88 flex items-center justify-center p-4">
    <div className="w-full max-w-sm bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-3 text-center shadow-2xl">
      <h2 className="text-xl font-black tracking-widest text-white mb-4">MATCH PAUSED</h2>
      <button
        onClick={onResume}
        className="w-full py-2.5 rounded-xl bg-sky-500 hover:bg-sky-400 text-slate-950 font-black text-sm cursor-pointer"
      >
        RESUME [A / ESC]
      </button>
      <button
        onClick={onSettings}
        className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-100 font-bold text-sm border border-slate-700 cursor-pointer"
      >
        SETTINGS & CONTROLS
      </button>
      <button
        onClick={onLeave}
        className="w-full py-2.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white font-bold text-sm cursor-pointer"
      >
        LEAVE MATCH
      </button>
    </div>
  </div>
);

export const ScoreboardModal: React.FC<{
  snapshot: MatchSnapshot;
  isResults?: boolean;
  onPlayAgain?: () => void;
  onLeave?: () => void;
}> = ({ snapshot, isResults = false, onPlayAgain, onLeave }) => {
  const sorted = [...snapshot.players].sort(
    (a, b) => b.kills - a.kills || a.deaths - b.deaths || b.score - a.score
  );

  return (
    <div className="fixed inset-0 z-40 bg-slate-950/85 flex items-center justify-center p-4 pointer-events-auto">
      <div className="w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-2xl overflow-hidden shadow-2xl">
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-black tracking-wider text-white">
              {isResults ? snapshot.winnerText || 'MATCH COMPLETE' : 'LIVE SCOREBOARD'}
            </h2>
            <p className="text-xs text-slate-400 uppercase">
              {snapshot.mode.replace('_', ' ')} · {snapshot.mapId.replace('_', ' ')}
            </p>
          </div>
          {(snapshot.mode === 'team_deathmatch' || snapshot.mode === 'ctf') && (
            <div className="flex items-center gap-3 text-sm font-black tabular-nums">
              <span className="text-sky-400">BLUE {snapshot.teamScores.team1}</span>
              <span className="text-slate-600">-</span>
              <span className="text-rose-400">{snapshot.teamScores.team2} RED</span>
            </div>
          )}
        </div>

        <div className="p-4 overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead>
              <tr className="text-slate-400 border-b border-slate-800">
                <th className="py-2 px-3">PILOT</th>
                <th className="py-2 px-3">TEAM</th>
                <th className="py-2 px-3 text-right">KILLS</th>
                <th className="py-2 px-3 text-right">DEATHS</th>
                <th className="py-2 px-3 text-right">SCORE</th>
                <th className="py-2 px-3 text-right">TYPE</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((p) => (
                <tr key={p.id} className="border-b border-slate-800/60 text-slate-100">
                  <td className="py-2.5 px-3 font-bold flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-full"
                      style={{ backgroundColor: p.appearance.accentColor }}
                    />
                    {p.name}
                  </td>
                  <td className="py-2.5 px-3">
                    {p.team === 1 ? (
                      <span className="text-sky-400 font-bold">Cobalt</span>
                    ) : p.team === 2 ? (
                      <span className="text-rose-400 font-bold">Crimson</span>
                    ) : (
                      <span className="text-amber-300">Solo</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 text-right font-bold tabular-nums">{p.kills}</td>
                  <td className="py-2.5 px-3 text-right tabular-nums text-slate-400">{p.deaths}</td>
                  <td className="py-2.5 px-3 text-right font-bold tabular-nums text-amber-300">
                    {p.score}
                  </td>
                  <td className="py-2.5 px-3 text-right text-slate-400">
                    {p.isBot ? `BOT (${p.botDifficulty})` : `LOCAL P${p.localSlot + 1}`}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isResults && (
          <div className="px-6 py-4 bg-slate-950 border-t border-slate-800 flex justify-end gap-3">
            <button
              onClick={onLeave}
              className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold text-slate-200 cursor-pointer"
            >
              MAIN MENU
            </button>
            <button
              onClick={onPlayAgain}
              className="px-5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
            >
              PLAY AGAIN
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export const CreditsModal: React.FC<{ onClose: () => void }> = ({ onClose }) => (
  <div className="fixed inset-0 z-50 bg-slate-950/92 flex items-center justify-center p-4">
    <div className="w-full max-w-lg bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
      <div className="flex items-center justify-between border-b border-slate-800 pb-3">
        <h2 className="text-lg font-black tracking-wider text-sky-400">SKYBREAK — CREDITS & TECH</h2>
        <button
          onClick={onClose}
          className="px-3 py-1 rounded bg-slate-800 text-xs font-bold text-slate-200 cursor-pointer"
        >
          CLOSE
        </button>
      </div>
      <p className="text-xs text-slate-300 leading-relaxed">
        <strong>SKYBREAK</strong> is an original 2.5D stylized Three.js jetpack arena shooter featuring
        local solo and 2-player dynamic split-screen combat, dual-stick Xbox controller support,
        weapon-dependent camera zoom, 10 distinct weapons, 3 grenade types, 6 original maps,
        modular 3D character customization, and intelligent bots.
      </p>
      <div className="bg-slate-950 border border-slate-800 rounded-xl p-3 text-[11px] text-slate-400 space-y-1">
        <div><strong className="text-slate-200">Simulation:</strong> Fixed 60Hz deterministic engine decoupled via IMatchTransport (ready for future WebSocket online multiplayer).</div>
        <div><strong className="text-slate-200">Rendering:</strong> Three.js PBR with RoomEnvironment, InstancedMesh pooling, and Scissor dynamic split-screen.</div>
        <div><strong className="text-slate-200">Audio:</strong> 100% Procedural Web Audio API synthesizer.</div>
      </div>
    </div>
  </div>
);
