import { TrainingPlan } from '../types';

export const DEFAULT_TRAINING_PLAN: TrainingPlan = {
  version: 1,
  title: 'Push / Pull Program',
  warmupMoves: [
    { id: 'hooklying', name: 'Hooklying', target: '6-8' },
    { id: 'left-side-bend', name: '四足跪姿左側彎', target: '6-8' },
    { id: 'dead-bug', name: '死蟲式', target: '8下' },
  ],
  blocks: [
    {
      id: 'push-a',
      title: '推 A',
      subtitle: 'Chest, shoulders, triceps',
      accent: '#d97724',
      exercises: [
        { id: 'push-a-1', name: '啞鈴上胸臥推', sets: '3組', reps: '6-8下', rest: '2-3分' },
        { id: 'push-a-2', name: '機械平胸推', sets: '3組', reps: '8-10下', rest: '2-3分' },
        { id: 'push-a-3', name: '蝴蝶機夾胸', sets: '3組', reps: '10-12下', rest: '2分' },
        { id: 'push-a-4', name: 'Life 機械肩推', sets: '4組', reps: '8-10下', rest: '2-3分' },
        { id: 'push-a-5', name: '啞鈴側平舉', sets: '3組', reps: '12-15下', rest: '2分' },
        { id: 'push-a-6', name: 'Hammer tricep extension', sets: '3組', reps: '12下', rest: '2分' },
        { id: 'push-a-7', name: 'Cable 平握把 extension', sets: '2組', reps: '12-15下', rest: '2分' },
      ],
    },
    {
      id: 'pull-a',
      title: '拉 A',
      subtitle: 'Back, rear delts, biceps',
      accent: '#849a88',
      exercises: [
        { id: 'pull-a-1', name: '對握輔助引體向上', sets: '3組', reps: '8-10下', rest: '2-3分' },
        { id: 'pull-a-2', name: '啞鈴單臂划船', sets: '3組', reps: '8-10下', rest: '2-3分' },
        { id: 'pull-a-3', name: 'Life 機械正手下拉', sets: '3組', reps: '10-12下', rest: '2-3分' },
        { id: 'pull-a-4', name: 'Cable 正手划船', sets: '3組', reps: '10-12下', rest: '2-3分' },
        { id: 'pull-a-5', name: '蝴蝶機反向飛鳥', sets: '3組', reps: '10-12下', rest: '2分' },
        { id: 'pull-a-6', name: 'Hammer 二頭彎舉', sets: '3組', reps: '10-12下', rest: '2分' },
        { id: 'pull-a-7', name: '啞鈴垂式彎舉', sets: '2組', reps: '12-15下', rest: '2分' },
      ],
    },
    {
      id: 'push-b',
      title: '推 B',
      subtitle: 'Pressing variation day',
      accent: '#c86d51',
      exercises: [
        { id: 'push-b-1', name: '史密斯上胸臥推', sets: '3組', reps: '6-8下', rest: '2-3分' },
        { id: 'push-b-2', name: '啞鈴平胸臥推', sets: '3組', reps: '8-10下', rest: '2-3分' },
        { id: 'push-b-3', name: 'Cable夾胸', sets: '3組', reps: '10-12下', rest: '2分' },
        { id: 'push-b-4', name: '啞鈴坐姿肩推', sets: '4組', reps: '8-10下', rest: '2-3分' },
        { id: 'push-b-5', name: '機械側平舉', sets: '3組', reps: '12-15下', rest: '2分' },
        { id: 'push-b-6', name: 'Cable 纜繩三頭下壓', sets: '3組', reps: '12-15下', rest: '2分' },
        { id: 'push-b-7', name: 'Cable 過頭extension', sets: '2組', reps: '12-15下', rest: '2分' },
      ],
    },
    {
      id: 'pull-b',
      title: '拉 B',
      subtitle: 'Vertical and row variation day',
      accent: '#f5c999',
      exercises: [
        { id: 'pull-b-1', name: '正手滑輪下拉', sets: '3組', reps: '8-10下', rest: '2-3分' },
        { id: 'pull-b-2', name: '機械反手划船', sets: '3組', reps: '8-10下', rest: '2-3分' },
        { id: 'pull-b-3', name: 'Hoist 機械下拉', sets: '3組', reps: '10-12下', rest: '2-3分' },
        { id: 'pull-b-4', name: 'Cable 對握與肩同寬划船', sets: '3組', reps: '10-12下', rest: '2-3分' },
        { id: 'pull-b-5', name: 'Face pull', sets: '3組', reps: '10-12下', rest: '2分' },
        { id: 'pull-b-6', name: '啞鈴斜板二頭彎舉', sets: '3組', reps: '10-12下', rest: '2分' },
        { id: 'pull-b-7', name: 'Cable 垂式彎舉', sets: '2組', reps: '12-15下', rest: '2分' },
      ],
    },
  ],
};
