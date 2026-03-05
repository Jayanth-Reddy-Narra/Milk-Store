/**
 * Core Application Logic for Reddyagency
 */

let posCart = [];

document.addEventListener('DOMContentLoaded', () => {
    initNavigation();
    initSettings();
    initProductsView();
    initSuppliersView();
    initPOS();
    initModals();

    // Default load
    renderDashboard();
});

// --- NAVIGATION ---
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link');
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.dataset.target;

            navLinks.forEach(n => n.classList.remove('active'));
            link.classList.add('active');

            document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
            document.getElementById(`view-${target}`).classList.add('active');
            document.getElementById('current-view-title').textContent = link.textContent;

            if (window.innerWidth <= 768) {
                document.getElementById('sidebar').style.display = 'none'; // Basic auto hide on mobile
            }

            // Trigger specific view renders
            if (target === 'dashboard') renderDashboard();
            if (target === 'products') renderProducts();
            if (target === 'suppliers') renderSuppliers();
            if (target === 'checkout') renderPOSProducts();
            if (target === 'reports') renderReports();
        });
    });

    // Mobile navigation toggle logic could be added here
}

// --- CURRENCY FORMATTER ---
function formatAmt(num) {
    const sym = DB.getSettings().currency;
    return formatCurrency(num, sym);
}

// --- DASHBOARD ---
function renderDashboard() {
    const sales = DB.getSales();
    const products = DB.getProducts();
    const isPrivacyMode = DB.getSettings().privacyMode;

    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);

    let todaySales = 0, todayProfit = 0, monthSales = 0;
    let productSalesCount = {};

    sales.forEach(sale => {
        const d = new Date(sale.createdAt);
        if (d >= todayStart) {
            todaySales += sale.totalAmount;
            todayProfit += sale.totalProfit;
            // count products
            sale.items.forEach(item => {
                productSalesCount[item.productId] = (productSalesCount[item.productId] || 0) + item.quantity;
            });
        }
        if (d >= monthStart) {
            monthSales += sale.totalAmount;
        }
    });

    document.getElementById('dash-today-sales').textContent = formatAmt(todaySales);
    const profitCard = document.getElementById('dash-profit-card');
    if (isPrivacyMode) {
        profitCard.style.display = 'none';
    } else {
        profitCard.style.display = 'block';
        document.getElementById('dash-today-profit').textContent = formatAmt(todayProfit);
    }
    document.getElementById('dash-month-sales').textContent = formatAmt(monthSales);

    // Low stock
    const lowStockContainer = document.getElementById('dash-low-stock');
    lowStockContainer.innerHTML = '';
    const lowStockProducts = products.filter(p => p.stockQuantity <= (p.lowStockThreshold || 5));
    if (lowStockProducts.length === 0) {
        lowStockContainer.innerHTML = '<li class="text-muted" style="padding: 8px;">No low stock items.</li>';
    } else {
        lowStockProducts.forEach(p => {
            lowStockContainer.innerHTML += `
                <li style="padding: 8px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between;">
                    <span>${escapeHTML(p.name)}</span>
                    <span class="badge badge-warning">${p.stockQuantity} ${escapeHTML(p.unit)}</span>
                </li>`;
        });
    }

    // Top products today
    const topContainer = document.getElementById('dash-top-products');
    const sortedTop = Object.entries(productSalesCount).sort((a, b) => b[1] - a[1]).slice(0, 5);
    topContainer.innerHTML = '';
    if (sortedTop.length === 0) {
        topContainer.innerHTML = '<li class="text-muted" style="padding: 8px;">No sales yet today.</li>';
    } else {
        sortedTop.forEach(([id, qty]) => {
            const prod = DB.getProduct(id);
            if (prod) {
                topContainer.innerHTML += `
                    <li style="padding: 8px; border-bottom: 1px solid var(--border-color); display: flex; justify-content: space-between;">
                        <span>${escapeHTML(prod.name)}</span>
                        <span class="text-muted">${qty} sold</span>
                    </li>`;
            }
        });
    }
}

// --- PRODUCTS ---
function initProductsView() {
    document.getElementById('btn-add-product').addEventListener('click', () => {
        document.getElementById('product-form').reset();
        document.getElementById('prod-id').value = '';
        document.getElementById('modal-product-title').textContent = 'Add Product';
        populateSupplierDropdown();
        openModal('modal-product');
    });

    document.getElementById('product-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('prod-id').value;
        const productData = {
            name: document.getElementById('prod-name').value,
            category: document.getElementById('prod-category').value,
            unit: document.getElementById('prod-unit').value,
            costPrice: parseFloat(document.getElementById('prod-cost').value),
            sellingPrice: parseFloat(document.getElementById('prod-selling').value),
            stockQuantity: parseInt(document.getElementById('prod-stock').value, 10),
            lowStockThreshold: parseInt(document.getElementById('prod-threshold').value, 10),
            supplierId: document.getElementById('prod-supplier').value || null
        };

        if (id) {
            DB.updateProduct(id, productData);
            showToast('Product updated');
        } else {
            DB.addProduct(productData);
            showToast('Product added');
        }

        closeModal('modal-product');
        renderProducts();
    });

    document.getElementById('product-search').addEventListener('input', renderProducts);
}

function renderProducts() {
    const query = document.getElementById('product-search').value.toLowerCase();
    const products = DB.getProducts();
    const tbody = document.querySelector('#products-table tbody');
    tbody.innerHTML = '';

    const filtered = products.filter(p => p.name.toLowerCase().includes(query) || p.category.toLowerCase().includes(query));

    document.getElementById('products-empty').style.display = filtered.length === 0 ? 'block' : 'none';

    filtered.forEach(p => {
        const tr = document.createElement('tr');
        const lowStock = p.stockQuantity <= (p.lowStockThreshold || 5);
        tr.innerHTML = `
            <td>${escapeHTML(p.name)}</td>
            <td>${escapeHTML(p.category)}</td>
            <td>Cost: ${formatAmt(p.costPrice)}<br>Sell: ${formatAmt(p.sellingPrice)}</td>
            <td><b>${p.stockQuantity}</b> ${escapeHTML(p.unit)}</td>
            <td>${lowStock ? '<span class="badge badge-warning">Low Stock</span>' : '<span style="color:var(--success); font-size:12px;">Good</span>'}</td>
            <td>
                <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px; margin-right: 4px;" onclick="editProduct('${p.id}')">Edit</button>
                <button class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;" onclick="confirmDeleteProduct('${p.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function editProduct(id) {
    const product = DB.getProduct(id);
    if (!product) return;
    document.getElementById('prod-id').value = id;
    document.getElementById('prod-name').value = product.name;
    document.getElementById('prod-category').value = product.category;
    document.getElementById('prod-unit').value = product.unit;
    document.getElementById('prod-cost').value = product.costPrice;
    document.getElementById('prod-selling').value = product.sellingPrice;
    document.getElementById('prod-stock').value = product.stockQuantity;
    document.getElementById('prod-threshold').value = product.lowStockThreshold || 5;

    populateSupplierDropdown();
    document.getElementById('prod-supplier').value = product.supplierId || '';

    document.getElementById('modal-product-title').textContent = 'Edit Product';
    openModal('modal-product');
}

function confirmDeleteProduct(id) {
    if (confirm("Are you sure you want to delete this product?")) {
        DB.deleteProduct(id);
        renderProducts();
        showToast('Product deleted');
    }
}

// --- SUPPLIERS ---
function initSuppliersView() {
    document.getElementById('btn-add-supplier').addEventListener('click', () => {
        document.getElementById('supplier-form').reset();
        document.getElementById('sup-id').value = '';
        document.getElementById('modal-supplier-title').textContent = 'Add Supplier';
        openModal('modal-supplier');
    });

    document.getElementById('supplier-form').addEventListener('submit', (e) => {
        e.preventDefault();
        const id = document.getElementById('sup-id').value;
        const data = {
            name: document.getElementById('sup-name').value,
            phone: document.getElementById('sup-phone').value,
            address: document.getElementById('sup-address').value,
            notes: document.getElementById('sup-notes').value
        };

        if (id) {
            DB.updateSupplier(id, data);
            showToast('Supplier updated');
        } else {
            DB.addSupplier(data);
            showToast('Supplier added');
        }
        closeModal('modal-supplier');
        renderSuppliers();
    });

    document.getElementById('supplier-search').addEventListener('input', renderSuppliers);
}

function renderSuppliers() {
    const query = document.getElementById('supplier-search').value.toLowerCase();
    const suppliers = DB.getSuppliers();
    const tbody = document.querySelector('#suppliers-table tbody');
    tbody.innerHTML = '';

    const filtered = suppliers.filter(s => s.name.toLowerCase().includes(query));
    document.getElementById('suppliers-empty').style.display = filtered.length === 0 ? 'block' : 'none';

    filtered.forEach(s => {
        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${escapeHTML(s.name)}</td>
            <td>${escapeHTML(s.phone)}</td>
            <td>${escapeHTML(s.address)}</td>
            <td>${escapeHTML(s.notes)}</td>
            <td>
                <button class="btn btn-secondary" style="padding: 4px 8px; font-size: 12px;" onclick="editSupplier('${s.id}')">Edit</button>
                <button class="btn btn-danger" style="padding: 4px 8px; font-size: 12px;" onclick="confirmDeleteSupplier('${s.id}')">Delete</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function editSupplier(id) {
    const supplier = DB.getSuppliers().find(s => s.id === id);
    if (!supplier) return;
    document.getElementById('sup-id').value = id;
    document.getElementById('sup-name').value = supplier.name;
    document.getElementById('sup-phone').value = supplier.phone || '';
    document.getElementById('sup-address').value = supplier.address || '';
    document.getElementById('sup-notes').value = supplier.notes || '';
    document.getElementById('modal-supplier-title').textContent = 'Edit Supplier';
    openModal('modal-supplier');
}

function confirmDeleteSupplier(id) {
    if (confirm("Delete this supplier?")) {
        DB.deleteSupplier(id);
        renderSuppliers();
        showToast('Supplier deleted');
    }
}

function populateSupplierDropdown() {
    const select = document.getElementById('prod-supplier');
    const sup = DB.getSuppliers();
    select.innerHTML = '<option value="">None</option>';
    sup.forEach(s => {
        const opt = document.createElement('option');
        opt.value = s.id;
        opt.textContent = s.name;
        select.appendChild(opt);
    });
}

// --- CHECKOUT / POS ---
function initPOS() {
    document.getElementById('pos-search').addEventListener('input', renderPOSProducts);

    document.getElementById('btn-complete-sale').addEventListener('click', () => {
        if (posCart.length === 0) return;

        let totalAmt = 0;
        let totalProfit = 0;
        const items = posCart.map(item => {
            totalAmt += item.quantity * item.sellingPrice;
            totalProfit += item.quantity * (item.sellingPrice - item.costPrice);
            return {
                productId: item.productId,
                quantity: item.quantity,
                costPrice: item.costPrice,
                sellingPrice: item.sellingPrice
            };
        });

        const saleData = {
            items,
            totalAmount: totalAmt,
            totalProfit: totalProfit,
            paymentMethod: document.getElementById('pos-payment-method').value
        };

        const result = DB.addSale(saleData);
        if (result.success) {
            showToast('Sale completed successfully');
            posCart = [];
            renderPOSCart();
            renderPOSProducts(); // refresh stock visuals
        } else {
            alert(result.message); // If stock is insufficient
        }
    });
}

function renderPOSProducts() {
    const query = document.getElementById('pos-search').value.toLowerCase();
    const products = DB.getProducts();
    const grid = document.getElementById('pos-products-grid');
    grid.innerHTML = '';

    const filtered = products.filter(p => p.name.toLowerCase().includes(query) || p.category.toLowerCase().includes(query));

    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'card stat-card';
        card.style.cursor = p.stockQuantity > 0 ? 'pointer' : 'not-allowed';
        card.style.opacity = p.stockQuantity > 0 ? '1' : '0.5';
        card.style.padding = '12px';

        // Find quantity in cart
        const cartItem = posCart.find(c => c.productId === p.id);
        const qtyInCart = cartItem ? cartItem.quantity : 0;
        const availableStock = p.stockQuantity - qtyInCart;

        card.innerHTML = `
            <div style="font-size:14px; font-weight:bold; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(p.name)}</div>
            <div class="text-muted" style="margin-bottom:8px;">${escapeHTML(p.category)}</div>
            <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                <span style="font-weight:bold; color:var(--brand-accent);">${formatAmt(p.sellingPrice)}</span>
                <span class="text-muted" style="font-size:12px;">Stock: ${availableStock} ${p.unit}</span>
            </div>
        `;

        if (availableStock > 0) {
            card.onclick = () => addToCart(p);
        }

        grid.appendChild(card);
    });
}

function addToCart(product) {
    const existing = posCart.find(c => c.productId === product.id);
    if (existing) {
        if (existing.quantity < product.stockQuantity) {
            existing.quantity++;
        }
    } else {
        if (product.stockQuantity > 0) {
            posCart.push({
                productId: product.id,
                name: product.name,
                costPrice: product.costPrice,
                sellingPrice: product.sellingPrice,
                quantity: 1
            });
        }
    }
    renderPOSCart();
    renderPOSProducts(); // To update remaining stock display
}

function updateCartQty(productId, delta) {
    const itemIndex = posCart.findIndex(c => c.productId === productId);
    if (itemIndex > -1) {
        const product = DB.getProduct(productId);
        if (delta > 0 && posCart[itemIndex].quantity >= product.stockQuantity) {
            return; // Can't add more than stock
        }
        posCart[itemIndex].quantity += delta;
        if (posCart[itemIndex].quantity <= 0) {
            posCart.splice(itemIndex, 1);
        }
        renderPOSCart();
        renderPOSProducts();
    }
}

function renderPOSCart() {
    const container = document.getElementById('pos-cart-items');
    container.innerHTML = '';

    if (posCart.length === 0) {
        container.innerHTML = '<div class="text-muted" style="text-align: center; padding: 20px;">Cart is empty</div>';
        document.getElementById('btn-complete-sale').disabled = true;
        document.getElementById('pos-total-items').textContent = '0';
        document.getElementById('pos-total-amount').textContent = formatAmt(0);
        return;
    }

    let totalAmt = 0;
    let totalItems = 0;

    posCart.forEach(item => {
        totalAmt += (item.quantity * item.sellingPrice);
        totalItems += item.quantity;

        container.innerHTML += `
            <div class="cart-item">
                <div style="flex-grow:1; padding-right:8px;">
                    <div style="font-weight:bold; font-size:14px;">${escapeHTML(item.name)}</div>
                    <div class="text-muted" style="font-size:12px;">${formatAmt(item.sellingPrice)}/ea</div>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                    <button class="btn btn-secondary" style="padding:2px 8px;" onclick="updateCartQty('${item.productId}', -1)">-</button>
                    <span>${item.quantity}</span>
                    <button class="btn btn-secondary" style="padding:2px 8px;" onclick="updateCartQty('${item.productId}', 1)">+</button>
                </div>
                <div style="width:70px; text-align:right; font-weight:bold;">
                    ${formatAmt(item.quantity * item.sellingPrice)}
                </div>
            </div>
        `;
    });

    document.getElementById('pos-total-items').textContent = totalItems;
    document.getElementById('pos-total-amount').textContent = formatAmt(totalAmt);
    document.getElementById('btn-complete-sale').disabled = false;
}

// --- REPORTS ---
function renderReports() {
    const range = document.getElementById('report-date-range').value;
    const isPrivacyMode = DB.getSettings().privacyMode;
    const sales = DB.getSales();
    const tbody = document.querySelector('#reports-table tbody');
    tbody.innerHTML = '';

    const now = new Date();
    let startDate = new Date(0); // All time
    let endDate = now;

    if (range === 'today') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (range === 'yesterday') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1);
        endDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    } else if (range === 'this_week') {
        startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate() - now.getDay());
    } else if (range === 'this_month') {
        startDate = new Date(now.getFullYear(), now.getMonth(), 1);
    }

    const filtered = sales.filter(s => {
        const d = new Date(s.createdAt);
        return d >= startDate && d <= endDate;
    }).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    document.getElementById('reports-empty').style.display = filtered.length === 0 ? 'block' : 'none';

    let filterTotal = 0;
    let filterProfit = 0;

    // Handle Privacy Mode CSS
    const profitCols = document.querySelectorAll('.profit-col');
    profitCols.forEach(col => {
        col.style.display = isPrivacyMode ? 'none' : 'table-cell';
    });

    filtered.forEach(s => {
        filterTotal += s.totalAmount;
        filterProfit += s.totalProfit;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-size:0.875rem;">${formatDate(s.createdAt)}</td>
            <td style="font-family:monospace; font-size:12px;">${s.id.substring(0, 8)}</td>
            <td>${s.items.reduce((sum, i) => sum + i.quantity, 0)} items</td>
            <td><span style="text-transform:uppercase; font-size:12px;" class="badge badge-warning" style="background:var(--bg-hover); color:var(--text-primary);">${s.paymentMethod}</span></td>
            <td style="font-weight:bold;">${formatAmt(s.totalAmount)}</td>
            <td class="profit-col" style="${isPrivacyMode ? 'display:none;' : 'color:var(--success);'}">${formatAmt(s.totalProfit)}</td>
            <td>
                <button class="btn btn-danger" style="padding: 2px 6px; font-size:10px;" onclick="deleteSaleAction('${s.id}')">Del</button>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('report-total-amount').textContent = formatAmt(filterTotal);
    document.getElementById('report-total-profit').textContent = formatAmt(filterProfit);
    document.getElementById('report-date-range').onchange = renderReports;
}

function deleteSaleAction(saleId) {
    if (confirm("Are you sure you want to delete this sale? This will restore the stock.")) {
        const deletedSale = DB.deleteSale(saleId);
        if (deletedSale) {
            renderReports(); // re-render table
            showToast('Sale deleted and stock restored.', true, () => {
                if (DB.undoDeleteSale(deletedSale)) {
                    renderReports();
                    showToast('Sale restored successfully.');
                } else {
                    showToast('Could not restore sale. Stock was used elsewhere.');
                }
            });
        }
    }
}


// --- SETTINGS & DATA TOOLS ---
function initSettings() {
    const settings = DB.getSettings();
    document.getElementById('setting-business-name').value = settings.businessName || 'Reddyagency';
    document.getElementById('setting-currency').value = settings.currency || '₹';
    document.getElementById('setting-privacy').checked = settings.privacyMode || false;
    document.title = settings.businessName || 'Reddyagency';

    document.getElementById('settings-form').addEventListener('submit', (e) => {
        e.preventDefault();
        DB.saveSettings({
            businessName: document.getElementById('setting-business-name').value,
            currency: document.getElementById('setting-currency').value,
            privacyMode: document.getElementById('setting-privacy').checked
        });
        document.title = document.getElementById('setting-business-name').value;
        showToast('Settings saved successfully');
    });

    // Setup Export
    document.getElementById('btn-export-data').addEventListener('click', () => {
        const dataStr = DB.exportData();
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reddyagency_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Setup Import
    document.getElementById('input-import-data').addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            if (DB.importData(event.target.result)) {
                showToast("Data imported successfully!");
                setTimeout(() => location.reload(), 1000);
            } else {
                alert("Invalid JSON format. Make sure you selected a valid backup file.");
            }
        };
        reader.readAsText(file);
    });

    // Clear Data
    document.getElementById('btn-clear-data').addEventListener('click', () => {
        if (confirm("WARNING: This will delete ALL products, sales, and suppliers permanently. Are you absolutely sure?")) {
            DB.clearData();
            showToast("All data has been reset.");
            setTimeout(() => location.reload(), 1000);
        }
    });
}

// --- MODALS ---
function initModals() {
    document.querySelectorAll('.close-modal').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const modal = e.target.closest('.modal-overlay');
            if (modal) closeModal(modal.id);
        });
    });

    // Click outside to close
    document.querySelectorAll('.modal-overlay').forEach(overlay => {
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                closeModal(overlay.id);
            }
        });
    });
}

function openModal(id) {
    document.getElementById(id).classList.add('active');
}

function closeModal(id) {
    document.getElementById(id).classList.remove('active');
}
