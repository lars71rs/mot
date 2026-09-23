import { parseChatMd, type ChatInline } from './chatMd'

function Inline({ parts }: { parts: ChatInline[] }) {
  return (
    <>
      {parts.map((p, i) => (p.t === 'strong' ? <strong key={i}>{p.v}</strong> : <span key={i}>{p.v}</span>))}
    </>
  )
}

export function ChatBody({ text }: { text: string }) {
  const blocks = parseChatMd(text)
  return (
    <div className="chat-md">
      {blocks.map((b, i) => {
        if (b.t === 'hr') return <hr key={i} />
        if (b.t === 'h') {
          return (
            <p key={i} className="chat-md-h">
              <Inline parts={b.parts} />
            </p>
          )
        }
        if (b.t === 'ul') {
          return (
            <ul key={i}>
              {b.items.map((item, j) => (
                <li key={j}>
                  <Inline parts={item} />
                </li>
              ))}
            </ul>
          )
        }
        if (b.t === 'ol') {
          return (
            <ol key={i}>
              {b.items.map((item, j) => (
                <li key={j}>
                  <Inline parts={item} />
                </li>
              ))}
            </ol>
          )
        }
        return (
          <p key={i}>
            <Inline parts={b.parts} />
          </p>
        )
      })}
    </div>
  )
}
