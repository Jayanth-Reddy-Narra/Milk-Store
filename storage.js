// Supabase Setup
// REPLACE THESE with your actual Supabase project URL and anon key
const SUPABASE_URL = "https://jrvyzzikpfaohjkypvmz.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_I9NalIe1-cp_-G_ZszMhLg_AO66KUwI";

const supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// State
let session = null;
let currentUserProfile = null;

// Temporary settings shim (since settings wasn't moved to DB yet)
let appSettings = {
    businessName: "Reddyagency",
    currency: "₹",
    privacyMode: false
};

// Data Access Object (Async)
const DB = {
    // ---- AUTH ----
    initAuth: async () => {
        if (!supabaseClient) return false;
        const { data, error } = await supabaseClient.auth.getSession();
        session = data.session;
        if (session) {
            await DB.fetchProfile(session.user.id);
        }

        supabaseClient.auth.onAuthStateChange(async (event, currentSession) => {
            session = currentSession;
            if (session) {
                await DB.fetchProfile(session.user.id);
            } else {
                currentUserProfile = null;
            }
        });
        return session;
    },
    login: async (email, password) => {
        return await supabaseClient.auth.signInWithPassword({ email, password });
    },
    logout: async () => {
        await supabaseClient.auth.signOut();
    },
    fetchProfile: async (userId) => {
        const { data, error } = await supabaseClient.from('profiles').select('*').eq('id', userId).single();
        if (data) currentUserProfile = data;
        return data;
    },
    getProfile: () => currentUserProfile,
    getSession: () => session,

    // ---- SETTINGS (Local for now, or could be moved to DB) ----
    getSettings: () => appSettings,
    saveSettings: (newSettings) => {
        appSettings = { ...appSettings, ...newSettings };
    },

    // ---- PRODUCTS ----
    getProducts: async () => {
        const { data, error } = await supabaseClient.from('products').select('*').order('name');
        return error ? [] : (data || []).map(p => ({
            ...p,
            costPrice: parseFloat(p.cost_price),
            sellingPrice: parseFloat(p.selling_price),
            stockQuantity: p.stock_quantity,
            lowStockThreshold: p.low_stock_threshold,
            supplierId: p.supplier_id
        }));
    },
    getProduct: async (id) => {
        const { data, error } = await supabaseClient.from('products').select('*').eq('id', id).single();
        if (error || !data) return null;
        return {
            ...data,
            costPrice: parseFloat(data.cost_price),
            sellingPrice: parseFloat(data.selling_price),
            stockQuantity: data.stock_quantity,
            lowStockThreshold: data.low_stock_threshold,
            supplierId: data.supplier_id
        };
    },
    addProduct: async (product) => {
        const payload = {
            name: product.name,
            category: product.category,
            unit: product.unit,
            cost_price: product.costPrice,
            selling_price: product.sellingPrice,
            stock_quantity: product.stockQuantity,
            low_stock_threshold: product.lowStockThreshold,
            supplier_id: product.supplierId
        };
        const { data, error } = await supabaseClient.from('products').insert([payload]).select().single();
        return error ? null : data;
    },
    updateProduct: async (id, updates) => {
        const payload = {};
        if (updates.name !== undefined) payload.name = updates.name;
        if (updates.category !== undefined) payload.category = updates.category;
        if (updates.unit !== undefined) payload.unit = updates.unit;
        if (updates.costPrice !== undefined) payload.cost_price = updates.costPrice;
        if (updates.sellingPrice !== undefined) payload.selling_price = updates.sellingPrice;
        if (updates.stockQuantity !== undefined) payload.stock_quantity = updates.stockQuantity;
        if (updates.lowStockThreshold !== undefined) payload.low_stock_threshold = updates.lowStockThreshold;
        if (updates.supplierId !== undefined) payload.supplier_id = updates.supplierId;
        payload.updated_at = new Date().toISOString();

        const { error } = await supabaseClient.from('products').update(payload).eq('id', id);
        return !error;
    },
    deleteProduct: async (id) => {
        await supabaseClient.from('products').delete().eq('id', id);
    },
    adjustStock: async (id, qtyChange) => {
        // Safe atomic RPC or just basic select/update since we run POS locally
        const product = await DB.getProduct(id);
        if (product && product.stockQuantity + qtyChange >= 0) {
            await DB.updateProduct(id, { stockQuantity: product.stockQuantity + qtyChange });
            return true;
        }
        return false;
    },

    // ---- SALES ----
    getSales: async () => {
        const { data, error } = await supabaseClient.from('sales').select('*, sale_items(*)').order('created_at', { ascending: false });
        if (error) return [];
        return data.map(sale => ({
            id: sale.id,
            totalAmount: parseFloat(sale.total_amount),
            totalProfit: parseFloat(sale.total_profit),
            paymentMethod: sale.payment_method,
            createdAt: sale.created_at,
            items: sale.sale_items.map(i => ({
                productId: i.product_id,
                quantity: i.quantity,
                costPrice: parseFloat(i.cost_price),
                sellingPrice: parseFloat(i.selling_price)
            }))
        }));
    },
    addSale: async (saleData) => {
        // Validate stock
        for (let item of saleData.items) {
            const product = await DB.getProduct(item.productId);
            if (!product || product.stockQuantity < item.quantity) {
                return { success: false, message: `Insufficient stock for a selected item.` };
            }
        }

        // Create Sale
        const salePayload = {
            total_amount: saleData.totalAmount,
            total_profit: saleData.totalProfit,
            payment_method: saleData.paymentMethod,
            created_by: session ? session.user.id : null
        };

        const { data: saleRow, error: saleError } = await supabaseClient.from('sales').insert([salePayload]).select().single();
        if (saleError) return { success: false, message: saleError.message };

        // Create Sale Items
        const itemsPayload = saleData.items.map(item => ({
            sale_id: saleRow.id,
            product_id: item.productId,
            quantity: item.quantity,
            cost_price: item.costPrice,
            selling_price: item.sellingPrice
        }));

        await supabaseClient.from('sale_items').insert(itemsPayload);

        // Deduct stock
        for (let item of saleData.items) {
            await DB.adjustStock(item.productId, -item.quantity);
        }

        return { success: true, sale: saleRow };
    },
    deleteSale: async (id) => {
        // Fetch to get items for stock restoration
        const { data: sale } = await supabaseClient.from('sales').select('*, sale_items(*)').eq('id', id).single();
        if (!sale) return null;

        // Delete sale (Cascade deletes items)
        await supabaseClient.from('sales').delete().eq('id', id);

        // Restore stock
        for (let item of sale.sale_items) {
            await DB.adjustStock(item.product_id, item.quantity);
        }
        return sale;
    },
    undoDeleteSale: async (sale) => {
        // Simplified: Just recreating it as a new sale with old timestamp is tricky because of IDs, 
        // we'll just insert a brand new sale with the same data representing the restore
        const restoreData = {
            items: sale.sale_items.map(i => ({
                productId: i.product_id,
                quantity: i.quantity,
                costPrice: parseFloat(i.cost_price),
                sellingPrice: parseFloat(i.selling_price)
            })),
            totalAmount: parseFloat(sale.total_amount),
            totalProfit: parseFloat(sale.total_profit),
            paymentMethod: sale.payment_method
        };
        return (await DB.addSale(restoreData)).success;
    },

    // ---- SUPPLIERS ----
    getSuppliers: async () => {
        const { data, error } = await supabaseClient.from('suppliers').select('*').order('name');
        return error ? [] : (data || []);
    },
    addSupplier: async (supplier) => {
        await supabaseClient.from('suppliers').insert([supplier]);
    },
    updateSupplier: async (id, updates) => {
        await supabaseClient.from('suppliers').update(updates).eq('id', id);
    },
    deleteSupplier: async (id) => {
        await supabaseClient.from('suppliers').delete().eq('id', id);
    },

    // ---- DATA MANAGEMENT ----
    clearData: async () => {
        // Requires admin rights on RLS normally, but assuming admin role can
        if (currentUserProfile && currentUserProfile.role === 'admin') {
            await supabaseClient.from('sale_items').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabaseClient.from('sales').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabaseClient.from('products').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            await supabaseClient.from('suppliers').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        } else {
            alert('Only admins can clear data!');
        }
    }
};
