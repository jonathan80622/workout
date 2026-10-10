import type { ActiveTab, MuscleGroup, SetType, WeightUnit } from '@/src/types';

export type AnalyticsEventName =
  | 'tab_viewed'
  | 'workout_started'
  | 'workout_completed'
  | 'workout_discarded'
  | 'workout_repeated'
  | 'exercise_added'
  | 'exercise_removed'
  | 'set_added'
  | 'set_completed'
  | 'scheduled_session_saved'
  | 'scheduled_session_started'
  | 'drive_connected'
  | 'drive_disconnected'
  | 'history_searched'
  | 'workout_deleted'
  | 'video_uploaded';

export type AnalyticsPropertiesByEvent = {
  tab_viewed: { tab: ActiveTab };
  workout_started: {
    source: 'scratch' | 'machine_library' | 'history' | 'scheduled';
    has_scheduled_session?: boolean;
    exercise_count?: number;
  };
  workout_completed: {
    duration_minutes: number;
    exercise_count: number;
    completed_set_count: number;
    total_volume: number;
    total_distance: number;
    has_pt_note: boolean;
    video_count: number;
  };
  workout_discarded: {
    duration_minutes: number;
    exercise_count: number;
    completed_set_count: number;
  };
  workout_repeated: {
    exercise_count: number;
    completed_set_count: number;
  };
  exercise_added: {
    source: 'active_workout' | 'custom' | 'machine_library';
    category: MuscleGroup;
    exercise_count: number;
  };
  exercise_removed: {
    category: MuscleGroup;
    remaining_exercise_count: number;
  };
  set_added: {
    category: MuscleGroup;
    set_count: number;
    is_cardio: boolean;
  };
  set_completed: {
    category: MuscleGroup;
    set_type: SetType;
    weight_unit: WeightUnit;
    is_cardio: boolean;
    has_distance: boolean;
    reps: number;
    weight: number;
  };
  scheduled_session_saved: {
    method: 'device_calendar' | 'google_calendar' | 'app_only';
    duration_minutes: number;
    days_until_session: number;
  };
  scheduled_session_started: {
    has_notes: boolean;
  };
  drive_connected: Record<string, never>;
  drive_disconnected: Record<string, never>;
  history_searched: {
    query_length: number;
    result_count: number;
    total_count: number;
  };
  workout_deleted: {
    exercise_count: number;
    completed_set_count: number;
  };
  video_uploaded: {
    category: MuscleGroup;
    duration_seconds: number;
    existing_video_count: number;
  };
};

export type AnalyticsProperties<TEvent extends AnalyticsEventName = AnalyticsEventName> =
  AnalyticsPropertiesByEvent[TEvent];

export type AnalyticsTrack = <TEvent extends AnalyticsEventName>(
  event: TEvent,
  properties: AnalyticsPropertiesByEvent[TEvent]
) => void;

type PropertyKind = 'string' | 'number' | 'boolean';

export const analyticsEventConfig: Record<AnalyticsEventName, Record<string, PropertyKind>> = {
  tab_viewed: { tab: 'string' },
  workout_started: {
    source: 'string',
    has_scheduled_session: 'boolean',
    exercise_count: 'number',
  },
  workout_completed: {
    duration_minutes: 'number',
    exercise_count: 'number',
    completed_set_count: 'number',
    total_volume: 'number',
    total_distance: 'number',
    has_pt_note: 'boolean',
    video_count: 'number',
  },
  workout_discarded: {
    duration_minutes: 'number',
    exercise_count: 'number',
    completed_set_count: 'number',
  },
  workout_repeated: {
    exercise_count: 'number',
    completed_set_count: 'number',
  },
  exercise_added: {
    source: 'string',
    category: 'string',
    exercise_count: 'number',
  },
  exercise_removed: {
    category: 'string',
    remaining_exercise_count: 'number',
  },
  set_added: {
    category: 'string',
    set_count: 'number',
    is_cardio: 'boolean',
  },
  set_completed: {
    category: 'string',
    set_type: 'string',
    weight_unit: 'string',
    is_cardio: 'boolean',
    has_distance: 'boolean',
    reps: 'number',
    weight: 'number',
  },
  scheduled_session_saved: {
    method: 'string',
    duration_minutes: 'number',
    days_until_session: 'number',
  },
  scheduled_session_started: {
    has_notes: 'boolean',
  },
  drive_connected: {},
  drive_disconnected: {},
  history_searched: {
    query_length: 'number',
    result_count: 'number',
    total_count: 'number',
  },
  workout_deleted: {
    exercise_count: 'number',
    completed_set_count: 'number',
  },
  video_uploaded: {
    category: 'string',
    duration_seconds: 'number',
    existing_video_count: 'number',
  },
};

export function isAnalyticsEventName(value: unknown): value is AnalyticsEventName {
  return typeof value === 'string' && value in analyticsEventConfig;
}
