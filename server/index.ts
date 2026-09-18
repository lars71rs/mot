import { createServer } from 'node:http'
import { createReadStream, existsSync, readFileSync, statSync } from 'node:fs'
import { extname, resolve } from 'node:path'
import OpenAI from 'openai'
import {
  MINISTER_TOOLS,
  ingestSpendUtterance,
  runMinisterTool,
} from '../src/ministerTools.ts'
import type { AppState } from '../src/types.ts'

function loadEnv() {
  const p = resolve(process.cwd(), '.env')
  if (!existsSync(p)) return
  for (const line of readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim()
    if (!t || t.startsWith('#')) continue
    const i = t.indexOf('=')
    if (i < 1) continue
    const k = t.slice(0, i).trim()
    let v = t.slice(i + 1).trim()
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) {
      v = v.slice(1, -1)
    }
    if (!process.env[k]) process.env[k] = v
  }
}

loadEnv()

const PORT = Number(process.env.PORT || 8787)
const HOST = process.env.HOST || (process.env.NODE_ENV === 'production' ? '0.0.0.0' : '127.0.0.1')
const MODEL = process.env.XAI_MODEL || 'grok-4.5'
const DIST = resolve(process.cwd(), 'dist')
const SERVE_STATIC = process.env.NODE_ENV === 'production'

const MIME: Record<string, string> = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.png': 'image/png',
  '.ico': 'image/x-icon',
  '.webmanifest': 'application/manifest+json',
  '.txt': 'text/plain; charset=utf-8',
}

const SYSTEM = `Du er finansministeren i Mot — en app for unge voksne i Norge.
Jobben din: kartlegge hvor pengene faktisk går, og hjelpe dem å se vaner og uvaner.

Regler:
- Tone: konkret, uten skam. Ingen dagsgrense, ingen moralpreken, ingen emoji-regn.
- Tall i hele kroner. Norsk.
- Du har verktøy som styrer tavlen. Bruk dem. Ikke late som du har sett kontoen uten fil eller logg.
- Inn på konto (lønn) er ikke forbruk. Ikke sett lønn som vanlig månedsinntekt uten at brukeren sier at det er den faste inntekten.
- Når en bankfil kommer: les utgående, si hva du ser (største poster, mønster, hva som ser fast ut vs impuls), og hva som er grep om de vil.
- Når brukeren sier at de har brukt penger: kall add_expense for HVER post i DENNE runden. Uten det kallet er ingenting lagt inn. Si aldri at du har lagt inn uten at verktøyet er kjørt.
- Dato er valgfri; utelat den så brukes i dag.
- Kall get_board bare når du trenger oppdatert oversikt, ikke før hver add_expense.
- Kort. Pek på tre ting, ikke tretti.`

const client = new OpenAI({
  apiKey: process.env.XAI_API_KEY,
  baseURL: 'https://api.x.ai/v1',
  timeout: 60_000,
  maxRetries: 1,
})

function json(res: import('node:http').ServerResponse, status: number, body: unknown) {
  const data = JSON.stringify(body)
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
  })
  res.end(data)
}

function parseNow(raw?: string): Date {
  if (!raw) return new Date()
  const day = raw.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (day) return new Date(Number(day[1]), Number(day[2]) - 1, Number(day[3]), 12, 0, 0)
  const d = new Date(raw)
  return Number.isNaN(d.getTime()) ? new Date() : d
}

function parseArgs(raw: unknown): Record<string, unknown> {
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  if (typeof raw === 'string' && raw.trim()) {
    try {
      return JSON.parse(raw) as Record<string, unknown>
    } catch {
      return {}
    }
  }
  return {}
}

function extractCalls(response: OpenAI.Responses.Response): {
  name: string
  arguments: unknown
  call_id: string
}[] {
  const calls: { name: string; arguments: unknown; call_id: string }[] = []
  for (const item of response.output ?? []) {
    const rec = item as {
      type?: string
      name?: string
      arguments?: unknown
      call_id?: string
      id?: string
      function?: { name?: string; arguments?: unknown }
    }
    const isCall =
      rec.type === 'function_call' || rec.type === 'tool_call' || rec.type === 'custom_tool_call'
    if (!isCall) continue
    const name = rec.name || rec.function?.name
    if (!name) continue
    calls.push({
      name,
      arguments: rec.arguments ?? rec.function?.arguments ?? '{}',
      call_id: rec.call_id || rec.id || name,
    })
  }
  return calls
}

function outputText(response: OpenAI.Responses.Response): string {
  if (typeof response.output_text === 'string' && response.output_text.trim()) {
    return response.output_text
  }
  const parts: string[] = []
  for (const item of response.output ?? []) {
    if (item.type === 'message') {
      for (const c of item.content ?? []) {
        if ('text' in c && typeof c.text === 'string') parts.push(c.text)
      }
    }
  }
  return parts.join('\n').trim()
}

async function runMinister(body: {
  messages: { role: 'user' | 'assistant'; content: string }[]
  snapshot: AppState
  csv?: string
  now?: string
}) {
  if (!process.env.XAI_API_KEY) {
    throw new Error('Mangler XAI_API_KEY')
  }
  let state = body.snapshot
  const now = parseNow(body.now)
  const actions: string[] = []

  const lastUser = [...body.messages].reverse().find((m) => m.role === 'user')
  if (lastUser) {
    const ingested = ingestSpendUtterance(lastUser.content, state, now)
    if (ingested.added.length > 0) {
      state = ingested.state
      actions.push(...ingested.added.map(() => 'add_expense'))
    }
  }

  const board = runMinisterTool('get_board', {}, state, now).result
  const input: OpenAI.Responses.ResponseInput = [
    {
      role: 'system',
      content: `${SYSTEM}\n\nTavlen nå (sannhet): ${JSON.stringify(board)}`,
    },
    ...body.messages.map((m) => ({ role: m.role, content: m.content })),
  ]

  if (lastUser && actions.includes('add_expense')) {
    input.push({
      role: 'user',
      content:
        'Utgiftene i siste melding er allerede lagt inn på tavlen. Ikke kall add_expense for dem på nytt. Kommenter det som står der.',
    })
  }

  if (body.csv && body.csv.trim()) {
    const imported = runMinisterTool('import_bank_csv', { csv: body.csv }, state, now)
    state = imported.state
    actions.push('import_bank_csv')
    input.push({
      role: 'user',
      content: `Jeg dumpet måneden som bankfil. Importresultat: ${JSON.stringify(imported.result)}. Les tavlen og si hva du ser.`,
    })
  }

  let response = await client.responses.create({
    model: MODEL,
    input,
    tools: MINISTER_TOOLS,
  })

  for (let step = 0; step < 5; step++) {
    const calls = extractCalls(response)
    if (calls.length === 0) break
    const outputs: OpenAI.Responses.ResponseInput = []
    for (const call of calls) {
      const args = parseArgs(call.arguments)
      const ran = runMinisterTool(call.name, args, state, now)
      state = ran.state
      actions.push(call.name)
      outputs.push({
        type: 'function_call_output',
        call_id: call.call_id,
        output: JSON.stringify(ran.result),
      })
    }
    response = await client.responses.create({
      model: MODEL,
      input: outputs,
      tools: MINISTER_TOOLS,
      previous_response_id: response.id,
    })
  }

  return {
    text: outputText(response) || 'Tavlen er oppdatert.',
    snapshot: state,
    actions,
  }
}

const server = createServer(async (req, res) => {
  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
    })
    res.end()
    return
  }

  const url = req.url ?? '/'
  if (req.method === 'GET' && (url === '/api/health' || url === '/health')) {
    json(res, 200, { ok: true, hasKey: Boolean(process.env.XAI_API_KEY), model: MODEL })
    return
  }

  if (req.method === 'POST' && url === '/api/minister') {
    const chunks: Buffer[] = []
    for await (const c of req) chunks.push(c as Buffer)
    let body: {
      messages?: { role: 'user' | 'assistant'; content: string }[]
      snapshot?: AppState
      csv?: string
      now?: string
    }
    try {
      body = JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}') as typeof body
    } catch {
      json(res, 400, { error: 'Ugyldig JSON' })
      return
    }
    if (!body.snapshot || !Array.isArray(body.messages)) {
      json(res, 400, { error: 'Mangler snapshot eller messages' })
      return
    }
    try {
      const out = await runMinister({
        messages: body.messages,
        snapshot: body.snapshot,
        csv: body.csv,
        now: body.now,
      })
      json(res, 200, out)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Ukjent feil'
      json(res, 500, { error: msg })
    }
    return
  }

  if (SERVE_STATIC && req.method === 'GET' && serveStatic(req.url ?? '/', res)) return

  json(res, 404, { error: 'Ikke funnet' })
})

function serveStatic(url: string, res: import('node:http').ServerResponse): boolean {
  const pathOnly = decodeURIComponent(url.split('?')[0] || '/')
  const rel = pathOnly === '/' ? '/index.html' : pathOnly
  const file = resolve(DIST, `.${rel}`)
  if (!file.startsWith(DIST)) return false
  const send = (target: string, status: number) => {
    const type = MIME[extname(target)] || 'application/octet-stream'
    res.writeHead(status, { 'Content-Type': type })
    createReadStream(target).pipe(res)
  }
  if (existsSync(file) && statSync(file).isFile()) {
    send(file, 200)
    return true
  }
  const index = resolve(DIST, 'index.html')
  if (existsSync(index)) {
    send(index, 200)
    return true
  }
  return false
}

server.timeout = 180_000
server.listen(PORT, HOST, () => {
  console.log(`minister http://${HOST}:${PORT} model=${MODEL} static=${SERVE_STATIC}`)
})
