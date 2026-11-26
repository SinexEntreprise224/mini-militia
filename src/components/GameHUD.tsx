import React from 'react';
import { GRENADES, WEAPONS } from '../game/data/weapons';
import { MatchSnapshot, PlayerState, SplitScreenMode } from '../game/types';

interface Props {
  snapshot: MatchSnapshot;
  twoPlayerLocal: boolean;
  isSplitActive: boolean;
  splitOrientation: 'vertical' | 'horizontal';
  splitMode: SplitScreenMode;
  p1Zoom: { distance: number; label: string };
  p2Zoom: { distance: number; label: string };
  onPauseClick: () => void;
  onScoreboardClick: () => void;
}

function formatTime(sec: number): string {
  const s = Math.max(0, Math.floor(sec));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${rem.toString().padStart(2, '0')}`;
}

const PlayerHudCluster: React.FC<{
  player: PlayerState;
  snapshot: MatchSnapshot;
  zoomInfo: { distance: number; label: string };
  compact?: boolean;
  alignRight?: boolean;
}> = ({ player, snapshot, zoomInfo, compact = false, alignRight = false }) => {
  const activeSlot = player.weapons[player.activeSlot];
  const secondarySlot = player.weapons[player.activeSlot === 0 ? 1 : 0];
  const spec = WEAPONS[activeSlot ? activeSlot.weaponId : 'pistol'];
  const secSpec = secondarySlot ? WEAPONS[secondarySlot.weaponId] : null;
  const gSpec = GRENADES[player.grenadeType];

  const nearbyPickup = player.nearbyPickupId
    ? snapshot.pickups.find((pk) => pk.id === player.nearbyPickupId && pk.available)
    : undefined;
  const pickupWeaponSpec = nearbyPickup?.weaponId ? WEAPONS[nearbyPickup.weaponId] : null;

  const hpPct = Math.max(0, Math.min(100, Math.round((player.health / player.maxHealth) * 100)));
  const fuelPct = Math.max(0, Math.min(100, Math.round((player.fuel / player.maxFuel) * 100)));

  return (
    <div className="flex flex-col justify-between h-full p-3 select-none">
      {/* Top Row: Health, Fuel & Zoom */}
      <div className={`flex items-start gap-2 ${alignRight ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className="bg-slate-950/85 border border-slate-700/80 rounded-lg px-3 py-2 min-w-[200px]">
          <div className="flex items-center justify-between text-xs font-semibold tracking-wide text-slate-200 mb-1">
            <span className="truncate max-w-[115px]">{player.name}</span>
            <span className="tabular-nums text-emerald-400">
              {Math.ceil(player.health)} HP
            </span>
          </div>
          <div className="h-2.5 w-full bg-slate-800 rounded overflow-hidden mb-1.5">
            <div
              className={`h-full transition-all duration-75 ${
                hpPct > 50 ? 'bg-emerald-400' : hpPct > 25 ? 'bg-amber-400' : 'bg-rose-500'
              }`}
              style={{ width: `${hpPct}%` }}
            />
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-300 mb-0.5">
            <span>JETPACK FUEL</span>
            <span className="tabular-nums text-sky-400">{fuelPct}%</span>
          </div>
          <div className="h-1.5 w-full bg-slate-800 rounded overflow-hidden">
            <div
              className={`h-full ${
                player.jetpackActive ? 'bg-orange-400' : 'bg-sky-400'
              }`}
              style={{ width: `${fuelPct}%` }}
            />
          </div>
        </div>

        {/* Zoom & K/D Pill */}
        <div className="bg-slate-950/85 border border-slate-700/80 rounded-lg px-2.5 py-1.5 text-[11px] font-mono text-slate-300 flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">ZOOM</span>
            <span className="text-sky-300 font-bold tabular-nums">
              {player.zoomHeld ? 'AIM' : zoomInfo.label} {zoomInfo.distance}%
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-slate-400">K/D</span>
            <span className="text-amber-300 font-bold tabular-nums">
              {player.kills}/{player.deaths}
            </span>
          </div>
        </div>
      </div>

      {/* Center Prompt: Respawn or Weapon Pickup */}
      <div className="flex flex-col items-center justify-center gap-2 my-auto">
        {!player.alive && (
          <div className="bg-slate-950/90 border border-rose-500/70 rounded-lg px-4 py-2 text-center">
            <div className="text-xs uppercase tracking-widest text-rose-400 font-bold">
              Pilot Down
            </div>
            <div className="text-sm text-slate-100 tabular-nums">
              Respawning in {Math.max(0, player.respawnTimer).toFixed(1)}s
            </div>
          </div>
        )}
        {player.alive && pickupWeaponSpec && (
          <div className="bg-slate-950/90 border border-amber-400/80 rounded-lg px-3 py-1.5 text-center">
            <div className="text-xs font-bold text-amber-300">
              {pickupWeaponSpec.name}{' '}
              <span className="text-slate-400 font-normal">({pickupWeaponSpec.category.toUpperCase()})</span>
            </div>
            <div className="text-[11px] text-slate-200">
              Press <span className="font-bold text-amber-300">[X / E]</span> to Equip ·{' '}
              <span className="tabular-nums">{pickupWeaponSpec.magSize}</span> mag
            </div>
          </div>
        )}
      </div>

      {/* Bottom Row: Weapon, Ammo, Secondary & Grenades */}
      <div className={`flex items-end gap-2 ${alignRight ? 'flex-row-reverse' : 'flex-row'}`}>
        <div className="bg-slate-950/85 border border-slate-700/80 rounded-lg px-3 py-2 min-w-[210px]">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-extrabold tracking-wider text-amber-300">
              {spec.shortName}
            </span>
            {secSpec && (
              <span className="text-[10px] text-slate-400 font-semibold">
                [Y/Q] {secSpec.shortName}
              </span>
            )}
          </div>
          {player.reloading ? (
            <div className="mt-1">
              <div className="flex justify-between text-[11px] text-amber-300 font-bold mb-0.5">
                <span>RELOADING...</span>
                <span className="tabular-nums">{Math.max(0, player.reloadTimer).toFixed(1)}s</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded overflow-hidden">
                <div
                  className="h-full bg-amber-400"
                  style={{
                    width: `${Math.min(
                      100,
                      Math.round((1 - player.reloadTimer / Math.max(0.1, player.reloadDuration)) * 100)
                    )}%`,
                  }}
                />
              </div>
            </div>
          ) : (
            <div className="flex items-baseline justify-between mt-0.5">
              <div className="text-xl font-black tabular-nums text-white leading-none">
                {spec.isMelee ? 'INF' : activeSlot?.magAmmo ?? 0}
                <span className="text-xs font-semibold text-slate-400 ml-1">
                  / {spec.isMelee ? '∞' : activeSlot?.reserveAmmo ?? 0}
                </span>
              </div>
              {activeSlot && activeSlot.magAmmo === 0 && !spec.isMelee && (
                <span className="text-[10px] font-bold text-rose-400">EMPTY [X/R]</span>
              )}
            </div>
          )}
        </div>

        {/* Grenades */}
        {!compact && (
          <div className="bg-slate-950/85 border border-slate-700/80 rounded-lg px-2.5 py-2 flex items-center gap-2">
            <div>
              <div className="text-[10px] text-slate-400 uppercase font-semibold">
                [RB / G] {gSpec.type}
              </div>
              <div className="text-sm font-black tabular-nums text-orange-300">
                ×{player.grenades[player.grenadeType]}
              </div>
            </div>
            <div className="text-[10px] text-slate-500 border-l border-slate-700 pl-2 tabular-nums">
              <div>F:{player.grenades.frag}</div>
              <div>T:{player.grenades.incendiary} P:{player.grenades.proximity}</div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const GameHUD: React.FC<Props> = ({
  snapshot,
  twoPlayerLocal,
  isSplitActive,
  splitOrientation,
  splitMode,
  p1Zoom,
  p2Zoom,
  onPauseClick,
  onScoreboardClick,
}) => {
  const p1 = snapshot.players.find((p) => p.localSlot === 0);
  const p2 = snapshot.players.find((p) => p.localSlot === 1);

  return (
    <div className="fixed inset-0 pointer-events-none z-20 flex flex-col">
      {/* Split-Screen Divider Line */}
      {twoPlayerLocal && isSplitActive && (
        <div
          className={
            splitOrientation === 'vertical'
              ? 'fixed top-0 bottom-0 left-1/2 -translate-x-1/2 w-[3px] bg-slate-900 border-x border-sky-400/50 z-20'
              : 'fixed left-0 right-0 top-1/2 -translate-y-1/2 h-[3px] bg-slate-900 border-y border-sky-400/50 z-20'
          }
        />
      )}

      {/* Top Center Match Header */}
      <div className="fixed top-2 left-1/2 -translate-x-1/2 z-30 flex items-center gap-2 pointer-events-auto">
        <div className="bg-slate-950/90 border border-slate-700 rounded-lg px-3 py-1.5 flex items-center gap-3 text-xs font-bold text-slate-100">
          {(snapshot.mode === 'team_deathmatch' || snapshot.mode === 'ctf') && (
            <>
              <span className="text-sky-400 tabular-nums">BLUE {snapshot.teamScores.team1}</span>
              <span className="text-slate-500">vs</span>
              <span className="text-rose-400 tabular-nums">{snapshot.teamScores.team2} RED</span>
              <span className="text-slate-600">|</span>
            </>
          )}
          {snapshot.mode === 'survival' && (
            <>
              <span className="text-amber-400 tabular-nums">WAVE {snapshot.survivalWave}</span>
              <span className="text-slate-600">|</span>
            </>
          )}
          {snapshot.mode === 'training' ? (
            <span className="text-emerald-400">TRAINING RANGE</span>
          ) : snapshot.mode === 'survival' ? (
            <span className="text-slate-300 tabular-nums">{formatTime(snapshot.elapsed)}</span>
          ) : (
            <span className="text-white tabular-nums font-mono text-sm">
              {formatTime(snapshot.timeRemaining)}
            </span>
          )}
          {twoPlayerLocal && (
            <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-800 text-sky-300 border border-slate-700">
              {isSplitActive ? 'SPLIT' : splitMode === 'dynamic' ? 'SHARED CAM' : 'SHARED'}
            </span>
          )}
        </div>

        <button
          onClick={onScoreboardClick}
          className="bg-slate-950/90 hover:bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 cursor-pointer"
          title="Scoreboard (Tab / View)"
        >
          SCORES
        </button>
        <button
          onClick={onPauseClick}
          className="bg-slate-950/90 hover:bg-slate-800 border border-slate-700 rounded-lg px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 cursor-pointer"
          title="Pause (Esc / Start)"
        >
          PAUSE
        </button>
      </div>

      {/* Top-Right Kill Feed (when single screen) */}
      {!isSplitActive && snapshot.killFeed.length > 0 && (
        <div className="fixed top-14 right-3 z-20 flex flex-col items-end gap-1">
          {snapshot.killFeed.slice(0, 4).map((kf) => (
            <div
              key={kf.id}
              className="bg-slate-950/80 border border-slate-800 rounded px-2.5 py-1 text-[11px] text-slate-200 flex items-center gap-1.5"
            >
              <span
                className={
                  kf.killerTeam === 1
                    ? 'text-sky-400 font-bold'
                    : kf.killerTeam === 2
                    ? 'text-rose-400 font-bold'
                    : 'text-amber-300 font-bold'
                }
              >
                {kf.killerName}
              </span>
              <span className="text-slate-500">[{kf.weaponName}]</span>
              <span
                className={
                  kf.victimTeam === 1
                    ? 'text-sky-400 font-bold'
                    : kf.victimTeam === 2
                    ? 'text-rose-400 font-bold'
                    : 'text-slate-200 font-bold'
                }
              >
                {kf.victimName}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Player HUD Viewports */}
      {!twoPlayerLocal && p1 && (
        <div className="w-full h-full">
          <PlayerHudCluster player={p1} snapshot={snapshot} zoomInfo={p1Zoom} />
        </div>
      )}

      {twoPlayerLocal && !isSplitActive && p1 && p2 && (
        <div className="w-full h-full grid grid-cols-2">
          <PlayerHudCluster player={p1} snapshot={snapshot} zoomInfo={p1Zoom} compact />
          <PlayerHudCluster player={p2} snapshot={snapshot} zoomInfo={p2Zoom} compact alignRight />
        </div>
      )}

      {twoPlayerLocal && isSplitActive && p1 && p2 && (
        <div
          className={`w-full h-full grid ${
            splitOrientation === 'vertical' ? 'grid-cols-2' : 'grid-rows-2'
          }`}
        >
          <div className="relative w-full h-full">
            <PlayerHudCluster player={p1} snapshot={snapshot} zoomInfo={p1Zoom} compact />
          </div>
          <div className="relative w-full h-full">
            <PlayerHudCluster
              player={p2}
              snapshot={snapshot}
              zoomInfo={p2Zoom}
              compact
              alignRight={splitOrientation === 'vertical'}
            />
          </div>
        </div>
      )}
    </div>
  );
};
