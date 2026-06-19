(function () {
  const categories = ["All", "Fuel", "Food", "Drinks", "Truck", "Service"];
  const editableCategories = categories.filter((category) => category !== "All");
  const paymentMethods = ["Cash", "Card", "Account"];

  const defaultProducts = [
    { id: "diesel", name: "Diesel 50PPM", category: "Fuel", price: 28.68, unit: "L", stock: 9999, sku: "FUEL-D50", taxable: false },
    { id: "coffee", name: "Large Coffee", category: "Drinks", price: 2.49, unit: "cup", stock: 80, sku: "DRK-COF", taxable: true }
  ];

  const defaultCustomers = [
    { id: "walkin", name: "Walk-in Prepaid", type: "prepaid", phone: "", email: "", vehicle: "", openingBalance: 0 },
    { id: "account-demo", name: "Account Customer", type: "account", phone: "", email: "", vehicle: "", openingBalance: 0 }
  ];

  const storageKeys = [
    "truck-pos-products",
    "truck-pos-transactions",
    "truck-pos-payments",
    "truck-pos-deleted-payments",
    "truck-pos-collections",
    "truck-pos-customers",
    "truck-pos-settings",
    "truck-pos-meta"
  ];
  const serverData = window.__POS_DATA__ || {};
  const localBackup = readJson("truck-pos-backup", {});
  const localSnapshot = buildLocalSnapshot();
  const initialData = mergeSnapshots(serverData, mergeSnapshots(localBackup, localSnapshot));
  const state = {
    products: migrateProducts(load("truck-pos-products", defaultProducts)),
    transactions: load("truck-pos-transactions", []),
    payments: load("truck-pos-payments", []),
    deletedPaymentIds: load("truck-pos-deleted-payments", []),
    collections: load("truck-pos-collections", []),
    customers: migrateCustomers(load("truck-pos-customers", defaultCustomers)),
    settings: {
      storeName: "Truck Stop POS",
      currency: "R",
      footer: "Drive safe. Thank you.",
      taxRate: 15,
      adminPin: "1234",
      staffPin: "0000",
      recoveryPin: "9999",
      ...load("truck-pos-settings", {})
    },
    meta: load("truck-pos-meta", { lastSavedAt: null }),
    cart: [],
    category: "All",
    search: "",
    paymentMethod: "Cash",
    currentUser: null,
    sessionToken: sessionStorage.getItem("truck-pos-session-token") || "",
    syncTimer: null,
    syncing: false,
    selectedCustomerId: ""
  };

  const els = {
    loginScreen: document.querySelector("#loginScreen"),
    loginForm: document.querySelector("#loginForm"),
    pinInput: document.querySelector("#pinInput"),
    loginMessage: document.querySelector("#loginMessage"),
    recoveryBtn: document.querySelector("#recoveryBtn"),
    appShell: document.querySelector("#appShell"),
    screenTitle: document.querySelector("#screenTitle"),
    roleBadge: document.querySelector("#roleBadge"),
    logoutBtn: document.querySelector("#logoutBtn"),
    categoryTabs: document.querySelector("#categoryTabs"),
    productGrid: document.querySelector("#productGrid"),
    searchInput: document.querySelector("#searchInput"),
    clearSearchBtn: document.querySelector("#clearSearchBtn"),
    saleCustomerSelect: document.querySelector("#saleCustomerSelect"),
    saleRuleMessage: document.querySelector("#saleRuleMessage"),
    cartLines: document.querySelector("#cartLines"),
    cartCount: document.querySelector("#cartCount"),
    subtotal: document.querySelector("#subtotal"),
    taxAmount: document.querySelector("#taxAmount"),
    total: document.querySelector("#total"),
    paymentTabs: document.querySelector("#paymentTabs"),
    payBtn: document.querySelector("#payBtn"),
    voidBtn: document.querySelector("#voidBtn"),
    receiptDialog: document.querySelector("#receiptDialog"),
    receiptText: document.querySelector("#receiptText"),
    closeReceiptBtn: document.querySelector("#closeReceiptBtn"),
    printReceiptBtn: document.querySelector("#printReceiptBtn"),
    newSaleBtn: document.querySelector("#newSaleBtn"),
    historyDialog: document.querySelector("#historyDialog"),
    historyList: document.querySelector("#historyList"),
    historyBtn: document.querySelector("#historyBtn"),
    closeHistoryBtn: document.querySelector("#closeHistoryBtn"),
    historyFromInput: document.querySelector("#historyFromInput"),
    historyToInput: document.querySelector("#historyToInput"),
    historyStatusInput: document.querySelector("#historyStatusInput"),
    downloadSelectedHistoryBtn: document.querySelector("#downloadSelectedHistoryBtn"),
    downloadAllHistoryBtn: document.querySelector("#downloadAllHistoryBtn"),
    tillDialog: document.querySelector("#tillDialog"),
    tillBtn: document.querySelector("#tillBtn"),
    closeTillBtn: document.querySelector("#closeTillBtn"),
    cashTillBalance: document.querySelector("#cashTillBalance"),
    cardTillBalance: document.querySelector("#cardTillBalance"),
    tillCollectionForm: document.querySelector("#tillCollectionForm"),
    tillCollectionMethod: document.querySelector("#tillCollectionMethod"),
    tillCollectionAmount: document.querySelector("#tillCollectionAmount"),
    tillCollectionNote: document.querySelector("#tillCollectionNote"),
    tillReportMonth: document.querySelector("#tillReportMonth"),
    downloadTillReportBtn: document.querySelector("#downloadTillReportBtn"),
    tillCollectionsList: document.querySelector("#tillCollectionsList"),
    customersDialog: document.querySelector("#customersDialog"),
    customersBtn: document.querySelector("#customersBtn"),
    closeCustomersBtn: document.querySelector("#closeCustomersBtn"),
    addCustomerForm: document.querySelector("#addCustomerForm"),
    customerNameInput: document.querySelector("#customerNameInput"),
    customerTypeInput: document.querySelector("#customerTypeInput"),
    customerPhoneInput: document.querySelector("#customerPhoneInput"),
    customerEmailInput: document.querySelector("#customerEmailInput"),
    customerVehicleInput: document.querySelector("#customerVehicleInput"),
    customerOpeningBalanceInput: document.querySelector("#customerOpeningBalanceInput"),
    customersList: document.querySelector("#customersList"),
    paymentsDialog: document.querySelector("#paymentsDialog"),
    paymentsBtn: document.querySelector("#paymentsBtn"),
    closePaymentsBtn: document.querySelector("#closePaymentsBtn"),
    paymentForm: document.querySelector("#paymentForm"),
    paymentCustomerSelect: document.querySelector("#paymentCustomerSelect"),
    paymentAmountInput: document.querySelector("#paymentAmountInput"),
    paymentMethodInput: document.querySelector("#paymentMethodInput"),
    paymentReferenceInput: document.querySelector("#paymentReferenceInput"),
    paymentNotesInput: document.querySelector("#paymentNotesInput"),
    paymentsList: document.querySelector("#paymentsList"),
    statementsDialog: document.querySelector("#statementsDialog"),
    statementsBtn: document.querySelector("#statementsBtn"),
    closeStatementsBtn: document.querySelector("#closeStatementsBtn"),
    statementCustomerSelect: document.querySelector("#statementCustomerSelect"),
    statementFromInput: document.querySelector("#statementFromInput"),
    statementToInput: document.querySelector("#statementToInput"),
    statementPreview: document.querySelector("#statementPreview"),
    downloadCsvBtn: document.querySelector("#downloadCsvBtn"),
    downloadPdfBtn: document.querySelector("#downloadPdfBtn"),
    inventoryDialog: document.querySelector("#inventoryDialog"),
    inventoryList: document.querySelector("#inventoryList"),
    inventoryBtn: document.querySelector("#inventoryBtn"),
    closeInventoryBtn: document.querySelector("#closeInventoryBtn"),
    addItemForm: document.querySelector("#addItemForm"),
    newItemName: document.querySelector("#newItemName"),
    newItemCategory: document.querySelector("#newItemCategory"),
    newItemPrice: document.querySelector("#newItemPrice"),
    newItemUnit: document.querySelector("#newItemUnit"),
    newItemStock: document.querySelector("#newItemStock"),
    newItemSku: document.querySelector("#newItemSku"),
    newItemTaxable: document.querySelector("#newItemTaxable"),
    settingsDialog: document.querySelector("#settingsDialog"),
    settingsBtn: document.querySelector("#settingsBtn"),
    closeSettingsBtn: document.querySelector("#closeSettingsBtn"),
    settingsForm: document.querySelector("#settingsForm"),
    storeNameInput: document.querySelector("#storeNameInput"),
    currencyInput: document.querySelector("#currencyInput"),
    taxRateInput: document.querySelector("#taxRateInput"),
    adminPinInput: document.querySelector("#adminPinInput"),
    staffPinInput: document.querySelector("#staffPinInput"),
    recoveryPinInput: document.querySelector("#recoveryPinInput"),
    footerInput: document.querySelector("#footerInput"),
    downloadBackupBtn: document.querySelector("#downloadBackupBtn"),
    shiftClock: document.querySelector("#shiftClock"),
    shiftSales: document.querySelector("#shiftSales"),
    transactionCount: document.querySelector("#transactionCount"),
    averageTicket: document.querySelector("#averageTicket"),
    lowStockCount: document.querySelector("#lowStockCount")
  };

  function readJson(key, fallback) {
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function snapshotTimestamp(snapshot) {
    return Date.parse(snapshot?.["truck-pos-meta"]?.lastSavedAt || "") || 0;
  }

  function buildLocalSnapshot() {
    const snapshot = {};
    storageKeys.forEach((key) => {
      const value = readJson(key, undefined);
      if (typeof value !== "undefined") snapshot[key] = value;
    });
    return snapshot;
  }

  function cloneValue(value, fallback) {
    return Array.isArray(value) ? value.map((item) => ({ ...item })) : (value ? { ...value } : fallback);
  }

  function uniqueById(list) {
    const seen = new Set();
    return list.filter((item) => {
      const key = item?.id || JSON.stringify(item);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  function itemTime(item) {
    return Date.parse(item?.updatedAt || item?.voidedAt || item?.deletedAt || item?.date || "") || 0;
  }

  function mergeList(newerList, olderList) {
    const merged = new Map();
    [...(Array.isArray(olderList) ? olderList : []), ...(Array.isArray(newerList) ? newerList : [])].forEach((item) => {
      if (!item) return;
      const key = item.id || JSON.stringify(item);
      const current = merged.get(key);
      if (!current || itemTime(item) >= itemTime(current)) merged.set(key, item);
    });
    return Array.from(merged.values()).sort((a, b) => itemTime(b) - itemTime(a));
  }

  function pickValue(primaryValue, secondaryValue, fallback) {
    if (Array.isArray(primaryValue) && primaryValue.length) return cloneValue(primaryValue, fallback);
    if (primaryValue && !Array.isArray(primaryValue)) return cloneValue(primaryValue, fallback);
    if (Array.isArray(secondaryValue) && secondaryValue.length) return cloneValue(secondaryValue, fallback);
    if (secondaryValue && !Array.isArray(secondaryValue)) return cloneValue(secondaryValue, fallback);
    return fallback;
  }

  function mergeSnapshots(firstSnapshot, secondSnapshot) {
    const first = firstSnapshot || {};
    const second = secondSnapshot || {};
    const firstTime = snapshotTimestamp(first);
    const secondTime = snapshotTimestamp(second);
    const newer = firstTime >= secondTime ? first : second;
    const older = newer === first ? second : first;
    const latestTime = Math.max(firstTime, secondTime);
    const deletedPayments = uniqueById([...(newer["truck-pos-deleted-payments"] || []), ...(older["truck-pos-deleted-payments"] || [])]);
    return {
      "truck-pos-products": pickValue(newer["truck-pos-products"], older["truck-pos-products"], defaultProducts),
      "truck-pos-transactions": mergeList(newer["truck-pos-transactions"], older["truck-pos-transactions"]),
      "truck-pos-payments": mergeList(newer["truck-pos-payments"], older["truck-pos-payments"]).filter((payment) => !deletedPayments.includes(payment.id)),
      "truck-pos-deleted-payments": deletedPayments,
      "truck-pos-collections": mergeList(newer["truck-pos-collections"], older["truck-pos-collections"]),
      "truck-pos-customers": mergeList(newer["truck-pos-customers"], older["truck-pos-customers"]),
      "truck-pos-settings": pickValue(newer["truck-pos-settings"], older["truck-pos-settings"], {}),
      "truck-pos-meta": {
        ...(older["truck-pos-meta"] || {}),
        ...(newer["truck-pos-meta"] || {}),
        lastSavedAt: latestTime ? new Date(latestTime).toISOString() : (newer["truck-pos-meta"]?.lastSavedAt || older["truck-pos-meta"]?.lastSavedAt || null)
      }
    };
  }

  function load(key, fallback) {
    if (Object.prototype.hasOwnProperty.call(initialData, key)) return initialData[key];
    try {
      const saved = localStorage.getItem(key);
      return saved ? JSON.parse(saved) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function save(key, value) {
    localStorage.setItem(key, JSON.stringify(value));
  }

  function currentData() {
    state.meta.lastSavedAt = new Date().toISOString();
    return {
      "truck-pos-products": state.products,
      "truck-pos-transactions": state.transactions,
      "truck-pos-payments": state.payments,
      "truck-pos-deleted-payments": state.deletedPaymentIds,
      "truck-pos-collections": state.collections,
      "truck-pos-customers": state.customers,
      "truck-pos-settings": state.settings,
      "truck-pos-meta": state.meta
    };
  }

  function saveDataLocally(data) {
    Object.entries(data).forEach(([key, value]) => save(key, value));
    save("truck-pos-backup", data);
  }

  function canSaveToServer() {
    return window.location.protocol === "http:" || window.location.protocol === "https:";
  }

  async function saveAll() {
    const data = currentData();
    saveDataLocally(data);
    if (canSaveToServer()) {
      const response = await fetch("/api/data", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(state.sessionToken ? { Authorization: `Bearer ${state.sessionToken}` } : {})
        },
        body: JSON.stringify(data),
        keepalive: true
      });
      const result = await response.json().catch(() => null);
      if (!response.ok) throw new Error(result?.error || "Could not save data to the server.");
      if (result?.data) applySnapshot(result.data, true);
    }
    return true;
  }

  async function persistChange(message) {
    try {
      await saveAll();
      return true;
    } catch (error) {
      window.alert(error.message || message || "This change could not be saved yet. Please try again.");
      return false;
    }
  }

  function applySnapshot(snapshot, preferServer = false) {
    const merged = preferServer ? mergeSnapshots(currentData(), snapshot) : mergeSnapshots(snapshot, currentData());
    state.products = migrateProducts(merged["truck-pos-products"] || defaultProducts);
    state.transactions = merged["truck-pos-transactions"] || [];
    state.payments = merged["truck-pos-payments"] || [];
    state.deletedPaymentIds = merged["truck-pos-deleted-payments"] || [];
    state.collections = merged["truck-pos-collections"] || [];
    state.customers = migrateCustomers(merged["truck-pos-customers"] || defaultCustomers);
    state.settings = {
      storeName: "Truck Stop POS",
      currency: "R",
      footer: "Drive safe. Thank you.",
      taxRate: 15,
      adminPin: "1234",
      staffPin: "0000",
      recoveryPin: "9999",
      ...(merged["truck-pos-settings"] || {})
    };
    state.meta = merged["truck-pos-meta"] || { lastSavedAt: null };
    saveDataLocally(currentData());
  }

  function renderOpenAdminPanels() {
    if (els.historyDialog.open) renderHistory();
    if (els.tillDialog.open) renderTill();
    if (els.paymentsDialog.open) renderPayments();
    if (els.statementsDialog.open) renderStatementSelectors();
    if (els.customersDialog.open) renderCustomers();
    if (els.inventoryDialog.open) renderInventory();
  }

  function renderLiveSync() {
    renderTabs();
    renderCustomersForSale();
    renderProducts();
    renderMetrics();
    tickClock();
    if (!state.cart.length) renderCart();
    else renderCartTotals();
    renderOpenAdminPanels();
  }

  async function refreshFromServer(renderAfter = false) {
    if (!canSaveToServer() || !state.sessionToken || state.syncing) return false;
    state.syncing = true;
    try {
      const response = await fetch(`/api/data?sync=${Date.now()}`, {
        cache: "no-store",
        headers: state.sessionToken ? { Authorization: `Bearer ${state.sessionToken}` } : {}
      });
      if (!response.ok) throw new Error("Could not load latest server data.");
      applySnapshot(await response.json(), true);
      if (renderAfter) {
        renderLiveSync();
      }
      return true;
    } catch (error) {
      return false;
    } finally {
      state.syncing = false;
    }
  }

  function migrateProducts(products) {
    return products.map((product) => ({
      ...product,
      unit: product.category === "Fuel" ? "L" : product.unit,
      taxable: typeof product.taxable === "boolean" ? product.taxable : product.category !== "Fuel"
    }));
  }

  function migrateCustomers(customers) {
    const list = customers.length ? customers : defaultCustomers;
    if (!list.some((customer) => customer.id === "walkin")) list.unshift(defaultCustomers[0]);
    if (!list.some((customer) => customer.type === "account")) list.push(defaultCustomers[1]);
    return list;
  }

  function money(value) {
    return `${state.settings.currency}${Number(value || 0).toFixed(2)}`;
  }

  function uid(prefix) {
    return `${prefix}${Date.now().toString(36).toUpperCase()}`;
  }

  function itemId() {
    return `item-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
  }

  function escapeHtml(value) {
    return String(value ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function categoryOptions(selected) {
    return editableCategories.map((category) => `<option value="${category}" ${category === selected ? "selected" : ""}>${category}</option>`).join("");
  }

  function selectedCustomer() {
    return state.customers.find((customer) => customer.id === state.selectedCustomerId);
  }

  function accountCustomers() {
    return state.customers.filter((customer) => customer.type === "account");
  }

  function totals() {
    const subtotal = state.cart.reduce((sum, line) => sum + line.price * Number(line.qty || 0), 0);
    const taxable = state.cart.reduce((sum, line) => sum + (line.taxable ? line.price * Number(line.qty || 0) : 0), 0);
    const tax = taxable * (Number(state.settings.taxRate || 0) / 100);
    return { subtotal, tax, total: subtotal + tax };
  }

  function allowedPaymentMethods(customer) {
    if (!customer) return [];
    return customer.type === "account" ? ["Account"] : ["Cash", "Card"];
  }

  function applyRole() {
    const isAdmin = state.currentUser === "admin";
    els.roleBadge.textContent = isAdmin ? "Admin" : "Staff";
    els.screenTitle.textContent = isAdmin ? "Admin Register" : "Staff Register";
    document.body.classList.toggle("is-admin", isAdmin);
  }

  async function serverLogin(pin, recovery = false) {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ pin, recovery })
    });
    const result = await response.json().catch(() => null);
    if (!response.ok || !result?.ok) throw new Error(result?.error || "Incorrect PIN.");
    return result;
  }

  function login(role, token, data) {
    state.currentUser = role;
    state.sessionToken = token || "";
    if (state.sessionToken) sessionStorage.setItem("truck-pos-session-token", state.sessionToken);
    if (data) applySnapshot(data, true);
    els.loginScreen.classList.add("hidden");
    els.appShell.classList.remove("hidden");
    applyRole();
    renderAll();
    startLiveSync();
  }

  function logout() {
    stopLiveSync();
    state.currentUser = null;
    state.sessionToken = "";
    sessionStorage.removeItem("truck-pos-session-token");
    state.cart = [];
    state.selectedCustomerId = "";
    els.pinInput.value = "";
    els.appShell.classList.add("hidden");
    els.loginScreen.classList.remove("hidden");
    renderCart();
  }

  function startLiveSync() {
    stopLiveSync();
    if (!state.sessionToken) return;
    state.syncTimer = window.setInterval(() => {
      void refreshFromServer(true);
    }, 7000);
    void refreshFromServer(true);
  }

  function stopLiveSync() {
    if (state.syncTimer) window.clearInterval(state.syncTimer);
    state.syncTimer = null;
  }

  function renderTabs() {
    els.categoryTabs.innerHTML = categories.map((category) => `<button class="tab-button ${category === state.category ? "active" : ""}" data-category="${category}" type="button">${category}</button>`).join("");
    renderPaymentTabs();
  }

  function renderPaymentTabs() {
    const customer = selectedCustomer();
    const allowed = allowedPaymentMethods(customer);
    if (!allowed.includes(state.paymentMethod)) state.paymentMethod = allowed[0] || "Cash";
    els.paymentTabs.innerHTML = paymentMethods.map((method) => {
      const disabled = !allowed.includes(method);
      return `<button class="pay-method ${method === state.paymentMethod ? "active" : ""}" data-method="${method}" type="button" ${disabled ? "disabled" : ""}>${method}</button>`;
    }).join("");
    renderSaleRule();
  }

  function renderSaleRule() {
    const customer = selectedCustomer();
    if (!customer) {
      els.saleRuleMessage.textContent = "Select a customer before completing the sale.";
      return;
    }
    els.saleRuleMessage.textContent = customer.type === "account" ? "Account customer: only Account payment is allowed." : "Prepaid customer: Cash or Card only.";
  }

  function renderCustomersForSale() {
    const options = ['<option value="">Select customer...</option>'].concat(
      state.customers.map((customer) => `<option value="${customer.id}" ${customer.id === state.selectedCustomerId ? "selected" : ""}>${escapeHtml(customer.name)} (${customer.type === "account" ? "Account" : "Prepaid"})</option>`)
    );
    els.saleCustomerSelect.innerHTML = options.join("");
  }

  function renderProducts() {
    const query = state.search.trim().toLowerCase();
    const products = state.products.filter((product) => {
      const inCategory = state.category === "All" || product.category === state.category;
      const matches = [product.name, product.category, product.sku].join(" ").toLowerCase().includes(query);
      return inCategory && matches;
    });
    els.productGrid.innerHTML = products.length ? products.map((product) => `
      <button class="product-button" data-product="${product.id}" type="button">
        <span class="category-chip">${product.category}</span>
        <strong>${escapeHtml(product.name)}</strong>
        <span class="product-meta"><span>${escapeHtml(product.sku)}</span><span>${money(product.price)} / ${escapeHtml(product.unit)}</span></span>
      </button>`).join("") : '<div class="empty-state">No matching items.</div>';
  }

  function addToCart(productId) {
    const product = state.products.find((item) => item.id === productId);
    if (!product) return;
    const existing = state.cart.find((line) => line.id === productId);
    if (existing) {
      existing.qty = Number(existing.qty || 0) + 1;
    } else {
      state.cart.push({ id: product.id, name: product.name, category: product.category, price: product.price, unit: product.unit, taxable: product.taxable, qty: "" });
    }
    renderCart();
    const input = els.cartLines.querySelector(`[data-qty="${productId}"]`);
    if (input) {
      input.focus();
      input.select();
    }
  }

  function setQty(productId, qty) {
    const line = state.cart.find((item) => item.id === productId);
    if (!line) return;
    line.qty = qty === "" ? "" : Math.max(0, Number(qty));
  }

  function updateQty(productId, delta) {
    const line = state.cart.find((item) => item.id === productId);
    if (!line) return;
    line.qty = Math.max(0, Number(line.qty || 0) + delta);
    if (line.qty <= 0) state.cart = state.cart.filter((item) => item.id !== productId);
    renderCart();
  }

  function validCart() {
    return state.cart.length && state.cart.every((line) => Number(line.qty) > 0);
  }

  function renderCartCount() {
    const fuelLiters = state.cart.filter((line) => line.category === "Fuel").reduce((sum, line) => sum + Number(line.qty || 0), 0);
    const itemCount = state.cart.reduce((sum, line) => sum + Number(line.qty || 0), 0);
    const lineCount = state.cart.length;
    els.cartCount.textContent = fuelLiters ? `${lineCount} ${lineCount === 1 ? "line" : "lines"} / ${fuelLiters.toLocaleString()} L` : `${itemCount} ${itemCount === 1 ? "item" : "items"}`;
  }

  function renderCartTotals() {
    const currentTotals = totals();
    const customer = selectedCustomer();
    const allowed = allowedPaymentMethods(customer);
    els.subtotal.textContent = money(currentTotals.subtotal);
    els.taxAmount.textContent = money(currentTotals.tax);
    els.total.textContent = money(currentTotals.total);
    els.payBtn.disabled = !validCart() || !customer || !allowed.includes(state.paymentMethod);
    renderMetrics();
  }

  function renderCart() {
    renderCartCount();
    els.cartLines.innerHTML = state.cart.length ? state.cart.map((line) => `
      <div class="cart-line">
        <div>
          <div class="cart-name">${escapeHtml(line.name)}</div>
          <div class="cart-detail">${line.qty || 0} ${escapeHtml(line.unit)} x ${money(line.price)} ${line.taxable ? "incl. VAT calc" : "no VAT"}</div>
          <label class="fuel-liters-control">
            <span>${line.category === "Fuel" ? "Liters" : "Qty"}</span>
            <input data-qty="${line.id}" type="number" min="0" step="${line.category === "Fuel" ? "0.1" : "1"}" value="${line.qty}" placeholder="Type amount" />
          </label>
        </div>
        <div>
          <strong data-line-total="${line.id}">${money(Number(line.qty || 0) * line.price)}</strong>
          ${line.category === "Fuel" ? "" : `<div class="qty-controls"><button data-minus="${line.id}" type="button">-</button><button data-plus="${line.id}" type="button">+</button></div>`}
        </div>
      </div>`).join("") : '<div class="empty-state">Tap an item to start a sale.</div>';
    renderCartTotals();
  }

  function updateManualQty(input) {
    const productId = input.dataset.qty;
    setQty(productId, input.value);
    const line = state.cart.find((item) => item.id === productId);
    if (!line) return renderCart();
    input.value = line.qty;
    const totalEl = els.cartLines.querySelector(`[data-line-total="${productId}"]`);
    if (totalEl) totalEl.textContent = money(Number(line.qty || 0) * line.price);
    renderCartCount();
    renderCartTotals();
  }

  function receipt(transaction) {
    const lines = transaction.lines.map((line) => `${`${line.name} ${line.qty} ${line.unit}`.padEnd(28, " ")}${money(line.price * line.qty).padStart(10, " ")}`).join("\n");
    return [
      state.settings.storeName,
      "Truck Stop POS",
      `Receipt ${transaction.id}`,
      new Date(transaction.date).toLocaleString(),
      `Customer: ${transaction.customerName}`,
      "-".repeat(40),
      lines,
      "-".repeat(40),
      `${"Subtotal".padEnd(28, " ")}${money(transaction.totals.subtotal).padStart(10, " ")}`,
      `${"VAT".padEnd(28, " ")}${money(transaction.totals.tax).padStart(10, " ")}`,
      `${"Total".padEnd(28, " ")}${money(transaction.totals.total).padStart(10, " ")}`,
      `Payment: ${transaction.paymentMethod}`,
      "",
      state.settings.footer
    ].join("\n");
  }

  async function completeSale() {
    const customer = selectedCustomer();
    const allowed = allowedPaymentMethods(customer);
    if (!validCart() || !customer || !allowed.includes(state.paymentMethod)) return renderCartTotals();
    const currentTotals = totals();
    const transaction = {
      id: uid("S"),
      type: "sale",
      status: "active",
      date: new Date().toISOString(),
      userRole: state.currentUser,
      customerId: customer.id,
      customerName: customer.name,
      customerType: customer.type,
      paymentMethod: state.paymentMethod,
      lines: state.cart.map((line) => ({ ...line, qty: Number(line.qty) })),
      totals: currentTotals
    };
    state.transactions.unshift(transaction);
    if (!(await persistChange("Sale was not saved. Please wait a moment and try again."))) {
      state.transactions.shift();
      return;
    }
    els.receiptText.textContent = receipt(transaction);
    els.receiptDialog.showModal();
    renderMetrics();
  }

  function resetSale() {
    state.cart = [];
    renderCart();
  }

  function filteredHistory() {
    const fromDate = els.historyFromInput.value;
    const toDate = els.historyToInput.value;
    const status = els.historyStatusInput.value;
    return state.transactions.filter((transaction) => {
      const date = transaction.date.slice(0, 10);
      const inDateRange = (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
      const inStatus = status === "all" || transaction.status === status;
      return inDateRange && inStatus;
    });
  }

  function renderHistory() {
    const transactions = filteredHistory();
    els.historyList.innerHTML = transactions.length ? transactions.map((transaction) => `
      <div class="record ${transaction.status === "void" ? "void-record" : ""}">
        <div class="record-top"><span>${transaction.id}</span><span>${money(transaction.totals.total)}</span></div>
        <div class="muted">${new Date(transaction.date).toLocaleString()} - ${escapeHtml(transaction.customerName)} - ${transaction.paymentMethod} - ${transaction.status}</div>
        <div>${transaction.lines.map((line) => `${line.qty} ${line.unit} ${escapeHtml(line.name)}`).join(", ")}</div>
        ${transaction.status === "void" ? `<div class="muted">Void reason: ${escapeHtml(transaction.voidReason || "")}</div>` : `<div class="record-actions"><button class="danger-button" data-void-sale="${transaction.id}" type="button">Void Sale</button></div>`}
      </div>`).join("") : '<div class="empty-state">No transactions for this selection.</div>';
  }

  function tillBalance(method) {
    const sales = state.transactions
      .filter((transaction) => transaction.status !== "void" && transaction.paymentMethod === method)
      .reduce((sum, transaction) => sum + Number(transaction.totals.total || 0), 0);
    const collected = state.collections
      .filter((collection) => collection.method === method)
      .reduce((sum, collection) => sum + Number(collection.amount || 0), 0);
    return sales - collected;
  }

  function currentTillBalance() {
    return {
      Cash: tillBalance("Cash"),
      Card: tillBalance("Card")
    };
  }

  function setTillDefaultAmount() {
    const balances = currentTillBalance();
    const amount = Math.max(0, balances[els.tillCollectionMethod.value] || 0);
    els.tillCollectionAmount.value = amount ? amount.toFixed(2) : "";
  }

  function renderTill() {
    const balances = currentTillBalance();
    els.cashTillBalance.textContent = money(balances.Cash);
    els.cardTillBalance.textContent = money(balances.Card);
    if (!els.tillReportMonth.value) els.tillReportMonth.value = new Date().toISOString().slice(0, 7);
    setTillDefaultAmount();
    els.tillCollectionsList.innerHTML = state.collections.length ? state.collections.map((collection) => `
      <div class="record">
        <div class="record-top"><span>${escapeHtml(collection.method)} collection</span><span>${money(collection.amount)}</span></div>
        <div class="muted">${new Date(collection.date).toLocaleString()} - ${escapeHtml(collection.userRole || "admin")}</div>
        <div>${escapeHtml(collection.note || "")}</div>
      </div>`).join("") : '<div class="empty-state">No collections recorded yet.</div>';
  }

  async function addTillCollection() {
    await refreshFromServer();
    const method = els.tillCollectionMethod.value;
    const amount = Number(els.tillCollectionAmount.value || 0);
    if (!["Cash", "Card"].includes(method) || amount <= 0) return;
    const available = currentTillBalance()[method] || 0;
    if (amount > available + 0.005) {
      window.alert(`${method} collection blocked. Available ${method.toLowerCase()} balance is ${money(Math.max(0, available))}.`);
      renderTill();
      return;
    }
    const collection = {
      id: uid("T"),
      type: "collection",
      date: new Date().toISOString(),
      method,
      amount,
      note: els.tillCollectionNote.value.trim(),
      userRole: state.currentUser
    };
    state.collections.unshift(collection);
    els.tillCollectionForm.reset();
    if (!(await persistChange("Till collection was not saved. Please try again."))) {
      state.collections = state.collections.filter((item) => item.id !== collection.id);
      return;
    }
    renderTill();
  }

  function monthRange(monthValue) {
    const value = monthValue || new Date().toISOString().slice(0, 7);
    const [year, month] = value.split("-").map(Number);
    const start = new Date(year, month - 1, 1);
    const end = new Date(year, month, 1);
    return { value, start, end, label: start.toLocaleString(undefined, { month: "long", year: "numeric" }) };
  }

  function tillEvents() {
    const sales = state.transactions
      .filter((transaction) => transaction.status !== "void" && ["Cash", "Card"].includes(transaction.paymentMethod))
      .map((transaction) => ({
        date: transaction.date,
        type: "Sale",
        method: transaction.paymentMethod,
        ref: transaction.id,
        description: transaction.customerName,
        amount: Number(transaction.totals.total || 0)
      }));
    const collections = state.collections.map((collection) => ({
      date: collection.date,
      type: "Collection",
      method: collection.method,
      ref: collection.id,
      description: collection.note || "",
      amount: -Number(collection.amount || 0)
    }));
    return sales.concat(collections).sort((a, b) => String(a.date).localeCompare(String(b.date)));
  }

  function tillReportRows(monthValue) {
    const range = monthRange(monthValue);
    const rows = [
      ["Till Monthly Report", range.label],
      ["Store", state.settings.storeName],
      ["Generated", new Date().toLocaleString()],
      [],
      ["Summary", "Cash", "Card", "Total"]
    ];
    let openingCash = 0;
    let openingCard = 0;
    let cashBalance = 0;
    let cardBalance = 0;
    const events = tillEvents();
    events.forEach((event) => {
      const date = new Date(event.date);
      if (date < range.start) {
        if (event.method === "Cash") openingCash += event.amount;
        if (event.method === "Card") openingCard += event.amount;
      }
    });
    cashBalance = openingCash;
    cardBalance = openingCard;
    const monthlyEvents = events.filter((event) => {
      const date = new Date(event.date);
      return date >= range.start && date < range.end;
    });
    const monthCashIn = monthlyEvents.filter((event) => event.method === "Cash" && event.amount > 0).reduce((sum, event) => sum + event.amount, 0);
    const monthCardIn = monthlyEvents.filter((event) => event.method === "Card" && event.amount > 0).reduce((sum, event) => sum + event.amount, 0);
    const monthCashOut = monthlyEvents.filter((event) => event.method === "Cash" && event.amount < 0).reduce((sum, event) => sum + Math.abs(event.amount), 0);
    const monthCardOut = monthlyEvents.filter((event) => event.method === "Card" && event.amount < 0).reduce((sum, event) => sum + Math.abs(event.amount), 0);
    rows.push(
      ["Opening Balance", openingCash, openingCard, openingCash + openingCard],
      ["Sales Captured", monthCashIn, monthCardIn, monthCashIn + monthCardIn],
      ["Collections / Settlements", monthCashOut, monthCardOut, monthCashOut + monthCardOut],
      ["Closing Balance", openingCash + monthCashIn - monthCashOut, openingCard + monthCardIn - monthCardOut, openingCash + openingCard + monthCashIn + monthCardIn - monthCashOut - monthCardOut],
      [],
      ["Date", "Type", "Method", "Reference", "Customer / Notes", "Cash In", "Cash Out", "Cash Balance", "Card In", "Card Out", "Card Balance"]
    );
    monthlyEvents.forEach((event) => {
      const isCash = event.method === "Cash";
      const isIn = event.amount > 0;
      if (isCash) cashBalance += event.amount;
      else cardBalance += event.amount;
      rows.push([
        new Date(event.date).toLocaleString(),
        event.type,
        event.method,
        event.ref,
        event.description,
        isCash && isIn ? event.amount : "",
        isCash && !isIn ? Math.abs(event.amount) : "",
        cashBalance,
        !isCash && isIn ? event.amount : "",
        !isCash && !isIn ? Math.abs(event.amount) : "",
        cardBalance
      ]);
    });
    return { rows, range };
  }

  function downloadTillReport() {
    const report = tillReportRows(els.tillReportMonth.value);
    const workbook = toExcelWorkbook(report.rows, `Till Report ${report.range.label}`);
    downloadBlob(workbook, `till-report-${report.range.value}.xls`, "application/vnd.ms-excel");
  }

  async function voidSale(id) {
    const transaction = state.transactions.find((item) => item.id === id);
    if (!transaction || transaction.status === "void") return;
    const reason = window.prompt("Reason for voiding this sale?");
    if (!reason) return;
    const previous = {
      status: transaction.status,
      voidReason: transaction.voidReason,
      voidedAt: transaction.voidedAt,
      voidedBy: transaction.voidedBy
    };
    transaction.status = "void";
    transaction.voidReason = reason;
    transaction.voidedAt = new Date().toISOString();
    transaction.voidedBy = state.currentUser;
    if (!(await persistChange("Void was not saved. Please try again."))) {
      transaction.status = previous.status;
      transaction.voidReason = previous.voidReason;
      transaction.voidedAt = previous.voidedAt;
      transaction.voidedBy = previous.voidedBy;
      return;
    }
    renderHistory();
    renderMetrics();
  }

  function historyRows(transactions) {
    const rows = [["Sale ID", "Date", "Status", "Customer", "Customer Type", "Payment Method", "User Role", "Item", "Category", "Qty", "Unit", "Unit Price", "Line Total", "VAT Item", "Sale Subtotal", "Sale VAT", "Sale Total", "Void Reason", "Voided At", "Voided By"]];
    transactions.forEach((transaction) => {
      transaction.lines.forEach((line) => {
        rows.push([
          transaction.id,
          new Date(transaction.date).toLocaleString(),
          transaction.status,
          transaction.customerName,
          transaction.customerType,
          transaction.paymentMethod,
          transaction.userRole,
          line.name,
          line.category,
          line.qty,
          line.unit,
          line.price,
          Number(line.qty || 0) * Number(line.price || 0),
          line.taxable ? "Yes" : "No",
          transaction.totals.subtotal,
          transaction.totals.tax,
          transaction.totals.total,
          transaction.voidReason || "",
          transaction.voidedAt ? new Date(transaction.voidedAt).toLocaleString() : "",
          transaction.voidedBy || ""
        ]);
      });
    });
    return rows;
  }

  function ledgerFor(customerId, fromDate, toDate) {
    const customer = state.customers.find((item) => item.id === customerId);
    if (!customer) return { customer: null, rows: [], closing: 0 };
    const rows = [{ date: "", description: "Opening balance", debit: Number(customer.openingBalance || 0), credit: 0, ref: "" }];
    state.transactions.filter((sale) => sale.customerId === customerId && sale.paymentMethod === "Account").forEach((sale) => {
      rows.push({
        date: sale.date,
        description: sale.status === "void" ? `VOID ${sale.id}` : `Sale ${sale.id}`,
        debit: sale.status === "void" ? 0 : sale.totals.total,
        credit: 0,
        ref: sale.id
      });
    });
    state.payments.filter((payment) => payment.customerId === customerId).forEach((payment) => {
      rows.push({ date: payment.date, description: `Payment ${payment.method}`, debit: 0, credit: payment.amount, ref: payment.reference || payment.id });
    });
    rows.sort((a, b) => String(a.date).localeCompare(String(b.date)));
    let balance = 0;
    const filtered = rows.map((row) => {
      balance += row.debit - row.credit;
      return { ...row, balance };
    }).filter((row) => {
      if (!row.date) return true;
      const date = row.date.slice(0, 10);
      return (!fromDate || date >= fromDate) && (!toDate || date <= toDate);
    });
    return { customer, rows: filtered, closing: balance };
  }

  function statementHtml(statement) {
    return `
      <div class="statement-paper">
        <h2>${escapeHtml(state.settings.storeName)}</h2>
        <p><strong>Statement for:</strong> ${escapeHtml(statement.customer.name)}</p>
        <table>
          <thead><tr><th>Date</th><th>Description</th><th>Ref</th><th>Debit</th><th>Credit</th><th>Balance</th></tr></thead>
          <tbody>
            ${statement.rows.map((row) => `
              <tr>
                <td>${row.date ? new Date(row.date).toLocaleDateString() : ""}</td>
                <td>${escapeHtml(row.description)}</td>
                <td>${escapeHtml(row.ref)}</td>
                <td>${row.debit ? money(row.debit) : ""}</td>
                <td>${row.credit ? money(row.credit) : ""}</td>
                <td>${money(row.balance)}</td>
              </tr>`).join("")}
          </tbody>
        </table>
        <h3>Closing Balance: ${money(statement.closing)}</h3>
      </div>`;
  }

  function renderStatement() {
    const statement = ledgerFor(els.statementCustomerSelect.value, els.statementFromInput.value, els.statementToInput.value);
    if (!statement.customer) {
      els.statementPreview.innerHTML = '<div class="empty-state">Select an account customer.</div>';
      return;
    }
    els.statementPreview.innerHTML = statementHtml(statement);
  }

  function renderStatementSelectors() {
    els.statementCustomerSelect.innerHTML = accountCustomers().map((customer) => `<option value="${customer.id}">${escapeHtml(customer.name)}</option>`).join("");
    if (!els.statementFromInput.value) {
      const today = new Date();
      els.statementToInput.value = today.toISOString().slice(0, 10);
      today.setDate(1);
      els.statementFromInput.value = today.toISOString().slice(0, 10);
    }
    renderStatement();
  }

  function toExcelWorkbook(rows, title) {
    const tableRows = rows.map((row, rowIndex) => {
      const tag = rowIndex === 0 ? "th" : "td";
      return `<tr>${row.map((cell) => `<${tag}>${escapeHtml(cell)}</${tag}>`).join("")}</tr>`;
    }).join("");
    return `<!doctype html><html><head><meta charset="utf-8" /><style>table{border-collapse:collapse;font-family:Arial,sans-serif}th,td{border:1px solid #999;padding:6px;white-space:nowrap}th{background:#e8f2f0;font-weight:bold}</style></head><body><h2>${escapeHtml(title)}</h2><table>${tableRows}</table></body></html>`;
  }

  function downloadBlob(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  }

  function downloadHistoryExcel(transactions, label) {
    const workbook = toExcelWorkbook(historyRows(transactions), "Sales History");
    const today = new Date().toISOString().slice(0, 10);
    downloadBlob(workbook, `sales-history-${label}-${today}.xls`, "application/vnd.ms-excel");
  }

  async function downloadFullBackup() {
    await refreshFromServer();
    const data = currentData();
    const stamp = new Date().toISOString().replaceAll(":", "-").slice(0, 19);
    downloadBlob(JSON.stringify(data, null, 2), `truck-stop-pos-backup-${stamp}.json`, "application/json");
  }

  function statementRows(statement) {
    return [["Date", "Description", "Reference", "Debit", "Credit", "Balance"]].concat(statement.rows.map((row) => [
      row.date ? new Date(row.date).toLocaleDateString() : "",
      row.description,
      row.ref,
      row.debit || "",
      row.credit || "",
      row.balance
    ]));
  }

  function downloadStatementExcel() {
    const statement = ledgerFor(els.statementCustomerSelect.value, els.statementFromInput.value, els.statementToInput.value);
    if (!statement.customer) return;
    const workbook = toExcelWorkbook(statementRows(statement), `${statement.customer.name} Statement`);
    downloadBlob(workbook, `${statement.customer.name}-statement.xls`, "application/vnd.ms-excel");
  }

  function downloadPdf() {
    const printWindow = window.open("", "_blank");
    printWindow.document.write(`<!doctype html><title>Statement</title><style>body{font-family:Arial;padding:24px}table{width:100%;border-collapse:collapse}th,td{border:1px solid #ccc;padding:8px;text-align:left}</style>${els.statementPreview.innerHTML}`);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  }

  function renderCustomers() {
    els.customersList.innerHTML = state.customers.map((customer) => `
      <form class="record edit-customer-form" data-edit-customer="${customer.id}">
        <div class="item-form-grid">
          <label><span>Name</span><input name="name" value="${escapeHtml(customer.name)}" required /></label>
          <label><span>Type</span><select name="type"><option value="prepaid" ${customer.type === "prepaid" ? "selected" : ""}>Prepaid</option><option value="account" ${customer.type === "account" ? "selected" : ""}>Account</option></select></label>
          <label><span>Phone</span><input name="phone" value="${escapeHtml(customer.phone || "")}" /></label>
          <label><span>Email</span><input name="email" value="${escapeHtml(customer.email || "")}" /></label>
          <label><span>Vehicle</span><input name="vehicle" value="${escapeHtml(customer.vehicle || "")}" /></label>
          <label><span>Opening Balance</span><input name="openingBalance" type="number" step="0.01" value="${Number(customer.openingBalance || 0).toFixed(2)}" /></label>
        </div>
        <div class="record-actions">
          <button class="secondary-button" type="submit">Save</button>
          ${customer.id === "walkin" ? "" : `<button class="danger-button" data-delete-customer="${customer.id}" type="button">Remove</button>`}
        </div>
      </form>`).join("");
  }

  async function addCustomer() {
    const name = els.customerNameInput.value.trim();
    if (!name) return;
    const customer = {
      id: uid("C"),
      name,
      type: els.customerTypeInput.value,
      phone: els.customerPhoneInput.value.trim(),
      email: els.customerEmailInput.value.trim(),
      vehicle: els.customerVehicleInput.value.trim(),
      openingBalance: Number(els.customerOpeningBalanceInput.value || 0)
    };
    state.customers.push(customer);
    els.addCustomerForm.reset();
    if (!(await persistChange("Customer was not saved. Please try again."))) {
      state.customers = state.customers.filter((item) => item.id !== customer.id);
      return;
    }
    renderCustomers();
    renderCustomersForSale();
  }

  async function saveEditedCustomer(form) {
    const customer = state.customers.find((item) => item.id === form.dataset.editCustomer);
    if (!customer) return;
    const previous = { ...customer };
    customer.name = form.elements.name.value.trim();
    customer.type = form.elements.type.value;
    customer.phone = form.elements.phone.value.trim();
    customer.email = form.elements.email.value.trim();
    customer.vehicle = form.elements.vehicle.value.trim();
    customer.openingBalance = Number(form.elements.openingBalance.value || 0);
    if (!(await persistChange("Customer changes were not saved. Please try again."))) {
      Object.assign(customer, previous);
      return;
    }
    renderCustomers();
    renderCustomersForSale();
    renderPaymentTabs();
  }

  async function removeCustomer(id) {
    if (id === "walkin") return;
    if (state.transactions.some((sale) => sale.customerId === id) || state.payments.some((payment) => payment.customerId === id)) {
      return window.alert("This customer already has sales or payments. Keep them for history.");
    }
    const previousCustomers = state.customers.slice();
    state.customers = state.customers.filter((customer) => customer.id !== id);
    if (!(await persistChange("Customer removal was not saved. Please try again."))) {
      state.customers = previousCustomers;
      return;
    }
    renderCustomers();
    renderCustomersForSale();
  }

  function renderPayments() {
    els.paymentCustomerSelect.innerHTML = accountCustomers().map((customer) => `<option value="${customer.id}">${escapeHtml(customer.name)}</option>`).join("");
    els.paymentsList.innerHTML = state.payments.length ? state.payments.map((payment) => `
      <div class="record">
        <div class="record-top"><span>${escapeHtml(payment.customerName)}</span><span>${money(payment.amount)}</span></div>
        <div class="muted">${new Date(payment.date).toLocaleString()} - ${escapeHtml(payment.method)} - ${escapeHtml(payment.reference || "")}</div>
        <div>${escapeHtml(payment.notes || "")}</div>
        <div class="record-actions">
          <button class="danger-button" data-delete-payment="${payment.id}" type="button">Delete Payment</button>
        </div>
      </div>`).join("") : '<div class="empty-state">No payments loaded yet.</div>';
  }

  async function addPayment() {
    const customer = state.customers.find((item) => item.id === els.paymentCustomerSelect.value);
    if (!customer || customer.type !== "account") return;
    const payment = {
      id: uid("P"),
      type: "payment",
      date: new Date().toISOString(),
      customerId: customer.id,
      customerName: customer.name,
      amount: Number(els.paymentAmountInput.value || 0),
      method: els.paymentMethodInput.value,
      reference: els.paymentReferenceInput.value.trim(),
      notes: els.paymentNotesInput.value.trim(),
      userRole: state.currentUser
    };
    state.payments.unshift(payment);
    els.paymentForm.reset();
    if (!(await persistChange("Payment was not saved. Please try again."))) {
      state.payments = state.payments.filter((item) => item.id !== payment.id);
      return;
    }
    renderPayments();
  }

  async function deletePayment(id) {
    const payment = state.payments.find((item) => item.id === id);
    if (!payment) return;
    if (!window.confirm(`Delete payment for ${payment.customerName} - ${money(payment.amount)}?`)) return;
    const previousPayments = state.payments.slice();
    const previousDeletedPaymentIds = state.deletedPaymentIds.slice();
    state.payments = state.payments.filter((item) => item.id !== id);
    state.deletedPaymentIds = uniqueById([...state.deletedPaymentIds, id]);
    if (!(await persistChange("Payment deletion was not saved. Please try again."))) {
      state.payments = previousPayments;
      state.deletedPaymentIds = previousDeletedPaymentIds;
      return;
    }
    renderPayments();
    renderStatement();
  }

  function renderInventory() {
    els.newItemCategory.innerHTML = categoryOptions("Food");
    els.inventoryList.innerHTML = state.products.map((product) => `
      <form class="record edit-item-form" data-edit-item="${product.id}">
        <div class="edit-item-grid">
          <label><span>Name</span><input name="name" type="text" value="${escapeHtml(product.name)}" required /></label>
          <label><span>Category</span><select name="category" required>${categoryOptions(product.category)}</select></label>
          <label><span>Price</span><input name="price" type="number" min="0" step="0.01" value="${Number(product.price).toFixed(2)}" required /></label>
          <label><span>Unit</span><input name="unit" type="text" value="${escapeHtml(product.unit)}" required /></label>
          <label><span>Stock</span><input name="stock" type="number" min="0" step="1" value="${Number(product.stock)}" required /></label>
          <label><span>SKU</span><input name="sku" type="text" value="${escapeHtml(product.sku)}" /></label>
          <label><span>VAT</span><select name="taxable"><option value="true" ${product.taxable ? "selected" : ""}>15% VAT</option><option value="false" ${!product.taxable ? "selected" : ""}>No VAT</option></select></label>
        </div>
        <div class="record-actions">
          <button class="secondary-button" type="submit">Save</button>
          <button class="danger-button" data-delete-item="${product.id}" type="button">Remove</button>
        </div>
      </form>`).join("");
  }

  function syncCartLine(product) {
    state.cart = state.cart.map((line) => line.id === product.id ? { ...line, name: product.name, category: product.category, price: product.price, unit: product.unit, taxable: product.taxable } : line);
  }

  async function persistProducts() {
    if (!(await persistChange("Item changes were not saved. Please try again."))) return false;
    renderTabs();
    renderProducts();
    renderCart();
    renderMetrics();
    return true;
  }

  async function saveEditedItem(form) {
    const product = state.products.find((item) => item.id === form.dataset.editItem);
    if (!product) return;
    const previous = { ...product };
    product.name = form.elements.name.value.trim();
    product.category = form.elements.category.value;
    product.price = Number(form.elements.price.value || 0);
    product.unit = product.category === "Fuel" ? "L" : (form.elements.unit.value.trim() || "each");
    product.stock = Number(form.elements.stock.value || 0);
    product.sku = form.elements.sku.value.trim() || product.name.slice(0, 8).toUpperCase();
    product.taxable = form.elements.taxable.value === "true";
    syncCartLine(product);
    if (!(await persistProducts())) {
      Object.assign(product, previous);
      syncCartLine(product);
      return;
    }
    renderInventory();
  }

  async function addNewItem() {
    const name = els.newItemName.value.trim();
    if (!name) return;
    const category = els.newItemCategory.value;
    const product = {
      id: itemId(),
      name,
      category,
      price: Number(els.newItemPrice.value || 0),
      unit: category === "Fuel" ? "L" : (els.newItemUnit.value.trim() || "each"),
      stock: Number(els.newItemStock.value || 0),
      sku: els.newItemSku.value.trim() || name.slice(0, 8).toUpperCase(),
      taxable: els.newItemTaxable.value === "true"
    };
    state.products.push(product);
    els.addItemForm.reset();
    if (!(await persistProducts())) {
      state.products = state.products.filter((item) => item.id !== product.id);
      return;
    }
    renderInventory();
  }

  async function removeItem(productId) {
    const product = state.products.find((item) => item.id === productId);
    if (!product) return;
    if (!window.confirm(`Remove ${product.name} from the register?`)) return;
    const previousProducts = state.products.slice();
    const previousCart = state.cart.slice();
    state.products = state.products.filter((item) => item.id !== productId);
    state.cart = state.cart.filter((line) => line.id !== productId);
    if (!(await persistProducts())) {
      state.products = previousProducts;
      state.cart = previousCart;
      return;
    }
    renderInventory();
  }

  function renderSettings() {
    els.storeNameInput.value = state.settings.storeName;
    els.currencyInput.value = state.settings.currency;
    els.taxRateInput.value = state.settings.taxRate;
    els.adminPinInput.value = state.settings.adminPin;
    els.staffPinInput.value = state.settings.staffPin;
    els.recoveryPinInput.value = state.settings.recoveryPin;
    els.footerInput.value = state.settings.footer;
  }

  function renderMetrics() {
    const today = new Date().toDateString();
    const todaysTransactions = state.transactions.filter((transaction) => transaction.status !== "void" && new Date(transaction.date).toDateString() === today);
    const sales = todaysTransactions.reduce((sum, transaction) => sum + transaction.totals.total, 0);
    const average = todaysTransactions.length ? sales / todaysTransactions.length : 0;
    const lowStock = state.products.filter((product) => product.stock < 15).length;
    els.shiftSales.textContent = `${money(sales)} shift`;
    els.transactionCount.textContent = todaysTransactions.length;
    els.averageTicket.textContent = money(average);
    els.lowStockCount.textContent = lowStock;
  }

  function tickClock() {
    els.shiftClock.textContent = new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  function renderAll() {
    renderTabs();
    renderCustomersForSale();
    renderProducts();
    renderCart();
    renderMetrics();
    tickClock();
  }

  function bindEvents() {
    els.loginForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const pin = els.pinInput.value.trim();
      els.loginMessage.textContent = "";
      try {
        const result = await serverLogin(pin);
        login(result.role, result.token, result.data);
      } catch (error) {
        els.loginMessage.textContent = error.message || "Incorrect PIN.";
      }
    });
    els.recoveryBtn.addEventListener("click", async () => {
      const pin = window.prompt("Enter recovery PIN");
      if (!pin) return;
      els.loginMessage.textContent = "";
      try {
        const result = await serverLogin(pin, true);
        login(result.role, result.token, result.data);
      } catch (error) {
        els.loginMessage.textContent = error.message || "Incorrect recovery PIN.";
      }
    });
    els.logoutBtn.addEventListener("click", logout);
    els.categoryTabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-category]");
      if (!button) return;
      state.category = button.dataset.category;
      renderTabs();
      renderProducts();
    });
    els.paymentTabs.addEventListener("click", (event) => {
      const button = event.target.closest("[data-method]");
      if (!button || button.disabled) return;
      state.paymentMethod = button.dataset.method;
      renderPaymentTabs();
      renderCartTotals();
    });
    els.saleCustomerSelect.addEventListener("change", () => {
      state.selectedCustomerId = els.saleCustomerSelect.value;
      renderPaymentTabs();
      renderCartTotals();
    });
    els.productGrid.addEventListener("click", (event) => {
      const button = event.target.closest("[data-product]");
      if (button) addToCart(button.dataset.product);
    });
    els.cartLines.addEventListener("click", (event) => {
      const plus = event.target.closest("[data-plus]");
      const minus = event.target.closest("[data-minus]");
      if (plus) updateQty(plus.dataset.plus, 1);
      if (minus) updateQty(minus.dataset.minus, -1);
    });
    els.cartLines.addEventListener("input", (event) => {
      const input = event.target.closest("[data-qty]");
      if (input) updateManualQty(input);
    });
    els.searchInput.addEventListener("input", (event) => {
      state.search = event.target.value;
      renderProducts();
    });
    els.clearSearchBtn.addEventListener("click", () => {
      state.search = "";
      els.searchInput.value = "";
      renderProducts();
    });
    els.payBtn.addEventListener("click", () => {
      void completeSale();
    });
    els.voidBtn.addEventListener("click", resetSale);
    els.closeReceiptBtn.addEventListener("click", () => els.receiptDialog.close());
    els.printReceiptBtn.addEventListener("click", () => window.print());
    els.newSaleBtn.addEventListener("click", () => {
      els.receiptDialog.close();
      resetSale();
    });
    els.historyBtn.addEventListener("click", async () => {
      await refreshFromServer();
      renderHistory();
      els.historyDialog.showModal();
    });
    els.closeHistoryBtn.addEventListener("click", () => els.historyDialog.close());
    [els.historyFromInput, els.historyToInput, els.historyStatusInput].forEach((input) => input.addEventListener("change", renderHistory));
    els.downloadSelectedHistoryBtn.addEventListener("click", () => downloadHistoryExcel(filteredHistory(), "selected"));
    els.downloadAllHistoryBtn.addEventListener("click", () => downloadHistoryExcel(state.transactions, "full"));
    els.historyList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-void-sale]");
      if (button) void voidSale(button.dataset.voidSale);
    });
    els.tillBtn.addEventListener("click", async () => {
      await refreshFromServer();
      renderTill();
      els.tillDialog.showModal();
    });
    els.closeTillBtn.addEventListener("click", () => els.tillDialog.close());
    els.tillCollectionMethod.addEventListener("change", setTillDefaultAmount);
    els.downloadTillReportBtn.addEventListener("click", async () => {
      await refreshFromServer();
      renderTill();
      downloadTillReport();
    });
    els.tillCollectionForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void addTillCollection();
    });
    els.customersBtn.addEventListener("click", () => {
      renderCustomers();
      els.customersDialog.showModal();
    });
    els.closeCustomersBtn.addEventListener("click", () => els.customersDialog.close());
    els.addCustomerForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void addCustomer();
    });
    els.customersList.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.target.closest("[data-edit-customer]");
      if (form) void saveEditedCustomer(form);
    });
    els.customersList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-delete-customer]");
      if (button) void removeCustomer(button.dataset.deleteCustomer);
    });
    els.paymentsBtn.addEventListener("click", async () => {
      await refreshFromServer();
      renderPayments();
      els.paymentsDialog.showModal();
    });
    els.closePaymentsBtn.addEventListener("click", () => els.paymentsDialog.close());
    els.paymentForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void addPayment();
    });
    els.paymentsList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-delete-payment]");
      if (button) void deletePayment(button.dataset.deletePayment);
    });
    els.statementsBtn.addEventListener("click", async () => {
      await refreshFromServer();
      renderStatementSelectors();
      els.statementsDialog.showModal();
    });
    els.closeStatementsBtn.addEventListener("click", () => els.statementsDialog.close());
    [els.statementCustomerSelect, els.statementFromInput, els.statementToInput].forEach((input) => input.addEventListener("change", renderStatement));
    els.downloadCsvBtn.addEventListener("click", downloadStatementExcel);
    els.downloadPdfBtn.addEventListener("click", downloadPdf);
    els.inventoryBtn.addEventListener("click", () => {
      renderInventory();
      els.inventoryDialog.showModal();
    });
    els.closeInventoryBtn.addEventListener("click", () => els.inventoryDialog.close());
    els.addItemForm.addEventListener("submit", (event) => {
      event.preventDefault();
      void addNewItem();
    });
    els.inventoryList.addEventListener("submit", (event) => {
      event.preventDefault();
      const form = event.target.closest("[data-edit-item]");
      if (form) void saveEditedItem(form);
    });
    els.inventoryList.addEventListener("click", (event) => {
      const button = event.target.closest("[data-delete-item]");
      if (button) void removeItem(button.dataset.deleteItem);
    });
    els.settingsBtn.addEventListener("click", () => {
      renderSettings();
      els.settingsDialog.showModal();
    });
    els.closeSettingsBtn.addEventListener("click", () => els.settingsDialog.close());
    els.downloadBackupBtn.addEventListener("click", () => {
      void downloadFullBackup();
    });
    els.settingsForm.addEventListener("submit", async (event) => {
      event.preventDefault();
      const previous = { ...state.settings };
      state.settings.storeName = els.storeNameInput.value.trim() || "Truck Stop POS";
      state.settings.currency = els.currencyInput.value.trim() || "R";
      state.settings.taxRate = Number(els.taxRateInput.value || 15);
      state.settings.adminPin = els.adminPinInput.value.trim() || "1234";
      state.settings.staffPin = els.staffPinInput.value.trim() || "0000";
      state.settings.recoveryPin = els.recoveryPinInput.value.trim() || "9999";
      state.settings.footer = els.footerInput.value.trim();
      if (!(await persistChange("Settings were not saved. Please try again."))) {
        state.settings = previous;
        return;
      }
      els.settingsDialog.close();
      renderAll();
    });
  }

  function init() {
    if (!state.settings.currency || state.settings.currency === "$") {
      state.settings.currency = "R";
    }
    bindEvents();
    renderAll();
    tickClock();
    setInterval(tickClock, 30000);
    els.pinInput.focus();
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) void refreshFromServer(true);
    });
    window.addEventListener("focus", () => {
      void refreshFromServer(true);
    });
    window.addEventListener("beforeunload", () => {
      const data = currentData();
      try {
        localStorage.setItem("truck-pos-backup", JSON.stringify(data));
      } catch (error) {}
      if (canSaveToServer() && navigator.sendBeacon && state.sessionToken) {
        navigator.sendBeacon("/api/data", new Blob([JSON.stringify({ token: state.sessionToken, data })], { type: "application/json" }));
      }
    });
  }

  init();
})();
