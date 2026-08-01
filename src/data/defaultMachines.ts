import { MachinePreset } from '../types';

export const DEFAULT_MACHINES: MachinePreset[] = [
  {
    id: 'm1',
    name: 'Leg Press Machine',
    category: 'Quads',
    defaultSeatSettings: 'Seat Angle: 3, Backrest: Notch 2',
    equipmentType: 'Machine',
    targetDescription: 'Focus on quad contraction at the top, knees tracking over toes.'
  },
  {
    id: 'm2',
    name: 'Lat Pulldown (Wide Grip)',
    category: 'Lats & Back',
    defaultSeatSettings: 'Thigh Pad: #4',
    equipmentType: 'Cable',
    targetDescription: 'Pulls down to upper chest, drive elbows down to contract lats.'
  },
  {
    id: 'm3',
    name: 'Seated Chest Press',
    category: 'Chest',
    defaultSeatSettings: 'Seat Height: #5, Handles at Mid-Chest',
    equipmentType: 'Machine',
    targetDescription: 'Deep stretch at bottom, squeeze inner pecs at peak extension.'
  },
  {
    id: 'm4',
    name: 'Seated Leg Curl Machine',
    category: 'Hamstrings',
    defaultSeatSettings: 'Thigh Pad: Lock 3, Shin Pad: #2',
    equipmentType: 'Machine',
    targetDescription: 'Isolates hamstrings. Flex toes back and squeeze at bottom.'
  },
  {
    id: 'm5',
    name: 'Seated Cable Row',
    category: 'Lats & Back',
    defaultSeatSettings: 'V-Bar Handle, Foot Plate: Row 2',
    equipmentType: 'Cable',
    targetDescription: 'Keep chest upright, pull handle to navel and retract scapula.'
  },
  {
    id: 'm6',
    name: 'Pec Deck / Butterfly Machine',
    category: 'Chest',
    defaultSeatSettings: 'Seat Height: #4, Arm Arms Position: #2',
    equipmentType: 'Machine',
    targetDescription: 'Keep slight bend in elbows, feel deep stretch in pecs.'
  },
  {
    id: 'm7',
    name: 'Seated Shoulder Press Machine',
    category: 'Shoulders',
    defaultSeatSettings: 'Seat Height: #3',
    equipmentType: 'Machine',
    targetDescription: 'Targets front & lateral deltoids. Avoid locking out elbows.'
  },
  {
    id: 'm8',
    name: 'Triceps Rope Pushdown',
    category: 'Triceps',
    defaultSeatSettings: 'High Cable Pulley, Rope Attachment',
    equipmentType: 'Cable',
    targetDescription: 'Flare rope outward at the bottom for intense lateral head lockout.'
  },
  {
    id: 'm9',
    name: 'Preacher Curl Machine',
    category: 'Biceps',
    defaultSeatSettings: 'Seat Height: #2, Arm Pad Lock: #3',
    equipmentType: 'Machine',
    targetDescription: 'Strict biceps isolation with arm back fully supported.'
  },
  {
    id: 'm10',
    name: 'Smith Machine Squat',
    category: 'Quads',
    defaultSeatSettings: 'Safety Stoppers: Pin 7',
    equipmentType: 'Smith Machine',
    targetDescription: 'Feet slightly forward, drop hips parallel with knee joint.'
  },
  {
    id: 'm11',
    name: 'Hack Squat Machine',
    category: 'Quads',
    defaultSeatSettings: 'Foot placement: Lower middle',
    equipmentType: 'Machine',
    targetDescription: 'Emphasizes VMO quad teardrop. Smooth controlled descent.'
  },
  {
    id: 'm12',
    name: 'Cable Lateral Raise',
    category: 'Shoulders',
    defaultSeatSettings: 'Low Pulley, Single Handle Attachment',
    equipmentType: 'Cable',
    targetDescription: 'Continuous tension on side delts. Raise to shoulder height.'
  },
  {
    id: 'm13',
    name: 'Calf Raise Machine',
    category: 'Calves',
    defaultSeatSettings: 'Shoulder Pad: #5',
    equipmentType: 'Machine',
    targetDescription: 'Full stretch at bottom heel drop, explosive drive on toes.'
  },
  {
    id: 'm14',
    name: 'Abdominal Crunch Machine',
    category: 'Abs & Core',
    defaultSeatSettings: 'Seat Pin: #2',
    equipmentType: 'Machine',
    targetDescription: 'Focus on curling ribcage toward pelvis, slow eccentric.'
  }
];
