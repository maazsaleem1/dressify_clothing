import React, { useState, useEffect } from 'react';
import { Plus, Search, Edit2, Trash2, DollarSign, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { getExpenses, createExpensesBatch, updateExpense, deleteExpense, getInventory } from '../services/api';
import { showSuccess, showError } from '../utils/toast';
import { ListItemShimmer } from '../components/Shimmer';

const Expenses = () => {
  const [expenses, setExpenses] = useState([]);
  const [inventoryList, setInventoryList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [editingGroupId, setEditingGroupId] = useState(null);
  const [originalGroupExpenseIds, setOriginalGroupExpenseIds] = useState([]);
  const [expandedGroups, setExpandedGroups] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState('');
  const [filterMonth, setFilterMonth] = useState(String(new Date().getMonth() + 1));
  const [filterYear, setFilterYear] = useState(new Date().getFullYear());
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 10;

  const expenseCategories = [
    'Tea & Food',
    'Labour',
    'Rafu',
    'Wash',
    'Weaving',
    'Electricity',
    'Rent',
    'Transport',
    'Maintenance',
    'Partner / Personal',
    'Other'
  ];

  const newExpenseLine = (overrides = {}) => ({
    key: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    category: 'Labour',
    description: '',
    amount: '',
    expenseId: null,
    isOriginal: false,
    ...overrides
  });

  const [expenseLines, setExpenseLines] = useState([newExpenseLine()]);

  const [formData, setFormData] = useState({
    description: '',
    amount: '',
    category: 'Tea & Food',
    expenseDate: new Date().toISOString().split('T')[0],
    notes: '',
    expenseScope: 'general',
    inventoryId: ''
  });

  useEffect(() => {
    fetchData();
    getInventory().then(res => setInventoryList(res.data || [])).catch(() => {});
  }, [filterMonth, filterYear]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const filters = {};
      if (filterMonth && filterMonth.trim() !== '' && filterYear) {
        const monthNum = parseInt(filterMonth);
        const yearNum = parseInt(filterYear);
        if (!isNaN(monthNum) && !isNaN(yearNum)) {
          filters.month = monthNum;
          filters.year = yearNum;
        }
      }
      const response = await getExpenses(filters);
      setExpenses(response.data);
    } catch (error) {
      console.error('Error fetching expenses:', error);
      showError(error.message || 'Error fetching expenses. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateValue) => {
    if (!dateValue) return 'N/A';

    let date;
    if (dateValue instanceof Date) {
      date = dateValue;
    } else if (dateValue?.toDate) {
      date = dateValue.toDate();
    } else if (typeof dateValue === 'string' || typeof dateValue === 'number') {
      date = new Date(dateValue);
    } else {
      return 'N/A';
    }

    if (isNaN(date.getTime())) {
      return 'N/A';
    }

    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  };

  const resetForm = () => {
    setFormData({
      description: '',
      amount: '',
      category: 'Tea & Food',
      expenseDate: new Date().toISOString().split('T')[0],
      notes: '',
      expenseScope: 'general',
      inventoryId: ''
    });
    setExpenseLines([newExpenseLine()]);
    setEditingExpense(null);
    setEditingGroupId(null);
    setOriginalGroupExpenseIds([]);
  };

  const getExpenseTimestamp = (expense) => {
    if (!expense?.expenseDate) return 0;
    const d = expense.expenseDate?.toDate ? expense.expenseDate.toDate() : new Date(expense.expenseDate);
    return isNaN(d.getTime()) ? 0 : d.getTime();
  };

  const getExpenseDateKey = (expense) => {
    if (!expense?.expenseDate) return 'unknown';
    const d = expense.expenseDate?.toDate ? expense.expenseDate.toDate() : new Date(expense.expenseDate);
    if (isNaN(d.getTime())) return 'unknown';
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getProductName = (expense) =>
    inventoryList.find(p => (p.id || p._id) === expense.inventoryId)?.productName ||
    expense.productName ||
    '—';

  const groupExpensesForDisplay = (expenseList) => {
    const generalByDate = new Map();
    const productGroups = new Map();

    expenseList.forEach(expense => {
      if (expense.inventoryId) {
        const key = expense.inventoryId;
        if (!productGroups.has(key)) productGroups.set(key, []);
        productGroups.get(key).push(expense);
      } else {
        const dateKey = getExpenseDateKey(expense);
        if (!generalByDate.has(dateKey)) generalByDate.set(dateKey, []);
        generalByDate.get(dateKey).push(expense);
      }
    });

    const rows = [];
    productGroups.forEach((items, inventoryId) => {
      const sorted = [...items].sort((a, b) => getExpenseTimestamp(b) - getExpenseTimestamp(a));
      rows.push({
        type: 'product-group',
        inventoryId,
        items: sorted,
        totalAmount: sorted.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0),
        latestDate: sorted[0]?.expenseDate,
        productName: getProductName(sorted[0])
      });
    });

    generalByDate.forEach((items, dateKey) => {
      const sorted = [...items].sort((a, b) => getExpenseTimestamp(b) - getExpenseTimestamp(a));
      if (sorted.length === 1) {
        rows.push({ type: 'general', expense: sorted[0] });
      } else {
        rows.push({
          type: 'date-group',
          dateKey,
          items: sorted,
          totalAmount: sorted.reduce((s, e) => s + (parseFloat(e.amount) || 0), 0),
          expenseDate: sorted[0]?.expenseDate
        });
      }
    });

    rows.sort((a, b) => {
      const tsA = a.type === 'product-group'
        ? getExpenseTimestamp({ expenseDate: a.latestDate })
        : a.type === 'date-group'
          ? getExpenseTimestamp({ expenseDate: a.expenseDate })
          : getExpenseTimestamp(a.expense);
      const tsB = b.type === 'product-group'
        ? getExpenseTimestamp({ expenseDate: b.latestDate })
        : b.type === 'date-group'
          ? getExpenseTimestamp({ expenseDate: b.expenseDate })
          : getExpenseTimestamp(b.expense);
      return tsB - tsA;
    });

    return rows;
  };

  const toggleGroupExpand = (groupKey) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupKey)) next.delete(groupKey);
      else next.add(groupKey);
      return next;
    });
  };

  const openProductGroupModal = (group) => {
    const first = group.items[0];
    const expenseDate = first.expenseDate?.toDate ? first.expenseDate.toDate() : new Date(first.expenseDate);
    setEditingExpense(null);
    setEditingGroupId(group.inventoryId);
    setOriginalGroupExpenseIds(group.items.map(e => e.id || e._id));
    setFormData({
      description: '',
      amount: '',
      category: 'Tea & Food',
      expenseDate: expenseDate.toISOString().split('T')[0],
      notes: '',
      expenseScope: 'product',
      inventoryId: group.inventoryId
    });
    setExpenseLines(group.items.map(exp => newExpenseLine({
      key: `edit-${exp.id || exp._id}`,
      category: exp.category || 'Other',
      description: exp.description || '',
      amount: exp.amount != null ? String(exp.amount) : '',
      expenseId: exp.id || exp._id,
      isOriginal: true
    })));
    setShowModal(true);
  };

  const updateExpenseLine = (key, field, value) => {
    setExpenseLines(lines => lines.map(l => (l.key === key ? { ...l, [field]: value } : l)));
  };

  const addExpenseLine = () => {
    setExpenseLines(lines => [...lines, newExpenseLine()]);
  };

  const removeExpenseLine = (key) => {
    setExpenseLines(lines => {
      if (lines.length <= 1) return lines;
      const line = lines.find(l => l.key === key);
      if (!editingGroupId && line?.isOriginal) return lines;
      return lines.filter(l => l.key !== key);
    });
  };

  const buildLinePayload = (line) => {
    const selectedProduct = inventoryList.find(p => (p.id || p._id) === formData.inventoryId);
    return {
      description: line.description.trim() || line.category,
      amount: parseFloat(line.amount) || 0,
      category: line.category,
      expenseDate: formData.expenseDate,
      notes: formData.notes,
      inventoryId: formData.expenseScope === 'product' ? formData.inventoryId : '',
      productName: selectedProduct?.productName || ''
    };
  };

  const handleEdit = (expense) => {
    if (expense.inventoryId) {
      const groupItems = expenses.filter(e => e.inventoryId === expense.inventoryId);
      openProductGroupModal({
        inventoryId: expense.inventoryId,
        items: groupItems
      });
      return;
    }

    const expenseId = expense.id || expense._id;
    const expenseDate = expense.expenseDate?.toDate ? expense.expenseDate.toDate() : new Date(expense.expenseDate);
    setEditingGroupId(null);
    setOriginalGroupExpenseIds([]);
    setEditingExpense(expense);
    setFormData({
      description: '',
      amount: '',
      category: 'Tea & Food',
      expenseDate: expenseDate.toISOString().split('T')[0],
      notes: expense.notes || '',
      expenseScope: expense.inventoryId ? 'product' : 'general',
      inventoryId: expense.inventoryId || ''
    });
    setExpenseLines([newExpenseLine({
      key: `edit-${expenseId}`,
      category: expense.category || 'Tea & Food',
      description: expense.description || '',
      amount: expense.amount != null ? String(expense.amount) : '',
      expenseId,
      isOriginal: true
    })]);
    setShowModal(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const validLines = expenseLines.filter(l => parseFloat(l.amount) > 0);
    if (validLines.length === 0) {
      showError('Add at least one expense with an amount');
      return;
    }
    if (formData.expenseScope === 'product' && !formData.inventoryId) {
      showError('Please select a product for product expense');
      return;
    }

    setSaving(true);
    try {
      if (editingGroupId) {
        const validLines = expenseLines.filter(l => parseFloat(l.amount) > 0);
        if (validLines.length === 0) {
          showError('Add at least one expense with an amount');
          setSaving(false);
          return;
        }

        for (const line of validLines.filter(l => l.expenseId)) {
          await updateExpense(line.expenseId, buildLinePayload(line));
        }

        const newLines = validLines.filter(l => !l.expenseId);
        if (newLines.length > 0) {
          await createExpensesBatch(newLines.map(line => buildLinePayload(line)));
        }

        const keptIds = new Set(validLines.map(l => l.expenseId).filter(Boolean));
        for (const id of originalGroupExpenseIds) {
          if (!keptIds.has(id)) {
            await deleteExpense(id);
          }
        }

        showSuccess('Product expenses updated successfully!');
      } else if (editingExpense) {
        const editId = editingExpense.id || editingExpense._id;
        const originalLine = expenseLines.find(l => l.expenseId === editId);
        if (!originalLine || parseFloat(originalLine.amount) <= 0) {
          showError('The expense being edited must have an amount');
          setSaving(false);
          return;
        }
        await updateExpense(editId, buildLinePayload(originalLine));

        const newLines = validLines.filter(l => !l.expenseId);
        if (newLines.length > 0) {
          await createExpensesBatch(newLines.map(line => buildLinePayload(line)));
        }

        showSuccess(
          newLines.length > 0
            ? `Expense updated and ${newLines.length} new expense(s) added!`
            : 'Expense updated successfully!'
        );
      } else {
        await createExpensesBatch(validLines.map(line => buildLinePayload(line)));
        showSuccess(
          validLines.length === 1
            ? 'Expense added successfully!'
            : `${validLines.length} expenses added successfully!`
        );
      }
      setShowModal(false);
      resetForm();
      fetchData();
      getInventory().then(res => setInventoryList(res.data || [])).catch(() => {});
    } catch (error) {
      showError(error.message || 'Error saving expense');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Are you sure you want to delete this expense?')) {
      return;
    }

    setDeleting(id);
    try {
      await deleteExpense(id);
      showSuccess('Expense deleted successfully!');
      fetchData();
    } catch (error) {
      showError(error.message || 'Error deleting expense');
    } finally {
      setDeleting(null);
    }
  };

  const filteredExpenses = expenses.filter(expense => {
    if (!searchTerm) return true;
    const term = searchTerm.toLowerCase();
    return expense.description?.toLowerCase().includes(term) ||
      expense.category?.toLowerCase().includes(term) ||
      expense.productName?.toLowerCase().includes(term) ||
      getProductName(expense).toLowerCase().includes(term);
  });

  const displayRows = groupExpensesForDisplay(filteredExpenses);

  const months = [
    { value: '', label: 'All Months' },
    { value: '1', label: 'January' },
    { value: '2', label: 'February' },
    { value: '3', label: 'March' },
    { value: '4', label: 'April' },
    { value: '5', label: 'May' },
    { value: '6', label: 'June' },
    { value: '7', label: 'July' },
    { value: '8', label: 'August' },
    { value: '9', label: 'September' },
    { value: '10', label: 'October' },
    { value: '11', label: 'November' },
    { value: '12', label: 'December' }
  ];

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 5 }, (_, i) => currentYear - i);

  const generalTotal = filteredExpenses
    .filter((expense) => !expense.inventoryId)
    .reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);

  const productTotal = filteredExpenses
    .filter((expense) => !!expense.inventoryId)
    .reduce((sum, expense) => sum + (parseFloat(expense.amount) || 0), 0);

  const totalExpenses = generalTotal + productTotal;

  const periodLabel = filterMonth
    ? `${months.find(m => m.value === filterMonth)?.label || ''} ${filterYear}`
    : `All Time`;

  const totalPages = Math.ceil(displayRows.length / itemsPerPage);
  const paginatedRows = displayRows.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:justify-between sm:items-center">
        <div className="min-w-0">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-800 hidden sm:block">Daily Expenses</h1>
          <p className="text-sm text-gray-600 sm:mt-1">Track shop expenses and daily costs</p>
        </div>
        <button
          onClick={() => {
            resetForm();
            setShowModal(true);
          }}
          className="btn-primary flex items-center justify-center gap-2 w-full sm:w-auto"
        >
          <Plus className="w-5 h-5" />
          Add Expense
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-gray-500 text-sm font-medium">General Expenses</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 break-words">Rs. {generalTotal.toLocaleString()}</p>
              <p className="text-gray-400 text-xs mt-1">{periodLabel}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5 text-gray-600" />
            </div>
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-gray-500 text-sm font-medium">Product Expenses</p>
              <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 break-words">Rs. {productTotal.toLocaleString()}</p>
              <p className="text-gray-400 text-xs mt-1">{periodLabel}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5 text-blue-600" />
            </div>
          </div>
        </div>

        <div className="bg-ink text-white rounded-lg shadow-sm p-4 sm:p-5">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-neutral-300 text-sm font-medium">Grand Total</p>
              <p className="text-xl sm:text-2xl font-bold mt-1 break-words">Rs. {totalExpenses.toLocaleString()}</p>
              <p className="text-neutral-400 text-xs mt-1">{periodLabel}</p>
            </div>
            <div className="w-10 h-10 rounded-lg bg-white/10 flex items-center justify-center shrink-0">
              <DollarSign className="w-5 h-5 text-white" />
            </div>
          </div>
        </div>
      </div>

      <div className="bg-white rounded-lg shadow-md p-3 sm:p-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-4 mb-4 sm:mb-6">
          <div className="flex-1 relative min-w-0">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search expenses..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="input-field pl-10 w-full"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex sm:gap-2">
            <select
              value={filterMonth}
              onChange={(e) => setFilterMonth(e.target.value)}
              className="input-field min-w-0"
            >
              {months.map(month => (
                <option key={month.value} value={month.value}>{month.label}</option>
              ))}
            </select>
            <select
              value={filterYear}
              onChange={(e) => setFilterYear(parseInt(e.target.value))}
              className="input-field min-w-0"
            >
              {years.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {loading ? (
          <ListItemShimmer count={5} />
        ) : (
          <>
            <div className="overflow-x-auto -mx-3 sm:mx-0">
              <table className="w-full min-w-[640px]">
                <thead>
                  <tr className="border-b border-gray-200">
                    <th className="text-left py-3 px-3 sm:px-4 font-semibold text-gray-700 text-sm">Date</th>
                    <th className="text-left py-3 px-3 sm:px-4 font-semibold text-gray-700 text-sm">Description</th>
                    <th className="text-left py-3 px-3 sm:px-4 font-semibold text-gray-700 text-sm hidden sm:table-cell">Category</th>
                    <th className="text-left py-3 px-3 sm:px-4 font-semibold text-gray-700 text-sm hidden md:table-cell">Type</th>
                    <th className="text-left py-3 px-3 sm:px-4 font-semibold text-gray-700 text-sm hidden lg:table-cell">Product</th>
                    <th className="text-right py-3 px-3 sm:px-4 font-semibold text-gray-700 text-sm">Amount</th>
                    <th className="text-right py-3 px-3 sm:px-4 font-semibold text-gray-700 text-sm">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRows.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="text-center py-8 text-gray-500">
                        No expenses found. Add your first expense to get started.
                      </td>
                    </tr>
                  ) : (
                    paginatedRows.map((row) => {
                      if (row.type === 'product-group') {
                        const isExpanded = expandedGroups.has(row.inventoryId);
                        const categories = [...new Set(row.items.map(e => e.category).filter(Boolean))];
                        return (
                          <React.Fragment key={`group-${row.inventoryId}`}>
                            <tr className="border-b border-gray-100 hover:bg-amber-50/40 bg-amber-50/20">
                              <td className="py-3 px-3 sm:px-4 text-sm whitespace-nowrap">{formatDate(row.latestDate)}</td>
                              <td className="py-3 px-3 sm:px-4">
                                <button
                                  type="button"
                                  onClick={() => toggleGroupExpand(row.inventoryId)}
                                  className="flex items-center gap-2 text-left font-medium text-gray-800 hover:text-amber-800 min-h-[40px]"
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
                                  <span className="break-words">{categories.join(', ')}</span>
                                  <span className="text-xs font-normal text-gray-500 shrink-0">({row.items.length})</span>
                                </button>
                              </td>
                              <td className="py-3 px-3 sm:px-4 hidden sm:table-cell">
                                <div className="flex flex-wrap gap-1">
                                  {categories.map(cat => (
                                    <span key={cat} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                      {cat}
                                    </span>
                                  ))}
                                </div>
                              </td>
                              <td className="py-3 px-3 sm:px-4 hidden md:table-cell">
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-800">
                                  Product
                                </span>
                              </td>
                              <td className="py-3 px-3 sm:px-4 text-sm font-medium text-gray-800 hidden lg:table-cell">
                                {row.productName}
                              </td>
                              <td className="py-3 px-3 sm:px-4 font-semibold text-red-600 text-right text-sm whitespace-nowrap">
                                Rs. {row.totalAmount.toLocaleString()}
                              </td>
                              <td className="py-3 px-3 sm:px-4 text-right">
                                <button
                                  onClick={() => openProductGroupModal(row)}
                                  className="p-2 text-green-600 hover:bg-green-50 rounded-lg min-h-[40px] min-w-[40px] inline-flex items-center justify-center"
                                  title="Manage all expenses for this product"
                                >
                                  <Edit2 className="w-4 h-4" />
                                </button>
                              </td>
                            </tr>
                            {isExpanded && row.items.map(expense => (
                              <tr key={expense.id || expense._id} className="border-b border-gray-50 bg-gray-50/80">
                                <td className="py-2 px-3 sm:px-4 pl-8 sm:pl-10 text-sm text-gray-500">{formatDate(expense.expenseDate)}</td>
                                <td className="py-2 px-3 sm:px-4 text-sm text-gray-700 break-words">{expense.description}</td>
                                <td className="py-2 px-3 sm:px-4 hidden sm:table-cell">
                                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">{expense.category}</span>
                                </td>
                                <td className="py-2 px-3 sm:px-4 hidden md:table-cell" />
                                <td className="py-2 px-3 sm:px-4 hidden lg:table-cell" />
                                <td className="py-2 px-3 sm:px-4 text-sm font-medium text-red-600 text-right whitespace-nowrap">
                                  Rs. {parseFloat(expense.amount || 0).toLocaleString()}
                                </td>
                                <td className="py-2 px-3 sm:px-4 text-right">
                                  <button
                                    onClick={() => handleDelete(expense.id || expense._id)}
                                    disabled={deleting === (expense.id || expense._id)}
                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 min-h-[40px] min-w-[40px] inline-flex items-center justify-center"
                                    title="Delete this line"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      }

                      if (row.type === 'date-group') {
                        const groupKey = `date-${row.dateKey}`;
                        const isExpanded = expandedGroups.has(groupKey);
                        const categories = [...new Set(row.items.map(e => e.category).filter(Boolean))];
                        return (
                          <React.Fragment key={groupKey}>
                            <tr className="border-b border-gray-100 hover:bg-gray-50 bg-gray-50/40">
                              <td className="py-3 px-3 sm:px-4 font-medium text-gray-800 text-sm whitespace-nowrap">{formatDate(row.expenseDate)}</td>
                              <td className="py-3 px-3 sm:px-4">
                                <button
                                  type="button"
                                  onClick={() => toggleGroupExpand(groupKey)}
                                  className="flex items-center gap-2 text-left font-medium text-gray-800 hover:text-gray-600 min-h-[40px]"
                                >
                                  {isExpanded ? <ChevronUp className="w-4 h-4 shrink-0" /> : <ChevronDown className="w-4 h-4 shrink-0" />}
                                  <span>{row.items.length} expenses</span>
                                  <span className="text-xs font-normal text-gray-500 hidden xs:inline sm:inline">
                                    ({categories.slice(0, 2).join(', ')}{categories.length > 2 ? '…' : ''})
                                  </span>
                                </button>
                              </td>
                              <td className="py-3 px-3 sm:px-4 hidden sm:table-cell">
                                <div className="flex flex-wrap gap-1">
                                  {categories.slice(0, 3).map(cat => (
                                    <span key={cat} className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                                      {cat}
                                    </span>
                                  ))}
                                  {categories.length > 3 && (
                                    <span className="px-2 py-1 bg-gray-100 text-gray-600 rounded-full text-xs">
                                      +{categories.length - 3}
                                    </span>
                                  )}
                                </div>
                              </td>
                              <td className="py-3 px-3 sm:px-4 hidden md:table-cell">
                                <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                                  General
                                </span>
                              </td>
                              <td className="py-3 px-3 sm:px-4 text-sm text-gray-600 hidden lg:table-cell">—</td>
                              <td className="py-3 px-3 sm:px-4 font-semibold text-red-600 text-right text-sm whitespace-nowrap">
                                Rs. {row.totalAmount.toLocaleString()}
                              </td>
                              <td className="py-3 px-3 sm:px-4 text-right">
                                <button
                                  type="button"
                                  onClick={() => toggleGroupExpand(groupKey)}
                                  className="px-3 py-2 text-gray-700 hover:bg-gray-100 rounded-lg text-xs font-medium min-h-[40px]"
                                  title={isExpanded ? 'Hide expenses' : 'Show expenses'}
                                >
                                  {isExpanded ? 'Hide' : 'View'}
                                </button>
                              </td>
                            </tr>
                            {isExpanded && row.items.map(expense => (
                              <tr key={expense.id || expense._id} className="border-b border-gray-50 bg-white">
                                <td className="py-2 px-3 sm:px-4 pl-8 sm:pl-10 text-sm text-gray-400">↳</td>
                                <td className="py-2 px-3 sm:px-4 text-sm text-gray-700 break-words">{expense.description}</td>
                                <td className="py-2 px-3 sm:px-4 hidden sm:table-cell">
                                  <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full text-xs">{expense.category}</span>
                                </td>
                                <td className="py-2 px-3 sm:px-4 hidden md:table-cell" />
                                <td className="py-2 px-3 sm:px-4 hidden lg:table-cell" />
                                <td className="py-2 px-3 sm:px-4 text-sm font-medium text-red-600 text-right whitespace-nowrap">
                                  Rs. {parseFloat(expense.amount || 0).toLocaleString()}
                                </td>
                                <td className="py-2 px-3 sm:px-4 text-right">
                                  <div className="flex items-center justify-end gap-1">
                                    <button
                                      onClick={() => handleEdit(expense)}
                                      className="p-2 text-green-600 hover:bg-green-50 rounded-lg min-h-[40px] min-w-[40px] inline-flex items-center justify-center"
                                      title="Edit Expense"
                                    >
                                      <Edit2 className="w-4 h-4" />
                                    </button>
                                    <button
                                      onClick={() => handleDelete(expense.id || expense._id)}
                                      disabled={deleting === (expense.id || expense._id)}
                                      className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 min-h-[40px] min-w-[40px] inline-flex items-center justify-center"
                                      title="Delete Expense"
                                    >
                                      <Trash2 className="w-4 h-4" />
                                    </button>
                                  </div>
                                </td>
                              </tr>
                            ))}
                          </React.Fragment>
                        );
                      }

                      const expense = row.expense;
                      return (
                        <tr key={expense.id || expense._id} className="border-b border-gray-100 hover:bg-gray-50">
                          <td className="py-3 px-3 sm:px-4 text-sm whitespace-nowrap">{formatDate(expense.expenseDate)}</td>
                          <td className="py-3 px-3 sm:px-4 text-sm break-words">{expense.description}</td>
                          <td className="py-3 px-3 sm:px-4 hidden sm:table-cell">
                            <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium">
                              {expense.category}
                            </span>
                          </td>
                          <td className="py-3 px-3 sm:px-4 hidden md:table-cell">
                            <span className="px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                              General
                            </span>
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-sm text-gray-600 hidden lg:table-cell">—</td>
                          <td className="py-3 px-3 sm:px-4 font-semibold text-red-600 text-right text-sm whitespace-nowrap">
                            Rs. {parseFloat(expense.amount || 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-3 sm:px-4 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => handleEdit(expense)}
                                className="p-2 text-green-600 hover:bg-green-50 rounded-lg min-h-[40px] min-w-[40px] inline-flex items-center justify-center"
                                title="Edit Expense"
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button
                                onClick={() => handleDelete(expense.id || expense._id)}
                                disabled={deleting === (expense.id || expense._id)}
                                className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50 min-h-[40px] min-w-[40px] inline-flex items-center justify-center"
                                title="Delete Expense"
                              >
                                <Trash2 className="w-4 h-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                >
                  <ChevronLeft className="w-4 h-4" />
                  Previous
                </button>
                <span className="text-gray-600">
                  Page {currentPage} of {totalPages}
                </span>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="btn-secondary flex items-center gap-2 disabled:opacity-50"
                >
                  Next
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Expense Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl w-full max-h-[90vh] overflow-y-auto max-w-2xl">
            <div className="p-6 border-b border-gray-200">
              <div className="flex justify-between items-center">
                <div>
                  <h3 className="text-xl font-bold text-gray-800">
                    {editingGroupId
                      ? 'Manage Product Expenses'
                      : editingExpense
                        ? 'Edit Expense'
                        : 'Add New Expense'}
                  </h3>
                  {editingGroupId && (
                    <p className="text-sm text-gray-500 mt-1">
                      All expenses for {inventoryList.find(p => (p.id || p._id) === editingGroupId)?.productName || 'this product'} — edit, add or remove lines
                    </p>
                  )}
                  {editingExpense && !editingGroupId && (
                    <p className="text-sm text-gray-500 mt-1">Edit this expense and add more lines below if needed</p>
                  )}
                </div>
                <button
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  ✕
                </button>
              </div>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Expense type *</label>
                <select
                  value={formData.expenseScope}
                  onChange={(e) => setFormData({
                    ...formData,
                    expenseScope: e.target.value,
                    inventoryId: e.target.value === 'general' ? '' : formData.inventoryId
                  })}
                  className="input-field"
                  disabled={!!editingGroupId}
                >
                  <option value="general">General (shop / home / partner — not linked to product)</option>
                  <option value="product">Product (adds to product cost per piece)</option>
                </select>
              </div>

              {formData.expenseScope === 'product' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Link to product *</label>
                  <select
                    required
                    value={formData.inventoryId}
                    onChange={(e) => setFormData({ ...formData, inventoryId: e.target.value })}
                    className="input-field"
                    disabled={!!editingGroupId}
                  >
                    <option value="">Select product</option>
                    {inventoryList.map(item => (
                      <option key={item.id || item._id} value={item.id || item._id}>
                        {item.productName} (Qty: {item.initialQuantity || item.sizes?.reduce((s, x) => s + (x.quantity || 0), 0) || 0})
                      </option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Cost per piece will update: (purchase + expenses) ÷ original quantity</p>
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                <input
                  type="date"
                  required
                  value={formData.expenseDate}
                  onChange={(e) => setFormData({ ...formData, expenseDate: e.target.value })}
                  className="input-field"
                />
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <label className="block text-sm font-medium text-gray-700">Expense lines *</label>
                  <button
                    type="button"
                    onClick={addExpenseLine}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1"
                  >
                    <Plus className="w-4 h-4" />
                    Add line
                  </button>
                </div>
                <p className="text-xs text-gray-500">
                  {editingGroupId
                    ? 'All lines for this product. Remove a line to delete that expense on save.'
                    : editingExpense
                      ? 'First line is the expense you are editing. Add more lines for Labour, Transport, etc.'
                      : 'Add Labour, Transport, etc. — all saved together in one click'}
                </p>

                <div className="space-y-2">
                  {expenseLines.map((line) => (
                    <div
                      key={line.key}
                      className={`grid grid-cols-12 gap-2 items-start p-3 rounded-lg border ${
                        line.isOriginal ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'
                      }`}
                    >
                      {line.isOriginal && !editingGroupId && (
                        <div className="col-span-12">
                          <span className="text-xs font-medium text-blue-700 bg-blue-100 px-2 py-0.5 rounded">Editing this expense</span>
                        </div>
                      )}
                      <div className="col-span-12 sm:col-span-3">
                        <label className="text-xs text-gray-500 mb-1 block">Category</label>
                        <select
                          value={line.category}
                          onChange={(e) => updateExpenseLine(line.key, 'category', e.target.value)}
                          className="input-field text-sm"
                        >
                          {expenseCategories.map(cat => (
                            <option key={cat} value={cat}>{cat}</option>
                          ))}
                        </select>
                      </div>
                      <div className="col-span-6 sm:col-span-3">
                        <label className="text-xs text-gray-500 mb-1 block">Amount (Rs.)</label>
                        <input
                          type="text"
                          value={line.amount}
                          onChange={(e) => {
                            const value = e.target.value;
                            if (value === '' || /^\d*\.?\d*$/.test(value)) {
                              updateExpenseLine(line.key, 'amount', value);
                            }
                          }}
                          className="input-field text-sm"
                          placeholder="0"
                        />
                      </div>
                      <div className="col-span-6 sm:col-span-5">
                        <label className="text-xs text-gray-500 mb-1 block">Description (optional)</label>
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => updateExpenseLine(line.key, 'description', e.target.value)}
                          className="input-field text-sm"
                          placeholder={line.category}
                        />
                      </div>
                      <div className="col-span-12 sm:col-span-1 flex sm:justify-end sm:pt-6">
                        <button
                          type="button"
                          onClick={() => removeExpenseLine(line.key)}
                          disabled={expenseLines.length <= 1 || (!editingGroupId && line.isOriginal)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded disabled:opacity-30"
                          title={!editingGroupId && line.isOriginal ? 'Cannot remove the expense being edited' : 'Remove line'}
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>

                {expenseLines.some(l => parseFloat(l.amount) > 0) && (
                  <p className="text-sm font-medium text-gray-700 text-right">
                    Total: Rs. {expenseLines.reduce((s, l) => s + (parseFloat(l.amount) || 0), 0).toLocaleString()}
                  </p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea
                  value={formData.notes}
                  onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                  className="input-field"
                  rows="2"
                  placeholder="Additional notes (optional, applies to all lines)"
                />
              </div>

              <div className="flex justify-end gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowModal(false);
                    resetForm();
                  }}
                  className="btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary"
                >
                  {saving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>{editingGroupId ? 'Saving...' : editingExpense ? 'Saving...' : 'Adding...'}</span>
                    </>
                  ) : (
                    <span>
                      {editingGroupId
                        ? 'Save Product Expenses'
                        : editingExpense
                          ? (() => {
                              const newCount = expenseLines.filter(l => !l.expenseId && parseFloat(l.amount) > 0).length;
                              if (newCount > 0) return `Update & Add ${newCount} More`;
                              return 'Update Expense';
                            })()
                          : (() => {
                              const n = expenseLines.filter(l => parseFloat(l.amount) > 0).length;
                              if (n > 1) return `Save ${n} Expenses`;
                              return 'Add Expense';
                            })()}
                    </span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Expenses;
