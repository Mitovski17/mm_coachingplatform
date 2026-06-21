import { formatDistanceToNow, format } from 'date-fns'

type CheckinSnippet = {
  checkinId: string
  submittedAt: string
  metrics: {
    performance: number | null
    nutrition: number | null
    training: number | null
    sleep: number | null
    weight: number | null
  }
}

type Props = {
  body: string
  sentAt: string
  isMine: boolean
  isFirst?: boolean
  isLast?: boolean
  showAvatar?: boolean
  avatarInitials?: string
  checkinAttachment?: CheckinSnippet | null
}

const AVATAR_SIZE = 28
const ORANGE = '#f97316'

function CheckinSnippetCard({ snippet, isMine }: { snippet: CheckinSnippet; isMine: boolean }) {
  const { metrics } = snippet
  const pills: string[] = []
  if (metrics.performance !== null) pills.push(`Perf ${metrics.performance}/10`)
  if (metrics.nutrition !== null) pills.push(`Nutrition ${metrics.nutrition}%`)
  if (metrics.training !== null) pills.push(`Training ${metrics.training}%`)
  if (metrics.sleep !== null) pills.push(`Sleep ${metrics.sleep}/10`)
  if (metrics.weight !== null) pills.push(`Weight ${metrics.weight}kg`)

  const dateLabel = format(new Date(snippet.submittedAt), 'MMM d')

  return (
    <div
      style={{
        borderRadius: 10,
        border: isMine ? '1px solid rgba(255,255,255,0.25)' : '1px solid var(--color-border)',
        backgroundColor: isMine ? 'rgba(0,0,0,0.15)' : 'var(--color-surface-2)',
        padding: '7px 10px',
        marginBottom: 6,
        minWidth: 0,
      }}
    >
      <div
        style={{
          fontSize: 11,
          fontWeight: 600,
          color: isMine ? 'rgba(255,255,255,0.75)' : 'var(--color-text-hint)',
          marginBottom: 4,
          display: 'flex',
          alignItems: 'center',
          gap: 5,
        }}
      >
        <span>📋</span>
        <span>Check-in · {dateLabel}</span>
      </div>
      {pills.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
          {pills.map((p) => (
            <span
              key={p}
              style={{
                fontSize: 10,
                fontWeight: 500,
                padding: '2px 6px',
                borderRadius: 4,
                backgroundColor: isMine ? 'rgba(255,255,255,0.15)' : 'var(--color-surface-3)',
                color: isMine ? 'rgba(255,255,255,0.85)' : 'var(--color-text-secondary)',
              }}
            >
              {p}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

export default function MessageBubble({
  body,
  sentAt,
  isMine,
  isFirst = true,
  isLast = true,
  showAvatar = false,
  avatarInitials,
  checkinAttachment,
}: Props) {
  const timeAgo = formatDistanceToNow(new Date(sentAt), { addSuffix: true })

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
          {checkinAttachment && (
            <CheckinSnippetCard snippet={checkinAttachment} isMine={isMine} />
          )}
          {body}
        </div>
      </div>

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
