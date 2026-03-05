/**
 * Core Application Logic for Reddyagency (Supabase Cloud POS Edition)
 */

let posCart = [];

document.addEventListener('DOMContentLoaded', async () => {
    // Show loading or login screen
    document.querySelectorAll('.view-container').forEach(v => v.classList.remove('active'));
    document.getElementById('view-login').classList.add('active');

    // Init Auth
    await initAuthFlow();

    initNavigation();
    initSettings();
    initProductsView();
    initSuppliersView();
    initPOS();
    initModals();
});

async function initAuthFlow() {
    const session = await DB.initAuth();

    document.getElementById('login-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass = document.getElementById('login-password').value;
        const btn = document.getElementById('btn-login-submit');
        const err = document.getElementById('login-error');

        btn.textContent = 'Logging in...';
        btn.disabled = true;
        err.style.display = 'none';

        const { data, error } = await DB.login(email, pass);

        btn.textContent = 'Login';
        btn.disabled = false;

        if (error) {
            err.textContent = error.message;
            err.style.display = 'block';
        } else {
            document.getElementById('login-email').value = '';
            document.getElementById('login-password').value = '';
            await DB.initAuth(); // refresh profile
            startApp();
        }
    });

    document.getElementById('btn-logout').addEventListener('click', async () => {
        await DB.logout();
        window.location.reload();
    });

    if (session) {
        startApp();
    }
}

function startApp() {
    // Hide login
    document.getElementById('view-login').style.display = 'none';

    const profile = DB.getProfile();
    // Enforce role-based UI
    if (profile && profile.role === 'staff') {
        const settingsNav = Array.from(document.querySelectorAll('.nav-link, .nav-btn')).find(n => n.dataset.target === 'settings');
        if (settingsNav) settingsNav.style.display = 'none';

        const suppliersNav = Array.from(document.querySelectorAll('.nav-link, .nav-btn')).find(n => n.dataset.target === 'suppliers');
        if (suppliersNav) suppliersNav.style.display = 'none';

        const qSelect = document.getElementById('quick-nav-select');
        if (qSelect) {
            Array.from(qSelect.options).forEach(opt => {
                if (opt.value === 'settings' || opt.value === 'suppliers') opt.style.display = 'none';
            })
        }
    }

    // Default load depending on hash
    let initialTarget = 'dashboard';
    if (window.location.hash) {
        const hashTarget = window.location.hash.substring(1);
        if (['dashboard', 'checkout', 'products', 'suppliers', 'reports', 'settings'].includes(hashTarget)) {
            initialTarget = hashTarget;
        }
    }
    navigateTo(initialTarget, false);
}


// --- NAVIGATION ---
function initNavigation() {
    const navLinks = document.querySelectorAll('.nav-link, .nav-btn');

    // Handle click on links and buttons
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = link.dataset.target;
            navigateTo(target, true);
        });
    });

    // Handle mobile select
    const quickNavSelect = document.getElementById('quick-nav-select');
    if (quickNavSelect) {
        quickNavSelect.addEventListener('change', (e) => {
            navigateTo(e.target.value, true);
        });
    }

    // Handle back button
    const backBtn = document.getElementById('btn-back');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.history.back();
        });
    }

    // Handle popstate for browser history navigation
    window.addEventListener('popstate', (e) => {
        if (e.state && e.state.target) {
            navigateTo(e.state.target, false);
        } else {
            navigateTo('dashboard', false);
        }
    });
}

async function navigateTo(target, pushToHistory = true) {
    // Prevent unathorized route hits
    const profile = DB.getProfile();
    if (profile && profile.role === 'staff' && (target === 'settings' || target === 'suppliers')) {
        target = 'dashboard';
    }

    // Determine title text
    let titleText = target.charAt(0).toUpperCase() + target.slice(1);
    const link = Array.from(document.querySelectorAll('.nav-link')).find(n => n.dataset.target === target);
    if (link) titleText = link.textContent;

    // Update active states for sidebar and quick nav buttons
    document.querySelectorAll('.nav-link').forEach(n => n.classList.remove('active'));
    if (link) link.classList.add('active');

    document.querySelectorAll('.nav-btn').forEach(n => n.classList.remove('active'));
    const topBtn = Array.from(document.querySelectorAll('.nav-btn')).find(n => n.dataset.target === target);
    if (topBtn) topBtn.classList.add('active');

    // Update select dropdown
    const quickNavSelect = document.getElementById('quick-nav-select');
    if (quickNavSelect) quickNavSelect.value = target;

    // Update Views
    document.querySelectorAll('.view-container').forEach(v => {
        if (v.id !== 'view-login') v.classList.remove('active');
    });
    const view = document.getElementById(`view-${target}`);
    if (view) view.classList.add('active');

    // Update Header and Back button
    document.getElementById('current-view-title').textContent = titleText;
    const backBtn = document.getElementById('btn-back');
    if (backBtn) {
        if (target === 'dashboard') {
            backBtn.style.display = 'none';
        } else {
            backBtn.style.display = 'block';
        }
    }

    // Hide sidebar on mobile
    if (window.innerWidth <= 768) {
        const sidebar = document.getElementById('sidebar');
        if (sidebar && sidebar.style.display !== 'none' && !sidebar.dataset.initialized) {
            sidebar.style.display = 'none';
            sidebar.dataset.initialized = 'true';
        }
    }

    // History API
    if (pushToHistory) {
        window.history.pushState({ target }, titleText, `#${target}`);
    }

    // Trigger specific async view renders
    if (target === 'dashboard') await renderDashboard();
    if (target === 'products') await renderProducts();
    if (target === 'suppliers') await renderSuppliers();
    if (target === 'checkout') await renderPOSProducts();
    if (target === 'reports') await renderReports();
}

// --- CURRENCY FORMATTER ---
function formatAmt(num) {
    const sym = DB.getSettings().currency;
    return formatCurrency(num, sym);
}

// --- DASHBOARD ---
async function renderDashboard() {
    const sales = await DB.getSales();
    const products = await DB.getProducts();
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
            if (sale.items) {
                sale.items.forEach(item => {
                    productSalesCount[item.productId] = (productSalesCount[item.productId] || 0) + item.quantity;
                });
            }
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
            const prod = products.find(p => p.id === id);
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
    document.getElementById('btn-add-product').addEventListener('click', async () => {
        document.getElementById('product-form').reset();
        document.getElementById('prod-id').value = '';
        document.getElementById('modal-product-title').textContent = 'Add Product';
        await populateSupplierDropdown();
        openModal('modal-product');
    });

    document.getElementById('product-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('prod-id').value;
        const submitBtn = e.target.querySelector('button[type="submit"]');
        submitBtn.disabled = true;

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
            await DB.updateProduct(id, productData);
            showToast('Product updated');
        } else {
            await DB.addProduct(productData);
            showToast('Product added');
        }

        submitBtn.disabled = false;
        closeModal('modal-product');
        await renderProducts();
    });

    document.getElementById('product-search').addEventListener('input', renderProducts);
}

async function renderProducts() {
    const query = document.getElementById('product-search').value.toLowerCase();
    const products = await DB.getProducts();
    const tbody = document.querySelector('#products-table tbody');
    tbody.innerHTML = '';

    const filtered = products.filter(p => p.name.toLowerCase().includes(query) || (p.category && p.category.toLowerCase().includes(query)));

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

window.editProduct = async function (id) {
    const product = await DB.getProduct(id);
    if (!product) return;
    document.getElementById('prod-id').value = id;
    document.getElementById('prod-name').value = product.name || '';
    document.getElementById('prod-category').value = product.category || '';
    document.getElementById('prod-unit').value = product.unit || '';
    document.getElementById('prod-cost').value = product.costPrice || '';
    document.getElementById('prod-selling').value = product.sellingPrice || '';
    document.getElementById('prod-stock').value = product.stockQuantity || 0;
    document.getElementById('prod-threshold').value = product.lowStockThreshold || 5;

    await populateSupplierDropdown();
    document.getElementById('prod-supplier').value = product.supplierId || '';

    document.getElementById('modal-product-title').textContent = 'Edit Product';
    openModal('modal-product');
};

window.confirmDeleteProduct = async function (id) {
    if (confirm("Are you sure you want to delete this product?")) {
        await DB.deleteProduct(id);
        await renderProducts();
        showToast('Product deleted');
    }
};

// --- SUPPLIERS ---
function initSuppliersView() {
    document.getElementById('btn-add-supplier').addEventListener('click', () => {
        document.getElementById('supplier-form').reset();
        document.getElementById('sup-id').value = '';
        document.getElementById('modal-supplier-title').textContent = 'Add Supplier';
        openModal('modal-supplier');
    });

    document.getElementById('supplier-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const id = document.getElementById('sup-id').value;
        const btn = e.target.querySelector('button[type="submit"]');
        btn.disabled = true;

        const data = {
            name: document.getElementById('sup-name').value,
            phone: document.getElementById('sup-phone').value,
            address: document.getElementById('sup-address').value,
            notes: document.getElementById('sup-notes').value
        };

        if (id) {
            await DB.updateSupplier(id, data);
            showToast('Supplier updated');
        } else {
            await DB.addSupplier(data);
            showToast('Supplier added');
        }
        btn.disabled = false;
        closeModal('modal-supplier');
        await renderSuppliers();
    });

    document.getElementById('supplier-search').addEventListener('input', renderSuppliers);
}

async function renderSuppliers() {
    const query = document.getElementById('supplier-search').value.toLowerCase();
    const suppliers = await DB.getSuppliers();
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

window.editSupplier = async function (id) {
    const suppliers = await DB.getSuppliers();
    const supplier = suppliers.find(s => s.id === id);
    if (!supplier) return;
    document.getElementById('sup-id').value = id;
    document.getElementById('sup-name').value = supplier.name || '';
    document.getElementById('sup-phone').value = supplier.phone || '';
    document.getElementById('sup-address').value = supplier.address || '';
    document.getElementById('sup-notes').value = supplier.notes || '';
    document.getElementById('modal-supplier-title').textContent = 'Edit Supplier';
    openModal('modal-supplier');
};

window.confirmDeleteSupplier = async function (id) {
    if (confirm("Delete this supplier?")) {
        await DB.deleteSupplier(id);
        await renderSuppliers();
        showToast('Supplier deleted');
    }
};

async function populateSupplierDropdown() {
    const select = document.getElementById('prod-supplier');
    const sup = await DB.getSuppliers();
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

    document.getElementById('btn-complete-sale').addEventListener('click', async () => {
        if (posCart.length === 0) return;
        const btn = document.getElementById('btn-complete-sale');
        btn.disabled = true;
        btn.textContent = "Processing...";

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

        const result = await DB.addSale(saleData);
        if (result.success) {
            showToast('Sale completed successfully');
            posCart = [];
            renderPOSCart();
            await renderPOSProducts();
        } else {
            alert(result.message);
        }
        btn.disabled = false;
        btn.textContent = "Complete Sale";
    });
}

let posCachedProducts = [];
async function renderPOSProducts() {
    // Only fetch from network if search is changing rapidly or initial load
    // For a real POS you might want real-time listeners, but this is sufficient.
    posCachedProducts = await DB.getProducts();

    const query = document.getElementById('pos-search').value.toLowerCase();
    const grid = document.getElementById('pos-products-grid');
    grid.innerHTML = '';

    const filtered = posCachedProducts.filter(p => p.name.toLowerCase().includes(query) || (p.category && p.category.toLowerCase().includes(query)));

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
                <span class="text-muted" style="font-size:12px;">Stock: ${availableStock} ${escapeHTML(p.unit)}</span>
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
    // Simulate stock UI update without DB call
    renderPOSProductsLocalFilter();
}

window.updateCartQty = function (productId, delta) {
    const itemIndex = posCart.findIndex(c => c.productId === productId);
    if (itemIndex > -1) {
        const product = posCachedProducts.find(p => p.id === productId);
        if (delta > 0 && product && posCart[itemIndex].quantity >= product.stockQuantity) {
            return; // Can't add more than stock
        }
        posCart[itemIndex].quantity += delta;
        if (posCart[itemIndex].quantity <= 0) {
            posCart.splice(itemIndex, 1);
        }
        renderPOSCart();
        renderPOSProductsLocalFilter();
    }
}

// Optimization: Updates visual grid without fetching DB
function renderPOSProductsLocalFilter() {
    const query = document.getElementById('pos-search').value.toLowerCase();
    const grid = document.getElementById('pos-products-grid');
    grid.innerHTML = '';

    const filtered = posCachedProducts.filter(p => p.name.toLowerCase().includes(query) || (p.category && p.category.toLowerCase().includes(query)));

    filtered.forEach(p => {
        const card = document.createElement('div');
        card.className = 'card stat-card';
        card.style.cursor = p.stockQuantity > 0 ? 'pointer' : 'not-allowed';
        card.style.opacity = p.stockQuantity > 0 ? '1' : '0.5';
        card.style.padding = '12px';

        const cartItem = posCart.find(c => c.productId === p.id);
        const qtyInCart = cartItem ? cartItem.quantity : 0;
        const availableStock = p.stockQuantity - qtyInCart;

        card.innerHTML = `
            <div style="font-size:14px; font-weight:bold; margin-bottom:4px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHTML(p.name)}</div>
            <div class="text-muted" style="margin-bottom:8px;">${escapeHTML(p.category)}</div>
            <div style="display:flex; justify-content:space-between; align-items:flex-end;">
                <span style="font-weight:bold; color:var(--brand-accent);">${formatAmt(p.sellingPrice)}</span>
                <span class="text-muted" style="font-size:12px;">Stock: ${availableStock} ${escapeHTML(p.unit)}</span>
            </div>
        `;

        if (availableStock > 0) {
            card.onclick = () => addToCart(p);
        }
        grid.appendChild(card);
    });
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
async function renderReports() {
    const range = document.getElementById('report-date-range').value;
    const isPrivacyMode = DB.getSettings().privacyMode;
    const sales = await DB.getSales();
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
            <td>${s.items ? s.items.reduce((sum, i) => sum + i.quantity, 0) : 0} items</td>
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

window.deleteSaleAction = async function (saleId) {
    if (confirm("Are you sure you want to delete this sale? This will restore the stock.")) {
        const deletedSale = await DB.deleteSale(saleId);
        if (deletedSale) {
            await renderReports();
            showToast('Sale deleted and stock restored.', true, async () => {
                const restored = await DB.undoDeleteSale(deletedSale);
                if (restored) {
                    await renderReports();
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
        showToast('Settings saved locally successfully');
    });

    // Setup Export
    document.getElementById('btn-export-data').addEventListener('click', async () => {
        // Because data is in cloud now, we can just export products and sales to CSV
        const sales = await DB.getSales();
        const dataStr = JSON.stringify(sales, null, 2);
        const blob = new Blob([dataStr], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `reddyagency_sales_backup_${new Date().toISOString().split('T')[0]}.json`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    });

    // Clear Data
    document.getElementById('btn-clear-data').addEventListener('click', async () => {
        if (confirm("WARNING: This will delete ALL data from the cloud database permanently. Are you absolutely sure?")) {
            await DB.clearData();
            showToast("Data clearing command sent.");
            setTimeout(() => location.reload(), 1500);
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

window.openModal = function (id) {
    document.getElementById(id).classList.add('active');
}

window.closeModal = function (id) {
    document.getElementById(id).classList.remove('active');
}
