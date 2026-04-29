import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:5176/';
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

async function clickButton(text, force = false) {
  try {
    const btn = page.locator(`button:has-text("${text}")`).first();
    if (await btn.count() > 0) {
      await btn.click({ force, timeout: 5000 });
      return true;
    }
  } catch(e) {
    console.log(`  [WARN] Could not click: ${text}`);
  }
  return false;
}

async function findAndClickMenuItem(text) {
  // Try menu bar items first
  try {
    const menuBtn = page.locator(`button:has-text("${text}")`).first();
    if (await menuBtn.count() > 0) {
      await menuBtn.click({ force: true, timeout: 3000 });
      return true;
    }
  } catch(e) {}
  return false;
}

async function main() {
  page = await setup();
  console.log('[TEST] World Generator QA Test Starting...\n');

  // ============================================================
  // PHASE 1 - FIRST IMPRESSION
  // ============================================================
  console.log('='.repeat(60));
  console.log('PHASE 1: FIRST IMPRESSION');
  console.log('='.repeat(60));

  const title = await page.title();
  console.log(`  Title: ${title}`);

  // Check main layout
  const panels = await page.locator('[class*="panel"]').count();
  const buttons = await page.locator('button').count();
  console.log(`  Panels: ${panels}, Buttons: ${buttons}`);

  // Get all button texts
  const allButtons = await page.locator('button').allInnerTexts();
  console.log(`  All buttons: ${allButtons.join(', ')}`);

  await screenshot('01-initial-state');

  // ============================================================
  // PHASE 2 - MENU BAR / TOOLS DISCOVERY
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 2: MENU AND TOOL DISCOVERY');
  console.log('='.repeat(60));

  // Check File menu
  const fileBtn = page.locator('button:has-text("File")').first();
  if (await fileBtn.count() > 0) {
    await fileBtn.click();
    await page.waitForTimeout(500);
    const menuItems = await page.locator('[class*="menu"] button, [class*="dropdown"] button').allInnerTexts();
    console.log(`  File menu items: ${menuItems.slice(0, 10).join(', ')}`);
    await screenshot('02-file-menu');
    // Click away to close
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // Check Edit menu
  const editBtn = page.locator('button:has-text("Edit")').first();
  if (await editBtn.count() > 0) {
    await editBtn.click();
    await page.waitForTimeout(500);
    const menuItems = await page.locator('[class*="menu"] button, [class*="dropdown"] button').allInnerTexts();
    console.log(`  Edit menu items: ${menuItems.slice(0, 10).join(', ')}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // Check View menu
  const viewBtn = page.locator('button:has-text("View")').first();
  if (await viewBtn.count() > 0) {
    await viewBtn.click();
    await page.waitForTimeout(500);
    const menuItems = await page.locator('[class*="menu"] button, [class*="dropdown"] button').allInnerTexts();
    console.log(`  View menu items: ${menuItems.slice(0, 10).join(', ')}`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }

  // Click "New" to start fresh
  await clickButton('New', true);
  await page.waitForTimeout(2000);
  console.log('  Created new project');
  await screenshot('03-after-new');

  // ============================================================
  // PHASE 3 - TOOLBAR DISCOVERY
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 3: TOOLBAR DISCOVERY');
  console.log('='.repeat(60));

  // Look for toolbar buttons
  const toolbar = page.locator('[class*="toolbar"], [class*="toolbox"]').first();
  if (await toolbar.count() > 0) {
    const toolbarBtns = await toolbar.locator('button').allInnerTexts();
    console.log(`  Toolbar buttons: ${toolbarBtns.join(', ')}`);
  }

  // Look for tool buttons by content
  const toolKeywords = ['Terrain', 'Sculpt', 'Paint', 'Road', 'Track', 'Foliage', 'Scatter', 'Object', 'Asset', 'Marker', 'Select', 'Move', 'Rotate', 'Scale'];
  for (const kw of toolKeywords) {
    const btns = page.locator(`button:has-text("${kw}")`);
    if (await btns.count() > 0) {
      console.log(`  Found: ${kw} (${await btns.count()} instances)`);
    }
  }

  // ============================================================
  // PHASE 4 - TERRAIN TOOL TEST
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 4: TERRAIN SCULPTING');
  console.log('='.repeat(60));

  // Try Terrain button
  await clickButton('Terrain', true);
  await page.waitForTimeout(1000);
  console.log('  Clicked Terrain button');
  await screenshot('04-terrain-mode');

  // Check for brush controls now visible
  const sliders = await page.locator('input[type="range"]').count();
  console.log(`  Sliders/controls visible: ${sliders}`);

  // Try brush on canvas
  const canvas = await page.$('canvas');
  if (canvas) {
    const box = await canvas.boundingBox();
    if (box) {
      console.log(`  Canvas size: ${box.width}x${box.height}`);

      // Try to raise terrain
      await page.mouse.move(box.x + box.width/2, box.y + box.height/2);
      await page.mouse.down();
      await page.waitForTimeout(300);
      await page.mouse.move(box.x + box.width/2 + 30, box.y + box.height/2 + 30, { steps: 5 });
      await page.mouse.up();
      console.log('  Drew raise brush stroke');
      await page.waitForTimeout(500);

      await screenshot('05-after-raise');
    }
  }

  // ============================================================
  // PHASE 5 - MATERIAL PAINT
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 5: MATERIAL PAINTING');
  console.log('='.repeat(60));

  await clickButton('Paint', true);
  await page.waitForTimeout(1000);
  console.log('  Entered paint mode');
  await screenshot('06-paint-mode');

  // Look for color/material swatches
  const swatches = await page.locator('[class*="swatch"], [class*="color"]').count();
  console.log(`  Material swatches found: ${swatches}`);

  // ============================================================
  // PHASE 6 - ROAD TOOL
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 6: ROAD/TRACK CREATION');
  console.log('='.repeat(60));

  await clickButton('Road', true);
  await page.waitForTimeout(1000);
  console.log('  Entered road mode');
  await screenshot('07-road-mode');

  // ============================================================
  // PHASE 7 - FOLIAGE
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 7: FOLIAGE TOOL');
  console.log('='.repeat(60));

  await clickButton('Foliage', true);
  await page.waitForTimeout(1000);
  console.log('  Entered foliage mode');
  await screenshot('08-foliage-mode');

  // ============================================================
  // PHASE 8 - ASSETS
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 8: ASSETS');
  console.log('='.repeat(60));

  await clickButton('Asset', true);
  await page.waitForTimeout(1000);
  console.log('  Opened asset panel');
  await screenshot('09-assets');

  // ============================================================
  // PHASE 9 - LAYERS
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 9: LAYERS');
  console.log('='.repeat(60));

  await clickButton('Layer', true);
  await page.waitForTimeout(1000);
  console.log('  Opened layers panel');
  await screenshot('10-layers');

  // ============================================================
  // PHASE 10 - JSON PANEL
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 10: JSON PANEL');
  console.log('='.repeat(60));

  await clickButton('JSON', true);
  await page.waitForTimeout(1000);
  console.log('  Opened JSON panel');
  await screenshot('11-json');

  // Check JSON content
  const jsonContent = await page.locator('[class*="json"], [class*="code"], pre').first().innerText().catch(() => '');
  console.log(`  JSON content length: ${jsonContent.length}`);
  console.log(`  JSON preview: ${jsonContent.slice(0, 200)}...`);

  // ============================================================
  // PHASE 11 - SAVE/RELOAD
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 11: SAVE/RELOAD/EXPORT');
  console.log('='.repeat(60));

  // Try Save
  await clickButton('Save', true);
  await page.waitForTimeout(2000);
  console.log('  Saved project');
  await screenshot('12-saved');

  // Try Export
  await clickButton('Export', true);
  await page.waitForTimeout(2000);
  console.log('  Exported project');
  await screenshot('13-exported');

  // Try Play/Test
  await clickButton('Play', true);
  await page.waitForTimeout(3000);
  console.log('  Opened preview');
  await screenshot('14-preview');

  // Close preview
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);

  // ============================================================
  // FINAL
  // ============================================================
  await screenshot('99-final-state');

  console.log('\n[TEST] Testing complete.');
  console.log('Check test-results/ for screenshots.');
  console.log('\nBrowser staying open for manual review...');
  await page.waitForTimeout(30000);

  await browser.close();
}

main().catch(async (e) => {
  console.error('Test failed:', e.message);
  if (browser) await browser.close();
});