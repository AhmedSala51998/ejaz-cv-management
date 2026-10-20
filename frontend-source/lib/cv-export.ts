import { CV, fields, val } from "./fields";
import { basePath } from "./base";
const enc = new TextEncoder();
function pdf(images: Uint8Array[]) {
    const chunks: Uint8Array[] = [];
    let length = 0;
    const offsets: number[] = [0];
    const add = (x: string | Uint8Array) => {
        const b = typeof x === "string" ? enc.encode(x) : x;
        chunks.push(b);
        length += b.length;
    };
    const object = (id: number, content: string) => {
        offsets[id] = length;
        add(`${id} 0 obj\n${content}\nendobj\n`);
    };
    add("%PDF-1.4\n");
    object(1, "<< /Type /Catalog /Pages 2 0 R >>");
    object(
        2,
        `<< /Type /Pages /Count ${images.length} /Kids [${images.map((_, i) => `${3 + i * 3} 0 R`).join(" ")}] >>`,
    );
    images.forEach((image, i) => {
        const page = 3 + i * 3,
            resource = page + 1,
            stream = page + 2;
        object(
            page,
            `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595.28 841.89] /Resources << /XObject << /Im ${resource} 0 R >> >> /Contents ${stream} 0 R >>`,
        );
        offsets[resource] = length;
        add(
            `${resource} 0 obj\n<< /Type /XObject /Subtype /Image /Width 1240 /Height 1754 /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${image.length} >>\nstream\n`,
        );
        add(image);
        add("\nendstream\nendobj\n");
        const draw = "q 595.28 0 0 841.89 0 0 cm /Im Do Q";
        object(stream, `<< /Length ${draw.length} >>\nstream\n${draw}\nendstream`);
    });
    const start = length;
    add(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
    for (let i = 1; i < offsets.length; i++)
        add(String(offsets[i]).padStart(10, "0") + " 00000 n \n");
    add(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`);
    return new Blob(chunks as BlobPart[], { type: "application/pdf" });
}
const loadImage = (src: string) =>
    new Promise<HTMLImageElement>((resolve, reject) => {
        const i = new Image();
        i.onload = () => resolve(i);
        i.onerror = reject;
        i.src = src;
    });
export async function cvPDF(record: { data: CV; photo?: string; passport: string }, lang: string) {
    await document.fonts.ready;
    const ar = lang === "ar",
        pages: Uint8Array[] = [];
    let canvas: HTMLCanvasElement,
        ctx: CanvasRenderingContext2D,
        y = 0;
    const W = 1240,
        H = 1754,
        M = 70;
    function text(
        value: string,
        x: number,
        top: number,
        size: number,
        bold = false,
        color = "#263f32",
    ) {
        ctx.font = `${bold ? "bold " : ""}${size}px Tahoma, Arial`;
        ctx.fillStyle = color;
        ctx.textAlign = ar ? "right" : "left";
        ctx.direction = ar ? "rtl" : "ltr";
        ctx.fillText(value, x, top);
    }
    function begin() {
        canvas = document.createElement("canvas");
        canvas.width = W;
        canvas.height = H;
        ctx = canvas.getContext("2d")!;
        ctx.fillStyle = "#fff";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#ee9b22";
        ctx.fillRect(M, 50, W - M * 2, 7);
        text(
            ar ? "شركة إيجاز للاستقدام" : "Ejaz Recruitment Company",
            ar ? W - M : M,
            92,
            26,
            true,
        );
        text(record.passport, ar ? W - M : M, 120, 18, false, "#8b947f");
        y = 160;
    }
    function finish() {
        const data = canvas.toDataURL("image/jpeg", 0.93).split(",")[1];
        pages.push(Uint8Array.from(atob(data), (c) => c.charCodeAt(0)));
    }
    function wrap(value: string, width: number, size: number) {
        ctx.font = `${size}px Tahoma,Arial`;
        const lines: string[] = [];
        let line = "";
        for (const word of value.replace(/\r/g, "").split(/\s+/)) {
            if (ctx.measureText(word).width > width) {
                if (line) {
                    lines.push(line);
                    line = "";
                }
                for (const char of word) {
                    if (ctx.measureText(line + char).width > width && line) {
                        lines.push(line);
                        line = "";
                    }
                    line += char;
                }
            } else if (ctx.measureText(line + " " + word).width > width && line) {
                lines.push(line);
                line = word;
            } else line = (line + " " + word).trim();
        }
        if (line) lines.push(line);
        return lines.length ? lines : ["—"];
    }

    begin();
    const name = ar ? record.data.nameAr || record.data.name : record.data.name;
    const portraitSpace = record.photo ? 230 : 0;
    let nameWidth = W - M * 2 - portraitSpace;
    for (const line of wrap(name || "—", nameWidth, 32)) {
        text(line, ar ? W - M - portraitSpace : M + portraitSpace, y + 38, 32, true);
        y += 42;
    }
    text(
        val(record.data.job, lang),
        ar ? W - M - portraitSpace : M + portraitSpace,
        y + 30,
        23,
        false,
        "#7d8975",
    );
    if (record.photo) {
        try {
            const img = await loadImage(
                basePath + "/api/files?key=" + encodeURIComponent(record.photo),
            );
            const x = ar ? W - M - 190 : M,
                top = 150,
                w = 190,
                h = 210,
                ratio = Math.min(w / img.width, h / img.height);
            ctx.drawImage(
                img,
                x + (w - img.width * ratio) / 2,
                top + (h - img.height * ratio) / 2,
                img.width * ratio,
                img.height * ratio,
            );
        } catch {}
    }
    y = Math.max(y + 65, record.photo ? 390 : 240);
    const keys = fields.filter(([k]) => !["name", "nameAr", "job"].includes(k));
    const blocks: (typeof keys)[] = [];
    let pair: typeof keys = [];
    for (const field of keys) {
        const wide =
            ["notes", "skills", "experience", "address"].includes(field[0]) &&
            (record.data[field[0]] || "").length > 80;
        if (wide) {
            if (pair.length) {
                blocks.push(pair);
                pair = [];
            }
            blocks.push([field]);
        } else {
            pair.push(field);
            if (pair.length === 2) {
                blocks.push(pair);
                pair = [];
            }
        }
    }
    if (pair.length) blocks.push(pair);
    for (const block of blocks) {
        const cellWidth = (W - M * 2) / block.length,
            values = block.map(([key]) => wrap(val(record.data[key], lang), cellWidth - 32, 23));
        let position = 0,
            total = Math.max(...values.map((v) => v.length));
        while (position < total) {
            let capacity = Math.floor((H - 100 - y - 45) / 30);
            if (capacity < 1) {
                finish();
                begin();
                continue;
            }
            const count = Math.min(capacity, total - position),
                height = 45 + count * 30;
            block.forEach((field, index) => {
                const x = ar ? W - M - cellWidth * (index + 1) : M + cellWidth * index,
                    anchor = ar ? x + cellWidth - 16 : x + 16;
                ctx.strokeStyle = "#dce3d7";
                ctx.lineWidth = 1;
                ctx.strokeRect(x, y, cellWidth, height);
                text(
                    (ar ? field[1] : field[2]) +
                        (position ? (ar ? " (تابع)" : " (continued)") : ""),
                    anchor,
                    y + 24,
                    18,
                    false,
                    "#7d8876",
                );
                values[index]
                    .slice(position, position + count)
                    .forEach((line, i) => text(line, anchor, y + 54 + i * 30, 23));
            });
            y += height + 5;
            position += count;
        }
    }
    finish();
    return pdf(pages);
}
export async function exportCVZip(records: any[], lang: string, progress: (s: string) => void) {
    const { default: JSZip } = await import("jszip");
    const zip = new JSZip();
    for (let i = 0; i < records.length; i++) {
        progress(`تجهيز PDF ${i + 1} من ${records.length}`);
        const r = records[i];
        zip.file(
            (r.passport || r.id).replace(/[^A-Z0-9_-]/gi, "_") + "-" + lang + ".pdf",
            await cvPDF(r, lang),
        );
        await new Promise((r) => setTimeout(r, 0));
    }
    progress("ضغط ملفات PDF");
    return zip.generateAsync({ type: "blob", compression: "DEFLATE" });
}
export function download(blob: Blob, name: string) {
    const u = URL.createObjectURL(blob),
        a = document.createElement("a");
    a.href = u;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(u), 30000);
}
