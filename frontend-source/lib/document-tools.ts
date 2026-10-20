import { basePath } from "./base";
export function prepareImage(source: HTMLCanvasElement) {
    const scale = Math.min(2, 2400 / Math.max(source.width, source.height));
    const out = document.createElement("canvas");
    out.width = Math.max(1, Math.round(source.width * scale));
    out.height = Math.max(1, Math.round(source.height * scale));
    const ctx = out.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, out.width, out.height);
    ctx.drawImage(source, 0, 0, out.width, out.height);
    return out;
}
export function adaptiveImage(source: HTMLCanvasElement) {
    const out = document.createElement("canvas");
    out.width = source.width;
    out.height = source.height;
    const ctx = out.getContext("2d")!;
    ctx.drawImage(source, 0, 0);
    const image = ctx.getImageData(0, 0, out.width, out.height),
        a = image.data,
        w = out.width,
        h = out.height,
        gray = new Uint8Array(w * h),
        sum = new Float64Array((w + 1) * (h + 1));
    for (let y = 0; y < h; y++) {
        let row = 0;
        for (let x = 0; x < w; x++) {
            const i = y * w + x;
            gray[i] = Math.round(0.299 * a[i * 4] + 0.587 * a[i * 4 + 1] + 0.114 * a[i * 4 + 2]);
            row += gray[i];
            sum[(y + 1) * (w + 1) + x + 1] = sum[y * (w + 1) + x + 1] + row;
        }
    }
    const radius = Math.max(12, Math.round(w / 70));
    for (let y = 0; y < h; y++)
        for (let x = 0; x < w; x++) {
            const x1 = Math.max(0, x - radius),
                x2 = Math.min(w, x + radius + 1),
                y1 = Math.max(0, y - radius),
                y2 = Math.min(h, y + radius + 1);
            const mean =
                (sum[y2 * (w + 1) + x2] -
                    sum[y1 * (w + 1) + x2] -
                    sum[y2 * (w + 1) + x1] +
                    sum[y1 * (w + 1) + x1]) /
                ((x2 - x1) * (y2 - y1));
            const v = gray[y * w + x] < mean - 12 ? 0 : 255,
                i = (y * w + x) * 4;
            a[i] = a[i + 1] = a[i + 2] = v;
            a[i + 3] = 255;
        }
    ctx.putImageData(image, 0, 0);
    return out;
}
export function rotateImage(source: HTMLCanvasElement, angle: number) {
    const swap = Math.abs(angle) % 180 === 90,
        c = document.createElement("canvas");
    c.width = swap ? source.height : source.width;
    c.height = swap ? source.width : source.height;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((angle * Math.PI) / 180);
    ctx.drawImage(source, -source.width / 2, -source.height / 2);
    return c;
}
export async function reviewImageOrientation(canvas: HTMLCanvasElement, worker: any) {
    await worker.setParameters({ tessedit_pageseg_mode: "11", tessedit_char_whitelist: "" });
    let best = {
        canvas,
        result: await worker.recognize(canvas, {}, { text: true, tsv: true }),
        angle: 0,
    };
    const score = (r: any) =>
        (r.data.confidence || 0) * Math.min(1, (r.data.text || "").replace(/\s/g, "").length / 60);
    if (score(best.result) < 45)
        for (const angle of [90, 180, 270]) {
            const rotated = rotateImage(canvas, angle),
                result = await worker.recognize(rotated, {}, { text: true, tsv: true });
            if (score(result) > score(best.result) + 8) best = { canvas: rotated, result, angle };
        }
    return best;
}
export async function ocrWorker() {
    const { createWorker } = await import("tesseract.js");
    return createWorker("eng+ara", 1, {
        workerPath: basePath + "/vendor/ocr/worker.min.js",
        corePath: basePath + "/vendor/ocr",
        langPath: basePath + "/vendor/ocr",
        logger: () => {},
    });
}
