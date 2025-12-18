// إدارة المصادقة
class AuthManager {
    constructor() {
        this.currentUser = null;
        this.init();
    }

    async init() {
        await this.checkSession();
        this.setupEventListeners();
    }

    async checkSession() {
        const { data: { user } } = await supabase.auth.getUser();
        
        if (user) {
            this.currentUser = user;
            await this.loadUserProfile(user.id);
            this.updateAuthUI();
        }
    }

    async loadUserProfile(userId) {
        const { data } = await supabase
            .from('customers')
            .select('*')
            .eq('id', userId)
            .single();
        
        if (data) {
            this.currentUser.profile = data;
        }
    }

    setupEventListeners() {
        // تسجيل الدخول
        const loginForm = document.getElementById('login-form');
        if (loginForm) {
            loginForm.addEventListener('submit', (e) => this.handleLogin(e));
        }

        // التسجيل
        const registerForm = document.getElementById('register-form');
        if (registerForm) {
            registerForm.addEventListener('submit', (e) => this.handleRegister(e));
        }

        // تسجيل الخروج
        const logoutLinks = document.querySelectorAll('#logout-link, .logout-btn');
        logoutLinks.forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                this.handleLogout();
            });
        });
    }

    async handleLogin(e) {
        e.preventDefault();
        
        const email = document.getElementById('login-email').value;
        const password = document.getElementById('login-password').value;

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password
            });

            if (error) throw error;

            this.currentUser = data.user;
            await this.loadUserProfile(data.user.id);
            this.updateAuthUI();

            // إغلاق النافذة المنبثقة
            const loginModal = document.getElementById('login-modal');
            if (loginModal) {
                loginModal.classList.remove('active');
            }

            showSuccess('تم تسجيل الدخول بنجاح!');
            
            // إعادة تحميل السلة
            if (typeof loadCart === 'function') {
                loadCart();
            }

        } catch (error) {
            console.error('Login error:', error);
            showError(error.message || 'فشل في تسجيل الدخول');
        }
    }

    async handleRegister(e) {
        e.preventDefault();
        
        const name = document.getElementById('register-name').value;
        const email = document.getElementById('register-email').value;
        const phone = document.getElementById('register-phone').value;
        const password = document.getElementById('register-password').value;
        const confirmPassword = document.getElementById('register-confirm').value;

        // التحقق من تطابق كلمات المرور
        if (password !== confirmPassword) {
            showError('كلمات المرور غير متطابقة');
            return;
        }

        // التحقق من قوة كلمة المرور
        if (password.length < 6) {
            showError('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
            return;
        }

        try {
            // إنشاء حساب في Supabase Auth
            const { data: authData, error: authError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        full_name: name,
                        phone: phone
                    }
                }
            });

            if (authError) throw authError;

            // إضافة المستخدم إلى جدول العملاء
            const { error: dbError } = await supabase
                .from('customers')
                .insert([{
                    id: authData.user.id,
                    email: email,
                    full_name: name,
                    phone: phone,
                    is_active: true
                }]);

            if (dbError) throw dbError;

            // إرسال بريد التحقق
            if (!authData.user.email_confirmed) {
                showInfo('تم إنشاء الحساب! يرجى التحقق من بريدك الإلكتروني.');
            } else {
                showSuccess('تم إنشاء الحساب بنجاح!');
            }

            // إغلاق النافذة المنبثقة
            const registerModal = document.getElementById('register-modal');
            if (registerModal) {
                registerModal.classList.remove('active');
            }

            // تلقائيًا تسجيل الدخول بعد التسجيل
            await this.handleLogin({
                preventDefault: () => {},
                target: { 
                    querySelector: () => ({ value: email }),
                    querySelectorAll: () => [{ value: password }]
                }
            });

        } catch (error) {
            console.error('Registration error:', error);
            
            if (error.code === '23505') {
                showError('البريد الإلكتروني مسجل مسبقاً');
            } else {
                showError(error.message || 'فشل في إنشاء الحساب');
            }
        }
    }

    async handleLogout() {
        try {
            const { error } = await supabase.auth.signOut();
            
            if (error) throw error;

            this.currentUser = null;
            this.updateAuthUI();
            
            // إعادة تحميل السلة
            if (typeof loadCart === 'function') {
                loadCart();
            }

            showSuccess('تم تسجيل الخروج بنجاح');

            // إعادة التوجيه للصفحة الرئيسية إذا لزم
            if (window.location.pathname.includes('profile.html') || 
                window.location.pathname.includes('orders.html')) {
                window.location.href = 'index.html';
            }

        } catch (error) {
            console.error('Logout error:', error);
            showError('فشل في تسجيل الخروج');
        }
    }

    updateAuthUI() {
        const userNameElements = document.querySelectorAll('#user-name, .user-name');
        const userEmailElements = document.querySelectorAll('#user-email, .user-email');
        const profileLinks = document.querySelectorAll('#profile-link, .profile-link');
        const ordersLinks = document.querySelectorAll('#orders-link, .orders-link');
        const logoutLinks = document.querySelectorAll('#logout-link, .logout-link');
        const loginLinks = document.querySelectorAll('[href="login.html"], .login-link');
        const registerLinks = document.querySelectorAll('[href="register.html"], .register-link');

        if (this.currentUser) {
            // تحديث معلومات المستخدم
            userNameElements.forEach(el => {
                el.textContent = this.currentUser.profile?.full_name || 'مستخدم';
            });
            
            userEmailElements.forEach(el => {
                el.textContent = this.currentUser.email;
            });

            // إظهار رواق المستخدم المسجل
            profileLinks.forEach(el => el.style.display = 'block');
            ordersLinks.forEach(el => el.style.display = 'block');
            logoutLinks.forEach(el => el.style.display = 'block');
            loginLinks.forEach(el => el.style.display = 'none');
            registerLinks.forEach(el => el.style.display = 'none');

        } else {
            // إظهار رواق الزائر
            userNameElements.forEach(el => {
                el.textContent = 'زائر';
            });
            
            userEmailElements.forEach(el => {
                el.textContent = 'قم بتسجيل الدخول';
            });

            profileLinks.forEach(el => el.style.display = 'none');
            ordersLinks.forEach(el => el.style.display = 'none');
            logoutLinks.forEach(el => el.style.display = 'none');
            loginLinks.forEach(el => el.style.display = 'block');
            registerLinks.forEach(el => el.style.display = 'block');
        }
    }

    // التحقق من صلاحيات الوصول
    requireAuth(redirectTo = 'login.html') {
        return new Promise((resolve, reject) => {
            if (this.currentUser) {
                resolve(this.currentUser);
            } else {
                if (redirectTo) {
                    window.location.href = redirectTo;
                }
                reject(new Error('يجب تسجيل الدخول'));
            }
        });
    }

    // الحصول على معلومات المستخدم الحالي
    getUser() {
        return this.currentUser;
    }

    // التحقق إذا كان المستخدم مسؤولاً
    async isAdmin() {
        if (!this.currentUser) return false;
        
        const { data } = await supabase
            .from('admins')
            .select('id')
            .eq('id', this.currentUser.id)
            .single();
            
        return !!data;
    }
}

// تهيئة مدير المصادقة
const authManager = new AuthManager();

// تصدير للاستخدام في ملفات أخرى
window.authManager = authManager;