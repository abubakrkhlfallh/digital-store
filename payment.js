class PaymentManager {
    constructor() {
        this.paypalButtons = null;
        this.currentOrder = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadPaymentSettings();
    }

    loadPaymentSettings() {
        // تحميل إعدادات الدفع من localStorage أو Supabase
        this.settings = JSON.parse(localStorage.getItem('payment_settings')) || {
            paypal_client_id: 'test',
            paypal_mode: 'sandbox',
            enable_paypal: true
        };

        // تحديث واجهة الإعدادات إذا كانت موجودة
        const paypalClientId = document.getElementById('paypal-client-id');
        const paypalMode = document.getElementById('paypal-mode');
        const enablePaypal = document.getElementById('enable-paypal');

        if (paypalClientId) paypalClientId.value = this.settings.paypal_client_id;
        if (paypalMode) paypalMode.value = this.settings.paypal_mode;
        if (enablePaypal) enablePaypal.checked = this.settings.enable_paypal;
    }

    setupEventListeners() {
        // تبديل طرق الدفع
        const paymentMethods = document.querySelectorAll('.payment-method');
        paymentMethods.forEach(method => {
            method.addEventListener('click', () => {
                paymentMethods.forEach(m => m.classList.remove('active'));
                method.classList.add('active');
                
                const methodType = method.dataset.method;
                this.showPaymentMethod(methodType);
            });
        });

        // إغلاق نموذج الدفع
        const closeButtons = document.querySelectorAll('#checkout-modal .close-modal');
        closeButtons.forEach(btn => {
            btn.addEventListener('click', () => {
                const checkoutModal = document.getElementById('checkout-modal');
                if (checkoutModal) {
                    checkoutModal.classList.remove('active');
                }
            });
        });

        // نموذج بطاقة الائتمان
        const cardForm = document.getElementById('card-form');
        if (cardForm) {
            cardForm.addEventListener('submit', (e) => this.handleCardPayment(e));
        }

        // حفظ إعدادات الدفع
        const paymentSettingsForm = document.getElementById('payment-settings-form');
        if (paymentSettingsForm) {
            paymentSettingsForm.addEventListener('submit', (e) => this.savePaymentSettings(e));
        }
    }

    showPaymentMethod(methodType) {
        // إخفاء جميع حاويات الدفع
        const containers = document.querySelectorAll('.payment-container');
        containers.forEach(container => container.classList.remove('active'));
        
        // إظهار الحاوية المحددة
        const targetContainer = document.getElementById(`${methodType}-container`);
        if (targetContainer) {
            targetContainer.classList.add('active');
        }

        // تهيئة PayPal إذا تم اختياره
        if (methodType === 'paypal' && this.settings.enable_paypal) {
            this.initPayPal();
        }
    }

    async initPayPal(amount = 0, items = []) {
        if (!this.settings.enable_paypal || this.settings.paypal_client_id === 'test') {
            console.warn('PayPal is not configured properly');
            return;
        }

        try {
            // إزالة أزرار PayPal السابقة
            if (this.paypalButtons) {
                this.paypalButtons.close();
            }

            // تحميل SDK PayPal
            await loadScript(`https://www.paypal.com/sdk/js?client-id=${this.settings.paypal_client_id}&currency=USD`);

            // إنشاء أزرار PayPal
            this.paypalButtons = window.paypal.Buttons({
                createOrder: (data, actions) => {
                    return actions.order.create({
                        purchase_units: [{
                            amount: {
                                value: amount.toFixed(2),
                                breakdown: {
                                    item_total: {
                                        value: amount.toFixed(2),
                                        currency_code: 'USD'
                                    }
                                }
                            },
                            items: items.map(item => ({
                                name: item.digital_products.name,
                                unit_amount: {
                                    value: item.digital_products.price.toFixed(2),
                                    currency_code: 'USD'
                                },
                                quantity: item.quantity,
                                category: 'DIGITAL_GOODS'
                            }))
                        }],
                        application_context: {
                            shipping_preference: 'NO_SHIPPING'
                        }
                    });
                },

                onApprove: async (data, actions) => {
                    try {
                        const details = await actions.order.capture();
                        await this.handleSuccessfulPayment(details, 'paypal');
                        
                        showSuccess('تمت عملية الدفع بنجاح!');
                        
                        // إغلاق نموذج الدفع
                        const checkoutModal = document.getElementById('checkout-modal');
                        if (checkoutModal) {
                            checkoutModal.classList.remove('active');
                        }

                    } catch (error) {
                        console.error('Payment capture error:', error);
                        showError('فشل في معالجة الدفع');
                    }
                },

                onError: (error) => {
                    console.error('PayPal error:', error);
                    showError('حدث خطأ أثناء عملية الدفع عبر PayPal');
                },

                style: {
                    layout: 'vertical',
                    color: 'blue',
                    shape: 'rect',
                    label: 'paypal'
                }
            });

            // عرض أزرار PayPal
            const container = document.getElementById('paypal-button-container');
            if (container) {
                this.paypalButtons.render(container);
            }

        } catch (error) {
            console.error('Error initializing PayPal:', error);
            showError('فشل في تحميل نظام الدفع');
        }
    }

    async handleCardPayment(e) {
        e.preventDefault();
        
        const form = e.target;
        const formData = new FormData(form);
        
        // هنا يجب إضافة منطق معالجة بطاقة الائتمان
        // هذا مثال بسيط للتوضيح فقط
        
        try {
            // محاكاة عملية الدفع
            await new Promise(resolve => setTimeout(resolve, 2000));
            
            // إنشاء تفاصيل دفع وهمية
            const paymentDetails = {
                id: 'card_' + Date.now(),
                status: 'COMPLETED',
                amount: cartManager.getTotal()
            };
            
            await this.handleSuccessfulPayment(paymentDetails, 'card');
            
            showSuccess('تمت عملية الدفع بنجاح!');
            
            // إغلاق نموذج الدفع
            const checkoutModal = document.getElementById('checkout-modal');
            if (checkoutModal) {
                checkoutModal.classList.remove('active');
            }
            
        } catch (error) {
            console.error('Card payment error:', error);
            showError('فشل في معالجة الدفع بالبطاقة');
        }
    }

    async handleSuccessfulPayment(paymentDetails, paymentMethod) {
        const user = authManager.getUser();
        const cartItems = cartManager.getItems();
        
        if (!user || cartItems.length === 0) {
            throw new Error('بيانات غير كافية لإتمام الطلب');
        }

        try {
            // إنشاء الطلب في قاعدة البيانات
            const orderData = {
                customer_id: user.id,
                customer_email: user.email,
                customer_name: user.profile?.full_name || 'مستخدم',
                total_amount: cartManager.getTotal(),
                payment_method: paymentMethod,
                payment_status: 'paid',
                transaction_id: paymentDetails.id,
                status: 'pending'
            };

            const { data: order, error: orderError } = await supabase
                .from('orders')
                .insert([orderData])
                .select()
                .single();

            if (orderError) throw orderError;

            // إضافة عناصر الطلب
            const orderItems = cartItems.map(item => ({
                order_id: order.id,
                product_id: item.product_id,
                product_name: item.digital_products.name,
                quantity: item.quantity,
                unit_price: item.digital_products.price,
                total_price: item.digital_products.price * item.quantity
            }));

            const { error: itemsError } = await supabase
                .from('order_items')
                .insert(orderItems);

            if (itemsError) throw itemsError;

            // تحديث عدد تنزيلات المنتجات
            for (const item of cartItems) {
                await supabase.rpc('increment_download_count', {
                    product_id: item.product_id
                });
            }

            // تفريغ السلة
            await cartManager.clearCart();

            // حفظ الطلب الحالي لعرض التفاصيل
            this.currentOrder = order;

            // إرسال بريد إلكتروني للمستخدم (اختياري)
            await this.sendOrderConfirmationEmail(user.email, order);

            // عرض تفاصيل الطلب
            this.showOrderConfirmation(order);

        } catch (error) {
            console.error('Error creating order:', error);
            throw error;
        }
    }

    async sendOrderConfirmationEmail(email, order) {
        try {
            // استخدام Supabase Edge Functions أو خدمة بريد خارجية
            const { error } = await supabase.functions.invoke('send-email', {
                body: {
                    to: email,
                    subject: 'تأكيد طلبك - المتجر الرقمي',
                    html: `
                        <h2>شكراً لطلبك!</h2>
                        <p>تم تأكيد طلبك رقم: ${order.order_number}</p>
                        <p>المبلغ: $${order.total_amount}</p>
                        <p>يمكنك متابعة طلباتك من خلال حسابك.</p>
                    `
                }
            });

            if (error) throw error;

        } catch (error) {
            console.error('Error sending email:', error);
            // تجاهل خطأ الإيميل، لا تؤثر على عملية الطلب
        }
    }

    showOrderConfirmation(order) {
        Swal.fire({
            title: 'تم تأكيد طلبك!',
            html: `
                <div style="text-align: right;">
                    <p><strong>رقم الطلب:</strong> ${order.order_number}</p>
                    <p><strong>المبلغ:</strong> $${order.total_amount}</p>
                    <p><strong>حالة الدفع:</strong> مدفوع</p>
                    <p><strong>التاريخ:</strong> ${new Date(order.created_at).toLocaleDateString('ar-SA')}</p>
                    <hr>
                    <p>سيتم إرسال رابط تحميل المنتجات إلى بريدك الإلكتروني.</p>
                    <p>يمكنك أيضاً تحميلها من صفحة "طلباتي".</p>
                </div>
            `,
            icon: 'success',
            confirmButtonText: 'عرض الطلبات',
            showCancelButton: true,
            cancelButtonText: 'العودة للمتجر'
        }).then((result) => {
            if (result.isConfirmed) {
                window.location.href = 'orders.html';
            }
        });
    }

    async savePaymentSettings(e) {
        e.preventDefault();
        
        const form = e.target;
        const settings = {
            paypal_client_id: document.getElementById('paypal-client-id').value,
            paypal_mode: document.getElementById('paypal-mode').value,
            enable_paypal: document.getElementById('enable-paypal').checked
        };

        try {
            // حفظ في localStorage (في التطبيق الحقيقي، احفظ في Supabase)
            localStorage.setItem('payment_settings', JSON.stringify(settings));
            this.settings = settings;

            showSuccess('تم حفظ إعدادات الدفع بنجاح');

        } catch (error) {
            console.error('Error saving payment settings:', error);
            showError('فشل في حفظ الإعدادات');
        }
    }

    // دالة مساعدة لتحميل scripts
    async loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) {
                resolve();
                return;
            }

            const script = document.createElement('script');
            script.src = src;
            script.onload = resolve;
            script.onerror = reject;
            document.head.appendChild(script);
        });
    }
}

// تهيئة مدير الدفع
const paymentManager = new PaymentManager();

// تصدير للاستخدام في ملفات أخرى
window.paymentManager = paymentManager;
window.initPayPal = function(amount, items) {
    return paymentManager.initPayPal(amount, items);
};