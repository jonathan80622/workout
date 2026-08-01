import { Workout } from '../types';

export const SAMPLE_WORKOUTS: Workout[] = [
  {
    id: 'w-sample-1',
    title: 'Lower Vessel Grounding & Glute Flow',
    date: new Date(Date.now() - 86400000 * 1).toISOString(), // Yesterday
    durationMinutes: 52,
    unit: 'lbs',
    clientName: 'Jordan Vance',
    ptName: 'Guide Marcus',
    ptNotes: 'Hey Guide Marcus! Focused on slow, mindful eccentrics today. Leg press felt grounded with high mind-muscle connection in the VMO.',
    isCompleted: true,
    exercises: [
      {
        id: 'ex-1',
        machineName: 'Leg Press Machine',
        category: 'Quads',
        seatSettings: 'Seat Angle: 3, Backrest Notch 2',
        sets: [
          { id: 's1', setNumber: 1, type: 'warmup', weight: 140, reps: 15, completed: true, rpe: 6 },
          { id: 's2', setNumber: 2, type: 'working', weight: 220, reps: 12, completed: true, rpe: 8 },
          { id: 's3', setNumber: 3, type: 'working', weight: 260, reps: 10, completed: true, rpe: 8.5 },
          { id: 's4', setNumber: 4, type: 'working', weight: 280, reps: 8, completed: true, rpe: 9 },
        ],
        muscleFeeling: {
          targetMuscles: ['Quads', 'Glutes'],
          sorenessLevel: 'mild',
          pumpQuality: 5,
          jointComfort: 'great',
          notes: 'Deep quad activation (VMO) fired up intensely at 280 lbs. Zero joint strain. Both legs moved with fluid alignment.',
          quickTags: ['👁️ Mind-Muscle Connection', '🕯️ Deep Somatic Release', '🌿 100% Pain Free & Grounded']
        }
      },
      {
        id: 'ex-2',
        machineName: 'Seated Leg Curl Machine',
        category: 'Hamstrings',
        seatSettings: 'Thigh Pad: Lock 3',
        sets: [
          { id: 's5', setNumber: 1, type: 'warmup', weight: 80, reps: 12, completed: true, rpe: 6 },
          { id: 's6', setNumber: 2, type: 'working', weight: 115, reps: 10, completed: true, rpe: 8 },
          { id: 's7', setNumber: 3, type: 'working', weight: 125, reps: 10, completed: true, rpe: 9 },
        ],
        muscleFeeling: {
          targetMuscles: ['Hamstrings'],
          sorenessLevel: 'moderate',
          pumpQuality: 4,
          jointComfort: 'great',
          notes: 'Hamstring contraction felt deep and satisfying at full extension. Great energy flow behind the knees.',
          quickTags: ['🌊 Fluid Joint Harmony', '🪵 Sacred Slow Eccentrics']
        }
      },
      {
        id: 'ex-3',
        machineName: 'Calf Raise Machine',
        category: 'Calves',
        seatSettings: 'Shoulder Pad: #5',
        sets: [
          { id: 's8', setNumber: 1, type: 'working', weight: 130, reps: 15, completed: true, rpe: 7.5 },
          { id: 's9', setNumber: 2, type: 'working', weight: 150, reps: 12, completed: true, rpe: 8.5 },
          { id: 's10', setNumber: 3, type: 'drop', weight: 100, reps: 15, completed: true, rpe: 9.5 }
        ],
        muscleFeeling: {
          targetMuscles: ['Calves'],
          sorenessLevel: 'none',
          pumpQuality: 4,
          jointComfort: 'great',
          notes: '3-second pause at bottom stretch on every rep. Deep gastrocnemius warmth.',
          quickTags: ['⚡ Peak Vitality / High Aura', '✨ Ethereal Muscle Sensation']
        }
      }
    ]
  },
  {
    id: 'w-sample-2',
    title: 'Heart & Spine Somatic Alignment',
    date: new Date(Date.now() - 86400000 * 3).toISOString(), // 3 days ago
    durationMinutes: 48,
    unit: 'lbs',
    clientName: 'Jordan Vance',
    ptName: 'Guide Marcus',
    ptNotes: 'Switched flat bench to Seated Chest Press to open thoracic spine and keep shoulder capsule fully protected.',
    isCompleted: true,
    exercises: [
      {
        id: 'ex-4',
        machineName: 'Seated Chest Press',
        category: 'Chest',
        seatSettings: 'Seat Height #5, Pin #6',
        sets: [
          { id: 's11', setNumber: 1, type: 'warmup', weight: 90, reps: 15, completed: true, rpe: 5 },
          { id: 's12', setNumber: 2, type: 'working', weight: 140, reps: 10, completed: true, rpe: 7.5 },
          { id: 's13', setNumber: 3, type: 'working', weight: 160, reps: 10, completed: true, rpe: 8.5 },
          { id: 's14', setNumber: 4, type: 'failure', weight: 175, reps: 7, completed: true, rpe: 10 }
        ],
        muscleFeeling: {
          targetMuscles: ['Chest', 'Triceps'],
          sorenessLevel: 'mild',
          pumpQuality: 5,
          jointComfort: 'great',
          notes: 'Adjusted seat height for optimal thoracic breath. Right shoulder capsule felt completely supported.',
          quickTags: ['👁️ Mind-Muscle Connection', '🌿 100% Pain Free & Grounded', '🧘 Deep Breath & Core Anchor']
        }
      },
      {
        id: 'ex-5',
        machineName: 'Cable Lateral Raise',
        category: 'Shoulders',
        seatSettings: 'Low Pulley, Single Handle',
        sets: [
          { id: 's15', setNumber: 1, type: 'working', weight: 15, reps: 15, completed: true, rpe: 7 },
          { id: 's16', setNumber: 2, type: 'working', weight: 20, reps: 12, completed: true, rpe: 8.5 },
          { id: 's17', setNumber: 3, type: 'working', weight: 20, reps: 11, completed: true, rpe: 9 }
        ],
        muscleFeeling: {
          targetMuscles: ['Shoulders'],
          sorenessLevel: 'none',
          pumpQuality: 5,
          jointComfort: 'great',
          notes: 'Pure lateral deltoid activation without trap tension. Felt weight floating through space.',
          quickTags: ['👁️ Mind-Muscle Connection', '🌊 Fluid Joint Harmony']
        }
      },
      {
        id: 'ex-6',
        machineName: 'Triceps Rope Pushdown',
        category: 'Triceps',
        seatSettings: 'High Pulley',
        sets: [
          { id: 's18', setNumber: 1, type: 'working', weight: 45, reps: 12, completed: true, rpe: 8 },
          { id: 's19', setNumber: 2, type: 'working', weight: 55, reps: 10, completed: true, rpe: 8.5 },
          { id: 's20', setNumber: 3, type: 'drop', weight: 35, reps: 14, completed: true, rpe: 9.5 }
        ],
        muscleFeeling: {
          targetMuscles: ['Triceps'],
          sorenessLevel: 'mild',
          pumpQuality: 4,
          jointComfort: 'minor_stiffness',
          notes: 'Slight stiffness in left elbow resolved when spreading the rope handles wider at peak contraction.',
          quickTags: ['🌾 Mild Stiffness', '⚡ Peak Vitality / High Aura']
        }
      }
    ]
  }
];

