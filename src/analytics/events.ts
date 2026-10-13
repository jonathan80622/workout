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
  | 'scheduled_session_exported'
  | 'scheduled_session_started'
  | 'drive_connected'
  | 'drive_disconnected'
  | 'history_searched'
  | 'workout_deleted'
  | 'video_uploaded'
  | 'bumstead_edit_applied'
  | 'pt_portal_loaded'
  | 'pt_client_selected'
  | 'pt_workout_exposed'
  | 'pt_exercise_exposed'
  | 'pt_video_opened'
  | 'pt_video_closed'
  | 'pt_comment_focused'
  | 'pt_comment_saved'
  | 'pt_comment_save_failed';

export type AnalyticsPropertiesByEvent = {
  tab_viewed: { tab: ActiveTab };
  workout_started: {
    workout_id?: string;
    scheduled_session_id?: string;
    source_workout_id?: string;
    source: 'scratch' | 'history' | 'scheduled';
    has_scheduled_session?: boolean;
    exercise_count?: number;
  };
  workout_completed: {
    workout_id?: string;
    duration_minutes: number;
    exercise_count: number;
    completed_set_count: number;
    total_volume: number;
    total_distance: number;
    has_pt_note: boolean;
    video_count: number;
  };
  workout_discarded: {
    workout_id?: string;
    duration_minutes: number;
    exercise_count: number;
    completed_set_count: number;
  };
  workout_repeated: {
    workout_id?: string;
    source_workout_id?: string;
    exercise_count: number;
    completed_set_count: number;
  };
  exercise_added: {
    workout_id?: string;
    exercise_id?: string;
    source: 'active_workout' | 'custom';
    category: MuscleGroup;
    exercise_count: number;
  };
  exercise_removed: {
    workout_id?: string;
    exercise_id?: string;
    category: MuscleGroup;
    remaining_exercise_count: number;
  };
  set_added: {
    workout_id?: string;
    exercise_id?: string;
    category: MuscleGroup;
    set_count: number;
    is_cardio: boolean;
  };
  set_completed: {
    workout_id?: string;
    exercise_id?: string;
    category: MuscleGroup;
    set_type: SetType;
    weight_unit: WeightUnit;
    is_cardio: boolean;
    has_distance: boolean;
    reps: number;
    weight: number;
  };
  scheduled_session_saved: {
    scheduled_session_id?: string;
    method: 'device_calendar' | 'google_calendar' | 'app_only';
    duration_minutes: number;
    days_until_session: number;
  };
  scheduled_session_exported: {
    scheduled_session_id?: string;
    method: 'device_calendar' | 'google_calendar';
    duration_minutes: number;
    days_until_session: number;
  };
  scheduled_session_started: {
    workout_id?: string;
    scheduled_session_id?: string;
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
    workout_id?: string;
    exercise_count: number;
    completed_set_count: number;
  };
  video_uploaded: {
    workout_id?: string;
    exercise_id?: string;
    video_id?: string;
    category: MuscleGroup;
    duration_seconds: number;
    existing_video_count: number;
  };
  bumstead_edit_applied: { tool: string; workout_id?: string; scheduled_session_id?: string };
  pt_portal_loaded: {
    status: 'success' | 'failure';
    client_id?: string;
    client_count?: number;
    workout_count?: number;
  };
  pt_client_selected: {
    client_id: string;
    previous_client_id?: string;
    workout_count?: number;
  };
  pt_workout_exposed: {
    client_id?: string;
    workout_id: string;
    exercise_count: number;
    completed_set_count: number;
    video_count: number;
  };
  pt_exercise_exposed: {
    client_id?: string;
    workout_id: string;
    exercise_id: string;
    category: MuscleGroup;
    completed_set_count: number;
    video_count: number;
  };
  pt_video_opened: {
    client_id?: string;
    workout_id: string;
    exercise_id: string;
    video_id: string;
  };
  pt_video_closed: {
    client_id?: string;
    workout_id: string;
    exercise_id: string;
    video_id: string;
  };
  pt_comment_focused: {
    client_id?: string;
    workout_id: string;
    exercise_id?: string;
    comment_scope: 'workout' | 'exercise';
  };
  pt_comment_saved: {
    client_id?: string;
    workout_id: string;
    exercise_id?: string;
    comment_scope: 'workout' | 'exercise';
    comment_length: number;
  };
  pt_comment_save_failed: {
    client_id?: string;
    workout_id: string;
    exercise_id?: string;
    comment_scope: 'workout' | 'exercise';
    comment_length: number;
  };
};

export type AnalyticsProperties<TEvent extends AnalyticsEventName = AnalyticsEventName> =
  AnalyticsPropertiesByEvent[TEvent];

export type AnalyticsTrackOptions = {
  correlationId?: string;
};

export type AnalyticsTrack = <TEvent extends AnalyticsEventName>(
  event: TEvent,
  properties: AnalyticsPropertiesByEvent[TEvent],
  options?: AnalyticsTrackOptions
) => void;

type PropertyKind = 'string' | 'number' | 'boolean';

export const analyticsEventConfig: Record<AnalyticsEventName, Record<string, PropertyKind>> = {
  tab_viewed: { tab: 'string' },
  workout_started: {
    workout_id: 'string',
    scheduled_session_id: 'string',
    source_workout_id: 'string',
    source: 'string',
    has_scheduled_session: 'boolean',
    exercise_count: 'number',
  },
  workout_completed: {
    workout_id: 'string',
    duration_minutes: 'number',
    exercise_count: 'number',
    completed_set_count: 'number',
    total_volume: 'number',
    total_distance: 'number',
    has_pt_note: 'boolean',
    video_count: 'number',
  },
  workout_discarded: {
    workout_id: 'string',
    duration_minutes: 'number',
    exercise_count: 'number',
    completed_set_count: 'number',
  },
  workout_repeated: {
    workout_id: 'string',
    source_workout_id: 'string',
    exercise_count: 'number',
    completed_set_count: 'number',
  },
  exercise_added: {
    workout_id: 'string',
    exercise_id: 'string',
    source: 'string',
    category: 'string',
    exercise_count: 'number',
  },
  exercise_removed: {
    workout_id: 'string',
    exercise_id: 'string',
    category: 'string',
    remaining_exercise_count: 'number',
  },
  set_added: {
    workout_id: 'string',
    exercise_id: 'string',
    category: 'string',
    set_count: 'number',
    is_cardio: 'boolean',
  },
  set_completed: {
    workout_id: 'string',
    exercise_id: 'string',
    category: 'string',
    set_type: 'string',
    weight_unit: 'string',
    is_cardio: 'boolean',
    has_distance: 'boolean',
    reps: 'number',
    weight: 'number',
  },
  scheduled_session_saved: {
    scheduled_session_id: 'string',
    method: 'string',
    duration_minutes: 'number',
    days_until_session: 'number',
  },
  scheduled_session_exported: {
    scheduled_session_id: 'string',
    method: 'string',
    duration_minutes: 'number',
    days_until_session: 'number',
  },
  scheduled_session_started: {
    workout_id: 'string',
    scheduled_session_id: 'string',
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
    workout_id: 'string',
    exercise_count: 'number',
    completed_set_count: 'number',
  },
  video_uploaded: {
    workout_id: 'string',
    exercise_id: 'string',
    video_id: 'string',
    category: 'string',
    duration_seconds: 'number',
    existing_video_count: 'number',
  },
  bumstead_edit_applied: {
    tool: 'string',
    workout_id: 'string',
    scheduled_session_id: 'string',
  },
  pt_portal_loaded: {
    status: 'string',
    client_id: 'string',
    client_count: 'number',
    workout_count: 'number',
  },
  pt_client_selected: {
    client_id: 'string',
    previous_client_id: 'string',
    workout_count: 'number',
  },
  pt_workout_exposed: {
    client_id: 'string',
    workout_id: 'string',
    exercise_count: 'number',
    completed_set_count: 'number',
    video_count: 'number',
  },
  pt_exercise_exposed: {
    client_id: 'string',
    workout_id: 'string',
    exercise_id: 'string',
    category: 'string',
    completed_set_count: 'number',
    video_count: 'number',
  },
  pt_video_opened: {
    client_id: 'string',
    workout_id: 'string',
    exercise_id: 'string',
    video_id: 'string',
  },
  pt_video_closed: {
    client_id: 'string',
    workout_id: 'string',
    exercise_id: 'string',
    video_id: 'string',
  },
  pt_comment_focused: {
    client_id: 'string',
    workout_id: 'string',
    exercise_id: 'string',
    comment_scope: 'string',
  },
  pt_comment_saved: {
    client_id: 'string',
    workout_id: 'string',
    exercise_id: 'string',
    comment_scope: 'string',
    comment_length: 'number',
  },
  pt_comment_save_failed: {
    client_id: 'string',
    workout_id: 'string',
    exercise_id: 'string',
    comment_scope: 'string',
    comment_length: 'number',
  },
};

export function isAnalyticsEventName(value: unknown): value is AnalyticsEventName {
  return typeof value === 'string' && value in analyticsEventConfig;
}
