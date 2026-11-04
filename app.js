// دالة إغلاق السبلاش والانتقال لتسجيل الدخول
function endSplash() {
    const splash = document.getElementById('splashScreen');
    if (!splash || splash.style.display === 'none') return;
    splash.style.opacity = '0';
    setTimeout(() => {
        splash.style.display = 'none';
        document.getElementById('loginScreen').classList.remove('hidden');
    }, 600);
}

window.onload = () => {
    loadServantsListForLogin();

    const video = document.getElementById('splashVideo');
    if (video) {
        video.muted = true; // كتم الصوت إجباري برمجياً لتجاوز حظر المتصفحات
        
        video.onended = () => {
            endSplash();
        };

        video.play().catch(() => {
            // محاولة ثانية إن لزم الأمر
            setTimeout(() => {
                video.play().catch(() => setTimeout(endSplash, 1500));
            }, 300);
        });

        // صمام أمان أقصى 10 ثوانٍ في حال طول الفيديو
        setTimeout(endSplash, 10000);
    } else {
        setTimeout(endSplash, 1200);
    }
};
