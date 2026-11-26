import React, { useState } from 'react';
import { GameSettings } from '../game/types';

interface Props {
  settings: GameSettings;
  onClose: () => void;
  onOpenSettings: () => void;
}

function formatKeyCode(code: string): string {
  if (code.startsWith('Key')) return code.slice(3);
  if (code.startsWith('Digit')) return code.slice(5);
  if (code === 'Space') return 'ESPACE';
  if (code === 'Escape') return 'ÉCHAP';
  return code;
}

export const ControlsGuideModal: React.FC<Props> = ({
  settings,
  onClose,
  onOpenSettings,
}) => {
  const [tab, setTab] = useState<'xbox' | 'keyboard' | 'split'>('xbox');
  const kb = settings.keyBindings;

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/94 flex items-center justify-center p-4">
      <div className="w-full max-w-4xl bg-slate-900 border border-slate-700 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-950 border-b border-slate-800 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-black tracking-wider text-white">
              GUIDE DES COMMANDES — MANETTE &amp; CLAVIER
            </h2>
            <p className="text-xs text-slate-400">
              Mouvement 3D multi-axes, rotation libre de la caméra et tir dans toutes les directions
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                onClose();
                onOpenSettings();
              }}
              className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-sky-300 border border-slate-700 cursor-pointer"
            >
              PERSONNALISER TOUCHES
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black cursor-pointer"
            >
              FERMER [ÉCHAP]
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 bg-slate-950/60 px-6 gap-4">
          {(
            [
              ['xbox', 'Manette Xbox (Pouces & Gâchettes)'],
              ['keyboard', 'Clavier & Souris (PC)'],
              ['split', '2 Joueurs Local (Écran Scindé)'],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`py-3 px-1 text-xs font-bold border-b-2 cursor-pointer ${
                tab === id
                  ? 'border-amber-400 text-amber-300'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {tab === 'xbox' && (
            <div className="space-y-5">
              {/* Interactive Visual Xbox Controller Diagram */}
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-4 sm:p-6">
                <svg
                  viewBox="0 0 820 380"
                  className="w-full h-auto max-h-[320px] mx-auto"
                  aria-label="Schéma Manette Xbox SKYBREAK"
                >
                  {/* Left Shoulder & Trigger */}
                  <rect x="200" y="34" width="110" height="22" rx="8" fill="#1e293b" stroke="#38bdf8" strokeWidth="2" />
                  <text x="255" y="49" textAnchor="middle" fill="#7dd3fc" fontSize="11" fontWeight="bold">LB / LT</text>

                  {/* Right Shoulder & Trigger */}
                  <rect x="510" y="34" width="110" height="22" rx="8" fill="#1e293b" stroke="#fb923c" strokeWidth="2" />
                  <text x="565" y="49" textAnchor="middle" fill="#fdba74" fontSize="11" fontWeight="bold">RB / RT</text>

                  {/* Controller Body Silhouette */}
                  <path
                    d="M 195 70 C 230 56, 590 56, 625 70 C 668 88, 700 182, 686 276 C 678 320, 634 332, 606 298 L 552 232 C 534 212, 286 212, 268 232 L 214 298 C 186 332, 142 320, 134 276 C 120 182, 152 88, 195 70 Z"
                    fill="#0f172a"
                    stroke="#334155"
                    strokeWidth="4"
                  />

                  {/* Center Guide Button */}
                  <circle cx="410" cy="112" r="20" fill="#1e293b" stroke="#475569" strokeWidth="2" />
                  <polygon points="402,104 418,104 414,120 406,120" fill="#38bdf8" />
                  <circle cx="364" cy="128" r="9" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />
                  <circle cx="456" cy="128" r="9" fill="#1e293b" stroke="#64748b" strokeWidth="1.5" />

                  {/* LEFT THUMBSTICK (Move 3D) */}
                  <circle cx="268" cy="144" r="36" fill="#1e293b" stroke="#38bdf8" strokeWidth="3" />
                  <circle cx="268" cy="144" r="21" fill="#0284c7" opacity="0.35" />
                  <circle cx="268" cy="144" r="14" fill="#38bdf8" />
                  {/* Stick arrows */}
                  <polygon points="268,98 262,107 274,107" fill="#7dd3fc" />
                  <polygon points="268,190 262,181 274,181" fill="#7dd3fc" />
                  <polygon points="222,144 231,138 231,150" fill="#7dd3fc" />
                  <polygon points="314,144 305,138 305,150" fill="#7dd3fc" />

                  {/* D-PAD */}
                  <rect x="314" y="190" width="24" height="62" rx="4" fill="#1e293b" stroke="#64748b" strokeWidth="2" />
                  <rect x="295" y="209" width="62" height="24" rx="4" fill="#1e293b" stroke="#64748b" strokeWidth="2" />

                  {/* RIGHT THUMBSTICK (Look / Rotate Camera 360 + Pitch) */}
                  <circle cx="484" cy="212" r="36" fill="#1e293b" stroke="#fb923c" strokeWidth="3" />
                  <circle cx="484" cy="212" r="21" fill="#ea580c" opacity="0.35" />
                  <circle cx="484" cy="212" r="14" fill="#fb923c" />
                  {/* Look rotation arrows */}
                  <polygon points="484,166 478,175 490,175" fill="#fdba74" />
                  <polygon points="484,258 478,249 490,249" fill="#fdba74" />
                  <polygon points="438,212 447,206 447,218" fill="#fdba74" />
                  <polygon points="530,212 521,206 521,218" fill="#fdba74" />

                  {/* ABXY Buttons */}
                  <circle cx="556" cy="112" r="14" fill="#facc15" />
                  <text x="556" y="117" textAnchor="middle" fill="#0f172a" fontSize="13" fontWeight="900">Y</text>

                  <circle cx="556" cy="172" r="14" fill="#22c55e" />
                  <text x="556" y="177" textAnchor="middle" fill="#0f172a" fontSize="13" fontWeight="900">A</text>

                  <circle cx="524" cy="142" r="14" fill="#3b82f6" />
                  <text x="524" y="147" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="900">X</text>

                  <circle cx="588" cy="142" r="14" fill="#ef4444" />
                  <text x="588" y="147" textAnchor="middle" fill="#ffffff" fontSize="13" fontWeight="900">B</text>

                  {/* CALLOUT LINES & LABELS */}
                  {/* Left Stick Callout */}
                  <line x1="232" y1="144" x2="145" y2="112" stroke="#38bdf8" strokeWidth="2" strokeDasharray="4 3" />
                  <rect x="6" y="76" width="144" height="58" rx="8" fill="#020617" stroke="#38bdf8" strokeWidth="1.5" />
                  <text x="16" y="96" fill="#38bdf8" fontSize="12" fontWeight="900">POUCE GAUCHE</text>
                  <text x="16" y="112" fill="#e2e8f0" fontSize="10.5">Avancer / Reculer</text>
                  <text x="16" y="125" fill="#94a3b8" fontSize="10.5">Esquive Gauche / Droite</text>

                  {/* LT/LB Callout */}
                  <line x1="200" y1="45" x2="148" y2="45" stroke="#38bdf8" strokeWidth="2" />
                  <rect x="6" y="16" width="144" height="50" rx="8" fill="#020617" stroke="#0284c7" strokeWidth="1.5" />
                  <text x="16" y="34" fill="#7dd3fc" fontSize="11.5" fontWeight="900">LT / LB</text>
                  <text x="16" y="49" fill="#e2e8f0" fontSize="10.5">LT: Zoom Précision Arme</text>
                  <text x="16" y="61" fill="#94a3b8" fontSize="10">LB: Mode Secondaire</text>

                  {/* D-Pad Callout */}
                  <line x1="295" y1="226" x2="148" y2="262" stroke="#64748b" strokeWidth="2" strokeDasharray="4 3" />
                  <rect x="6" y="236" width="144" height="54" rx="8" fill="#020617" stroke="#475569" strokeWidth="1.5" />
                  <text x="16" y="255" fill="#cbd5e1" fontSize="11.5" fontWeight="900">CROIX D-PAD</text>
                  <text x="16" y="270" fill="#e2e8f0" fontSize="10">Haut/Bas: Zoom Caméra</text>
                  <text x="16" y="283" fill="#94a3b8" fontSize="10">G/D: Type de Grenade</text>

                  {/* Right Trigger/Bumper Callout */}
                  <line x1="620" y1="45" x2="668" y2="45" stroke="#fb923c" strokeWidth="2" />
                  <rect x="668" y="16" width="146" height="50" rx="8" fill="#020617" stroke="#ea580c" strokeWidth="1.5" />
                  <text x="678" y="34" fill="#fdba74" fontSize="11.5" fontWeight="900">RT / RB</text>
                  <text x="678" y="49" fill="#e2e8f0" fontSize="10.5">RT: Tirer (360° 3D)</text>
                  <text x="678" y="61" fill="#94a3b8" fontSize="10">RB: Lancer Grenade</text>

                  {/* ABXY Callout */}
                  <line x1="602" y1="142" x2="668" y2="128" stroke="#22c55e" strokeWidth="2" strokeDasharray="4 3" />
                  <rect x="668" y="84" width="146" height="90" rx="8" fill="#020617" stroke="#334155" strokeWidth="1.5" />
                  <text x="678" y="102" fill="#4ade80" fontSize="11" fontWeight="900">A : Saut &amp; Jetpack</text>
                  <text x="678" y="119" fill="#60a5fa" fontSize="11" fontWeight="900">X : Ramasser / Recharger</text>
                  <text x="678" y="136" fill="#facc15" fontSize="11" fontWeight="900">Y : Changer d&apos;arme</text>
                  <text x="678" y="153" fill="#f87171" fontSize="11" fontWeight="900">B : Coup de Mêlée</text>
                  <text x="678" y="167" fill="#94a3b8" fontSize="9.5">Start: Pause · View: Scores</text>

                  {/* RIGHT THUMBSTICK Callout */}
                  <line x1="518" y1="226" x2="668" y2="254" stroke="#fb923c" strokeWidth="2" strokeDasharray="4 3" />
                  <rect x="668" y="218" width="146" height="72" rx="8" fill="#020617" stroke="#fb923c" strokeWidth="1.5" />
                  <text x="678" y="237" fill="#fb923c" fontSize="12" fontWeight="900">POUCE DROIT</text>
                  <text x="678" y="253" fill="#e2e8f0" fontSize="10.5">Caméra Gauche / Droite</text>
                  <text x="678" y="267" fill="#e2e8f0" fontSize="10.5">Regarder Haut / Bas</text>
                  <text x="678" y="281" fill="#fdba74" fontSize="9.5">+ Visée assistée 3D</text>
                </svg>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                <div className="bg-slate-950 border border-sky-500/30 rounded-xl p-4 space-y-1.5">
                  <div className="font-black text-sky-400 text-sm">POUCE GAUCHE — DÉPLACEMENT 3D</div>
                  <p className="text-slate-300 leading-relaxed">
                    Pousse le stick gauche dans n&apos;importe quelle direction pour te déplacer sur la carte (avant, arrière, pas chassés à gauche/droite) en suivant toujours l&apos;orientation de ta caméra.
                  </p>
                </div>
                <div className="bg-slate-950 border border-orange-500/30 rounded-xl p-4 space-y-1.5">
                  <div className="font-black text-orange-400 text-sm">POUCE DROIT — CAMÉRA &amp; VISÉE TOTALE</div>
                  <p className="text-slate-300 leading-relaxed">
                    Incline le stick droit à gauche, à droite, en haut ou en bas : la caméra pivote fluide autour de ton personnage et oriente ton arme dans toutes les directions de l&apos;arène 3D.
                  </p>
                </div>
              </div>
            </div>
          )}

          {tab === 'keyboard' && (
            <div className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Keyboard Movement & Keys */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-4">
                  <div className="text-xs font-black tracking-wider text-sky-400 uppercase">
                    CLAVIER — DÉPLACEMENT &amp; ACTIONS
                  </div>

                  {/* WASD Cluster Graphic */}
                  <div className="flex flex-col items-center gap-2 py-2">
                    <div className="w-14 h-12 rounded-xl bg-slate-900 border-2 border-sky-400 flex flex-col items-center justify-center">
                      <span className="text-sm font-black text-white">{formatKeyCode(kb.forward)}</span>
                      <span className="text-[9px] text-sky-300">AVANT</span>
                    </div>
                    <div className="flex gap-2">
                      <div className="w-14 h-12 rounded-xl bg-slate-900 border-2 border-sky-400 flex flex-col items-center justify-center">
                        <span className="text-sm font-black text-white">{formatKeyCode(kb.left)}</span>
                        <span className="text-[9px] text-sky-300">GAUCHE</span>
                      </div>
                      <div className="w-14 h-12 rounded-xl bg-slate-900 border-2 border-sky-400 flex flex-col items-center justify-center">
                        <span className="text-sm font-black text-white">{formatKeyCode(kb.backward)}</span>
                        <span className="text-[9px] text-sky-300">ARRIÈRE</span>
                      </div>
                      <div className="w-14 h-12 rounded-xl bg-slate-900 border-2 border-sky-400 flex flex-col items-center justify-center">
                        <span className="text-sm font-black text-white">{formatKeyCode(kb.right)}</span>
                        <span className="text-[9px] text-sky-300">DROITE</span>
                      </div>
                    </div>
                    <div className="w-48 h-10 mt-1 rounded-xl bg-slate-900 border-2 border-amber-400 flex items-center justify-center gap-2">
                      <span className="text-xs font-black text-amber-300">{formatKeyCode(kb.jump)}</span>
                      <span className="text-[10px] text-slate-300">SAUT / JETPACK (Maintenir)</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 text-xs">
                    {[
                      [formatKeyCode(kb.reload), 'Recharger l’arme'],
                      [formatKeyCode(kb.pickup), 'Ramasser arme'],
                      [formatKeyCode(kb.switchWeapon), 'Changer d’arme'],
                      [formatKeyCode(kb.grenade), 'Lancer grenade'],
                      ['C', 'Changer de grenade'],
                      [formatKeyCode(kb.melee), 'Attaque mêlée'],
                      [formatKeyCode(kb.secondary), 'Mode secondaire'],
                      [`${formatKeyCode(kb.scoreboard)} / ${formatKeyCode(kb.pause)}`, 'Scores / Pause'],
                    ].map(([key, desc]) => (
                      <div
                        key={key + desc}
                        className="flex items-center justify-between bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-1.5"
                      >
                        <span className="font-mono font-bold text-sky-300">{key}</span>
                        <span className="text-slate-300 text-[11px]">{desc}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Mouse Look & Fire */}
                <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 flex flex-col justify-between space-y-4">
                  <div className="text-xs font-black tracking-wider text-orange-400 uppercase">
                    SOURIS — CAMÉRA MULTI-AXES &amp; TIR
                  </div>

                  <div className="flex items-center justify-center py-2">
                    <svg viewBox="0 0 240 200" className="w-52 h-44">
                      {/* Mouse outline */}
                      <rect x="65" y="24" width="110" height="152" rx="52" fill="#0f172a" stroke="#475569" strokeWidth="3" />
                      {/* Left click */}
                      <path d="M 68 78 L 68 62 C 68 38, 92 27, 118 27 L 118 78 Z" fill="#ea580c" opacity="0.55" stroke="#fb923c" strokeWidth="2" />
                      {/* Right click */}
                      <path d="M 122 27 C 148 27, 172 38, 172 62 L 172 78 L 122 78 Z" fill="#0284c7" opacity="0.55" stroke="#38bdf8" strokeWidth="2" />
                      {/* Scroll wheel */}
                      <rect x="114" y="42" width="12" height="28" rx="6" fill="#facc15" />
                      {/* Directional look arrows around mouse */}
                      <polygon points="120,6 113,17 127,17" fill="#e2e8f0" />
                      <polygon points="120,194 113,183 127,183" fill="#e2e8f0" />
                      <polygon points="42,100 53,93 53,107" fill="#e2e8f0" />
                      <polygon points="198,100 187,93 187,107" fill="#e2e8f0" />
                      <text x="92" y="60" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="900">TIR</text>
                      <text x="148" y="60" textAnchor="middle" fill="#fff" fontSize="10" fontWeight="900">ZOOM</text>
                      <text x="120" y="132" textAnchor="middle" fill="#cbd5e1" fontSize="10" fontWeight="bold">BOUGER LA SOURIS</text>
                      <text x="120" y="147" textAnchor="middle" fill="#94a3b8" fontSize="9.5">Tourne la caméra 360°</text>
                    </svg>
                  </div>

                  <div className="space-y-2 text-xs text-slate-300 bg-slate-900 border border-slate-800 rounded-xl p-3">
                    <div>
                      <strong className="text-orange-300">Rotation Caméra :</strong> Déplace la souris à gauche, droite, haut ou bas (clique dans l&apos;arène pour verrouiller le curseur comme un FPS/TPS, ou utilise les Flèches directionnelles).
                    </div>
                    <div>
                      <strong className="text-sky-300">Clic Droit / Molette :</strong> Vise avec le zoom optique de l&apos;arme / ajuste la distance de caméra.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'split' && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-3">
                <div className="text-sm font-black text-sky-400">JOUEUR 1 &amp; JOUEUR 2 EN LOCAL</div>
                <p className="text-slate-300 leading-relaxed">
                  Branche jusqu&apos;à <strong>2 manettes Xbox</strong> (ou combine <strong>Clavier/Souris pour J1 + Manette 1 pour J2</strong>). Chaque joueur dispose de sa propre caméra 3D et peut regarder librement dans toutes les directions.
                </p>
                <div className="bg-slate-900 border border-slate-800 rounded-xl p-3 space-y-1 text-slate-300">
                  <div><strong className="text-white">Mode Dynamique :</strong> Écran partagé dès que les deux pilotes regardent différemment ou s&apos;éloignent.</div>
                  <div><strong className="text-white">Orientation :</strong> Côte à côte (Gauche | Droite) ou Superposé (Haut / Bas) dans les Paramètres.</div>
                </div>
              </div>
              <div className="bg-slate-950 border border-slate-800 rounded-2xl p-5 space-y-2.5">
                <div className="text-sm font-black text-amber-300">CLAVIER SECOURS J2 (SANS MANETTE)</div>
                <div className="grid grid-cols-1 gap-1.5 text-slate-300">
                  <div className="flex justify-between bg-slate-900 px-3 py-1.5 rounded-lg"><span>Déplacement 3D</span><strong className="text-white font-mono">Flèches Directionnelles</strong></div>
                  <div className="flex justify-between bg-slate-900 px-3 py-1.5 rounded-lg"><span>Caméra (Tourner G/D/H/B)</span><strong className="text-orange-300 font-mono">I / K / J / L</strong></div>
                  <div className="flex justify-between bg-slate-900 px-3 py-1.5 rounded-lg"><span>Saut / Jetpack</span><strong className="text-sky-300 font-mono">Numpad 0 / Ctrl Droit</strong></div>
                  <div className="flex justify-between bg-slate-900 px-3 py-1.5 rounded-lg"><span>Tirer / Zoom</span><strong className="text-white font-mono">Entrée (Numpad 1) / Shift Droit</strong></div>
                  <div className="flex justify-between bg-slate-900 px-3 py-1.5 rounded-lg"><span>Recharger · Changer · Grenade · Mêlée</span><strong className="text-white font-mono">P · [ · ] · \</strong></div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
