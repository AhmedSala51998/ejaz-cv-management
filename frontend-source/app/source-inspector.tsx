import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { X, FileSearch } from "lucide-react";
import { CV, fields } from "@/lib/fields";
export function inspectField(key: string, page?: number) {
    window.dispatchEvent(new CustomEvent("ejaz-inspect", { detail: { key, page } }));
}
export default function SourceInspector({
    data,
    url,
    filename,
}: {
    data: CV;
    url: string;
    filename: string;
}) {
    const [selected, setSelected] = useState<{ key: string; page: number } | null>(null),
        [word, setWord] = useState("");
    let evidence: Record<string, any[]> = {};
    try {
        evidence = JSON.parse(data._evidence || "{}");
    } catch {}
    useEffect(() => {
        const handle = (event: Event) => {
            const { key, page } = (event as CustomEvent).detail;
            let map: any = {};
            try {
                map = JSON.parse(data._evidence || "{}");
            } catch {}
            setSelected({ key, page: page || map[key]?.[0]?.page || 1 });
        };
        window.addEventListener("ejaz-inspect", handle);
        return () => window.removeEventListener("ejaz-inspect", handle);
    }, [data]);
    useEffect(() => {
        if (!selected) return;
        const key = (e: KeyboardEvent) => {
            if (e.key === "Escape") setSelected(null);
        };
        window.addEventListener("keydown", key);
        return () => window.removeEventListener("keydown", key);
    }, [selected]);
    useEffect(() => {
        let alive = true;
        if (selected && /\.docx$/i.test(filename)) {
            setWord("");
            fetch(url)
                .then((r) => r.arrayBuffer())
                .then(async (arrayBuffer) => {
                    const m = await import("mammoth");
                    const result = await m.extractRawText({ arrayBuffer });
                    if (alive) setWord(result.value);
                })
                .catch(() => setWord("تعذرت معاينة Word؛ افتح الملف الأصلي."));
        }
        return () => {
            alive = false;
        };
    }, [selected?.key, url]);
    if (!selected) return null;
    const items = evidence[selected.key] || [];
    return createPortal(
        <div className="modal-backdrop source-inspector">
            <section className="modal large">
                <div className="section-head">
                    <h2>
                        <FileSearch size={19} />
                        مراجعة {fields.find((f) => f[0] === selected.key)?.[1]}
                    </h2>
                    <button className="icon" aria-label="إغلاق" onClick={() => setSelected(null)}>
                        <X />
                    </button>
                </div>
                <div className="source-split">
                    <aside>
                        <h3 dir="auto">{data[selected.key] || "غير مقروء / غير مذكور"}</h3>
                        <p>الصفحة {selected.page} · راجع القيمة مقابل الأصل قبل اعتمادها.</p>
                        {items.length ? (
                            items.map((v, i) => (
                                <button
                                    className="evidence-option"
                                    key={i}
                                    onClick={() => setSelected({ ...selected, page: v.page })}
                                >
                                    <b dir="auto">{v.value}</b>
                                    <small>
                                        {v.method} · صفحة {v.page}
                                    </small>
                                </button>
                            ))
                        ) : (
                            <p>لا يوجد مصدر آلي محدد لهذا الحقل. راجع الملف الأصلي.</p>
                        )}
                        <a className="secondary" href={url} target="_blank" rel="noreferrer">
                            فتح الأصل
                        </a>
                    </aside>
                    <div>
                        {/\.pdf$/i.test(filename) ? (
                            <iframe
                                title="الصفحة الأصلية"
                                key={selected.page}
                                src={url + "#page=" + selected.page + "&toolbar=1"}
                            />
                        ) : /\.(png|jpg|jpeg|webp)$/i.test(filename) ? (
                            <img className="original-image" src={url} alt="الأصل" />
                        ) : (
                            <pre dir="auto">
                                {word || data.extractedText || "افتح الملف الأصلي لعرض مستند Word."}
                            </pre>
                        )}
                    </div>
                </div>
            </section>
        </div>,
        document.body,
    );
}
