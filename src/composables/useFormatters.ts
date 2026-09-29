export function useFormatters() {
  function formatTime(iso: string): string {
    return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
  }

  function formatDateTime(iso: string, timeZone?: string): string {
    return new Date(iso).toLocaleString(undefined, { timeZone })
  }

  function formatDate(iso: string): string {
    return new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
  }

  // The full timestamp behind a short date — used as the `title` tooltip in
  // the admin tables, where "4 Sep 2026" is not enough to correlate events.
  function formatDateTimeFull(iso: string): string {
    return new Date(iso).toLocaleString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short',
    })
  }

  return { formatTime, formatDateTime, formatDateTimeFull, formatDate }
}
