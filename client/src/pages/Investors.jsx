import React, { useState, useEffect } from 'react';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  Landmark,
  ArrowDownCircle,
  ArrowUpCircle,
  Package,
  Wallet,
  TrendingUp,
  Scale
} from 'lucide-react';
import {
  getInvestors,
  createInvestor,
  updateInvestor,
  deleteInvestor,
  getInvestorPortfolio,
  addInvestorLedgerEntry,
  deleteInvestorLedgerEntry
} from '../services/api';
import { showSuccess, showError } from '../utils/toast';
import { ListItemShimmer } from '../components/Shimmer';

const STAFF_MEMBERS = ['Almas', 'Shahzad'];

const formatMoney = (n) => `Rs. ${(parseFloat(n) || 0).toLocaleString()}`;

const getInitials = (name) => {
  const parts = (name || 'I').trim().split(/\s+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return (parts[0][0] || 'I').toUpperCase();
};

const Metric = ({ label, value, hint, tone = 'neutral' }) => {
  const tones = {
    neutral: 'border-neutral-200 bg-white',
    in: 'border-emerald-200/80 bg-emerald-50/40',
    out: 'border-rose-200/80 bg-rose-50/40',
    stock: 'border-neutral-200 bg-neutral-50',
    accent: 'border-ink/10 bg-ink/[0.03]'
  };
  const valueTone = {
    neutral: 'text-ink',
    in: 'text-emerald-800',
    out: 'text-rose-800',
    stock: 'text-ink',
    accent: 'text-ink'
  };
  return (
    <div className={`rounded-xl border p-4 ${tones[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">{label}</p>
      <p className={`mt-1.5 text-xl font-bold tabular-nums tracking-tight ${valueTone[tone]}`}>{value}</p>
      {hint && <p className="mt-1 text-[11px] text-neutral-500 leading-snug">{hint}</p>}
    </div>
  );
};

const Investors = () => {
  const [investors, setInvestors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState(null);
  const [selectedInvestor, setSelectedInvestor] = useState(null);
  const [portfolio, setPortfolio] = useState(null);
  const [loadingPortfolio, setLoadingPortfolio] = useState(false);
  const [showLedgerModal, setShowLedgerModal] = useState(false);
  const [ledgerType, setLedgerType] = useState('capital_in');

  const [formData, setFormData] = useState({
    name: '',
    contact: '',
    notes: '',
    isActive: true
  });

  const [ledgerForm, setLedgerForm] = useState({
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
    addedBy: ''
  });
  /** Profit share % for calculator (e.g. 50 = half of above-cost profit) */
  const [profitSharePct, setProfitSharePct] = useState('50');

  useEffect(() => {
    fetchInvestors();
  }, []);

  const fetchInvestors = async () => {
    try {
      setLoading(true);
      const res = await getInvestors();
      setInvestors(res.data || []);
    } catch (error) {
      showError(error.message || 'Error loading investors');
    } finally {
      setLoading(false);
    }
  };

  const openCreate = () => {
    setEditingInvestor(null);
    setFormData({ name: '', contact: '', notes: '', isActive: true });
    setShowModal(true);
  };

  const openEdit = (inv) => {
    setEditingInvestor(inv);
    setFormData({
      name: inv.name || '',
      contact: inv.contact || '',
      notes: inv.notes || '',
      isActive: inv.isActive !== false
    });
    setShowModal(true);
  };

  const handleSaveInvestor = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      showError('Investor name is required');
      return;
    }
    setSaving(true);
    try {
      if (editingInvestor) {
        await updateInvestor(editingInvestor.id || editingInvestor._id, formData);
        showSuccess('Investor updated');
      } else {
        await createInvestor(formData);
        showSuccess('Investor added');
      }
      setShowModal(false);
      fetchInvestors();
      if (selectedInvestor && editingInvestor &&
        (selectedInvestor.id || selectedInvestor._id) === (editingInvestor.id || editingInvestor._id)) {
        openDetail({ ...selectedInvestor, ...formData });
      }
    } catch (error) {
      showError(error.message || 'Error saving investor');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (inv) => {
    if (!window.confirm(`Delete investor "${inv.name}"? Ledger entries stay unless you remove them separately.`)) return;
    try {
      await deleteInvestor(inv.id || inv._id);
      showSuccess('Investor deleted');
      if (selectedInvestor && (selectedInvestor.id || selectedInvestor._id) === (inv.id || inv._id)) {
        setSelectedInvestor(null);
        setPortfolio(null);
      }
      fetchInvestors();
    } catch (error) {
      showError(error.message || 'Error deleting');
    }
  };

  const openDetail = async (inv) => {
    setSelectedInvestor(inv);
    setLoadingPortfolio(true);
    try {
      const res = await getInvestorPortfolio(inv.id || inv._id);
      setPortfolio(res.data);
    } catch (error) {
      showError(error.message || 'Error loading portfolio');
      setPortfolio(null);
    } finally {
      setLoadingPortfolio(false);
    }
  };

  const openLedger = (type) => {
    setLedgerType(type);
    setLedgerForm({
      amount: '',
      date: new Date().toISOString().split('T')[0],
      notes: '',
      addedBy: ''
    });
    setShowLedgerModal(true);
  };

  const handleSaveLedger = async (e) => {
    e.preventDefault();
    if (!selectedInvestor) return;
    if (!ledgerForm.amount || parseFloat(ledgerForm.amount) <= 0) {
      showError('Enter a valid amount');
      return;
    }
    setSaving(true);
    try {
      await addInvestorLedgerEntry({
        investorId: selectedInvestor.id || selectedInvestor._id,
        investorName: selectedInvestor.name,
        type: ledgerType,
        amount: parseFloat(ledgerForm.amount),
        date: ledgerForm.date,
        notes: ledgerForm.notes,
        addedBy: ledgerForm.addedBy
      });
      showSuccess(ledgerType === 'payout' ? 'Payout recorded' : 'Capital received recorded');
      setShowLedgerModal(false);
      await openDetail(selectedInvestor);
    } catch (error) {
      showError(error.message || 'Error saving entry');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteLedger = async (entry) => {
    if (!window.confirm('Delete this ledger entry?')) return;
    try {
      await deleteInvestorLedgerEntry(entry.id || entry._id);
      showSuccess('Entry deleted');
      await openDetail(selectedInvestor);
    } catch (error) {
      showError(error.message || 'Error deleting entry');
    }
  };

  const filtered = investors.filter((inv) => {
    const term = searchTerm.toLowerCase();
    return (
      inv.name?.toLowerCase().includes(term) ||
      inv.contact?.toLowerCase().includes(term) ||
      inv.notes?.toLowerCase().includes(term)
    );
  });

  const summary = portfolio?.summary;
  const recoveryPct =
    summary && summary.capitalAllocatedToStock > 0
      ? Math.min(100, Math.round((summary.investorCapitalRecovered / summary.capitalAllocatedToStock) * 100))
      : 0;
  const sharePctNum = Math.min(100, Math.max(0, parseFloat(profitSharePct) || 0));
  const totalAboveCost = parseFloat(summary?.totalProfitAboveCost) || 0;
  const investorProfitShare = Math.round((totalAboveCost * sharePctNum) / 100);

  return (
    <div className="space-y-5">
      {/* Page header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-500 mb-1">Capital partners</p>
          <h2 className="text-2xl sm:text-3xl font-bold text-ink tracking-tight">Investors</h2>
          <p className="text-neutral-500 mt-1.5 text-sm max-w-xl">
            Track capital, stock recovery, and settlements — product expenses stay on your books.
          </p>
        </div>
        <button type="button" onClick={openCreate} className="btn-primary flex items-center justify-center gap-2 min-h-[44px] shrink-0">
          <Plus size={18} />
          Add Investor
        </button>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-5 min-h-[60vh]">
        {/* Left rail */}
        <aside className="xl:col-span-4 flex flex-col rounded-2xl border border-neutral-200 bg-white shadow-soft overflow-hidden">
          <div className="p-4 border-b border-neutral-100">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name or contact"
                className="input-field pl-9 text-sm"
              />
            </div>
            <p className="mt-2.5 text-xs text-neutral-400">
              {filtered.length} investor{filtered.length === 1 ? '' : 's'}
            </p>
          </div>

          <div className="flex-1 overflow-y-auto max-h-[62vh]">
            {loading ? (
              <div className="p-4"><ListItemShimmer /></div>
            ) : filtered.length === 0 ? (
              <div className="p-8 text-center">
                <div className="mx-auto w-12 h-12 rounded-full bg-neutral-100 flex items-center justify-center mb-3">
                  <Landmark size={20} className="text-neutral-400" />
                </div>
                <p className="text-sm font-medium text-ink">No investors yet</p>
                <p className="text-xs text-neutral-500 mt-1">Add a partner to start tracking capital.</p>
              </div>
            ) : (
              <ul className="p-2 space-y-1">
                {filtered.map((inv) => {
                  const id = inv.id || inv._id;
                  const active = selectedInvestor && (selectedInvestor.id || selectedInvestor._id) === id;
                  return (
                    <li key={id}>
                      <div
                        className={`group flex items-center gap-3 rounded-xl px-3 py-3 cursor-pointer transition-colors ${
                          active
                            ? 'bg-ink text-white'
                            : 'hover:bg-neutral-50 text-ink'
                        }`}
                        onClick={() => openDetail(inv)}
                      >
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shrink-0 ${
                            active ? 'bg-white/15 text-white' : 'bg-neutral-100 text-ink'
                          }`}
                        >
                          {getInitials(inv.name)}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className={`font-semibold truncate ${active ? 'text-white' : 'text-ink'}`}>
                            {inv.name}
                          </p>
                          <p className={`text-xs truncate ${active ? 'text-white/60' : 'text-neutral-500'}`}>
                            {inv.contact || 'No contact'}
                          </p>
                        </div>
                        <div className={`flex gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity ${active ? 'opacity-100' : ''}`}>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); openEdit(inv); }}
                            className={`p-2 rounded-lg ${active ? 'hover:bg-white/10 text-white/80' : 'hover:bg-neutral-200 text-neutral-500'}`}
                            title="Edit"
                          >
                            <Edit2 size={14} />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); handleDelete(inv); }}
                            className={`p-2 rounded-lg ${active ? 'hover:bg-white/10 text-white/80' : 'hover:bg-rose-50 text-neutral-500 hover:text-rose-600'}`}
                            title="Delete"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </aside>

        {/* Main panel */}
        <section className="xl:col-span-8 space-y-5">
          {!selectedInvestor ? (
            <div className="rounded-2xl border border-dashed border-neutral-300 bg-white/80 px-6 py-20 text-center">
              <div className="mx-auto w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center mb-4">
                <Scale size={24} className="text-neutral-400" />
              </div>
              <h3 className="text-lg font-semibold text-ink">Select an investor</h3>
              <p className="text-sm text-neutral-500 mt-2 max-w-sm mx-auto">
                Choose someone from the list to view capital received, stock recovery, and payout ledger.
              </p>
            </div>
          ) : loadingPortfolio ? (
            <div className="rounded-2xl border border-neutral-200 bg-white p-4 animate-fade-in" aria-busy="true">
              <ListItemShimmer count={4} />
            </div>
          ) : (
            <>
              {/* Profile strip */}
              <div className="rounded-2xl border border-neutral-200 bg-white shadow-soft overflow-hidden">
                <div className="bg-gradient-to-br from-ink to-neutral-800 px-5 sm:px-6 py-5 text-white">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div className="flex items-center gap-4 min-w-0">
                      <div className="w-14 h-14 rounded-2xl bg-white/10 border border-white/10 flex items-center justify-center text-lg font-bold shrink-0">
                        {getInitials(selectedInvestor.name)}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-xl font-bold truncate">{selectedInvestor.name}</h3>
                        <p className="text-sm text-white/60 truncate mt-0.5">
                          {selectedInvestor.contact || 'Partner account'}
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => openLedger('capital_in')}
                        className="inline-flex items-center gap-2 min-h-[42px] px-4 rounded-xl bg-white text-ink text-sm font-semibold hover:bg-neutral-100"
                      >
                        <ArrowDownCircle size={16} className="text-emerald-600" />
                        Capital in
                      </button>
                      <button
                        type="button"
                        onClick={() => openLedger('payout')}
                        className="inline-flex items-center gap-2 min-h-[42px] px-4 rounded-xl bg-white/10 border border-white/20 text-white text-sm font-semibold hover:bg-white/15"
                      >
                        <ArrowUpCircle size={16} />
                        Pay out
                      </button>
                    </div>
                  </div>

                  {summary && summary.capitalAllocatedToStock > 0 && (
                    <div className="mt-5 pt-4 border-t border-white/10">
                      <div className="flex items-center justify-between text-xs mb-2">
                        <span className="text-white/70">Capital recovered from sales</span>
                        <span className="font-semibold tabular-nums">{recoveryPct}%</span>
                      </div>
                      <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
                        <div
                          className="h-full rounded-full bg-emerald-400 transition-all duration-500"
                          style={{ width: `${recoveryPct}%` }}
                        />
                      </div>
                      <p className="text-[11px] text-white/50 mt-2">
                        {formatMoney(summary.investorCapitalRecovered)} of {formatMoney(summary.capitalAllocatedToStock)} in linked stock
                      </p>
                    </div>
                  )}
                </div>

                {summary && (
                  <div className="p-5 space-y-5">
                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Wallet size={16} className="text-neutral-400" />
                        <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">Cash ledger</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Metric label="Received" value={formatMoney(summary.capitalReceived)} tone="in" hint="Money they gave you" />
                        <Metric label="Paid out" value={formatMoney(summary.capitalPaidOut)} tone="out" hint="Returned / profit given" />
                        <Metric label="Balance with you" value={formatMoney(summary.capitalBalanceWithYou)} tone="accent" hint="Received − paid out" />
                      </div>
                    </div>

                    <div>
                      <div className="flex items-center gap-2 mb-3">
                        <Package size={16} className="text-neutral-400" />
                        <h4 className="text-xs font-semibold uppercase tracking-[0.1em] text-neutral-500">Stock recovery</h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                        <Metric label="In linked stock" value={formatMoney(summary.capitalAllocatedToStock)} tone="stock" hint="Tagged on inventory" />
                        <Metric label="Recovered (paid)" value={formatMoney(summary.investorCapitalRecovered)} tone="in" hint="Pro-rata from customer payments" />
                        <Metric label="Still in stock" value={formatMoney(summary.investorCapitalStillIn)} tone="stock" hint="Not yet recovered" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1 border-t border-neutral-100">
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-semibold">Sold billed</p>
                        <p className="text-sm font-semibold text-ink mt-0.5 tabular-nums">{formatMoney(summary.soldBilled)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-semibold">Cash received</p>
                        <p className="text-sm font-semibold text-emerald-700 mt-0.5 tabular-nums">{formatMoney(summary.paidReceived)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-semibold">Customer due</p>
                        <p className="text-sm font-semibold text-rose-700 mt-0.5 tabular-nums">{formatMoney(summary.customerDue)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] uppercase tracking-wide text-neutral-400 font-semibold">Your cost in these</p>
                        <p className="text-sm font-semibold text-ink mt-0.5 tabular-nums">{formatMoney(summary.ownCapitalInLinkedProducts)}</p>
                      </div>
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-relaxed flex items-start gap-1.5">
                      <TrendingUp size={12} className="mt-0.5 shrink-0" />
                      Profit starts after full landed cost ({formatMoney(summary.totalLandedLinked)}) is recovered from payments. Product expenses count as your cost.
                    </p>
                  </div>
                )}
              </div>

              {/* Profit share % calculator */}
              {summary && (portfolio?.products?.length || 0) > 0 && (
                <div className="rounded-2xl border border-neutral-200 bg-white shadow-soft overflow-hidden">
                  <div className="px-5 py-4 border-b border-neutral-100 flex items-center gap-2">
                    <Scale size={16} className="text-neutral-400" />
                    <div>
                      <h4 className="font-semibold text-ink">Profit share calculator</h4>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        Linked products pe funding % + aap agreement % se profit nikaalo
                      </p>
                    </div>
                  </div>
                  <div className="p-5 space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                      <Metric
                        label="Investor funding %"
                        value={`${summary.overallInvestorSharePct ?? 0}%`}
                        tone="stock"
                        hint="Unka paisa ÷ total landed (linked)"
                      />
                      <Metric
                        label="Profit above cost"
                        value={formatMoney(totalAboveCost)}
                        tone={totalAboveCost > 0 ? 'in' : 'neutral'}
                        hint="Paid − landed (abhi tak)"
                      />
                      <div className="rounded-xl border border-ink/10 bg-ink/[0.03] p-4">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-neutral-500">
                          Their profit share
                        </p>
                        <div className="mt-2 flex items-center gap-2">
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={profitSharePct}
                            onChange={(e) => setProfitSharePct(e.target.value)}
                            className="w-20 rounded-lg border border-neutral-200 bg-white px-2.5 py-2 text-sm font-semibold text-ink tabular-nums focus:outline-none focus:ring-2 focus:ring-ink/20"
                          />
                          <span className="text-sm font-medium text-neutral-500">%</span>
                        </div>
                        <p className="mt-2 text-xl font-bold tabular-nums text-ink">
                          {formatMoney(investorProfitShare)}
                        </p>
                        <p className="mt-1 text-[11px] text-neutral-500 leading-snug">
                          {sharePctNum}% of above-cost profit
                        </p>
                      </div>
                    </div>
                    <p className="text-[11px] text-neutral-400 leading-relaxed">
                      Example: above cost {formatMoney(totalAboveCost)} × {sharePctNum}% = {formatMoney(investorProfitShare)}.
                      Yeh amount Pay out se de sakte ho jab capital recover ho chuka ho.
                      Quick:{' '}
                      {[25, 50, 75, 100].map((n) => (
                        <button
                          key={n}
                          type="button"
                          onClick={() => setProfitSharePct(String(n))}
                          className={`mr-1.5 mt-1 inline-flex px-2 py-0.5 rounded-md text-[11px] font-semibold border ${
                            sharePctNum === n
                              ? 'bg-ink text-white border-ink'
                              : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-50'
                          }`}
                        >
                          {n}%
                        </button>
                      ))}
                    </p>
                  </div>
                </div>
              )}

              {/* Products */}
              <div className="rounded-2xl border border-neutral-200 bg-white shadow-soft overflow-hidden">
                <div className="px-5 py-4 border-b border-neutral-100 flex items-center justify-between">
                  <div>
                    <h4 className="font-semibold text-ink">Linked products</h4>
                    <p className="text-xs text-neutral-500 mt-0.5">Inventory funded with this partner’s capital — % = investor ÷ landed</p>
                  </div>
                  <span className="text-xs font-medium text-neutral-500 bg-neutral-100 px-2.5 py-1 rounded-lg">
                    {portfolio?.products?.length || 0}
                  </span>
                </div>
                {!portfolio?.products?.length ? (
                  <div className="px-5 py-10 text-center">
                    <p className="text-sm text-neutral-500">No stock tagged yet.</p>
                    <p className="text-xs text-neutral-400 mt-1">
                      Inventory → Add/Edit → set Own + Investor funding amounts.
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Mobile cards */}
                    <div className="sm:hidden divide-y divide-neutral-100">
                      {portfolio.products.map((p) => {
                        const theirShareOfProfit = Math.round(((p.profitAboveCost || 0) * sharePctNum) / 100);
                        return (
                        <div key={p.id} className="p-4 space-y-2">
                          <div className="flex items-start justify-between gap-2">
                            <p className="font-semibold text-ink">{p.productName}</p>
                            <span className="shrink-0 text-[11px] font-bold tabular-nums bg-ink/5 text-ink px-2 py-0.5 rounded-md">
                              {p.investorSharePct ?? 0}%
                            </span>
                          </div>
                          <div className="grid grid-cols-2 gap-2 text-xs">
                            <div><span className="text-neutral-400">Landed</span><p className="font-medium tabular-nums">{formatMoney(p.totalLandedCost)}</p></div>
                            <div><span className="text-neutral-400">Investor</span><p className="font-medium tabular-nums">{formatMoney(p.fundingInvestorAmount)}</p></div>
                            <div><span className="text-neutral-400">Paid</span><p className="font-medium text-emerald-700 tabular-nums">{formatMoney(p.paidAmount)}</p></div>
                            <div><span className="text-neutral-400">Recovered</span><p className="font-medium tabular-nums">{formatMoney(p.investorRecovered)} ({p.recoveryPctOfInvestor ?? 0}%)</p></div>
                            <div><span className="text-neutral-400">Above cost</span><p className="font-medium tabular-nums">{formatMoney(p.profitAboveCost)}</p></div>
                            <div><span className="text-neutral-400">Unka share ({sharePctNum}%)</span><p className="font-medium tabular-nums text-ink">{formatMoney(theirShareOfProfit)}</p></div>
                          </div>
                        </div>
                        );
                      })}
                    </div>
                    {/* Desktop table */}
                    <div className="hidden sm:block overflow-x-auto">
                      <table className="w-full text-sm min-w-[860px]">
                        <thead>
                          <tr className="border-b border-neutral-100 text-[11px] uppercase tracking-wide text-neutral-400">
                            <th className="text-left font-semibold px-5 py-3">Product</th>
                            <th className="text-right font-semibold px-3 py-3">Landed</th>
                            <th className="text-right font-semibold px-3 py-3">Investor</th>
                            <th className="text-right font-semibold px-3 py-3">Fund %</th>
                            <th className="text-right font-semibold px-3 py-3">Yours + exp</th>
                            <th className="text-right font-semibold px-3 py-3">Paid</th>
                            <th className="text-right font-semibold px-3 py-3">Recovered</th>
                            <th className="text-right font-semibold px-3 py-3">Above cost</th>
                            <th className="text-right font-semibold px-5 py-3">Share {sharePctNum}%</th>
                          </tr>
                        </thead>
                        <tbody>
                          {portfolio.products.map((p) => {
                            const theirShareOfProfit = Math.round(((p.profitAboveCost || 0) * sharePctNum) / 100);
                            return (
                            <tr key={p.id} className="border-b border-neutral-50 hover:bg-neutral-50/80">
                              <td className="px-5 py-3.5 font-medium text-ink">{p.productName}</td>
                              <td className="px-3 py-3.5 text-right tabular-nums text-neutral-600">{formatMoney(p.totalLandedCost)}</td>
                              <td className="px-3 py-3.5 text-right tabular-nums font-medium text-ink">{formatMoney(p.fundingInvestorAmount)}</td>
                              <td className="px-3 py-3.5 text-right tabular-nums font-semibold text-ink">{p.investorSharePct ?? 0}%</td>
                              <td className="px-3 py-3.5 text-right tabular-nums text-neutral-600">{formatMoney(p.ownCapitalWithExpenses)}</td>
                              <td className="px-3 py-3.5 text-right tabular-nums font-medium text-emerald-700">{formatMoney(p.paidAmount)}</td>
                              <td className="px-3 py-3.5 text-right tabular-nums font-medium text-ink">
                                {formatMoney(p.investorRecovered)}
                                <span className="block text-[10px] text-neutral-400 font-normal">{p.recoveryPctOfInvestor ?? 0}% of capital</span>
                              </td>
                              <td className="px-3 py-3.5 text-right tabular-nums text-neutral-600">{formatMoney(p.profitAboveCost)}</td>
                              <td className="px-5 py-3.5 text-right tabular-nums font-semibold text-ink">{formatMoney(theirShareOfProfit)}</td>
                            </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </>
                )}
              </div>

              {/* Ledger */}
              <div className="rounded-2xl border border-neutral-200 bg-white shadow-soft overflow-hidden">
                <div className="px-5 py-4 border-b border-neutral-100">
                  <h4 className="font-semibold text-ink">Settlement ledger</h4>
                  <p className="text-xs text-neutral-500 mt-0.5">Capital received and payouts to this investor</p>
                </div>
                {!portfolio?.ledger?.length ? (
                  <div className="px-5 py-10 text-center text-sm text-neutral-500">
                    No movements yet. Use Capital in or Pay out above.
                  </div>
                ) : (
                  <ul className="divide-y divide-neutral-100">
                    {portfolio.ledger.map((entry) => {
                      const d = entry.date?.toDate ? entry.date.toDate() : new Date(entry.date);
                      const dateStr = isNaN(d?.getTime?.()) ? '—' : d.toLocaleDateString('en-PK', { dateStyle: 'medium' });
                      const isPayout = entry.type === 'payout';
                      return (
                        <li key={entry.id || entry._id} className="px-5 py-4 flex items-start gap-3">
                          <div className={`mt-0.5 w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${
                            isPayout ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                          }`}>
                            {isPayout ? <ArrowUpCircle size={18} /> : <ArrowDownCircle size={18} />}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-baseline justify-between gap-2">
                              <p className="text-sm font-semibold text-ink">
                                {isPayout ? 'Payout' : 'Capital received'}
                              </p>
                              <p className={`text-sm font-bold tabular-nums ${isPayout ? 'text-rose-700' : 'text-emerald-700'}`}>
                                {isPayout ? '−' : '+'}{formatMoney(entry.amount)}
                              </p>
                            </div>
                            <p className="text-xs text-neutral-500 mt-0.5">
                              {dateStr}{entry.addedBy ? ` · ${entry.addedBy}` : ''}
                            </p>
                            {entry.notes && (
                              <p className="text-xs text-neutral-600 mt-1.5 leading-relaxed">{entry.notes}</p>
                            )}
                          </div>
                          <button
                            type="button"
                            onClick={() => handleDeleteLedger(entry)}
                            className="p-2 text-neutral-300 hover:text-rose-600 rounded-lg shrink-0"
                            title="Delete"
                          >
                            <Trash2 size={15} />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </>
          )}
        </section>
      </div>

      {/* Investor form */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full max-h-[92dvh] overflow-y-auto">
            <div className="p-5 border-b border-neutral-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-bold text-ink">{editingInvestor ? 'Edit investor' : 'New investor'}</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Partner details for capital tracking</p>
              </div>
              <button type="button" onClick={() => setShowModal(false)} className="text-neutral-400 hover:text-ink text-2xl leading-none min-w-[40px]">×</button>
            </div>
            <form onSubmit={handleSaveInvestor} className="p-5 space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Name *</label>
                <input
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="input-field"
                  placeholder="e.g. Zubair"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Contact</label>
                <input
                  value={formData.contact}
                  onChange={(e) => setFormData({ ...formData, contact: e.target.value })}
                  className="input-field"
                  placeholder="Phone / WhatsApp"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input-field"
                  rows={3}
                  placeholder="Optional agreement notes…"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowModal(false)} className="btn-secondary min-h-[44px]">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary min-h-[44px]">{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Ledger modal */}
      {showLedgerModal && selectedInvestor && (
        <div className="fixed inset-0 bg-black/50 flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-w-md w-full max-h-[92dvh] overflow-y-auto">
            <div className="p-5 border-b border-neutral-100 flex justify-between items-center sticky top-0 bg-white z-10">
              <div>
                <h3 className="text-lg font-bold text-ink">
                  {ledgerType === 'payout' ? 'Record payout' : 'Record capital'}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">{selectedInvestor.name}</p>
              </div>
              <button type="button" onClick={() => setShowLedgerModal(false)} className="text-neutral-400 hover:text-ink text-2xl leading-none min-w-[40px]">×</button>
            </div>
            <form onSubmit={handleSaveLedger} className="p-5 space-y-4">
              <p className="text-sm text-neutral-600 leading-relaxed">
                {ledgerType === 'payout'
                  ? 'Money you paid them — capital return or agreed profit share.'
                  : 'Money they gave you to put into stock.'}
              </p>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Amount (Rs.) *</label>
                <input
                  type="text"
                  required
                  value={ledgerForm.amount}
                  onChange={(e) => {
                    const v = e.target.value;
                    if (v === '' || /^\d*\.?\d*$/.test(v)) setLedgerForm({ ...ledgerForm, amount: v });
                  }}
                  className="input-field text-lg font-semibold tabular-nums"
                  placeholder="1000000"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Date *</label>
                <input
                  type="date"
                  required
                  value={ledgerForm.date}
                  onChange={(e) => setLedgerForm({ ...ledgerForm, date: e.target.value })}
                  className="input-field"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Recorded by</label>
                <select
                  value={ledgerForm.addedBy}
                  onChange={(e) => setLedgerForm({ ...ledgerForm, addedBy: e.target.value })}
                  className="input-field"
                >
                  <option value="">Optional</option>
                  {STAFF_MEMBERS.map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1.5">Notes</label>
                <textarea
                  value={ledgerForm.notes}
                  onChange={(e) => setLedgerForm({ ...ledgerForm, notes: e.target.value })}
                  className="input-field"
                  rows={2}
                  placeholder={ledgerType === 'payout' ? 'e.g. Returned capital + profit…' : 'e.g. Cash for stock batch'}
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowLedgerModal(false)} className="btn-secondary min-h-[44px]">Cancel</button>
                <button type="submit" disabled={saving} className="btn-primary min-h-[44px]">{saving ? 'Saving…' : 'Save'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Investors;
