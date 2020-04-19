export const name = (value: string) => {
  if (value.length < 3) return 'too short'
  if (value.length > 50) return 'too long'
}

export const handle = (value: string) => {
  if (value.length < 3) return 'too short'
  if (value.length > 20) return 'too long'
  if (/[^\w]/.test(value)) return 'invalid characters'
}
