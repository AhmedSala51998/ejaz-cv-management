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
    const skip = document.querySelector('#skip-transfer');
    const preview = document.querySelector('#transfer-text');
    const fields = [...form.querySelectorAll('[name]')];
    let queue = [], index = 0, saved = 0, busy = false;

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
        input.disabled = save.disabled = skip.disabled = value;
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

    async function review() {
        const file = queue[index];
        if (!file) {
            if (saved) window.location.assign(page.dataset.page);
            else form.reset();
            return;
        }
        const position = `ملف ${index+1} من ${queue.length} · ${file.name}`;
        setBusy(true);
        fields.forEach(field => { field.value = ''; });
        preview.textContent = '';
        updateOfficeFields();
        skip.hidden = queue.length < 2;
        status.textContent = 'جارٍ القراءة · ' + position;
        try {
            const text = await read(file);
            const data = parseBankTransfer(text);
            preview.textContent = text;
            const match = matchingOffice(data.beneficiary,[...office.options].filter(option => option.value && option.value !== '__new__')
                .map(option => ({id:option.value,name:option.textContent})));
            const newOffice = [...office.options].find(option => option.value === '__new__');
            if (newOffice) newOffice.textContent = data.beneficiary
                ? 'مكتب جديد · ' + beneficiaryOfficeName(data.beneficiary) : 'إضافة المستفيد كمكتب جديد';
            office.value = match || (match === '' && data.beneficiary && newOffice ? '__new__' : '');
            const countries = {ETHIOPIA:'ETHIOPIAN',UGANDA:'UGANDAN',PHILIPPINES:'FILIPINO','SRI LANKA':'SRI LANKAN',
                INDIA:'INDIAN',BURUNDI:'BURUNDIAN',KENYA:'KENYAN',BANGLADESH:'BANGLADESHI',SOMALIA:'SOMALI'};
            country.value = countries[data.office_country] || '';
            fields.filter(field => field !== office && field !== country).forEach(field => { field.value = data[field.name] || ''; });
            updateOfficeFields();
            status.textContent = position + (match === null ? ' · أكثر من مكتب مطابق. اختر المكتب الصحيح.' :
                office.value === '__new__' ? ' · المكتب الجديد محدد. راجع الاسم والبلد قبل الحفظ.' : ' · راجع البيانات والمكتب قبل الحفظ.');
        } catch (error) {
            status.textContent = position + ' · ' + error.message + ' راجع الملف وأكمل البيانات يدويًا عند الحاجة.';
        } finally {
            setBusy(false);
        }
    }

    input.addEventListener('change', () => {
        queue = [...input.files];
        index = saved = 0;
        review();
    });
    skip.addEventListener('click', () => {
        if (!busy) { index++; review(); }
    });
    form.addEventListener('submit', async event => {
        event.preventDefault();
        if (busy || !queue[index]) return;
        setBusy(true);
        const body = new FormData();
        body.set('file',queue[index]);
        body.set('data',JSON.stringify(Object.fromEntries(fields.map(field => [field.name,field.value.trim()]))));
        try {
            const response = await fetch(page.dataset.api,{
                method:'POST', body, headers:{'X-CSRF-Token':document.querySelector('meta[name=csrf-token]').content},
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'تعذر الحفظ.');
            saved++;
            if (queue.length === 1) {
                window.location.assign(page.dataset.page + '?id=' + encodeURIComponent(data.id));
                return;
            }
            index++;
            await review();
        } catch (error) {
            status.textContent = error.message;
        } finally {
            setBusy(false);
        }
    });
}
