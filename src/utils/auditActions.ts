// TASK-169 — every action written to audit_log, grouped for the admin Audit
// log page. Shared by the page (groups, labels) and /api/admin/audit-log
// (the allow-list its filter is checked against).
//
// Adding a logAudit() call with a new action? Add it here too, or it can
// only be seen under "All".

export const AUDIT_ACTION_GROUPS = {
  admin: [
    'user_banned', 'user_unbanned', 'report_resolved', 'report_dismissed',
    'admin_invited', 'admin_demoted', 'account_deleted',
    'security_report_handled', 'security_report_reopened',
    'lounge_message_deleted', 'lounge_mute', 'lounge_unmute', 'lounge_settings_updated',
    'challenge_created', 'challenge_updated',
  ],
  loqs: [
    'loq_accepted', 'loq_cancelled', 'loq_ended', 'loq_paused', 'loq_resumed',
    'loq_time_added', 'loq_time_removed', 'loq_wheel_spin',
  ],
} as const

export const AUDIT_ACTIONS: readonly string[] = [...AUDIT_ACTION_GROUPS.admin, ...AUDIT_ACTION_GROUPS.loqs]

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  user_banned: 'Banned user',
  user_unbanned: 'Unbanned user',
  report_resolved: 'Resolved report (ban)',
  report_dismissed: 'Dismissed report',
  admin_invited: 'Made admin',
  admin_demoted: 'Removed admin',
  account_deleted: 'Deleted own account',
  security_report_handled: 'Handled issue report',
  security_report_reopened: 'Reopened issue report',
  lounge_message_deleted: 'Deleted Lounge message',
  lounge_mute: 'Muted in Lounge',
  lounge_unmute: 'Unmuted in Lounge',
  lounge_settings_updated: 'Changed Lounge settings',
  challenge_created: 'Created challenge',
  challenge_updated: 'Changed challenge',
  loq_accepted: 'Lock accepted',
  loq_cancelled: 'Lock cancelled',
  loq_ended: 'Lock ended',
  loq_paused: 'Lock paused',
  loq_resumed: 'Lock resumed',
  loq_time_added: 'Time added',
  loq_time_removed: 'Time removed',
  loq_wheel_spin: 'Wheel spun',
}
