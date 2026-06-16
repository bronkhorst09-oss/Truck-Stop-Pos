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
    els.historyBtn.addEventListener("click", () => {
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
    els.paymentsBtn.addEventListener("click", () => {
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
    els.statementsBtn.addEventListener("click", () => {
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
    let normalized = false;
    if (!state.settings.currency || state.settings.currency === "$") {
      state.settings.currency = "R";
      normalized = true;
    }
    bindEvents();
    renderAll();
    tickClock();
    setInterval(tickClock, 30000);
    els.pinInput.focus();
    if (normalized) void saveAll().catch(() => {});
    window.addEventListener("beforeunload", () => {
      const data = currentData();
      try {
        localStorage.setItem("truck-pos-backup", JSON.stringify(data));
      } catch (error) {}
      if (canSaveToServer() && navigator.sendBeacon) {
        navigator.sendBeacon("/api/data", new Blob([JSON.stringify(data)], { type: "application/json" }));
      }
    });
  }

  init();
})();
