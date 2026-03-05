-- Supabase Schema for Reddyagency POS
-- Copy and paste this into the Supabase SQL Editor

-- 1. Create Profiles table (extends Supabase auth.users)
CREATE TABLE profiles (
    id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    role TEXT CHECK (role IN ('admin', 'staff')) DEFAULT 'staff',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Trigger to automatically create a profile when a new user signs up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, role)
  VALUES (new.id, new.email, 'staff'); -- Set default role to staff. Change to 'admin' manually for your first user.
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 2. Suppliers
CREATE TABLE suppliers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 3. Products
CREATE TABLE products (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT,
    cost_price NUMERIC NOT NULL,
    selling_price NUMERIC NOT NULL,
    stock_quantity INTEGER NOT NULL DEFAULT 0,
    unit TEXT,
    low_stock_threshold INTEGER DEFAULT 5,
    supplier_id UUID REFERENCES suppliers(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 4. Sales
CREATE TABLE sales (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    total_amount NUMERIC NOT NULL,
    total_profit NUMERIC NOT NULL,
    payment_method TEXT,
    created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 5. Sale Items
CREATE TABLE sale_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sale_id UUID REFERENCES sales(id) ON DELETE CASCADE,
    product_id UUID REFERENCES products(id) ON DELETE RESTRICT,
    quantity INTEGER NOT NULL,
    cost_price NUMERIC NOT NULL,
    selling_price NUMERIC NOT NULL
);

-- Optional: Enable Row Level Security (RLS) for all tables
-- For simplicity in a closed POS system, we allow all authenticated users to read/write.
-- You can tighten these policies later.
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE suppliers ENABLE ROW LEVEL SECURITY;
ALTER TABLE products ENABLE ROW LEVEL SECURITY;
ALTER TABLE sales ENABLE ROW LEVEL SECURITY;
ALTER TABLE sale_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow authenticated users full access to profiles" ON profiles FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access to suppliers" ON suppliers FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access to products" ON products FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access to sales" ON sales FOR ALL TO authenticated USING (true);
CREATE POLICY "Allow authenticated users full access to sale_items" ON sale_items FOR ALL TO authenticated USING (true);
