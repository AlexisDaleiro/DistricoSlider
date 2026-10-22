export type Screen =
  | 'attract'
  | 'form'
  | 'countdown'
  | 'game'
  | 'result'
  | 'leaderboard'
  | 'admin';

export const TRANSITIONS: Record<Screen, Screen[]> = {
  attract: ['form', 'admin', 'leaderboard'],
  form: ['countdown', 'attract'],
  countdown: ['game', 'attract'],
  game: ['result', 'attract'],
  result: ['leaderboard', 'attract'],
  leaderboard: ['attract'],
  admin: ['attract'],
};
