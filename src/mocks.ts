import { MockList } from 'apollo-server-lambda'

export default {
  Mentor: () => ({
    timeSlots: () => new MockList((Math.random() * 5) | 0),
  }),

  Timeslot: () => ({
    start: () =>
      new Date(new Date().getTime() + Math.random() * 1e9).toISOString(),
  }),
}
