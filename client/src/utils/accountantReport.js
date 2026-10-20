import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

const toDate = (val) => {
  if (val == null) return null;
  if (val instanceof Date) return val;
  if (val?.toDate && typeof val.toDate === 'function') return val.toDate();
  if (val?.seconds != null) return new Date(val.seconds * 1000);
  const d = new Date(val);
  return isNaN(d.getTime()) ? null : d;
};

const fmtMoney = (n) =>
  `Rs. ${Math.round(parseFloat(n) || 0).toLocaleString('en-PK')}`;

const fmtDate = (val) => {
  const d = toDate(val);
  if (!d) return '—';
  return d.toLocaleDateString('en-PK', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
};

const inRange = (dateObj, start, end) => {
  if (!dateObj || isNaN(dateObj.getTime())) return false;
  if (start && dateObj < start) return false;
  if (end && dateObj > end) return false;
  return true;
};

const isProductExpense = (expense) =>
  !!(expense.inventoryId) || expense.expenseScope === 'product';

/**
 * Build PDF accountant pack for Dressify (no investors section).
 * Uses selected From–To dates; lists sales, payments, dues, expenses, stock snapshot.
 */
export const downloadAccountantReport = ({
  startDate,
  endDate,
  sales = [],
  payments = [],
  expenses = [],
  inventory = []
}) => {
  const start = startDate ? new Date(startDate + 'T00:00:00') : null;
  const end = endDate ? new Date(endDate + 'T23:59:59.999') : null;

  const salesInRange = sales.filter((s) => inRange(toDate(s.saleDate), start, end));
  const paymentsInRange = payments.filter((p) => inRange(toDate(p.paymentDate), start, end));
  const expensesInRange = expenses.filter((e) => inRange(toDate(e.expenseDate), start, end));

  const totalBilled = salesInRange.reduce((s, x) => s + (parseFloat(x.totalAmount) || 0), 0);
  const totalPaidOnSales = salesInRange.reduce((s, x) => s + (parseFloat(x.paidAmount) || 0), 0);
  const totalDueOnSales = salesInRange.reduce((s, x) => {
    const due =
      parseFloat(x.remainingAmount) >= 0
        ? parseFloat(x.remainingAmount)
        : Math.max(0, (parseFloat(x.totalAmount) || 0) - (parseFloat(x.paidAmount) || 0));
    return s + due;
  }, 0);

  const paymentsReceived = paymentsInRange.reduce((s, p) => s + (parseFloat(p.amount) || 0), 0);

  // Outstanding across ALL open credit sales (snapshot now), not only period sales
  const outstanding = sales
    .map((s) => {
      const due =
        parseFloat(s.remainingAmount) >= 0
          ? parseFloat(s.remainingAmount)
          : Math.max(0, (parseFloat(s.totalAmount) || 0) - (parseFloat(s.paidAmount) || 0));
      return { sale: s, due };
    })
    .filter((x) => x.due > 0.5)
    .sort((a, b) => b.due - a.due);

  const outstandingTotal = outstanding.reduce((s, x) => s + x.due, 0);

  const generalExpenses = expensesInRange.filter((e) => !isProductExpense(e));
  const productExpenses = expensesInRange.filter((e) => isProductExpense(e));
  const generalTotal = generalExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const productExpTotal = productExpenses.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0);
  const allExpensesTotal = generalTotal + productExpTotal;

  const expenseByCategory = {};
  expensesInRange.forEach((e) => {
    const cat = e.category || 'Other';
    expenseByCategory[cat] = (expenseByCategory[cat] || 0) + (parseFloat(e.amount) || 0);
  });

  let stockQty = 0;
  let stockCost = 0;
  const invCostById = {};
  inventory.forEach((item) => {
    const id = item.id || item._id;
    const qty = (item.sizes || []).reduce((s, sz) => s + (parseFloat(sz.quantity) || 0), 0);
    stockQty += qty;
    const initial = parseFloat(item.initialQuantity) || qty || 1;
    const landed =
      parseFloat(item.totalLandedCost) ||
      parseFloat(item.basePurchaseCost) ||
      (parseFloat(item.costPerUnit) || 0) * initial;
    const remainingValue = initial > 0 ? (landed * qty) / initial : 0;
    stockCost += remainingValue;

    let unitCost = parseFloat(item.costPerUnit) || 0;
    if ((!unitCost || unitCost <= 0) && initial > 0 && landed > 0) {
      unitCost = landed / initial;
    }
    if (id) invCostById[id] = unitCost;
  });

  // COGS for sales in period: sold qty × inventory cost/unit (landed cost usually includes product expenses)
  let cogs = 0;
  let cogsQty = 0;
  let cogsMissingCost = 0;
  salesInRange.forEach((sale) => {
    (sale.items || []).forEach((line) => {
      const invId = line.inventoryId || line.inventory;
      const qty = parseFloat(line.quantity) || 0;
      if (qty <= 0) return;
      cogsQty += qty;
      const unitCost = invId != null ? (invCostById[invId] || 0) : 0;
      if (unitCost > 0) {
        cogs += qty * unitCost;
      } else {
        cogsMissingCost += qty;
      }
    });
  });
  cogs = Math.round(cogs);

  // Product expenses are typically already inside cost/unit (landed). Use GENERAL expenses only here
  // so we do not subtract product costs twice.
  const estimatedGrossOnPayments = Math.round(paymentsReceived - cogs);
  const estimatedNetProfit = Math.round(paymentsReceived - cogs - generalTotal);
  const estimatedGrossOnBilled = Math.round(totalBilled - cogs);
  const estimatedNetOnBilled = Math.round(totalBilled - cogs - generalTotal);

  const netCashVsGeneral = paymentsReceived - generalTotal;

  // Earliest activity hint
  const allDates = [
    ...sales.map((s) => toDate(s.saleDate)),
    ...payments.map((p) => toDate(p.paymentDate)),
    ...expenses.map((e) => toDate(e.expenseDate))
  ].filter(Boolean);
  const earliest =
    allDates.length > 0
      ? new Date(Math.min(...allDates.map((d) => d.getTime())))
      : null;

  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 16;

  const ensureSpace = (need = 40) => {
    if (y + need > 280) {
      doc.addPage();
      y = 16;
    }
  };

  const sectionTitle = (title) => {
    ensureSpace(20);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(26, 26, 26);
    doc.text(title, 14, y);
    y += 4;
    doc.setDrawColor(47, 93, 58);
    doc.setLineWidth(0.6);
    doc.line(14, y, pageW - 14, y);
    y += 6;
  };

  // Cover
  doc.setFillColor(26, 26, 26);
  doc.rect(0, 0, pageW, 42, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  doc.text('Dressify', 14, 18);
  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('Accountant report pack', 14, 26);
  doc.setFontSize(9);
  doc.setTextColor(200, 200, 200);
  doc.text('Clothing inventory & sales summary (for accountant)', 14, 33);

  y = 52;
  doc.setTextColor(40, 40, 40);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('Report period', 14, y);
  doc.setFont('helvetica', 'normal');
  y += 6;
  doc.text(`From: ${startDate || '—'}`, 14, y);
  y += 5;
  doc.text(`To: ${endDate || '—'}`, 14, y);
  y += 5;
  doc.text(`Generated: ${new Date().toLocaleString('en-PK')}`, 14, y);
  y += 5;
  if (earliest) {
    doc.setTextColor(80, 80, 80);
    doc.setFontSize(9);
    doc.text(
      `Earliest activity found in system: ${fmtDate(earliest)} (set From date earlier if you need full history)`,
      14,
      y
    );
  }
  y += 10;

  y += 10;

  // ===== SIMPLE SUMMARY (easy to read) =====
  sectionTitle('1. Simple summary');
  autoTable(doc, {
    startY: y,
    head: [['Kya', 'Amount']],
    body: [
      ['1. Kitna paisa aaya (customer payments)', fmtMoney(paymentsReceived)],
      ['2. Bechay hue maal ki cost (COGS)', fmtMoney(cogs)],
      ['3. Shop / general kharcha', fmtMoney(generalTotal)],
      ['4. ANDAZA NET PROFIT (1 − 2 − 3)', fmtMoney(estimatedNetProfit)],
      ['Abhi customers pe due (baaki lena)', fmtMoney(outstandingTotal)],
      ['Abhi stock pada (approx cost)', fmtMoney(stockCost)]
    ],
    styles: { fontSize: 10, cellPadding: 3 },
    headStyles: { fillColor: [26, 26, 26], fontSize: 10 },
    bodyStyles: { fontSize: 10 },
    margin: { left: 14, right: 14 },
    columnStyles: { 1: { halign: 'right', fontStyle: 'bold' } },
    didParseCell: (data) => {
      if (data.section === 'body' && data.row.index === 3) {
        data.cell.styles.fillColor = [220, 252, 231];
        data.cell.styles.fontStyle = 'bold';
      }
    }
  });
  y = doc.lastAutoTable.finalY + 8;

  ensureSpace(35);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.setTextColor(26, 26, 26);
  doc.text('Seedha hisab:', 14, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(50, 50, 50);
  const simpleLines = doc.splitTextToSize(
    `Paisa aaya ${fmtMoney(paymentsReceived)}  minus  maal ki cost ${fmtMoney(cogs)}  minus  kharcha ${fmtMoney(generalTotal)}  =  NET ${fmtMoney(estimatedNetProfit)}.`,
    pageW - 28
  );
  doc.text(simpleLines, 14, y);
  y += simpleLines.length * 5 + 4;

  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  const tipLines = doc.splitTextToSize(
    'Yeh ANDAZA hai — tax kitna dena hai yeh number nahi. Accountant is PDF se FBR ke hisab se tax batayega. Jo stock abhi pada hai uski cost is net mein nahi kati (jab bechego tab kate gi).',
    pageW - 28
  );
  doc.text(tipLines, 14, y);
  y += tipLines.length * 4 + 8;

  // ===== EXTRA NUMBERS (short) =====
  sectionTitle('2. Thodi aur detail (accountant ke liye)');
  autoTable(doc, {
    startY: y,
    head: [['Item', 'Amount']],
    body: [
      ['Total bill bana (sales)', fmtMoney(totalBilled)],
      ['Invoices pe likha hua paid (total)', fmtMoney(totalPaidOnSales)],
      ['Period invoices pe baaki due', fmtMoney(totalDueOnSales)],
      ['Product pe alag expenses (list)', fmtMoney(productExpTotal)],
      ['Pieces beche (COGS ke liye)', String(Math.round(cogsQty))],
      ...(cogsMissingCost > 0
        ? [['Pieces jinki cost missing thi', String(Math.round(cogsMissingCost))]]
        : []),
      ['Stock pieces abhi', String(Math.round(stockQty))]
    ],
    styles: { fontSize: 8, cellPadding: 2 },
    headStyles: { fillColor: [80, 80, 80] },
    margin: { left: 14, right: 14 },
    columnStyles: { 1: { halign: 'right' } }
  });
  y = doc.lastAutoTable.finalY + 10;

  // Sales
  sectionTitle('3. Sales (invoices in period)');
  const saleRows = salesInRange
    .sort((a, b) => (toDate(b.saleDate)?.getTime() || 0) - (toDate(a.saleDate)?.getTime() || 0))
    .map((s) => [
      fmtDate(s.saleDate),
      s.invoiceNumber || '—',
      (s.customer?.name || s.customerName || 'Unknown').slice(0, 22),
      fmtMoney(s.totalAmount),
      fmtMoney(s.paidAmount),
      fmtMoney(
        parseFloat(s.remainingAmount) >= 0
          ? s.remainingAmount
          : Math.max(0, (parseFloat(s.totalAmount) || 0) - (parseFloat(s.paidAmount) || 0))
      ),
      s.paymentStatus || '—'
    ]);

  if (!saleRows.length) {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('No sales in this period.', 14, y);
    y += 8;
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Invoice', 'Customer', 'Billed', 'Paid', 'Due', 'Status']],
      body: saleRows,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [26, 26, 26] },
      margin: { left: 14, right: 14 },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' }
      }
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Payments
  sectionTitle('4. Payments received (period)');
  const payRows = paymentsInRange
    .sort((a, b) => (toDate(b.paymentDate)?.getTime() || 0) - (toDate(a.paymentDate)?.getTime() || 0))
    .map((p) => [
      fmtDate(p.paymentDate),
      p.invoiceNumber || '—',
      (p.customerName || '—').slice(0, 20),
      fmtMoney(p.amount),
      p.paymentType || '—',
      p.paymentMethod || 'Cash',
      p.addedBy || p.editedBy || '—'
    ]);

  if (!payRows.length) {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('No payments in this period.', 14, y);
    y += 8;
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Invoice', 'Customer', 'Amount', 'Type', 'Method', 'By']],
      body: payRows,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [16, 185, 129] },
      margin: { left: 14, right: 14 },
      columnStyles: { 3: { halign: 'right' } }
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Outstanding
  sectionTitle('5. Outstanding credit (open dues now)');
  const dueRows = outstanding.slice(0, 80).map(({ sale: s, due }) => [
    fmtDate(s.saleDate),
    s.invoiceNumber || '—',
    (s.customer?.name || s.customerName || 'Unknown').slice(0, 22),
    fmtMoney(s.totalAmount),
    fmtMoney(s.paidAmount),
    fmtMoney(due),
    s.paymentStatus || '—'
  ]);

  if (!dueRows.length) {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('No open credit dues.', 14, y);
    y += 8;
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Sale date', 'Invoice', 'Customer', 'Billed', 'Paid', 'Due', 'Status']],
      body: dueRows,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [180, 83, 9] },
      margin: { left: 14, right: 14 },
      columnStyles: {
        3: { halign: 'right' },
        4: { halign: 'right' },
        5: { halign: 'right' }
      }
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Expenses by category
  sectionTitle('6. Expenses by category (period)');
  const catRows = Object.entries(expenseByCategory)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amt]) => [cat, fmtMoney(amt)]);

  if (!catRows.length) {
    doc.setFontSize(9);
    doc.setTextColor(120, 120, 120);
    doc.text('No expenses in this period.', 14, y);
    y += 8;
  } else {
    autoTable(doc, {
      startY: y,
      head: [['Category', 'Total']],
      body: [...catRows, ['TOTAL', fmtMoney(allExpensesTotal)]],
      styles: { fontSize: 8, cellPadding: 2 },
      headStyles: { fillColor: [26, 26, 26] },
      margin: { left: 14, right: 14 },
      columnStyles: { 1: { halign: 'right' } }
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Expense detail
  sectionTitle('7. Expense detail (period)');
  const expRows = expensesInRange
    .sort((a, b) => (toDate(b.expenseDate)?.getTime() || 0) - (toDate(a.expenseDate)?.getTime() || 0))
    .map((e) => [
      fmtDate(e.expenseDate),
      isProductExpense(e) ? 'Product' : 'General',
      e.category || '—',
      (e.description || e.productName || '—').toString().slice(0, 28),
      fmtMoney(e.amount)
    ]);

  if (expRows.length) {
    autoTable(doc, {
      startY: y,
      head: [['Date', 'Scope', 'Category', 'Description', 'Amount']],
      body: expRows,
      styles: { fontSize: 7, cellPadding: 1.5 },
      headStyles: { fillColor: [100, 100, 100] },
      margin: { left: 14, right: 14 },
      columnStyles: { 4: { halign: 'right' } }
    });
    y = doc.lastAutoTable.finalY + 10;
  }

  // Inventory snapshot
  sectionTitle('8. Inventory snapshot (current stock)');
  const invRows = inventory
    .map((item) => {
      const qty = (item.sizes || []).reduce((s, sz) => s + (parseFloat(sz.quantity) || 0), 0);
      const cpu = parseFloat(item.costPerUnit) || 0;
      const landed =
        parseFloat(item.totalLandedCost) ||
        parseFloat(item.basePurchaseCost) ||
        cpu * (parseFloat(item.initialQuantity) || qty);
      const initial = parseFloat(item.initialQuantity) || qty || 1;
      const remVal = initial > 0 ? (landed * qty) / initial : 0;
      return [
        (item.productName || '—').slice(0, 28),
        String(Math.round(qty)),
        fmtMoney(cpu),
        fmtMoney(remVal)
      ];
    })
    .filter((r) => parseInt(r[1], 10) > 0 || true);

  autoTable(doc, {
    startY: y,
    head: [['Product', 'Qty on hand', 'Cost / unit', 'Est. stock value']],
    body: invRows.length ? invRows : [['No inventory', '0', '—', '—']],
    styles: { fontSize: 7, cellPadding: 1.5 },
    headStyles: { fillColor: [26, 26, 26] },
    margin: { left: 14, right: 14 },
    columnStyles: {
      1: { halign: 'right' },
      2: { halign: 'right' },
      3: { halign: 'right' }
    }
  });
  y = doc.lastAutoTable.finalY + 12;

  ensureSpace(30);
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text(
    'Notes: Partner/investor payouts (if any) should be recorded as expenses. This pack has no separate investor section.',
    14,
    y,
    { maxWidth: pageW - 28 }
  );
  y += 8;
  doc.text(
    'Stock value is estimated from remaining qty × share of landed/purchase cost. Confirm with purchase invoices if needed.',
    14,
    y,
    { maxWidth: pageW - 28 }
  );
  y += 8;
  doc.text(
    `Andaza NET PROFIT: ${fmtMoney(estimatedNetProfit)}. Tax is file se nahi — accountant batayega.`,
    14,
    y,
    { maxWidth: pageW - 28 }
  );

  const fileName = `Dressify-Accountant-Report_${startDate || 'start'}_to_${endDate || 'end'}.pdf`;
  doc.save(fileName);

  return {
    fileName,
    summary: {
      totalBilled,
      paymentsReceived,
      cogs,
      generalTotal,
      productExpTotal,
      allExpensesTotal,
      estimatedNetProfit,
      estimatedNetOnBilled,
      estimatedGrossOnPayments,
      outstandingTotal,
      earliest
    }
  };
};

/**
 * Suggest From date = earliest activity in loaded data (or fallback).
 */
export const findEarliestActivityDate = ({ sales = [], payments = [], expenses = [] }) => {
  const allDates = [
    ...sales.map((s) => toDate(s.saleDate)),
    ...payments.map((p) => toDate(p.paymentDate)),
    ...expenses.map((e) => toDate(e.expenseDate))
  ].filter(Boolean);
  if (!allDates.length) return null;
  const earliest = new Date(Math.min(...allDates.map((d) => d.getTime())));
  return earliest.toISOString().split('T')[0];
};
