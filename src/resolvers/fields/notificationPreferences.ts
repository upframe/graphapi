export const NotificationPreferences = {
  __resolveType: ({ role }) =>
    role === 'user'
      ? 'UserNotificationPreferences'
      : 'MentorNotificationPreferences',

  receiveEmails: ({ receiveEmails }) => receiveEmails,
}

export const MentorNotificationPreferences = {
  slotReminder: ({ slotReminder }) => slotReminder?.toUpperCase(),
}
