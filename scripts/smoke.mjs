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
if (!(await page.getByRole('heading', { name: /uten å ødelegge målet/i }).isVisible())) {
  throw new Error('Velkomst vises ikke')
}
await shot('01-welcome')

await page.goto(`${base}/?demo=1`, { waitUntil: 'networkidle' })
await page.waitForTimeout(300)
const homeText = await page.locator('body').innerText()
if (!homeText.includes('469')) {
  throw new Error(`Demo-dagsgrense 469 vises ikke:\n${homeText}`)
}
if (!/i morgen/i.test(homeText)) {
  throw new Error(`I MORGEN vises ikke:\n${homeText}`)
}
if (!/denne måneden/i.test(homeText) || !/mot målet/i.test(homeText)) {
  throw new Error(`Hjem mangler måneds- eller mållinje:\n${homeText}`)
}
if (!/i rute/i.test(homeText)) {
  throw new Error(`Status I rute vises ikke:\n${homeText}`)
}
if (/du har brukt/i.test(homeText) || /du ligger/i.test(homeText)) {
  throw new Error('Konsekvenslinje vises i rute')
}
await shot('02-home-demo')

await page.getByRole('button', { name: 'Budsjett', exact: true }).click()
await page.waitForTimeout(200)
const budgetText = await page.locator('body').innerText()
if (!/fri pott/i.test(budgetText) || !/469/.test(budgetText)) {
  throw new Error(`Budsjett mangler fri pott / dagsgrense:\n${budgetText}`)
}
if (!/mat/i.test(budgetText) || !/fritid/i.test(budgetText)) {
  throw new Error(`Budsjettposter mangler:\n${budgetText}`)
}
if (/går for fort/i.test(budgetText) || /er tom/i.test(budgetText)) {
  throw new Error(`Avvikslinje vises i rute:\n${budgetText}`)
}
await shot('02b-budget')
await page.getByRole('button', { name: 'Endre plan Mat' }).click()
const matPlan = page.locator('input[aria-label="Plan Mat"]')
await matPlan.fill('8000')
await matPlan.blur()
await page.waitForTimeout(200)
const afterEdit = await page.locator('body').innerText()
if (!/fordelingen går ikke opp/i.test(afterEdit) || !/for mye/i.test(afterEdit)) {
  throw new Error(`Ugyldig sum ble ikke flagget:\n${afterEdit}`)
}
if (!afterEdit.includes('8') || !afterEdit.includes('000')) {
  throw new Error(`Redigert plan ble ikke gjeldende:\n${afterEdit}`)
}
await shot('02c-budget-edit')
await page.getByRole('button', { name: 'Hjem', exact: true }).click()
await page.waitForTimeout(100)
await page.getByRole('button', { name: 'Budsjett', exact: true }).click()
await page.waitForTimeout(200)
const afterReturn = await page.locator('body').innerText()
if (!afterReturn.includes('8') || !/fordelingen går ikke opp/i.test(afterReturn)) {
  throw new Error(`Brukerens budsjett ble overskrevet:\n${afterReturn}`)
}
await page.getByRole('button', { name: 'Hjem', exact: true }).click()
await page.waitForTimeout(200)

await page.getByRole('button', { name: 'Legg inn utgift' }).click()
await page.waitForTimeout(200)
const focused = await page.locator('.amount-field input').evaluate((el) => el === document.activeElement)
if (!focused) {
  throw new Error('Beløp har ikke tastaturet med en gang')
}
if (await page.locator('input[type="date"]').count()) {
  throw new Error('Dato skal være i dag, uten velger')
}
await shot('03-add-expense')
await page.locator('.amount-field input').fill('600')
await page.getByRole('button', { name: 'Fritid' }).click()
await page.getByRole('button', { name: 'Lagre' }).click()
await page.waitForTimeout(300)
const overText = await page.locator('body').innerText()
if (!/over i dag/i.test(overText)) {
  throw new Error(`Status Over i dag mangler:\n${overText}`)
}
if (!/du har brukt/i.test(overText) || !/i morgen blir/i.test(overText)) {
  throw new Error(`Konsekvenslinje mangler:\n${overText}`)
}
if (!/denne utgiften/i.test(overText) || !/hvis alle dager/i.test(overText)) {
  throw new Error(`A/B-tall mangler:\n${overText}`)
}
if (/hvis du fortsetter/i.test(overText)) {
  throw new Error(`Fortsett-setningen er ikke skilt ut:\n${overText}`)
}
await shot('04-home-over')

await page.getByRole('button', { name: 'Slett' }).click()
await page.waitForTimeout(200)
const afterDelete = await page.locator('body').innerText()
if (!/i rute/i.test(afterDelete)) {
  throw new Error(`Slett reverserte ikke status:\n${afterDelete}`)
}
if (!afterDelete.includes('469')) {
  throw new Error(`Slett reverserte ikke dagsgrensen:\n${afterDelete}`)
}
if (/over i dag/i.test(afterDelete)) {
  throw new Error('Over i dag henger igjen etter slett')
}

await page.getByRole('button', { name: 'Mål', exact: true }).click()
await page.waitForTimeout(200)
if (!(await page.getByRole('heading', { name: /aktivt mål/i }).isVisible())) {
  throw new Error('Målliste vises ikke')
}
const goalsText = await page.locator('body').innerText()
if (!/av/.test(goalsText) || !/25/.test(goalsText) || !/300/.test(goalsText)) {
  throw new Error(`Kortet mangler spart av totalt:\n${goalsText}`)
}
await shot('05-goals')
await page.locator('.goal-main').first().click()
await page.waitForTimeout(200)
if (!(await page.getByRole('heading', { name: /rediger mål/i }).isVisible())) {
  throw new Error('Trykk på mål åpnet ikke redigering')
}
const nameField = page.locator('.field').filter({ hasText: 'Navn' }).locator('input')
if ((await nameField.count()) === 0) {
  throw new Error('Navn-felt mangler i redigering')
}
const savedInput = page.locator('.field').filter({ hasText: 'Allerede spart' }).locator('input')
await savedInput.fill('40000')
await page.getByRole('button', { name: 'Lagre mål' }).click()
await page.waitForTimeout(300)
const afterSave = await page.locator('body').innerText()
if (!/40/.test(afterSave) || !/i dag/i.test(afterSave)) {
  throw new Error(`Lagre landet ikke på oppdatert hjem:\n${afterSave}`)
}
await shot('05b-home-after-goal-edit')

await page.getByRole('button', { name: 'Mål', exact: true }).click()
await page.locator('.goal-main').first().click()
await page.locator('.field').filter({ hasText: 'År' }).locator('input').fill('')
await page.locator('.field').filter({ hasText: 'Måneder' }).locator('input').fill('6')
await page.waitForTimeout(100)
const editWarn = await page.locator('body').innerText()
if (!/planen går ikke opp/i.test(editWarn)) {
  throw new Error(`Redigering mangler «Planen går ikke opp»:\n${editWarn}`)
}
await shot('05c-goal-impossible')
await page.getByRole('button', { name: 'Lagre mål' }).click()
await page.waitForTimeout(300)
const afterImpossible = await page.locator('body').innerText()
if (!/planen går ikke opp/i.test(afterImpossible)) {
  throw new Error(`Hjem mangler «Planen går ikke opp»:\n${afterImpossible}`)
}
if (!/\b0 kr\b/i.test(afterImpossible) && !afterImpossible.includes('\n0\n') && !/i dag[\s\S]*0/.test(afterImpossible.toLowerCase())) {
  throw new Error(`Dagsgrense ble ikke 0:\n${afterImpossible}`)
}
await shot('05d-home-impossible')

await page.getByRole('button', { name: 'Mål', exact: true }).click()
await page.getByRole('button', { name: 'Nytt mål' }).click()
await page.waitForTimeout(200)
await shot('06-goal-edit')
await page.getByRole('button', { name: 'Tilbake' }).click()
await page.waitForTimeout(200)

await page.getByRole('button', { name: 'Oppsett' }).click()
await page.waitForTimeout(200)
await shot('07-settings')

await page.evaluate(() => localStorage.clear())
await page.goto(base, { waitUntil: 'networkidle' })
await page.getByRole('button', { name: 'Kom i gang' }).click()
await page.locator('.amount-field input').fill('32000')
await page.getByRole('button', { name: 'Neste' }).click()
await page.getByPlaceholder(/husleie/i).fill('Husleie')
await page.locator('.add-fixed .amount-field input').fill('9500')
await page.getByRole('button', { name: 'Legg til' }).click()
await shot('08-fixed')
await page.getByRole('button', { name: 'Vis dagsgrensen' }).click()
await page.waitForTimeout(300)
const afterOnboard = await page.locator('body').innerText()
if (!/i dag/i.test(afterOnboard) || !/750/.test(afterOnboard)) {
  throw new Error(`Onboarding landet ikke på hjem:\n${afterOnboard}`)
}
await shot('09-home-after-onboard')

await browser.close()
console.log('SMOKE_OK')
