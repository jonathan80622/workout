import { Workout } from '../types';

export const SAMPLE_WORKOUTS: Workout[] = [
  {
    id: 'w-sample-1',
    title: 'Leg Day & Quad Focus',
    date: new Date(Date.now() - 86400000 * 1).toISOString(), // Yesterday
    durationMinutes: 52,
    unit: 'lbs',
    clientName: 'Jonathan',
    ptName: 'Coach Marcus',
    ptNotes: 'Hey Coach Marcus! Focused on slow, controlled eccentrics today. Leg press felt great with strong mind-muscle connection in the quads.',
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
          notes: 'Deep quad contraction fired up intensely at 280 lbs. Zero joint strain with solid foot placement.',
          quickTags: ['👁️ Mind-Muscle Connection', '🛡️ Solid Knee Protection', '🌿 100% Pain Free']
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
          notes: 'Hamstring contraction felt deep and controlled at full extension.',
          quickTags: ['🌊 Smooth Joint Motion', '🪵 Controlled Tempo']
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
          notes: '3-second pause at bottom stretch on every rep. Deep calf burn.',
          quickTags: ['⚡ High Muscle Energy', '✨ Strong Peak Pump']
        }
      }
    ]
  },
  {
    id: 'w-sample-2',
    title: 'Upper Body Chest & Delts',
    date: new Date(Date.now() - 86400000 * 3).toISOString(), // 3 days ago
    durationMinutes: 48,
    unit: 'lbs',
    clientName: 'Jonathan',
    ptName: 'Coach Marcus',
    ptNotes: 'Used Seated Chest Press instead of flat bench to keep shoulder capsule safe and stable.',
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
          notes: 'Adjusted seat height for optimal chest drive. Right shoulder felt completely supported.',
          quickTags: ['👁️ Mind-Muscle Connection', '🌿 100% Pain Free', '🧘 Solid Core Stability']
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
          notes: 'Pure side delt activation without traps over-engaging.',
          quickTags: ['👁️ Mind-Muscle Connection', '🌊 Smooth Motion']
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
          quickTags: ['🌾 Mild Stiffness', '⚡ High Muscle Energy']
        }
      }
    ]
  },
  {
    id: 'w-sample-3',
    title: 'Cardio & Treadmill Run',
    date: new Date(Date.now() - 86400000 * 5).toISOString(), // 5 days ago
    durationMinutes: 30,
    unit: 'lbs',
    clientName: 'Jonathan',
    ptName: 'Coach Marcus',
    ptNotes: 'Solid 3.2 mile treadmill run at 7:48/mi average pace. Heart rate stayed steady.',
    isCompleted: true,
    runningDistance: 3.2,
    runningTimeMinutes: 25,
    exercises: [
      {
        id: 'ex-7',
        machineName: 'Treadmill Interval Run',
        category: 'Cardio & Running',
        seatSettings: 'Speed: 7.2 mph, Incline: 1.0%',
        sets: [
          { id: 's21', setNumber: 1, type: 'working', weight: 0, reps: 0, distance: 3.2, runningTimeMinutes: 25, completed: true, rpe: 8 }
        ],
        muscleFeeling: {
          targetMuscles: ['Cardio & Running', 'Quads', 'Calves'],
          sorenessLevel: 'none',
          pumpQuality: 5,
          jointComfort: 'great',
          notes: 'Maintained smooth cadenced stride without ankle roll or joint strain.',
          quickTags: ['🌿 100% Pain Free', '⚡ High Muscle Energy', '🧘 Solid Core Stability']
        }
      }
    ]
  }
];


