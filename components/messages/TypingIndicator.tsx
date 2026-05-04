interface Props {
  names: string[] // prénoms des personnes en train d'écrire
  isGroup: boolean
}

export function TypingIndicator({ names, isGroup }: Props) {
  if (names.length === 0) return null

  const label = isGroup
    ? `${names.join(', ')} ${names.length > 1 ? 'écrivent' : 'écrit'}…`
    : null

  return (
    <div className="flex items-end gap-2">
      <div className="flex flex-col gap-0.5 items-start max-w-[70%]">
        {label && (
          <span className="text-xs text-gray-400 px-1">{label}</span>
        )}
        <div className="px-4 py-3 rounded-2xl rounded-bl-sm bg-blue-500 text-white flex items-center gap-1.5">
          <span className="typing-dot" />
          <span className="typing-dot" />
          <span className="typing-dot" />
        </div>
      </div>
    </div>
  )
}
