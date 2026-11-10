const page = document.querySelector('#transfers');
const receipt = page.querySelector('.transfer-receipt');
const printButton = page.querySelector('#print-transfer');
const selectButton = page.querySelector('#select-bank-logo');
const logo = page.querySelector('#receipt-bank-logo');
const status = page.querySelector('#receipt-logo-status');
const picker = page.querySelector('#receipt-logo-picker');
const canvas = picker.querySelector('canvas');
const outline = canvas.nextElementSibling;
const apply = picker.querySelector('#apply-bank-logo');
const source = page.querySelector('#receipt-original');

let original;
let origin;
let selection;

function loadOriginal() {
    original ??= renderOriginal().catch(error => {
        original = null;
        throw error;
    });
    return original;
}

async function renderOriginal() {
    const response = await fetch(source.href);
    if (!response.ok) throw new Error();
    const file = await response.blob();
    if (/\.pdf$/i.test(receipt.dataset.sourceName) || file.type === 'application/pdf') {
        const pdf = await import(page.dataset.pdf);
        pdf.GlobalWorkerOptions.workerSrc = page.dataset.base + '/assets/bank-transfer-pdf-worker.mjs';
        const task = pdf.getDocument({data: await file.arrayBuffer(), isEvalSupported: false});
        try {
            const first = await (await task.promise).getPage(1);
            const viewport = first.getViewport({scale: 1});
            const rendered = first.getViewport({scale: 1600 / Math.max(viewport.width, viewport.height)});
            canvas.width = Math.ceil(rendered.width);
            canvas.height = Math.ceil(rendered.height);
            await first.render({canvasContext: canvas.getContext('2d'), viewport: rendered}).promise;
            const {items} = await first.getTextContent();
            return Math.abs(viewport.width / viewport.height - 595 / 750) < 0.005
                && items.some(item => /تفاصيل|ليصافت/.test(item.str?.normalize('NFKC') ?? '')
                    && Math.abs(item.transform[4] / viewport.width - .44) < .12
                    && Math.abs(item.transform[5] / viewport.height - .88) < .03);
        } finally {
            await task.destroy();
        }
    }
    const image = await createImageBitmap(file);
    try {
        const scale = Math.min(1, 1600 / Math.max(image.width, image.height));
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        canvas.getContext('2d').drawImage(image, 0, 0, canvas.width, canvas.height);
        return false;
    } finally {
        image.close();
    }
}

async function showLogo({x, y, width, height}) {
    const crop = document.createElement('canvas');
    crop.width = Math.ceil(width * canvas.width);
    crop.height = Math.ceil(height * canvas.height);
    crop.getContext('2d').drawImage(canvas, x * canvas.width, y * canvas.height,
        width * canvas.width, height * canvas.height, 0, 0, crop.width, crop.height);
    logo.src = crop.toDataURL();
    await logo.decode();
    logo.hidden = false;
}

function notify(message) {
    status.textContent = message;
    status.hidden = !message;
}

const automatic = /^NCBK/i.test(receipt.dataset.reference)
    ? loadOriginal().then(known => {
        if (known) return showLogo({x: .414, y: .028, width: .146, height: .057});
    }).catch(() => {})
    : Promise.resolve();

printButton.addEventListener('click', async () => {
    printButton.disabled = true;
    try {
        await automatic;
        window.print();
    } finally {
        printButton.disabled = false;
    }
});

selectButton.addEventListener('click', async () => {
    selectButton.disabled = true;
    notify('جاري تجهيز معاينة الحوالة…');
    try {
        await automatic;
        await loadOriginal();
        selection = null;
        outline.hidden = apply.disabled = true;
        picker.showModal();
        notify('');
    } catch {
        notify('تعذرت معاينة الملف الأصلي لاستخراج الشعار.');
    } finally {
        selectButton.disabled = false;
    }
});

function point(event) {
    const bounds = canvas.getBoundingClientRect();
    const clamp = value => Math.min(1, Math.max(0, value));
    return {
        x: clamp((event.clientX - bounds.left) / bounds.width),
        y: clamp((event.clientY - bounds.top) / bounds.height),
    };
}

canvas.addEventListener('pointerdown', event => {
    if (!event.isPrimary || event.button !== 0) return;
    canvas.setPointerCapture(event.pointerId);
    origin = point(event);
    selection = null;
    outline.hidden = apply.disabled = true;
});

canvas.addEventListener('pointermove', event => {
    if (!origin || !event.isPrimary) return;
    const end = point(event);
    selection = {
        x: Math.min(origin.x, end.x),
        y: Math.min(origin.y, end.y),
        width: Math.abs(origin.x - end.x),
        height: Math.abs(origin.y - end.y),
    };
    Object.assign(outline.style, {
        left: selection.x * 100 + '%', top: selection.y * 100 + '%',
        width: selection.width * 100 + '%', height: selection.height * 100 + '%',
    });
    outline.hidden = false;
});

canvas.addEventListener('lostpointercapture', () => {
    origin = null;
    apply.disabled = !selection || selection.width * canvas.width < 8 || selection.height * canvas.height < 8;
});

apply.addEventListener('click', async () => {
    try {
        await showLogo(selection);
        picker.close();
        notify('تم اعتماد الشعار لهذه الطباعة.');
    } catch {
        picker.close();
        notify('تعذر اعتماد الشعار. أعد تحديده من المعاينة.');
    }
});
