// chasthub.com/x, the link for the X bio. See x/[...campaign].ts.
export default defineEventHandler(event =>
  sendRedirect(event, '/?utm_source=x&utm_medium=bio&utm_campaign=profile', 302),
)
