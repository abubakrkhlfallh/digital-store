// تهيئة Supabase
const SUPABASE_URL = 'https://ltmwihqdyssjbdretlic.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx0bXdpaHFkeXNzamJkcmV0bGljIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjYwMTcyNjksImV4cCI6MjA4MTU5MzI2OX0.YRwds6d98JuQsM6nEw2dBP8VRMKuu0YfORkwB7s1gGw';

const supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// حالة التطبيق
let currentUser = null;
let products = [];
let cart = [];
let currentProductPage = 1;
const productsPerPage = 12;

// تهيئة التطبيق
document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

async function initApp() {
    await checkAuth();
    await loadProducts();
    loadCart();
    setupEventListeners();
    updateUI();
}

// التحقق من المصادقة
async function checkAuth() {
    const { data: { user } } = await supabase.auth.getUser();
    
    if (user) {
        currentUser = user;
        
        // تحميل بيانات المستخدم الإضافية
        const { data: userData } = await supabase
            .from('customers')
            .select('*')
            .eq('id', user.id)
            .single();
            
        if (userData) {
            currentUser.profile = userData;
        }
    }
}

// تحميل المنتجات
async function loadProducts() {
    try {
        const { data, error } = await supabase
            .from('digital_products')
            .select('*')
            .eq('is_active', true)
            .order('created_at', { ascending: false });
        
        if (error) throw error;
        
        products = data || [];
        displayProducts(products.slice(0, productsPerPage));
        
    } catch (error) {
        console.error('Error loading products:', error);
        showError('فشل في تحميل المنتجات');
    }
}

// عرض المنتجات
function displayProducts(productsToShow) {
    const container = document.getElementById('products-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    productsToShow.forEach(product => {
        const productCard = createProductCard(product);
        container.appendChild(productCard);
    });
}

// إنشاء بطاقة منتج
function createProductCard(product) {
    const card = document.createElement('div');
    card.className = 'product-card';
    
    card.innerHTML = `
        <div class="product-image">
            <img src="${product.preview_image_url || 'assets/images/placeholder.jpg'}" 
                 alt="${product.name}"
                 onerror="this.src='assets/images/placeholder.jpg'">
        </div>
        <div class="product-info">
            <span class="product-category">${product.category || 'عام'}</span>
            <h3 class="product-name">${product.name}</h3>
            <p class="product-description">${product.description?.substring(0, 100) || 'لا يوجد وصف'}...</p>
            <div class="product-footer">
                <div class="product-price">$${product.price.toFixed(2)}</div>
                <div class="product-actions">
                    <button class="btn btn-primary" onclick="viewProductDetail('${product.id}')">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-success" onclick="addToCart('${product.id}')">
                        <i class="fas fa-cart-plus"></i>
                    </button>
                </div>
            </div>
        </div>
    `;
    
    return card;
}

// إعداد مستمعي الأحداث
function setupEventListeners() {
    // القائمة المتنقلة
    const menuToggle = document.getElementById('menu-toggle');
    const navMenu = document.querySelector('.nav-menu');
    
    if (menuToggle) {
        menuToggle.addEventListener('click', () => {
            navMenu.classList.toggle('active');
        });
    }
    
    // إغلاق القائمة عند النقر خارجها
    document.addEventListener('click', (e) => {
        if (!e.target.closest('.nav-menu') && !e.target.closest('.menu-toggle')) {
            navMenu.classList.remove('active');
        }
    });
    
    // تصفية المنتجات
    const categoryFilter = document.getElementById('category-filter');
    const sortBy = document.getElementById('sort-by');
    
    if (categoryFilter) {
        categoryFilter.addEventListener('change', filterProducts);
    }
    
    if (sortBy) {
        sortBy.addEventListener('change', sortProducts);
    }
    
    // زر تحميل المزيد
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        loadMoreBtn.addEventListener('click', loadMoreProducts);
    }
    
    // النماذج
    const contactForm = document.getElementById('contact-form');
    if (contactForm) {
        contactForm.addEventListener('submit', handleContactForm);
    }
    
    const newsletterForm = document.getElementById('newsletter-form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', handleNewsletter);
    }
    
    // الروابط السلسة
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            
            const targetId = this.getAttribute('href');
            if (targetId === '#') return;
            
            const targetElement = document.querySelector(targetId);
            if (targetElement) {
                targetElement.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start'
                });
                
                // إغلاق القائمة المتنقلة
                navMenu.classList.remove('active');
            }
        });
    });
}

// تصفية المنتجات
function filterProducts() {
    const category = document.getElementById('category-filter').value;
    let filteredProducts = products;
    
    if (category !== 'all') {
        filteredProducts = products.filter(p => p.category === category);
    }
    
    currentProductPage = 1;
    displayProducts(filteredProducts.slice(0, productsPerPage));
    updateLoadMoreButton(filteredProducts);
}

// ترتيب المنتجات
function sortProducts() {
    const sortBy = document.getElementById('sort-by').value;
    let sortedProducts = [...products];
    
    switch (sortBy) {
        case 'price-low':
            sortedProducts.sort((a, b) => a.price - b.price);
            break;
        case 'price-high':
            sortedProducts.sort((a, b) => b.price - a.price);
            break;
        case 'popular':
            sortedProducts.sort((a, b) => (b.download_count || 0) - (a.download_count || 0));
            break;
        case 'newest':
        default:
            sortedProducts.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    }
    
    currentProductPage = 1;
    displayProducts(sortedProducts.slice(0, productsPerPage));
    updateLoadMoreButton(sortedProducts);
}

// تحميل المزيد من المنتجات
function loadMoreProducts() {
    currentProductPage++;
    const start = (currentProductPage - 1) * productsPerPage;
    const end = start + productsPerPage;
    
    const category = document.getElementById('category-filter').value;
    let filteredProducts = products;
    
    if (category !== 'all') {
        filteredProducts = products.filter(p => p.category === category);
    }
    
    const moreProducts = filteredProducts.slice(start, end);
    
    if (moreProducts.length > 0) {
        const container = document.getElementById('products-container');
        moreProducts.forEach(product => {
            const productCard = createProductCard(product);
            container.appendChild(productCard);
        });
        
        // إخفاء زر تحميل المزيد إذا لم يتبقى منتجات
        if (end >= filteredProducts.length) {
            document.getElementById('load-more-btn').style.display = 'none';
        }
    }
}

// تحديث زر تحميل المزيد
function updateLoadMoreButton(filteredProducts) {
    const loadMoreBtn = document.getElementById('load-more-btn');
    if (loadMoreBtn) {
        if (filteredProducts.length > productsPerPage) {
            loadMoreBtn.style.display = 'block';
        } else {
            loadMoreBtn.style.display = 'none';
        }
    }
}

// تحديث واجهة المستخدم
function updateUI() {
    // تحديث حالة المستخدم
    const userName = document.getElementById('user-name');
    const userEmail = document.getElementById('user-email');
    const profileLink = document.getElementById('profile-link');
    const ordersLink = document.getElementById('orders-link');
    const logoutLink = document.getElementById('logout-link');
    
    if (currentUser) {
        if (userName) userName.textContent = currentUser.profile?.full_name || 'مستخدم';
        if (userEmail) userEmail.textContent = currentUser.email;
        
        if (profileLink) profileLink.style.display = 'block';
        if (ordersLink) ordersLink.style.display = 'block';
        if (logoutLink) logoutLink.style.display = 'block';
        
        // إخفاء روابط تسجيل الدخول
        document.querySelectorAll('[href="login.html"]').forEach(link => {
            link.style.display = 'none';
        });
        document.querySelectorAll('[href="register.html"]').forEach(link => {
            link.style.display = 'none';
        });
    } else {
        if (userName) userName.textContent = 'زائر';
        if (userEmail) userEmail.textContent = 'قم بتسجيل الدخول';
        
        if (profileLink) profileLink.style.display = 'none';
        if (ordersLink) ordersLink.style.display = 'none';
        if (logoutLink) logoutLink.style.display = 'none';
    }
    
    // تحديث عداد السلة
    updateCartCount();
}

// إضافة منتج إلى السلة
window.addToCart = async function(productId) {
    if (!currentUser) {
        showLoginModal();
        return;
    }
    
    try {
        // التحقق إذا المنتج موجود بالفعل في السلة
        const existingItem = cart.find(item => item.product_id === productId);
        
        if (existingItem) {
            // تحديث الكمية
            await supabase
                .from('cart_items')
                .update({ quantity: existingItem.quantity + 1 })
                .eq('id', existingItem.id);
        } else {
            // إضافة منتج جديد
            const product = products.find(p => p.id === productId);
            if (!product) throw new Error('المنتج غير موجود');
            
            await supabase
                .from('cart_items')
                .insert([{
                    customer_id: currentUser.id,
                    product_id: productId,
                    quantity: 1
                }]);
        }
        
        loadCart();
        showSuccess('تمت إضافة المنتج إلى السلة');
        
    } catch (error) {
        console.error('Error adding to cart:', error);
        showError('فشل في إضافة المنتج إلى السلة');
    }
}

// تحميل السلة
async function loadCart() {
    if (!currentUser) {
        cart = [];
        updateCartUI();
        return;
    }
    
    try {
        const { data, error } = await supabase
            .from('cart_items')
            .select(`
                *,
                digital_products (
                    name,
                    price,
                    preview_image_url
                )
            `)
            .eq('customer_id', currentUser.id);
        
        if (error) throw error;
        
        cart = data || [];
        updateCartUI();
        
    } catch (error) {
        console.error('Error loading cart:', error);
        cart = [];
    }
}

// تحديث واجهة السلة
function updateCartUI() {
    updateCartCount();
    updateCartDropdown();
    updateCartTotal();
}

// تحديث عداد السلة
function updateCartCount() {
    const cartCount = document.getElementById('cart-count');
    if (cartCount) {
        cartCount.textContent = cart.reduce((total, item) => total + item.quantity, 0);
    }
}

// تحديث القائمة المنبثقة للسلة
function updateCartDropdown() {
    const cartItemsContainer = document.getElementById('cart-items');
    if (!cartItemsContainer) return;
    
    if (cart.length === 0) {
        cartItemsContainer.innerHTML = '<p class="text-center text-muted">السلة فارغة</p>';
        return;
    }
    
    cartItemsContainer.innerHTML = '';
    
    cart.forEach(item => {
        const product = item.digital_products;
        const cartItem = document.createElement('div');
        cartItem.className = 'cart-item';
        
        cartItem.innerHTML = `
            <div class="cart-item-image">
                <img src="${product.preview_image_url || 'assets/images/placeholder.jpg'}" 
                     alt="${product.name}"
                     onerror="this.src='assets/images/placeholder.jpg'">
            </div>
            <div class="cart-item-info">
                <div class="cart-item-name">${product.name}</div>
                <div class="cart-item-price">$${product.price.toFixed(2)} × ${item.quantity}</div>
            </div>
            <button class="cart-item-remove" onclick="removeFromCart('${item.id}')">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        cartItemsContainer.appendChild(cartItem);
    });
}

// تحديث الإجمالي
function updateCartTotal() {
    const cartTotal = document.getElementById('cart-total');
    if (cartTotal) {
        const total = cart.reduce((sum, item) => {
            return sum + (item.digital_products.price * item.quantity);
        }, 0);
        
        cartTotal.textContent = `$${total.toFixed(2)}`;
    }
}

// إزالة منتج من السلة
window.removeFromCart = async function(cartItemId) {
    try {
        await supabase
            .from('cart_items')
            .delete()
            .eq('id', cartItemId);
        
        loadCart();
        showSuccess('تمت إزالة المنتج من السلة');
        
    } catch (error) {
        console.error('Error removing from cart:', error);
        showError('فشل في إزالة المنتج من السلة');
    }
}

// عرض تفاصيل المنتج
window.viewProductDetail = function(productId) {
    window.location.href = `product.html?id=${productId}`;
}

// معالجة نموذج الاتصال
async function handleContactForm(e) {
    e.preventDefault();
    
    const form = e.target;
    const formData = new FormData(form);
    
    try {
        // هنا يمكنك إرسال البيانات إلى Supabase أو خدمة بريد
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        showSuccess('تم إرسال رسالتك بنجاح. سنرد عليك قريباً.');
        form.reset();
        
    } catch (error) {
        showError('فشل في إرسال الرسالة. حاول مرة أخرى.');
    }
}

// معالجة النشرة البريدية
async function handleNewsletter(e) {
    e.preventDefault();
    
    const form = e.target;
    const email = form.querySelector('input[type="email"]').value;
    
    try {
        // حفظ في قاعدة البيانات
        await supabase
            .from('newsletter_subscribers')
            .insert([{ email }]);
        
        showSuccess('تم اشتراكك في النشرة البريدية بنجاح!');
        form.reset();
        
    } catch (error) {
        // تجاهل الخطأ إذا كان البريد مسجلاً مسبقاً
        if (error.code !== '23505') {
            showError('فشل في الاشتراك. حاول مرة أخرى.');
        } else {
            showInfo('أنت مشترك بالفعل في النشرة البريدية.');
        }
    }
}

// عرض نموذج تسجيل الدخول
function showLoginModal() {
    const loginModal = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');
    
    registerModal.classList.remove('active');
    loginModal.classList.add('active');
    
    // إضافة مستمعي الأحداث للإغلاق
    const closeButtons = loginModal.querySelectorAll('.close-modal');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            loginModal.classList.remove('active');
        });
    });
    
    // الانتقال إلى نموذج التسجيل
    const showRegister = loginModal.querySelector('#show-register');
    if (showRegister) {
        showRegister.addEventListener('click', (e) => {
            e.preventDefault();
            loginModal.classList.remove('active');
            showRegisterModal();
        });
    }
}

// عرض نموذج التسجيل
function showRegisterModal() {
    const registerModal = document.getElementById('register-modal');
    const loginModal = document.getElementById('login-modal');
    
    loginModal.classList.remove('active');
    registerModal.classList.add('active');
    
    // إضافة مستمعي الأحداث للإغلاق
    const closeButtons = registerModal.querySelectorAll('.close-modal');
    closeButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            registerModal.classList.remove('active');
        });
    });
    
    // الانتقال إلى نموذج تسجيل الدخول
    const showLogin = registerModal.querySelector('#show-login');
    if (showLogin) {
        showLogin.addEventListener('click', (e) => {
            e.preventDefault();
            registerModal.classList.remove('active');
            showLoginModal();
        });
    }
}

// عرض رسائل النجاح
function showSuccess(message) {
    Swal.fire({
        icon: 'success',
        title: 'نجاح',
        text: message,
        timer: 2000,
        showConfirmButton: false
    });
}

// عرض رسائل الخطأ
function showError(message) {
    Swal.fire({
        icon: 'error',
        title: 'خطأ',
        text: message,
        timer: 3000
    });
}

// عرض رسائل المعلومات
function showInfo(message) {
    Swal.fire({
        icon: 'info',
        title: 'معلومات',
        text: message,
        timer: 2000,
        showConfirmButton: false
    });
}