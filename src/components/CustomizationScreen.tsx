import React, { useState } from 'react';
import {
  ACCENT_PALETTE,
  ACCESSORY_STYLES,
  BACKPACK_STYLES,
  FACE_STYLES,
  GEAR_PALETTE,
  HAIR_PALETTE,
  HAIR_STYLES,
  HEADGEAR_STYLES,
  JACKET_STYLES,
  JETPACK_STYLES,
  PRESET_LIST,
  SKIN_PALETTE,
} from '../game/data/cosmetics';
import { WEAPON_LIST } from '../game/data/weapons';
import { CharacterAppearance, WeaponId } from '../game/types';
import { CharacterPreview3D } from './CharacterPreview3D';

interface Props {
  p1Appearance: CharacterAppearance;
  p2Appearance: CharacterAppearance;
  onChangeP1: (app: CharacterAppearance) => void;
  onChangeP2: (app: CharacterAppearance) => void;
  onBack: () => void;
  externalYawDelta: number;
}

type CustomTab = 'presets' | 'face' | 'headgear' | 'armor' | 'jetpack';

export const CustomizationScreen: React.FC<Props> = ({
  p1Appearance,
  p2Appearance,
  onChangeP1,
  onChangeP2,
  onBack,
  externalYawDelta,
}) => {
  const [editingSlot, setEditingSlot] = useState<0 | 1>(0);
  const [tab, setTab] = useState<CustomTab>('presets');
  const [previewWeapon, setPreviewWeapon] = useState<WeaponId>('assault_rifle');
  const [jetpackDemo, setJetpackDemo] = useState(false);

  const current = editingSlot === 0 ? p1Appearance : p2Appearance;
  const update = (patch: Partial<CharacterAppearance>) => {
    const next = { ...current, ...patch };
    if (editingSlot === 0) onChangeP1(next);
    else onChangeP2(next);
  };

  return (
    <div className="fixed inset-0 z-40 bg-slate-950 text-slate-100 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-800 bg-slate-900">
        <div className="flex items-center gap-4">
          <h2 className="text-xl font-black tracking-wider text-sky-400">
            PILOT ARMORY & CUSTOMIZATION
          </h2>
          <div className="flex rounded-lg bg-slate-800 p-1 border border-slate-700">
            <button
              onClick={() => setEditingSlot(0)}
              className={`px-3 py-1 rounded text-xs font-bold cursor-pointer ${
                editingSlot === 0
                  ? 'bg-sky-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              PILOT 1
            </button>
            <button
              onClick={() => setEditingSlot(1)}
              className={`px-3 py-1 rounded text-xs font-bold cursor-pointer ${
                editingSlot === 1
                  ? 'bg-orange-500 text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              PILOT 2 (LOCAL 2P)
            </button>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-slate-400 hidden sm:inline">
            Standardized Hitbox Enforced (Cosmetics Are Visual Only)
          </span>
          <button
            onClick={onBack}
            className="px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-600 text-xs font-bold cursor-pointer"
          >
            DONE / BACK [B / ESC]
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* Left: 3D Preview Stage */}
        <div className="lg:col-span-5 relative bg-gradient-to-b from-slate-900 to-slate-950 border-r border-slate-800 flex flex-col">
          <div className="flex-1 min-h-[320px]">
            <CharacterPreview3D
              appearance={current}
              previewWeapon={previewWeapon}
              jetpackDemo={jetpackDemo}
              externalYawDelta={externalYawDelta}
            />
          </div>

          <div className="p-4 border-t border-slate-800 bg-slate-900/90 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <label className="text-xs text-slate-400 font-semibold">Preview Weapon:</label>
              <select
                value={previewWeapon}
                onChange={(e) => setPreviewWeapon(e.target.value as WeaponId)}
                className="bg-slate-800 border border-slate-700 rounded px-2 py-1 text-xs text-slate-100"
              >
                {WEAPON_LIST.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name}
                  </option>
                ))}
              </select>
            </div>
            <button
              onClick={() => setJetpackDemo((v) => !v)}
              className={`px-3 py-1.5 rounded text-xs font-bold cursor-pointer border ${
                jetpackDemo
                  ? 'bg-orange-500 text-slate-950 border-orange-400'
                  : 'bg-slate-800 text-slate-200 border-slate-700'
              }`}
            >
              {jetpackDemo ? 'THRUSTERS: ON' : 'TEST JETPACK'}
            </button>
          </div>
        </div>

        {/* Right: Modular Cosmetic Controls */}
        <div className="lg:col-span-7 flex flex-col overflow-hidden bg-slate-950">
          <div className="flex border-b border-slate-800 px-4 pt-3 gap-2 overflow-x-auto">
            {(
              [
                ['presets', '8 Archetypes'],
                ['face', 'Skin, Hair & Face'],
                ['headgear', 'Headgear & Helmet'],
                ['armor', 'Outfit & Colors'],
                ['jetpack', 'Jetpack & Gear'],
              ] as [CustomTab, string][]
            ).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={`px-3 py-2 text-xs font-bold border-b-2 whitespace-nowrap cursor-pointer ${
                  tab === id
                    ? 'border-sky-400 text-sky-400'
                    : 'border-transparent text-slate-400 hover:text-slate-200'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto p-5 space-y-5">
            {tab === 'presets' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {PRESET_LIST.map((preset) => {
                  const active = current.presetId === preset.presetId;
                  return (
                    <button
                      key={preset.presetId}
                      onClick={() => update({ ...preset })}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        active
                          ? 'bg-sky-500/15 border-sky-400'
                          : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                      }`}
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span
                          className="w-4 h-4 rounded-full border border-white/30"
                          style={{ backgroundColor: preset.clothingColor }}
                        />
                        <span
                          className="w-4 h-4 rounded-full border border-white/30"
                          style={{ backgroundColor: preset.accentColor }}
                        />
                      </div>
                      <div className="text-xs font-bold text-white">{preset.name}</div>
                      <div className="text-[11px] text-slate-400 mt-0.5 capitalize">
                        {preset.headgear.replace('_', ' ')}
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {tab === 'face' && (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-bold text-slate-300 mb-2">SKIN TONE</div>
                  <div className="flex flex-wrap gap-2">
                    {SKIN_PALETTE.map((c) => (
                      <button
                        key={c}
                        onClick={() => update({ skinColor: c })}
                        className={`w-8 h-8 rounded-lg border-2 cursor-pointer ${
                          current.skinColor === c ? 'border-white scale-110' : 'border-slate-700'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-300 mb-2">FACE EXPRESSION</div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {FACE_STYLES.map((f) => (
                      <button
                        key={f.id}
                        onClick={() => update({ faceStyle: f.id })}
                        className={`px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                          current.faceStyle === f.id
                            ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-300 mb-2">HAIR STYLE</div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {HAIR_STYLES.map((h) => (
                      <button
                        key={h.id}
                        onClick={() => update({ hairStyle: h.id })}
                        className={`px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                          current.hairStyle === h.id
                            ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        {h.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-300 mb-2">HAIR COLOR</div>
                  <div className="flex flex-wrap gap-2">
                    {HAIR_PALETTE.map((c) => (
                      <button
                        key={c}
                        onClick={() => update({ hairColor: c })}
                        className={`w-8 h-8 rounded-lg border-2 cursor-pointer ${
                          current.hairColor === c ? 'border-white scale-110' : 'border-slate-700'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'headgear' && (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-bold text-slate-300 mb-2">HEADGEAR / HELMET</div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {HEADGEAR_STYLES.map((hg) => (
                      <button
                        key={hg.id}
                        onClick={() => update({ headgear: hg.id })}
                        className={`px-3 py-2.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                          current.headgear === hg.id
                            ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        {hg.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-300 mb-2">HEADGEAR COLOR</div>
                  <div className="flex flex-wrap gap-2">
                    {GEAR_PALETTE.map((c) => (
                      <button
                        key={c}
                        onClick={() => update({ headgearColor: c })}
                        className={`w-8 h-8 rounded-lg border-2 cursor-pointer ${
                          current.headgearColor === c ? 'border-white scale-110' : 'border-slate-700'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}

            {tab === 'armor' && (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-bold text-slate-300 mb-2">JACKET / CHEST RIG</div>
                  <div className="grid grid-cols-2 gap-2">
                    {JACKET_STYLES.map((j) => (
                      <button
                        key={j.id}
                        onClick={() => update({ jacketStyle: j.id })}
                        className={`px-3 py-2.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                          current.jacketStyle === j.id
                            ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        {j.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <div className="text-xs font-bold text-slate-300 mb-2">JACKET COLOR</div>
                    <div className="flex flex-wrap gap-1.5">
                      {GEAR_PALETTE.map((c) => (
                        <button
                          key={c}
                          onClick={() => update({ clothingColor: c })}
                          className={`w-7 h-7 rounded border-2 cursor-pointer ${
                            current.clothingColor === c ? 'border-white scale-110' : 'border-slate-700'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-300 mb-2">ACCENT & TRIM</div>
                    <div className="flex flex-wrap gap-1.5">
                      {ACCENT_PALETTE.map((c) => (
                        <button
                          key={c}
                          onClick={() => update({ accentColor: c })}
                          className={`w-7 h-7 rounded border-2 cursor-pointer ${
                            current.accentColor === c ? 'border-white scale-110' : 'border-slate-700'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-300 mb-2">PANTS COLOR</div>
                    <div className="flex flex-wrap gap-1.5">
                      {GEAR_PALETTE.map((c) => (
                        <button
                          key={c}
                          onClick={() => update({ pantsColor: c })}
                          className={`w-7 h-7 rounded border-2 cursor-pointer ${
                            current.pantsColor === c ? 'border-white scale-110' : 'border-slate-700'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs font-bold text-slate-300 mb-2">BOOTS & GLOVES</div>
                    <div className="flex flex-wrap gap-1.5">
                      {GEAR_PALETTE.map((c) => (
                        <button
                          key={c}
                          onClick={() => update({ bootsColor: c, glovesColor: c })}
                          className={`w-7 h-7 rounded border-2 cursor-pointer ${
                            current.bootsColor === c ? 'border-white scale-110' : 'border-slate-700'
                          }`}
                          style={{ backgroundColor: c }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {tab === 'jetpack' && (
              <div className="space-y-4">
                <div>
                  <div className="text-xs font-bold text-slate-300 mb-2">JETPACK CHASSIS</div>
                  <div className="grid grid-cols-2 gap-2">
                    {JETPACK_STYLES.map((jp) => (
                      <button
                        key={jp.id}
                        onClick={() => update({ jetpackStyle: jp.id })}
                        className={`px-3 py-2.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                          current.jetpackStyle === jp.id
                            ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        {jp.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-300 mb-2">BACKPACK MODULE</div>
                  <div className="grid grid-cols-2 gap-2">
                    {BACKPACK_STYLES.map((bp) => (
                      <button
                        key={bp.id}
                        onClick={() => update({ backpackStyle: bp.id })}
                        className={`px-3 py-2.5 rounded-lg border text-xs font-semibold cursor-pointer ${
                          current.backpackStyle === bp.id
                            ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        {bp.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-300 mb-2">TACTICAL ACCESSORY</div>
                  <div className="grid grid-cols-3 sm:grid-cols-5 gap-2">
                    {ACCESSORY_STYLES.map((ac) => (
                      <button
                        key={ac.id}
                        onClick={() => update({ accessory: ac.id })}
                        className={`px-3 py-2 rounded-lg border text-xs font-semibold cursor-pointer ${
                          current.accessory === ac.id
                            ? 'bg-sky-500/20 border-sky-400 text-sky-300'
                            : 'bg-slate-900 border-slate-800 text-slate-300'
                        }`}
                      >
                        {ac.label}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="text-xs font-bold text-slate-300 mb-2">THRUSTER FLAME COLOR</div>
                  <div className="flex flex-wrap gap-2">
                    {ACCENT_PALETTE.map((c) => (
                      <button
                        key={c}
                        onClick={() => update({ flameColor: c })}
                        className={`w-8 h-8 rounded-lg border-2 cursor-pointer ${
                          current.flameColor === c ? 'border-white scale-110' : 'border-slate-700'
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
