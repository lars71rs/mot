import { webkit } from 'playwright'
import { mkdir } from 'node:fs/promises'

const base = 'http://127.0.0.1:5173'
const out = new URL('../smoke', import.meta.url).pathname

await mkdir(out, { recursive: true })
const browser = await webkit.launch()
const context = await browser.newContext({
  viewport: { width: 390, height: 844 },
  locale: 'nb-NO',
})
const page = await context.newPage()

async function shot(name) {
  await page.screenshot({ path: `${out}/${name}.png`, fullPage: true })
}

await page.goto(base, { waitUntil: 'networkidle' })
await page.evaluate(() => localStorage.clear())
await page.reload({ waitUntil: 'networkidle' })
if (!(await page.getByRole('heading', { name: /hvor pengene går/i }).isVisible())) {
  throw new Error('Velkomst vises ikke')
}
await shot('01-welcome')

await page.goto(`${base}/?demo=1`, { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
const homeText = await page.locator('body').innerText()
if (!/brukt i/i.test(homeText)) {
  throw new Error(`Hjem mangler brukt denne måneden:\n${homeText}`)
}
if (!/inntekt/i.test(homeText) || !/faste/i.test(homeText)) {
  throw new Error(`Kartet mangler inntekt/faste:\n${homeText}`)
}
if (!/mat/i.test(homeText) || !/fritid/i.test(homeText)) {
  throw new Error(`Kategorier mangler:\n${homeText}`)
}
if (/i morgen/i.test(homeText) || /dagsgrense/i.test(homeText) || /budsjett/i.test(homeText)) {
  throw new Error(`Gammel flate vises fortsatt:\n${homeText}`)
}
await shot('02-home-demo')

await page.getByRole('button', { name: 'Legg inn utgift' }).click()
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
if (!/brukt i/i.test(afterOnboard)) {
  throw new Error(`Onboarding landet ikke på kartet:\n${afterOnboard}`)
}
await shot('07-home-after-onboard')

await browser.close()
console.log('SMOKE_OK')
