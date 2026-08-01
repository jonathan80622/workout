import React, { useState } from 'react';
import { Compass, Plus, Search, Settings, Trash2, Edit2, Check, Sparkles } from 'lucide-react';
import { MachinePreset, MuscleGroup } from '../types';

interface MachineLibraryProps {
  machines: MachinePreset[];
  onUpdateMachines: (machines: MachinePreset[]) => void;
  onSelectMachineToLog: (machine: MachinePreset) => void;
}

const MUSCLE_GROUPS: MuscleGroup[] = [
  'Chest',
  'Lats & Back',
  'Quads',
  'Hamstrings',
  'Glutes',
  'Shoulders',
  'Biceps',
  'Triceps',
  'Abs & Core',
  'Calves'
];

export const MachineLibrary: React.FC<MachineLibraryProps> = ({
  machines,
  onUpdateMachines,
  onSelectMachineToLog
}) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [editingMachineId, setEditingMachineId] = useState<string | null>(null);
  const [editSeatSettings, setEditSeatSettings] = useState<string>('');

  const [isNewModalOpen, setIsNewModalOpen] = useState<boolean>(false);
  const [newName, setNewName] = useState<string>('');
  const [newCategory, setNewCategory] = useState<MuscleGroup>('Quads');
  const [newSeatSettings, setNewSeatSettings] = useState<string>('');
  const [newEquipmentType, setNewEquipmentType] = useState<'Machine' | 'Cable' | 'Free Weight' | 'Smith Machine'>('Machine');
  const [newTargetDesc, setNewTargetDesc] = useState<string>('');

  const filtered = machines.filter((m) => {
    const matchesSearch =
      m.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      m.targetDescription.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCat = selectedCategory === 'all' || m.category === selectedCategory;
    return matchesSearch && matchesCat;
  });

  const handleStartEditSeat = (m: MachinePreset) => {
    setEditingMachineId(m.id);
    setEditSeatSettings(m.defaultSeatSettings || '');
  };

  const handleSaveSeatEdit = (machineId: string) => {
    const updated = machines.map((m) =>
      m.id === machineId ? { ...m, defaultSeatSettings: editSeatSettings } : m
    );
    onUpdateMachines(updated);
    setEditingMachineId(null);
  };

  const handleDeleteMachine = (id: string) => {
    const updated = machines.filter((m) => m.id !== id);
    onUpdateMachines(updated);
  };

  const handleAddMachine = () => {
    if (!newName.trim()) return;
    const newM: MachinePreset = {
      id: 'm-' + Date.now(),
      name: newName.trim(),
      category: newCategory,
      defaultSeatSettings: newSeatSettings.trim(),
      equipmentType: newEquipmentType,
      targetDescription: newTargetDesc.trim() || 'Custom vessel added to personal library.'
    };
    onUpdateMachines([...machines, newM]);
    setNewName('');
    setNewSeatSettings('');
    setNewTargetDesc('');
    setIsNewModalOpen(false);
  };

  return (
    <div className="space-y-4 pb-28">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-serif font-bold text-[#f7f3ee]">Sanctuary Vessels</h2>
          <p className="text-xs text-[#a39588] font-light">
            Store seat alignment notches, pin settings & somatic cues
          </p>
        </div>

        <button
          onClick={() => setIsNewModalOpen(true)}
          className="px-3.5 py-2 bg-gradient-to-r from-[#d97724] to-[#e6a15c] text-[#0c0a09] font-syne font-bold text-xs rounded-2xl shadow-lg shadow-[#d97724]/20 flex items-center gap-1 transition-all"
        >
          <Plus className="w-4 h-4" /> Add Vessel
        </button>
      </div>

      {/* Search & Category Filter Pills */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="w-4 h-4 text-[#8c7e72] absolute left-3.5 top-3" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search vessel name (e.g. Pec Deck)..."
            className="w-full bg-[#181412] border border-[#382f29] rounded-2xl pl-10 pr-4 py-2.5 text-xs text-[#f7f3ee] placeholder-[#6b5e54] focus:outline-none focus:ring-1 focus:ring-[#d97724]"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
          <button
            onClick={() => setSelectedCategory('all')}
            className={`text-xs px-3 py-1 rounded-2xl whitespace-nowrap font-syne transition-all ${
              selectedCategory === 'all'
                ? 'bg-[#d97724] text-[#0c0a09] font-bold'
                : 'bg-[#181412] text-[#8c7e72] border border-[#382f29]'
            }`}
          >
            All Vessels
          </button>
          {MUSCLE_GROUPS.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`text-xs px-3 py-1 rounded-2xl whitespace-nowrap font-syne transition-all ${
                selectedCategory === cat
                  ? 'bg-[#d97724] text-[#0c0a09] font-bold'
                  : 'bg-[#181412] text-[#8c7e72] border border-[#382f29]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Machine Cards Grid */}
      <div className="space-y-3">
        {filtered.map((machine) => (
          <div
            key={machine.id}
            className="bg-[#181412]/90 border border-[#382f29] hover:border-[#4a3f36] rounded-3xl p-4 shadow-xl space-y-3 transition-all"
          >
            <div className="flex items-start justify-between">
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-serif font-bold text-[#f7f3ee]">
                    {machine.name}
                  </h3>
                  <span className="text-[10px] font-syne font-semibold bg-[#d97724]/20 text-[#e6a15c] border border-[#d97724]/30 px-2 py-0.5 rounded-full">
                    {machine.equipmentType}
                  </span>
                </div>
                <span className="text-xs text-[#a39588] font-light">
                  Target: <strong className="text-[#f7f3ee] font-medium">{machine.category}</strong>
                </span>
              </div>

              <div className="flex items-center gap-1">
                <button
                  onClick={() => onSelectMachineToLog(machine)}
                  className="px-3 py-1.5 bg-[#d97724] hover:bg-[#e6a15c] text-[#0c0a09] rounded-2xl text-xs font-syne font-bold flex items-center gap-1 shadow-md shadow-[#d97724]/20 transition-all"
                >
                  <Compass className="w-3.5 h-3.5" /> Log
                </button>
                <button
                  onClick={() => handleDeleteMachine(machine.id)}
                  className="p-1.5 text-[#6b5e54] hover:text-[#c86d51] hover:bg-[#c86d51]/10 rounded-lg transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Seat Settings Editor */}
            <div className="bg-[#100d0b] p-2.5 rounded-2xl border border-[#2b241f] space-y-1 text-xs">
              <div className="flex items-center justify-between text-[#a39588]">
                <span className="font-syne font-semibold flex items-center gap-1">
                  <Settings className="w-3.5 h-3.5 text-[#e6a15c]" /> Saved Seat & Alignment Notches:
                </span>
                {editingMachineId !== machine.id ? (
                  <button
                    onClick={() => handleStartEditSeat(machine)}
                    className="text-[#e6a15c] hover:underline flex items-center gap-0.5 text-[11px] font-syne"
                  >
                    <Edit2 className="w-3 h-3" /> Edit
                  </button>
                ) : (
                  <button
                    onClick={() => handleSaveSeatEdit(machine.id)}
                    className="text-[#849a88] font-bold flex items-center gap-0.5 text-[11px] font-syne"
                  >
                    <Check className="w-3 h-3" /> Save
                  </button>
                )}
              </div>

              {editingMachineId === machine.id ? (
                <input
                  type="text"
                  value={editSeatSettings}
                  onChange={(e) => setEditSeatSettings(e.target.value)}
                  placeholder="e.g. Seat #4, Lever Pin Notch B"
                  className="w-full bg-[#181412] border border-[#382f29] rounded-xl p-2 text-xs text-[#f7f3ee] outline-none focus:ring-1 focus:ring-[#d97724]"
                />
              ) : (
                <p className="text-[#f7f3ee] font-medium">
                  {machine.defaultSeatSettings || 'No seat adjustments saved yet. Tap edit to add!'}
                </p>
              )}
            </div>

            {/* Target Muscle Description */}
            <p className="text-xs text-[#a39588] font-serif italic leading-relaxed">
              "{machine.targetDescription}"
            </p>
          </div>
        ))}
      </div>

      {/* Add New Machine Modal */}
      {isNewModalOpen && (
        <div className="fixed inset-0 z-50 bg-[#0c0a09]/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-[#181412] border border-[#382f29] rounded-3xl p-5 w-full max-w-md space-y-4">
            <div className="flex items-center justify-between border-b border-[#2b241f] pb-3">
              <h3 className="text-base font-serif font-bold text-[#f7f3ee] flex items-center gap-2">
                <Compass className="w-5 h-5 text-[#e6a15c]" /> Add Vessel
              </h3>
              <button
                onClick={() => setIsNewModalOpen(false)}
                className="text-[#8c7e72] hover:text-[#f7f3ee]"
              >
                ✕
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="font-syne font-semibold text-[#c8b8a8] block mb-1">Vessel / Machine Name *</label>
                <input
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="e.g. Hammer Strength Iso-Row"
                  className="w-full bg-[#100d0b] border border-[#2b241f] rounded-xl p-2.5 text-xs text-[#f7f3ee] outline-none focus:ring-1 focus:ring-[#d97724]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="font-syne font-semibold text-[#c8b8a8] block mb-1">Primary Muscle</label>
                  <select
                    value={newCategory}
                    onChange={(e) => setNewCategory(e.target.value as MuscleGroup)}
                    className="w-full bg-[#100d0b] border border-[#2b241f] text-[#f7f3ee] rounded-xl p-2.5 outline-none"
                  >
                    {MUSCLE_GROUPS.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="font-syne font-semibold text-[#c8b8a8] block mb-1">Equipment Type</label>
                  <select
                    value={newEquipmentType}
                    onChange={(e) => setNewEquipmentType(e.target.value as any)}
                    className="w-full bg-[#100d0b] border border-[#2b241f] text-[#f7f3ee] rounded-xl p-2.5 outline-none"
                  >
                    <option value="Machine">Machine</option>
                    <option value="Cable">Cable</option>
                    <option value="Free Weight">Free Weight</option>
                    <option value="Smith Machine">Smith Machine</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="font-syne font-semibold text-[#c8b8a8] block mb-1">Seat & Pin Settings</label>
                <input
                  type="text"
                  value={newSeatSettings}
                  onChange={(e) => setNewSeatSettings(e.target.value)}
                  placeholder="e.g. Seat Height #3, Arm Pin #2"
                  className="w-full bg-[#100d0b] border border-[#2b241f] rounded-xl p-2.5 text-xs text-[#f7f3ee] outline-none focus:ring-1 focus:ring-[#d97724]"
                />
              </div>

              <div>
                <label className="font-syne font-semibold text-[#c8b8a8] block mb-1">Somatic Tip / Focus</label>
                <textarea
                  rows={2}
                  value={newTargetDesc}
                  onChange={(e) => setNewTargetDesc(e.target.value)}
                  placeholder="e.g. Squeeze lats gently with grounded breath."
                  className="w-full bg-[#100d0b] border border-[#2b241f] rounded-xl p-2.5 text-xs text-[#f7f3ee] outline-none focus:ring-1 focus:ring-[#d97724] resize-none"
                />
              </div>
            </div>

            <button
              onClick={handleAddMachine}
              disabled={!newName.trim()}
              className="w-full py-3 bg-[#d97724] hover:bg-[#e6a15c] disabled:opacity-50 text-[#0c0a09] font-syne font-bold text-xs rounded-xl shadow-lg shadow-[#d97724]/20"
            >
              Save Vessel
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

