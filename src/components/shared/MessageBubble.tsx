import { formatDistanceToNow } from 'date-fns'

type Props = {
  body: string
  sentAt: string
  isMine: boolean
  isFirst?: boolean
  isLast?: boolean
  showAvatar?: boolean
  avatarInitials?: string
}

const AVATAR_SIZE = 28
const ORANGE = '#f97316'

export default function MessageBubble({
  body,
  sentAt,
  isMine,
  isFirst = true,
  isLast = true,
  showAvatar = false,
  avatarInitials,
}: Props) {
  const timeAgo = formatDistanceToNow(new Date(sentAt), { addSuffix: true })

  // Only the last bubble in a group gets the tail
  const borderRadius = isMine
    ? isLast ? '18px 18px 4px 18px' : '18px 18px 18px 18px'
    : isLast ? '18px 18px 18px 4px' : '18px 18px 18px 18px'

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isMine ? 'flex-end' : 'flex-start',
        alignSelf: isMine ? 'flex-end' : 'flex-start',
        maxWidth: '72%',
        marginBottom: isLast ? 8 : 0,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, flexDirection: isMine ? 'row-reverse' : 'row' }}>
        {/* Avatar — always reserve space on "theirs" side for alignment */}
        {!isMine && (
          <div style={{ width: AVATAR_SIZE, height: AVATAR_SIZE, flexShrink: 0 }}>
            {showAvatar && (
              <div
                style={{
                  width: AVATAR_SIZE,
                  height: AVATAR_SIZE,
                  borderRadius: '50%',
                  backgroundColor: ORANGE,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 10,
                  fontWeight: 600,
                  color: '#fff',
                }}
              >
                {avatarInitials ?? '?'}
              </div>
            )}
          </div>
        )}

        <div
          style={{
            padding: '8px 13px',
            borderRadius,
            backgroundColor: isMine ? ORANGE : 'var(--color-surface-3)',
            color: isMine ? '#fff' : 'var(--color-text-primary)',
            fontSize: 14,
            lineHeight: 1.5,
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            marginTop: 2,
          }}
        >
          {body}
        </div>
      </div>

      {/* Timestamp once per group, only on last bubble */}
      {isLast && (
        <span
          style={{
            fontSize: 11,
            color: 'var(--color-text-hint)',
            paddingLeft: !isMine ? AVATAR_SIZE + 8 + 4 : 4,
            paddingRight: isMine ? 4 : 0,
            marginTop: 3,
          }}
        >
          {timeAgo}
        </span>
      )}
    </div>
  )
}
