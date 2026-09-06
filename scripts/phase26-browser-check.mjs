import assert from 'node:assert/strict';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { chromium } from 'playwright-core';

const output = path.resolve('test-results/phase26');
const appUrl = process.env.PHASE26_APP_URL ?? 'http://localhost:4175/';
const referencePng = process.env.PHASE26_BACKGROUND_PNG ?? 'C:/Users/USER/Desktop/黄色ブラシ背景だけの透過PNG.png';
const photo = process.env.PHASE26_PHOTO ?? 'C:/Users/USER/Desktop/白フチ・黒フチ・影が理想に近い見本.png';
await mkdir(output, { recursive: true });
const browser = await chromium.launch({ executablePath: 'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe', headless: true });
const context = await browser.newContext({ viewport: { width: 1600, height: 1000 }, acceptDownloads: true });
const page = await context.newPage();
page.setDefaultTimeout(25000);
const results = [], screenshots = [], errors = [];
page.on('pageerror', (error) => errors.push(error.message));
const pause = (ms = 200) => page.waitForTimeout(ms);
const mark = (name, details = '') => { results.push({ name, status: 'PASS', details }); console.log('PASS ' + name); };
const toolbar = page.locator('.editor-toolbar');
const tab = (name) => page.getByRole('tab', { name, exact: true }).click();
const number = async (label, value) => { const el = page.getByLabel(label + 'の数値', { exact: true }); await el.fill(String(value)); await el.press('Enter'); await pause(); };
const color = async (label, value) => { const el = page.getByLabel(label + 'HEX値', { exact: true }); await el.fill(value); await el.blur(); await pause(); };
const toggle = async (label, enabled) => { const el = page.getByRole('switch', { name: label, exact: true }); if ((await el.getAttribute('aria-checked') === 'true') !== enabled) await el.click(); await pause(); };
const check = async (label, enabled) => { const el = page.getByRole('checkbox', { name: label, exact: true }); if ((await el.getAttribute('aria-checked') === 'true') !== enabled) await el.click(); };
const openStroke = async (index, partial = false) => { const el = page.locator(`[data-${partial ? 'partial-' : ''}stroke-layer="${index}"]`); if (await el.getAttribute('open') === null) await el.locator('summary').click(); };
const partialAction = (index, property, value) => page.getByLabel(`フチ${index}の${property}`, { exact: true }).selectOption(value);
const snap = async (name) => { await page.mouse.move(0, 0); await page.screenshot({ path: path.join(output, name + '.png') }); screenshots.push(name + '.png'); };
const download = async (action, name) => { const pending = page.waitForEvent('download'); await toolbar.locator(`[data-editor-action="${action}"]`).click(); const file = await pending; const target = path.join(output, name); await file.saveAs(target); return readFile(target); };
const template = async (name) => JSON.parse((await download('templateSave', name + '.json')).toString());
const load = async (value) => { await page.getByLabel('テンプレートJSONファイル', { exact: true }).setInputFiles({ name: 'phase26.json', mimeType: 'application/json', buffer: Buffer.from(JSON.stringify(value)) }); await pause(650); };
const text = async (value) => { await tab('テキスト'); const el = page.getByLabel('選択中のテキスト内容', { exact: true }); await el.fill(value); await el.blur(); await pause(); };
const range = async (start, end) => { await tab('テキスト'); const el = page.getByLabel('選択中のテキスト内容', { exact: true }); await el.focus(); await el.press('Control+Home'); for (let i = 0; i < start; i++) await el.press('ArrowRight'); for (let i = start; i < end; i++) await el.press('Shift+ArrowRight'); await pause(); };
const apply = async () => { await page.getByRole('button', { name: '選択範囲に適用', exact: true }).click(); await pause(350); };
const saved = () => page.evaluate(() => new Promise((resolve, reject) => { const open = indexedDB.open('text-graphic-studio'); open.onerror = () => reject(open.error); open.onsuccess = () => { const db = open.result; const tx = db.transaction('projects'); const req = tx.objectStore('projects').get('autosave'); tx.oncomplete = () => { db.close(); resolve(req.result); }; }; }));
const pixelDiff = (a, b) => page.evaluate(async ([a, b]) => {
  const decode = async (value) => { const im = new Image(); im.src = 'data:image/png;base64,' + value; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const ctx = c.getContext('2d'); ctx.drawImage(im, 0, 0); return { width: im.width, height: im.height, data: ctx.getImageData(0, 0, im.width, im.height).data }; };
  const x = await decode(a), y = await decode(b); if (x.width !== y.width || x.height !== y.height) return { sameSize: false, x: [x.width, x.height], y: [y.width, y.height] };
  let changed = 0, max = 0; for (let i = 0; i < x.data.length; i++) { const d = Math.abs(x.data[i] - y.data[i]); if (d) changed++; max = Math.max(max, d); } return { sameSize: true, changed, max };
}, [a.toString('base64'), b.toString('base64')]);
const pixelInfo = (buffer) => page.evaluate(async (base64) => {
  const im = new Image(); im.src = 'data:image/png;base64,' + base64; await im.decode(); const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const ctx = c.getContext('2d'); ctx.drawImage(im, 0, 0); const d = ctx.getImageData(0, 0, im.width, im.height).data;
  const counts = { red: 0, green: 0, blue: 0, yellow: 0, orange: 0, black: 0, white: 0 }; let minX=im.width,maxX=-1,minY=im.height,maxY=-1;
  for(let y=0;y<im.height;y++)for(let x=0;x<im.width;x++){const i=(y*im.width+x)*4, [r,g,b,a]=d.subarray(i,i+4);if(a>80){minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);}if(a<220)continue;
    if(r>180&&g<70&&b<70)counts.red++;if(g>150&&r<80&&b<80)counts.green++;if(b>180&&r<80&&g<80)counts.blue++;if(r>200&&g>180&&b<80)counts.yellow++;if(r>200&&g>60&&g<175&&b<80)counts.orange++;if(r<30&&g<30&&b<30)counts.black++;if(r>240&&g>240&&b>240)counts.white++;}
  return { width:im.width,height:im.height,bounds:{width:maxX-minX+1,height:maxY-minY+1},counts };
},buffer.toString('base64'));

try {
  await page.goto(appUrl, { waitUntil: 'networkidle' }); await page.locator('.startup-cover').waitFor({ state: 'hidden' }); await page.locator('canvas.upper-canvas').waitFor(); await pause(500);
  await tab('スタイル');
  assert.equal(await page.locator('.color-field .color-palette-chips').count(), 0);
  assert.equal(await page.locator('.color-picker-popover').count(), 0);
  mark('通常ColorFieldはスウォッチ＋HEX、6色は常時露出しない');
  await page.getByRole('button', { name:'文字色カラーピッカー',exact:true }).click();
  const chips = page.getByRole('group',{name:'文字色のパレット',exact:true}).getByRole('button');
  assert.equal(await chips.count(),6);
  const boxes = await chips.evaluateAll((els)=>els.map(el=>{const b=el.getBoundingClientRect();return {x:b.x,y:b.y,width:b.width,height:b.height};}));
  assert.ok(boxes.every(b=>Math.abs(b.y-boxes[0].y)<1&&b.width<=28));
  await chips.nth(2).click(); await snap('01-color-picker-popover');
  await page.getByRole('button',{name:'カラーピッカーを閉じる',exact:true}).click();
  assert.equal((await template('palette-picked')).fill.color,'#D10D18');
  mark('Popover内の横一列6色から即適用');
  const trigger=page.getByRole('button',{name:'文字色カラーピッカー',exact:true});await trigger.focus();await trigger.press('Enter');await page.locator('.color-picker-popover').waitFor();await page.keyboard.press('Escape');await pause();assert.equal(await trigger.evaluate(el=>el===document.activeElement),true);
  mark('キーボード開閉・Escape・focus復帰');
  for(let i=1;i<=3;i++){await openStroke(i);if(i===3)await toggle('フチ3を使用',true);await page.getByRole('button',{name:`フチ${i}の色カラーピッカー`,exact:true}).click();assert.equal(await page.getByRole('group',{name:`フチ${i}の色のパレット`,exact:true}).getByRole('button').count(),6);await page.keyboard.press('Escape');}
  await page.getByLabel('文字の塗り',{exact:true}).selectOption('linear-gradient');
  for(const label of ['開始色','終了色','影の色']){await page.getByRole('button',{name:label+'カラーピッカー',exact:true}).click();assert.equal(await page.getByRole('group',{name:label+'のパレット',exact:true}).getByRole('button').count(),6);await page.keyboard.press('Escape');}
  mark('フチ1/2/3・影・gradientに共通ColorPicker');
  const legacy=await template('before-legacy');delete legacy.strokes;legacy.stroke={enabled:true,color:'#123456',width:3};legacy.outerStroke={enabled:false,color:'#654321',width:8};
  await load(legacy);const migrated=await template('legacy-migrated');assert.deepEqual(migrated.strokes[0],legacy.stroke);assert.deepEqual(migrated.strokes[1],legacy.outerStroke);assert.equal(migrated.strokes[2].enabled,false);
  mark('旧stroke/outerStrokeの色・幅・ON/OFFをフチ1/2へ移行、3はOFF');
  await text('HH');await page.getByLabel('フォント',{exact:true}).selectOption('Arial');await number('文字サイズ',180);await number('グループの回転',0);
  await tab('背景');await page.getByLabel('背景タイプ',{exact:true}).selectOption('none');
  await tab('スタイル');await page.getByLabel('文字の塗り',{exact:true}).selectOption('solid');await color('文字色','#FFFF00');await toggle('影を使用',false);
  for(const [i,hex,w] of [[1,'#FF0000',3],[2,'#00CC00',6],[3,'#0000FF',4]]){await openStroke(i);await toggle(`フチ${i}を使用`,true);await color(`フチ${i}の色`,hex);await number(`フチ${i}の幅`,w);}
  const three=await template('three-strokes');assert.deepEqual(three.strokes.map(x=>x.width),[3,6,4]);
  const threePng=await download('exportSelected','three-strokes.png');const info=await pixelInfo(threePng);for(const k of ['red','green','blue','yellow'])assert.ok(info.counts[k]>100,JSON.stringify(info));await snap('02-three-strokes');
  mark('別色・別幅3層フチ、文字＋赤→緑→青を透明PNGへ出力',JSON.stringify(info));
  const scan=await page.evaluate(async b64=>{const im=new Image();im.src='data:image/png;base64,'+b64;await im.decode();const c=document.createElement('canvas');c.width=im.width;c.height=im.height;const ctx=c.getContext('2d');ctx.drawImage(im,0,0);const d=ctx.getImageData(0,Math.floor(im.height/2),im.width,1).data;const runs=[];for(let x=0;x<im.width;x++){const [r,g,b,a]=d.subarray(x*4,x*4+4);const label=a>240?(b>200&&r<30&&g<30?'blue':g>170&&r<30&&b<30?'green':r>230&&g<30&&b<30?'red':r>230&&g>230&&b<30?'yellow':null):null;if(!label)continue;const last=runs.at(-1);if(last?.label===label)last.width++;else runs.push({label,width:1});}return runs;},threePng.toString('base64'));
  assert.deepEqual(scan.slice(0,4).map(x=>x.label),['blue','green','red','yellow']);[4,6,3].forEach((w,i)=>assert.ok(Math.abs(scan[i].width-w)<=1,JSON.stringify(scan)));
  mark('透明PNG横断走査で外→内のフチ順と各層厚4/6/3pxを確認',JSON.stringify(scan.slice(0,4)));
  await toggle('影を使用',true);await color('影の色','#000000');await number('影の濃さ',100);await number('影のぼかし',0);await number('影の横位置',18);await number('影の縦位置',14);
  let prior=Infinity;const shadowSizes=[];
  for(const count of [3,2,1,0]){for(let i=1;i<=3;i++)await toggle(`フチ${i}を使用`,i<=count);const im=await pixelInfo(await download('exportSelected',`shadow-${count}-strokes.png`));assert.ok(im.bounds.width<prior,JSON.stringify({count,im,prior}));prior=im.bounds.width;shadowSizes.push(im.bounds);}
  // Disabled widths must not reserve any shadow silhouette or output pixels.
  const allOff=await template('all-strokes-off');const offPng=await download('exportSelected','off-widths.png');const zeroWidths=structuredClone(allOff);zeroWidths.strokes.forEach(layer=>layer.width=0);await load(zeroWidths);const offDiff=await pixelDiff(offPng,await download('exportSelected','off-zero-widths.png'));assert.ok(offDiff.sameSize&&offDiff.changed===0,JSON.stringify(offDiff));
  mark('影は有効最外周へ追従、3→2→1→0、OFF幅の予約領域なし',JSON.stringify({shadowSizes,offDiff}));
  const design=structuredClone(three);design.fill={type:'linear-gradient',angle:90,stops:[{offset:0,color:'#FFF000'},{offset:1,color:'#FF8500'}]};design.strokes=[{enabled:true,color:'#000000',width:3},{enabled:true,color:'#FFFFFF',width:6},{enabled:true,color:'#000000',width:4}];design.shadow={enabled:true,color:'#000000',opacity:.55,blur:0,offsetX:5,offsetY:9};
  await load(design);await text('投げた！');await page.getByLabel('フォント',{exact:true}).selectOption('Yu Gothic UI');await number('文字サイズ',130);await page.getByRole('button',{name:'スラント',exact:true}).click();await number('スラント角度',10);await snap('03-yellow-gradient-black-white-black');
  const headline=await download('exportSelected','yellow-gradient-triple.png');const headlineInfo=await pixelInfo(headline);for(const k of ['black','white','yellow','orange'])assert.ok(headlineInfo.counts[k]>80,JSON.stringify(headlineInfo));mark('黄→橙gradient＋黒→白→黒＋影・斜体の出力');
  await text('HHHH');await page.getByLabel('フォント',{exact:true}).selectOption('Arial');await page.getByRole('button',{name:'通常',exact:true}).click();
  const partialBase=await template('partial-base');partialBase.strokes=[{enabled:true,color:'#FFFFFF',width:3},{enabled:true,color:'#000000',width:2},{enabled:false,color:'#000000',width:4}];partialBase.partialStyles=[{start:0,end:2,fill:design.fill,fontFamily:'Impact',glyphScaleX:.85,glyphScaleY:1.2}];await load(partialBase);
  await range(0,2);await check('文字色を部分適用',false);
  for(const [i,hex,w] of [[1,'#000000',3],[2,'#FFFFFF',6],[3,'#000000',4]]){await openStroke(i,true);await partialAction(i,'使用状態','on');await partialAction(i,'色設定','change');await color(`範囲のフチ${i}の色`,hex);await partialAction(i,'幅設定','change');await number(`範囲のフチ${i}の幅`,w);}
  await apply();const partial=await template('partial-three-strokes');assert.deepEqual(partial.partialStyles[0],partialBase.partialStyles[0]);assert.equal(partial.partialStyles.at(-1).strokes['3'].enabled,true);await snap('04-partial-three-strokes');
  const partialPng=await download('exportSelected','partial-three-strokes.png');
  mark('選択範囲だけ3重フチ、既存部分gradient/font/glyphを保持');
  await openStroke(1,true);await partialAction(1,'色設定','change');
  await color('範囲のフチ1の色','#FF0000');await apply();const overlap=await template('partial-leaf-overlap');assert.deepEqual(overlap.partialStyles.at(-1).strokes,{'1':{color:'#FF0000'}});assert.deepEqual(overlap.partialStyles[0],partialBase.partialStyles[0]);
  const overlapPng=await download('exportSelected','partial-overlap.png');assert.ok((await pixelInfo(overlapPng)).counts.red>100);
  await toolbar.getByRole('button',{name:'元に戻す',exact:true}).click();assert.deepEqual((await template('partial-undo')).partialStyles,partial.partialStyles);await toolbar.getByRole('button',{name:'やり直す',exact:true}).click();assert.deepEqual((await template('partial-redo')).partialStyles,overlap.partialStyles);
  await load(overlap);const diff=await pixelDiff(overlapPng,await download('exportSelected','partial-roundtrip.png'));assert.ok(diff.sameSize&&diff.changed===0,JSON.stringify(diff));
  mark('重複範囲でフチ1色だけ後勝ち、他leaf保持、Undo/Redo・JSON/PNG往復');
  await tab('背景');await page.getByLabel('背景タイプ',{exact:true}).selectOption('uploadedImage');await page.getByLabel('テキスト背景ファイル',{exact:true}).setInputFiles(referencePng);await pause(700);
  await page.getByLabel('画像背景の使い方',{exact:true}).selectOption('fixed');await snap('05-background-fixed');await download('exportSelected','background-fixed.png');
  await page.getByLabel('画像背景の使い方',{exact:true}).selectOption('followLines');await snap('06-background-follow');await download('exportSelected','background-follow.png');
  mark('同じ参考PNGを通常ファイル入力で固定/自動追従に適用');
  // Quality metrics are produced from the actual prepared asset and renderer, after this UI upload.
  const quality = await import('./phase26-quality.mjs');await quality.compareBackgroundQuality(page,output,(await template('quality-input')).background);screenshots.push('background-fixed-vs-follow.png');mark('固定/旧follow/新followの同一高さ比較・alpha輪郭指標', 'quality-metrics.json');
  await text('ブラシ背景\n追従テスト');await number('グループの回転',17);await number('文字幅',90);await number('文字高さ',120);await snap('07-background-rotated');await download('exportSelected','background-rotated.png');
  const backgroundDesign=await template('background-design');await load(backgroundDesign);const bgDiff=await pixelDiff(await download('exportSelected','background-roundtrip-a.png'),await download('exportSelected','background-roundtrip-b.png'));assert.ok(bgDiff.sameSize&&bgDiff.changed===0);
  mark('自動背景の複数行・字形倍率・回転・PNG/JSON維持');
  await page.setViewportSize({width:1600,height:850});
  await page.getByLabel('背景画像ファイル',{exact:true}).setInputFiles(photo);await pause(600);await tab('出力');await toggle('SNS配置ガイドを表示',true);
  const expected={'instagram-reels':[.14,.35,.06,.18],threads:[.08,.12,.05,.05],'youtube-shorts':[.10,.25,.05,.18],x:[.10,.20,.05,.05]};
  for(const platform of Object.keys(expected)){await page.getByLabel('SNSガイドの種類',{exact:true}).selectOption(platform);const regions=await page.locator('.social-guide-area').evaluateAll(els=>els.map(el=>[el.style.left,el.style.top,el.style.width,el.style.height].map(parseFloat)));const[t,b,l,r]=expected[platform];const want=[[0,0,100,t*100],[0,(1-b)*100,100,b*100],[0,t*100,l*100,(1-t-b)*100],[(1-r)*100,t*100,r*100,(1-t-b)*100]];regions.forEach((a,i)=>a.forEach((x,j)=>assert.ok(Math.abs(x-want[i][j])<.0001)));}
  mark('Instagram/Threads/YouTube/Xの既存region座標・サイズを完全維持');
  await page.getByLabel('SNSガイドの種類',{exact:true}).selectOption('instagram-reels');
  for(const [value,name] of [['light','薄い'],['standard','標準'],['strong','はっきり']]){await page.getByLabel('ガイド視認性',{exact:true}).selectOption(value);assert.equal(await page.locator('.social-guide-overlay').getAttribute('data-visibility'),value);await snap('08-guide-'+value);}
  const css=await page.locator('.social-guide-area').first().evaluate(el=>({border:parseFloat(getComputedStyle(el).borderTopWidth),font:parseFloat(getComputedStyle(el.querySelector('span')).fontSize),pointer:getComputedStyle(el).pointerEvents,background:getComputedStyle(el).backgroundImage}));assert.ok(css.border>=1&&css.font>=11&&css.pointer==='none'&&css.background.includes('gradient'));
  await page.getByLabel('ガイド視認性',{exact:true}).selectOption('standard');
  const on=await download('exportProject','guide-on.png'),transparentOn=await download('exportSelected','guide-transparent-on.png');await toggle('SNS配置ガイドを表示',false);assert.ok((await download('exportProject','guide-off.png')).equals(on));assert.ok((await download('exportSelected','guide-transparent-off.png')).equals(transparentOn));await toggle('SNS配置ガイドを表示',true);
  mark('ガイド3段階・screen-space輪郭/ハッチ/11pxラベル・PNGに非混入',JSON.stringify(css));
  const el=page.locator('canvas.upper-canvas'),box=await el.boundingBox();const before=Number(await page.locator('.editor-shell').getAttribute('data-selected-x'));const y=Number(await page.locator('.editor-shell').getAttribute('data-selected-y'));await page.mouse.move(box.x+before/1080*box.width,box.y+y/1920*box.height);await page.mouse.down();await page.mouse.move(box.x+before/1080*box.width+22,box.y+y/1920*box.height+12,{steps:6});await page.mouse.up();await pause(450);assert.ok(Math.abs(Number(await page.locator('.editor-shell').getAttribute('data-selected-x'))-before)>5);mark('ガイド表示中のCanvasドラッグを遮断しない');
  await pause(1800);const beforeSaved=await saved();const beforeRestore=await download('exportProject','before-restore.png');await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'復元する',exact:true}).click();await page.locator('canvas.upper-canvas').waitFor();await pause(1600);const afterSaved=await saved();assert.deepEqual(afterSaved.objects.at(-1).strokes,beforeSaved.objects.at(-1).strokes);assert.deepEqual(afterSaved.objects.at(-1).partialStyles,beforeSaved.objects.at(-1).partialStyles);assert.deepEqual(afterSaved.canvas.socialGuide,beforeSaved.canvas.socialGuide);const restoredDiff=await pixelDiff(beforeRestore,await download('exportProject','after-restore.png'));assert.ok(restoredDiff.sameSize&&restoredDiff.changed===0,JSON.stringify(restoredDiff));await snap('09-indexeddb-restored');mark('3層/部分フチ/背景/guide設定IndexedDB復元・PNG一致',JSON.stringify(restoredDiff));
  // Additional acceptance: contiguous enabled layers, retained settings, legacy repair.
  const continuous=structuredClone(three);continuous.partialStyles=[];
  await load(continuous);await tab('スタイル');for(let i=1;i<=3;i++)await openStroke(i);
  await toggle('フチ1を使用',false);
  const disabled=await template('contiguous-all-off');assert.deepEqual(disabled.strokes.map(x=>x.enabled),[false,false,false]);
  assert.deepEqual(disabled.strokes.map(({color,width})=>({color,width})),continuous.strokes.map(({color,width})=>({color,width})));
  assert.equal(await page.getByRole('switch',{name:'フチ2を使用',exact:true}).isDisabled(),true);assert.equal(await page.getByRole('switch',{name:'フチ3を使用',exact:true}).isDisabled(),true);
  await toolbar.getByRole('button',{name:'元に戻す',exact:true}).click();assert.deepEqual((await template('contiguous-undo')).strokes,continuous.strokes);
  await toolbar.getByRole('button',{name:'やり直す',exact:true}).click();assert.deepEqual((await template('contiguous-redo')).strokes,disabled.strokes);
  mark('連続フチ: 1 OFFで2/3もOFF、色幅保持、外側ON不可、Undo/Redo');
  await toggle('フチ1を使用',true);assert.equal(await page.getByRole('switch',{name:'フチ2を使用',exact:true}).isDisabled(),false);assert.equal(await page.getByRole('switch',{name:'フチ3を使用',exact:true}).isDisabled(),true);
  await toggle('フチ2を使用',true);await toggle('フチ3を使用',true);assert.deepEqual((await template('contiguous-reenabled')).strokes,continuous.strokes);
  await toggle('フチ2を使用',false);assert.deepEqual((await template('contiguous-two-off')).strokes.map(x=>x.enabled),[true,false,false]);await toggle('フチ2を使用',true);await toggle('フチ3を使用',true);await snap('10-contiguous-strokes');
  mark('連続フチ: 内→外のON制約、2 OFFで3 OFF、再ON時の設定再利用');
  const broken=structuredClone(continuous);delete broken.strokes;broken.stroke.enabled=false;broken.outerStroke.enabled=true;await load(broken);const repaired=await template('legacy-discontinuous-repaired');assert.deepEqual(repaired.strokes.map(x=>x.enabled),[true,true,false]);assert.equal(repaired.strokes[0].width,broken.stroke.width);
  const broken3=structuredClone(continuous);broken3.strokes[0].enabled=false;broken3.strokes[1].enabled=false;await load(broken3);assert.deepEqual((await template('three-discontinuous-repaired')).strokes.map(x=>x.enabled),[true,true,true]);
  mark('旧JSON不連続ONを内側ONへ補正、色幅とテンプレート互換を維持');
  const partialContinuous=structuredClone(continuous);partialContinuous.partialStyles=[{start:0,end:2,fill:{type:'solid',color:'#D20A11'},fontFamily:'Impact',glyphScaleY:1.2}];
  await text('HHHH');await load(partialContinuous);await range(0,2);await check('文字色を部分適用',false);for(let i=1;i<=3;i++)await openStroke(i,true);
  await partialAction(2,'使用状態','off');assert.equal(await page.getByLabel('フチ3の使用状態',{exact:true}).inputValue(),'off');await apply();
  const partialOff=await template('partial-contiguous-off');assert.deepEqual(partialOff.partialStyles.at(-1).strokes,{'2':{enabled:false},'3':{enabled:false}});assert.deepEqual(partialOff.partialStyles[0],partialContinuous.partialStyles[0]);
  await partialAction(2,'使用状態','on');await partialAction(3,'使用状態','on');await apply();const partialOn=await template('partial-contiguous-on');assert.deepEqual(partialOn.partialStyles.at(-1).strokes,{'1':{enabled:true},'2':{enabled:true},'3':{enabled:true}});
  await partialAction(1,'使用状態','off');await apply();const partialAllOff=await template('partial-contiguous-all-off');assert.deepEqual(partialAllOff.partialStyles.at(-1).strokes,{'1':{enabled:false},'2':{enabled:false},'3':{enabled:false}});assert.deepEqual(partialAllOff.partialStyles[0],partialContinuous.partialStyles[0]);
  mark('部分連続フチ: 2→3/1→2→3のOFF連動、既存font/fill/glyph保持');
  const offPartialPng=await download('exportSelected','partial-contiguous-off.png');await toolbar.getByRole('button',{name:'元に戻す',exact:true}).click();assert.deepEqual((await template('partial-contiguous-undo')).partialStyles,partialOn.partialStyles);await toolbar.getByRole('button',{name:'やり直す',exact:true}).click();assert.deepEqual((await template('partial-contiguous-redo')).partialStyles,partialAllOff.partialStyles);
  await load(partialAllOff);assert.deepEqual((await template('partial-contiguous-roundtrip')).partialStyles,partialAllOff.partialStyles);assert.ok((await download('exportSelected','partial-contiguous-roundtrip.png')).equals(offPartialPng));await pause(1800);const contiguousSaved=await saved();await page.reload({waitUntil:'networkidle'});await page.getByRole('button',{name:'復元する',exact:true}).click();await pause(1800);assert.deepEqual((await saved()).objects.at(-1).partialStyles,contiguousSaved.objects.at(-1).partialStyles);const partialRestoreDiff=await pixelDiff(offPartialPng,await download('exportSelected','partial-contiguous-restored.png'));assert.ok(partialRestoreDiff.sameSize&&partialRestoreDiff.max<=2&&partialRestoreDiff.changed<1200,JSON.stringify(partialRestoreDiff));
  mark('部分連続フチ: Undo/Redo・JSON・IndexedDB値一致・透明PNG微小AA差検証',JSON.stringify(partialRestoreDiff));
  const brokenPartial=structuredClone(continuous);brokenPartial.partialStyles=[{start:0,end:1,strokes:{'3':{enabled:true,color:'#00CC00'}}}];await load(brokenPartial);const fixedPartial=await template('partial-legacy-repaired');assert.deepEqual(fixedPartial.partialStyles[0].strokes,{'1':{enabled:true},'2':{enabled:true},'3':{enabled:true,color:'#00CC00'}});
  const mixed=structuredClone(continuous);mixed.strokes.forEach(x=>x.enabled=false);mixed.partialStyles=[{start:0,end:1,strokes:{'1':{enabled:true}}}];await load(mixed);await tab('スタイル');await range(0,2);await check('文字色を部分適用',false);await openStroke(2,true);assert.equal(await page.getByLabel('フチ2の使用状態',{exact:true}).locator('option[value="on"]').isDisabled(),true);
  mark('部分legacy外側ONの内側補完、親ON/OFF混在選択は外側ONを制限');
  assert.deepEqual(errors,[]);await writeFile(path.join(output,'results.json'),JSON.stringify({appUrl,browser:await browser.version(),results,screenshots,errors},null,2));console.log(JSON.stringify({passed:results.length,output}));
} catch(error){await snap('failure').catch(()=>{});await writeFile(path.join(output,'failure.json'),JSON.stringify({results,error:String(error.stack??error),errors,body:await page.locator('body').innerText().catch(()=> '')},null,2));throw error;}finally{await browser.close();}
