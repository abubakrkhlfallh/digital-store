// تكوين Supabase
const SUPABASE_URL = 'https://ltmwihqdyssjbdretlic.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0bXdpaHFkeXNzamJkcmV0bGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMTcyNjksImV4cCI6MjA4MTU5MzI2OX0.YRwds6d98JuQsM6nEw2dBP8VRMKuu0YfORkwB7s1gGw';

// تهيئة Supabase
const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// حالة التطبيق
let currentAdmin = null;
let products = [];
let customers = [];
let orders = [];

// عناصر DOM
const loginPage = document.getElementById('login-page');
const adminDashboard = document.getElementById('admin-dashboard');
const loginForm = document.getElementById('login-form');
const logoutBtn = document.getElementById('logout-btn');
const navLinks = document.querySelectorAll('.nav-links a');
const sectionContents = document.querySelectorAll('.section-content');
const currentSectionTitle = document.getElementById('current-section');

// تهيئة التطبيق
document.addEventListener('DOMContentLoaded', () => {
    checkAdminSession();
    setupEventListeners();
});

// التحقق من جلسة المسؤول
async function checkAdminSession() {
    const token = localStorage.getItem('admin_token');
    const adminData = localStorage.getItem('admin_data');
    
    if (token && adminData) {
        try {
            // التحقق من صحة التوكن مع Supabase
            const { data: { user }, error } = await supabase.auth.getUser(token);
            
            if (error) throw error;
            
            currentAdmin = JSON.parse(adminData);
            showAdminDashboard();
            loadDashboardData();
        } catch (error) {
            console.error('خطأ في التحقق من الجلسة:', error);
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_data');
        }
    }
}

// إعداد مستمعي الأحداث
function setupEventListeners() {
    // تسجيل الدخول
    loginForm.addEventListener('submit', handleLogin);
    
    // تسجيل الخروج
    logoutBtn.addEventListener('click', handleLogout);
    
    // التنقل بين الأقسام
    navLinks.forEach(link => {
        if (link.dataset.section) {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                switchSection(link.dataset.section);
            });
        }
    });
    
    // زر تبديل الشريط الجانبي
    document.querySelector('.toggle-sidebar').addEventListener('click', () => {
        document.querySelector('.sidebar').classList.toggle('active');
    });
    
    // إضافة منتج
    document.getElementById('add-product-btn').addEventListener('click', () => {
        showProductModal();
    });
    
    // إضافة عميل
    document.getElementById('add-customer-btn').addEventListener('click', () => {
        showCustomerModal();
    });
    
    // إغلاق النماذج
    document.getElementById('close-product-modal').addEventListener('click', () => {
        document.getElementById('product-modal').style.display = 'none';
    });
    
    document.getElementById('close-customer-modal').addEventListener('click', () => {
        document.getElementById('customer-modal').style.display = 'none';
    });
    
    // حفظ المنتج
    document.getElementById('product-form').addEventListener('submit', handleAddProduct);
    
    // حفظ العميل
    document.getElementById('customer-form').addEventListener('submit', handleAddCustomer);
    
    // تصفية الطلبات
    document.getElementById('order-filter').addEventListener('change', loadOrders);
    
    // تحديث الملف الشخصي
    document.getElementById('profile-form').addEventListener('submit', updateProfile);
    
    // تغيير كلمة المرور
    document.getElementById('password-form').addEventListener('submit', changePassword);
    
    // إعدادات المتجر
    document.getElementById('store-settings-form').addEventListener('submit', saveStoreSettings);
    
    // إعدادات الدفع
    document.getElementById('payment-settings-form').addEventListener('submit', savePaymentSettings);
}

// معالجة تسجيل الدخول
async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('abubakrkhlfallh@gmail.com').value;
    const password = document.getElementById('Abubakrkhlfallh#.7').value;
    
    try {
        // في بيئة الإنتاج، استخدم مصادقة Supabase
        // هذا مثال للتوضيح فقط
        const { data, error } = await supabase
            .from('admins')
            .select('*')
            .eq('email', email)
            .single();
        
        if (error) throw error;
        
        // التحقق من كلمة المرور (في الإنتاج استخدم bcrypt)
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
            email,
            password
        });
        
        if (authError) throw authError;
        
        currentAdmin = {
            id: data.id,
            email: data.email,
            full_name: data.full_name,
            phone: data.phone
        };
        
        // حفظ الجلسة
        localStorage.setItem('admin_token', authData.session.access_token);
        localStorage.setItem('admin_data', JSON.stringify(currentAdmin));
        
        showAdminDashboard();
        loadDashboardData();
        
        Swal.fire({
            icon: 'success',
            title: 'تم تسجيل الدخول بنجاح',
            text: 'مرحباً بك في لوحة التحكم',
            timer: 2000
        });
        
    } catch (error) {
        console.error('خطأ في تسجيل الدخول:', error);
        document.getElementById('login-error').style.display = 'block';
        document.getElementById('error-text').textContent = 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
    }
}

// تسجيل الخروج
function handleLogout() {
    Swal.fire({
        title: 'تأكيد تسجيل الخروج',
        text: 'هل أنت متأكد من تسجيل الخروج؟',
        icon: 'question',
        showCancelButton: true,
        confirmButtonText: 'نعم، سجل الخروج',
        cancelButtonText: 'إلغاء'
    }).then((result) => {
        if (result.isConfirmed) {
            localStorage.removeItem('admin_token');
            localStorage.removeItem('admin_data');
            currentAdmin = null;
            adminDashboard.style.display = 'none';
            loginPage.style.display = 'flex';
        }
    });
}

// عرض لوحة التحكم
function showAdminDashboard() {
    loginPage.style.display = 'none';
    adminDashboard.style.display = 'flex';
    
    // تحديث بيانات المسؤول
    document.getElementById('admin-name').textContent = currentAdmin.full_name;
    document.getElementById('admin-email').textContent = currentAdmin.email;
    document.getElementById('admin-avatar').textContent = currentAdmin.full_name.charAt(0);
}

// تحميل بيانات لوحة التحكم
async function loadDashboardData() {
    try {
        // تحميل الإحصائيات
        const [customersData, ordersData, productsData] = await Promise.all([
            supabase.from('customers').select('*'),
            supabase.from('orders').select('*'),
            supabase.from('digital_products').select('*')
        ]);
        
        customers = customersData.data || [];
        orders = ordersData.data || [];
        products = productsData.data || [];
        
        // تحديث الإحصائيات
        document.getElementById('total-customers').textContent = customers.length;
        document.getElementById('total-orders').textContent = orders.length;
        document.getElementById('total-products').textContent = products.length;
        
        // حساب الإيرادات
        const totalRevenue = orders
            .filter(order => order.payment_status === 'paid')
            .reduce((sum, order) => sum + parseFloat(order.total_amount), 0);
        
        document.getElementById('total-revenue').textContent = `$${totalRevenue.toFixed(2)}`;
        
        // تحديث آخر الطلبات
        updateRecentOrders();
        
        // تحميل البيانات حسب القسم الحالي
        const currentSection = document.querySelector('.nav-links a.active').dataset.section;
        switch(currentSection) {
            case 'customers':
                loadCustomers();
                break;
            case 'orders':
                loadOrders();
                break;
            case 'reports':
                loadReports();
                break;
            case 'products':
                loadProducts();
                break;
        }
        
    } catch (error) {
        console.error('خطأ في تحميل البيانات:', error);
    }
}

// التبديل بين الأقسام
function switchSection(section) {
    // تحديث القائمة النشطة
    navLinks.forEach(link => {
        link.classList.remove('active');
        if (link.dataset.section === section) {
            link.classList.add('active');
        }
    });
    
    // إخفاء جميع الأقسام
    sectionContents.forEach(content => {
        content.style.display = 'none';
    });
    
    // إظهار القسم المحدد
    const targetSection = document.getElementById(`${section}-section`);
    if (targetSection) {
        targetSection.style.display = 'block';
    }
    
    // تحديث عنوان القسم
    const sectionTitles = {
        dashboard: 'لوحة التحكم',
        customers: 'إدارة العملاء',
        orders: 'إدارة الطلبات',
        reports: 'التقارير والإحصائيات',
        products: 'إدارة المنتجات',
        settings: 'الإعدادات'
    };
    
    currentSectionTitle.textContent = sectionTitles[section] || 'لوحة التحكم';
    
    // تحميل بيانات القسم
    switch(section) {
        case 'customers':
            loadCustomers();
            break;
        case 'orders':
            loadOrders();
            break;
        case 'reports':
            loadReports();
            break;
        case 'products':
            loadProducts();
            break;
    }
}

// تحديث أحدث الطلبات
function updateRecentOrders() {
    const tbody = document.querySelector('#recent-orders-table tbody');
    tbody.innerHTML = '';
    
    const recentOrders = orders
        .sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
        .slice(0, 5);
    
    recentOrders.forEach(order => {
        const row = document.createElement('tr');
        
        const statusBadge = getStatusBadge(order.status);
        const paymentBadge = getPaymentBadge(order.payment_status);
        
        row.innerHTML = `
            <td>${order.order_number}</td>
            <td>${order.customer_name}</td>
            <td>$${parseFloat(order.total_amount).toFixed(2)}</td>
            <td>${paymentBadge}</td>
            <td>${statusBadge}</td>
            <td>${new Date(order.created_at).toLocaleDateString('ar-SA')}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewOrder('${order.id}')">
                    <i class="fas fa-eye"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// تحميل العملاء
async function loadCustomers() {
    try {
        const { data, error } = await supabase
            .from('customers')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        customers = data || [];
        updateCustomersTable();
    } catch (error) {
        console.error('خطأ في تحميل العملاء:', error);
    }
}

// تحديث جدول العملاء
function updateCustomersTable() {
    const tbody = document.querySelector('#customers-table tbody');
    tbody.innerHTML = '';
    
    customers.forEach(customer => {
        const row = document.createElement('tr');
        
        const statusBadge = customer.is_active ? 
            '<span class="badge badge-success">نشط</span>' : 
            '<span class="badge badge-danger">غير نشط</span>';
        
        row.innerHTML = `
            <td>${customer.full_name}</td>
            <td>${customer.email}</td>
            <td>${customer.phone || 'غير محدد'}</td>
            <td>${new Date(customer.created_at).toLocaleDateString('ar-SA')}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="editCustomer('${customer.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteCustomer('${customer.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// تحميل الطلبات
async function loadOrders() {
    try {
        const filter = document.getElementById('order-filter').value;
        let query = supabase.from('orders').select('*');
        
        if (filter !== 'all') {
            query = query.eq('status', filter);
        }
        
        const { data, error } = await query.order('created_at', { ascending: false });
        
        if (error) throw error;
        
        orders = data || [];
        updateOrdersTable();
    } catch (error) {
        console.error('خطأ في تحميل الطلبات:', error);
    }
}

// تحديث جدول الطلبات
function updateOrdersTable() {
    const tbody = document.querySelector('#orders-table tbody');
    tbody.innerHTML = '';
    
    orders.forEach(order => {
        const row = document.createElement('tr');
        
        const statusBadge = getStatusBadge(order.status);
        const paymentBadge = getPaymentBadge(order.payment_status);
        
        row.innerHTML = `
            <td>${order.order_number}</td>
            <td>${order.customer_name}</td>
            <td>$${parseFloat(order.total_amount).toFixed(2)}</td>
            <td>${paymentBadge}</td>
            <td>${statusBadge}</td>
            <td>${new Date(order.created_at).toLocaleDateString('ar-SA')}</td>
            <td>
                <button class="btn btn-sm btn-primary" onclick="viewOrder('${order.id}')">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-success" onclick="updateOrderStatus('${order.id}', 'processing')">
                    <i class="fas fa-cog"></i>
                </button>
                <button class="btn btn-sm btn-warning" onclick="updateOrderStatus('${order.id}', 'completed')">
                    <i class="fas fa-check"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// تحميل التقارير
async function loadReports() {
    try {
        const today = new Date().toISOString().split('T')[0];
        const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1)
            .toISOString().split('T')[0];
        
        // مبيعات اليوم
        const { data: todaySales, error: todayError } = await supabase
            .from('orders')
            .select('total_amount')
            .eq('payment_status', 'paid')
            .gte('created_at', today);
        
        if (!todayError) {
            const todayRevenue = todaySales.reduce((sum, order) => 
                sum + parseFloat(order.total_amount), 0);
            document.getElementById('today-revenue').textContent = `$${todayRevenue.toFixed(2)}`;
        }
        
        // مبيعات الشهر
        const { data: monthSales, error: monthError } = await supabase
            .from('orders')
            .select('total_amount')
            .eq('payment_status', 'paid')
            .gte('created_at', firstDayOfMonth);
        
        if (!monthError) {
            const monthRevenue = monthSales.reduce((sum, order) => 
                sum + parseFloat(order.total_amount), 0);
            document.getElementById('month-revenue').textContent = `$${monthRevenue.toFixed(2)}`;
        }
        
        // متوسط قيمة الطلب
        const { data: allSales, error: allError } = await supabase
            .from('orders')
            .select('total_amount')
            .eq('payment_status', 'paid');
        
        if (!allError && allSales.length > 0) {
            const avgOrder = allSales.reduce((sum, order) => 
                sum + parseFloat(order.total_amount), 0) / allSales.length;
            document.getElementById('avg-order-value').textContent = `$${avgOrder.toFixed(2)}`;
        }
        
        // المنتج الأكثر مبيعاً
        const { data: topProduct, error: productError } = await supabase
            .from('order_items')
            .select('product_name, quantity')
            .order('quantity', { ascending: false })
            .limit(1);
        
        if (!productError && topProduct.length > 0) {
            document.getElementById('top-product-count').textContent = topProduct[0].product_name;
        }
        
        // إنشاء مخطط المبيعات
        createSalesChart();
        
    } catch (error) {
        console.error('خطأ في تحميل التقارير:', error);
    }
}

// إنشاء مخطط المبيعات
function createSalesChart() {
    const ctx = document.getElementById('sales-chart').getContext('2d');
    
    // بيانات نموذجية (في التطبيق الفعلي، استخدم بيانات حقيقية)
    const data = {
        labels: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو'],
        datasets: [{
            label: 'المبيعات الشهرية ($)',
            data: [1200, 1900, 1500, 2500, 2200, 3000],
            backgroundColor: 'rgba(67, 97, 238, 0.2)',
            borderColor: 'rgba(67, 97, 238, 1)',
            borderWidth: 2,
            tension: 0.4
        }]
    };
    
    new Chart(ctx, {
        type: 'line',
        data: data,
        options: {
            responsive: true,
            plugins: {
                legend: {
                    rtl: true,
                    labels: {
                        font: {
                            family: 'Cairo'
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true
                }
            }
        }
    });
}

// تحميل المنتجات
async function loadProducts() {
    try {
        const { data, error } = await supabase
            .from('digital_products')
            .select('*')
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        products = data || [];
        updateProductsTable();
    } catch (error) {
        console.error('خطأ في تحميل المنتجات:', error);
    }
}

// تحديث جدول المنتجات
function updateProductsTable() {
    const tbody = document.querySelector('#products-table tbody');
    tbody.innerHTML = '';
    
    products.forEach(product => {
        const row = document.createElement('tr');
        
        const statusBadge = product.is_active ? 
            '<span class="badge badge-success">نشط</span>' : 
            '<span class="badge badge-danger">غير نشط</span>';
        
        const image = product.preview_image_url ? 
            `<img src="${product.preview_image_url}" alt="${product.name}" style="width: 50px; height: 50px; object-fit: cover; border-radius: 8px;">` : 
            '<div style="width: 50px; height: 50px; background: #eee; border-radius: 8px; display: flex; align-items: center; justify-content: center;"><i class="fas fa-image"></i></div>';
        
        row.innerHTML = `
            <td>${image}</td>
            <td>${product.name}</td>
            <td>$${parseFloat(product.price).toFixed(2)}</td>
            <td>${product.category || 'غير محدد'}</td>
            <td>${product.download_count || 0}</td>
            <td>${statusBadge}</td>
            <td>
                <button class="btn btn-sm btn-warning" onclick="editProduct('${product.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteProduct('${product.id}')">
                    <i class="fas fa-trash"></i>
                </button>
                <button class="btn btn-sm btn-info" onclick="toggleProductStatus('${product.id}', ${!product.is_active})">
                    <i class="fas fa-power-off"></i>
                </button>
            </td>
        `;
        
        tbody.appendChild(row);
    });
}

// عرض نموذج إضافة منتج
function showProductModal(product = null) {
    const modal = document.getElementById('product-modal');
    const form = document.getElementById('product-form');
    const title = modal.querySelector('h3');
    
    if (product) {
        title.textContent = 'تعديل المنتج';
        document.getElementById('product-name').value = product.name;
        document.getElementById('product-description').value = product.description;
        document.getElementById('product-price').value = product.price;
        document.getElementById('product-category').value = product.category || 'برمجيات';
        document.getElementById('product-file-url').value = product.file_url || '';
        document.getElementById('product-image-url').value = product.preview_image_url || '';
        document.getElementById('product-stock').value = product.stock || -1;
        form.dataset.productId = product.id;
    } else {
        title.textContent = 'إضافة منتج جديد';
        form.reset();
        delete form.dataset.productId;
    }
    
    modal.style.display = 'flex';
}

// عرض نموذج إضافة عميل
function showCustomerModal(customer = null) {
    const modal = document.getElementById('customer-modal');
    const form = document.getElementById('customer-form');
    const title = modal.querySelector('h3');
    
    if (customer) {
        title.textContent = 'تعديل العميل';
        document.getElementById('customer-name').value = customer.full_name;
        document.getElementById('customer-email').value = customer.email;
        document.getElementById('customer-phone').value = customer.phone || '';
        document.getElementById('customer-country').value = customer.country || '';
        document.getElementById('customer-password').required = false;
        form.dataset.customerId = customer.id;
    } else {
        title.textContent = 'إضافة عميل جديد';
        form.reset();
        document.getElementById('customer-password').required = true;
        delete form.dataset.customerId;
    }
    
    modal.style.display = 'flex';
}

// إضافة/تعديل منتج
async function handleAddProduct(e) {
    e.preventDefault();
    
    const form = e.target;
    const productData = {
        name: document.getElementById('product-name').value,
        description: document.getElementById('product-description').value,
        price: parseFloat(document.getElementById('product-price').value),
        category: document.getElementById('product-category').value,
        file_url: document.getElementById('product-file-url').value || null,
        preview_image_url: document.getElementById('product-image-url').value || null,
        stock: parseInt(document.getElementById('product-stock').value) || -1,
        is_active: true
    };
    
    try {
        let result;
        
        if (form.dataset.productId) {
            // تعديل منتج موجود
            result = await supabase
                .from('digital_products')
                .update(productData)
                .eq('id', form.dataset.productId);
        } else {
            // إضافة منتج جديد
            result = await supabase
                .from('digital_products')
                .insert([productData]);
        }
        
        if (result.error) throw result.error;
        
        Swal.fire({
            icon: 'success',
            title: 'نجاح',
            text: form.dataset.productId ? 'تم تحديث المنتج بنجاح' : 'تم إضافة المنتج بنجاح',
            timer: 2000
        });
        
        document.getElementById('product-modal').style.display = 'none';
        loadProducts();
        loadDashboardData();
        
    } catch (error) {
        console.error('خطأ في حفظ المنتج:', error);
        Swal.fire({
            icon: 'error',
            title: 'خطأ',
            text: 'فشل في حفظ المنتج'
        });
    }
}

// إضافة/تعديل عميل
async function handleAddCustomer(e) {
    e.preventDefault();
    
    const form = e.target;
    const customerData = {
        full_name: document.getElementById('customer-name').value,
        email: document.getElementById('customer-email').value,
        phone: document.getElementById('customer-phone').value || null,
        country: document.getElementById('customer-country').value || null,
        is_active: true
    };
    
    try {
        if (form.dataset.customerId) {
            // تعديل عميل موجود
            const { error } = await supabase
                .from('customers')
                .update(customerData)
                .eq('id', form.dataset.customerId);
            
            if (error) throw error;
            
            Swal.fire({
                icon: 'success',
                title: 'نجاح',
                text: 'تم تحديث العميل بنجاح',
                timer: 2000
            });
            
        } else {
            // إضافة عميل جديد مع إنشاء حساب مصادقة
            const password = document.getElementById('customer-password').value;
            
            // إنشاء حساب مصادقة في Supabase
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email: customerData.email,
                password: password,
                options: {
                    data: {
                        full_name: customerData.full_name,
                        phone: customerData.phone,
                        role: 'customer'
                    }
                }
            });
            
            if (authError) throw authError;
            
            // إضافة إلى جدول العملاء
            customerData.id = authData.user.id;
            
            const { error } = await supabase
                .from('customers')
                .insert([customerData]);
            
            if (error) throw error;
            
            Swal.fire({
                icon: 'success',
                title: 'نجاح',
                text: 'تم إضافة العميل بنجاح',
                timer: 2000
            });
        }
        
        document.getElementById('customer-modal').style.display = 'none';
        loadCustomers();
        loadDashboardData();
        
    } catch (error) {
        console.error('خطأ في حفظ العميل:', error);
        Swal.fire({
            icon: 'error',
            title: 'خطأ',
            text: error.message || 'فشل في حفظ العميل'
        });
    }
}

// تحديث الملف الشخصي
async function updateProfile(e) {
    e.preventDefault();
    
    const profileData = {
        full_name: document.getElementById('profile-name').value,
        email: document.getElementById('profile-email').value,
        phone: document.getElementById('profile-phone').value
    };
    
    try {
        // تحديث بيانات المسؤول في قاعدة البيانات
        const { error } = await supabase
            .from('admins')
            .update(profileData)
            .eq('id', currentAdmin.id);
        
        if (error) throw error;
        
        // تحديث بيانات المصادقة
        const { error: authError } = await supabase.auth.updateUser({
            email: profileData.email,
            data: {
                full_name: profileData.full_name,
                phone: profileData.phone
            }
        });
        
        if (authError) throw authError;
        
        // تحديث البيانات المحلية
        currentAdmin = { ...currentAdmin, ...profileData };
        localStorage.setItem('admin_data', JSON.stringify(currentAdmin));
        
        // تحديث العرض
        document.getElementById('admin-name').textContent = currentAdmin.full_name;
        document.getElementById('admin-email').textContent = currentAdmin.email;
        
        Swal.fire({
            icon: 'success',
            title: 'نجاح',
            text: 'تم تحديث الملف الشخصي بنجاح',
            timer: 2000
        });
        
    } catch (error) {
        console.error('خطأ في تحديث الملف الشخصي:', error);
        Swal.fire({
            icon: 'error',
            title: 'خطأ',
            text: 'فشل في تحديث الملف الشخصي'
        });
    }
}

// تغيير كلمة المرور
async function changePassword(e) {
    e.preventDefault();
    
    const currentPassword = document.getElementById('current-password').value;
    const newPassword = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('confirm-password').value;
    
    if (newPassword !== confirmPassword) {
        Swal.fire({
            icon: 'error',
            title: 'خطأ',
            text: 'كلمة المرور الجديدة غير متطابقة'
        });
        return;
    }
    
    if (newPassword.length < 6) {
        Swal.fire({
            icon: 'error',
            title: 'خطأ',
            text: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل'
        });
        return;
    }
    
    try {
        // تغيير كلمة المرور في Supabase Auth
        const { error } = await supabase.auth.updateUser({
            password: newPassword
        });
        
        if (error) throw error;
        
        // تحديث كلمة المرور في جدول المسؤولين
        const { error: dbError } = await supabase
            .from('admins')
            .update({ 
                password_hash: newPassword // في الإنتاج، قم بتشفير كلمة المرور
            })
            .eq('id', currentAdmin.id);
        
        if (dbError) throw dbError;
        
        Swal.fire({
            icon: 'success',
            title: 'نجاح',
            text: 'تم تغيير كلمة المرور بنجاح',
            timer: 2000
        });
        
        document.getElementById('password-form').reset();
        
    } catch (error) {
        console.error('خطأ في تغيير كلمة المرور:', error);
        Swal.fire({
            icon: 'error',
            title: 'خطأ',
            text: 'فشل في تغيير كلمة المرور'
        });
    }
}

// حفظ إعدادات المتجر
async function saveStoreSettings(e) {
    e.preventDefault();
    
    const settings = {
        store_name: document.getElementById('store-name').value,
        currency: document.getElementById('store-currency').value,
        tax_rate: parseFloat(document.getElementById('store-tax').value) || 0
    };
    
    try {
        // حفظ في LocalStorage كمثال
        localStorage.setItem('store_settings', JSON.stringify(settings));
        
        Swal.fire({
            icon: 'success',
            title: 'نجاح',
            text: 'تم حفظ إعدادات المتجر بنجاح',
            timer: 2000
        });
        
    } catch (error) {
        console.error('خطأ في حفظ الإعدادات:', error);
        Swal.fire({
            icon: 'error',
            title: 'خطأ',
            text: 'فشل في حفظ الإعدادات'
        });
    }
}

// حفظ إعدادات الدفع
async function savePaymentSettings(e) {
    e.preventDefault();
    
    const settings = {
        paypal_client_id: document.getElementById('paypal-client-id').value,
        paypal_mode: document.getElementById('paypal-mode').value,
        enable_paypal: document.getElementById('enable-paypal').checked
    };
    
    try {
        // حفظ في LocalStorage كمثال
        localStorage.setItem('payment_settings', JSON.stringify(settings));
        
        Swal.fire({
            icon: 'success',
            title: 'نجاح',
            text: 'تم حفظ إعدادات الدفع بنجاح',
            timer: 2000
        });
        
    } catch (error) {
        console.error('خطأ في حفظ إعدادات الدفع:', error);
        Swal.fire({
            icon: 'error',
            title: 'خطأ',
            text: 'فشل في حفظ إعدادات الدفع'
        });
    }
}

// وظائف مساعدة
function getStatusBadge(status) {
    const badges = {
        pending: '<span class="badge badge-warning">قيد الانتظار</span>',
        processing: '<span class="badge badge-info">قيد المعالجة</span>',
        completed: '<span class="badge badge-success">مكتمل</span>',
        cancelled: '<span class="badge badge-danger">ملغي</span>'
    };
    
    return badges[status] || '<span class="badge badge-secondary">غير معروف</span>';
}

function getPaymentBadge(status) {
    const badges = {
        pending: '<span class="badge badge-warning">قيد الانتظار</span>',
        paid: '<span class="badge badge-success">مدفوع</span>',
        failed: '<span class="badge badge-danger">فشل</span>',
        refunded: '<span class="badge badge-info">معاد</span>'
    };
    
    return badges[status] || '<span class="badge badge-secondary">غير معروف</span>';
}

// وظائف الإجراءات (للاستخدام في onClick)
window.editProduct = async function(productId) {
    const product = products.find(p => p.id === productId);
    if (product) {
        showProductModal(product);
    }
};

window.deleteProduct = async function(productId) {
    Swal.fire({
        title: 'تأكيد الحذف',
        text: 'هل أنت متأكد من حذف هذا المنتج؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، احذف',
        cancelButtonText: 'إلغاء'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const { error } = await supabase
                    .from('digital_products')
                    .delete()
                    .eq('id', productId);
                
                if (error) throw error;
                
                Swal.fire({
                    icon: 'success',
                    title: 'تم الحذف',
                    text: 'تم حذف المنتج بنجاح',
                    timer: 2000
                });
                
                loadProducts();
                loadDashboardData();
                
            } catch (error) {
                console.error('خطأ في حذف المنتج:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'خطأ',
                    text: 'فشل في حذف المنتج'
                });
            }
        }
    });
};

window.toggleProductStatus = async function(productId, newStatus) {
    try {
        const { error } = await supabase
            .from('digital_products')
            .update({ is_active: newStatus })
            .eq('id', productId);
        
        if (error) throw error;
        
        Swal.fire({
            icon: 'success',
            title: 'تم التحديث',
            text: `تم ${newStatus ? 'تفعيل' : 'تعطيل'} المنتج بنجاح`,
            timer: 2000
        });
        
        loadProducts();
        
    } catch (error) {
        console.error('خطأ في تغيير حالة المنتج:', error);
        Swal.fire({
            icon: 'error',
            title: 'خطأ',
            text: 'فشل في تغيير حالة المنتج'
        });
    }
};

window.editCustomer = async function(customerId) {
    const customer = customers.find(c => c.id === customerId);
    if (customer) {
        showCustomerModal(customer);
    }
};

window.deleteCustomer = async function(customerId) {
    Swal.fire({
        title: 'تأكيد الحذف',
        text: 'هل أنت متأكد من حذف هذا العميل؟',
        icon: 'warning',
        showCancelButton: true,
        confirmButtonText: 'نعم، احذف',
        cancelButtonText: 'إلغاء'
    }).then(async (result) => {
        if (result.isConfirmed) {
            try {
                const { error } = await supabase
                    .from('customers')
                    .delete()
                    .eq('id', customerId);
                
                if (error) throw error;
                
                Swal.fire({
                    icon: 'success',
                    title: 'تم الحذف',
                    text: 'تم حذف العميل بنجاح',
                    timer: 2000
                });
                
                loadCustomers();
                loadDashboardData();
                
            } catch (error) {
                console.error('خطأ في حذف العميل:', error);
                Swal.fire({
                    icon: 'error',
                    title: 'خطأ',
                    text: 'فشل في حذف العميل'
                });
            }
        }
    });
};

window.viewOrder = async function(orderId) {
    try {
        const { data: order, error } = await supabase
            .from('orders')
            .select(`
                *,
                order_items (*)
            `)
            .eq('id', orderId)
            .single();
        
        if (error) throw error;
        
        // إنشاء محتوى التفاصيل
        let itemsHtml = '';
        if (order.order_items && order.order_items.length > 0) {
            itemsHtml = order.order_items.map(item => `
                <tr>
                    <td>${item.product_name}</td>
                    <td>${item.quantity}</td>
                    <td>$${parseFloat(item.unit_price).toFixed(2)}</td>
                    <td>$${parseFloat(item.total_price).toFixed(2)}</td>
                </tr>
            `).join('');
        }
        
        const modalContent = `
            <div style="text-align: right; direction: rtl;">
                <h3>تفاصيل الطلب #${order.order_number}</h3>
                <div style="margin-bottom: 20px;">
                    <p><strong>العميل:</strong> ${order.customer_name}</p>
                    <p><strong>البريد الإلكتروني:</strong> ${order.customer_email}</p>
                    <p><strong>التاريخ:</strong> ${new Date(order.created_at).toLocaleString('ar-SA')}</p>
                    <p><strong>حالة الطلب:</strong> ${getStatusBadge(order.status)}</p>
                    <p><strong>حالة الدفع:</strong> ${getPaymentBadge(order.payment_status)}</p>
                    <p><strong>طريقة الدفع:</strong> ${order.payment_method || 'غير محدد'}</p>
                    <p><strong>المبلغ الإجمالي:</strong> $${parseFloat(order.total_amount).toFixed(2)}</p>
                </div>
                
                <h4>المنتجات المطلوبة</h4>
                <table style="width: 100%; border-collapse: collapse; margin-top: 10px;">
                    <thead>
                        <tr style="background: #f8f9fa;">
                            <th style="padding: 10px; border: 1px solid #ddd;">المنتج</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">الكمية</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">سعر الوحدة</th>
                            <th style="padding: 10px; border: 1px solid #ddd;">المجموع</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${itemsHtml}
                    </tbody>
                </table>
            </div>
        `;
        
        Swal.fire({
            title: `الطلب #${order.order_number}`,
            html: modalContent,
            width: 700,
            showCloseButton: true,
            showConfirmButton: false
        });
        
    } catch (error) {
        console.error('خطأ في تحميل تفاصيل الطلب:', error);
        Swal.fire({
            icon: 'error',
            title: 'خطأ',
            text: 'فشل في تحميل تفاصيل الطلب'
        });
    }
};

window.updateOrderStatus = async function(orderId, newStatus) {
    try {
        const { error } = await supabase
            .from('orders')
            .update({ status: newStatus })
            .eq('id', orderId);
        
        if (error) throw error;
        
        Swal.fire({
            icon: 'success',
            title: 'تم التحديث',
            text: 'تم تحديث حالة الطلب بنجاح',
            timer: 2000
        });
        
        loadOrders();
        loadDashboardData();
        
    } catch (error) {
        console.error('خطأ في تحديث حالة الطلب:', error);
        Swal.fire({
            icon: 'error',
            title: 'خطأ',
            text: 'فشل في تحديث حالة الطلب'
        });
    }
};