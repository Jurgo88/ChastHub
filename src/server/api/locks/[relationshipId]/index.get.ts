export default defineEventHandler(() => {
  throw createError({ statusCode: 410, message: "This endpoint has been removed. Use the V2 locks API." })
})
