import {parseBankTransfer, matchingOffice, beneficiaryOfficeName} from './bank-transfer-parser.mjs?v=2';

document.querySelector('#print-transfer')?.addEventListener('click', () => window.print());
document.querySelector('#transfer-logout')?.addEventListener('click', async event => {
    const button = event.currentTarget;
    button.disabled = true;
    try {
        const response = await fetch(button.dataset.url, {
            method: 'POST',
            headers: {'X-CSRF-Token': document.querySelector('meta[name=csrf-token]').content},
        });
        if (!response.ok) throw new Error();
        window.location.assign(button.dataset.login);
    } catch {
        button.disabled = false;
        window.alert('تعذر تسجيل الخروج. أعد المحاولة.');
    }
});
const form = document.querySelector('#transfer-form');
if (form) {
    const page = document.querySelector('#transfers');
    const input = document.querySelector('#transfer-files');
    const status = document.querySelector('#transfer-status');
    const save = document.querySelector('#save-transfer');
    const choose = document.querySelector('#choose-transfer-files');
    const drop = document.querySelector('#transfer-drop');
    const queueView = document.querySelector('#transfer-queue');
    const reviewPanel = document.querySelector('#transfer-review');
    const original = document.querySelector('#transfer-original');
    const originalPreview = document.querySelector('#transfer-preview');
    const preview = document.querySelector('#transfer-text');
    const fields = [...form.querySelectorAll('[name]')];
    let queue = [], active = null, busy = false, previewUrl = null;

    const office = form.elements.office_id;
    const country = form.elements.office_country;
    const countryLabel = document.querySelector('#new-office-country');
    function updateOfficeFields() {
        const newOffice = office.value === '__new__';
        countryLabel.hidden = !newOffice;
        country.required = newOffice;
    }
    office.addEventListener('change', updateOfficeFields);

    function setBusy(value) {
        busy = value;
        input.disabled = save.disabled = choose.disabled = value;
        renderQueue();
    }

    async function recognize(source) {
        const {default: tesseract} = await import(page.dataset.ocr);
        const worker = await tesseract.createWorker('eng+ara', 1, {
            workerPath: page.dataset.base + '/vendor/ocr/worker.min.js',
            corePath: page.dataset.base + '/vendor/ocr',
            langPath: page.dataset.base + '/vendor/ocr',
        });
        try {
            return (await worker.recognize(source)).data.text;
        } finally {
            await worker.terminate();
        }
    }

    async function read(file) {
        if (file.size > 15*1024*1024) throw new Error('الحد الأقصى 15 ميجابايت.');
        if (!/\.pdf$/i.test(file.name)) {
            const bitmap = await createImageBitmap(file);
            try {
                if (bitmap.width * bitmap.height > 25e6) throw new Error('صغّر أبعاد الصورة قبل القراءة.');
                const canvas = document.createElement('canvas');
                canvas.width = bitmap.width;
                canvas.height = bitmap.height;
                canvas.getContext('2d').drawImage(bitmap,0,0);
                return await recognize(canvas);
            } finally {
                bitmap.close();
            }
        }
        const pdf = await import(page.dataset.pdf);
        pdf.GlobalWorkerOptions.workerSrc = page.dataset.base + '/assets/bank-transfer-pdf-worker.mjs';
        const task = pdf.getDocument({data:await file.arrayBuffer(),isEvalSupported:false});
        try {
            const documentPdf = await task.promise;
            if (documentPdf.numPages !== 1) throw new Error('ارفع كل حوالة في ملف مستقل من صفحة واحدة.');
            const first = await documentPdf.getPage(1);
            const {items} = await first.getTextContent();
            const rows = [];
            for (const item of items.filter(item => item.str?.trim())) {
                const y = item.transform[5];
                let row = rows.find(row => Math.abs(row.y-y) < 3);
                if (!row) { row = {y,items:[]}; rows.push(row); }
                row.items.push(item);
            }
            const text = rows.sort((a,b) => b.y-a.y).map(row =>
                row.items.sort((a,b) => a.transform[4]-b.transform[4]).map(item => item.str).join(' ')).join('\n');
            const parsed = parseBankTransfer(text);
            if (parsed.reference && parsed.amount && parsed.beneficiary) return text;
            if (text.replace(/\s/g,'').length > 100) return text;
            const canvas = document.createElement('canvas');
            const viewport = first.getViewport({scale:Math.min(3,2400/Math.max(first.view[2]-first.view[0],first.view[3]-first.view[1]))});
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await first.render({canvas,canvasContext:canvas.getContext('2d'),viewport}).promise;
            return await recognize(canvas);
        } finally {
            await task.destroy();
        }
    }

    const countries = {ETHIOPIA:'ETHIOPIAN',UGANDA:'UGANDAN',PHILIPPINES:'FILIPINO','SRI LANKA':'SRI LANKAN',
        INDIA:'INDIAN',BURUNDI:'BURUNDIAN',KENYA:'KENYAN',BANGLADESH:'BANGLADESHI',SOMALIA:'SOMALI'};

    function message(text, error = false) {
        status.textContent = text;
        status.hidden = !text;
        status.classList.toggle('transfer-error', error);
    }

    function snapshot() {
        if (active) active.values = Object.fromEntries(fields.map(field => [field.name, field.value]));
    }

    function renderQueue() {
        queueView.hidden = queue.length === 0;
        queueView.replaceChildren();
        for (const item of queue) {
            const row = document.createElement('div');
            row.className = 'transfer-file';
            row.classList.toggle('is-current', item === active);
            const fileLabel = document.createElement('div');
            const name = document.createElement('bdi');
            name.textContent = item.file.name;
            const state = document.createElement('small');
            state.textContent = item.savedId ? 'تم الحفظ' : item.error ? 'تحتاج مراجعة' : item.values ? 'جاهز للمراجعة' : 'بانتظار القراءة';
            fileLabel.append(name, state);
            const select = document.createElement(item.savedId ? 'a' : 'button');
            select.className = 'secondary';
            select.textContent = item.savedId ? 'عرض الحوالة' : 'معاينة وقراءة';
            if (item.savedId) select.href = page.dataset.page + '?id=' + encodeURIComponent(item.savedId);
            else {
                select.type = 'button';
                select.disabled = busy;
                select.addEventListener('click', () => openFile(item));
            }
            row.append(fileLabel, select);
            if (!item.savedId) {
                const remove = document.createElement('button');
                remove.type = 'button';
                remove.className = 'secondary transfer-remove';
                remove.textContent = 'إزالة';
                remove.setAttribute('aria-label', 'إزالة ' + item.file.name);
                remove.disabled = busy;
                remove.addEventListener('click', () => {
                    queue = queue.filter(entry => entry !== item);
                    if (active === item) {
                        active = null;
                        openFile(queue.find(entry => !entry.savedId) || null);
                    } else renderQueue();
                });
                row.append(remove);
            }
            queueView.append(row);
        }
    }

    async function showOriginal() {
        originalPreview.replaceChildren();
        if (previewUrl) URL.revokeObjectURL(previewUrl);
        previewUrl = null;
        if (!active || !original.open) return;
        const file = active.file;
        const pdf = /\.pdf$/i.test(file.name);
        previewUrl = URL.createObjectURL(file);
        if (!pdf) {
            const image = document.createElement('img');
            image.alt = 'معاينة أصل الحوالة';
            image.src = previewUrl;
            originalPreview.append(image);
            return;
        }
        const url = previewUrl;
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        link.textContent = 'فتح ملف PDF في تبويب جديد';
        originalPreview.append(link);
        let task;
        try {
            const pdfModule = await import(page.dataset.pdf);
            if (previewUrl !== url) return;
            pdfModule.GlobalWorkerOptions.workerSrc = page.dataset.base + '/assets/bank-transfer-pdf-worker.mjs';
            task = pdfModule.getDocument({data:await file.arrayBuffer(),isEvalSupported:false});
            const documentPdf = await task.promise;
            const first = await documentPdf.getPage(1);
            const viewport = first.getViewport({scale:Math.min(2,1400/Math.max(first.view[2]-first.view[0],first.view[3]-first.view[1]))});
            const canvas = document.createElement('canvas');
            canvas.width = viewport.width;
            canvas.height = viewport.height;
            await first.render({canvas,canvasContext:canvas.getContext('2d'),viewport}).promise;
            if (previewUrl === url) originalPreview.append(canvas);
        } catch {
            if (previewUrl === url) link.textContent = 'تعذرت المعاينة المدمجة. افتح ملف PDF في تبويب جديد.';
        } finally {
            if (task) await task.destroy();
        }
    }

    original.addEventListener('toggle', showOriginal);

    async function openFile(item) {
        if (busy) return;
        snapshot();
        active = item;
        reviewPanel.hidden = original.hidden = !item;
        original.open = false;
        showOriginal();
        renderQueue();
        if (!item) { message(''); return; }
        fields.forEach(field => { field.value = item.values?.[field.name] || ''; });
        preview.textContent = item.text || '';
        const newOffice = [...office.options].find(option => option.value === '__new__');
        if (newOffice) newOffice.textContent = 'إضافة المستفيد كمكتب جديد';
        updateOfficeFields();
        if (item.values) {
            message(item.error || 'راجع بيانات الحوالة قبل الحفظ.', Boolean(item.error));
            return;
        }
        setBusy(true);
        message('جارٍ قراءة الحوالة · ' + item.file.name);
        try {
            item.text = await read(item.file);
            preview.textContent = item.text;
            const data = parseBankTransfer(item.text);
            const match = matchingOffice(data.beneficiary,[...office.options].filter(option => option.value && option.value !== '__new__')
                .map(option => ({id:option.value,name:option.textContent})));
            if (newOffice && data.beneficiary) newOffice.textContent = 'مكتب جديد · ' + beneficiaryOfficeName(data.beneficiary);
            office.value = match || (match === '' && data.beneficiary && newOffice ? '__new__' : '');
            country.value = countries[data.office_country] || '';
            fields.filter(field => field !== office && field !== country).forEach(field => { field.value = data[field.name] || ''; });
            updateOfficeFields();
            const missing = fields.filter(field => field.required && !field.value);
            message(match === null ? 'أكثر من مكتب مطابق. اختر المكتب الصحيح.' :
                missing.length ? 'بعض البيانات تحتاج مراجعة. افتح المعاينة وأكمل الحقول المطلوبة.' :
                'تمت قراءة الملف. راجع البيانات قبل الحفظ.', missing.length > 0 || match === null);
        } catch (error) {
            item.error = error.message + ' افتح المعاينة وأكمل البيانات يدويًا عند الحاجة.';
            message(item.error, true);
        } finally {
            snapshot();
            setBusy(false);
        }
    }

    function addFiles(files) {
        if (busy) return;
        const accepted = [...files].filter(file => /\.(pdf|jpe?g|png|webp)$/i.test(file.name) && file.size > 0 && file.size <= 15*1024*1024);
        const entries = accepted.map(file => ({file}));
        queue.push(...entries);
        renderQueue();
        if (!active && entries.length) openFile(entries[0]);
        else if (entries.length) message('تمت إضافة الملفات. اختَر أي ملف لمعاينته وقراءته.');
        if (!entries.length && files.length) message('اختر PDF أو صورة JPG أو PNG أو WebP بحجم لا يتجاوز 15 ميجابايت.', true);
    }

    choose.addEventListener('click', () => input.click());
    input.addEventListener('change', () => {
        addFiles(input.files);
        input.value = '';
    });
    drop.addEventListener('dragover', event => {
        event.preventDefault();
        drop.classList.toggle('is-dragover', !busy);
    });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-dragover'));
    drop.addEventListener('drop', event => {
        event.preventDefault();
        drop.classList.remove('is-dragover');
        addFiles(event.dataTransfer.files);
    });

    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (busy || !active) return;
        snapshot();
        const item = active;
        setBusy(true);
        const body = new FormData();
        body.set('file',item.file);
        body.set('data',JSON.stringify(item.values));
        try {
            const response = await fetch(page.dataset.api,{
                method:'POST', body, headers:{'X-CSRF-Token':document.querySelector('meta[name=csrf-token]').content},
            });
            const data = await response.json();
            if (!response.ok || !data.id) throw new Error(data.error || 'تعذر الحفظ.');
            item.savedId = data.id;
            item.error = null;
            active = null;
        } catch (error) {
            item.error = error instanceof SyntaxError ? 'تعذر قراءة رد الخادم. راجع الاتصال وأعد المحاولة.' : error.message;
            message(item.error, true);
        } finally {
            setBusy(false);
        }
        if (item.savedId) {
            const next = queue.find(entry => !entry.savedId);
            await openFile(next || null);
            if (!next) message('تم حفظ الحوالة. افتحها من قائمة الملفات أو حدّث سجل الحوالات.');
        }
    });
}
