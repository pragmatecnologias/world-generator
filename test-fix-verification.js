import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5173/';
let browser;
let page;

async function setup() {
  browser = await chromium.launch({ headless: false });
  page = await browser.newPage();
  page.on('console', msg => {
    if (msg.type() === 'error') console.log(`[CONSOLE ERROR] ${msg.text()}`);
  });
  page.on('pageerror', err => console.log(`[PAGE ERROR] ${err.message}`));
  await page.goto(BASE_URL);
  await page.waitForTimeout(3000);
  return page;
}

async function screenshot(name) {
  await page.screenshot({ path: `/Users/admin/CascadeProjects/pocs/world-generator/test-results/${name}.png` });
  console.log(`  [SCREENSHOT] ${name}`);
}

async function clickButton(text) {
  try {
    const btn = page.locator(`button:has-text("${text}")`).first();
    if (await btn.count() > 0) {
      await btn.click({ force: true, timeout: 5000 });
      return true;
    }
  } catch(e) {}
  return false;
}

async function getJsonContent() {
  try {
    const pre = await page.locator('pre').first();
    if (await pre.count() > 0) {
      return await pre.innerText();
    }
  } catch(e) {}
  return '';
}

async function main() {
  page = await setup();
  console.log('[TEST] World Generator - Post-Fix QA Test\n');

  // Create new project
  await clickButton('New');
  await page.waitForTimeout(2000);
  await screenshot('fix-01-new-project');

  // Test JSON panel now shows WorldDocument
  await clickButton('json');
  await page.waitForTimeout(1000);
  await screenshot('fix-02-json-panel');

  const jsonContent = await getJsonContent();
  console.log(`  JSON content length: ${jsonContent.length}`);
  const hasWorldDoc = jsonContent.includes('"terrain"') || jsonContent.includes('"layers"') || jsonContent.includes('"materials"');
  console.log(`  Shows WorldDocument: ${hasWorldDoc}`);
  if (hasWorldDoc) {
    console.log(`  JSON preview: ${jsonContent.slice(0, 300)}...`);
  }

  // Test Layers panel
  await clickButton('layers');
  await page.waitForTimeout(1000);
  await screenshot('fix-03-layers-panel');

  const layerItems = await page.locator('[class*="list-item"]').count();
  console.log(`  Layer items found: ${layerItems}`);

  // Test Material painting - click Paint button
  await clickButton('Paint');
  await page.waitForTimeout(1000);
  await screenshot('fix-04-paint-mode');

  const swatches = await page.locator('[class*="swatch"]').count();
  console.log(`  Material swatches: ${swatches}`);

  // Test terrain sculpting
  await clickButton('Terrain');
  await page.waitForTimeout(500);
  await clickButton('Raise');
  await page.waitForTimeout(300);

  const canvas = await page.$('canvas');
  if (canvas) {
    const box = await canvas.boundingBox();
    if (box) {
      // Draw terrain
      for (let i = 0; i < 5; i++) {
        await page.mouse.move(box.x + box.width/2 + i*15, box.y + box.height/2 + i*15);
        await page.mouse.down();
        await page.waitForTimeout(100);
        await page.mouse.move(box.x + box.width/2 + i*15 + 30, box.y + box.height/2 + i*15 + 30, { steps: 5 });
        await page.mouse.up();
        await page.waitForTimeout(100);
      }
    }
  }
  console.log('  Drew terrain');
  await screenshot('fix-05-terrain-drawn');

  // Save
  await clickButton('Save');
  await page.waitForTimeout(2000);
  console.log('  Saved project');
  await screenshot('fix-06-saved');

  // Reload and check persistence
  await page.reload();
  await page.waitForTimeout(3000);
  console.log('  Reloaded');

  // Check JSON panel again
  await clickButton('json');
  await page.waitForTimeout(1000);
  const jsonAfter = await getJsonContent();
  const hasLayersAfter = jsonAfter.includes('"layers"');
  console.log(`  JSON has layers after reload: ${hasLayersAfter}`);
  await screenshot('fix-07-after-reload');

  // Test Export
  await clickButton('Export');
  await page.waitForTimeout(2000);
  console.log('  Exported');
  await screenshot('fix-08-exported');

  console.log('\n[TEST] Post-fix test complete.');
  await page.waitForTimeout(30000);
  await browser.close();
}

main().catch(async (e) => {
  console.error('Test failed:', e.message);
  if (browser) await browser.close();
});