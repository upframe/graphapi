export default {
  id: ({ sid }) => sid,
  duration: ({ start, end }) =>
    !end
      ? 30
      : Math.round(
          (new Date(end).getTime() - new Date(start).getTime()) / (1000 * 60)
        ),
}
