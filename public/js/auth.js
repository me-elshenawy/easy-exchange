document.addEventListener('DOMContentLoaded', () => {
    // تحقق من قوة كلمة المرور
    function validatePassword(password) {
        const rules = {
            length: password.length >= 8,
            uppercase: /[A-Z]/.test(password),
            lowercase: /[a-z]/.test(password),
            number: /\d/.test(password),
            special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)
        };

        const passedRules = Object.values(rules).filter(Boolean).length;
        let strength = 'weak';
        
        if (passedRules === 5) strength = 'strong';
        else if (passedRules >= 3) strength = 'moderate';

        return { valid: Object.values(rules).every(Boolean), strength, rules };
    }

    // تحديث واجهة كلمة المرور
    function updatePasswordUI(password) {
        const validation = validatePassword(password);
        const rulesList = document.querySelectorAll('#passwordRules li');
        const strengthMeter = document.querySelector('.strength-meter');
        
        rulesList.forEach(li => {
            const rule = li.dataset.rule;
            li.classList.toggle('valid', validation.rules[rule]);
        });

        strengthMeter.className = `strength-meter strength-${validation.strength}`;
        strengthMeter.querySelector('.strength-text').textContent = 
            `قوة كلمة المرور: ${validation.strength === 'weak' ? 'ضعيفة' : 
                            validation.strength === 'moderate' ? 'متوسطة' : 'قوية'}`;
    }

    // إعداد مستمعات الأحداث لكلمة المرور
    if (document.getElementById('password')) {
        const passwordInput = document.getElementById('password');
        const requirementsDiv = document.querySelector('.password-requirements');

        passwordInput.addEventListener('input', (e) => {
            const password = e.target.value;
            requirementsDiv.classList.toggle('show', password.length > 0);
            updatePasswordUI(password);
        });

        passwordInput.addEventListener('focus', () => {
            if (passwordInput.value.length > 0) requirementsDiv.classList.add('show');
        });

        passwordInput.addEventListener('blur', () => requirementsDiv.classList.remove('show'));
    }

    // تسجيل مستخدم جديد
    if (document.getElementById('registerForm')) {
        document.getElementById('registerForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('email').value;
            const password = document.getElementById('password').value;
            const fullName = document.getElementById('fullName').value;
            const birthDate = document.getElementById('birthDate').value;

            const validation = validatePassword(password);
            if (!validation.valid) {
                alert('الرجاء استيفاء جميع شروط كلمة المرور');
                return;
            }

            try {
                const userCredential = await auth.createUserWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                await user.sendEmailVerification();
                
                await db.collection('users').doc(user.uid).set({
                    fullName,
                    birthDate,
                    email,
                    createdAt: firebase.firestore.FieldValue.serverTimestamp()
                });
                
                window.location.href = 'verify-email.html';
            } catch (error) {
                let message = error.message;
                if (error.code === 'auth/weak-password') {
                    message = 'كلمة المرور ضعيفة. يجب أن تحتوي على الأقل على 8 أحرف وتشمل أحرف كبيرة وصغيرة وأرقام ورموز خاصة.';
                }
                alert(message);
            }
        });
    }

    // تسجيل الدخول
    if (document.getElementById('loginForm')) {
        document.getElementById('loginForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = document.getElementById('loginEmail').value;
            const password = document.getElementById('loginPassword').value;

            try {
                const userCredential = await auth.signInWithEmailAndPassword(email, password);
                const user = userCredential.user;
                
                if (!user.emailVerified) {
                    throw new Error('الرجاء تفعيل البريد الإلكتروني أولاً');
                }
                
                window.location.href = 'dashboard.html';
            } catch (error) {
                alert(error.message);
            }
        });
    }

    // متابعة حالة المصادقة
    auth.onAuthStateChanged((user) => {
        const currentPage = window.location.pathname.split('/').pop();
        
        if (user) {
            if (!user.emailVerified && currentPage !== 'verify-email.html') {
                window.location.href = 'verify-email.html';
            }
            else if (user.emailVerified && (currentPage === 'login.html' || currentPage === 'register.html')) {
                window.location.href = 'dashboard.html';
            }
        } else {
            if (currentPage === 'dashboard.html' || currentPage === 'verify-email.html') {
                window.location.href = 'login.html';
            }
        }
    });
});
