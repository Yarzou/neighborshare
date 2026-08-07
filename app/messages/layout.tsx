import PushNotificationBanner from '@/components/layout/PushNotificationBanner'

/**
 * Portée réelle de la bannière d'activation des notifications.
 *
 * Elle était montée par le layout racine, donc sur toutes les routes, alors que
 * son effet s'interrompt immédiatement hors de `/messages`. Tout son arbre de
 * modules (`lib/pushNotifications`, et par ricochet le SDK Firebase avant que
 * son import ne devienne paresseux) était expédié partout pour ne rien faire.
 */
export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <PushNotificationBanner />
    </>
  )
}
