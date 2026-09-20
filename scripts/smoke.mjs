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
if (!(await page.getByRole('heading', { name: /slik starter du/i }).isVisible())) {
  throw new Error('Velkomst vises ikke')
}
const welcome = await page.locator('body').innerText()
if (!/forrige kalendermåned/i.test(welcome) || !/filstien/i.test(welcome)) {
  throw new Error(`Manual mangler steg:\n${welcome}`)
}
await shot('01-welcome')

await page.goto(`${base}/?demo=1`, { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
const homeText = await page.locator('body').innerText()
if (!/kartet/i.test(homeText) || !/finansminister/i.test(homeText)) {
  throw new Error(`Sidemeny vises ikke:\n${homeText}`)
}
if (!/du har igjen/i.test(homeText) || !/inntekter/i.test(homeText) || !/transaksjoner/i.test(homeText)) {
  throw new Error(`Kartet mangler felt:\n${homeText}`)
}
if (/dagsgrense/i.test(homeText)) {
  throw new Error(`Gammel flate vises fortsatt:\n${homeText}`)
}
if (!(await page.locator('.sidebar').isVisible())) {
  throw new Error('Sidemeny vises ikke')
}
await shot('02-home-demo')

await page.getByRole('button', { name: '+ Ny' }).click()
await page.waitForTimeout(200)
const focused = await page
  .locator('.amount-field input')
  .evaluate((el) => el === document.activeElement)
if (!focused) throw new Error('Beløp har ikke tastaturet med en gang')
await shot('03-add-expense')
await page.locator('.amount-field input').fill('600')
await page.getByRole('button', { name: 'Underholdning' }).click()
await page.getByRole('button', { name: 'Lagre' }).click()
await page.waitForTimeout(300)
const after = await page.locator('body').innerText()
if (!after.includes('600')) {
  throw new Error(`Utgift oppdaterte ikke kartet:\n${after}`)
}
await shot('04-home-after-expense')

await page.getByRole('button', { name: 'Underholdning' }).first().click()
await page.waitForTimeout(200)
if (!(await page.getByRole('heading', { name: 'Underholdning' }).isVisible())) {
  throw new Error('Kategoriåpning feilet')
}
await shot('05-category')
await page.getByRole('button', { name: 'Tilbake' }).click()

await page.getByRole('button', { name: 'Finansminister' }).click()
await page.waitForTimeout(200)
const meetText = await page.locator('body').innerText()
if (!/kontoutskrift/i.test(meetText)) {
  throw new Error(`Ministeren ber ikke om dump:\n${meetText}`)
}
await shot('06-meet')

await page.getByRole('button', { name: 'Oppsett', exact: true }).click()
await page.waitForTimeout(200)
await shot('07-settings')

await page.evaluate(() => localStorage.clear())
await page.goto(base, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Kom i gang' }).click()
await page.locator('#mot-name').fill('Ada')
await page.locator('#mot-year').fill('2001')
await page.getByRole('button', { name: 'Videre til ministeren' }).click()
await page.waitForTimeout(300)
const afterOnboard = await page.locator('body').innerText()
if (!/finansminister/i.test(afterOnboard) || !/ada/i.test(afterOnboard)) {
  throw new Error(`Onboarding landet ikke hos finansministeren:\n${afterOnboard}`)
}
await shot('08-home-after-onboard')

await browser.close()
console.log('SMOKE_OK')
