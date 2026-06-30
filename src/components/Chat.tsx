import { useRef, useState } from 'react'
import { useChat } from '@ai-sdk/react'
import { DefaultChatTransport } from 'ai'
import { useAuthToken } from '@convex-dev/auth/react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

// Lightweight AI Elements-style conversation. The playground posts to the same
// /v1/chat endpoint as API consumers, authenticating with the Convex JWT.
export function Chat() {
  const token = useAuthToken()
  const tokenRef = useRef<string | null>(token)
  tokenRef.current = token

  const [transport] = useState(
    () =>
      new DefaultChatTransport({
        api: '/v1/chat',
        headers: (): Record<string, string> => {
          const current = tokenRef.current
          return current ? { Authorization: `Bearer ${current}` } : {}
        },
      }),
  )

  const { messages, sendMessage, status } = useChat({ transport })
  const [input, setInput] = useState('')
  const busy = status === 'submitted' || status === 'streaming'

  return (
    <div className="flex h-[calc(100vh-12rem)] flex-col rounded-xl border border-zinc-800 bg-zinc-900/40">
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 ? (
          <p className="py-12 text-center text-sm text-zinc-500">
            Send a message to test the generation pipeline.
          </p>
        ) : null}
        {messages.map((message) => (
          <div
            key={message.id}
            className={message.role === 'user' ? 'flex justify-end' : 'flex justify-start'}
          >
            <div
              className={
                message.role === 'user'
                  ? 'max-w-[80%] rounded-2xl bg-zinc-100 px-4 py-2 text-sm text-zinc-900'
                  : 'max-w-[80%] rounded-2xl bg-zinc-800 px-4 py-2 text-sm text-zinc-100'
              }
            >
              {message.parts.map((part, index) =>
                part.type === 'text' ? (
                  <span key={`${message.id}-${index}`} className="whitespace-pre-wrap">
                    {part.text}
                  </span>
                ) : null,
              )}
            </div>
          </div>
        ))}
      </div>

      <form
        className="flex items-center gap-2 border-t border-zinc-800 p-3"
        onSubmit={(event) => {
          event.preventDefault()
          const text = input.trim()
          if (!text || busy) return
          void sendMessage({ text })
          setInput('')
        }}
      >
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Say something…"
          disabled={busy}
        />
        <Button type="submit" disabled={busy || input.trim().length === 0}>
          {busy ? 'Sending…' : 'Send'}
        </Button>
      </form>
    </div>
  )
}
