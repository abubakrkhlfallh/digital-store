// تكوين Supabase مع RLS
const SUPABASE_URL = 'https://ltmwihqdyssjbdretlic.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0bXdpaHFkeXNzamJkcmV0bGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMTcyNjksImV4cCI6MjA4MTU5MzI2OX0.YRwds6d98JuQsM6nEw2dBP8VRMKuu0YfORkwB7s1gGw';
const SUPABASE_SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0bXdpaHFkeXNzamJkcmV0bGljIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NjAxNzI2OSwiZXhwIjoyMDgxNTkzMjY5fQ.g4VVRC9NLmUuvVAFxCtmID39sc-HRlR0XnK2FXI-3rU'; // للعمليات الخاصة بالمسؤول

// إنشاء عميلين: واحد للعميل العادي وواحد للمسؤول
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
const adminSupabase = supabase.createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// دالة للتحقق من RLS
async function checkRLS() {
    try {
        // محاولة قراءة بيانات بدون تسجيل دخول
        const { error } = await supabase
            .from('admins')
            .select('count')
            .limit(1);
        
        if (error && error.message.includes('row-level security')) {
            console.log('✅ RLS مفعل بشكل صحيح');
            return true;
        }
        
        console.warn('⚠️  قد يكون هناك مشكلة في إعدادات RLS');
        return false;
        
    } catch (error) {
        console.error('❌ خطأ في التحقق من RLS:', error);
        return false;
    }
}

// دالة للتحقق من صلاحيات المسؤول
async function checkAdminPermissions() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return false;
    
    try {
        // محاولة الوصول إلى جدول المسؤولين
        const { data, error } = await supabase
            .from('admins')
            .select('id')
            .eq('id', user.id)
            .single();
        
        if (error) {
            if (error.code === 'PGRST116') {
                // المستخدم ليس مسؤولاً
                return false;
            }
            throw error;
        }
        
        return true;
        
    } catch (error) {
        console.error('Error checking admin permissions:', error);
        return false;
    }
}

// دالة آمنة لحذف المستخدمين (للمسؤولين فقط)
async function deleteUser(userId) {
    const isAdmin = await checkAdminPermissions();
    
    if (!isAdmin) {
        throw new Error('غير مصرح لهذا الإجراء');
    }
    
    try {
        // استخدام عميل المسؤول لتجاوز RLS
        const { error } = await adminSupabase
            .from('customers')
            .delete()
            .eq('id', userId);
        
        if (error) throw error;
        
        return true;
        
    } catch (error) {
        console.error('Error deleting user:', error);
        throw error;
    }
}

// دالة آمنة لإنشاء تقرير (للمسؤولين فقط)
async function generateReport(startDate, endDate) {
    const isAdmin = await checkAdminPermissions();
    
    if (!isAdmin) {
        throw new Error('غير مصرح لهذا الإجراء');
    }
    
    try {
        const { data, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (*),
                customers (full_name, email)
            `)
            .gte('created_at', startDate)
            .lte('created_at', endDate);
        
        if (error) throw error;
        
        return data;
        
    } catch (error) {
        console.error('Error generating report:', error);
        throw error;
    }
}

// دالة للتحقق من صلاحية التنزيل
async function validateDownload(downloadKey) {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
        throw new Error('يجب تسجيل الدخول');
    }
    
    try {
        const { data: orderItem, error } = await supabase
            .from('order_items')
            .select(`
                *,
                orders!inner (
                    customer_id,
                    payment_status
                )
            `)
            .eq('download_key', downloadKey)
            .single();
        
        if (error) throw error;
        
        // التحقق من ملكية المستخدم للطلب
        if (orderItem.orders.customer_id !== user.id) {
            throw new Error('غير مصرح بالوصول إلى هذا الملف');
        }
        
        // التحقق من حالة الدفع
        if (orderItem.orders.payment_status !== 'paid') {
            throw new Error('لم يتم الدفع لهذا الطلب');
        }
        
        // التحقق من صلاحية التنزيل
        if (orderItem.download_expiry && orderItem.download_expiry < new Date()) {
            throw new Error('انتهت صلاحية رابط التنزيل');
        }
        
        // التحقق من الحد الأقصى للتنزيلات
        if (orderItem.download_count >= orderItem.max_downloads) {
            throw new Error('تم تجاوز الحد الأقصى لعدد التنزيلات');
        }
        
        return orderItem;
        
    } catch (error) {
        console.error('Error validating download:', error);
        throw error;
    }
}

// دالة لتسجيل التنزيل
async function logDownload(orderItemId, ipAddress = '', userAgent = '') {
    const { data: { user } } = await supabase.auth.getUser();
    
    try {
        const { data, error } = await supabase
            .from('downloads')
            .insert([{
                customer_id: user.id,
                order_item_id: orderItemId,
                product_id: null, // سيتم ملؤه بالترتيجر
                ip_address: ipAddress,
                user_agent: userAgent
            }])
            .select()
            .single();
        
        if (error) throw error;
        
        return data;
        
    } catch (error) {
        console.error('Error logging download:', error);
        throw error;
    }
}

// مثال لاستخدام الدوال في واجهة المستخدم
async function downloadProduct(productId) {
    try {
        // الحصول على مفتاح التنزيل
        const { data: orderItem } = await supabase
            .from('order_items')
            .select('download_key')
            .eq('product_id', productId)
            .single();
        
        if (!orderItem) {
            throw new Error('لم تقم بشراء هذا المنتج');
        }
        
        // التحقق من صلاحية التنزيل
        const validatedItem = await validateDownload(orderItem.download_key);
        
        // تسجيل التنزيل
        await logDownload(validatedItem.id);
        
        // إعادة رابط التنزيل
        return validatedItem.download_url;
        
    } catch (error) {
        console.error('Error downloading product:', error);
        showError(error.message);
    }
}

// إعداد مصادقة مع RLS
async function setupAuthWithRLS() {
    // الاستماع لتغيرات حالة المصادقة
    supabase.auth.onAuthStateChange((event, session) => {
        if (event === 'SIGNED_IN') {
            console.log('✅ تم تسجيل الدخول، RLS نشط');
            
            // تحديث واجهة المستخدم بناءً على الصلاحيات
            updateUIWithPermissions();
        } else if (event === 'SIGNED_OUT') {
            console.log('🚪 تم تسجيل الخروج');
            
            // إعادة تعيين واجهة المستخدم
            resetUIForGuest();
        }
    });
}

// تحديث واجهة المستخدم بناءً على الصلاحيات
async function updateUIWithPermissions() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return;
    
    // التحقق من صلاحيات المسؤول
    const isAdmin = await checkAdminPermissions();
    
    if (isAdmin) {
        // إظهار عناصر لوحة التحكم للمسؤولين
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'block';
        });
        
        // تحميل بيانات المسؤول
        loadAdminData();
    } else {
        // إظهار عناصر المستخدم العادي
        document.querySelectorAll('.user-only').forEach(el => {
            el.style.display = 'block';
        });
        
        // إخفاء عناصر المسؤول
        document.querySelectorAll('.admin-only').forEach(el => {
            el.style.display = 'none';
        });
    }
}

// إعادة تعيين واجهة المستخدم للزوار
function resetUIForGuest() {
    document.querySelectorAll('.admin-only, .user-only').forEach(el => {
        el.style.display = 'none';
    });
    
    document.querySelectorAll('.guest-only').forEach(el => {
        el.style.display = 'block';
    });
}

// تحميل بيانات المسؤول
async function loadAdminData() {
    try {
        // هذه الاستعلامات تعمل فقط للمسؤولين بسبب RLS
        const [customers, orders, products] = await Promise.all([
            supabase.from('customers').select('*'),
            supabase.from('orders').select('*'),
            supabase.from('digital_products').select('*')
        ]);
        
        console.log('📊 بيانات المسؤول محملة بنجاح:', {
            customers: customers.data?.length,
            orders: orders.data?.length,
            products: products.data?.length
        });
        
    } catch (error) {
        console.error('❌ خطأ في تحميل بيانات المسؤول:', error);
    }
}

// تهيئة التطبيق مع RLS
document.addEventListener('DOMContentLoaded', async () => {
    // التحقق من RLS
    await checkRLS();
    
    // إعداد المصادقة
    await setupAuthWithRLS();
    
    // التحقق من الجلسة الحالية
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
        await updateUIWithPermissions();
    } else {
        resetUIForGuest();
    }
});

// تصدير الدوال للاستخدام
window.SupabaseRLS = {
    checkAdminPermissions,
    deleteUser,
    generateReport,
    downloadProduct,
    validateDownload
};
