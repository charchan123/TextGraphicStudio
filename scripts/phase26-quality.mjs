import assert from 'node:assert/strict';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';

/** Reproducible diagnostic of the real background renderer, using the image uploaded through the UI. */
export async function compareBackgroundQuality(page, output, background) {
  const result = await page.evaluate(async (input) => {
    const { createTextBackground, drawThreeSlice } = await import('/src/canvas/backgroundRenderer.ts');
    const { prepareBackgroundImage, getPreparedBackgroundImage } = await import('/src/services/textBackgroundAssets.ts');
    await prepareBackgroundImage(input.image);
    const source = getPreparedBackgroundImage(input.image);
    const style = { ...input, enabled: true, type: 'uploadedImage', paddingX: 0, paddingY: 0, rotation: 0, followSettings: { capRatio: .22, seamOverlap: 2, lineOverlap: 0 } };
    const logicalHeight = 121.4, logicalWidth = logicalHeight * source.width / source.height;
    const scale = 3, margin = 14;
    const canvas = () => { const c = document.createElement('canvas'); c.width = Math.ceil(logicalWidth * scale) + margin * 2; c.height = Math.ceil(logicalHeight * scale) + margin * 2; return c; };
    const fixed = canvas(), follow = canvas(), legacy = canvas(), reference = canvas();
    const render = (target, mode) => { const ctx = target.getContext('2d'); ctx.imageSmoothingQuality = 'high'; ctx.translate(margin + logicalWidth * scale / 2, margin + logicalHeight * scale / 2); ctx.scale(scale, scale); const object = createTextBackground({ ...style, imageMode: mode }, logicalWidth, logicalHeight, [{ width: logicalWidth, height: logicalHeight, centerX: 0, centerY: 0 }], scale); object.render(ctx); };
    render(fixed, 'fixed'); render(follow, 'followLines');
    // Phase 2.5 pipeline: 1x row bitmap, then a second 1x composite bitmap, then Fabric-size scaling.
    const row = document.createElement('canvas'); row.width = Math.ceil(logicalWidth); row.height = Math.ceil(logicalHeight);
    const r = row.getContext('2d'); r.imageSmoothingQuality = 'high';
    const sw = source.width, sh = source.height, cap = Math.round(sw * .22), overlap = 2;
    const left = Math.round(cap * row.height / sh), right = row.width - left;
    r.drawImage(source, 0, 0, cap + overlap, sh, 0, 0, left, row.height);
    r.drawImage(source, cap - overlap, 0, sw - cap * 2 + overlap * 2, sh, left, 0, right - left, row.height);
    r.drawImage(source, sw - cap - overlap, 0, cap + overlap, sh, right, 0, row.width - right, row.height);
    const composite = document.createElement('canvas'); composite.width = Math.ceil(logicalWidth); composite.height = Math.ceil(logicalHeight);
    const cc = composite.getContext('2d'); cc.imageSmoothingQuality = 'high'; cc.drawImage(row, 0, 0, logicalWidth, logicalHeight);
    const lc = legacy.getContext('2d'); lc.imageSmoothingQuality = 'high'; lc.drawImage(composite, margin, margin, logicalWidth * scale, logicalHeight * scale);
    // Same three-slice geometry drawn directly at the final destination resolution is the reference.
    const rc = reference.getContext('2d'); rc.translate(margin, margin); rc.scale(scale, scale); drawThreeSlice(rc, style, logicalWidth, logicalHeight);
    const pixels = (c) => c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    const ref = pixels(reference), old = pixels(legacy), next = pixels(follow), fixedPixels = pixels(fixed);
    const width = reference.width, height = reference.height, edge = new Uint8Array(width * height);
    for(let y=1;y<height-1;y++)for(let x=1;x<width-1;x++){const i=(y*width+x)*4;const a=ref[i+3];if(Math.abs(a-ref[i-1])>15||Math.abs(a-ref[i+7])>15||Math.abs(a-ref[i-width*4+3])>15||Math.abs(a-ref[i+width*4+3])>15)for(let dy=-2;dy<=2;dy++)for(let dx=-2;dx<=2;dx++){const px=x+dx,py=y+dy;if(px>=0&&px<width&&py>=0&&py<height)edge[py*width+px]=1;}}
    const measure=(data)=>{let error=0,count=0,partial=0;for(let i=0;i<edge.length;i++)if(edge[i]){error+=Math.abs(data[i*4+3]-ref[i*4+3]);count++;if(data[i*4+3]>25&&data[i*4+3]<230)partial++;}return {alphaEdgeMAE:error/count,edgePixels:count,transitionPixels:partial};};
    return { metrics: { logicalWidth, logicalHeight, outputScale: scale, source: {width:sw,height:sh}, reference:'direct final-resolution three-slice', legacy:measure(old), follow:measure(next), fixed:measure(fixedPixels), improvement:1-measure(next).alphaEdgeMAE/measure(old).alphaEdgeMAE }, images: {fixed:fixed.toDataURL(),legacy:legacy.toDataURL(),follow:follow.toDataURL(),reference:reference.toDataURL()} };
  }, background);
  await writeFile(path.join(output,'quality-metrics.json'),JSON.stringify(result.metrics,null,2));
  for(const [name,data] of Object.entries(result.images)) await writeFile(path.join(output,`quality-${name}.png`),Buffer.from(data.split(',')[1],'base64'));
  const comparison=await page.context().newPage();await comparison.setViewportSize({width:1500,height:1000});
  await comparison.setContent(`<html lang="ja"><style>body{margin:0;padding:28px;background:#edf1f7;font:16px sans-serif;color:#203047}h1{font-size:22px;margin:0 0 10px}p{font-size:14px}main{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}section{background:white;border:1px solid #cbd5e1;border-radius:8px;padding:14px}h2{font-size:17px}figure{margin:0;background:repeating-conic-gradient(#dce1e8 0% 25%,white 0% 50%) 0/16px 16px;overflow:hidden}img{display:block;width:100%;height:auto}pre{white-space:pre-wrap;font-size:13px}article{display:grid;grid-template-columns:repeat(3,1fr);gap:16px;margin-top:18px}.edge{height:270px;position:relative}.edge img{width:auto;height:365px;max-width:none;position:absolute;left:-30px;top:-55px}</style><h1>同じブラシPNG：固定背景と自動追従背景</h1><p>表示高さを統一。下段は同じ倍率の端部拡大。元素材は通常のローカルファイル入力から読み込み。</p><main>${[['fixed','固定背景'],['legacy','Phase 2.5 自動追従'],['follow','Phase 2.6 自動追従']].map(([key,label])=>`<section><h2>${label}</h2><figure><img src="${result.images[key]}"></figure><pre>alpha edge MAE: ${result.metrics[key].alphaEdgeMAE.toFixed(3)}\n遷移画素数: ${result.metrics[key].transitionPixels}</pre></section>`).join('')}</main><article>${['fixed','legacy','follow'].map(key=>`<figure class="edge"><img src="${result.images[key]}"></figure>`).join('')}</article><p>基準は同じ3-slice形状を最終解像度へ直接描画した画像。MAEは輪郭±2pxのalpha平均絶対誤差（低いほど基準に近い）。形状変更による差も含むため、数値と目視を併用します。</p></html>`);
  await comparison.screenshot({path:path.join(output,'background-fixed-vs-follow.png'),fullPage:true});await comparison.close();
  assert.ok(result.metrics.follow.alphaEdgeMAE < result.metrics.legacy.alphaEdgeMAE * .85,JSON.stringify(result.metrics));
  return result.metrics;
}
