import { formatDistanceToNow } from 'date-fns'

type Props = {
  body: string
  sentAt: string
  isMine: boolean
  senderLabel?: string
}

export default function MessageBubble({ body, sentAt, isMine, senderLabel }: Props) {
  const timeAgo = formatDistanceToNow(new Date(sentAt), { addSuffix: true })

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: isMine ? 'flex-end' : 'flex-start',
        gap: 3,
        maxWidth: '72%',
        alignSelf: isMine ? 'flex-end' : 'flex-start',
      }}
    >
      {senderLabel && (
        <span style={{ fontSize: 11, color: 'var(--color-text-hint)', paddingInline: 4 }}>
          {senderLabel}
        </span>
      )}
      <div
        style={{
          padding: '9px 14px',
          borderRadius: isMine ? '16px 16px 4px 16px' : '16px 16px 16px 4px',
          backgroundColor: isMine ? 'var(--color-accent)' : 'var(--color-surface-3)',
          color: isMine ? '#ffffff' : 'var(--color-text-primary)',
          fontSize: 14,
          lineHeight: 1.5,
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        {body}
      </div>
      <span style={{ fontSize: 11, color: 'var(--color-text-hint)', paddingInline: 4 }}>
        {timeAgo}
      </span>
    </div>
  )
}
