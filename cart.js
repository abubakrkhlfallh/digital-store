class CartManager {
    constructor() {
        this.items = [];
        this.total = 0;
        this.init();
    }

    async init() {
        await this.loadCart();
        this.setupEventListeners();
    }

    async loadCart() {
        const user = authManager.getUser();
        
        if (!user) {
            this.items = [];
            this.calculateTotal();
            this.updateUI();
            return;
        }

        try {
            const { data, error } = await supabase
                .from('cart_items')
                .select(`
                    *,
                    digital_products (
                        id,
                        name,
                        price,
                        preview_image_url,
                        stock
                    )
                `)
                .eq('customer_id', user.id);

            if (error) throw error;

            this.items = data || [];
            this.calculateTotal();
            this.updateUI();

        } catch (error) {
            console.error('Error loading cart:', error);
            this.items = [];
            this.calculateTotal();
        }
    }

    calculateTotal() {
        this.total = this.items.reduce((sum, item) => {
            const price = item.digital_products?.price || 0;
            return sum + (price * item.quantity);
        }, 0);
    }

    setupEventListeners() {
        // إغلاق سلة التسوق
        const closeCartBtn = document.querySelector('.close-cart');
        if (closeCartBtn) {
            closeCartBtn.addEventListener('click', () => {
                document.getElementById('cart-dropdown').style.display = 'none';
            });
        }

        // زر إتمام الشراء
        const checkoutBtn = document.getElementById('checkout-btn');
        if (checkoutBtn) {
            checkoutBtn.addEventListener('click', () => this.checkout());
        }

        // عرض سلة التسوق
        const cartIcon = document.getElementById('cart-icon');
        if (cartIcon) {
            cartIcon.addEventListener('click', (e) => {
                e.stopPropagation();
                const dropdown = document.getElementById('cart-dropdown');
                dropdown.style.display = dropdown.style.display === 'block' ? 'none' : 'block';
            });
        }

        // إغلاق السلة عند النقر خارجها
        document.addEventListener('click', (e) => {
            if (!e.target.closest('#cart-icon') && !e.target.closest('#cart-dropdown')) {
                const dropdown = document.getElementById('cart-dropdown');
                if (dropdown) {
                    dropdown.style.display = 'none';
                }
            }
        });
    }

    async addItem(productId, quantity = 1) {
        const user = authManager.getUser();
        
        if (!user) {
            showLoginModal();
            return false;
        }

        try {
            // التحقق من توفر المنتج
            const { data: product } = await supabase
                .from('digital_products')
                .select('stock')
                .eq('id', productId)
                .single();

            if (product.stock !== -1 && product.stock < quantity) {
                showError('الكمية المطلوبة غير متوفرة في المخزون');
                return false;
            }

            // التحقق إذا كان المنتج موجوداً بالفعل
            const existingItem = this.items.find(item => item.product_id === productId);
            
            if (existingItem) {
                // تحديث الكمية
                const newQuantity = existingItem.quantity + quantity;
                
                if (product.stock !== -1 && product.stock < newQuantity) {
                    showError('الكمية المطلوبة غير متوفرة في المخزون');
                    return false;
                }

                await supabase
                    .from('cart_items')
                    .update({ quantity: newQuantity })
                    .eq('id', existingItem.id);

            } else {
                // إضافة عنصر جديد
                await supabase
                    .from('cart_items')
                    .insert([{
                        customer_id: user.id,
                        product_id: productId,
                        quantity: quantity
                    }]);
            }

            await this.loadCart();
            showSuccess('تمت إضافة المنتج إلى السلة');
            return true;

        } catch (error) {
            console.error('Error adding to cart:', error);
            showError('فشل في إضافة المنتج إلى السلة');
            return false;
        }
    }

    async updateQuantity(cartItemId, newQuantity) {
        if (newQuantity < 1) {
            await this.removeItem(cartItemId);
            return;
        }

        try {
            // الحصول على معلومات المنتج للتحقق من المخزون
            const cartItem = this.items.find(item => item.id === cartItemId);
            if (!cartItem) return;

            const { data: product } = await supabase
                .from('digital_products')
                .select('stock')
                .eq('id', cartItem.product_id)
                .single();

            if (product.stock !== -1 && product.stock < newQuantity) {
                showError('الكمية المطلوبة غير متوفرة في المخزون');
                return;
            }

            await supabase
                .from('cart_items')
                .update({ quantity: newQuantity })
                .eq('id', cartItemId);

            await this.loadCart();

        } catch (error) {
            console.error('Error updating quantity:', error);
            showError('فشل في تحديث الكمية');
        }
    }

    async removeItem(cartItemId) {
        try {
            await supabase
                .from('cart_items')
                .delete()
                .eq('id', cartItemId);

            await this.loadCart();
            showSuccess('تمت إزالة المنتج من السلة');

        } catch (error) {
            console.error('Error removing item:', error);
            showError('فشل في إزالة المنتج من السلة');
        }
    }

    async clearCart() {
        const user = authManager.getUser();
        
        if (!user) return;

        try {
            await supabase
                .from('cart_items')
                .delete()
                .eq('customer_id', user.id);

            this.items = [];
            this.total = 0;
            this.updateUI();
            showSuccess('تم تفريغ السلة');

        } catch (error) {
            console.error('Error clearing cart:', error);
            showError('فشل في تفريغ السلة');
        }
    }

    updateUI() {
        // تحديث العداد
        const cartCount = document.getElementById('cart-count');
        if (cartCount) {
            const totalItems = this.items.reduce((sum, item) => sum + item.quantity, 0);
            cartCount.textContent = totalItems;
            cartCount.style.display = totalItems > 0 ? 'flex' : 'none';
        }

        // تحديث القائمة المنبثقة
        this.updateDropdown();

        // تحديث الإجمالي
        const cartTotal = document.getElementById('cart-total');
        if (cartTotal) {
            cartTotal.textContent = `$${this.total.toFixed(2)}`;
        }

        // تحديث صفحة السلة إذا كانت مفتوحة
        if (window.location.pathname.includes('cart.html')) {
            this.updateCartPage();
        }
    }

    updateDropdown() {
        const cartItemsContainer = document.getElementById('cart-items');
        if (!cartItemsContainer) return;

        if (this.items.length === 0) {
            cartItemsContainer.innerHTML = '<p class="text-center text-muted">السلة فارغة</p>';
            return;
        }

        let html = '';
        
        this.items.forEach(item => {
            const product = item.digital_products;
            html += `
                <div class="cart-item">
                    <div class="cart-item-image">
                        <img src="${product.preview_image_url || 'assets/images/placeholder.jpg'}" 
                             alt="${product.name}"
                             onerror="this.src='assets/images/placeholder.jpg'">
                    </div>
                    <div class="cart-item-info">
                        <div class="cart-item-name">${product.name}</div>
                        <div class="cart-item-price">$${product.price.toFixed(2)} × ${item.quantity}</div>
                    </div>
                    <button class="cart-item-remove" onclick="cartManager.removeItem('${item.id}')">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        });

        cartItemsContainer.innerHTML = html;
    }

    updateCartPage() {
        const cartContainer = document.getElementById('cart-container');
        if (!cartContainer) return;

        if (this.items.length === 0) {
            cartContainer.innerHTML = `
                <div class="empty-cart">
                    <i class="fas fa-shopping-cart fa-4x"></i>
                    <h3>سلة التسوق فارغة</h3>
                    <p>لم تقم بإضافة أي منتجات إلى سلة التسوق بعد</p>
                    <a href="index.html#products" class="btn btn-primary">تصفح المنتجات</a>
                </div>
            `;
            return;
        }

        let html = `
            <div class="cart-items-list">
                <h3>سلة التسوق (${this.items.length} منتج)</h3>
        `;

        this.items.forEach(item => {
            const product = item.digital_products;
            const itemTotal = product.price * item.quantity;
            
            html += `
                <div class="cart-page-item">
                    <div class="cart-item-details">
                        <img src="${product.preview_image_url || 'assets/images/placeholder.jpg'}" 
                             alt="${product.name}">
                        <div>
                            <h4>${product.name}</h4>
                            <p class="text-muted">${product.category || 'عام'}</p>
                            <div class="price">$${product.price.toFixed(2)}</div>
                        </div>
                    </div>
                    <div class="cart-item-quantity">
                        <button class="quantity-btn" onclick="cartManager.updateQuantity('${item.id}', ${item.quantity - 1})">-</button>
                        <span>${item.quantity}</span>
                        <button class="quantity-btn" onclick="cartManager.updateQuantity('${item.id}', ${item.quantity + 1})">+</button>
                    </div>
                    <div class="cart-item-total">
                        <span>$${itemTotal.toFixed(2)}</span>
                        <button class="btn btn-danger btn-sm" onclick="cartManager.removeItem('${item.id}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            `;
        });

        html += `
            </div>
            <div class="cart-summary">
                <h3>ملخص الطلب</h3>
                <div class="summary-row">
                    <span>المجموع الجزئي</span>
                    <span>$${this.total.toFixed(2)}</span>
                </div>
                <div class="summary-row">
                    <span>الضريبة</span>
                    <span>$0.00</span>
                </div>
                <div class="summary-row total">
                    <span>الإجمالي</span>
                    <span>$${this.total.toFixed(2)}</span>
                </div>
                <button class="btn btn-primary btn-lg btn-block" onclick="cartManager.checkout()">
                    إتمام عملية الشراء
                </button>
                <button class="btn btn-danger btn-block" onclick="cartManager.clearCart()">
                    تفريغ السلة
                </button>
            </div>
        `;

        cartContainer.innerHTML = html;
    }

    async checkout() {
        const user = authManager.getUser();
        
        if (!user) {
            showLoginModal();
            return;
        }

        if (this.items.length === 0) {
            showError('سلة التسوق فارغة');
            return;
        }

        // فتح نموذج الدفع
        const checkoutModal = document.getElementById('checkout-modal');
        if (checkoutModal) {
            checkoutModal.classList.add('active');
            
            // تهيئة PayPal
            if (typeof initPayPal === 'function') {
                initPayPal(this.total, this.items);
            }
        }
    }

    getItems() {
        return this.items;
    }

    getTotal() {
        return this.total;
    }
}

// تهيئة مدير السلة
const cartManager = new CartManager();

// تصدير للاستخدام في ملفات أخرى
window.cartManager = cartManager;

// دالات مساعدة للاستخدام في HTML
window.addToCart = function(productId, quantity = 1) {
    return cartManager.addItem(productId, quantity);
};

window.removeFromCart = function(cartItemId) {
    return cartManager.removeItem(cartItemId);
};