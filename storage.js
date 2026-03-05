/**
 * Storage management with migration handling and data corruption safeguards.
 */

const STORAGE_KEY = "milkStore:data";
const CURRENT_VERSION = 1;

let appData = {
    version: CURRENT_VERSION,
    settings: {
        businessName: "Reddyagency",
        currency: "₹",
        privacyMode: false
    },
    products: [],
    sales: [],
    suppliers: []
};

// Initialize and migrate data
function initStorage() {
    try {
        const rawData = localStorage.getItem(STORAGE_KEY);
        if (rawData) {
            let parsedData = JSON.parse(rawData);
            appData = migrateData(parsedData);
            saveData(); // Save migrated data
        } else {
            saveData(); // Save initial schema
        }
    } catch (e) {
        console.error("Storage corrupted. Starting fresh.", e);
        // Backup corrupted data just in case
        localStorage.setItem(`${STORAGE_KEY}:corrupted_backup_${Date.now()}`, localStorage.getItem(STORAGE_KEY));
        saveData(); // Reset to defaults
    }
}

// Ensure schema matches current version
function migrateData(data) {
    if (!data.version) data.version = 0;

    // Iterative migration
    if (data.version < 1) {
        data.settings = data.settings || appData.settings;
        data.products = data.products || [];
        data.sales = data.sales || [];
        data.suppliers = data.suppliers || [];
        data.version = 1;
    }

    return data;
}

// Persist data
function saveData() {
    try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
    } catch (error) {
        console.error("Failed to save data. LocalStorage might be full.", error);
        alert("Warning: Could not save data. Please backup your data and clear browser storage.");
    }
}

// Data Access Object
const DB = {
    // Settings
    getSettings: () => appData.settings,
    saveSettings: (newSettings) => {
        appData.settings = { ...appData.settings, ...newSettings };
        saveData();
    },

    // Products
    getProducts: () => appData.products,
    getProduct: (id) => appData.products.find(p => p.id === id),
    addProduct: (product) => {
        const newProduct = { ...product, id: generateId(), createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
        appData.products.push(newProduct);
        saveData();
        return newProduct;
    },
    updateProduct: (id, updates) => {
        const index = appData.products.findIndex(p => p.id === id);
        if (index > -1) {
            appData.products[index] = { ...appData.products[index], ...updates, updatedAt: new Date().toISOString() };
            saveData();
            return true;
        }
        return false;
    },
    deleteProduct: (id) => {
        appData.products = appData.products.filter(p => p.id !== id);
        saveData();
    },
    adjustStock: (id, qtyChange) => {
        const product = DB.getProduct(id);
        if (product && product.stockQuantity + qtyChange >= 0) {
            DB.updateProduct(id, { stockQuantity: product.stockQuantity + qtyChange });
            return true;
        }
        return false;
    },

    // Sales
    getSales: () => appData.sales,
    addSale: (saleData) => {
        // Validate stock first
        for (let item of saleData.items) {
            const product = DB.getProduct(item.productId);
            if (!product || product.stockQuantity < item.quantity) {
                return { success: false, message: `Insufficient stock for ${product ? product.name : 'unknown item'}` };
            }
        }

        const saleId = generateId();
        const saleRecord = {
            id: saleId,
            items: saleData.items,
            totalAmount: saleData.totalAmount,
            totalProfit: saleData.totalProfit,
            paymentMethod: saleData.paymentMethod,
            createdAt: new Date().toISOString()
        };

        // Deduct stock
        saleData.items.forEach(item => {
            DB.adjustStock(item.productId, -item.quantity);
        });

        appData.sales.push(saleRecord);
        saveData();
        return { success: true, sale: saleRecord };
    },
    deleteSale: (id) => {
        const saleIndex = appData.sales.findIndex(s => s.id === id);
        if (saleIndex > -1) {
            const sale = appData.sales[saleIndex];
            // Restore stock
            sale.items.forEach(item => {
                DB.adjustStock(item.productId, item.quantity);
            });
            appData.sales.splice(saleIndex, 1);
            saveData();
            return sale;
        }
        return null; // Sale not found
    },
    undoDeleteSale: (saleRecord) => {
        // Find if sale was already added to prevent duplicates
        if (appData.sales.find(s => s.id === saleRecord.id)) return false;

        // Deduct stock again. Only works if enough valid stock.
        for (let item of saleRecord.items) {
            const product = DB.getProduct(item.productId);
            if (!product || product.stockQuantity < item.quantity) {
                return false; // Can't undo, stock was used.
            }
        }
        saleRecord.items.forEach(item => {
            DB.adjustStock(item.productId, -item.quantity);
        });

        appData.sales.push(saleRecord);
        saveData();
        return true;
    },

    // Suppliers
    getSuppliers: () => appData.suppliers,
    addSupplier: (supplier) => {
        const newSupplier = { ...supplier, id: generateId() };
        appData.suppliers.push(newSupplier);
        saveData();
    },
    updateSupplier: (id, updates) => {
        const index = appData.suppliers.findIndex(s => s.id === id);
        if (index > -1) {
            appData.suppliers[index] = { ...appData.suppliers[index], ...updates };
            saveData();
        }
    },
    deleteSupplier: (id) => {
        appData.suppliers = appData.suppliers.filter(s => s.id !== id);
        saveData();
    },

    // Import / Export
    exportData: () => JSON.stringify(appData, null, 2),
    importData: (jsonData) => {
        try {
            const parsed = JSON.parse(jsonData);
            if (!parsed.version || !parsed.products || !parsed.sales) {
                throw new Error("Invalid schema format.");
            }
            appData = migrateData(parsed);
            saveData();
            return true;
        } catch (e) {
            console.error("Import failed:", e);
            return false;
        }
    },
    clearData: () => {
        appData = {
            version: CURRENT_VERSION,
            settings: appData.settings,
            products: [],
            sales: [],
            suppliers: []
        };
        saveData();
    }
};

// Initialize synchronously on script load
initStorage();

// Seed initial products if empty
if (DB.getProducts().length === 0) {
    const defaultProducts = [
        { name: "Toned Milk (1L)", category: "Milk", unit: "litre", costPrice: 40, sellingPrice: 45, stockQuantity: 50, lowStockThreshold: 10 },
        { name: "Full Cream Milk (1L)", category: "Milk", unit: "litre", costPrice: 55, sellingPrice: 60, stockQuantity: 40, lowStockThreshold: 10 },
        { name: "Cow Milk (500ml)", category: "Milk", unit: "packet", costPrice: 22, sellingPrice: 25, stockQuantity: 60, lowStockThreshold: 15 },
        { name: "Fresh Curd (500g)", category: "Curd", unit: "packet", costPrice: 30, sellingPrice: 35, stockQuantity: 30, lowStockThreshold: 5 },
        { name: "Butter (100g)", category: "Butter", unit: "packet", costPrice: 45, sellingPrice: 52, stockQuantity: 20, lowStockThreshold: 5 },
        { name: "Paneer (200g)", category: "Paneer", unit: "packet", costPrice: 70, sellingPrice: 85, stockQuantity: 25, lowStockThreshold: 5 },
        { name: "Pure Ghee (500ml)", category: "Ghee", unit: "bottle", costPrice: 280, sellingPrice: 320, stockQuantity: 15, lowStockThreshold: 3 },
        { name: "Flavored Milk (200ml)", category: "Milk", unit: "bottle", costPrice: 25, sellingPrice: 30, stockQuantity: 45, lowStockThreshold: 10 },
        { name: "Buttermilk (200ml)", category: "Drink", unit: "packet", costPrice: 12, sellingPrice: 15, stockQuantity: 50, lowStockThreshold: 15 },
        { name: "Cheese Slices (200g)", category: "Cheese", unit: "packet", costPrice: 110, sellingPrice: 130, stockQuantity: 20, lowStockThreshold: 5 }
    ];

    defaultProducts.forEach(p => DB.addProduct(p));
}
