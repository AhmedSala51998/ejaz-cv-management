import { normalizeNationality } from "@/lib/countries";
import { basePath } from "@/lib/base";
import { useEffect, useState } from "react";
import {
    Search,
    Plus,
    Files,
    ShieldCheck,
    Globe2,
    Printer,
    Download,
    FileText,
    Pencil,
    X,
    LoaderCircle,
    ChevronLeft,
    ChevronRight,
    Settings2,
    Columns3,
    Clock3,
    RefreshCw,
    CheckSquare,
} from "lucide-react";
import { Header, Footer, Badge, CVForm, RegistryModal, FieldEditor } from "../hostinger-components";
import { validDate } from "@/lib/parser";
import { CV, fields, val } from "@/lib/fields";
import { unresolved, acknowledgeAll } from "@/lib/field-review";
import SourceInspector, { inspectField } from "../source-inspector";
import WorkspaceSettings, { api } from "../workspace-settings";
import { exportCVZip, download } from "@/lib/cv-export";
type RecordItem = {
    id: string;
    name: string;
    passport: string;
    nationality: string;
    listed: number;
    data: CV;
    photo: string;
    filename: string;
    source: string;
    updated: string;
    version: number;
    workflow_status: string;
    workflow_note: string;
};
const states: Record<string, string> = {
    available: "متاحة",
    reserved: "محجوزة",
    contracted: "تم التعاقد",
    excluded: "مستبعدة",
};
function expiry(data: CV) {
    const v = data.expiryDate || "";
    if (!validDate(v)) return null;
    const m = v.match(/^(\d{1,2})[/. -](\d{1,2})[/. -](\d{4})$/),
        iso = v.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    const time = m
        ? Date.UTC(+m[3], +m[2] - 1, +m[1])
        : iso
          ? Date.UTC(+iso[1], +iso[2] - 1, +iso[3])
          : Date.parse(v + " UTC");
    if (!Number.isFinite(time)) return null;
    const parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: "Asia/Riyadh",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
        }).formatToParts(new Date()),
        number = (key: string) => Number(parts.find((p) => p.type === key)?.value);
    return Math.round(
        (time - Date.UTC(number("year"), number("month") - 1, number("day"))) / 86400000,
    );
}

function languageMatches(data: CV, query: string) {
    const q = query.toLowerCase().trim(),
        key = /english|انجلي|إنجلي/.test(q) ? "english" : /arabic|عرب/.test(q) ? "arabic" : "";
    if (key) {
        const value = (data[key] || "").trim();
        return !!value && !/^(no|none|لا|غير متاح)$/i.test(value);
    }
    return ["english", "arabic"].some((k) =>
        [data[k], val(data[k], "ar")].join(" ").toLowerCase().includes(q),
    );
}
function skillMatches(value: string, query: string) {
    const aliases: Record<string, string> = {
        تنظيف: "clean",
        طبخ: "cook",
        غسل: "wash",
        كي: "iron",
        طفل: "baby",
        أطفال: "baby",
        مسنين: "elder",
        قيادة: "driv",
        تسوق: "shop",
        حديقة: "garden",
    };
    const q = query.trim().toLowerCase();
    return (
        value.toLowerCase().includes(q) ||
        (!!aliases[q] && value.toLowerCase().includes(aliases[q]))
    );
}
export default function RecordsPage() {
    const [records, setRecords] = useState<RecordItem[]>([]),
        [loading, setLoading] = useState(true),
        [error, setError] = useState(""),
        [search, setSearch] = useState(
            () => new URLSearchParams(location.search).get("passport") || "",
        ),
        [status, setStatus] = useState("all"),
        [country, setCountry] = useState(""),
        [langs, setLangs] = useState<Record<string, string>>({}),
        [registry, setRegistry] = useState(false),
        [edit, setEdit] = useState<RecordItem | null>(null),
        [busy, setBusy] = useState(false),
        [page, setPage] = useState(1),
        [selected, setSelected] = useState<string[]>([]),
        [compare, setCompare] = useState(false),
        [settings, setSettings] = useState(false),
        [history, setHistory] = useState<any[] | null>(null),
        [historyRecord, setHistoryRecord] = useState<RecordItem | null>(null),
        [sourceRecord, setSourceRecord] = useState<RecordItem | null>(null),
        [progress, setProgress] = useState(""),
        [exportLang, setExportLang] = useState("ar"),
        [permissions, setPermissions] = useState<string[]>([]),
        [meta, setMeta] = useState<RecordItem | null>(null),
        [filter, setFilter] = useState({
            workflow: "",
            religion: "",
            minAge: "",
            maxAge: "",
            maxSalary: "",
            currency: "",
            language: "",
            skill: "",
            experience: "",
            expiry: "",
            review: "",
        });
    const can = (p: string) => permissions.includes(p);
    async function load() {
        setLoading(true);
        try {
            const [r, m] = await Promise.all([api("records"), api("workspace/me")]);
            setRecords(r.records);
            setPermissions(m.permissions);
            setSelected((ids) => ids.filter((id) => r.records.some((r: any) => r.id === id)));
            setError("");
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setLoading(false);
        }
    }
    useEffect(() => {
        load();
    }, []);
    useEffect(() => setPage(1), [search, status, country, filter]);
    const filtered = records.filter((r) => {
        const d = r.data,
            age = Number(d.age),
            salary = Number(d.salary?.replace(/[^\d.]/g, "")),
            days = expiry(d),
            term = [r.name, r.passport, r.nationality, ...Object.values(d).filter((_, i) => i < 45)]
                .join(" ")
                .toLowerCase();
        return (
            (status === "all" || (status === "listed" ? !!r.listed : !r.listed)) &&
            (!country || (normalizeNationality(r.nationality) || r.nationality) === country) &&
            term.includes(search.toLowerCase()) &&
            (!filter.workflow || (r.workflow_status || "available") === filter.workflow) &&
            (!filter.religion || d.religion === filter.religion) &&
            (!filter.minAge || (!!d.age && age >= Number(filter.minAge))) &&
            (!filter.maxAge || (!!d.age && age <= Number(filter.maxAge))) &&
            (!filter.maxSalary || (!!d.salary && salary <= Number(filter.maxSalary))) &&
            (!filter.currency || d.currency === filter.currency) &&
            (!filter.skill || skillMatches(d.skills || "", filter.skill)) &&
            (!filter.language || languageMatches(d, filter.language)) &&
            (!filter.experience ||
                (filter.experience === "yes"
                    ? !/first timer|no experience|بدون|^new$|^nil$/i.test(d.experience || "") &&
                      !!d.experience
                    : /first timer|no experience|بدون|^new$|^nil$/i.test(d.experience || ""))) &&
            (!filter.expiry ||
                (days !== null &&
                    (filter.expiry === "expired" ? days < 0 : days >= 0 && days <= 90))) &&
            (!filter.review ||
                (filter.review === "pending" ? unresolved(d) > 0 : unresolved(d) === 0))
        );
    });
    const shown = filtered.slice((page - 1) * 6, page * 6),
        chosen = records.filter((r) => selected.includes(r.id)),
        countries = Array.from(
            new Set(
                records
                    .map((r) => normalizeNationality(r.nationality) || r.nationality)
                    .filter(Boolean),
            ),
        ),
        religions = Array.from(new Set(records.map((r) => r.data.religion).filter(Boolean)));
    function reset() {
        setSearch("");
        setCountry("");
        setStatus("all");
        setFilter({
            workflow: "",
            religion: "",
            minAge: "",
            maxAge: "",
            maxSalary: "",
            currency: "",
            language: "",
            skill: "",
            experience: "",
            expiry: "",
            review: "",
        });
    }
    async function save() {
        if (!edit) return;
        setBusy(true);
        try {
            await api("records", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(edit),
            });
            setEdit(null);
            await load();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }
    async function saveMeta() {
        if (!meta) return;
        setBusy(true);
        try {
            await api("workspace/meta", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    id: meta.id,
                    version: meta.version,
                    status: meta.workflow_status || "available",
                    note: meta.workflow_note || "",
                }),
            });
            setMeta(null);
            await load();
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    }
    function print(id: string) {
        document
            .querySelectorAll(".record-card")
            .forEach((el) =>
                el.classList.toggle("print-selected", el.getAttribute("data-record") === id),
            );
        window.print();
    }
    async function bulk() {
        if (!chosen.length || busy) return;
        setBusy(true);
        try {
            const blob = await exportCVZip(chosen, exportLang, setProgress);
            download(blob, "ejaz-cvs-" + exportLang + ".zip");
            setProgress("تم تجهيز " + chosen.length + " ملف PDF");
        } catch (e) {
            setError("تعذر تجهيز التصدير: " + (e as Error).message);
        } finally {
            setBusy(false);
        }
    }
    function csv() {
        const rows = [
            fields.map((f) => f[1]),
            ...filtered.map((r) => fields.map(([k]) => r.data[k] || "")),
        ];
        download(
            new Blob(
                [
                    "\ufeffsep=,\r\n" +
                        rows
                            .map((row) =>
                                row
                                    .map(
                                        (v) =>
                                            '"' +
                                            (/^[=+@-]/.test(v) ? "'" : "") +
                                            v.replace(/"/g, '""') +
                                            '"',
                                    )
                                    .join(","),
                            )
                            .join("\r\n"),
                ],
                { type: "text/csv;charset=utf-8" },
            ),
            "ejaz-cvs.csv",
        );
    }
    async function showHistory(r: RecordItem) {
        try {
            setHistoryRecord(r);
            setHistory((await api("workspace/history?id=" + encodeURIComponent(r.id))).rows);
        } catch (e) {
            setError((e as Error).message);
        }
    }
    async function fullRecord(r: RecordItem) {
        const full = await api("record?id=" + encodeURIComponent(r.id));
        return { ...r, ...full.record };
    }
    async function showEdit(r: RecordItem) {
        try {
            setEdit(await fullRecord(r));
        } catch (e) {
            setError((e as Error).message);
        }
    }
    async function showSource(r: RecordItem, key = "passport") {
        try {
            setSourceRecord(await fullRecord(r));
            setTimeout(() => inspectField(key), 30);
        } catch (e) {
            setError((e as Error).message);
        }
    }
    return (
        <>
            <Header active="records" />
            <main>
                <section className="page-intro">
                    <div>
                        <span className="eyebrow">مساحة العمل · إدارة ومراجعة</span>
                        <h1>السير الذاتية</h1>
                        <p>ابحث، قارن، وراجع الأصل قبل الاعتماد.</p>
                    </div>
                    <div className="upgrade-actions">
                        <button className="secondary" onClick={load}>
                            <RefreshCw size={16} />
                            تحديث
                        </button>
                        {can("manage") && (
                            <button className="secondary" onClick={() => setSettings(true)}>
                                <Settings2 size={17} />
                                إدارة مساحة العمل
                            </button>
                        )}
                        {can("create") && (
                            <a href={basePath + "/"} className="primary">
                                <Plus size={17} />
                                استيراد سير
                            </a>
                        )}
                    </div>
                </section>
                <div className="stats upgrade-stats">
                    <div>
                        <Files />
                        <p>
                            السير المحفوظة<strong>{records.length}</strong>
                        </p>
                    </div>
                    <div>
                        <CheckSquare />
                        <p>
                            متاحة
                            <strong>
                                {
                                    records.filter(
                                        (r) => (r.workflow_status || "available") === "available",
                                    ).length
                                }
                            </strong>
                        </p>
                    </div>
                    <div>
                        <Clock3 />
                        <p>
                            جوازات تحتاج انتباهًا
                            <strong>
                                {
                                    records.filter((r) => {
                                        const d = expiry(r.data);
                                        return d !== null && d <= 90;
                                    }).length
                                }
                            </strong>
                        </p>
                    </div>
                    <div>
                        <ShieldCheck />
                        <p>
                            تحتاج مراجعة
                            <strong>{records.filter((r) => unresolved(r.data) > 0).length}</strong>
                        </p>
                    </div>
                </div>
                <div className="records-controls">
                    <div className="filter-tabs">
                        {[
                            ["all", "كل السير"],
                            ["listed", "المطابقة"],
                            ["archive", "أرشيف المطابقة"],
                        ].map(([k, v]) => (
                            <button
                                className={status === k ? "active" : ""}
                                key={k}
                                onClick={() => setStatus(k)}
                            >
                                {v}
                            </button>
                        ))}
                    </div>
                    {can("manage") && (
                        <button className="text-button" onClick={() => setRegistry(true)}>
                            قائمة الجوازات
                        </button>
                    )}
                </div>
                <section className="workspace-search">
                    <label className="search-input">
                        <Search size={19} />
                        <input
                            placeholder="الاسم، الجواز أو أي بيانات…"
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </label>
                    <div className="advanced-grid">
                        <label>
                            الجنسية
                            <select value={country} onChange={(e) => setCountry(e.target.value)}>
                                <option value="">الكل</option>
                                {countries.map((c) => (
                                    <option key={c} value={c}>
                                        {val(c, "ar")}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            حالة العاملة
                            <select
                                value={filter.workflow}
                                onChange={(e) => setFilter({ ...filter, workflow: e.target.value })}
                            >
                                <option value="">الكل</option>
                                {Object.entries(states).map(([k, v]) => (
                                    <option key={k} value={k}>
                                        {v}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            الديانة
                            <select
                                value={filter.religion}
                                onChange={(e) => setFilter({ ...filter, religion: e.target.value })}
                            >
                                <option value="">الكل</option>
                                {religions.map((r) => (
                                    <option key={r} value={r}>
                                        {val(r, "ar")}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            العمر من
                            <input
                                type="number"
                                min="0"
                                value={filter.minAge}
                                onChange={(e) => setFilter({ ...filter, minAge: e.target.value })}
                            />
                        </label>
                        <label>
                            العمر إلى
                            <input
                                type="number"
                                min="0"
                                value={filter.maxAge}
                                onChange={(e) => setFilter({ ...filter, maxAge: e.target.value })}
                            />
                        </label>
                        <label>
                            أقصى راتب
                            <input
                                type="number"
                                min="0"
                                value={filter.maxSalary}
                                onChange={(e) =>
                                    setFilter({ ...filter, maxSalary: e.target.value })
                                }
                            />
                        </label>
                        <label>
                            العملة
                            <select
                                value={filter.currency}
                                onChange={(e) => setFilter({ ...filter, currency: e.target.value })}
                            >
                                <option value="">الكل</option>
                                {Array.from(
                                    new Set(records.map((r) => r.data.currency).filter(Boolean)),
                                ).map((v) => (
                                    <option key={v}>{v}</option>
                                ))}
                            </select>
                        </label>
                        <label>
                            الخبرة
                            <select
                                value={filter.experience}
                                onChange={(e) =>
                                    setFilter({ ...filter, experience: e.target.value })
                                }
                            >
                                <option value="">الكل</option>
                                <option value="yes">لديها خبرة</option>
                                <option value="no">بدون خبرة</option>
                            </select>
                        </label>
                        <label>
                            اللغة
                            <input
                                placeholder="English، العربية أو مستوى اللغة"
                                value={filter.language}
                                onChange={(e) => setFilter({ ...filter, language: e.target.value })}
                            />
                        </label>
                        <label>
                            المهارة
                            <input
                                value={filter.skill}
                                onChange={(e) => setFilter({ ...filter, skill: e.target.value })}
                            />
                        </label>
                        <label>
                            الجواز
                            <select
                                value={filter.expiry}
                                onChange={(e) => setFilter({ ...filter, expiry: e.target.value })}
                            >
                                <option value="">الكل</option>
                                <option value="expired">منتهي</option>
                                <option value="soon">ينتهي خلال 90 يومًا</option>
                            </select>
                        </label>
                        <label>
                            المراجعة
                            <select
                                value={filter.review}
                                onChange={(e) => setFilter({ ...filter, review: e.target.value })}
                            >
                                <option value="">الكل</option>
                                <option value="pending">تحتاج مراجعة</option>
                                <option value="done">لا توجد تنبيهات معلقة</option>
                            </select>
                        </label>
                    </div>
                    <div className="upgrade-actions">
                        <button className="secondary" onClick={reset}>
                            مسح الفلاتر
                        </button>
                        {can("export") && (
                            <button className="secondary" disabled={!filtered.length} onClick={csv}>
                                <Download size={16} />
                                تصدير نتائج البحث CSV
                            </button>
                        )}
                    </div>
                </section>
                <div className="selection-toolbar">
                    <label>
                        <input
                            type="checkbox"
                            checked={
                                !!filtered.length && filtered.every((r) => selected.includes(r.id))
                            }
                            onChange={(e) =>
                                setSelected(
                                    e.target.checked
                                        ? Array.from(
                                              new Set([...selected, ...filtered.map((r) => r.id)]),
                                          )
                                        : selected.filter(
                                              (id) => !filtered.some((r) => r.id === id),
                                          ),
                                )
                            }
                        />
                        تحديد نتائج البحث ({filtered.length})
                    </label>
                    <span>{selected.length} محددة</span>
                    <button
                        className="secondary"
                        disabled={chosen.length < 2 || chosen.length > 4}
                        onClick={() => setCompare(true)}
                    >
                        <Columns3 size={16} />
                        مقارنة (2–4)
                    </button>
                    {can("export") && (
                        <>
                            <select
                                aria-label="لغة التصدير"
                                value={exportLang}
                                onChange={(e) => setExportLang(e.target.value)}
                            >
                                <option value="ar">العربية</option>
                                <option value="en">English</option>
                            </select>
                            <button
                                className="primary"
                                disabled={!chosen.length || busy}
                                onClick={bulk}
                            >
                                <Download size={16} />
                                {busy ? progress : "تنزيل PDF داخل ZIP"}
                            </button>
                        </>
                    )}
                    <button className="text-button" onClick={() => setSelected([])}>
                        إلغاء التحديد
                    </button>
                </div>
                {progress && !busy && (
                    <p role="status" className="notice">
                        {progress}
                    </p>
                )}
                {error && (
                    <p className="notice" role="alert">
                        {error}
                    </p>
                )}
                {loading ? (
                    <div className="empty-review">
                        <LoaderCircle className="spin" />
                        جارٍ تحميل السجلات…
                    </div>
                ) : !filtered.length ? (
                    <div className="empty-review">لا توجد سير مطابقة.</div>
                ) : (
                    shown.map((r) => {
                        const lang = langs[r.id] || "ar",
                            days = expiry(r.data);
                        return (
                            <article className="record-card" key={r.id} data-record={r.id}>
                                <div className="record-title">
                                    <div>
                                        <label className="record-pick">
                                            <input
                                                type="checkbox"
                                                aria-label={"تحديد " + r.name}
                                                checked={selected.includes(r.id)}
                                                onChange={(e) =>
                                                    setSelected(
                                                        e.target.checked
                                                            ? Array.from(
                                                                  new Set([...selected, r.id]),
                                                              )
                                                            : selected.filter((id) => id !== r.id),
                                                    )
                                                }
                                            />
                                            ملف {r.passport}
                                        </label>
                                        <h2>{r.data.nameAr || r.name}</h2>
                                        <small>
                                            {val(r.nationality, "ar")} · {val(r.data.job, "ar")}
                                        </small>
                                    </div>
                                    <div className="record-badges">
                                        <span
                                            className={
                                                "workflow-badge " +
                                                (r.workflow_status || "available")
                                            }
                                        >
                                            {states[r.workflow_status || "available"]}
                                        </span>
                                        <Badge listed={!!r.listed} />
                                        {days !== null && days <= 90 && (
                                            <span className="expiry-alert">
                                                {days < 0
                                                    ? "الجواز منتهي"
                                                    : "ينتهي الجواز خلال " + days + " يومًا"}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="record-content">
                                    <div className="record-info">
                                        <div className="record-section-heading">
                                            <FileText />
                                            <h3>ملخص السيرة</h3>
                                        </div>
                                        <dl>
                                            {[
                                                "name",
                                                "nationality",
                                                "job",
                                                "religion",
                                                "passport",
                                                "age",
                                                "marital",
                                                "salary",
                                                "experience",
                                            ].map((k) => (
                                                <div key={k}>
                                                    <dt>{fields.find((f) => f[0] === k)?.[1]}</dt>
                                                    <dd dir="auto">
                                                        {val(r.data[k], "ar")}{" "}
                                                        {k === "salary" ? r.data.currency : ""}
                                                    </dd>
                                                </div>
                                            ))}
                                        </dl>
                                        {r.workflow_note && (
                                            <p className="notice">{r.workflow_note}</p>
                                        )}
                                        <div className="upgrade-actions record-upgrade-actions">
                                            {can("edit") && (
                                                <>
                                                    <button
                                                        className="primary"
                                                        onClick={() => showEdit(r)}
                                                    >
                                                        <Pencil size={15} />
                                                        تعديل البيانات
                                                    </button>
                                                    <button
                                                        className="secondary"
                                                        onClick={() => setMeta({ ...r })}
                                                    >
                                                        الحالة والملاحظات
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                className="secondary"
                                                onClick={() => showSource(r)}
                                            >
                                                مراجعة الأصل
                                            </button>
                                            <a
                                                className="secondary"
                                                href={
                                                    basePath +
                                                    "/api/files?key=" +
                                                    encodeURIComponent(r.source)
                                                }
                                                target="_blank"
                                                rel="noreferrer"
                                            >
                                                الملف الأصلي
                                            </a>
                                            {can("review") && (
                                                <button
                                                    className="secondary"
                                                    onClick={() => showHistory(r)}
                                                >
                                                    النسخ السابقة
                                                </button>
                                            )}
                                        </div>
                                        <div className="update-note">
                                            الإصدار {r.version} ·{" "}
                                            {new Date(r.updated).toLocaleDateString("ar-SA", {
                                                calendar: "gregory",
                                            })}{" "}
                                            · {unresolved(r.data)} تنبيه مراجعة
                                        </div>
                                    </div>
                                    <div className="record-form">
                                        <div className="form-toolbar">
                                            <span>
                                                <Globe2 size={16} />
                                                نموذج السيرة الذاتية
                                            </span>
                                            <div className="language-switch">
                                                {["ar", "en"].map((l) => (
                                                    <button
                                                        key={l}
                                                        className={lang === l ? "active" : ""}
                                                        onClick={() =>
                                                            setLangs({ ...langs, [r.id]: l })
                                                        }
                                                    >
                                                        {l === "ar" ? "العربية" : "English"}
                                                    </button>
                                                ))}
                                            </div>
                                            {can("export") && (
                                                <div className="blank-cv-downloads" aria-label="تحميل نموذج سيرة ذاتية فارغ">
                                                    <a className="secondary" href={basePath + "/templates/ejaz-blank-cv-" + lang + ".docx?v=28"} download={"ejaz-blank-cv-" + lang + ".docx"} title={"تحميل نموذج Word فارغ — " + (lang === "ar" ? "العربية" : "English")}>
                                                        <Download size={15} /> Word فارغ
                                                    </a>
                                                    <a className="secondary" href={basePath + "/templates/ejaz-blank-cv-" + lang + ".pdf?v=28"} download={"ejaz-blank-cv-" + lang + ".pdf"} title={"تحميل نموذج PDF فارغ — " + (lang === "ar" ? "العربية" : "English")}>
                                                        <Download size={15} /> PDF فارغ
                                                    </a>
                                                </div>
                                            )}
                                            {can("export") && (
                                                <button
                                                    className="icon"
                                                    title="طباعة أو حفظ PDF"
                                                    onClick={() => print(r.id)}
                                                >
                                                    <Printer size={18} />
                                                </button>
                                            )}
                                        </div>
                                        <CVForm
                                            data={r.data}
                                            photo={
                                                r.photo
                                                    ? basePath +
                                                      "/api/files?key=" +
                                                      encodeURIComponent(r.photo)
                                                    : undefined
                                            }
                                            lang={lang}
                                        />
                                    </div>
                                </div>
                            </article>
                        );
                    })
                )}
                {filtered.length > 6 && (
                    <div className="pagination">
                        <button
                            className="secondary"
                            disabled={page === 1}
                            onClick={() => setPage(page - 1)}
                        >
                            <ChevronRight />
                            السابق
                        </button>
                        <span>
                            {page} / {Math.ceil(filtered.length / 6)}
                        </span>
                        <button
                            className="secondary"
                            disabled={page * 6 >= filtered.length}
                            onClick={() => setPage(page + 1)}
                        >
                            التالي
                            <ChevronLeft />
                        </button>
                    </div>
                )}
            </main>
            <Footer />
            {registry && <RegistryModal close={() => setRegistry(false)} onDone={load} />}{" "}
            {settings && (
                <WorkspaceSettings
                    close={() => {
                        setSettings(false);
                        load();
                    }}
                />
            )}
            {edit && (
                <div className="modal-backdrop">
                    <section className="modal large">
                        <div className="section-head">
                            <h2>تعديل ومراجعة السيرة</h2>
                            <button
                                className="icon"
                                aria-label="إغلاق"
                                onClick={() => setEdit(null)}
                            >
                                <X />
                            </button>
                        </div>
                        <button
                            className="secondary"
                            type="button"
                            onClick={() => {
                                if (
                                    confirm(
                                        "أنت تؤكد مراجعة جميع حقول السيرة مقابل الأصل. القيم الفارغة ستظل فارغة.",
                                    )
                                )
                                    setEdit({ ...edit, data: acknowledgeAll(edit.data) });
                            }}
                        >
                            تمت مراجعة كل الحقول
                        </button>
                        <p className="notice">
                            الجواز معرّف ثابت. استخدم «مراجعة الأصل» بجانب الحقول، ثم صحّح البيانات
                            واعتمدها.
                        </p>
                        <FieldEditor
                            data={edit.data}
                            onChange={(d) =>
                                setEdit({ ...edit, data: { ...d, passport: edit.passport } })
                            }
                        />
                        {error && <p className="notice">{error}</p>}
                        <button className="primary" disabled={busy} onClick={save}>
                            حفظ التعديلات
                        </button>
                        <SourceInspector
                            data={edit.data}
                            url={basePath + "/api/files?key=" + encodeURIComponent(edit.source)}
                            filename={edit.filename}
                        />
                    </section>
                </div>
            )}
            {meta && (
                <div className="modal-backdrop">
                    <section className="modal">
                        <div className="section-head">
                            <h2>الحالة والملاحظات</h2>
                            <button
                                className="icon"
                                aria-label="إغلاق"
                                onClick={() => setMeta(null)}
                            >
                                <X />
                            </button>
                        </div>
                        <label>
                            حالة العاملة
                            <select
                                value={meta.workflow_status || "available"}
                                onChange={(e) =>
                                    setMeta({ ...meta, workflow_status: e.target.value })
                                }
                            >
                                {Object.entries(states).map(([k, v]) => (
                                    <option key={k} value={k}>
                                        {v}
                                    </option>
                                ))}
                            </select>
                        </label>
                        <label>
                            ملاحظة داخلية
                            <textarea
                                maxLength={4000}
                                value={meta.workflow_note || ""}
                                onChange={(e) =>
                                    setMeta({ ...meta, workflow_note: e.target.value })
                                }
                            />
                        </label>
                        {error && <p className="notice">{error}</p>}
                        <button className="primary" disabled={busy} onClick={saveMeta}>
                            حفظ
                        </button>
                    </section>
                </div>
            )}
            {compare && (
                <div className="modal-backdrop">
                    <section className="modal large">
                        <div className="section-head">
                            <h2>مقارنة السير</h2>
                            <button
                                className="icon"
                                aria-label="إغلاق"
                                onClick={() => setCompare(false)}
                            >
                                <X />
                            </button>
                        </div>
                        <div className="scroll-table comparison">
                            <table>
                                <thead>
                                    <tr>
                                        <th>البيان</th>
                                        {chosen.map((r) => (
                                            <th key={r.id}>
                                                {r.data.nameAr || r.name}
                                                <small>{r.passport}</small>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody>
                                    {fields
                                        .filter(([k]) => !["notes", "nameAr"].includes(k))
                                        .map(([k, label]) => (
                                            <tr key={k}>
                                                <th>{label}</th>
                                                {chosen.map((r) => (
                                                    <td dir="auto" key={r.id}>
                                                        {val(r.data[k], "ar")}
                                                    </td>
                                                ))}
                                            </tr>
                                        ))}
                                </tbody>
                            </table>
                        </div>
                    </section>
                </div>
            )}
            {history && historyRecord && (
                <div className="modal-backdrop">
                    <section className="modal large">
                        <div className="section-head">
                            <h2>نسخ السيرة السابقة</h2>
                            <button
                                className="icon"
                                aria-label="إغلاق"
                                onClick={() => setHistory(null)}
                            >
                                <X />
                            </button>
                        </div>
                        {history.length ? (
                            history.map((h) => (
                                <details key={h.id}>
                                    <summary>{new Date(h.created).toLocaleString("ar-SA")}</summary>
                                    <dl className="history-values">
                                        {fields.map(([k, l]) => (
                                            <div key={k}>
                                                <dt>{l}</dt>
                                                <dd dir="auto">{h.data?.[k] || "—"}</dd>
                                            </div>
                                        ))}
                                    </dl>
                                </details>
                            ))
                        ) : (
                            <p>لا توجد نسخ سابقة.</p>
                        )}
                    </section>
                </div>
            )}
            {sourceRecord && !edit && (
                <SourceInspector
                    data={sourceRecord.data}
                    url={basePath + "/api/files?key=" + encodeURIComponent(sourceRecord.source)}
                    filename={sourceRecord.filename}
                />
            )}
        </>
    );
}
