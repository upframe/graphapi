import resolver from '../resolver'

export const slotReminder = resolver<
  string,
  any
>()(({ parent: { slotReminder } }) => slotReminder?.toUpperCase())
