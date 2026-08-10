export type TrainingSchool = 'pirate' | 'mystery' | 'ninja';

export type ReminderKind =
  | 'training'
  | 'grave-danger'
  | 'neolodge'
  | 'kadoatery';

export interface ReminderRecord {
  id: string;
  kind: ReminderKind;
  subject: string;
  sourceUrl: string;
  observedAt: number;
  dueAt: number;
  status: 'scheduled' | 'ready' | 'dismissed';
  parserVersion: number;
  sourceDetail?: string;
  notifiedAt?: number;
}

export interface TrainingObservation {
  kind: 'training';
  petName: string;
  school: TrainingSchool;
  observedAt: number;
  dueAt: number;
  state: 'training' | 'ready';
}

export type ContentToBackgroundMessage = {
  type: 'REMINDER_OBSERVED';
  observations: TrainingObservation[];
};
