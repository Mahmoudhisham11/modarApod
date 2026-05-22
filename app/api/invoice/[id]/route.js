import { NextResponse } from "next/server";
import { doc, getDoc } from "firebase/firestore";
import { db } from "@/app/firebase";
import { buildOperationInvoiceHtml } from "@/lib/dashboard/print-operation-invoice";

export async function GET(request, { params }) {
  const { id } = await params;
  const { searchParams } = new URL(request.url);
  const branch = searchParams.get("branch") || "";

  if (!id) {
    return new NextResponse("Missing invoice ID", { status: 400 });
  }

  let op = null;

  const opsRef = doc(db, "operations", id);
  const opsSnap = await getDoc(opsRef);

  if (opsSnap.exists()) {
    op = { id: opsSnap.id, ...opsSnap.data() };
  } else {
    const rptRef = doc(db, "reports", id);
    const rptSnap = await getDoc(rptRef);
    if (rptSnap.exists()) {
      op = { id: rptSnap.id, ...rptSnap.data() };
    }
  }

  if (!op) {
    return new NextResponse("Invoice not found", { status: 404 });
  }

  const html = buildOperationInvoiceHtml(op, { branchLabel: branch });

  return new NextResponse(html, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
