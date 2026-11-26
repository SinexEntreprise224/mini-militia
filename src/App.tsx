import React, { useCallback, useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { CustomizationScreen } from './components/CustomizationScreen';
import { GameHUD } from './components/GameHUD';
import {
  CreditsModal,
  PauseModal,
  ScoreboardModal,
} from './components/MatchOverlays';
import { MatchDraft, MatchSetupModal } from './components/MatchSetupModal';
import { SettingsModal } from './components/SettingsModal';
import { SoundEngine } from './game/audio/SoundEngine';
import { MAP_LIST } from './game/data/maps';
import { ConnectedGamepadInfo, InputManager } from './game/input/InputManager';
import { IMatchTransport, LocalMatchTransport } from './game/net/MatchTransport';
import { ArenaRenderer } from './game/render/ArenaRenderer';
import {
  loadAppearance,
  loadPlayerNames,
  loadSettings,
  saveAppearance,
  savePlayerNames,
  saveSettings,
} from './game/storage';
import {
  CharacterAppearance,
  GameSettings,
  MatchConfig,
  MatchSnapshot,
  PlayerInputFrame,
} from './game/types';

type ScreenState = 'title' | 'setup' | 'customization' | 'playing';

const TITLE_ACTIONS = [
  'quick_play',
  'split_screen',
  'training',
  'customize',
  'settings',
  'credits',
] as const;

export default function App() {
  const canvasMountRef = useRef<HTMLDivElement>(null);

  const [settings, setSettings] = useState<GameSettings>(() => loadSettings());
  const [p1Appearance, setP1Appearance] = useState<CharacterAppearance>(() => loadAppearance(0));
  const [p2Appearance, setP2Appearance] = useState<CharacterAppearance>(() => loadAppearance(1));
  const initialNames = loadPlayerNames();

  const [screen, setScreen] = useState<ScreenState>('title');
  const [paused, setPaused] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showCredits, setShowCredits] = useState(false);
  const [scoreboardHeld, setScoreboardHeld] = useState(false);
  const [scoreboardToggle, setScoreboardToggle] = useState(false);
  const [titleFocusIdx, setTitleFocusIdx] = useState(0);
  const [customYawDelta, setCustomYawDelta] = useState(0);

  const [gamepads, setGamepads] = useState<ConnectedGamepadInfo[]>([]);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  const [matchDraft, setMatchDraft] = useState<MatchDraft>({
    mode: 'deathmatch',
    mapId: 'ironworks',
    botCount: 4,
    botDifficulty: 'normal',
    scoreLimit: 10,
    timeLimitSec: 300,
    twoPlayerLocal: false,
    p1Input: 'kb_mouse',
    p2Input: 'gamepad_1',
    p1Name: initialNames.p1Name,
    p2Name: initialNames.p2Name,
  });

  const [hudState, setHudState] = useState<{
    snapshot: MatchSnapshot | null;
    isSplitActive: boolean;
    p1Zoom: { distance: number; label: string };
    p2Zoom: { distance: number; label: string };
  }>({
    snapshot: null,
    isSplitActive: false,
    p1Zoom: { distance: 100, label: 'STD' },
    p2Zoom: { distance: 100, label: 'STD' },
  });

  // Mutable refs for the 60fps isolated WebGL loop
  const rendererRef = useRef<ArenaRenderer | null>(null);
  const inputRef = useRef<InputManager | null>(null);
  const soundRef = useRef<SoundEngine | null>(null);
  const transportRef = useRef<IMatchTransport | null>(null);

  const appStateRef = useRef({
    screen,
    paused,
    showSettings,
    showCredits,
    settings,
    matchDraft,
    p1Appearance,
    p2Appearance,
    titleFocusIdx,
  });

  appStateRef.current = {
    screen,
    paused,
    showSettings,
    showCredits,
    settings,
    matchDraft,
    p1Appearance,
    p2Appearance,
    titleFocusIdx,
  };

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    window.setTimeout(() => {
      setToastMsg((cur) => (cur === msg ? null : cur));
    }, 3500);
  }, []);

  const handleUpdateSettings = useCallback((next: GameSettings) => {
    setSettings(next);
    saveSettings(next);
    inputRef.current?.updateSettings(next);
    soundRef.current?.updateSettings(next.audio);
  }, []);

  const handleChangeP1App = useCallback((app: CharacterAppearance) => {
    setP1Appearance(app);
    saveAppearance(0, app);
  }, []);

  const handleChangeP2App = useCallback((app: CharacterAppearance) => {
    setP2Appearance(app);
    saveAppearance(1, app);
  }, []);

  const handleDraftChange = useCallback((patch: Partial<MatchDraft>) => {
    setMatchDraft((prev) => {
      const next = { ...prev, ...patch };
      if (patch.p1Name !== undefined || patch.p2Name !== undefined) {
        savePlayerNames(next.p1Name, next.p2Name);
      }
      return next;
    });
  }, []);

  const startMatch = useCallback((overrideDraft?: Partial<MatchDraft>) => {
    const cur = appStateRef.current;
    const d = { ...cur.matchDraft, ...(overrideDraft || {}) };
    if (overrideDraft) setMatchDraft(d);

    const cfg: MatchConfig = {
      mode: d.mode,
      mapId: d.mapId,
      botCount: d.mode === 'training' ? 2 : d.botCount,
      botDifficulty: d.botDifficulty,
      scoreLimit: d.scoreLimit,
      timeLimitSec: d.timeLimitSec,
      twoPlayerLocal: d.twoPlayerLocal,
      p1Input: d.p1Input,
      p2Input: d.p2Input,
      p1Appearance: cur.p1Appearance,
      p2Appearance: cur.p2Appearance,
      p1Name: d.p1Name || 'Pilot 1',
      p2Name: d.p2Name || 'Pilot 2',
    };

    transportRef.current?.dispose();
    const transport = new LocalMatchTransport(cfg);
    transportRef.current = transport;

    setPaused(false);
    setShowSettings(false);
    setScoreboardHeld(false);
    setScoreboardToggle(false);
    setScreen('playing');
    soundRef.current?.playUiClick(true);
    setHudState({
      snapshot: transport.getLatestSnapshot(),
      isSplitActive: false,
      p1Zoom: { distance: 100, label: 'STD' },
      p2Zoom: { distance: 100, label: 'STD' },
    });
  }, []);

  const leaveMatch = useCallback(() => {
    transportRef.current?.dispose();
    transportRef.current = null;
    soundRef.current?.setJetpackThrust(0);
    setPaused(false);
    setScoreboardHeld(false);
    setScoreboardToggle(false);
    setScreen('title');
    setHudState((prev) => ({ ...prev, snapshot: null }));
  }, []);

  const triggerTitleAction = useCallback(
    (action: (typeof TITLE_ACTIONS)[number]) => {
      soundRef.current?.playUiClick(true);
      switch (action) {
        case 'quick_play':
          setMatchDraft((d) => ({ ...d, twoPlayerLocal: false, mode: 'deathmatch' }));
          setScreen('setup');
          break;
        case 'split_screen':
          setMatchDraft((d) => ({
            ...d,
            twoPlayerLocal: true,
            mode: 'deathmatch',
            p2Input:
              gamepads.length >= 2
                ? 'gamepad_1'
                : gamepads.length === 1
                ? 'gamepad_0'
                : 'kb_arrows',
          }));
          setScreen('setup');
          break;
        case 'training':
          startMatch({ mode: 'training', twoPlayerLocal: false, botCount: 2 });
          break;
        case 'customize':
          setScreen('customization');
          break;
        case 'settings':
          setShowSettings(true);
          break;
        case 'credits':
          setShowCredits(true);
          break;
      }
    },
    [gamepads.length, startMatch]
  );

  // Isolated WebGL & Simulation Loop (runs once)
  useEffect(() => {
    const container = canvasMountRef.current;
    if (!container) return;

    const renderer = new ArenaRenderer(container);
    const input = new InputManager(appStateRef.current.settings);
    const sound = new SoundEngine(appStateRef.current.settings.audio);

    rendererRef.current = renderer;
    inputRef.current = input;
    soundRef.current = sound;

    setGamepads(input.getConnectedGamepads());

    input.setCallbacks(
      (pads, msg) => {
        setGamepads(pads);
        if (msg) showToast(msg);
      },
      () => {
        const st = appStateRef.current;
        if (st.screen === 'playing' && !st.showSettings) {
          setPaused((p) => !p);
        } else if (st.showSettings) {
          setShowSettings(false);
        } else if (st.showCredits) {
          setShowCredits(false);
        } else if (st.screen === 'setup' || st.screen === 'customization') {
          setScreen('title');
        }
      }
    );

    const onResize = () => {
      if (!container) return;
      renderer.resize(container.clientWidth || window.innerWidth, container.clientHeight || window.innerHeight);
    };
    window.addEventListener('resize', onResize);

    const clock = new THREE.Clock();
    let frameId = 0;
    let disposed = false;
    let hudSyncAccum = 0;

    const afterDraw = (cb: () => void) => {
      const gl = renderer.renderer.getContext() as WebGL2RenderingContext;
      const sync = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
      const poll = () => {
        if (disposed) return;
        const status = sync && gl.getSyncParameter(sync, gl.SYNC_STATUS);
        if (status === gl.UNSIGNALED) {
          frameId = window.setTimeout(poll, 5);
        } else {
          if (sync) gl.deleteSync(sync);
          frameId = window.setTimeout(cb, 80);
        }
      };
      frameId = window.setTimeout(poll, 5);
    };

    const tick = () => {
      if (disposed) return;
      const rawDt = clock.getDelta();
      const dt = Math.min(rawDt, 0.05);
      const elapsed = clock.getElapsedTime();
      const st = appStateRef.current;

      if (st.screen === 'playing' && transportRef.current) {
        if (!st.paused && !st.showSettings) {
          const prevSnap = transportRef.current.getLatestSnapshot();
          const p1 = prevSnap.players.find((p) => p.localSlot === 0);
          const p2 = prevSnap.players.find((p) => p.localSlot === 1);

          const inputs: PlayerInputFrame[] = [];
          let anyScoreboard = false;

          if (p1) {
            const res = input.samplePlayerInput(
              p1,
              st.matchDraft.p1Input,
              prevSnap.players,
              (sx, sy, px, py) =>
                renderer.screenToWorldAim(sx, sy, px, py, st.settings.splitOrientation)
            );
            inputs.push(res.frame);
            if (res.scoreboardHeld) anyScoreboard = true;
          }
          if (p2 && st.matchDraft.twoPlayerLocal) {
            const res = input.samplePlayerInput(
              p2,
              st.matchDraft.p2Input,
              prevSnap.players,
              (sx, sy, px, py) =>
                renderer.screenToWorldAim(sx, sy, px, py, st.settings.splitOrientation)
            );
            inputs.push(res.frame);
            if (res.scoreboardHeld) anyScoreboard = true;
          }
          input.endFrame();
          setScoreboardHeld(anyScoreboard);

          const snap = transportRef.current.step(dt, inputs);

          // Sound & controller vibration feedback
          sound.playEvents(snap.soundEvents);
          const activeJets = snap.players.filter((p) => p.alive && p.jetpackActive).length;
          sound.setJetpackThrust(activeJets);

          for (const ev of snap.soundEvents) {
            if (ev.type === 'fire' || ev.type === 'damage') {
              if (ev.listenerSlot === 0 || !st.matchDraft.twoPlayerLocal) {
                input.triggerVibration(st.matchDraft.p1Input, 75, 0.25, 0.35);
              }
              if (ev.listenerSlot === 1 && st.matchDraft.twoPlayerLocal) {
                input.triggerVibration(st.matchDraft.p2Input, 75, 0.25, 0.35);
              }
            } else if (ev.type === 'explosion') {
              input.triggerVibration(st.matchDraft.p1Input, 140, 0.5, 0.7);
              if (st.matchDraft.twoPlayerLocal) {
                input.triggerVibration(st.matchDraft.p2Input, 140, 0.5, 0.7);
              }
            }
          }

          renderer.renderMatch(
            snap,
            st.matchDraft.twoPlayerLocal,
            st.settings.splitScreenMode,
            st.settings.splitOrientation,
            dt
          );

          hudSyncAccum += dt;
          if (hudSyncAccum >= 0.05 || snap.phase === 'ended') {
            hudSyncAccum = 0;
            setHudState({
              snapshot: snap,
              isSplitActive: renderer.cameras.isSplitScreenActive(),
              p1Zoom: renderer.cameras.getPlayerZoomInfo(0),
              p2Zoom: renderer.cameras.getPlayerZoomInfo(1),
            });
          }
        } else {
          // Paused: still render scene cleanly, pause jetpack hum
          sound.setJetpackThrust(0);
          input.pollMenuNavigation();
          renderer.renderMatch(
            transportRef.current.getLatestSnapshot(),
            st.matchDraft.twoPlayerLocal,
            st.settings.splitScreenMode,
            st.settings.splitOrientation,
            0
          );
        }
      } else {
        // Title / Setup / Customization: live 3D arena pan + controller menu navigation
        sound.setJetpackThrust(0);
        const nav = input.pollMenuNavigation();

        if (st.screen === 'title' && !st.showSettings && !st.showCredits) {
          if (nav.down || nav.right) {
            setTitleFocusIdx((i) => (i + 1) % TITLE_ACTIONS.length);
            sound.playUiClick(false);
          } else if (nav.up || nav.left) {
            setTitleFocusIdx((i) => (i - 1 + TITLE_ACTIONS.length) % TITLE_ACTIONS.length);
            sound.playUiClick(false);
          } else if (nav.confirm) {
            triggerTitleAction(TITLE_ACTIONS[st.titleFocusIdx]);
          }
        } else if (st.screen === 'customization') {
          if (Math.abs(nav.rightStickX) > 0.1) {
            setCustomYawDelta(nav.rightStickX * 0.06);
          }
          if (nav.back) {
            setScreen('title');
          }
        } else if (st.screen === 'setup' && nav.back) {
          setScreen('title');
        }

        renderer.renderTitleShowcase(st.matchDraft.mapId, elapsed);
      }

      if (renderer.isSoftwareGl) afterDraw(tick);
      else frameId = requestAnimationFrame(tick);
    };

    tick();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      clearTimeout(frameId);
      window.removeEventListener('resize', onResize);
      input.dispose();
      renderer.dispose();
    };
  }, [showToast, triggerTitleAction]);

  // Title Enter/Space quick start
  useEffect(() => {
    if (screen !== 'title' || showSettings || showCredits) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.code === 'Enter') {
        e.preventDefault();
        triggerTitleAction(TITLE_ACTIONS[titleFocusIdx]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [screen, showSettings, showCredits, titleFocusIdx, triggerTitleAction]);

  return (
    <div
      className="relative w-full h-full overflow-hidden bg-slate-950 font-sans"
      onContextMenu={(e) => e.preventDefault()}
    >
      {/* Isolated WebGL Canvas Container */}
      <div ref={canvasMountRef} className="fixed inset-0 z-0" />

      {/* Controller Connection Toast */}
      {toastMsg && (
        <div className="fixed top-4 right-4 z-50 bg-slate-900 border border-sky-400 text-sky-200 px-4 py-2 rounded-xl text-xs font-bold shadow-xl">
          {toastMsg}
        </div>
      )}

      {/* TITLE SCREEN */}
      {screen === 'title' && (
        <div className="fixed inset-0 z-20 flex flex-col justify-between p-6 sm:p-10 pointer-events-none">
          {/* Top Bar: Controller Status + Map Showcase Switcher */}
          <div className="flex items-center justify-between pointer-events-auto">
            <div className="bg-slate-950/85 border border-slate-700 rounded-xl px-3.5 py-2 text-xs font-semibold text-slate-300 flex items-center gap-2">
              <span className="text-sky-400 font-bold">LOCAL ARENA EDITION</span>
              <span className="text-slate-600">|</span>
              <span>
                {gamepads.length > 0
                  ? `${gamepads.length} Xbox/Gamepad Ready`
                  : 'KB + Mouse / Plug Xbox Controller'}
              </span>
            </div>

            <div className="flex items-center gap-1.5 bg-slate-950/85 border border-slate-700 rounded-xl p-1">
              {MAP_LIST.map((m) => (
                <button
                  key={m.id}
                  onClick={() => handleDraftChange({ mapId: m.id })}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                    matchDraft.mapId === m.id
                      ? 'bg-sky-500 text-slate-950'
                      : 'text-slate-300 hover:bg-slate-800'
                  }`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </div>

          {/* Left-aligned Title Lockup & Menu Actions over 35%+ open 3D arena vista */}
          <div className="max-w-md space-y-6 pointer-events-auto my-auto">
            <div>
              <svg
                viewBox="0 0 420 96"
                className="w-full max-w-[380px] h-auto drop-shadow-lg"
                aria-label="SKYBREAK"
              >
                <defs>
                  <linearGradient id="skyGrad" x1="0" y1="0" x2="1" y2="1">
                    <stop offset="0%" stopColor="#38bdf8" />
                    <stop offset="55%" stopColor="#f8fafc" />
                    <stop offset="100%" stopColor="#fb923c" />
                  </linearGradient>
                </defs>
                <polygon points="8,14 28,14 16,80 0,80" fill="#fb923c" />
                <polygon points="32,14 42,14 30,80 20,80" fill="#38bdf8" />
                <text
                  x="52"
                  y="66"
                  fill="url(#skyGrad)"
                  fontFamily="system-ui, -apple-system, sans-serif"
                  fontWeight="900"
                  fontSize="58"
                  letterSpacing="3"
                >
                  SKYBREAK
                </text>
                <text
                  x="55"
                  y="88"
                  fill="#cbd5e1"
                  fontFamily="system-ui, sans-serif"
                  fontWeight="700"
                  fontSize="13"
                  letterSpacing="5"
                >
                  3D JETPACK ARENA SHOOTER
                </text>
              </svg>
            </div>

            <div className="flex flex-col gap-2.5">
              {(
                [
                  ['quick_play', 'PLAY SOLO (VS BOTS)', 'bg-amber-400 hover:bg-amber-300 text-slate-950 font-black'],
                  ['split_screen', 'LOCAL 2-PLAYER SPLIT-SCREEN', 'bg-orange-500 hover:bg-orange-400 text-slate-950 font-black'],
                  ['training', 'TRAINING RANGE (OFFLINE)', 'bg-slate-900/95 hover:bg-slate-800 text-sky-300 border border-slate-700 font-bold'],
                  ['customize', 'CHARACTER CUSTOMIZATION', 'bg-slate-900/95 hover:bg-slate-800 text-white border border-slate-700 font-bold'],
                  ['settings', 'SETTINGS & XBOX CONTROLS', 'bg-slate-900/95 hover:bg-slate-800 text-slate-200 border border-slate-700 font-bold'],
                  ['credits', 'CREDITS & ARCHITECTURE', 'bg-slate-900/95 hover:bg-slate-800 text-slate-400 border border-slate-800 font-semibold'],
                ] as const
              ).map(([id, label, cls], idx) => (
                <button
                  key={id}
                  onClick={() => triggerTitleAction(id)}
                  onMouseEnter={() => setTitleFocusIdx(idx)}
                  className={`w-full px-5 py-3 rounded-xl text-left text-sm tracking-wide flex items-center justify-between transition cursor-pointer ${cls} ${
                    titleFocusIdx === idx ? 'ring-2 ring-white' : ''
                  }`}
                >
                  <span>{label}</span>
                  <span className="text-xs opacity-75">
                    {titleFocusIdx === idx ? '[A / ENTER]' : ''}
                  </span>
                </button>
              ))}
            </div>
          </div>

          {/* Flat Control Hint Line */}
          <div className="bg-slate-950/90 border border-slate-800 rounded-xl px-4 py-2 text-[11px] text-slate-300 flex flex-wrap items-center justify-between gap-2">
            <span>
              <strong className="text-sky-400">PC:</strong> A/D Move · Space Jump/Jetpack · Mouse Aim · LMB Shoot · RMB Zoom · R Reload · E Pickup · Q Swap · G Grenade · F Melee
            </span>
            <span>
              <strong className="text-orange-400">Xbox:</strong> L-Stick Move · R-Stick Aim · A Jetpack · RT Fire · LT Zoom · X Reload/Pickup · Y Swap · RB Grenade · B Melee
            </span>
          </div>
        </div>
      )}

      {/* MATCH SETUP */}
      {screen === 'setup' && (
        <MatchSetupModal
          draft={matchDraft}
          splitMode={settings.splitScreenMode}
          splitOrientation={settings.splitOrientation}
          gamepads={gamepads}
          onChange={handleDraftChange}
          onChangeSplit={(mode, orient) =>
            handleUpdateSettings({
              ...settings,
              splitScreenMode: mode,
              splitOrientation: orient,
            })
          }
          onLaunch={() => startMatch()}
          onCancel={() => setScreen('title')}
        />
      )}

      {/* CHARACTER CUSTOMIZATION */}
      {screen === 'customization' && (
        <CustomizationScreen
          p1Appearance={p1Appearance}
          p2Appearance={p2Appearance}
          onChangeP1={handleChangeP1App}
          onChangeP2={handleChangeP2App}
          onBack={() => setScreen('title')}
          externalYawDelta={customYawDelta}
        />
      )}

      {/* IN-GAME HUD */}
      {screen === 'playing' && hudState.snapshot && (
        <GameHUD
          snapshot={hudState.snapshot}
          twoPlayerLocal={matchDraft.twoPlayerLocal}
          isSplitActive={hudState.isSplitActive}
          splitOrientation={settings.splitOrientation}
          splitMode={settings.splitScreenMode}
          p1Zoom={hudState.p1Zoom}
          p2Zoom={hudState.p2Zoom}
          onPauseClick={() => setPaused((p) => !p)}
          onScoreboardClick={() => setScoreboardToggle((s) => !s)}
        />
      )}

      {/* SCOREBOARD (Tab / View / Toggle) */}
      {screen === 'playing' &&
        hudState.snapshot &&
        hudState.snapshot.phase === 'playing' &&
        (scoreboardHeld || scoreboardToggle) &&
        !paused && <ScoreboardModal snapshot={hudState.snapshot} />}

      {/* MATCH RESULTS */}
      {screen === 'playing' &&
        hudState.snapshot &&
        hudState.snapshot.phase === 'ended' && (
          <ScoreboardModal
            snapshot={hudState.snapshot}
            isResults
            onPlayAgain={() => startMatch()}
            onLeave={leaveMatch}
          />
        )}

      {/* PAUSE MENU */}
      {screen === 'playing' && paused && !showSettings && (
        <PauseModal
          onResume={() => setPaused(false)}
          onSettings={() => setShowSettings(true)}
          onLeave={leaveMatch}
        />
      )}

      {/* SETTINGS MODAL */}
      {showSettings && (
        <SettingsModal
          settings={settings}
          gamepads={gamepads}
          onChange={handleUpdateSettings}
          onClose={() => setShowSettings(false)}
        />
      )}

      {/* CREDITS MODAL */}
      {showCredits && <CreditsModal onClose={() => setShowCredits(false)} />}
    </div>
  );
}
