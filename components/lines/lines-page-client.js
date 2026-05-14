"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";

import { EmptyState } from "@/components/common/empty-state";
import { PageHeader } from "@/components/common/page-header";
import { KpiGrid } from "@/components/dashboard/kpi-grid";
import { MachineFormSheet } from "@/components/machines/machine-form-sheet";
import { LineFormSheet } from "@/components/lines/line-form-sheet";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { formatEnglishNumber, normalizeDigitsToLatin } from "@/lib/format/locale-numbers";
import { deleteInstapayLineDocument, fetchInstapayLinesByShop } from "@/lib/instapay/instapay-lines-service";
import { LINES_HUB_TABS } from "@/lib/lines/channel-types";
import { deleteMachineDocument, fetchMachinesByShop } from "@/lib/machines/machines-service";
import { deleteNumberDocument, fetchNumbersByShop } from "@/lib/lines/numbers-service";
import { cn } from "@/lib/utils";

/** @param {unknown} v */
function asString(v) {
  if (v === null || v === undefined) return "";
  return String(v);
}

/** @param {unknown} v */
function asNumberDisplay(v) {
  return formatEnglishNumber(v);
}

/** @param {Array<Record<string, unknown>>} list @param {string} key */
function sumNumericField(list, key) {
  return list.reduce((acc, row) => {
    const n = Number(row[key]);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}

/** @param {Array<Record<string, unknown>>} list */
function sumAmountFromRows(list) {
  return list.reduce((acc, row) => {
    const n = Number(String(row.amount ?? "").replace(/,/g, "").trim());
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}

/** @param {Array<Record<string, unknown>>} list */
function sumMachineBalance(list) {
  return list.reduce((acc, row) => {
    const n = Number(row.balance);
    return acc + (Number.isFinite(n) ? n : 0);
  }, 0);
}

/** @param {Record<string, unknown>} row */
function isTelecomRow(row) {
  const ch = asString(row.channelType);
  return !ch || ch === "telecom";
}

/** @param {Record<string, unknown>} row @param {string} q */
function rowMatchesSearch(row, q) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  const hay = [
    row.name,
    row.phone,
    row.userEmail,
    row.shop,
    row.idNumber,
    row.address,
    row.maternalGrandfatherName,
    row.maternalGrandmotherName,
    row.activationDate,
  ]
    .map((x) => asString(x).toLowerCase())
    .join(" ");
  return hay.includes(s);
}

/** @param {Record<string, unknown>} row @param {string} q */
function machineNameMatchesSearch(row, q) {
  const s = q.trim().toLowerCase();
  if (!s) return true;
  return asString(row.name).toLowerCase().includes(s);
}

/** @param {unknown} err @param {string} [collectionHint] */
function toastFirestoreError(err, collectionHint) {
  if (err && typeof err === "object" && "code" in err && String(err.code) === "permission-denied") {
    toast.error(
      collectionHint
        ? `Firestore رفض الطلب. راجع قواعد الأمان لمجموعة ${collectionHint}.`
        : "Firestore رفض الطلب. راجع قواعد الأمان.",
    );
    return;
  }
  if (err instanceof Error && err.message) {
    toast.error(err.message);
    return;
  }
  toast.error("حدث خطأ أثناء الاتصال بقاعدة البيانات");
}

const lineColumns = [
  { key: "phone", header: "رقم الخط", phoneLatin: true },
  { key: "name", header: "اسم المالك" },
  { key: "idNumber", header: "الرقم القومي", phoneLatin: true },
  { key: "amount", header: "الرصيد", format: asNumberDisplay },
  { key: "withdrawLimit", header: "متبقي سحب شهري", format: asNumberDisplay },
  { key: "depositLimit", header: "متبقي إيداع شهري", format: asNumberDisplay },
  { key: "dailyWithdraw", header: "متبقي يومي سحب", format: asNumberDisplay },
  { key: "dailyDeposit", header: "متبقي يومي إيداع", format: asNumberDisplay },
  { key: "address", header: "العنوان" },
  { key: "maternalGrandfatherName", header: "الجد" },
  { key: "maternalGrandmotherName", header: "الجدة" },
  { key: "activationDate", header: "تاريخ التفعيل", dateLatin: true },
];

/**
 * @param {{ shop: string; userEmail: string; mode: "telecom" | "instapay" }} props
 */
function LinesDataSection({ shop, userEmail, mode }) {
  const isTelecom = mode === "telecom";
  const collectionHint = isTelecom ? "numbers" : "instapayLines";

  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState("create");
  /** @type {[(Record<string, unknown> & { id: string }) | null, (v: (Record<string, unknown> & { id: string }) | null) => void]} */
  const [editingRow, setEditingRow] = useState(null);
  const [sheetFormKey, setSheetFormKey] = useState(0);
  const [lineToDelete, setLineToDelete] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const applyFetchError = useCallback(
    (e) => {
      const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
      if (code === "permission-denied") {
        setError(`لا صلاحية لقراءة مجموعة ${collectionHint}. راجع قواعد Firestore في Console.`);
      } else {
        setError(e instanceof Error ? e.message : "تعذر جلب البيانات");
      }
      setRows([]);
    },
    [collectionHint],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = isTelecom ? await fetchNumbersByShop(shop) : await fetchInstapayLinesByShop(shop);
        if (cancelled) return;
        setRows(data);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        applyFetchError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shop, isTelecom, applyFetchError]);

  const silentRefresh = useCallback(async () => {
    try {
      const data = isTelecom ? await fetchNumbersByShop(shop) : await fetchInstapayLinesByShop(shop);
      setRows(data);
      setError(null);
    } catch (e) {
      applyFetchError(e);
    }
  }, [shop, isTelecom, applyFetchError]);

  const filteredRows = useMemo(() => {
    const base = isTelecom ? rows.filter(isTelecomRow) : rows;
    return base.filter((row) => rowMatchesSearch(row, search));
  }, [rows, isTelecom, search]);

  const lineKpiItems = useMemo(() => {
    const list = filteredRows;
    return [
      {
        id: "count",
        label: "عدد الخطوط",
        value: formatEnglishNumber(list.length, { maximumFractionDigits: 0 }),
      },
      {
        id: "balance",
        label: "إجمالي رصيد الخطوط",
        value: formatEnglishNumber(sumAmountFromRows(list)),
      },
      {
        id: "withdraw-month",
        label: "إجمالي متبقي سحب شهري",
        value: formatEnglishNumber(sumNumericField(list, "withdrawLimit")),
      },
      {
        id: "deposit-month",
        label: "إجمالي متبقي إيداع شهري",
        value: formatEnglishNumber(sumNumericField(list, "depositLimit")),
      },
    ];
  }, [filteredRows]);

  const openCreate = () => {
    setSheetMode("create");
    setEditingRow(null);
    setSheetFormKey((k) => k + 1);
    setSheetOpen(true);
  };

  /** @param {Record<string, unknown> & { id: string }} row */
  const openEdit = (row) => {
    setSheetMode("edit");
    setEditingRow(row);
    setSheetFormKey((k) => k + 1);
    setSheetOpen(true);
  };

  /** @param {Record<string, unknown> & { id: string }} row */
  const requestDelete = (row) => {
    setLineToDelete(row);
  };

  const confirmDelete = async () => {
    if (!lineToDelete?.id) return;
    setDeleteSubmitting(true);
    try {
      if (isTelecom) {
        await deleteNumberDocument(lineToDelete.id);
        toast.success("تم حذف الخط");
      } else {
        await deleteInstapayLineDocument(lineToDelete.id);
        toast.success("تم حذف سجل انستاباي");
      }
      setLineToDelete(null);
      await silentRefresh();
    } catch (err) {
      toastFirestoreError(err, collectionHint);
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const deleteDialogOpen = !!lineToDelete;
  const deleteLineLabel = lineToDelete ? asString(lineToDelete.name) || lineToDelete.id : "";
  const deleteLinePhone = lineToDelete ? normalizeDigitsToLatin(asString(lineToDelete.phone)) || "—" : "";

  const cellValue = (row, col) => {
    const raw = row[col.key];
    if (col.phoneLatin) return normalizeDigitsToLatin(asString(raw)) || "—";
    if (col.dateLatin) return normalizeDigitsToLatin(asString(raw)) || "—";
    if (col.format) return col.format(raw);
    return asString(raw) || "—";
  };

  const loadingLabel = isTelecom ? "جاري تحميل الخطوط…" : "جاري تحميل سجلات انستاباي…";
  const emptyTitle = isTelecom ? "لا توجد خطوط اتصالات" : "لا توجد سجلات انستاباي";
  const emptyDesc = isTelecom
    ? `لا توجد مستندات في numbers لحقل shop = «${shop}».`
    : `لا توجد مستندات في instapayLines لحقل shop = «${shop}».`;
  const addButtonLabel = isTelecom ? "إضافة خط" : "إضافة انستاباي";
  const noResultsDesc = isTelecom
    ? "لا توجد خطوط اتصالات تطابق البحث. غيّر البحث أو امسحه."
    : "لا توجد سجلات انستاباي تطابق البحث. غيّر البحث أو امسحه.";
  const deleteTitle = isTelecom ? "تأكيد حذف الخط" : "تأكيد حذف سجل انستاباي";
  const deleteIntro = isTelecom ? "هل أنت متأكد من حذف الخط" : "هل أنت متأكد من حذف سجل انستاباي";

  return (
    <>
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Input
            type="search"
            placeholder="بحث برقم الخط، اسم المالك، الرقم القومي، العنوان، الجد/الجدة، التفعيل، البريد…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
            dir="rtl"
          />
        </div>
        <Button type="button" onClick={openCreate} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          {addButtonLabel}
        </Button>
      </div>

      {error ? (
        <Card className="mt-6 border-destructive/50 bg-destructive/5 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-destructive">تعذر الجلب</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {loading ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">{loadingLabel}</p>
      ) : !error && rows.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDesc} />
      ) : null}

      {!error && !loading && rows.length > 0 ? (
        <div className="mt-4">
          <KpiGrid items={lineKpiItems} />
        </div>
      ) : null}

      {!error && !loading && rows.length > 0 && filteredRows.length === 0 ? (
        <EmptyState title="لا نتائج" description={noResultsDesc} />
      ) : null}

      {!error && !loading && filteredRows.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[72rem] text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                {lineColumns.map((c) => (
                  <th key={c.key} className="px-3 py-2 text-start text-xs font-medium text-muted-foreground">
                    {c.header}
                  </th>
                ))}
                <th className="w-[1%] whitespace-nowrap px-3 py-2 text-start text-xs font-medium text-muted-foreground">
                  إجراءات
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-b border-border/80 last:border-0 hover:bg-muted/30">
                  {lineColumns.map((c) => (
                    <td key={c.key} className="max-w-[14rem] truncate px-3 py-2 align-middle tabular-nums">
                      <span className={c.phoneLatin || c.dateLatin ? "font-mono text-start" : ""}>{cellValue(row, c)}</span>
                    </td>
                  ))}
                  <td className="px-3 py-2 align-middle">
                    <div className="flex flex-nowrap gap-1">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row)} aria-label="تعديل">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => requestDelete(row)}
                        aria-label="حذف"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open && !deleteSubmitting) setLineToDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-start sm:text-start">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 sm:mx-0">
              <Trash2 className="h-6 w-6 text-destructive" aria-hidden />
            </div>
            <DialogTitle>{deleteTitle}</DialogTitle>
            <DialogDescription className="space-y-1 text-start">
              <span>
                {deleteIntro} «<span className="font-medium text-foreground">{deleteLineLabel}</span>»؟
              </span>
              <span className="block font-mono text-xs text-foreground/90">رقم الخط: {deleteLinePhone}</span>
              <span className="block text-destructive/90">لا يمكن التراجع عن هذا الإجراء.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:flex-row sm:justify-start">
            <Button type="button" variant="destructive" disabled={deleteSubmitting} onClick={() => void confirmDelete()}>
              {deleteSubmitting ? "جاري الحذف…" : "حذف نهائي"}
            </Button>
            <Button type="button" variant="outline" disabled={deleteSubmitting} onClick={() => setLineToDelete(null)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <LineFormSheet
        key={sheetFormKey}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        shop={shop}
        defaultUserEmail={userEmail}
        initialRow={editingRow}
        existingRows={rows}
        onSaved={silentRefresh}
        persistTarget={isTelecom ? "numbers" : "instapayLines"}
        lineKind={isTelecom ? "telecom" : "instapay"}
      />
    </>
  );
}

/**
 * @param {{ shop: string; userEmail: string }} props
 */
function MachinesSection({ shop, userEmail }) {
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetMode, setSheetMode] = useState("create");
  /** @type {[(Record<string, unknown> & { id: string }) | null, (v: (Record<string, unknown> & { id: string }) | null) => void]} */
  const [editingRow, setEditingRow] = useState(null);
  const [sheetFormKey, setSheetFormKey] = useState(0);
  const [machineToDelete, setMachineToDelete] = useState(null);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);

  const applyFetchError = useCallback((e) => {
    const code = e && typeof e === "object" && "code" in e ? String(e.code) : "";
    if (code === "permission-denied") {
      setError("لا صلاحية لقراءة مجموعة machines. راجع قواعد Firestore في Console.");
    } else {
      setError(e instanceof Error ? e.message : "تعذر جلب الماكينات");
    }
    setRows([]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const data = await fetchMachinesByShop(shop);
        if (cancelled) return;
        setRows(data);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        applyFetchError(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [shop, applyFetchError]);

  const silentRefresh = useCallback(async () => {
    try {
      const data = await fetchMachinesByShop(shop);
      setRows(data);
      setError(null);
    } catch (e) {
      applyFetchError(e);
    }
  }, [shop, applyFetchError]);

  const filteredRows = useMemo(() => {
    return rows.filter((row) => machineNameMatchesSearch(row, search));
  }, [rows, search]);

  const machineKpiItems = useMemo(() => {
    const list = filteredRows;
    return [
      {
        id: "count",
        label: "عدد الماكينات",
        value: formatEnglishNumber(list.length, { maximumFractionDigits: 0 }),
      },
      {
        id: "balance",
        label: "إجمالي الرصيد",
        value: formatEnglishNumber(sumMachineBalance(list)),
      },
    ];
  }, [filteredRows]);

  const openCreate = () => {
    setSheetMode("create");
    setEditingRow(null);
    setSheetFormKey((k) => k + 1);
    setSheetOpen(true);
  };

  /** @param {Record<string, unknown> & { id: string }} row */
  const openEdit = (row) => {
    setSheetMode("edit");
    setEditingRow(row);
    setSheetFormKey((k) => k + 1);
    setSheetOpen(true);
  };

  const confirmDelete = async () => {
    if (!machineToDelete?.id) return;
    setDeleteSubmitting(true);
    try {
      await deleteMachineDocument(String(machineToDelete.id));
      toast.success("تم حذف الماكينة");
      setMachineToDelete(null);
      await silentRefresh();
    } catch (err) {
      toastFirestoreError(err, "machines");
    } finally {
      setDeleteSubmitting(false);
    }
  };

  const deleteDialogOpen = !!machineToDelete;
  const deleteName = machineToDelete ? asString(machineToDelete.name) || machineToDelete.id : "";

  return (
    <>
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full max-w-md">
          <Input
            type="search"
            placeholder="بحث باسم الماكينة…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full"
            dir="rtl"
          />
        </div>
        <Button type="button" onClick={openCreate} className="shrink-0 gap-2">
          <Plus className="h-4 w-4" />
          إضافة ماكينة
        </Button>
      </div>

      {error ? (
        <Card className="mt-6 border-destructive/50 bg-destructive/5 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle className="text-destructive">تعذر الجلب</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
        </Card>
      ) : null}

      {loading ? (
        <p className="mt-8 text-center text-sm text-muted-foreground">جاري تحميل الماكينات…</p>
      ) : !error && rows.length === 0 ? (
        <EmptyState title="لا توجد ماكينات" description={`لا توجد مستندات في machines لحقل shop = «${shop}».`} />
      ) : null}

      {!error && !loading && rows.length > 0 ? (
        <div className="mt-4">
          <KpiGrid items={machineKpiItems} />
        </div>
      ) : null}

      {!error && !loading && rows.length > 0 && filteredRows.length === 0 ? (
        <EmptyState title="لا نتائج" description="لا توجد ماكينات تطابق البحث. غيّر البحث أو امسحه." />
      ) : null}

      {!error && !loading && filteredRows.length > 0 ? (
        <div className="mt-6 overflow-x-auto rounded-xl border border-border shadow-[var(--shadow-card)]">
          <table className="w-full min-w-[24rem] text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-start text-xs font-medium text-muted-foreground">اسم الماكينة</th>
                <th className="px-3 py-2 text-start text-xs font-medium text-muted-foreground">الرصيد</th>
                <th className="w-[1%] whitespace-nowrap px-3 py-2 text-start text-xs font-medium text-muted-foreground">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.id} className="border-b border-border/80 last:border-0 hover:bg-muted/30">
                  <td className="max-w-[20rem] truncate px-3 py-2 align-middle">{asString(row.name) || "—"}</td>
                  <td className="px-3 py-2 align-middle font-mono tabular-nums">{asNumberDisplay(row.balance)}</td>
                  <td className="px-3 py-2 align-middle">
                    <div className="flex flex-nowrap gap-1">
                      <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(row)} aria-label="تعديل">
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setMachineToDelete(row)}
                        aria-label="حذف"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <Dialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!open && !deleteSubmitting) setMachineToDelete(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="text-start sm:text-start">
            <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 sm:mx-0">
              <Trash2 className="h-6 w-6 text-destructive" aria-hidden />
            </div>
            <DialogTitle>تأكيد حذف الماكينة</DialogTitle>
            <DialogDescription className="space-y-1 text-start">
              <span>
                هل أنت متأكد من حذف الماكينة «<span className="font-medium text-foreground">{deleteName}</span>»؟
              </span>
              <span className="block text-destructive/90">لا يمكن التراجع عن هذا الإجراء.</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:flex-row sm:justify-start">
            <Button type="button" variant="destructive" disabled={deleteSubmitting} onClick={() => void confirmDelete()}>
              {deleteSubmitting ? "جاري الحذف…" : "حذف نهائي"}
            </Button>
            <Button type="button" variant="outline" disabled={deleteSubmitting} onClick={() => setMachineToDelete(null)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <MachineFormSheet
        key={sheetFormKey}
        open={sheetOpen}
        onOpenChange={setSheetOpen}
        mode={sheetMode}
        shop={shop}
        defaultUserEmail={userEmail}
        initialRow={editingRow}
        onSaved={silentRefresh}
      />
    </>
  );
}

/**
 * @param {{ shop: string; userEmail: string }} props
 */
export function LinesPageClient({ shop, userEmail }) {
  const shopTrim = typeof shop === "string" ? shop.trim() : "";
  const [hubTab, setHubTab] = useState("telecom");

  if (!shopTrim) {
    return (
      <>
        <PageHeader title="الخطوط" size="compact" />
        <Card className="mt-6 shadow-[var(--shadow-card)]">
          <CardHeader>
            <CardTitle>اسم الفرع غير مضبوط</CardTitle>
            <CardDescription>
              لمطابقة مستندات Firestore في مجموعة numbers يجب أن يطابق حقل <code className="text-xs">shop</code> اسم
              الفرع في ملفك الشخصي (الجلسة). أضف اسم الفرع عند التسجيل أو حدّث المستخدم في Firestore.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              البريد الحالي في الجلسة: <span className="font-medium text-foreground">{userEmail || "—"}</span>
            </p>
          </CardContent>
        </Card>
      </>
    );
  }

  return (
    <>
      <PageHeader title="الخطوط" size="compact" />
      {/* Firestore: add rules for instapayLines + machines (shop-scoped) mirroring numbers if the client writes. */}
      <div className="mt-4 flex flex-wrap gap-2 border-b border-border pb-3">
        {LINES_HUB_TABS.map((tab) => (
          <Button
            key={tab.id}
            type="button"
            variant={hubTab === tab.id ? "default" : "outline"}
            size="sm"
            className={cn("rounded-full", hubTab === tab.id && "pointer-events-none")}
            onClick={() => setHubTab(tab.id)}
          >
            {tab.label}
          </Button>
        ))}
      </div>
      {hubTab === "telecom" ? <LinesDataSection key="telecom" shop={shopTrim} userEmail={userEmail} mode="telecom" /> : null}
      {hubTab === "instapay" ? <LinesDataSection key="instapay" shop={shopTrim} userEmail={userEmail} mode="instapay" /> : null}
      {hubTab === "machines" ? <MachinesSection key="machines" shop={shopTrim} userEmail={userEmail} /> : null}
    </>
  );
}
