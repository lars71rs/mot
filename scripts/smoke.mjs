import { webkit } from 'playwright'
import { mkdir } from 'node:fs/promises'

const base = 'http://127.0.0.1:5173'
const out = new URL('../smoke', import.meta.url).pathname

await mkdir(out, { recursive: true })
const browser = await webkit.launch()
const context = await browser.newContext({
  viewport: { width: 1280, height: 800 },
  locale: 'nb-NO',
})
const page = await context.newPage()

async function shot(name) {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true })
}

await page.goto(base, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })
if (!(await page.getByRole('heading', { name: /finansministeren/i }).isVisible())) {
  throw new Error('Velkomst vises ikke')
}
await shot('01-welcome')

await page.goto(`${base}/?demo=1`, { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
const meetText = await page.locator('body').innerText()
if (!/finansminister/i.test(meetText) || !/tavlen/i.test(meetText)) {
  throw new Error(`Finansminister vises ikke:\n${meetText}`)
}
if (!/inntekt/i.test(meetText) || !/i lomma/i.test(meetText)) {
  throw new Error(`Tavlen mangler inntekt/i lomma:\n${meetText}`)
}
if (/i morgen/i.test(meetText) || /dagsgrense/i.test(meetText)) {
  throw new Error(`Gammel flate vises fortsatt:\n${meetText}`)
}
if (!(await page.locator('.sidebar').isVisible())) {
  throw new Error('Sidemeny vises ikke')
}
await shot('02-home-demo')

await page.getByRole('button', { name: 'Bankfil' }).click()
await page.waitForTimeout(200)
if (!(await page.getByRole('heading', { name: /dump en fil/i }).isVisible())) {
  throw new Error('Bankfil-skjermen vises ikke')
}
const csv = `Dato;Forklaring;Ut av konto;Inn på konto
17.09.2026;REMA 1000 TEST;89,00;
16.09.2026;Lønn;;27000,00
`
await page.locator('input[type="file"]').setInputFiles({
  name: 'dnb.csv',
  mimeType: 'text/csv',
  buffer: Buffer.from(csv),
})
await page.waitForTimeout(300)
const importText = await page.locator('body').innerText()
if (!/utgifter klare/i.test(importText) || !/innbetalinger hoppes over/i.test(importText)) {
  throw new Error(`CSV ble ikke lest:\n${importText}`)
}
await page.getByRole('button', { name: 'Legg inn i kartet' }).click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: 'Til oversikten' }).click()
await page.waitForTimeout(200)
const afterImport = await page.locator('body').innerText()
if (!/rema|mat/i.test(afterImport)) {
  throw new Error(`Import landet ikke på kartet:\n${afterImport}`)
}
await shot('02b-import')
await page.getByRole('button', { name: 'Tavlen' }).click()

await page.locator('.sidebar').getByRole('button', { name: 'Legg inn utgift' }).click()
await page.waitForTimeout(200)
const focused = await page
  .locator('.amount-field input')
  .evaluate((el) => el === document.activeElement)
if (!focused) throw new Error('Beløp har ikke tastaturet med en gang')
await shot('03-add-expense')
await page.locator('.amount-field input').fill('600')
await page.getByRole('button', { name: 'Fritid' }).click()
await page.getByRole('button', { name: 'Lagre' }).click()
await page.waitForTimeout(300)
const after = await page.locator('body').innerText()
if (!after.includes('600') && !after.includes('789')) {
  throw new Error(`Utgift oppdaterte ikke hjem:\n${after}`)
}
await shot('04-home-after-expense')

await page.getByRole('button', { name: 'Tavlen' }).click()
await page.waitForTimeout(200)
await page.getByRole('button', { name: 'Fritid' }).first().click()
await page.waitForTimeout(200)
if (!(await page.getByRole('heading', { name: 'Fritid' }).isVisible())) {
  throw new Error('Kategoriåpning feilet')
}
await shot('05-category')
await page.getByRole('button', { name: 'Tilbake' }).click()

await page.getByRole('button', { name: 'Oppsett', exact: true }).click()
await page.waitForTimeout(200)
await shot('06-settings')

await page.evaluate(() => localStorage.clear())
await page.goto(base, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Kom i gang' }).click()
await page.locator('.amount-field input').fill('32000')
await page.getByRole('button', { name: 'Neste' }).click()
await page.getByPlaceholder(/husleie/i).fill('Husleie')
await page.locator('.add-fixed .amount-field input').fill('9500')
await page.getByRole('button', { name: 'Legg til' }).click()
await page.getByRole('button', { name: 'Vis oversikten' }).click()
await page.waitForTimeout(300)
const afterOnboard = await page.locator('body').innerText()
if (!/finansminister/i.test(afterOnboard)) {
  throw new Error(`Onboarding landet ikke hos finansministeren:\n${afterOnboard}`)
}
await shot('07-home-after-onboard')

await browser.close()
console.log('SMOKE_OK')
