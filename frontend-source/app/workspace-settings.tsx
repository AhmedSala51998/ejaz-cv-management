import { useEffect, useState } from "react";
import { X } from "lucide-react";
import { basePath } from "@/lib/base";
export async function api(path: string, options?: RequestInit) {
    const r = await fetch(basePath + "/api/" + path, options),
        j = await r.json();
    if (!r.ok) throw Error(j.error || "تعذر تنفيذ العملية");
    return j;
}
export default function WorkspaceSettings({ close }: { close: () => void }) {
    const [staff, setStaff] = useState<any[]>([]),
        [events, setEvents] = useState<any[]>([]),
        [page, setPage] = useState(1),
        [total, setTotal] = useState(0),
        [tab, setTab] = useState("staff"),
        [message, setMessage] = useState(""),
        [busy, setBusy] = useState(false),
        [form, setForm] = useState<any>({
            username: "",
            name: "",
            password: "",
            role: "reviewer",
            active: 1,
        }),
        [backup, setBackup] = useState<File | null>(null);
    async function load() {
        try {
            const [u, e] = await Promise.all([
                api("workspace/staff"),
                api("workspace/activity?page=" + page),
            ]);
            setStaff(u.rows);
            setEvents(e.rows);
            setTotal(e.total);
        } catch (e) {
            setMessage((e as Error).message);
        }
    }
    useEffect(() => {
        load();
    }, [page]);
    async function save(e: React.FormEvent) {
        e.preventDefault();
        setBusy(true);
        try {
            await api("workspace/staff", {
                method: form.id ? "PUT" : "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(form),
            });
            setForm({ username: "", name: "", password: "", role: "reviewer", active: 1 });
            setMessage("تم حفظ الحساب");
            await load();
        } catch (e) {
            setMessage((e as Error).message);
        } finally {
            setBusy(false);
        }
    }
    async function restore() {
        if (
            !backup ||
            !confirm("استعادة النسخة مع الاحتفاظ بالسير الموجودة وتجاوز الجوازات المكررة؟")
        )
            return;
        setBusy(true);
        try {
            const data = new FormData();
            data.set("backup", backup);
            data.set("confirm", "RESTORE");
            const r = await api("workspace/restore", { method: "POST", body: data });
            setMessage(
                `تمت استعادة ${r.restored} سيرة وتجاوز ${r.skipped} مكررة. حدّث السجلات لعرضها.`,
            );
        } catch (e) {
            setMessage((e as Error).message);
        } finally {
            setBusy(false);
        }
    }
    return (
        <div className="modal-backdrop">
            <section className="modal large">
                <div className="section-head">
                    <h2>إدارة مساحة العمل</h2>
                    <button className="icon" aria-label="إغلاق" onClick={close}>
                        <X />
                    </button>
                </div>
                <div className="filter-tabs">
                    {[
                        ["staff", "الموظفون"],
                        ["activity", "سجل التغييرات"],
                        ["backup", "النسخ والاستعادة"],
                    ].map(([k, v]) => (
                        <button
                            className={tab === k ? "active" : ""}
                            onClick={() => setTab(k)}
                            key={k}
                        >
                            {v}
                        </button>
                    ))}
                </div>
                {message && (
                    <p className="notice" role="status">
                        {message}
                    </p>
                )}
                {tab === "staff" && (
                    <>
                        <form className="advanced-grid" onSubmit={save}>
                            <label>
                                الاسم
                                <input
                                    required
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                />
                            </label>
                            <label>
                                اسم الدخول
                                <input
                                    required
                                    pattern="[a-zA-Z0-9_.@-]{3,128}"
                                    value={form.username}
                                    onChange={(e) => setForm({ ...form, username: e.target.value })}
                                />
                            </label>
                            <label>
                                كلمة المرور {form.id ? "(اتركها دون تغيير)" : ""}
                                <input
                                    type="password"
                                    autoComplete="new-password"
                                    required={!form.id}
                                    minLength={12}
                                    value={form.password}
                                    onChange={(e) => setForm({ ...form, password: e.target.value })}
                                />
                            </label>
                            <label>
                                الدور
                                <select
                                    value={form.role}
                                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                                >
                                    <option value="admin">مدير: جميع الصلاحيات</option>
                                    <option value="reviewer">مراجع: تعديل وحالات وتصدير</option>
                                    <option value="importer">موظف رفع: إضافة وعرض</option>
                                    <option value="viewer">عرض فقط</option>
                                </select>
                            </label>
                            {form.id && (
                                <label>
                                    <input
                                        type="checkbox"
                                        checked={!!form.active}
                                        onChange={(e) =>
                                            setForm({ ...form, active: e.target.checked ? 1 : 0 })
                                        }
                                    />
                                    نشط
                                </label>
                            )}
                            <button className="primary" disabled={busy}>
                                حفظ الحساب
                            </button>
                            {form.id && (
                                <button
                                    type="button"
                                    className="secondary"
                                    onClick={() =>
                                        setForm({
                                            username: "",
                                            name: "",
                                            password: "",
                                            role: "reviewer",
                                            active: 1,
                                        })
                                    }
                                >
                                    إلغاء التعديل
                                </button>
                            )}
                        </form>
                        <div className="scroll-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>الاسم</th>
                                        <th>الدخول</th>
                                        <th>الدور</th>
                                        <th>الحالة</th>
                                        <th />
                                    </tr>
                                </thead>
                                <tbody>
                                    {staff.map((s) => (
                                        <tr key={s.id}>
                                            <td>{s.name}</td>
                                            <td>{s.username}</td>
                                            <td>{s.role}</td>
                                            <td>{Number(s.active) ? "نشط" : "معطّل"}</td>
                                            <td>
                                                <button
                                                    className="text-button"
                                                    onClick={() => setForm({ ...s, password: "" })}
                                                >
                                                    تعديل
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </>
                )}
                {tab === "activity" && (
                    <>
                        <div className="scroll-table">
                            <table>
                                <thead>
                                    <tr>
                                        <th>المنفّذ</th>
                                        <th>العملية</th>
                                        <th>السجل</th>
                                        <th>التفاصيل</th>
                                        <th>الوقت</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {events.map((e) => (
                                        <tr key={e.id}>
                                            <td>{e.actor}</td>
                                            <td>
                                                {(
                                                    {
                                                        create: "إضافة",
                                                        edit: "تعديل",
                                                        replace: "تحديث ملف",
                                                        status: "تغيير الحالة",
                                                        photo: "تغيير الصورة",
                                                        backup: "نسخة احتياطية",
                                                        restore: "استعادة",
                                                        staff: "حساب موظف",
                                                    } as any
                                                )[e.action] || e.action}
                                            </td>
                                            <td>{e.record_id}</td>
                                            <td>{e.detail}</td>
                                            <td>{new Date(e.created).toLocaleString("ar-SA")}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="pagination">
                            <button disabled={page === 1} onClick={() => setPage(page - 1)}>
                                السابق
                            </button>
                            <span>
                                {page} / {Math.max(1, Math.ceil(total / 50))}
                            </span>
                            <button disabled={page * 50 >= total} onClick={() => setPage(page + 1)}>
                                التالي
                            </button>
                        </div>
                    </>
                )}
                {tab === "backup" && (
                    <div className="backup-panel">
                        <h3>نسخة كاملة للبيانات والمرفقات</h3>
                        <p>
                            تشمل السير والصور والأصول والحالات وسجل التغييرات. حسابات الموظفين
                            وإعدادات الاتصال خارج نسخة بيانات السير.
                        </p>
                        <a className="primary" href={basePath + "/api/backup?format=json"} download>
                            تنزيل JSON للاستعادة
                        </a>
                        <a
                            className="secondary"
                            href={basePath + "/api/backup?format=sql"}
                            download
                        >
                            تنزيل SQL
                        </a>
                        <hr />
                        <h3>استعادة من JSON</h3>
                        <p>
                            تُضاف الجوازات غير الموجودة، وتُتجاوز المكررة دون استبدال سجلاتك
                            الحالية. الحد الأقصى 100 MB أو حد PHP إن كان أقل.
                        </p>
                        <input
                            type="file"
                            accept=".json"
                            disabled={busy}
                            onChange={(e) => setBackup(e.target.files?.[0] || null)}
                        />
                        <button className="primary" disabled={busy || !backup} onClick={restore}>
                            {busy ? "جارٍ الاستعادة…" : "استعادة النسخة"}
                        </button>
                    </div>
                )}
            </section>
        </div>
    );
}
