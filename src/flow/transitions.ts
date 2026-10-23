export type Screen =
  | 'attract'
  | 'form'
  | 'countdown'
  | 'game'
  | 'result'
  | 'leaderboard'
  | 'admin';

export const TRANSITIONS: Record<Screen, Screen[]> = {
  // La portada es la única entrada pública: registro, ranking diario o hotspot admin.
  attract: ['form', 'leaderboard', 'admin'],
  form: ['countdown', 'attract'],
  countdown: ['game', 'attract'],
  game: ['result', 'attract'],
  result: ['leaderboard', 'countdown', 'attract'],
  leaderboard: ['attract'],
  admin: ['attract'],
};
