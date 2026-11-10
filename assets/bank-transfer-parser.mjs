export function normalizeBankText(text) {
    return text.normalize('NFKC').replace(/[\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '')
        .replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) & 15))
        .replace(/٫/g, '.').replace(/٬/g, ',').replace(/−/g, '-');
}

export function parseBankTransfer(raw) {
    const text = normalizeBankText(raw);
    const flat = text.replace(/\s+/g, ' ');
    const number = '[0-9]+(?:,[0-9]{3})*(?:\\.[0-9]{1,2})?';
    const cleanAmount = value => (value || '').replace(/,/g, '');
    const datePattern = '(\\d{2})[/-](\\d{2})[/-](\\d{4})';
    const isoDate = match => match ? [match[3], match[2], match[1]].join('-') : '';
    const nearDate = (label) => isoDate(text.match(new RegExp(datePattern + '[ \\t]+(?:' + label + ')', 'i')) ||
        text.match(new RegExp('(?:' + label + ')[ :\\t]*' + datePattern, 'i')));
    const reference = flat.match(/\b(?:ref(?:erence)?[.:\s]+)?(NCBK[A-Z0-9]{8,})\b/i)?.[1] ||
        flat.match(/(?:\bRef(?:erence)?|مرجع التحويل)[.:\s]+([A-Z0-9-]{6,80})\b/i)?.[1] || '';
    const escapedRef = reference.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const amountAfter = reference && flat.match(new RegExp(escapedRef + '\\s+(' + number + ')\\s+([A-Z]{3})\\b','i'));
    const amountBefore = reference && flat.match(new RegExp(escapedRef + '\\s+([A-Z]{3})\\s+(' + number + ')\\b','i'));
    const bankPattern = 'BDO\\s+UNIBANK(?:,?\\s*INC\\.?)?|KCB\\s+BANK\\s+KENYA\\s+LIMITED';
    const chain = reference && flat.match(new RegExp('(?:\\b([A-Z0-9]{6,34})\\s+)?(' + bankPattern + ')\\s+(.{3,200}?)\\s+' + escapedRef,'i'));
    const debit = text.match(new RegExp('[-–]\\s*(' + number + ')[^\\n]*المبلغ')) ||
        text.match(new RegExp('المبلغ[^\\n]*?[-–]\\s*(' + number + ')')) ||
        flat.match(new RegExp('[-–]\\s*(' + number + ')'));
    const labeled = label => text.match(new RegExp('(?:^|\\n)[ \\t]*(?:' + label + ')[ \\t]*:[ \\t]*([^\\n]+)','i'))?.[1]?.trim() || '';
    return {
        reference: reference.toUpperCase(),
        office_country: flat.match(/CHNL\s*:\s*E-CORP\s+([A-Z ]{3,35}?)\s+FREX/i)?.[1]?.trim().toUpperCase() || '',
        transfer_date: nearDate('تاريخ التنفيذ|التاريخ|Transaction Date'),
        value_date: nearDate('Value Date|تاريخ القيمة'),
        bank: chain?.[2]?.trim() || labeled('Beneficiary Bank|بنك المستفيد'),
        beneficiary: chain?.[3]?.trim() || labeled('Beneficiary(?: Name)?|اسم المستفيد'),
        beneficiary_account: chain?.[1] || labeled('Beneficiary Account|حساب المستفيد'),
        amount: cleanAmount(amountAfter?.[1] || amountBefore?.[2]),
        currency: (amountAfter?.[2] || amountBefore?.[1] || '').toUpperCase(),
        debit_sar: cleanAmount(debit?.[1]),
        charges: cleanAmount(flat.match(new RegExp('Charges\\s*:?\\s*(?:تفاصيل\\s+)?(' + number + ')','i'))?.[1]),
    };
}

export function beneficiaryOfficeName(value) {
    return value.trim().replace(/\s+OF$/i, '');
}

export function matchingOffice(beneficiary, offices) {
    const key = value => normalizeBankText(value).toUpperCase().replace(/[^\p{L}\p{N}]/gu, '');
    const candidate = key(beneficiaryOfficeName(beneficiary));
    if (!candidate) return '';
    const matches = offices.filter(office => key(beneficiaryOfficeName(office.name)) === candidate);
    return matches.length === 1 ? matches[0].id : matches.length > 1 ? null : '';
}
