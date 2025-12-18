-- ============================================
-- إعدادات المصادقة المتقدمة
-- ============================================

-- تحديث سياسات المصادقة الافتراضية
ALTER TABLE auth.users ENABLE ROW LEVEL SECURITY;

-- إعداد التحقق من البريد الإلكتروني
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'abubakrkhlfallh@gmail.com';

-- ============================================
-- إنشاء وظائف مساعدة للمصادقة
-- ============================================

-- دالة للتحقق من تأكيد البريد الإلكتروني
CREATE OR REPLACE FUNCTION public.check_email_verified()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN (
        SELECT email_confirmed_at IS NOT NULL 
        FROM auth.users 
        WHERE id = auth.uid()
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- دالة للحصول على معلومات المستخدم الكاملة
CREATE OR REPLACE FUNCTION public.get_user_profile()
RETURNS TABLE (
    user_id UUID,
    email VARCHAR,
    email_verified BOOLEAN,
    full_name VARCHAR,
    phone VARCHAR,
    role VARCHAR,
    created_at TIMESTAMP
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        u.id as user_id,
        u.email,
        (u.email_confirmed_at IS NOT NULL) as email_verified,
        COALESCE(c.full_name, a.full_name) as full_name,
        COALESCE(c.phone, a.phone) as phone,
        CASE 
            WHEN a.id IS NOT NULL THEN 'admin'
            ELSE 'customer'
        END as role,
        u.created_at
    FROM auth.users u
    LEFT JOIN customers c ON c.id = u.id
    LEFT JOIN admins a ON a.id = u.id
    WHERE u.id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- سياسات RLS إضافية
-- ============================================

-- سياسات للوصول إلى البيانات المشتركة
CREATE POLICY "الوصول إلى البيانات المشتركة" ON customers
    FOR SELECT
    USING (
        id = auth.uid() OR 
        EXISTS (
            SELECT 1 FROM admins 
            WHERE id = auth.uid() AND is_active = true
        )
    );

-- سياسة للوظائف المخزنة
GRANT EXECUTE ON FUNCTION get_user_profile TO authenticated;
GRANT EXECUTE ON FUNCTION check_email_verified TO authenticated;

-- ============================================
-- إعدادات الأداء
-- ============================================

-- تحسين أداء الاستعلامات الشائعة
ANALYZE admins;
ANALYZE customers;
ANALYZE orders;
ANALYZE digital_products;

-- إنشاء فهارس إضافية للأداء
CREATE INDEX IF NOT EXISTS idx_orders_payment_created ON orders(payment_status, created_at);
CREATE INDEX IF NOT EXISTS idx_products_active_category ON digital_products(is_active, category);
CREATE INDEX IF NOT EXISTS idx_customers_active_email ON customers(is_active, email);

-- ============================================
-- إعدادات النسخ الاحتياطي
-- ============================================

-- إنشاء جدول للنسخ الاحتياطي
CREATE TABLE IF NOT EXISTS backup_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    backup_type VARCHAR(50),
    tables_count INTEGER,
    total_records INTEGER,
    file_size BIGINT,
    status VARCHAR(20) DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT NOW(),
    completed_at TIMESTAMP,
    metadata JSONB
);

-- سياسات RLS لجدول النسخ الاحتياطي
ALTER TABLE backup_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "المسؤولون فقط يمكنهم الوصول لسجلات النسخ" ON backup_logs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE id = auth.uid() AND is_active = true
        )
    );

-- ============================================
-- إعدادات المراقبة
-- ============================================

-- إنشاء جدول لسجلات الأداء
CREATE TABLE IF NOT EXISTS performance_logs (
    id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
    endpoint VARCHAR(500),
    response_time_ms INTEGER,
    status_code INTEGER,
    user_id UUID,
    ip_address INET,
    user_agent TEXT,
    created_at TIMESTAMP DEFAULT NOW()
);

-- سياسات RLS لسجلات الأداء
ALTER TABLE performance_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "المسؤولون فقط يمكنهم رؤية سجلات الأداء" ON performance_logs
    FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM admins 
            WHERE id = auth.uid() AND is_active = true
        )
    );
