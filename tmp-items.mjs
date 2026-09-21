import { extractTextItems, getDocumentProxy } from 'unpdf'
import { readFileSync } from 'fs'

const buf = readFileSync('/tmp/kontoutskrift.pdf')
const pdf = await getDocumentProxy(new Uint8Array(buf))
const items = await extractTextItems(pdf)
console.log(typeof items, Array.isArray(items))
const s = JSON.stringify(items)
console.log(s.slice(0, 2000))
