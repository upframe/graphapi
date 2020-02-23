export default {
  id: ({ sid }) => sid,
  end: ({ end, start }) =>
    end && end > start
      ? end
      : new Date(new Date(start).getTime() + 30 * 60 * 1000).toISOString(),
}
