import type {
  ActivityObservation,
  TrainingObservation,
  TrainingSchool,
} from '../shared/types.js';
import { PARSER_VERSION } from '../shared/types.js';
import { normalizeWs } from './clock.js';
import { parseDurationMs } from './duration.js';

export type ParseDiagnostic = {
  school: TrainingSchool;
  reason: string;
};

export type ParseTrainingResult = {
  observations: TrainingObservation[];
  activityObservations: ActivityObservation[];
  diagnostics: ParseDiagnostic[];
};

/**
 * Full six-file gate is NOT complete (Ninja still missing).
 * Best-effort: mystery/pirate active + Course Finished ready (mystery + pirate).
 */
export const TRAINING_FIXTURE_GATE_COMPLETE = false;

export const TRAINING_FIXTURES_AVAILABLE = true;

export const FIXTURE_GATE_REASON =
  'Partial Training parser. Ninja unsupported (no fixtures). Mystery/Pirate active+ready evidenced.';

const STUDYING_RE =
  /^(.+?)\s*\(\s*Level\s+\d+\s*\)\s+is currently studying\b/i;
const NOT_ON_COURSE_RE =
  /^(.+?)\s*\(\s*Level\s+\d+\s*\)\s+is not on a course\b/i;
const TIMER_LABEL_RE = /time\s+till\s+course\s+finishes/i;
const COURSE_FINISHED_RE = /course\s+finished\s*!/i;

function diag(school: TrainingSchool, reason: string): ParseDiagnostic {
  return { school, reason };
}

function idKey(school: TrainingSchool, petName: string): string {
  const normalized = petName.normalize('NFKC').toLocaleLowerCase('en-US');
  return `${school}:${encodeURIComponent(normalized)}`;
}

/**
 * Pure Training parser. Does not throw / mutate / call Chrome APIs.
 * School comes from URL classifier only.
 */
export function parseTraining(
  document: Document,
  school: TrainingSchool,
  observedAt: number,
): ParseTrainingResult {
  const observations: TrainingObservation[] = [];
  const activityObservations: ActivityObservation[] = [];
  const diagnostics: ParseDiagnostic[] = [];

  if (school === 'ninja') {
    return {
      observations: [],
      activityObservations: [
        {
          kind: 'training',
          idKey: 'ninja:unsupported',
          subject: 'Ninja Training',
          school: 'ninja',
          observedAt,
          dueAt: observedAt,
          status: 'ready',
          activityStatus: 'unsupported',
          timerQuality: 'none',
          sourceNote: 'No Ninja fixtures; unsupported',
          parserVersion: PARSER_VERSION,
        },
      ],
      diagnostics: [
        diag(
          school,
          'ninja-excluded-no-fixture: Ninja pet/pages not captured; refusing selectors',
        ),
      ],
    };
  }

  let rows: Element[];
  try {
    rows = Array.from(document.querySelectorAll('table tr'));
  } catch {
    return {
      observations: [],
      activityObservations: [],
      diagnostics: [diag(school, 'dom-query-failed')],
    };
  }

  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    if (!row) continue;

    const headerText = normalizeWs(row.textContent ?? '');
    if (!headerText) continue;

    if (NOT_ON_COURSE_RE.test(headerText)) {
      continue;
    }

    const studying = STUDYING_RE.exec(headerText);
    if (!studying) {
      continue;
    }

    const petName = (studying[1] ?? '').trim();
    if (!petName) {
      diagnostics.push(diag(school, 'skip-empty-pet-name'));
      continue;
    }

    const detail = rows[i + 1];
    if (!detail) {
      diagnostics.push(diag(school, 'skip-missing-detail-row'));
      continue;
    }

    const detailText = normalizeWs(detail.textContent ?? '');

    // Course Finished! in detail cell (mystery-ready fixture)
    if (COURSE_FINISHED_RE.test(detailText)) {
      const obs: TrainingObservation = {
        kind: 'training',
        petName,
        school,
        observedAt,
        dueAt: observedAt,
        state: 'ready',
        parserVersion: PARSER_VERSION,
      };
      observations.push(obs);
      activityObservations.push({
        kind: 'training',
        idKey: idKey(school, petName),
        subject: petName,
        school,
        observedAt,
        dueAt: observedAt,
        status: 'ready',
        activityStatus: 'ready',
        timerQuality: 'none',
        sourceNote: 'Course Finished! snapshot',
        parserVersion: PARSER_VERSION,
      });
      continue;
    }

    if (!TIMER_LABEL_RE.test(detailText)) {
      diagnostics.push(diag(school, 'skip-missing-timer-label'));
      continue;
    }

    const afterLabel = detailText.replace(
      /^.*?time\s+till\s+course\s+finishes\s*:?\s*/i,
      '',
    );
    const durationMs = parseDurationMs(afterLabel);
    if (durationMs === null) {
      diagnostics.push(diag(school, 'skip-unparseable-duration'));
      continue;
    }

    const dueAt = observedAt + durationMs;
    observations.push({
      kind: 'training',
      petName,
      school,
      observedAt,
      dueAt,
      state: 'training',
      parserVersion: PARSER_VERSION,
    });
    activityObservations.push({
      kind: 'training',
      idKey: idKey(school, petName),
      subject: petName,
      school,
      observedAt,
      dueAt,
      status: 'scheduled',
      activityStatus: 'active',
      timerQuality: 'snapshot',
      sourceNote:
        'Server-rendered remaining snapshot at observe; local estimate afterward',
      parserVersion: PARSER_VERSION,
    });
  }

  if (observations.length === 0 && diagnostics.length === 0) {
    diagnostics.push(diag(school, 'no-active-training-rows'));
  }

  return { observations, activityObservations, diagnostics };
}

export function syntheticObservation(
  partial: Omit<TrainingObservation, 'kind' | 'parserVersion'> & {
    kind?: 'training';
    parserVersion?: 1;
  },
): TrainingObservation {
  return {
    kind: 'training',
    parserVersion: PARSER_VERSION,
    petName: partial.petName,
    school: partial.school,
    observedAt: partial.observedAt,
    dueAt: partial.dueAt,
    state: partial.state,
  };
}
