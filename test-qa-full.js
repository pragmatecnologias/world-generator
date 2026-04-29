import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const BASE_URL = 'http://localhost:5176/';
let browser;
let page;

const SCREENSHOT_DIR = '/Users/admin/CascadeProjects/pocs/world-generator/test-results';

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
  const p = `${SCREENSHOT_DIR}/${name}.png`;
  await page.screenshot({ path: p });
  console.log(`  [SCREENSHOT] ${name}`);
  return p;
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

async function getJsonPanel() {
  // Find JSON panel content
  const jsonEl = await page.locator('pre, [class*="json"], [class*="code"]').first();
  if (jsonEl) {
    return await jsonEl.innerText().catch(async () => {
      // Try to get from CodeMirror or Monaco
      const editor = await page.locator('.cm-content, .monaco-editor').first();
      return editor.innerText().catch(() => '');
    });
  }
  return '';
}

// ============================================================
// TEST START
// ============================================================
async function main() {
  page = await setup();
  console.log('[TEST] World Generator - FULL QA TEST\n');

  // CREATE THE WORLD
  const FRICTION_LOG = [];
  const BUGS = [];
  let step = 0;

  function log(stepNum, action, expected, actual, level, note) {
    FRICTION_LOG.push({ step: stepNum, action, expected, actual, level, note });
  }

  // ============================================================
  // PHASE 1 - FIRST IMPRESSION
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 1: FIRST IMPRESSION');
  console.log('='.repeat(60));

  const title = await page.title();
  console.log(`  Title: ${title}`);

  // Get all buttons
  const allButtons = await page.locator('button').allInnerTexts();
  console.log(`  Tool buttons: ${allButtons.slice(0, 30).join(', ')}`);

  await screenshot('01-initial-state');

  // Does UI make sense immediately?
  const hasNew = allButtons.includes('New');
  const hasSave = allButtons.includes('Save');
  const hasUndo = allButtons.includes('Undo');
  const hasToolbox = allButtons.some(b => ['Select', 'Raise', 'Lower', 'Smooth', 'Flatten', 'Paint'].includes(b));

  console.log(`  Has New: ${hasNew}, Save: ${hasSave}, Undo: ${hasUndo}`);
  console.log(`  Has terrain tools: ${hasToolbox}`);

  log(++step, 'First load', 'Understand how to create world', hasToolbox ? 'Toolbox visible with terrain tools' : 'Unclear next action', hasToolbox ? 'LOW' : 'MEDIUM', 'First 2 min observation');

  // ============================================================
  // PHASE 2 - NEW PROJECT
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 2: NEW PROJECT');
  console.log('='.repeat(60));

  await clickButton('New');
  await page.waitForTimeout(2000);
  await screenshot('02-new-project');
  console.log('  Created new project');

  // ============================================================
  // PHASE 3 - TERRAIN SCULPTING
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 3: TERRAIN SCULPTING');
  console.log('='.repeat(60));

  // Click Terrain tool
  await clickButton('Terrain');
  await page.waitForTimeout(500);

  // Check for sub-tools: Raise, Lower, Smooth, Flatten
  const subTools = await page.locator('button:has-text("Raise"), button:has-text("Lower"), button:has-text("Smooth"), button:has-text("Flatten")').allInnerTexts();
  console.log(`  Sub-tools: ${subTools.join(', ')}`);

  // Try Raise
  await clickButton('Raise');
  await page.waitForTimeout(300);

  // Get canvas
  const canvas = await page.$('canvas');
  const box = canvas ? await canvas.boundingBox() : null;

  if (box) {
    console.log(`  Canvas: ${box.width}x${box.height}`);

    // Draw a hill - multiple strokes
    const cx = box.x + box.width/2;
    const cy = box.y + box.height/2;

    for (let i = 0; i < 5; i++) {
      await page.mouse.move(cx + i*10, cy + i*10);
      await page.mouse.down();
      await page.waitForTimeout(100);
      await page.mouse.move(cx + i*10 + 40, cy + i*10 + 40, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(100);
    }
    console.log('  Drew hill strokes');
    await screenshot('03-hill-created');
  }

  // Try Lower (for valley)
  await clickButton('Lower');
  await page.waitForTimeout(300);

  if (box) {
    const cx = box.x + box.width/2 + 100;
    const cy = box.y + box.height/2 - 50;
    for (let i = 0; i < 5; i++) {
      await page.mouse.move(cx - i*10, cy + i*10);
      await page.mouse.down();
      await page.waitForTimeout(100);
      await page.mouse.move(cx - i*10 - 40, cy + i*10 + 40, { steps: 8 });
      await page.mouse.up();
      await page.waitForTimeout(100);
    }
    console.log('  Drew valley strokes');
    await screenshot('04-valley-created');
  }

  // Try Flatten
  await clickButton('Flatten');
  await page.waitForTimeout(300);

  if (box) {
    const cx = box.x + 200;
    const cy = box.y + 150;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.waitForTimeout(200);
    await page.mouse.move(cx + 80, cy, { steps: 8 });
    await page.mouse.up();
    console.log('  Drew flatten strokes');
    await screenshot('05-flatten-created');
  }

  // Test brush size/strength controls
  const sliders = await page.locator('input[type="range"]').count();
  console.log(`  Brush controls (sliders): ${sliders}`);

  // Test Undo
  await clickButton('Undo');
  await page.waitForTimeout(500);
  console.log('  Tested Undo');
  await screenshot('06-after-undo');

  // Test Redo
  await clickButton('Redo');
  await page.waitForTimeout(500);
  console.log('  Tested Redo');
  await screenshot('07-after-redo');

  log(++step, 'Terrain sculpting', 'Can raise, lower, flatten terrain', 'Tested all 3 operations', 'MEDIUM', 'Brush cursor may or may not be visible, hard to tell terrain update without visual feedback');

  // ============================================================
  // PHASE 4 - MATERIAL PAINTING
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 4: MATERIAL PAINTING');
  console.log('='.repeat(60));

  await clickButton('Paint');
  await page.waitForTimeout(1000);
  await screenshot('08-paint-mode');

  // Look for material palette/swatch panel
  const swatchCount = await page.locator('[class*="swatch"], [class*="material"]').count();
  console.log(`  Material swatches: ${swatchCount}`);

  // Check bottom tabs for materials
  const bottomTabs = await page.locator('button:has-text("assets"), button:has-text("layers"), button:has-text("scene")').allInnerTexts();
  console.log(`  Bottom tabs: ${bottomTabs.join(', ')}`);

  // Try to paint on terrain
  if (box) {
    const cx = box.x + box.width/3;
    const cy = box.y + box.height/3;
    await page.mouse.move(cx, cy);
    await page.mouse.down();
    await page.waitForTimeout(200);
    await page.mouse.move(cx + 60, cy + 60, { steps: 6 });
    await page.mouse.up();
    console.log('  Drew material stroke');
    await screenshot('09-material-painted');
  }

  log(++step, 'Material painting', 'Can paint terrain with 3+ materials', 'Attempted paint operation', 'HIGH', 'Cannot find material swatches - may be in different panel');

  // ============================================================
  // PHASE 5 - ROAD/TRACK CREATION
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 5: ROAD/TRACK CREATION');
  console.log('='.repeat(60));

  await clickButton('Road');
  await page.waitForTimeout(500);
  await screenshot('10-road-mode');

  // Look for road sub-tools
  const roadBtns = await page.locator('button:has-text("Draw"), button:has-text("New Road"), button:has-text("Clear")').allInnerTexts();
  console.log(`  Road controls: ${roadBtns.join(', ')}`);

  // Start road drawing
  await clickButton('Draw');
  await page.waitForTimeout(300);

  if (box) {
    // Draw a curved road
    const startX = box.x + 100;
    const startY = box.y + 200;
    await page.mouse.move(startX, startY);
    await page.mouse.down();
    await page.waitForTimeout(200);

    for (let i = 0; i < 10; i++) {
      await page.mouse.move(startX + i*25, startY - i*15, { steps: 5 });
      await page.waitForTimeout(150);
    }
    await page.mouse.up();
    console.log('  Drew road path');
    await screenshot('11-road-drawn');
  }

  // Add start/finish
  await clickButton('Add Start/Finish');
  await page.waitForTimeout(500);
  console.log('  Added start/finish marker');
  await screenshot('12-start-finish');

  // Add checkpoints
  for (let i = 0; i < 3; i++) {
    await clickButton('Add Checkpoint');
    await page.waitForTimeout(300);
  }
  console.log('  Added 3 checkpoints');
  await screenshot('13-checkpoints');

  log(++step, 'Road creation', 'Can draw curved road with start/finish + 3 checkpoints', 'Road drawn, markers added', 'MEDIUM', 'Road width/material controls not discovered');

  // ============================================================
  // PHASE 6 - FOLIAGE PAINTING
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 6: FOLIAGE PAINTING');
  console.log('='.repeat(60));

  await clickButton('Foliage');
  await page.waitForTimeout(1000);
  await screenshot('14-foliage-mode');

  // Look for foliage controls
  const foliageControls = await page.locator('button:has-text("Scatter Tool"), button:has-text("Clear Foliage")').allInnerTexts();
  console.log(`  Foliage controls: ${foliageControls.join(', ')}`);

  // Paint foliage on terrain
  if (box) {
    for (let i = 0; i < 5; i++) {
      const x = box.x + 150 + i*30;
      const y = box.y + 100 + i*20;
      await page.mouse.move(x, y);
      await page.mouse.down();
      await page.waitForTimeout(200);
      await page.mouse.move(x + 20, y + 20, { steps: 4 });
      await page.mouse.up();
      await page.waitForTimeout(100);
    }
    console.log('  Painted foliage strokes');
    await screenshot('15-foliage-painted');
  }

  log(++step, 'Foliage painting', 'Can paint 30+ foliage instances', 'Attempted foliage painting', 'HIGH', 'Cannot confirm count, need to check export');

  // ============================================================
  // PHASE 7 - SCATTER TOOL
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 7: SCATTER TOOL');
  console.log('='.repeat(60));

  await clickButton('Scatter Tool');
  await page.waitForTimeout(500);
  await screenshot('16-scatter-mode');

  // Look for scatter controls
  const scatterControls = await page.locator('button:has-text("Generate"), button:has-text("Apply")').allInnerTexts();
  console.log(`  Scatter controls: ${scatterControls.join(', ')}`);

  log(++step, 'Scatter tool', 'Can scatter 20+ rocks/props', 'Scatter tool opened', 'HIGH', 'Need to find how to define area and apply scatter');

  // ============================================================
  // PHASE 8 - ASSET IMPORT
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 8: ASSET IMPORT');
  console.log('='.repeat(60));

  await clickButton('Assets');
  await page.waitForTimeout(1000);
  await screenshot('17-assets-panel');

  // Look for import button
  const importBtn = await page.locator('button:has-text("Import")').first();
  if (await importBtn.count() > 0) {
    console.log('  Import button found');
    await screenshot('18-import-button');
  }

  // Use test asset if available
  await clickButton('Load Test GLTF Asset');
  await page.waitForTimeout(2000);
  console.log('  Attempted to load test asset');
  await screenshot('19-test-asset-loaded');

  log(++step, 'Custom asset import', 'Can import GLB/GLTF and place in world', 'Test asset loading attempted', 'HIGH', 'Cannot verify import pipeline works for real user files');

  // ============================================================
  // PHASE 9 - LAYERS
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 9: LAYERS');
  console.log('='.repeat(60));

  await clickButton('layers');
  await page.waitForTimeout(500);
  await screenshot('20-layers-panel');

  // Check layer count
  const layerItems = await page.locator('[class*="layer"]').count();
  console.log(`  Layer elements: ${layerItems}`);

  log(++step, 'Layer management', 'Can create 3+ layers, hide/lock/show', 'Layers panel opened', 'MEDIUM', 'Layer functionality not fully tested');

  // ============================================================
  // PHASE 10 - MARKERS
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 10: MARKERS');
  console.log('='.repeat(60));

  await clickButton('Markers');
  await page.waitForTimeout(500);
  await screenshot('21-markers-mode');

  log(++step, 'Marker placement', 'Can place and edit markers', 'Markers mode opened', 'LOW', 'Marker types/labels not tested');

  // ============================================================
  // PHASE 11 - JSON PANEL / DOCUMENT
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 11: JSON DOCUMENT');
  console.log('='.repeat(60));

  await clickButton('json');
  await page.waitForTimeout(1000);
  await screenshot('22-json-panel');

  // Get JSON content
  const jsonText = await getJsonPanel();
  console.log(`  JSON content length: ${jsonText.length}`);
  console.log(`  JSON preview: ${jsonText.slice(0, 300)}...`);

  // Check if WorldDocument structure is visible
  const hasWorldDoc = jsonText.includes('"terrain"') || jsonText.includes('"materials"') || jsonText.includes('"objects"');
  console.log(`  Has WorldDocument structure: ${hasWorldDoc}`);

  log(++step, 'JSON-driven architecture', 'WorldDocument is source of truth', hasWorldDoc ? 'World data in JSON' : 'JSON may be UI state only', 'HIGH', 'Need to verify UI changes update JSON and JSON changes update viewport');

  // ============================================================
  // PHASE 12 - SAVE / RELOAD / EXPORT
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 12: SAVE / RELOAD / EXPORT');
  console.log('='.repeat(60));

  // Save
  await clickButton('Save');
  await page.waitForTimeout(2000);
  console.log('  Saved project');
  await screenshot('23-saved');

  // Get JSON before reload
  const jsonBefore = await getJsonPanel();

  // Reload page
  await page.reload();
  await page.waitForTimeout(3000);
  console.log('  Reloaded page');

  // Get JSON after reload
  const jsonAfter = await getJsonPanel();
  const jsonMatch = jsonBefore === jsonAfter;
  console.log(`  JSON matches after reload: ${jsonMatch}`);
  await screenshot('24-after-reload');

  // Export
  await clickButton('Export');
  await page.waitForTimeout(2000);
  console.log('  Exported project');
  await screenshot('25-exported');

  log(++step, 'Save/Reload/Export', 'Project persists after save/reload, exports correctly', jsonMatch ? 'PASS' : 'JSON changed after reload', jsonMatch ? 'LOW' : 'HIGH', 'Need to check if export JSON matches saved state');

  // ============================================================
  // PHASE 13 - PREVIEW/RUNTIME
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 13: PREVIEW/RUNTIME');
  console.log('='.repeat(60));

  await clickButton('Play');
  await page.waitForTimeout(3000);
  console.log('  Opened preview');
  await screenshot('26-preview-mode');

  // Check preview elements
  const previewCanvas = await page.locator('canvas').count();
  console.log(`  Preview canvases: ${previewCanvas}`);

  // Close preview
  await page.keyboard.press('Escape');
  await page.waitForTimeout(1000);

  // Open PreviewApp
  await clickButton('Open Preview');
  await page.waitForTimeout(3000);
  console.log('  Opened PreviewApp');
  await screenshot('27-previewapp');

  log(++step, 'Preview/runtime', 'Preview mode renders exported world', 'Preview opened', 'MEDIUM', 'Need to verify visual match with editor');

  // ============================================================
  // PHASE 14 - VALIDATION
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('PHASE 14: VALIDATION');
  console.log('='.repeat(60));
  await clickButton('Validate');
  await page.waitForTimeout(2000);
  console.log('  Ran validation');
  await screenshot('28-validation');

  log(++step, 'Validation', 'Validation reports true state', 'Validation run', 'HIGH', 'Validation may report demo data works but user data broken');

  // ============================================================
  // FINAL REPORT
  // ============================================================
  console.log('\n' + '='.repeat(60));
  console.log('FINAL REPORT');
  console.log('='.repeat(60));

  console.log('\nFRICTION LOG:');
  console.table(FRICTION_LOG);

  console.log('\nBUGS:');
  console.table(BUGS);

  await screenshot('99-final-state');

  console.log('\n[TEST] Complete. Screenshots in test-results/');
  await page.waitForTimeout(30000);
  await browser.close();
}

main().catch(async (e) => {
  console.error('Test error:', e.message);
  if (browser) await browser.close();
});