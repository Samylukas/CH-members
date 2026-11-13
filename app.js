/* ==================== منظومة الخدمة والرعاية الكنسية - app.js ==================== */

// 1. الإعدادات الأساسية والمتغيرات العامة والجلسة
const API_URL = "https://script.google.com/macros/s/AKfycbxUSj07z5nkCv88hrgob88-bB21SLs2OmK9-BbSSUu_4m2eirI8cBHCl-5xUv0cyTSZ6Q/exec";
let currentUser = null, sessionToken = "", currentTab = "", rawData = [], backendAreas = [], namesCacheData = [], servantsCacheData = [], visitationsData = [];
let currentNamesView = "roster", currentSSView = "live", currentMeetingsView = "live", currentVisitView = "dashboard";
let selectedLetter = "الكل", currentSSLiveKids = [], currentServantsMeetingList = [], ssChartInstances = {}, selectedChartStage = "الكل";
let loginUsersList = [{ username: "admin", label: "الأدمن" }];

// استرجاع الجلسة المحفوظة عند تحديث الصفحة وتحميل قائمة الخدام
window.addEventListener('load', () => {
    sessionStorage.removeItem('church_current_user');
    sessionStorage.removeItem('church_session_token');
    loadServantsListForLogin();
});

// إغلاق قائمة أسماء المستخدمين عند النقر خارجها
document.addEventListener('click', (e) => {
    const wrapper = document.getElementById('loginUserDropdownWrapper');
    const menu = document.getElementById('loginUserDropdownMenu');
    const arrow = document.getElementById('loginUserArrow');
    if (wrapper && menu && !wrapper.contains(e.target)) {
        menu.classList.add('hidden');
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    }
});

// 2. دوال الاتصال والواتساب والمساعدة
function formatWhatsAppNumber(phone) {
    if (!phone) return '';
    let cleaned = phone.toString().replace(/\D/g, '');
    return (cleaned.startsWith('01') && cleaned.length === 11) ? '2' + cleaned : cleaned;
}
function renderContactButtons(phone) {
    if (!phone || String(phone).trim() === "" || String(phone).trim() === "-") return '';
    const cleanPhone = String(phone).trim(), waPhone = formatWhatsAppNumber(cleanPhone);
    return `<a href="tel:${cleanPhone}" title="اتصال هاتفي" onclick="event.stopPropagation()" class="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition"><span>📞 اتصال</span></a><a href="https://wa.me/${waPhone}" target="_blank" title="مراسلة عبر واتساب" onclick="event.stopPropagation()" class="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition"><span>💬 واتساب</span></a>`;
}

// 3. الأيقونات والخرائط المرجعية
const ICONS = {
    users: `<svg class="w-12 h-12 inline-block text-emerald-600" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
    children: `<svg class="w-12 h-12 inline-block text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
    visitations: `<svg class="w-12 h-12 inline-block text-rose-600" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`,
    meetings: `<svg class="w-12 h-12 inline-block text-amber-500" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>`,
    servants: `<svg class="w-12 h-12 inline-block text-purple-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>`,
    audit: `<svg class="w-12 h-12 inline-block text-slate-700" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`
};
const STAGE_GRADES = { "حضانة": ["بيبي كلاس", "أولى حضانة", "ثانية حضانة"], "ابتدائي": ["الصف الأول", "الصف الثاني", "الصف الثالث", "الصف الرابع", "الصف الخامس", "الصف السادس"], "إعدادي": ["الصف الأول الإعدادي", "الصف الثاني الإعدادي", "الصف الثالث الإعدادي"], "ثانوي": ["الصف الأول الثانوي", "الصف الثاني الثانوي", "الصف الثالث الثانوي"], "جامعي": ["الفرقة الأولى", "الفرقة الثانية", "الفرقة الثالثة", "الفرقة الرابعة", "بكالوريوس / تخرج"], "خريجين": ["خريج"] };
const TABS_INFO = {
    "Names": { label: "أعضاء الكنيسة", desc: "دليل أرباب الأسر والفرز المتقدم", svg: ICONS.users, accent: "from-emerald-500 to-teal-600", iconBg: "bg-emerald-50 ring-emerald-100", hoverText: "group-hover:text-emerald-700", roles: ["Admin", "SundaySchool_Admin"] },
    "Sunday_School": { label: "مدارس الأحد", desc: "كشوف الفصول والحضور والإحصائيات", svg: ICONS.children, accent: "from-blue-500 to-indigo-600", iconBg: "bg-blue-50 ring-blue-100", hoverText: "group-hover:text-blue-700", roles: ["Admin", "SundaySchool_Admin", "Stage_Leader", "Class_Servant"] },
    "Visitations": { label: "سجل الافتقاد", desc: "متابعة الزيارات والحالات العاجلة", svg: ICONS.visitations, accent: "from-rose-500 to-pink-600", iconBg: "bg-rose-50 ring-rose-100", hoverText: "group-hover:text-rose-700", roles: ["Admin"] },
    "Meetings_Attendance": { label: "حضور الاجتماعات", desc: "رصد حضور اجتماع الخدام الأسبوعي", svg: ICONS.meetings, accent: "from-amber-500 to-orange-600", iconBg: "bg-amber-50 ring-amber-100", hoverText: "group-hover:text-amber-700", roles: ["Admin", "SundaySchool_Admin"] },
    "Servants": { label: "إدارة الخدام", desc: "توزيع الصلاحيات وربط الخدام", svg: ICONS.servants, accent: "from-purple-500 to-violet-600", iconBg: "bg-purple-50 ring-purple-100", hoverText: "group-hover:text-purple-700", roles: ["Admin"] },
    "Audit_Log": { label: "سجل المراقبة", desc: "متابعة دخول الخدام والتعديلات", svg: ICONS.audit, accent: "from-slate-600 to-slate-800", iconBg: "bg-slate-100 ring-slate-200", hoverText: "group-hover:text-slate-900", roles: ["Admin"] }
};

// 4. هياكل البيانات ونماذج الإضافة والتعديل
const SCHEMAS = {
    "Names": [
        { id: "اسم رب الاسرة", label: "اسم رب الأسرة", type: "family_head_select", required: true }, { id: "الاسم ثلاثي", label: "الاسم ثلاثي", type: "text", required: true },
        { id: "حالة القيد", label: "حالة القيد الكنسي", type: "select", options: ["على قيد الحياة", "منتقل (متوفى)"], required: true }, { id: "تاريخ الوفاة", label: "تاريخ الوفاة (DD/MM/YYYY)", type: "text" },
        { id: "ذكر/انثي", label: "النوع", type: "select", options: ["", "ذكر", "انثي"], required: true }, { id: "صلة القرابة", label: "صلة القرابة", type: "select", options: ["", "زوج", "زوجة", "ابن", "ابنة", "والد", "والدة", "أخ", "أخت", "أخرى"] },
        { id: "الحالة الاجتماعية", label: "الحالة الاجتماعية", type: "select", options: ["", "متزوج", "متزوجة", "اعزب", "انسة", "ارمل", "ارملة"] }, { id: "المرحلة", label: "المرحلة الدراسية", type: "stage_select", options: Object.keys(STAGE_GRADES) },
        { id: "الصف", label: "الصف الدراسي", type: "grade_select" }, { id: "فصل مدارس الاحد", label: "فصل مدارس الأحد", type: "text" },
        { id: "مدارس الأحد", label: "مدارس الأحد", type: "select", options: ["", "مشترك", "غير مشترك"] }, { id: "أنهي مدارس الأحد", label: "أنهي مدارس الأحد", type: "text" },
        { id: "المنطقة", label: "المنطقة السكنية", type: "area_autocomplete" }, { id: "اسم الشارع", label: "اسم الشارع", type: "text" },
        { id: "رقم المنزل", label: "رقم المنزل", type: "text" }, { id: "هاتف الاسرة", label: "هاتف الأسرة الأرضي / البديل", type: "text" },
        { id: "تليفون العمل/المحمول", label: "المحمول / الهاتف", type: "text" }, { id: "تاريخ الميلاد", label: "تاريخ الميلاد (DD/MM/YYYY)", type: "text" },
        { id: "الرقم القومي", label: "الرقم القومي", type: "text" }, { id: "تاريخ اخر اعتراف", label: "تاريخ آخر اعتراف", type: "text" },
        { id: "اب الاعتراف", label: "أب الاعتراف", type: "text" }, { id: "البطاقة الانتخابية", label: "البطاقة الانتخابية", type: "select", options: ["", "يوجد", "لا يوجد"] },
        { id: "تاريخ الزواج", label: "تاريخ الزواج", type: "text" }, { id: "المؤهل", label: "المؤهل الدراسي", type: "text" },
        { id: "المهنة/السنة الدراسية", label: "المهنة / العمل", type: "text" }, { id: "الخادم الروحي", label: "الخادم الروحي", type: "text" },
        { id: "المواظبة على حضور القداس", label: "حضور القداس", type: "select", options: ["", "بانتظام", "أحياناً", "منقطع"] }, { id: "المواظبة على حضور الاجتماع", label: "حضور الاجتماع", type: "select", options: ["", "بانتظام", "أحياناً", "منقطع"] },
        { id: "الرتبة الكنسية", label: "الرتبة الكنسية", type: "select", options: ["", "شعب", "إبصلتس", "أغنسطس", "إيبودياكون", "دياكون", "شماسة"] }, { id: "الموعد المناسب للافتقاد", label: "موعد الافتقاد المناسب", type: "text" },
        { id: "ملاحظات", label: "ملاحظات عامة", type: "textarea", full: true }
    ],
    "Sunday_School": [
        { id: "Stage", label: "المرحلة", type: "stage_select", options: Object.keys(STAGE_GRADES), required: true }, { id: "Grade", label: "الصف", type: "grade_select", required: true },
        { id: "ClassName", label: "اسم الفصل", type: "text", required: true }, { id: "SessionDate", label: "تاريخ الدرس (DD/MM/YYYY)", type: "text", required: true },
        { id: "ChildID", label: "كود المخدوم (ID)", type: "number" }, { id: "ChildName", label: "اسم الطفل", type: "text", required: true },
        { id: "ServantName", label: "اسم الخادم", type: "text" }, { id: "Attendance", label: "الحضور", type: "select", options: ["حاضر", "غائب"] },
        { id: "Memorization", label: "الحفظ", type: "select", options: ["ممتاز", "جيد", "مقبول", "لم يحفظ"] }, { id: "Points", label: "النقاط", type: "number" },
        { id: "Notes", label: "ملاحظات", type: "textarea", full: true }
    ],
    "Meetings_Attendance": [
        { id: "MeetingName", label: "اسم الاجتماع", type: "text", required: true }, { id: "MeetingDate", label: "التاريخ (DD/MM/YYYY)", type: "text", required: true },
        { id: "MemberID", label: "كود العضو / الخادم", type: "number" }, { id: "MemberName", label: "الاسم", type: "text", required: true },
        { id: "Status", label: "الحالة", type: "select", options: ["حاضر", "معتذر", "غائب"] }, { id: "Notes", label: "سبب الاعتذار / ملاحظات", type: "textarea", full: true }
    ],
    "Visitations": [
        { id: "MemberID", label: "كود رب الأسرة / المخدوم", type: "number", required: true }, { id: "MemberName", label: "اسم المخدوم", type: "text", required: true },
        { id: "VisitDate", label: "تاريخ الافتقاد (DD/MM/YYYY)", type: "text", required: true }, { id: "VisitorName", label: "اسم الخادم", type: "text", required: true },
        { id: "VisitType", label: "نوع الافتقاد", type: "select", options: ["منزلي", "تليفوني", "كنسي", "في المستشفى", "جلسة إرشاد", "أخرى"] }, { id: "FollowUpDate", label: "موعد المتابعة القادمة (DD/MM/YYYY)", type: "text" },
        { id: "Notes", label: "تقرير وملاحظات (سرية)", type: "textarea", full: true }
    ],
    "Servants": [
        { id: "ServantName", label: "اسم الخادم (من شيت الأعضاء)", type: "servant_name_autocomplete", required: true }, { id: "Username", label: "اسم المستخدم / رقم الموبايل", type: "text", required: true },
        { id: "Password", label: "كلمة المرور", type: "text", required: true }, { id: "Role", label: "الصلاحية", type: "select", options: ["Admin", "SundaySchool_Admin", "Stage_Leader", "Class_Servant"] },
        { id: "AssignedStage", label: "المرحلة المسندة", type: "select", options: ["الكل", ...Object.keys(STAGE_GRADES)] }, { id: "AssignedGrade", label: "الصف المسند", type: "text" },
        { id: "AssignedClass", label: "الفصل المسند", type: "text" }, { id: "Status", label: "الحالة", type: "select", options: ["نشط", "موقوف"] }
    ]
};

// 5. نظام تسجيل الدخول والقائمة المنسدلة الثابتة للأندرويد
function toggleLoginUserDropdown(e) {
    if (e) e.stopPropagation();
    const menu = document.getElementById('loginUserDropdownMenu');
    const arrow = document.getElementById('loginUserArrow');
    const searchInp = document.getElementById('loginUserSearchInput');
    if (!menu) return;
    const isHidden = menu.classList.contains('hidden');
    if (isHidden) {
        menu.classList.remove('hidden');
        if (arrow) arrow.style.transform = 'rotate(180deg)';
        renderLoginUserOptions('');
        if (searchInp) { searchInp.value = ''; setTimeout(() => searchInp.focus(), 50); }
    } else {
        menu.classList.add('hidden');
        if (arrow) arrow.style.transform = 'rotate(0deg)';
    }
}

function renderLoginUserOptions(filterText = '') {
    const listEl = document.getElementById('loginUserOptionsList');
    const currentVal = document.getElementById('loginUser')?.value || 'admin';
    if (!listEl) return;
    const q = normalizeArabic(filterText).toLowerCase();
    const filtered = loginUsersList.filter(u => !q || normalizeArabic(u.label).toLowerCase().includes(q));
    if (filtered.length === 0) {
        listEl.innerHTML = `<li class="px-4 py-3 text-xs text-slate-400 text-center">لا يوجد اسم مطابق</li>`;
        return;
    }
    listEl.innerHTML = filtered.map(u => {
        const isSelected = u.username === currentVal;
        const safeUser = u.username.replace(/'/g, "\\'");
        const safeLabel = u.label.replace(/'/g, "\\'");
        return `<li onclick="selectLoginUser('${safeUser}', '${safeLabel}')" class="px-4 py-2.5 cursor-pointer transition flex items-center justify-between ${isSelected ? 'bg-indigo-600 text-white' : 'hover:bg-indigo-50 hover:text-indigo-700'}"><span>${u.label}</span>${isSelected ? '<span class="text-xs">✓</span>' : ''}</li>`;
    }).join('');
}

function filterLoginUserOptions(val) { renderLoginUserOptions(val); }

function selectLoginUser(username, label) {
    const hiddenInp = document.getElementById('loginUser');
    const labelSpan = document.getElementById('loginUserSelectedLabel');
    const menu = document.getElementById('loginUserDropdownMenu');
    const arrow = document.getElementById('loginUserArrow');
    if (hiddenInp) hiddenInp.value = username;
    if (labelSpan) labelSpan.innerText = label;
    if (menu) menu.classList.add('hidden');
    if (arrow) arrow.style.transform = 'rotate(0deg)';
    document.getElementById('loginPass')?.focus();
}

async function loadServantsListForLogin() {
    try {
        const res = await fetch(`${API_URL}?sheet=Servants_List`);
        const data = await res.json();
        const listData = (data.status === "success" && Array.isArray(data.data)) ? data.data : [];
        if (listData.length > 0) {
            loginUsersList = [{ username: "admin", label: "الأدمن" }];
            listData.forEach(s => {
                if (s.Username && s.Username !== "admin" && s.Status !== "موقوف") {
                    const cleanName = String(s.ServantName || s.Username).replace(/\s*\([^)]*\)/g, '').trim();
                    loginUsersList.push({ username: String(s.Username).trim(), label: cleanName });
                }
            });
            renderLoginUserOptions('');
            return;
        }
    } catch(e) {}

    // احتياطي في حال كان السكربت يستخدم ?sheet=Servants
    try {
        const res = await fetch(`${API_URL}?sheet=Servants`);
        const data = await res.json();
        if (data.status === "success" && Array.isArray(data.data) && data.data.length > 0) {
            servantsCacheData = data.data;
            loginUsersList = [{ username: "admin", label: "الأدمن" }];
            data.data.forEach(s => {
                if (s.Username && s.Username !== "admin" && s.Status !== "موقوف") {
                    const cleanName = String(s.ServantName || s.Username).replace(/\s*\([^)]*\)/g, '').trim();
                    loginUsersList.push({ username: String(s.Username).trim(), label: cleanName });
                }
            });
            renderLoginUserOptions('');
        }
    } catch(e) {}
}

async function handleLogin(e) {
    if (e) { try { e.preventDefault(); e.stopPropagation(); } catch(err) {} }
    const btn = document.getElementById('loginBtn'), err = document.getElementById('loginError');
    const userVal = (document.getElementById('loginUser')?.value || "").trim(), passVal = (document.getElementById('loginPass')?.value || "").trim();
    if (!passVal) return false;
    if (btn) { btn.disabled = true; btn.innerHTML = `جاري التحقق من السيرفر...`; }
    if (err) err.classList.add('hidden');

    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'login', data: { username: userVal, password: passVal } }) });
        const data = await res.json();
        if (data.status === "success" && data.user) {
            currentUser = data.user;
            sessionToken = data.token || `local_${Date.now()}`;
            sessionStorage.setItem('church_current_user', JSON.stringify(currentUser));
            sessionStorage.setItem('church_session_token', sessionToken);
            initApp(false);
            return false;
        } else if (err) {
            err.innerText = data.message || "اسم المستخدم أو كلمة المرور غير صحيحة";
            err.classList.remove('hidden');
        }
    } catch (error) {
        if (err) { err.innerText = "تعذر الاتصال بالسيرفر، تأكد من الإنترنت وحاول مرة أخرى."; err.classList.remove('hidden'); }
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "تسجيل الدخول"; }
    }
    return false;
}

function logout() {
    sendAuditLog("تسجيل خروج", "النظام", "قام الخادم بتسجيل الخروج");
    sessionStorage.removeItem('church_current_user');
    sessionStorage.removeItem('church_session_token');
    setTimeout(() => location.reload(), 200);
}

// 6. تهيئة التطبيق وتوجيه لوحة التحكم
function initApp(isRestoredSession = false) {
    const login = document.getElementById('loginScreen'), badge = document.getElementById('userBadge');
    if (login) { login.style.display = 'none'; login.classList.add('hidden'); }
    if (badge && currentUser) badge.innerHTML = `<span>الخادم: <span class="font-black text-indigo-700">${currentUser.ServantName}</span></span> <span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded ml-2 font-mono text-[11px] font-bold border border-indigo-200">${currentUser.Role}</span>`;
    buildDashboard();
    showDashboard();
    if (!isRestoredSession) {
        sendAuditLog("تسجيل دخول", "النظام", "تم تسجيل الدخول بنجاح");
    }
}

function buildDashboard() {
    const grid = document.getElementById('dashboardGrid');
    if (!grid || !currentUser) return;
    grid.innerHTML = "";
    const visibleKeys = Object.keys(TABS_INFO).filter(k => TABS_INFO[k].roles.includes(currentUser.Role));
    grid.className = `grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-${Math.min(visibleKeys.length, 6)} gap-4 w-full`;
    visibleKeys.forEach(key => {
        const info = TABS_INFO[key];
        const card = document.createElement('div');
        card.className = `group relative overflow-hidden bg-white/90 backdrop-blur-md rounded-3xl p-5 flex flex-col items-center justify-center text-center cursor-pointer transition-all duration-300 hover:-translate-y-2 hover:shadow-[0_20px_40px_-15px_rgba(15,23,42,0.14)] border border-slate-200/80 hover:border-indigo-300 min-h-[210px]`;
        card.onclick = () => loadSection(key);
        card.innerHTML = `
            <div class="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r ${info.accent} opacity-80 group-hover:opacity-100 transition-opacity"></div>
            <div class="mb-4 p-3.5 rounded-2xl ${info.iconBg} ring-1 group-hover:scale-110 transition-transform duration-300 shadow-xs">${info.svg}</div>
            <h3 class="text-base font-black text-slate-800 mb-1.5 ${info.hoverText} transition-colors leading-snug">${info.label}</h3>
            <p class="text-[11px] text-slate-500 font-bold leading-relaxed">${info.desc}</p>
        `;
        grid.appendChild(card);
    });
}

function showDashboard() { document.getElementById('dataView')?.classList.add('hidden'); document.getElementById('dashboardView')?.classList.remove('hidden'); currentTab = ""; }

function loadSection(sectionKey) {
    currentTab = sectionKey;
    document.getElementById('dashboardView')?.classList.add('hidden');
    document.getElementById('dataView')?.classList.remove('hidden');
    const info = TABS_INFO[sectionKey];
    if (info) document.getElementById('currentTabTitle').innerHTML = `${info.label}`;

    ['namesViewSwitcher', 'ssViewSwitcher', 'meetingsViewSwitcher', 'visitationsViewSwitcher'].forEach(id => { const el = document.getElementById(id); el?.classList.add('hidden'); el?.classList.remove('flex'); });
    ['sundaySchoolLiveSection', 'sundaySchoolChartsSection', 'servantsMeetingLiveSection', 'visitationDashboardSection', 'namesRosterSection', 'namesFilterSection', 'namesPlaceholder', 'familyResultsContainer', 'standardSearchContainer', 'standardCardsContainer'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.add('hidden'); if (id === 'sundaySchoolChartsSection') el.style.display = 'none'; }
    });
    ['btnPrintSundaySchool', 'btnPrintMeetings', 'btnPrintFiltered', 'btnPrintRoster', 'btnPrintVisitReport'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    
    const btnAdd = document.getElementById('btnAddNewRecord');
    if (btnAdd) {
        if (sectionKey === 'Audit_Log') btnAdd.classList.add('hidden');
        else btnAdd.classList.remove('hidden');
    }

    if (sectionKey === 'Names') { const sw = document.getElementById('namesViewSwitcher'); sw?.classList.remove('hidden'); sw?.classList.add('flex'); switchNamesView('roster'); }
    else if (sectionKey === 'Sunday_School') { const sw = document.getElementById('ssViewSwitcher'); sw?.classList.remove('hidden'); sw?.classList.add('flex'); document.getElementById('btnPrintSundaySchool')?.classList.remove('hidden'); switchSSView('live'); }
    else if (sectionKey === 'Meetings_Attendance') { const sw = document.getElementById('meetingsViewSwitcher'); sw?.classList.remove('hidden'); sw?.classList.add('flex'); document.getElementById('btnPrintMeetings')?.classList.remove('hidden'); switchMeetingsView('live'); }
    else if (sectionKey === 'Visitations') { const sw = document.getElementById('visitationsViewSwitcher'); sw?.classList.remove('hidden'); sw?.classList.add('flex'); document.getElementById('btnPrintVisitReport')?.classList.remove('hidden'); switchVisitationsView('dashboard'); }
    else { document.getElementById('standardSearchContainer')?.classList.remove('hidden'); document.getElementById('standardCardsContainer')?.classList.remove('hidden'); const sInp = document.getElementById('searchInput'); if (sInp) sInp.value = ""; }
    loadData();
}

// 7. قسم الأعضاء والعائلات والفرز
function switchNamesView(viewName) {
    currentNamesView = viewName;
    const btnRoster = document.getElementById('btnViewRoster'), btnFilters = document.getElementById('btnViewFilters');
    const rosterSec = document.getElementById('namesRosterSection'), filterSec = document.getElementById('namesFilterSection');
    const resultsSec = document.getElementById('familyResultsContainer'), placeholderSec = document.getElementById('namesPlaceholder');
    const btnFiltered = document.getElementById('btnPrintFiltered'), btnRosterPrint = document.getElementById('btnPrintRoster');

    if (viewName === 'roster') {
        if (btnRoster) btnRoster.className = "px-4 py-2 rounded-lg text-xs font-black transition bg-white text-indigo-700 shadow-sm";
        if (btnFilters) btnFilters.className = "px-4 py-2 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
        rosterSec?.classList.remove('hidden'); filterSec?.classList.add('hidden'); resultsSec?.classList.add('hidden'); placeholderSec?.classList.add('hidden');
        btnRosterPrint?.classList.remove('hidden'); btnFiltered?.classList.add('hidden');
        buildAlphabetBar(); renderFamilyHeadsRoster();
    } else {
        if (btnFilters) btnFilters.className = "px-4 py-2 rounded-lg text-xs font-black transition bg-white text-indigo-700 shadow-sm";
        if (btnRoster) btnRoster.className = "px-4 py-2 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
        rosterSec?.classList.add('hidden'); filterSec?.classList.remove('hidden'); resultsSec?.classList.remove('hidden');
        btnFiltered?.classList.remove('hidden'); btnRosterPrint?.classList.add('hidden');
        populateAreasDropdown(); resetNamesFilters();
    }
}

function buildAlphabetBar() {
    const bar = document.getElementById('alphabetBar');
    if (!bar) return;
    const firstLetters = new Set();
    rawData.forEach(r => { const head = normalizeArabic(String(r["اسم رب الاسرة"] || "").trim()); if (head) firstLetters.add(head[0]); });
    const arabicAlphabet = ["الكل", "ا", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "هـ", "و", "ي"];
    bar.innerHTML = "";
    arabicAlphabet.forEach(letter => {
        const normChar = normalizeArabic(letter)[0];
        const hasFamilies = letter === "الكل" || firstLetters.has(normChar);
        const btn = document.createElement('button');
        btn.className = `alpha-pill ${selectedLetter === letter ? 'active' : ''} ${!hasFamilies ? 'opacity-30 cursor-not-allowed' : ''}`;
        btn.innerText = letter;
        if (hasFamilies) { btn.onclick = () => { selectedLetter = letter; document.querySelectorAll('.alpha-pill').forEach(p => p.classList.remove('active')); btn.classList.add('active'); renderFamilyHeadsRoster(); }; }
        bar.appendChild(btn);
    });
}

function normalizeArabic(text) { return String(text || "").trim().replace(/ـ/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").replace(/\s+/g, " "); }
function filterRoster() { renderFamilyHeadsRoster(); }

function getFieldValNormalized(obj, targetKey) {
    if (!obj) return "";
    if (obj[targetKey] !== undefined && obj[targetKey] !== null && String(obj[targetKey]).trim() !== "") {
        return String(obj[targetKey]).trim();
    }
    const normTarget = normalizeArabic(targetKey);
    for (const k of Object.keys(obj)) {
        if (normalizeArabic(k) === normTarget && obj[k] !== undefined && obj[k] !== null && String(obj[k]).trim() !== "") {
            return String(obj[k]).trim();
        }
    }
    return "";
}

function getMemberArea(item) {
    if (!item) return "";
    const direct = getFieldValNormalized(item, "المنطقة");
    if (direct) return direct;
    for (const k of Object.keys(item)) {
        const nk = normalizeArabic(k);
        if ((nk.includes("منطق") || nk === "الحي") && item[k] !== undefined && item[k] !== null) {
            const v = String(item[k]).trim();
            if (v && v !== "-") return v;
        }
    }
    return "";
}

function buildFamilyAreaMap() {
    const map = {};
    rawData.forEach(r => {
        const head = normalizeArabic(getFieldValNormalized(r, "اسم رب الاسرة"));
        const area = getMemberArea(r);
        if (head && area && !map[head]) {
            map[head] = area;
        }
    });
    return map;
}

function populateAreasDropdown() {
    const areaSelect = document.getElementById('filterArea');
    if (!areaSelect) return;
    const prevVal = areaSelect.value;
    let areas = new Set();
    if (Array.isArray(backendAreas)) {
        backendAreas.forEach(a => { const clean = String(a || "").trim(); if (clean && clean !== "-") areas.add(clean); });
    }
    rawData.forEach(item => {
        const a = getMemberArea(item);
        if (a) areas.add(a);
    });
    const sortedAreas = Array.from(areas).sort((a, b) => a.localeCompare(b, 'ar'));
    areaSelect.innerHTML = `<option value="">كل المناطق السكنية (${sortedAreas.length})</option>` + sortedAreas.map(a => `<option value="${a}">${a}</option>`).join('');
    if (prevVal && sortedAreas.includes(prevVal)) areaSelect.value = prevVal;
    const areasDl = document.getElementById('areasDatalist');
    if (areasDl) areasDl.innerHTML = sortedAreas.map(a => `<option value="${a}">`).join('');
}

function isMemberDeceased(member) {
    const deathDate = String(member["تاريخ الوفاة"] || "").trim(), status = String(member["حالة القيد"] || "").trim();
    return (deathDate !== "" && deathDate !== "-" && deathDate !== "لا يوجد") || status.includes("متوف") || status.includes("منتقل");
}

function parseDateForSort(dStr) {
    if (!dStr) return new Date(0);
    const str = String(dStr).trim();
    const parts = str.split('/');
    if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
    return new Date(str);
}

function getLastFamilyVisitDate(familyMembers) {
    if (!visitationsData || visitationsData.length === 0) return "لا يوجد سجل";
    const memberNames = familyMembers.map(m => m["الاسم ثلاثي"]), memberIds = familyMembers.map(m => String(m["ID"]));
    const familyVisits = visitationsData.filter(v => memberNames.includes(v.MemberName) || memberIds.includes(String(v.MemberID)));
    if (familyVisits.length === 0) return "لم يُفتقد بعد";
    familyVisits.sort((a, b) => parseDateForSort(b.VisitDate) - parseDateForSort(a.VisitDate));
    return familyVisits[0].VisitDate || "لم يُفتقد بعد";
}

function quickAddMemberToFamily(familyHeadName) {
    openModal('add');
    const radio = document.querySelector('input[name="addMode"][value="add_member"]');
    if (radio) { radio.checked = true; toggleAddMode('add_member'); }
    const headInput = document.querySelector('input[name="اسم رب الاسرة"]');
    if (headInput) headInput.value = familyHeadName;
}

function renderFamilyHeadsRoster() {
    const container = document.getElementById('rosterCardsContainer');
    if (!container) return;
    container.innerHTML = "";
    const query = (document.getElementById('rosterSearchInput')?.value || "").trim().toLowerCase();

    let familiesMap = {};
    rawData.forEach(member => {
        const headName = String(member["اسم رب الاسرة"] || "").trim();
        if (!headName) return;
        if (!familiesMap[headName]) familiesMap[headName] = [];
        familiesMap[headName].push(member);
    });

    let sortedHeadNames = Object.keys(familiesMap).sort((a, b) => a.localeCompare(b, 'ar'));
    let filteredHeadNames = sortedHeadNames.filter(head => {
        const normHead = normalizeArabic(head).toLowerCase();
        if (selectedLetter !== "الكل" && normHead[0] !== normalizeArabic(selectedLetter)[0]) return false;
        if (query) {
            const hasHeadMatch = normHead.includes(normalizeArabic(query).toLowerCase());
            const hasMemberMatch = familiesMap[head].some(m => normalizeArabic(m["الاسم ثلاثي"]).toLowerCase().includes(normalizeArabic(query).toLowerCase()));
            if (!hasHeadMatch && !hasMemberMatch) return false;
        }
        return true;
    });

    const recCount = document.getElementById('recordCount');
    if (recCount) recCount.innerText = `${filteredHeadNames.length} أسرة`;
    if (filteredHeadNames.length === 0) { container.innerHTML = `<div class="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400 font-bold">لم يتم العثور على أرباب أسر مطابقين</div>`; return; }

    filteredHeadNames.forEach((headName, index) => {
        const familyMembers = familiesMap[headName];
        const headMemberRecord = familyMembers.find(m => m["الاسم ثلاثي"] === headName || m["صلة القرابة"] === "زوج" || m["صلة القرابة"] === "رب أسرة") || familyMembers[0];
        const headId = headMemberRecord ? (headMemberRecord["ID"] || headMemberRecord[Object.keys(headMemberRecord)[0]]) : null;
        const area = (headMemberRecord ? getMemberArea(headMemberRecord) : "") || (familyMembers.map(m => getMemberArea(m)).find(Boolean)) || "غير محددة";
        const phone = headMemberRecord ? (headMemberRecord["هاتف الاسرة"] || headMemberRecord["تليفون العمل/المحمول"] || "-") : "-";
        const lastVisit = getLastFamilyVisitDate(familyMembers);

        const card = document.createElement('div');
        card.className = "roster-card bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden";
        card.innerHTML = `
            <div class="p-3 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-slate-50/60 border-b border-slate-100">
                <div class="flex items-center gap-2.5">
                    <span class="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs">${index + 1}</span>
                    <div>
                        <div class="flex items-center gap-2 flex-wrap"><h3 class="text-sm font-black text-slate-800">${headName}</h3><span class="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full text-[10px] font-bold">${familyMembers.length} أفراد</span></div>
                        <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 font-semibold mt-0.5"><span>📍 المنطقة: <strong class="text-slate-700">${area}</strong></span><span>📞 هاتف: <strong class="text-slate-700 font-mono">${phone}</strong></span><span>🗓 آخر افتقاد: <strong class="text-rose-600">${lastVisit}</strong></span></div>
                    </div>
                </div>
                <div class="flex items-center gap-1.5 w-full md:w-auto justify-end flex-wrap no-print">
                    ${renderContactButtons(phone)}
                    <button onclick="toggleFamilyAccordion(${index})" id="btn_toggle_${index}" class="text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl transition flex items-center gap-1 shadow-sm"><span>أفراد الأسرة</span><svg id="icon_toggle_${index}" class="w-3.5 h-3.5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg></button>
                    ${headId ? `<button onclick="editRecord(${headId})" class="text-xs font-bold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 px-2.5 py-1.5 rounded-xl transition">✏️ تعديل</button>` : ''}
                    <button onclick="quickAddMemberToFamily('${headName.replace(/'/g, "\\'")}')" class="text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-xl transition">+ فرد</button>
                </div>
            </div>
            <div id="accordion_${index}" class="members-accordion bg-white" style="display: none; max-height: 0px; overflow: hidden;">
                <div class="p-3 sm:p-4 space-y-2 divide-y divide-slate-100">
                    ${familyMembers.map(member => {
                        const mId = member["ID"] || member[Object.keys(member)[0]], age = calculateAge(member["تاريخ الميلاد"], member["الرقم القومي"]), deceased = isMemberDeceased(member);
                        return `
                            <div class="pt-2 first:pt-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                                <div class="flex items-start gap-2">
                                    <span class="text-xs font-mono font-bold text-slate-400 mt-0.5">#${mId}</span>
                                    <div>
                                        <div class="flex items-center gap-1.5 flex-wrap mb-0.5"><h4 class="text-xs font-black text-slate-800">${member["الاسم ثلاثي"] || "-"}</h4><span class="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">${member["صلة القرابة"] || "عضو"}</span><span class="text-[10px] ${member["ذكر/انثي"]==='ذكر'?'bg-blue-50 text-blue-700':'bg-pink-50 text-pink-700'} px-1.5 py-0.5 rounded font-bold">${member["ذكر/انثي"] || "-"}</span><span class="text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded font-bold">${member["الحالة الاجتماعية"] || "-"}</span>${deceased ? '<span class="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-bold">منتقل ☩</span>' : ''}</div>
                                        <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500 font-semibold"><span>العمر: <strong class="text-slate-700">${age !== null ? age + ' سنة' : '-'}</strong></span><span>المحمول: ${member["تليفون العمل/المحمول"] || "-"}</span><span>المرحلة: ${member["المرحلة"] || "-"} (${member["الصف"] || "-"})</span><span>آخر اعتراف: <strong class="text-indigo-600">${member["تاريخ اخر اعتراف"] || "-"}</strong> (${member["اب الاعتراف"] || "-"})</span></div>
                                    </div>
                                </div>
                                <div class="flex items-center gap-1.5 w-full md:w-auto justify-end no-print">
                                    ${renderContactButtons(member["تليفون العمل/المحمول"])}
                                    <button onclick="editRecord(${mId})" class="text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-2 py-1 rounded-lg transition">تعديل</button>
                                    ${currentUser.Role === "Admin" ? `<button onclick="deleteRecord(${mId})" class="text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 px-2 py-1 rounded-lg transition">حذف</button>` : ''}
                                </div>
                            </div>
                        `;
                    }).join('')}
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function toggleFamilyAccordion(index) {
    const acc = document.getElementById(`accordion_${index}`), icon = document.getElementById(`icon_toggle_${index}`);
    if (!acc) return;
    const isOpen = acc.classList.contains('open') || acc.style.display === 'block';
    if (isOpen) {
        acc.classList.remove('open');
        acc.style.maxHeight = '0px';
        acc.style.display = 'none';
        if (icon) icon.style.transform = "rotate(0deg)";
    } else {
        acc.classList.add('open');
        acc.style.display = 'block';
        acc.style.maxHeight = '5000px';
        if (icon) icon.style.transform = "rotate(180deg)";
    }
}

function expandAllFamilies(expand = true) {
    document.querySelectorAll('.members-accordion').forEach((acc, idx) => {
        const icon = document.getElementById(`icon_toggle_${idx}`);
        if (expand) {
            acc.classList.add('open');
            acc.style.display = 'block';
            acc.style.maxHeight = '5000px';
            if (icon) icon.style.transform = "rotate(180deg)";
        } else {
            acc.classList.remove('open');
            acc.style.maxHeight = '0px';
            acc.style.display = 'none';
            if (icon) icon.style.transform = "rotate(0deg)";
        }
    });
}

function resetNamesFilters() {
    ['filterFamilyHead', 'filterFullName', 'filterArea', 'filterAgeGroup', 'filterGender', 'filterElection', 'filterMarital'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });
    const fd = document.getElementById('filterDeceased'); if (fd) fd.value = "alive";
    const cont = document.getElementById('familyResultsContainer'); if (cont) cont.innerHTML = "";
    document.getElementById('namesPlaceholder')?.classList.remove('hidden');
    const countBadge = document.getElementById('recordCount'); if (countBadge) countBadge.innerText = "0 سجل";
}

function applyNamesFilter() {
    const headQ = (document.getElementById('filterFamilyHead')?.value || "").trim().toLowerCase(), nameQ = (document.getElementById('filterFullName')?.value || "").trim().toLowerCase();
    const areaQ = (document.getElementById('filterArea')?.value || "").trim(), ageGroupQ = document.getElementById('filterAgeGroup')?.value || "";
    const genderQ = document.getElementById('filterGender')?.value || "", electionQ = document.getElementById('filterElection')?.value || "";
    const maritalQ = document.getElementById('filterMarital')?.value || "", deceasedQ = document.getElementById('filterDeceased')?.value || "alive";

    const hasActiveFilter = headQ || nameQ || areaQ || ageGroupQ || genderQ || electionQ || maritalQ || (deceasedQ !== "alive");
    if (!hasActiveFilter) {
        const cont = document.getElementById('familyResultsContainer'); if (cont) cont.innerHTML = "";
        document.getElementById('namesPlaceholder')?.classList.remove('hidden');
        const countBadge = document.getElementById('recordCount'); if (countBadge) countBadge.innerText = "0 سجل";
        return;
    }

    document.getElementById('namesPlaceholder')?.classList.add('hidden');
    const container = document.getElementById('familyResultsContainer');
    if (!container) return;
    container.innerHTML = "";

    const familyAreaMap = buildFamilyAreaMap();
    const matchedMembers = rawData.filter(item => {
        const deceased = isMemberDeceased(item);
        if (deceasedQ === "alive" && deceased) return false;
        if (deceasedQ === "deceased" && !deceased) return false;
        const memberArea = getMemberArea(item) || familyAreaMap[normalizeArabic(getFieldValNormalized(item, "اسم رب الاسرة"))] || "";
        if (areaQ && normalizeArabic(memberArea) !== normalizeArabic(areaQ)) return false;
        if (genderQ && item["ذكر/انثي"] !== genderQ) return false;
        if (maritalQ && (item["الحالة الاجتماعية"] || "").trim() !== maritalQ) return false;
        if (electionQ && (item["البطاقة الانتخابية"] || "").trim() !== electionQ) return false;
        if (ageGroupQ) {
            const age = calculateAge(item["تاريخ الميلاد"], item["الرقم القومي"]);
            if (age === null) return false;
            if (ageGroupQ === "children" && age >= 12) return false;
            if (ageGroupQ === "prep" && (age < 12 || age > 15)) return false;
            if (ageGroupQ === "sec" && (age < 16 || age > 18)) return false;
            if (ageGroupQ === "youth" && (age < 19 || age > 25)) return false;
            if (ageGroupQ === "adults" && (age < 26 || age > 50)) return false;
            if (ageGroupQ === "seniors" && age <= 50) return false;
        }
        if (headQ && !String(item["اسم رب الاسرة"] || "").toLowerCase().includes(headQ)) return false;
        if (nameQ && !String(item["الاسم ثلاثي"] || "").toLowerCase().includes(nameQ)) return false;
        return true;
    });

    const countBadge = document.getElementById('recordCount');
    if (countBadge) countBadge.innerText = `${matchedMembers.length} فرد مطابق`;
    if (matchedMembers.length === 0) { container.innerHTML = `<div class="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400 font-bold">لم يتم العثور على أفراد مطابقين لشروط الفرز المحددة</div>`; return; }

    matchedMembers.forEach(member => {
        const idVal = member["ID"] || member[Object.keys(member)[0]], age = calculateAge(member["تاريخ الميلاد"], member["الرقم القومي"]), deceased = isMemberDeceased(member), deathDate = member["تاريخ الوفاة"] || "";
        const card = document.createElement('div');
        card.className = `bg-white rounded-2xl p-4 shadow-sm border transition ${deceased ? 'border-purple-300 bg-purple-50/20' : 'border-slate-200 hover:border-indigo-400'}`;
        const genderBadge = member["ذكر/انثي"] === "ذكر" ? `<span class="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-[11px] font-bold">ذكر</span>` : `<span class="bg-pink-50 text-pink-700 border border-pink-200 px-2 py-0.5 rounded-full text-[11px] font-bold">انثي</span>`;
        const deceasedBadge = deceased ? `<span class="bg-purple-100 text-purple-800 border border-purple-300 px-2 py-0.5 rounded-full text-[11px] font-black">منتقل ☩ (${deathDate || 'التاريخ غير مسجل'})</span>` : '';

        card.innerHTML = `
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-3 pb-2 border-b border-slate-100">
                <div>
                    <div class="flex items-center gap-2 mb-0.5 flex-wrap"><span class="text-xs font-mono font-bold text-slate-400">#${idVal}</span><h3 class="text-sm font-black text-slate-800">${member["الاسم ثلاثي"]}</h3><span class="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold border">${member["صلة القرابة"] || "عضو"}</span>${genderBadge}<span class="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">${member["الحالة الاجتماعية"] || "-"}</span>${deceasedBadge}</div>
                    <p class="text-xs text-indigo-700 font-bold">🏠 الأسرة: <strong>${member["اسم رب الاسرة"] || "غير محدد"}</strong> | 📍 المنطقة: <strong class="text-slate-800">${getMemberArea(member) || familyAreaMap[normalizeArabic(getFieldValNormalized(member, "اسم رب الاسرة"))] || "غير محددة"}</strong></p>
                </div>
                <div class="flex items-center gap-2 no-print flex-wrap w-full md:w-auto justify-end">${renderContactButtons(member["تليفون العمل/المحمول"])}<button onclick="editRecord(${idVal})" class="text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-xl transition">تعديل</button>${currentUser.Role === "Admin" ? `<button onclick="deleteRecord(${idVal})" class="text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded-xl transition">حذف</button>` : ''}</div>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs font-semibold">
                <div class="bg-slate-50 p-2 rounded-xl border"><span class="block text-slate-400 text-[10px] mb-0.5">العمر</span><strong class="text-slate-800">${age !== null ? age + ' سنة' : '-'}</strong></div>
                <div class="bg-slate-50 p-2 rounded-xl border"><span class="block text-slate-400 text-[10px] mb-0.5">المحمول</span><strong class="text-slate-800 font-mono">${member["تليفون العمل/المحمول"] || "-"}</strong></div>
                <div class="bg-slate-50 p-2 rounded-xl border"><span class="block text-slate-400 text-[10px] mb-0.5">المرحلة والصف</span><strong class="text-slate-800">${member["المرحلة"] || "-"} (${member["الصف"] || "-"})</strong></div>
                <div class="bg-amber-50/50 p-2 rounded-xl border border-amber-200"><span class="block text-amber-700 text-[10px] mb-0.5">آخر اعتراف</span><strong class="text-amber-900">${member["تاريخ اخر اعتراف"] || "لم يسجل"}</strong></div>
                <div class="bg-slate-50 p-2 rounded-xl border"><span class="block text-slate-400 text-[10px] mb-0.5">أب الاعتراف</span><strong class="text-slate-800">${member["اب الاعتراف"] || "-"}</strong></div>
            </div>
        `;
        container.appendChild(card);
    });
}

function printFilteredResults() {
    const headQ = (document.getElementById('filterFamilyHead')?.value || "").trim().toLowerCase(), nameQ = (document.getElementById('filterFullName')?.value || "").trim().toLowerCase();
    const areaQ = (document.getElementById('filterArea')?.value || "").trim(), ageGroupQ = document.getElementById('filterAgeGroup')?.value || "";
    const genderQ = document.getElementById('filterGender')?.value || "", electionQ = document.getElementById('filterElection')?.value || "";
    const maritalQ = document.getElementById('filterMarital')?.value || "", deceasedQ = document.getElementById('filterDeceased')?.value || "alive";

    const familyAreaMap = buildFamilyAreaMap();
    const matchedMembers = rawData.filter(item => {
        const deceased = isMemberDeceased(item);
        if (deceasedQ === "alive" && deceased) return false; if (deceasedQ === "deceased" && !deceased) return false;
        const memberArea = getMemberArea(item) || familyAreaMap[normalizeArabic(getFieldValNormalized(item, "اسم رب الاسرة"))] || "";
        if (areaQ && normalizeArabic(memberArea) !== normalizeArabic(areaQ)) return false; if (genderQ && item["ذكر/انثي"] !== genderQ) return false;
        if (maritalQ && (item["الحالة الاجتماعية"] || "").trim() !== maritalQ) return false; if (electionQ && (item["البطاقة الانتخابية"] || "").trim() !== electionQ) return false;
        if (ageGroupQ) {
            const age = calculateAge(item["تاريخ الميلاد"], item["الرقم القومي"]);
            if (age === null) return false;
            if (ageGroupQ === "children" && age >= 12) return false; if (ageGroupQ === "prep" && (age < 12 || age > 15)) return false;
            if (ageGroupQ === "sec" && (age < 16 || age > 18)) return false; if (ageGroupQ === "youth" && (age < 19 || age > 25)) return false;
            if (ageGroupQ === "adults" && (age < 26 || age > 50)) return false; if (ageGroupQ === "seniors" && age <= 50) return false;
        }
        if (headQ && !String(item["اسم رب الاسرة"] || "").toLowerCase().includes(headQ)) return false;
        if (nameQ && !String(item["الاسم ثلاثي"] || "").toLowerCase().includes(nameQ)) return false;
        return true;
    });
    if (matchedMembers.length === 0) { alert("لا توجد سجلات مطابقة للفرز المحدد للطباعة!"); return; }

    const familiesMap = {};
    matchedMembers.forEach(m => { const head = (m["اسم رب الاسرة"] || "").trim(); if (!head) return; if (!familiesMap[head]) familiesMap[head] = []; familiesMap[head].push(m); });
    const areaVal = areaQ || "كل المناطق", ageVal = document.getElementById('filterAgeGroup')?.options[document.getElementById('filterAgeGroup')?.selectedIndex]?.text || "كل الأعمار", statusVal = document.getElementById('filterDeceased')?.options[document.getElementById('filterDeceased')?.selectedIndex]?.text || "الأحياء";
    buildAndPrintFamilies(familiesMap, `بيان فرز السجلات: [${areaVal} - ${ageVal} - ${statusVal}]`);
}

function printRosterDirectory() {
    const query = (document.getElementById('rosterSearchInput')?.value || "").trim().toLowerCase();
    const familiesMap = {};
    rawData.forEach(m => {
        const head = (m["اسم رب الاسرة"] || "").trim(); if (!head) return;
        const normHead = normalizeArabic(head).toLowerCase();
        if (selectedLetter !== "الكل" && normHead[0] !== normalizeArabic(selectedLetter)[0]) return;
        if (query) { const hasHeadMatch = normHead.includes(normalizeArabic(query).toLowerCase()), hasMemberMatch = normalizeArabic(m["الاسم ثلاثي"]).toLowerCase().includes(normalizeArabic(query).toLowerCase()); if (!hasHeadMatch && !hasMemberMatch) return; }
        if (!familiesMap[head]) familiesMap[head] = []; familiesMap[head].push(m);
    });
    buildAndPrintFamilies(familiesMap, `دليل أرباب الأسر والعائلات الأبجدي (حرف: ${selectedLetter})`);
}

// 8. قسم مدارس الأحد (الكشوف + الإحصائيات + الرسوم البيانية ذاتية الإنشاء)
function ensureChartsSectionExists() {
    let chartsSec = document.getElementById('sundaySchoolChartsSection');
    const dataView = document.getElementById('dataView');
    if (!chartsSec) {
        chartsSec = document.createElement('div');
        chartsSec.id = 'sundaySchoolChartsSection';
        chartsSec.className = 'hidden space-y-6 no-print mt-4';
        chartsSec.innerHTML = `
            <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-wrap items-center justify-between gap-3">
                <div class="flex items-center gap-2 flex-wrap" id="ssChartsStageTabs"></div>
                <span id="ssChartsScopeBadge" class="text-xs font-black bg-indigo-50 text-indigo-700 border border-indigo-200 px-3 py-1.5 rounded-xl"></span>
            </div>
            <div id="ssChartsEmpty" class="hidden text-center py-16 text-slate-400 font-bold bg-white rounded-2xl border border-dashed border-slate-300">لا توجد سجلات حضور مسجلة لهذا النطاق لعرض الرسوم البيانية.</div>
            <div id="ssChartsContainer" class="hidden space-y-6">
                <div id="ssChartsKpiCards" class="grid grid-cols-2 lg:grid-cols-4 gap-4"></div>
                <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><h3 class="text-sm font-black text-slate-800 mb-3 text-center">نسبة الحضور والغياب الإجمالية</h3><div class="relative w-full h-[280px] flex items-center justify-center"><canvas id="attPieChart"></canvas></div></div>
                    <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><h3 class="text-sm font-black text-slate-800 mb-3 text-center">نسب الأولاد والبنات في الحضور والغياب</h3><div class="relative w-full h-[280px]"><canvas id="genderBarChart"></canvas></div></div>
                </div>
                <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><h3 id="stageChartTitle" class="text-sm font-black text-slate-800 mb-3">تحليل الحضور والغياب حسب الصفوف والمراحل</h3><div class="relative w-full h-[360px]"><canvas id="stageBarChart"></canvas></div></div>
                <div class="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm"><h3 id="genderGradeChartTitle" class="text-sm font-black text-slate-800 mb-3">نسب حضور الأولاد والبنات داخل كل صف دراسي</h3><div class="relative w-full h-[380px]"><canvas id="genderByGradeChart"></canvas></div></div>
                <div class="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden"><div class="p-4 border-b border-slate-100 bg-slate-50"><h3 class="text-sm font-black text-slate-800">جدول النسب المئوية التفصيلي</h3></div><div class="overflow-x-auto nice-scrollbar"><table class="w-full text-right text-xs"><thead class="bg-slate-100 text-slate-700 font-black border-b border-slate-200"><tr><th class="p-3">المرحلة / الصف</th><th class="p-3 text-center">إجمالي السجلات</th><th class="p-3 text-center text-emerald-700">نسبة الحضور</th><th class="p-3 text-center text-rose-700">نسبة الغياب</th><th class="p-3 text-center text-blue-700">حضور الأولاد</th><th class="p-3 text-center text-pink-700">حضور البنات</th></tr></thead><tbody id="ssChartsSummaryTableBody" class="divide-y divide-slate-100 font-bold"></tbody></table></div></div>
            </div>
        `;
        if (dataView) dataView.appendChild(chartsSec);
    }
    return chartsSec;
}

function ensureChartJsLoaded() {
    return new Promise((resolve, reject) => {
        if (typeof Chart !== 'undefined') return resolve();
        const s = document.createElement('script');
        s.src = "https://cdn.jsdelivr.net/npm/chart.js";
        s.onload = () => resolve();
        s.onerror = () => {
            const fallback = document.createElement('script');
            fallback.src = "https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js";
            fallback.onload = () => resolve();
            fallback.onerror = () => reject(new Error("تعذر تحميل مكتبة الرسوم البيانية، تأكد من الاتصال بالإنترنت"));
            document.head.appendChild(fallback);
        };
        document.head.appendChild(s);
    });
}

function switchSSView(view) {
    currentSSView = view;
    const btnLive = document.getElementById('btnSSLiveRoster'), btnHist = document.getElementById('btnSSHistory'), btnCharts = document.getElementById('btnSSCharts');
    const liveSec = document.getElementById('sundaySchoolLiveSection'), cardsSec = document.getElementById('standardCardsContainer');
    const searchSec = document.getElementById('standardSearchContainer'), chartsSec = ensureChartsSectionExists();
    const btnAdd = document.getElementById('btnAddNewRecord');

    [btnLive, btnHist, btnCharts].forEach(btn => { if (btn) btn.className = "px-4 py-2 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900"; });
    liveSec?.classList.add('hidden'); cardsSec?.classList.add('hidden'); searchSec?.classList.add('hidden');
    if (chartsSec) { chartsSec.classList.add('hidden'); chartsSec.style.display = 'none'; }
    btnAdd?.classList.add('hidden');

    if (view === 'live') { if (btnLive) btnLive.className = "px-4 py-2 rounded-lg text-xs font-black transition bg-white text-blue-700 shadow-sm"; liveSec?.classList.remove('hidden'); initSundaySchoolLiveView(); }
    else if (view === 'history') { if (btnHist) btnHist.className = "px-4 py-2 rounded-lg text-xs font-black transition bg-white text-blue-700 shadow-sm"; cardsSec?.classList.remove('hidden'); searchSec?.classList.remove('hidden'); btnAdd?.classList.remove('hidden'); renderStandardCards(); }
    else if (view === 'charts') { if (btnCharts) btnCharts.className = "px-4 py-2 rounded-lg text-xs font-black transition bg-white text-blue-700 shadow-sm"; if (chartsSec) { chartsSec.classList.remove('hidden'); chartsSec.style.display = 'block'; } initSSChartsView(); }
}

async function initSundaySchoolLiveView() {
    const dateInput = document.getElementById('ssSessionDate'), now = new Date();
    if (dateInput) dateInput.value = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    if (namesCacheData.length === 0) { try { const res = await apiFetch(`${API_URL}?sheet=Names`); if (res.status === "success") namesCacheData = res.data; } catch(e) {} }

    const stageSel = document.getElementById('ssFilterStage');
    if (!stageSel) return;
    stageSel.innerHTML = Object.keys(STAGE_GRADES).map(s => `<option value="${s}">${s}</option>`).join('');
    if ((currentUser.Role === "Stage_Leader" || currentUser.Role === "Class_Servant") && currentUser.AssignedStage && currentUser.AssignedStage !== "الكل") { stageSel.value = currentUser.AssignedStage; stageSel.disabled = true; }
    else stageSel.disabled = false;
    onSSFilterStageChange(stageSel.value);
}

function onSSFilterStageChange(stage) {
    const grdSel = document.getElementById('ssFilterGrade');
    if (!grdSel) return;
    grdSel.innerHTML = `<option value="">كل الصفوف</option>` + (STAGE_GRADES[stage] || []).map(g => `<option value="${g}">${g}</option>`).join('');
    if (currentUser.Role === "Class_Servant" && currentUser.AssignedGrade && currentUser.AssignedGrade !== "الكل") { grdSel.value = currentUser.AssignedGrade; grdSel.disabled = true; }
    else grdSel.disabled = false;
    onSSFilterGradeChange();
}

function onSSFilterGradeChange() {
    const stage = document.getElementById('ssFilterStage')?.value || "", grade = document.getElementById('ssFilterGrade')?.value || "", classSel = document.getElementById('ssFilterClass');
    if (!classSel) return;
    const classes = new Set();
    namesCacheData.forEach(kid => { if (normalizeArabic(kid["المرحلة"]) === normalizeArabic(stage) && (!grade || normalizeArabic(kid["الصف"]) === normalizeArabic(grade))) { const cName = (kid["فصل مدارس الاحد"] || kid["أنهي مدارس الأحد"] || "").trim(); if (cName) classes.add(cName); } });
    classSel.innerHTML = `<option value="">كل الفصول (${classes.size})</option>` + Array.from(classes).sort().map(c => `<option value="${c}">${c}</option>`).join('');
    if (currentUser.Role === "Class_Servant" && currentUser.AssignedClass && currentUser.AssignedClass !== "الكل") { classSel.value = currentUser.AssignedClass; classSel.disabled = true; }
    else classSel.disabled = false;
    loadSSLiveClassKids();
}

function getLastKidAttendanceInfo(kidName, kidId) {
    if (!rawData || rawData.length === 0) return { text: "لا يوجد سجل سابق", status: "none" };
    const history = rawData.filter(r => (r["ChildName"] && r["ChildName"].trim() === kidName.trim()) || (r["ChildID"] && String(r["ChildID"]).trim() !== "" && String(r["ChildID"]).trim() === String(kidId).trim()));
    if (history.length === 0) return { text: "أول حضور له", status: "none" };
    history.sort((a, b) => parseDateForSort(b["SessionDate"]) - parseDateForSort(a["SessionDate"]));
    const latest = history[0], isPresent = String(latest["Attendance"] || "").trim() === "حاضر";
    return { text: `${latest["SessionDate"]} (${latest["Attendance"]})`, status: isPresent ? "present" : "absent" };
}

function getLastKidVisitInfo(kidName, kidId, familyHead) {
    if (!visitationsData || visitationsData.length === 0) return { text: "لم يُفتقد بعد", isUrgent: true };
    const visits = visitationsData.filter(v => (v["MemberName"] && (v["MemberName"].trim() === kidName.trim() || (familyHead && v["MemberName"].trim() === familyHead.trim()))) || (v["MemberID"] && String(v["MemberID"]).trim() !== "" && String(v["MemberID"]).trim() === String(kidId).trim()));
    if (visits.length === 0) return { text: "لم يُفتقد بعد", isUrgent: true };
    visits.sort((a, b) => parseDateForSort(b["VisitDate"]) - parseDateForSort(a["VisitDate"]));
    const latestDateStr = visits[0]["VisitDate"], diffDays = Math.floor((new Date() - parseDateForSort(latestDateStr)) / (1000 * 60 * 60 * 24));
    return { text: latestDateStr, isUrgent: diffDays > 60 };
}

async function loadSSLiveClassKids() {
    const stage = document.getElementById('ssFilterStage')?.value || "", grade = document.getElementById('ssFilterGrade')?.value || "", className = document.getElementById('ssFilterClass')?.value || "";
    if (visitationsData.length === 0) { try { const res = await apiFetch(`${API_URL}?sheet=Visitations`); if (res.status === "success") visitationsData = res.data; } catch(e) {} }

    const matched = namesCacheData.filter(kid => {
        if (isMemberDeceased(kid) || kid["مدارس الأحد"] === "غير مشترك") return false;
        if (normalizeArabic(kid["المرحلة"]) !== normalizeArabic(stage)) return false;
        if (grade && normalizeArabic(kid["الصف"]) !== normalizeArabic(grade)) return false;
        if (className && normalizeArabic(kid["فصل مدارس الاحد"] || kid["أنهي مدارس الأحد"]) !== normalizeArabic(className)) return false;
        return true;
    }).sort((a, b) => String(a["الاسم ثلاثي"]).localeCompare(String(b["الاسم ثلاثي"]), 'ar'));

    currentSSLiveKids = matched.map(kid => {
        const kId = kid["ID"] || kid[Object.keys(kid)[0]], kName = kid["الاسم ثلاثي"], fHead = kid["اسم رب الاسرة"] || "", phone = kid["تليفون العمل/المحمول"] || kid["هاتف الاسرة"] || "-";
        return {
            id: kId, name: kName, familyHead: fHead, phone: phone, stage: kid["المرحلة"] || stage, grade: kid["الصف"] || grade || "-", className: className || (kid["فصل مدارس الاحد"] || "عام"),
            lastAttendance: getLastKidAttendanceInfo(kName, kId), lastVisit: getLastKidVisitInfo(kName, kId, fHead),
            attendance: "حاضر", memorization: "ممتاز", points: 10, notes: ""
        };
    });
    renderSSLiveKidsTable();
}

function renderSSLiveKidsTable() {
    const tbody = document.getElementById('ssLiveKidsTableBody'), emptyNotice = document.getElementById('ssLiveKidsEmpty');
    if (!tbody) return;
    const thead = tbody.closest('table')?.querySelector('thead');
    if (thead) {
        thead.innerHTML = `<tr><th class="p-3 w-10 text-center">م</th><th class="p-3">اسم المخدوم والصف</th><th class="p-3 text-center">آخر حضور</th><th class="p-3 text-center">آخر افتقاد</th><th class="p-3">التواصل والمحمول</th><th class="p-3 text-center">حضور اليوم</th><th class="p-3 text-center">التسميع</th><th class="p-3 text-center w-20">النقاط</th><th class="p-3">ملاحظات الافتقاد</th></tr>`;
    }
    tbody.innerHTML = "";
    const recCount = document.getElementById('recordCount');
    if (recCount) recCount.innerText = `${currentSSLiveKids.length} مخدوم بالفصل`;
    if (currentSSLiveKids.length === 0) { emptyNotice?.classList.remove('hidden'); return; }
    emptyNotice?.classList.add('hidden');

    currentSSLiveKids.forEach((kid, idx) => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
        const attBadge = kid.lastAttendance.status === "present" ? `<span class="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-md font-bold">${kid.lastAttendance.text}</span>` : kid.lastAttendance.status === "absent" ? `<span class="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2 py-0.5 rounded-md font-bold">${kid.lastAttendance.text}</span>` : `<span class="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded-md font-bold">${kid.lastAttendance.text}</span>`;
        const visitBadge = kid.lastVisit.isUrgent ? `<span class="text-[10px] bg-rose-100 text-rose-800 border border-rose-300 px-2 py-0.5 rounded-md font-black">🚨 ${kid.lastVisit.text}</span>` : `<span class="text-[10px] bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-md font-bold">✓ ${kid.lastVisit.text}</span>`;
        tr.innerHTML = `
            <td class="p-3 text-center font-bold text-slate-400">${idx + 1}</td>
            <td class="p-3"><p class="font-black text-slate-800 text-xs sm:text-sm">${kid.name}</p><p class="text-[10px] text-slate-500 font-bold mt-0.5">الأسرة: ${kid.familyHead || '-'} | الصف: <span class="text-indigo-600">${kid.grade}</span></p></td>
            <td class="p-3 text-center whitespace-nowrap">${attBadge}</td>
            <td class="p-3 text-center whitespace-nowrap">${visitBadge}</td>
            <td class="p-3"><div class="flex flex-col gap-1"><span class="font-mono text-xs font-bold text-slate-700" dir="ltr">${kid.phone}</span><div class="flex items-center gap-1.5 flex-wrap">${renderContactButtons(kid.phone)}</div></div></td>
            <td class="p-3 text-center"><button type="button" onclick="toggleSSKidAttendance(${idx})" class="px-3 py-1.5 rounded-xl font-black text-xs transition shadow-sm ${kid.attendance === 'حاضر' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-rose-500 hover:bg-rose-600 text-white'}">${kid.attendance}</button></td>
            <td class="p-3 text-center"><select onchange="currentSSLiveKids[${idx}].memorization = this.value" class="p-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none"><option value="ممتاز" ${kid.memorization === 'ممتاز' ? 'selected' : ''}>ممتاز</option><option value="جيد" ${kid.memorization === 'جيد' ? 'selected' : ''}>جيد</option><option value="مقبول" ${kid.memorization === 'مقبول' ? 'selected' : ''}>مقبول</option><option value="لم يحفظ" ${kid.memorization === 'لم يحفظ' ? 'selected' : ''}>لم يحفظ</option></select></td>
            <td class="p-3 text-center"><input type="number" value="${kid.points}" onchange="currentSSLiveKids[${idx}].points = Number(this.value)" class="w-16 p-1.5 bg-slate-50 border border-slate-200 rounded-xl text-center font-black text-xs outline-none"></td>
            <td class="p-3"><input type="text" placeholder="ملاحظة..." value="${kid.notes}" oninput="currentSSLiveKids[${idx}].notes = this.value" class="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none"></td>
        `;
        tbody.appendChild(tr);
    });
}

function toggleSSKidAttendance(index) { const kid = currentSSLiveKids[index]; if (!kid) return; kid.attendance = (kid.attendance === "حاضر") ? "غائب" : "حاضر"; kid.points = (kid.attendance === "حاضر") ? 10 : 0; renderSSLiveKidsTable(); }
function markAllSSKids(status) { currentSSLiveKids.forEach(kid => { kid.attendance = status; kid.points = (status === "حاضر") ? 10 : 0; }); renderSSLiveKidsTable(); }

async function saveSundaySchoolBatchAttendance() {
    if (currentSSLiveKids.length === 0) { alert("لا يوجد مخدومين في الكشف لحفظهم!"); return; }
    const sessionDate = (document.getElementById('ssSessionDate')?.value || "").trim();
    if (!sessionDate) { alert("يرجى كتابة تاريخ الحصة أولاً!"); return; }

    // فحص منع تكرار رصد الحضور لنفس اليوم والفصل
    const stageVal = document.getElementById('ssFilterStage')?.value || "";
    const classVal = document.getElementById('ssFilterClass')?.value || "";
    const alreadyRecorded = rawData.some(r => 
        String(r["SessionDate"] || "").trim() === sessionDate &&
        normalizeArabic(r["Stage"]) === normalizeArabic(stageVal) &&
        (!classVal || normalizeArabic(r["ClassName"]) === normalizeArabic(classVal))
    );
    if (alreadyRecorded) {
        if (!confirm(`⚠️ تنبيه: تم رصد حضور هذا الفصل (${classVal || stageVal}) بتاريخ ${sessionDate} مسبقاً!\nهل أنت متأكد من أنك تريد تسجيله مرة أخرى؟`)) return;
    } else {
        if (!confirm(`هل أنت متأكد من حفظ سجل حضور وتسميع (${currentSSLiveKids.length}) مخدوم لتاريخ: ${sessionDate}؟`)) return;
    }

    const btn = document.getElementById('btnSaveSSBatch');
    if (btn) { btn.disabled = true; btn.innerHTML = `جاري الحفظ بالسجلات...`; }
    const payload = currentSSLiveKids.map(kid => ({ "Stage": kid.stage, "Grade": kid.grade, "ClassName": kid.className, "SessionDate": sessionDate, "ChildID": kid.id, "ChildName": kid.name, "ServantName": currentUser ? currentUser.ServantName : "خادم الفصل", "Attendance": kid.attendance, "Memorization": kid.memorization, "Points": kid.points, "Notes": kid.notes }));
    try {
        const data = await apiPost({ sheet: "Sunday_School", action: "batch_add", data: payload });
        if (data.status === "success") {
            sendAuditLog("رصد حضور مدارس الأحد", "Sunday_School", `تم حفظ كشف (${payload.length}) مخدوم - ${stageVal} ${classVal} بتاريخ ${sessionDate}`);
            alert("✓ " + data.message);
            loadData();
        } else alert("خطأ أثناء الحفظ: " + data.message);
    } catch(err) { alert("تعذر الاتصال بالخادم لحفظ الحضور."); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = `💾 حفظ حضور وتقييم الفصل كاملاً`; } }
}

function normalizeGender(g) {
    const s = String(g || "").trim();
    if (s === "ذكر" || s === "ولد") return "ذكر";
    if (s === "انثي" || s === "انثى" || s === "أنثى" || s === "أنثي" || s === "بنت") return "انثي";
    return "";
}
function calcChartPercent(part, total) { return total > 0 ? Math.round((part / total) * 100) : 0; }

function buildChartsStageTabs() {
    const tabsEl = document.getElementById('ssChartsStageTabs'), badgeEl = document.getElementById('ssChartsScopeBadge');
    if (!tabsEl) return;
    const hasFullAccess = currentUser.Role === "Admin" || currentUser.Role === "SundaySchool_Admin" || currentUser.AssignedStage === "الكل";
    let availableStages = [];
    if (hasFullAccess) { availableStages = ["الكل", ...Object.keys(STAGE_GRADES)]; if (badgeEl) badgeEl.innerText = "نطاق الصلاحية: الخدمة بالكامل"; }
    else { availableStages = [currentUser.AssignedStage]; selectedChartStage = currentUser.AssignedStage; if (badgeEl) badgeEl.innerText = `نطاق الصلاحية: ${currentUser.AssignedStage}${currentUser.AssignedGrade && currentUser.AssignedGrade !== 'الكل' ? ' - ' + currentUser.AssignedGrade : ''}${currentUser.AssignedClass && currentUser.AssignedClass !== 'الكل' ? ' (' + currentUser.AssignedClass + ')' : ''}`; }
    tabsEl.innerHTML = availableStages.map(st => `<button type="button" onclick="selectChartStage('${st}')" class="px-3.5 py-1.5 rounded-xl text-xs font-black transition ${selectedChartStage === st ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">${st === "الكل" ? "🌐 الخدمة كلها" : st}</button>`).join('');
}

function selectChartStage(stage) { selectedChartStage = stage; initSSChartsView(); }

async function initSSChartsView() {
    const chartsSec = ensureChartsSectionExists();
    if (chartsSec) { chartsSec.classList.remove('hidden'); chartsSec.style.display = 'block'; }
    try { await ensureChartJsLoaded(); } catch (e) { alert(e.message); return; }
    if (namesCacheData.length === 0) { try { const res = await apiFetch(`${API_URL}?sheet=Names`); if (res.status === "success") namesCacheData = res.data; } catch(e) {} }
    buildChartsStageTabs();

    let allowedRecords = rawData.filter(item => {
        const stg = normalizeArabic(item["Stage"]), grd = normalizeArabic(item["Grade"]), cls = normalizeArabic(item["ClassName"]);
        if (currentUser.Role === "Stage_Leader" && currentUser.AssignedStage !== "الكل" && stg !== normalizeArabic(currentUser.AssignedStage)) return false;
        if (currentUser.Role === "Class_Servant") {
            if (currentUser.AssignedStage !== "الكل" && stg !== normalizeArabic(currentUser.AssignedStage)) return false;
            if (currentUser.AssignedGrade && currentUser.AssignedGrade !== "الكل" && grd !== normalizeArabic(currentUser.AssignedGrade)) return false;
            if (currentUser.AssignedClass && currentUser.AssignedClass !== "الكل" && cls !== normalizeArabic(currentUser.AssignedClass)) return false;
        }
        return true;
    });

    if (selectedChartStage && selectedChartStage !== "الكل") {
        const targetStageNorm = normalizeArabic(selectedChartStage);
        allowedRecords = allowedRecords.filter(item => normalizeArabic(item["Stage"]) === targetStageNorm);
    }

    const recCount = document.getElementById('recordCount');
    if (recCount) recCount.innerText = `${allowedRecords.length} سجل حضور محلل`;
    const emptyEl = document.getElementById('ssChartsEmpty'), contEl = document.getElementById('ssChartsContainer');
    if (allowedRecords.length === 0) {
        if (emptyEl) { emptyEl.classList.remove('hidden'); emptyEl.style.display = 'block'; }
        if (contEl) { contEl.classList.add('hidden'); contEl.style.display = 'none'; }
        return;
    }
    if (emptyEl) { emptyEl.classList.add('hidden'); emptyEl.style.display = 'none'; }
    if (contEl) { contEl.classList.remove('hidden'); contEl.style.display = 'block'; }

    const genderById = {}, genderByName = {};
    namesCacheData.forEach(m => {
        const g = normalizeGender(m["ذكر/انثي"]), id = String(m["ID"] || "").trim(), name = normalizeArabic(m["الاسم ثلاثي"]);
        if (id) genderById[id] = g; if (name) genderByName[name] = g;
    });

    let stats = { totalPresent: 0, totalAbsent: 0, malePresent: 0, maleAbsent: 0, femalePresent: 0, femaleAbsent: 0, breakdownMap: {} };
    const normToCanonicalStage = {}; Object.keys(STAGE_GRADES).forEach(st => { normToCanonicalStage[normalizeArabic(st)] = st; });
    const normToCanonicalGrade = {};
    if (selectedChartStage !== "الكل" && STAGE_GRADES[selectedChartStage]) {
        STAGE_GRADES[selectedChartStage].forEach(g => { stats.breakdownMap[g] = { present: 0, absent: 0, malePresent: 0, maleAbsent: 0, femalePresent: 0, femaleAbsent: 0 }; normToCanonicalGrade[normalizeArabic(g)] = g; });
    } else if (selectedChartStage === "الكل") {
        Object.keys(STAGE_GRADES).forEach(st => { stats.breakdownMap[st] = { present: 0, absent: 0, malePresent: 0, maleAbsent: 0, femalePresent: 0, femaleAbsent: 0 }; });
    }

    allowedRecords.forEach(rec => {
        const isPresent = String(rec["Attendance"] || "").trim() === "حاضر";
        if (isPresent) stats.totalPresent++; else stats.totalAbsent++;
        const cId = String(rec["ChildID"] || "").trim(), cNameNorm = normalizeArabic(rec["ChildName"]);
        const gender = (cId && genderById[cId]) ? genderById[cId] : (genderByName[cNameNorm] || "");
        if (gender === "ذكر") { if (isPresent) stats.malePresent++; else stats.maleAbsent++; }
        else if (gender === "انثي") { if (isPresent) stats.femalePresent++; else stats.femaleAbsent++; }

        const rawStg = String(rec["Stage"] || "غير محدد").trim(), rawGrd = String(rec["Grade"] || "عام").trim();
        const bucketKey = (selectedChartStage === "الكل") ? (normToCanonicalStage[normalizeArabic(rawStg)] || rawStg) : (normToCanonicalGrade[normalizeArabic(rawGrd)] || rawGrd);
        if (!stats.breakdownMap[bucketKey]) stats.breakdownMap[bucketKey] = { present: 0, absent: 0, malePresent: 0, maleAbsent: 0, femalePresent: 0, femaleAbsent: 0 };

        if (isPresent) { stats.breakdownMap[bucketKey].present++; if (gender === "ذكر") stats.breakdownMap[bucketKey].malePresent++; else if (gender === "انثي") stats.breakdownMap[bucketKey].femalePresent++; }
        else { stats.breakdownMap[bucketKey].absent++; if (gender === "ذكر") stats.breakdownMap[bucketKey].maleAbsent++; else if (gender === "انثي") stats.breakdownMap[bucketKey].femaleAbsent++; }
    });
    renderSSCharts(stats);
}

function renderSSCharts(stats) {
    if (ssChartInstances.pie) ssChartInstances.pie.destroy();
    if (ssChartInstances.gender) ssChartInstances.gender.destroy();
    if (ssChartInstances.stage) ssChartInstances.stage.destroy();
    if (ssChartInstances.genderGrade) ssChartInstances.genderGrade.destroy();

    const totalAll = stats.totalPresent + stats.totalAbsent, maleAll = stats.malePresent + stats.maleAbsent, femaleAll = stats.femalePresent + stats.femaleAbsent;
    const presentPct = calcChartPercent(stats.totalPresent, totalAll), absentPct = calcChartPercent(stats.totalAbsent, totalAll);
    const malePresentPct = calcChartPercent(stats.malePresent, maleAll), femalePresentPct = calcChartPercent(stats.femalePresent, femaleAll);

    const kpiContainer = document.getElementById('ssChartsKpiCards');
    if (kpiContainer) {
        kpiContainer.innerHTML = `
            <div class="bg-white p-4 rounded-2xl border border-emerald-200 shadow-sm text-center"><span class="block text-xs font-bold text-slate-500 mb-1">نسبة الحضور العامة</span><span class="text-2xl font-black text-emerald-600">${presentPct}%</span><span class="block text-[11px] font-bold text-slate-400 mt-0.5">(${stats.totalPresent} من ${totalAll})</span></div>
            <div class="bg-white p-4 rounded-2xl border border-rose-200 shadow-sm text-center"><span class="block text-xs font-bold text-slate-500 mb-1">نسبة الغياب العامة</span><span class="text-2xl font-black text-rose-600">${absentPct}%</span><span class="block text-[11px] font-bold text-slate-400 mt-0.5">(${stats.totalAbsent} من ${totalAll})</span></div>
            <div class="bg-white p-4 rounded-2xl border border-blue-200 shadow-sm text-center"><span class="block text-xs font-bold text-slate-500 mb-1">نسبة حضور الأولاد</span><span class="text-2xl font-black text-blue-600">${malePresentPct}%</span><span class="block text-[11px] font-bold text-slate-400 mt-0.5">حاضر: ${stats.malePresent} | غائب: ${stats.maleAbsent}</span></div>
            <div class="bg-white p-4 rounded-2xl border border-pink-200 shadow-sm text-center"><span class="block text-xs font-bold text-slate-500 mb-1">نسبة حضور البنات</span><span class="text-2xl font-black text-pink-600">${femalePresentPct}%</span><span class="block text-[11px] font-bold text-slate-400 mt-0.5">حاضر: ${stats.femalePresent} | غائب: ${stats.femaleAbsent}</span></div>
        `;
    }

    const keys = Object.keys(stats.breakdownMap);
    const tbody = document.getElementById('ssChartsSummaryTableBody');
    if (tbody) {
        tbody.innerHTML = keys.map(k => {
            const b = stats.breakdownMap[k], tot = b.present + b.absent;
            return `<tr class="hover:bg-slate-50"><td class="p-3 font-black text-slate-800">${k}</td><td class="p-3 text-center text-slate-600">${tot}</td><td class="p-3 text-center text-emerald-700">${calcChartPercent(b.present, tot)}% (${b.present})</td><td class="p-3 text-center text-rose-600">${calcChartPercent(b.absent, tot)}% (${b.absent})</td><td class="p-3 text-center text-blue-700">${calcChartPercent(b.malePresent, b.malePresent + b.maleAbsent)}% (${b.malePresent}/${b.malePresent + b.maleAbsent})</td><td class="p-3 text-center text-pink-700">${calcChartPercent(b.femalePresent, b.femalePresent + b.femaleAbsent)}% (${b.femalePresent}/${b.femalePresent + b.femaleAbsent})</td></tr>`;
        }).join('');
    }

    if (typeof Chart === 'undefined') return;

    const ctxPie = document.getElementById('attPieChart')?.getContext('2d');
    if (ctxPie) ssChartInstances.pie = new Chart(ctxPie, { type: 'doughnut', data: { labels: [`الحضور (${presentPct}%)`, `الغياب (${absentPct}%)`], datasets: [{ data: [stats.totalPresent, stats.totalAbsent], backgroundColor: ['#10b981', '#f43f5e'], borderWidth: 2 }] }, options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } } });

    const ctxGender = document.getElementById('genderBarChart')?.getContext('2d');
    if (ctxGender) ssChartInstances.gender = new Chart(ctxGender, { type: 'bar', data: { labels: [`الأولاد (حضور ${malePresentPct}%)`, `البنات (حضور ${femalePresentPct}%)`], datasets: [{ label: 'حاضر', data: [stats.malePresent, stats.femalePresent], backgroundColor: '#10b981', borderRadius: 6 }, { label: 'غائب', data: [stats.maleAbsent, stats.femaleAbsent], backgroundColor: '#f43f5e', borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } } });

    const labels = keys.map(k => { const item = stats.breakdownMap[k]; return `${k} (${calcChartPercent(item.present, item.present + item.absent)}%)`; });
    const title1 = document.getElementById('stageChartTitle');
    if (title1) title1.innerText = selectedChartStage === "الكل" ? "نسب الحضور والغياب لكل مرحلة على حدة (الخدمة كلها)" : `نسب الحضور والغياب لكل صف في مرحلة: ${selectedChartStage}`;

    const ctxStage = document.getElementById('stageBarChart')?.getContext('2d');
    if (ctxStage) ssChartInstances.stage = new Chart(ctxStage, { type: 'bar', data: { labels: labels, datasets: [{ label: 'حاضر', data: keys.map(k => stats.breakdownMap[k].present), backgroundColor: '#3b82f6', borderRadius: 5 }, { label: 'غائب', data: keys.map(k => stats.breakdownMap[k].absent), backgroundColor: '#cbd5e1', borderRadius: 5 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } } } });

    const title2 = document.getElementById('genderGradeChartTitle');
    if (title2) title2.innerText = selectedChartStage === "الكل" ? "مقارنة حضور وغياب الأولاد والبنات في كل مرحلة" : `مقارنة حضور وغياب الأولاد والبنات لكل صف في مرحلة: ${selectedChartStage}`;

    const ctxGenderGrade = document.getElementById('genderByGradeChart')?.getContext('2d');
    if (ctxGenderGrade) ssChartInstances.genderGrade = new Chart(ctxGenderGrade, { type: 'bar', data: { labels: keys, datasets: [{ label: 'حضور أولاد', data: keys.map(k => stats.breakdownMap[k].malePresent), backgroundColor: '#2563eb', borderRadius: 4 }, { label: 'غياب أولاد', data: keys.map(k => stats.breakdownMap[k].maleAbsent), backgroundColor: '#93c5fd', borderRadius: 4 }, { label: 'حضور بنات', data: keys.map(k => stats.breakdownMap[k].femalePresent), backgroundColor: '#db2777', borderRadius: 4 }, { label: 'غياب بنات', data: keys.map(k => stats.breakdownMap[k].femaleAbsent), backgroundColor: '#f9a8d4', borderRadius: 4 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true } } } });
}

function openSundaySchoolPrintModal() {
    const modal = document.getElementById('ssPrintModal'), stageSel = document.getElementById('ssPrintStage');
    if (!modal || !stageSel) return;
    stageSel.innerHTML = `<option value="">اختر المرحلة...</option>` + Object.keys(STAGE_GRADES).map(s => `<option value="${s}">${s}</option>`).join('');
    if ((currentUser.Role === "Stage_Leader" || currentUser.Role === "Class_Servant") && currentUser.AssignedStage && currentUser.AssignedStage !== "الكل") {
        stageSel.value = currentUser.AssignedStage; stageSel.disabled = true; updatePrintGradesDropdown(currentUser.AssignedStage);
        if (currentUser.AssignedGrade && currentUser.AssignedGrade !== "الكل") { const grd = document.getElementById('ssPrintGrade'); if (grd) grd.value = currentUser.AssignedGrade; }
        if (currentUser.AssignedClass && currentUser.AssignedClass !== "الكل") { const cls = document.getElementById('ssPrintClass'); if (cls) cls.value = currentUser.AssignedClass; }
    } else stageSel.disabled = false;
    modal.classList.remove('hidden');
}
function closeSundaySchoolPrintModal() { document.getElementById('ssPrintModal')?.classList.add('hidden'); }
function updatePrintGradesDropdown(stage) { const grdSel = document.getElementById('ssPrintGrade'); if (grdSel) grdSel.innerHTML = `<option value="">كل الصفوف</option>` + (STAGE_GRADES[stage] || []).map(g => `<option value="${g}">${g}</option>`).join(''); }

async function generateAndPrintClassRoster() {
    const stage = document.getElementById('ssPrintStage')?.value || "", grade = document.getElementById('ssPrintGrade')?.value || "", className = (document.getElementById('ssPrintClass')?.value || "").trim();
    if (!stage) { alert("يرجى اختيار المرحلة الدراسية أولاً!"); return; }
    let membersList = namesCacheData;
    if (membersList.length === 0) { try { const res = await apiFetch(`${API_URL}?sheet=Names`); if (res.status === "success") membersList = res.data; } catch(e) {} }
    const classKids = membersList.filter(item => !isMemberDeceased(item) && item["مدارس الأحد"] !== "غير مشترك" && normalizeArabic(item["المرحلة"]) === normalizeArabic(stage) && (!grade || normalizeArabic(item["الصف"]) === normalizeArabic(grade)) && (!className || normalizeArabic(item["فصل مدارس الاحد"] || item["أنهي مدارس الأحد"]).includes(normalizeArabic(className)))).sort((a, b) => String(a["الاسم ثلاثي"]).localeCompare(String(b["الاسم ثلاثي"]), 'ar'));
    if (classKids.length === 0) { alert("لم يتم العثور على مخدومين مسجلين بهذه المواصفات!"); return; }
    closeSundaySchoolPrintModal();
    setupPrintHeader(`كشف حضور وغياب مدارس الأحد - مرحلة: ${stage} ${grade ? '| ' + grade : ''} ${className ? '| فصل: ' + className : ''}`);
    const printArea = document.getElementById('printContainer');
    if (!printArea) return;
    printArea.innerHTML = `<table class="print-table"><thead><tr><th style="width:25px;">م</th><th style="width:170px;">اسم المخدوم ثلاثي</th><th style="width:85px;">المحمول</th><th style="width:50px;">السن</th><th style="width:70px;">الجمعة 1</th><th style="width:70px;">الجمعة 2</th><th style="width:70px;">الجمعة 3</th><th style="width:70px;">الجمعة 4</th><th>ملاحظات الافتقاد</th></tr></thead><tbody>${classKids.map((kid, idx) => `<tr><td style="text-align:center;font-weight:bold;">${idx + 1}</td><td style="font-weight:bold;">${kid["الاسم ثلاثي"]}</td><td style="font-family:monospace;">${kid["تليفون العمل/المحمول"] || "-"}</td><td style="text-align:center;">${calculateAge(kid["تاريخ الميلاد"], kid["الرقم القومي"]) || '-'}</td><td></td><td></td><td></td><td></td><td></td></tr>`).join('')}</tbody></table>`;
    setTimeout(() => { window.print(); printArea.innerHTML = ""; }, 250);
}

// 9. قسم رصد اجتماع الخدام
function switchMeetingsView(view) {
    currentMeetingsView = view;
    const btnLive = document.getElementById('btnMeetingsLiveRoster'), btnHist = document.getElementById('btnMeetingsHistory');
    const liveSec = document.getElementById('servantsMeetingLiveSection'), cardsSec = document.getElementById('standardCardsContainer'), searchSec = document.getElementById('standardSearchContainer'), btnAdd = document.getElementById('btnAddNewRecord');
    if (view === 'live') {
        if (btnLive) btnLive.className = "px-4 py-2 rounded-lg text-xs font-black transition bg-white text-amber-700 shadow-sm";
        if (btnHist) btnHist.className = "px-4 py-2 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
        liveSec?.classList.remove('hidden'); cardsSec?.classList.add('hidden'); searchSec?.classList.add('hidden'); btnAdd?.classList.add('hidden'); initServantsMeetingLiveView();
    } else {
        if (btnHist) btnHist.className = "px-4 py-2 rounded-lg text-xs font-black transition bg-white text-amber-700 shadow-sm";
        if (btnLive) btnLive.className = "px-4 py-2 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
        liveSec?.classList.add('hidden'); cardsSec?.classList.remove('hidden'); searchSec?.classList.remove('hidden'); btnAdd?.classList.remove('hidden'); renderStandardCards();
    }
}

async function initServantsMeetingLiveView() {
    const dateInput = document.getElementById('servantsMeetingDate'), now = new Date();
    if (dateInput) dateInput.value = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    if (servantsCacheData.length === 0) { try { const res = await apiFetch(`${API_URL}?sheet=Servants`); if (res.status === "success") servantsCacheData = res.data; } catch(e) {} }
    if (namesCacheData.length === 0) { try { const res = await apiFetch(`${API_URL}?sheet=Names`); if (res.status === "success") namesCacheData = res.data; } catch(e) {} }
    const activeServants = servantsCacheData.filter(s => s["Status"] !== "موقوف" && s["Username"] !== "admin");
    currentServantsMeetingList = activeServants.map(s => {
        const member = namesCacheData.find(m => m["الاسم ثلاثي"] === s["ServantName"]);
        let realPhone = (member && member["تليفون العمل/المحمول"]) ? member["تليفون العمل/المحمول"] : (/^\d+$/.test(s["Username"]) ? s["Username"] : "-");
        return { id: s["ID"] || s[Object.keys(s)[0]], name: s["ServantName"], phone: realPhone, role: s["Role"] || "خادم", scope: `${s["AssignedStage"] || "الكل"} ${s["AssignedGrade"] ? '- ' + s["AssignedGrade"] : ''} ${s["AssignedClass"] ? '(' + s["AssignedClass"] + ')' : ''}`, status: "حاضر", notes: "" };
    }).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    renderServantsMeetingTable();
}

function renderServantsMeetingTable() {
    const tbody = document.getElementById('servantsMeetingTableBody'), emptyNotice = document.getElementById('servantsMeetingEmpty');
    if (!tbody) return; tbody.innerHTML = "";
    const recCount = document.getElementById('recordCount'); if (recCount) recCount.innerText = `${currentServantsMeetingList.length} خادم مسجل`;
    if (currentServantsMeetingList.length === 0) { emptyNotice?.classList.remove('hidden'); return; }
    emptyNotice?.classList.add('hidden');
    let presentCount = 0, excusedCount = 0, absentCount = 0;
    currentServantsMeetingList.forEach((servant, idx) => {
        if (servant.status === "حاضر") presentCount++; else if (servant.status === "معتذر") excusedCount++; else absentCount++;
        const tr = document.createElement('tr'); tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
        tr.innerHTML = `<td class="p-3 text-center font-bold text-slate-400">${idx + 1}</td><td class="p-3 font-bold text-slate-800">${servant.name}</td><td class="p-3"><span class="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-[10px] font-bold">${servant.role}</span><span class="text-[11px] text-slate-600 font-semibold block mt-0.5">${servant.scope}</span></td><td class="p-3"><div class="flex flex-col gap-1"><span class="font-mono text-slate-600 text-xs">${servant.phone}</span><div class="flex items-center gap-1 flex-wrap">${renderContactButtons(servant.phone)}</div></div></td><td class="p-3 text-center"><div class="inline-flex rounded-xl shadow-sm border border-slate-200 p-0.5 bg-slate-50"><button type="button" onclick="setServantMeetingStatus(${idx}, 'حاضر')" class="px-2.5 py-1 text-xs font-bold rounded-lg transition ${servant.status === 'حاضر' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600'}">حاضر</button><button type="button" onclick="setServantMeetingStatus(${idx}, 'معتذر')" class="px-2.5 py-1 text-xs font-bold rounded-lg transition ${servant.status === 'معتذر' ? 'bg-amber-500 text-white shadow' : 'text-slate-600'}">معتذر</button><button type="button" onclick="setServantMeetingStatus(${idx}, 'غائب')" class="px-2.5 py-1 text-xs font-bold rounded-lg transition ${servant.status === 'غائب' ? 'bg-rose-600 text-white shadow' : 'text-slate-600'}">غائب</button></div></td><td class="p-3"><input type="text" placeholder="اكتب سبب الاعتذار أو الملاحظة..." value="${servant.notes}" oninput="currentServantsMeetingList[${idx}].notes = this.value" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none"></td>`;
        tbody.appendChild(tr);
    });
    const summary = document.getElementById('servantsAttendanceSummary');
    if (summary) summary.innerHTML = `<span class="text-emerald-700">حاضر: ${presentCount}</span> | <span class="text-amber-700">معتذر: ${excusedCount}</span> | <span class="text-rose-700">غائب: ${absentCount}</span>`;
}

function setServantMeetingStatus(index, status) { currentServantsMeetingList[index].status = status; renderServantsMeetingTable(); }
function markAllServantsMeeting(status) { currentServantsMeetingList.forEach(s => s.status = status); renderServantsMeetingTable(); }

async function saveServantsMeetingBatchAttendance() {
    if (currentServantsMeetingList.length === 0) { alert("لا يوجد خدام في الكشف للحفظ!"); return; }
    const meetingName = (document.getElementById('servantsMeetingName')?.value || "").trim() || "اجتماع الخدام الأسبوعي", meetingDate = (document.getElementById('servantsMeetingDate')?.value || "").trim();
    if (!meetingDate) { alert("يرجى كتابة تاريخ الاجتماع أولاً!"); return; }

    // فحص منع تكرار رصد حضور نفس الاجتماع في نفس التاريخ
    const alreadyRecorded = rawData.some(r => String(r["MeetingDate"] || "").trim() === meetingDate && normalizeArabic(r["MeetingName"]) === normalizeArabic(meetingName));
    if (alreadyRecorded) {
        if (!confirm(`⚠️ تنبيه: تم رصد حضور "${meetingName}" بتاريخ ${meetingDate} مسبقاً!\nهل تريد الحفظ مرة أخرى؟`)) return;
    } else {
        if (!confirm(`هل أنت متأكد من حفظ حضور (${currentServantsMeetingList.length}) خادم لاجتماع: ${meetingName} بتاريخ: ${meetingDate}؟`)) return;
    }

    const btn = document.getElementById('btnSaveServantsMeetingBatch'); if (btn) { btn.disabled = true; btn.innerHTML = `جاري الحفظ بالسجلات...`; }
    const payload = currentServantsMeetingList.map(s => ({ "MeetingName": meetingName, "MeetingDate": meetingDate, "MemberID": s.id, "MemberName": s.name, "Status": s.status, "Notes": s.notes }));
    try {
        const data = await apiPost({ sheet: "Meetings_Attendance", action: "batch_add", data: payload });
        if (data.status === "success") {
            sendAuditLog("رصد حضور اجتماع الخدام", "Meetings_Attendance", `تم حفظ كشف (${payload.length}) خادم - ${meetingName} بتاريخ ${meetingDate}`);
            alert("✓ " + data.message);
            loadData();
        } else alert("خطأ أثناء الحفظ: " + data.message);
    } catch(err) { alert("تعذر الاتصال بالخادم لحفظ حضور الاجتماع."); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = `💾 حفظ حضور الاجتماع`; } }
}

function printServantsMeetingRoster() {
    const meetingName = document.getElementById('servantsMeetingName')?.value || "اجتماع الخدام الأسبوعي", meetingDate = document.getElementById('servantsMeetingDate')?.value || "";
    if (currentServantsMeetingList.length === 0) { alert("لا يوجد خدام في الكشف للطباعة!"); return; }
    setupPrintHeader(`كشف حضور ${meetingName} - تاريخ: ${meetingDate}`);
    const printArea = document.getElementById('printContainer'); if (!printArea) return;
    printArea.innerHTML = `<table class="print-table"><thead><tr><th>م</th><th>اسم الخادم</th><th>الخدمة المسندة</th><th>المحمول</th><th>الحالة</th><th>ملاحظات</th></tr></thead><tbody>${currentServantsMeetingList.map((s, idx) => `<tr><td>${idx + 1}</td><td>${s.name}</td><td>${s.scope}</td><td>${s.phone}</td><td>${s.status}</td><td>${s.notes || "-"}</td></tr>`).join('')}</tbody></table>`;
    setTimeout(() => { window.print(); printArea.innerHTML = ""; }, 150);
}

function openAddServantQuickModal() { currentTab = 'Servants'; openModal('add'); }
async function populateServantsDatalist() {
    if (namesCacheData.length === 0) { try { const res = await apiFetch(`${API_URL}?sheet=Names`); if (res.status === "success") namesCacheData = res.data; } catch(e) {} }
    const dl = document.getElementById('servantsNamesList'); if (dl) dl.innerHTML = namesCacheData.filter(m => !isMemberDeceased(m)).map(m => `<option value="${m['الاسم ثلاثي']}">`).join('');
}
function onServantNameSelected(selectedName) {
    const member = namesCacheData.find(m => m["الاسم ثلاثي"] === selectedName), usernameInput = document.querySelector('input[name="Username"]');
    if (member && usernameInput && !usernameInput.value && member["تليفون العمل/المحمول"]) usernameInput.value = member["تليفون العمل/المحمول"];
}

// 10. قسم الافتقاد والمتابعة الرعوية
function switchVisitationsView(view) {
    currentVisitView = view;
    const btnDash = document.getElementById('btnVisitDashboard'), btnHist = document.getElementById('btnVisitHistory');
    const dashSec = document.getElementById('visitationDashboardSection'), cardsSec = document.getElementById('standardCardsContainer'), searchSec = document.getElementById('standardSearchContainer'), btnAdd = document.getElementById('btnAddNewRecord'), btnPrint = document.getElementById('btnPrintVisitReport');
    if (view === 'dashboard') {
        if (btnDash) btnDash.className = "px-4 py-2 rounded-lg text-xs font-black transition bg-white text-rose-700 shadow-sm";
        if (btnHist) btnHist.className = "px-4 py-2 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
        dashSec?.classList.remove('hidden'); cardsSec?.classList.add('hidden'); searchSec?.classList.add('hidden'); btnAdd?.classList.add('hidden'); btnPrint?.classList.remove('hidden'); initVisitationsDashboard();
    } else {
        if (btnHist) btnHist.className = "px-4 py-2 rounded-lg text-xs font-black transition bg-white text-rose-700 shadow-sm";
        if (btnDash) btnDash.className = "px-4 py-2 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
        dashSec?.classList.add('hidden'); cardsSec?.classList.remove('hidden'); searchSec?.classList.remove('hidden'); btnAdd?.classList.remove('hidden'); btnPrint?.classList.add('hidden'); renderStandardCards();
    }
}

async function initVisitationsDashboard() {
    if (namesCacheData.length === 0) { try { const res = await apiFetch(`${API_URL}?sheet=Names`); if (res.status === "success") namesCacheData = res.data; } catch(e) {} }
    if (visitationsData.length === 0) { try { const res = await apiFetch(`${API_URL}?sheet=Visitations`); if (res.status === "success") visitationsData = res.data; } catch(e) {} }
    renderVisitationRecommendations(); renderVisitationFollowups();
}

function renderVisitationRecommendations() {
    const urgentList = document.getElementById('visitUrgentList'); if (!urgentList) return; urgentList.innerHTML = "";
    const familiesMap = {};
    namesCacheData.forEach(member => { if (isMemberDeceased(member)) return; const headName = String(member["اسم رب الاسرة"] || "").trim(); if (!headName) return; if (!familiesMap[headName]) familiesMap[headName] = []; familiesMap[headName].push(member); });
    const recommendations = [], now = new Date(), ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;
    Object.keys(familiesMap).forEach(headName => {
        const familyMembers = familiesMap[headName], lastVisitDateStr = getLastFamilyVisitDate(familyMembers);
        let needsVisit = false, daysSince = -1;
        if (lastVisitDateStr === "لم يُفتقد بعد" || lastVisitDateStr === "لا يوجد سجل") { needsVisit = true; daysSince = 999; }
        else { const diffMs = now - parseDateForSort(lastVisitDateStr); if (diffMs > ninetyDaysMs) { needsVisit = true; daysSince = Math.floor(diffMs / (1000 * 60 * 60 * 24)); } }
        if (needsVisit) {
            const headRec = familyMembers.find(m => m["الاسم ثلاثي"] === headName || m["صلة القرابة"] === "زوج") || familyMembers[0];
            recommendations.push({ headName, area: headRec?.["المنطقة"] || "غير محددة", phone: headRec?.["هاتف الاسرة"] || headRec?.["تليفون العمل/المحمول"] || "-", daysSince, headId: headRec?.["ID"] || headRec?.[Object.keys(headRec)[0]] });
        }
    });
    recommendations.sort((a, b) => b.daysSince - a.daysSince);
    const countBadge = document.getElementById('visitUrgentCount'); if (countBadge) countBadge.innerText = recommendations.length;
    if (recommendations.length === 0) { urgentList.innerHTML = `<div class="text-center text-slate-400 font-bold py-10">لا توجد حالات متأخرة عاجلة.</div>`; return; }
    recommendations.forEach(rec => {
        const sinceText = rec.daysSince === 999 ? "لم تُفتقد أبدًا" : `منذ ${rec.daysSince} يوم`;
        const div = document.createElement('div'); div.className = "bg-white p-3 rounded-xl border border-rose-100 flex flex-col gap-2";
        div.innerHTML = `<div class="flex justify-between items-start"><div><h4 class="text-sm font-black text-slate-800">${rec.headName}</h4><p class="text-[11px] text-slate-500 font-semibold mt-0.5">📍 ${rec.area} | 📞 <span class="font-mono">${rec.phone}</span></p><p class="text-[11px] text-rose-600 font-bold mt-1">⏳ التأخير: ${sinceText}</p></div><button onclick="quickAddVisitation('${rec.headId}', '${rec.headName.replace(/'/g, "\\'")}')" class="bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition shadow-sm whitespace-nowrap">+ تسجيل زيارة</button></div><div class="flex justify-end border-t border-rose-50 pt-2 mt-1">${renderContactButtons(rec.phone)}</div>`;
        urgentList.appendChild(div);
    });
}

function renderVisitationFollowups() {
    const followupList = document.getElementById('visitFollowupList'); if (!followupList) return; followupList.innerHTML = "";
    const now = new Date(); now.setHours(0,0,0,0); const nextWeek = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));
    const upcoming = visitationsData.filter(v => { const dStr = String(v["FollowUpDate"] || "").trim(); if (!dStr || dStr === "-") return false; const fDate = parseDateForSort(dStr); return fDate >= now && fDate <= nextWeek; }).sort((a, b) => parseDateForSort(a.FollowUpDate) - parseDateForSort(b.FollowUpDate));
    const countBadge = document.getElementById('visitFollowupCount'); if (countBadge) countBadge.innerText = upcoming.length;
    if (upcoming.length === 0) { followupList.innerHTML = `<div class="text-center text-slate-400 font-bold py-10">لا توجد متابعات مجدولة للأسبوع القادم.</div>`; return; }
    upcoming.forEach(rec => {
        const div = document.createElement('div'); div.className = "bg-white p-3 rounded-xl border border-indigo-100 flex justify-between items-center";
        div.innerHTML = `<div><h4 class="text-sm font-black text-slate-800">${rec.MemberName}</h4><p class="text-[11px] text-slate-500 font-semibold mt-0.5">👤 الخادم المتابع: ${rec.VisitorName}</p><p class="text-[11px] text-indigo-600 font-bold mt-1">🗓️ موعد المتابعة: ${rec.FollowUpDate}</p></div><button onclick="quickAddVisitation('${rec.MemberID}', '${rec.MemberName.replace(/'/g, "\\'")}')" class="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition shadow-sm">+ تحديث الحالة</button>`;
        followupList.appendChild(div);
    });
}

function quickAddVisitation(memberId, memberName) {
    currentTab = 'Visitations'; openModal('add');
    setTimeout(() => {
        const idInp = document.querySelector('input[name="MemberID"]'), nameInp = document.querySelector('input[name="MemberName"]'), dateInp = document.querySelector('input[name="VisitDate"]'), visitorInp = document.querySelector('input[name="VisitorName"]');
        if (idInp) idInp.value = memberId; if (nameInp) nameInp.value = memberName;
        const now = new Date(); if (dateInp) dateInp.value = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        if (visitorInp && currentUser) visitorInp.value = currentUser.ServantName;
    }, 100);
}

function printVisitReport() {
    setupPrintHeader("تقرير الافتقاد: الحالات المتأخرة والمتابعات المجدولة");
    const printArea = document.getElementById('printContainer');
    if (!printArea) return;
    const urgentItems = Array.from(document.getElementById('visitUrgentList')?.children || []);
    const followupItems = Array.from(document.getElementById('visitFollowupList')?.children || []);
    let html = `<h3 style="font-size:11pt;font-weight:bold;margin-bottom:5px;border-bottom:1px solid #000;">الأسر المتأخرة عن الافتقاد العاجل (+90 يوماً)</h3><table class="print-table" style="margin-bottom:15px;"><thead><tr><th style="width:30px;">م</th><th>اسم رب الأسرة</th><th>المنطقة</th><th>المحمول</th><th>مدة التأخير</th></tr></thead><tbody>`;
    let count = 1;
    urgentItems.forEach(node => {
        if (node.tagName === "DIV" && node.querySelector('h4')) {
            const name = node.querySelector('h4').innerText, meta = node.querySelector('p').innerText.split('|');
            const area = (meta[0] || "").replace('📍', '').trim(), phone = (meta[1] || "").replace('📞', '').trim();
            const delay = node.querySelectorAll('p')[1]?.innerText.replace('⏳ التأخير:', '').trim() || "";
            html += `<tr><td style="text-align:center;font-weight:bold;">${count++}</td><td style="font-weight:bold;">${name}</td><td>${area}</td><td style="font-family:monospace;">${phone}</td><td style="color:red;font-weight:bold;">${delay}</td></tr>`;
        }
    });
    if (count === 1) html += `<tr><td colspan="5" style="text-align:center;">لا توجد حالات متأخرة.</td></tr>`;
    html += `</tbody></table><h3 style="font-size:11pt;font-weight:bold;margin-bottom:5px;border-bottom:1px solid #000;">المتابعات المجدولة للأسبوع القادم</h3><table class="print-table"><thead><tr><th style="width:30px;">م</th><th>اسم المخدوم</th><th>الخادم المتابع</th><th>موعد المتابعة</th></tr></thead><tbody>`;
    count = 1;
    followupItems.forEach(node => {
        if (node.tagName === "DIV" && node.querySelector('h4')) {
            const name = node.querySelector('h4').innerText, visitor = node.querySelector('p')?.innerText.replace('👤 الخادم المتابع:', '').trim() || "";
            const date = node.querySelectorAll('p')[1]?.innerText.replace('🗓️ موعد المتابعة:', '').trim() || "";
            html += `<tr><td style="text-align:center;font-weight:bold;">${count++}</td><td style="font-weight:bold;">${name}</td><td>${visitor}</td><td style="font-weight:bold;">${date}</td></tr>`;
        }
    });
    if (count === 1) html += `<tr><td colspan="4" style="text-align:center;">لا توجد متابعات مجدولة.</td></tr>`;
    html += `</tbody></table>`;
    printArea.innerHTML = html;
    setTimeout(() => { window.print(); printArea.innerHTML = ""; }, 200);
}

// 11. النوافذ المنبثقة والعمليات الأساسية وعرض الجداول والكروت وسجل المراقبة
function openModal(action, data={}) {
    document.getElementById('formAction').value = action;
    document.getElementById('recordId').value = action === 'update' ? data[Object.keys(data)[0]] : "";
    document.getElementById('modalTitle').innerHTML = action === 'add' ? `إضافة سجل جديد` : `تعديل السجل`;
    const selector = document.getElementById('memberTypeSelector');
    if (currentTab === 'Names' && action === 'add') selector?.classList.remove('hidden'); else selector?.classList.add('hidden');

    const fCont = document.getElementById('formFields'); if (!fCont) return; fCont.innerHTML = "";
    (SCHEMAS[currentTab] || []).forEach(f => {
        const val = (f.id === "المنطقة") ? getMemberArea(data) : getFieldValNormalized(data, f.id), w = document.createElement('div');
        w.id = `wrapper_${f.id.replace(/\s+/g, '_')}`; if (f.full) w.className = "md:col-span-2 lg:col-span-3";
        let inpH = ""; const cls = "w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs transition";
        if (f.type === "family_head_select") {
            const heads = new Set(rawData.map(r => getFieldValNormalized(r, "اسم رب الاسرة")).filter(Boolean));
            inpH = `<input type="text" name="${f.id}" list="familyHeadsList" value="${val}" oninput="checkLiveNameDuplicates()" ${f.required?'required':''} class="${cls}"><datalist id="familyHeadsList">${Array.from(heads).sort((a,b)=>a.localeCompare(b,'ar')).map(h => `<option value="${h}">`).join('')}</datalist>`;
        }
        else if (f.type === "servant_name_autocomplete") inpH = `<input type="text" name="${f.id}" list="servantsNamesList" value="${val}" ${f.required?'required':''} onchange="onServantNameSelected(this.value)" class="${cls}">`;
        else if (f.type === "area_autocomplete") inpH = `<input type="text" name="${f.id}" list="areasDatalist" value="${val}" placeholder="اختر أو اكتب المنطقة..." class="${cls}">`;
        else if (f.type === "stage_select") inpH = `<select name="${f.id}" onchange="updateGradeDropdown(this.value)" class="${cls}" ${f.required?'required':''}><option value="">اختر المرحلة...</option><option value="الكل">الكل</option>${f.options.map(o => `<option value="${o}" ${val===o?'selected':''}>${o}</option>`).join('')}</select>`;
        else if (f.type === "grade_select") inpH = `<select name="${f.id}" class="${cls}" ${f.required?'required':''}><option value="">اختر الصف...</option></select>`;
        else if (f.type === "select") inpH = `<select name="${f.id}" class="${cls}" ${f.required?'required':''} ${f.id === "ذكر/انثي" ? 'onchange="handleGenderChange(this.value)"' : ''}>${f.options.map(o => `<option value="${o}" ${val===o?'selected':''}>${o || "---"}</option>`).join('')}</select>`;
        else if (f.type === "textarea") inpH = `<textarea name="${f.id}" rows="2" class="${cls}">${val}</textarea>`;
        else inpH = `<input type="${f.type}" name="${f.id}" value="${val}" ${f.required?'required':''} class="${cls}">`;
        w.innerHTML = `<label class="block font-bold mb-1 text-slate-700 text-xs">${f.label} ${f.required?'<span class="text-rose-500">*</span>':''}</label>${inpH}`;
        fCont.appendChild(w);
    });

    if (currentTab === 'Names') {
        const alertBox = document.createElement('div');
        alertBox.id = 'duplicateLiveAlert';
        alertBox.className = 'md:col-span-2 lg:col-span-3 hidden';
        fCont.prepend(alertBox);

        const nameInp = fCont.querySelector('input[name="الاسم ثلاثي"]');
        const nidInp = fCont.querySelector('input[name="الرقم القومي"]');
        if (nameInp) nameInp.addEventListener('input', checkLiveNameDuplicates);
        if (nidInp) nidInp.addEventListener('input', checkLiveNameDuplicates);
        if (action === 'add') toggleAddMode('new_head');
        else setTimeout(checkLiveNameDuplicates, 50);
    }
    if (currentTab === 'Servants') populateServantsDatalist();
    const stg = data["المرحلة"] || data["Stage"] || data["AssignedStage"] || "", grd = data["الصف"] || data["Grade"] || data["AssignedGrade"] || "";
    if (stg) updateGradeDropdown(stg, grd);
    if (data["ذكر/انثي"]) handleGenderChange(data["ذكر/انثي"]);
    document.getElementById('dataModal')?.classList.remove('hidden');
}

function checkLiveNameDuplicates() {
    if (currentTab !== 'Names') return;
    const alertBox = document.getElementById('duplicateLiveAlert');
    if (!alertBox) return;

    const action = document.getElementById('formAction')?.value || 'add';
    const recIdVal = String(document.getElementById('recordId')?.value || '');
    const addMode = document.querySelector('input[name="addMode"]:checked')?.value || 'new_head';

    const fullName = (document.querySelector('#formFields input[name="الاسم ثلاثي"]')?.value || '').trim();
    const headName = (document.querySelector('#formFields input[name="اسم رب الاسرة"]')?.value || '').trim();
    const nid = (document.querySelector('#formFields input[name="الرقم القومي"]')?.value || '').trim();

    const normFull = normalizeArabic(fullName);
    const normHead = normalizeArabic(headName);
    const idKey = rawData.length > 0 ? Object.keys(rawData[0])[0] : 'ID';

    const others = rawData.filter(r => action !== 'update' || String(r[idKey]) !== recIdVal);
    let warnings = [];

    if (nid && nid.length >= 6) {
        const dupNid = others.find(r => String(r["الرقم القومي"] || '').trim() === nid);
        if (dupNid) {
            warnings.push({ type: 'error', text: `⛔ الرقم القومي مسجل مسبقاً باسم: "${dupNid["الاسم ثلاثي"]}" في أسرة: "${dupNid["اسم رب الاسرة"] || '-'}"` });
        }
    }

    if (action === 'add' && addMode === 'new_head' && normFull) {
        const dupHeadMembers = others.filter(r => normalizeArabic(r["اسم رب الاسرة"]) === normFull);
        if (dupHeadMembers.length > 0) {
            const area = dupHeadMembers[0]["المنطقة"] || "غير محددة";
            warnings.push({ type: 'error', text: `⛔ رب الأسرة "${fullName}" مسجل بالفعل (${dupHeadMembers.length} أفراد - منطقة: ${area}). لإضافة فرد تابع له، اختر "إضافة فرد لأسرة قائمة" بالأعلى.` });
        }
    }

    if (normFull && normHead && !(action === 'add' && addMode === 'new_head')) {
        const sameFamMember = others.find(r => normalizeArabic(r["اسم رب الاسرة"]) === normHead && normalizeArabic(r["الاسم ثلاثي"]) === normFull);
        if (sameFamMember) {
            warnings.push({ type: 'error', text: `⛔ العضو "${fullName}" مسجل بالفعل داخل نفس هذه الأسرة (#${sameFamMember[idKey]})!` });
        }
    }

    if (normFull) {
        const otherFamMatch = others.find(r => normalizeArabic(r["الاسم ثلاثي"]) === normFull && normalizeArabic(r["اسم رب الاسرة"]) !== normHead);
        if (otherFamMatch) {
            warnings.push({ type: 'warn', text: `⚠️ تنبيه تشابه أسماء: يوجد عضو بنفس الاسم مسجل في أسرة "${otherFamMatch["اسم رب الاسرة"] || '-'}" (منطقة: ${otherFamMatch["المنطقة"] || 'غير محددة'} | هاتف: ${otherFamMatch["تليفون العمل/المحمول"] || '-'}).` });
        }
    }

    if (action === 'add' && addMode === 'add_member' && normHead) {
        const headExists = others.some(r => normalizeArabic(r["اسم رب الاسرة"]) === normHead);
        if (!headExists) {
            warnings.push({ type: 'warn', text: `⚠️ اسم رب الأسرة "${headName}" غير موجود حالياً في قائمة الأسر، سيتم إنشاء أسرة جديدة بهذا الاسم.` });
        }
    }

    if (warnings.length === 0) {
        alertBox.classList.add('hidden');
        alertBox.innerHTML = '';
        return;
    }

    alertBox.classList.remove('hidden');
    alertBox.innerHTML = warnings.map(w => {
        const cls = w.type === 'error'
            ? 'bg-rose-50 border-rose-300 text-rose-800'
            : 'bg-amber-50 border-amber-300 text-amber-900';
        return `<div class="p-3 mb-2 rounded-xl border text-xs font-black leading-relaxed ${cls}">${w.text}</div>`;
    }).join('');
}

function closeModal() { document.getElementById('dataModal')?.classList.add('hidden'); }

async function handleFormSubmit(e) {
    if (e) { try { e.preventDefault(); e.stopPropagation(); } catch(err) {} }
    const action = document.getElementById('formAction')?.value, form = document.getElementById('recordForm'); if (!form) return;
    const fd = new FormData(form), payload = {}; fd.forEach((v, k) => { if (action === "update" || v.trim()) payload[k] = v.trim(); });
    const recIdVal = document.getElementById('recordId')?.value;
    const idKey = (rawData.length > 0) ? Object.keys(rawData[0])[0] : "ID";
    const otherRecords = rawData.filter(r => action !== "update" || String(r[idKey]) !== String(recIdVal));

    if (currentTab === 'Names') {
        if (!payload["اسم رب الاسرة"]) { alert("خطأ: لا يمكن حفظ العضو بدون تحديد اسم رب الأسرة!"); return; }
        const normFull = normalizeArabic(payload["الاسم ثلاثي"]);
        const normHead = normalizeArabic(payload["اسم رب الاسرة"]);
        const addMode = document.querySelector('input[name="addMode"]:checked')?.value || 'new_head';

        // 1. منع تكرار الرقم القومي نهائياً
        if (payload["الرقم القومي"]) {
            const dupNid = otherRecords.find(r => String(r["الرقم القومي"] || "").trim() === payload["الرقم القومي"]);
            if (dupNid) {
                alert(`⛔ لا يمكن الحفظ!\nالرقم القومي (${payload["الرقم القومي"]}) مسجل بالفعل باسم:\n"${dupNid["الاسم ثلاثي"]}" في أسرة "${dupNid["اسم رب الاسرة"] || '-'}"`);
                return;
            }
        }

        // 2. منع تكرار إنشاء رب أسرة موجود بالفعل
        if (action === "add" && addMode === "new_head") {
            const existingFamily = otherRecords.filter(r => normalizeArabic(r["اسم رب الاسرة"]) === normHead);
            if (existingFamily.length > 0) {
                const area = existingFamily[0]["المنطقة"] || "غير محددة";
                alert(`⛔ لا يمكن تكرار الأسرة!\nرب الأسرة "${payload["اسم رب الاسرة"]}" مسجل بالفعل في النظام (${existingFamily.length} أفراد - منطقة: ${area}).\n\nلإضافة فرد جديد لهذه الأسرة، اختر "إضافة فرد لأسرة قائمة" من أعلى النافذة.`);
                return;
            }
        }

        // 3. منع تكرار نفس الفرد داخل نفس الأسرة
        const dupInSameFamily = otherRecords.find(r =>
            normalizeArabic(r["اسم رب الاسرة"]) === normHead &&
            normalizeArabic(r["الاسم ثلاثي"]) === normFull
        );
        if (dupInSameFamily) {
            alert(`⛔ لا يمكن تكرار الفرد!\nالعضو "${payload["الاسم ثلاثي"]}" مسجل بالفعل داخل نفس هذه الأسرة (#${dupInSameFamily[idKey]}).`);
            return;
        }

        // 4. تنبيه وتأكيد في حالة تشابه الاسم الثلاثي مع عضو في أسرة أخرى
        const dupInOtherFamily = otherRecords.find(r =>
            normalizeArabic(r["الاسم ثلاثي"]) === normFull &&
            normalizeArabic(r["اسم رب الاسرة"]) !== normHead
        );
        if (dupInOtherFamily) {
            const confirmMsg = `⚠️ تنبيه تشابه أسماء:\nيوجد عضو مسجل بنفس الاسم "${payload["الاسم ثلاثي"]}" في أسرة أخرى:\n• رب الأسرة: ${dupInOtherFamily["اسم رب الاسرة"] || "-"}\n• المنطقة: ${dupInOtherFamily["المنطقة"] || "غير محددة"}\n• المحمول: ${dupInOtherFamily["تليفون العمل/المحمول"] || "-"}\n\nهل أنت متأكد أنه شخص مختلف (تشابه أسماء) وتريد إتمام الحفظ؟`;
            if (!confirm(confirmMsg)) return;
        }
    }

    if (currentTab === 'Servants') {
        const normServant = normalizeArabic(payload["ServantName"]);
        const cleanUser = String(payload["Username"] || "").trim().toLowerCase();
        const dupServant = otherRecords.find(r =>
            (normServant && normalizeArabic(r["ServantName"]) === normServant) ||
            (cleanUser && String(r["Username"] || "").trim().toLowerCase() === cleanUser)
        );
        if (dupServant) {
            alert(`⛔ لا يمكن تكرار الخادم!\nالخادم "${dupServant["ServantName"]}" أو اسم المستخدم "${dupServant["Username"]}" مسجل بالفعل في قائمة الخدام.`);
            return;
        }
    }

    if (action === "update") payload[idKey] = Number(recIdVal);
    if (rawData.length > 0) {
        const sheetHeaders = Object.keys(rawData[0]);
        Object.keys(payload).forEach(k => {
            if (!sheetHeaders.includes(k)) {
                const matchedHeader = sheetHeaders.find(sh => normalizeArabic(sh) === normalizeArabic(k) || (k === "المنطقة" && normalizeArabic(sh).includes("منطق")));
                if (matchedHeader) {
                    payload[matchedHeader] = payload[k];
                    delete payload[k];
                }
            }
        });
    }
    const btn = document.getElementById('saveBtn'); if (btn) { btn.disabled = true; btn.innerHTML = `جاري الحفظ...`; }
    try {
        const data = await apiPost({ sheet: currentTab, action: action, data: payload });
        if (data.status === "success") {
            const itemName = payload["الاسم ثلاثي"] || payload["ChildName"] || payload["MemberName"] || payload["ServantName"] || "سجل";
            sendAuditLog(action === "add" ? "إضافة سجل" : "تعديل سجل", currentTab, `${itemName}${action === 'update' ? ' (#' + recIdVal + ')' : ''}`);
            closeModal();
            await loadData();
        } else alert("خطأ: " + data.message);
    } catch (err) { alert("حدث خطأ أثناء الحفظ."); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = `حفظ السجل`; } }
}

function editRecord(id) { const item = rawData.find(r => r[Object.keys(r)[0]] == id); if (item) openModal('update', item); }

async function deleteRecord(id) {
    if (!confirm(`تحذير: هل أنت متأكد من حذف السجل رقم #${id} نهائياً؟`)) return;
    const targetItem = rawData.find(r => r[Object.keys(r)[0]] == id);
    const targetName = targetItem ? (targetItem["الاسم ثلاثي"] || targetItem["ChildName"] || targetItem["MemberName"] || targetItem["ServantName"] || "") : "";
    showLoader(true);
    try {
        const res = await apiPost({ sheet: currentTab, action: "delete", data: { [Object.keys(rawData[0])[0]]: id } });
        if (res.status === "success") {
            sendAuditLog("حذف سجل", currentTab, `تم حذف السجل رقم #${id} ${targetName ? '(' + targetName + ')' : ''}`);
            await loadData();
        }
    } catch (err) { alert("فشل الحذف"); } finally { showLoader(false); }
}

function renderStandardCards() {
    if (currentTab === 'Names') return;
    const query = (document.getElementById('searchInput')?.value || "").trim().toLowerCase(), container = document.getElementById('standardCardsContainer');
    if (!container) return; container.innerHTML = "";

    let filtered = rawData.filter(item => {
        if (currentTab === "Sunday_School") {
            if (currentUser.Role === "Stage_Leader" && currentUser.AssignedStage !== "الكل" && item["Stage"] !== currentUser.AssignedStage) return false;
            if (currentUser.Role === "Class_Servant" && ((currentUser.AssignedStage !== "الكل" && item["Stage"] !== currentUser.AssignedStage) || (currentUser.AssignedClass !== "الكل" && item["ClassName"] !== currentUser.AssignedClass))) return false;
        }
        return Object.values(item).some(val => String(val).toLowerCase().includes(query));
    });

    const recCount = document.getElementById('recordCount'); if (recCount) recCount.innerText = `${filtered.length} سجل`;
    if (!filtered.length) { container.className = "block"; container.innerHTML = `<div class="text-center py-16 text-slate-400 font-bold bg-white rounded-2xl border border-dashed border-slate-300">لا توجد سجلات مطابقة</div>`; return; }

    // جدول سجل المراقبة (Audit Log)
    if (currentTab === "Audit_Log") {
        container.className = "bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden";
        const sortedLogs = [...filtered].reverse();
        container.innerHTML = `<div class="overflow-x-auto nice-scrollbar"><table class="w-full text-right text-xs"><thead class="bg-slate-100 text-slate-700 font-black border-b border-slate-200"><tr><th class="p-3 w-12 text-center">م</th><th class="p-3">التاريخ والوقت</th><th class="p-3">الخادم</th><th class="p-3">الصلاحية</th><th class="p-3 text-center">نوع العملية</th><th class="p-3">القسم</th><th class="p-3">التفاصيل</th></tr></thead><tbody class="divide-y divide-slate-100 font-semibold">${sortedLogs.map((item, idx) => {
            const act = String(item["ActionType"] || "-");
            const badgeCls = act.includes("حذف") ? "bg-rose-50 text-rose-700 border-rose-200" : act.includes("تعديل") ? "bg-amber-50 text-amber-700 border-amber-200" : act.includes("إضافة") || act.includes("رصد") ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-indigo-50 text-indigo-700 border-indigo-200";
            return `<tr class="hover:bg-slate-50"><td class="p-3 text-center text-slate-400 font-bold">${idx + 1}</td><td class="p-3 font-mono text-[11px]" dir="ltr">${item["Timestamp"] || "-"}</td><td class="p-3 font-black text-slate-800">${item["ServantName"] || "-"} <span class="text-[10px] text-slate-400 font-mono">(${item["Username"] || "-"})</span></td><td class="p-3 text-[11px]">${item["Role"] || "-"}</td><td class="p-3 text-center"><span class="px-2.5 py-1 rounded-lg font-black text-[10px] border ${badgeCls}">${act}</span></td><td class="p-3 font-bold text-slate-600">${item["TargetSheet"] || "-"}</td><td class="p-3 text-slate-700">${item["Details"] || "-"}</td></tr>`;
        }).join('')}</tbody></table></div>`;
        return;
    }

    if (currentTab === "Sunday_School") {
        container.className = "bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden";
        container.innerHTML = `<div class="overflow-x-auto nice-scrollbar"><table class="w-full text-right text-xs"><thead class="bg-slate-100 text-slate-700 font-black border-b border-slate-200"><tr><th class="p-3 w-12 text-center">م</th><th class="p-3">التاريخ</th><th class="p-3">المرحلة والصف</th><th class="p-3">الفصل</th><th class="p-3">اسم المخدوم</th><th class="p-3 text-center">الحضور</th><th class="p-3 text-center">التسميع</th><th class="p-3 text-center">النقاط</th><th class="p-3">ملاحظات</th><th class="p-3 text-center no-print">إجراءات</th></tr></thead><tbody class="divide-y divide-slate-100 font-semibold">${filtered.map((item, idx) => { const idVal = item[Object.keys(item)[0]]; return `<tr class="hover:bg-slate-50"><td class="p-3 text-center text-slate-400 font-bold">${idx + 1}</td><td class="p-3 font-mono">${item["SessionDate"] || "-"}</td><td class="p-3"><span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">${item["Stage"] || "-"}</span> ${item["Grade"] || ""}</td><td class="p-3">${item["ClassName"] || "-"}</td><td class="p-3 font-black text-slate-800">${item["ChildName"] || "-"}</td><td class="p-3 text-center"><span class="px-2.5 py-1 rounded-lg font-black text-[11px] ${item["Attendance"]==='حاضر'?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700'}">${item["Attendance"] || "-"}</span></td><td class="p-3 text-center">${item["Memorization"] || "-"}</td><td class="p-3 text-center font-black">${item["Points"] || 0}</td><td class="p-3 text-slate-500">${item["Notes"] || "-"}</td><td class="p-3 text-center no-print"><button onclick="editRecord(${idVal})" class="text-xs font-bold text-indigo-600 hover:underline ml-2">تعديل</button>${currentUser.Role === "Admin" ? `<button onclick="deleteRecord(${idVal})" class="text-xs font-bold text-rose-600 hover:underline">حذف</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
        return;
    }

    container.className = "grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 print:gap-2 print:grid-cols-1";
    filtered.forEach(item => {
        const idVal = item[Object.keys(item)[0]], card = document.createElement('div');
        card.className = "bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition flex flex-col justify-between";
        let details = "", title = item["ChildName"] || item["ServantName"] || item["MemberName"] || "سجل";
        if (currentTab === "Servants") details = `<p class="text-xs text-slate-600 mb-1 font-bold">الصلاحية: <span class="text-indigo-700">${item["Role"]}</span></p><p class="text-xs text-slate-500 font-semibold">النطاق: ${item["AssignedStage"]} - ${item["AssignedGrade"] || ""} (${item["AssignedClass"] || ""})</p>`;
        else if (currentTab === "Visitations") details = `<p class="text-xs text-slate-600 mb-1 font-semibold">الخادم: ${item["VisitorName"]}</p><p class="text-xs text-slate-500">تاريخ الافتقاد: ${item["VisitDate"]}</p>`;
        else if (currentTab === "Meetings_Attendance") details = `<p class="text-xs text-slate-600 mb-1 font-semibold">${item["MeetingName"]} - <span class="font-bold ${item["Status"]==='حاضر'?'text-emerald-600':item["Status"]==='معتذر'?'text-amber-600':'text-rose-600'}">${item["Status"]}</span></p><p class="text-xs text-slate-500">التاريخ: ${item["MeetingDate"]}</p>`;

        card.innerHTML = `<div><div class="flex justify-between items-start mb-3"><h4 class="font-black text-sm text-slate-800 truncate">${title}</h4><span class="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">#${idVal}</span></div><div class="mb-4">${details}</div></div><div class="flex justify-end gap-2 pt-3 border-t border-slate-100 no-print"><button onclick="editRecord(${idVal})" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1.5 rounded-lg transition">تعديل</button>${currentUser.Role === "Admin" ? `<button onclick="deleteRecord(${idVal})" class="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 px-2.5 py-1.5 rounded-lg transition">حذف</button>` : ''}</div>`;
        container.appendChild(card);
    });
}

// 12. دوال الاتصال المؤمّن بالسيرفر، سجل المراقبة، وتصدير Excel
async function apiFetch(url) {
    const sep = url.includes('?') ? '&' : '?';
    const fullUrl = `${url}${sep}token=${encodeURIComponent(sessionToken)}&t=${Date.now()}`;
    const response = await fetch(fullUrl, { method: 'GET', redirect: 'follow' });
    if (!response.ok) throw new Error(`خطأ استجابة السيرفر: ${response.status}`);
    const res = await response.json();
    if (res.status === "unauthorized") {
        alert("انتهت صلاحية الجلسة أو غير مصرح بالوصول، يرجى تسجيل الدخول.");
        sessionStorage.clear();
        location.reload();
        throw new Error("Unauthorized");
    }
    return res;
}

async function apiPost(bodyObj) {
    const payloadWithToken = { ...bodyObj, token: sessionToken, user: currentUser ? currentUser.ServantName : "" };
    const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payloadWithToken) });
    const res = await response.json();
    if (res.status === "unauthorized") {
        alert("انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى.");
        sessionStorage.clear();
        location.reload();
        throw new Error("Unauthorized");
    }
    return res;
}

function sendAuditLog(actionType, targetSheet, recordDetails) {
    if (!currentUser) return;
    fetch(API_URL, {
        method: 'POST',
        body: JSON.stringify({
            sheet: "Audit_Log",
            action: "add",
            token: sessionToken,
            data: {
                "Timestamp": new Date().toLocaleString('ar-EG'),
                "ServantName": currentUser.ServantName || "غير معروف",
                "Username": currentUser.Username || "-",
                "Role": currentUser.Role || "-",
                "ActionType": actionType,
                "TargetSheet": targetSheet,
                "Details": recordDetails
            }
        })
    }).catch(() => {});
}

function exportCurrentViewToExcel() {
    if (!rawData || rawData.length === 0) {
        alert("لا توجد بيانات متاحة للتصدير حالياً!");
        return;
    }
    const headers = Object.keys(rawData[0]).filter(h => h !== "Password");
    const csvRows = [headers.join(',')];
    rawData.forEach(row => {
        const vals = headers.map(h => {
            const val = String(row[h] ?? "").replace(/"/g, '""');
            return `"${val}"`;
        });
        csvRows.push(vals.join(','));
    });
    const csvString = "\uFEFF" + csvRows.join('\n');
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const now = new Date();
    link.download = `${currentTab || 'Church_Data'}_${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    sendAuditLog("تصدير ملف Excel", currentTab, `تم تصدير (${rawData.length}) سجل`);
}

async function loadData(force = false) {
    if (!currentTab) return;
    showLoader(true);
    let attempts = 0, success = false;
    while (attempts < 3 && !success) {
        attempts++;
        try {
            const res = await apiFetch(`${API_URL}?sheet=${encodeURIComponent(currentTab)}`);
            if (res.status === "success") {
                rawData = Array.isArray(res.data) ? res.data : [];
                backendAreas = res.areas || [];
                if (currentTab === 'Names') {
                    namesCacheData = rawData; populateAreasDropdown();
                    if (currentNamesView === 'roster') { buildAlphabetBar(); renderFamilyHeadsRoster(); } else applyNamesFilter();
                    if (visitationsData.length === 0) {
                        apiFetch(`${API_URL}?sheet=Visitations`).then(d => {
                            if (d.status === "success") { visitationsData = d.data; if (currentNamesView === 'roster') renderFamilyHeadsRoster(); }
                        }).catch(() => {});
                    }
                } else if (currentTab === 'Sunday_School') {
                    if (currentSSView === 'live') initSundaySchoolLiveView();
                    else if (currentSSView === 'charts') initSSChartsView();
                    else renderStandardCards();
                } else if (currentTab === 'Meetings_Attendance') {
                    if (currentMeetingsView === 'live') initServantsMeetingLiveView(); else renderStandardCards();
                } else if (currentTab === 'Visitations') {
                    visitationsData = rawData;
                    if (currentVisitView === 'dashboard') initVisitationsDashboard(); else renderStandardCards();
                } else if (currentTab === 'Servants') {
                    servantsCacheData = rawData; renderStandardCards();
                } else {
                    renderStandardCards();
                }
                success = true;
            } else throw new Error(res.message || "فشل معالجة البيانات");
        } catch (err) {
            if (err.message === "Unauthorized") break;
            if (attempts >= 3) alert(`تعذر جلب البيانات.\nالسبب: ${err.message}`);
            else await new Promise(r => setTimeout(r, 1000));
        } finally {
            if (success || attempts >= 3) showLoader(false);
        }
    }
}

function showLoader(s) {
    document.getElementById('loader')?.classList.toggle('hidden', !s);
    if (currentTab === 'Names') {
        if (currentNamesView === 'roster') document.getElementById('namesRosterSection')?.classList.toggle('hidden', s);
        else document.getElementById('familyResultsContainer')?.classList.toggle('hidden', s);
    } else if (currentTab === 'Sunday_School') {
        if (currentSSView === 'live') document.getElementById('sundaySchoolLiveSection')?.classList.toggle('hidden', s);
        else if (currentSSView === 'charts') document.getElementById('sundaySchoolChartsSection')?.classList.toggle('hidden', s);
        else document.getElementById('standardCardsContainer')?.classList.toggle('hidden', s);
    } else if (currentTab === 'Meetings_Attendance') {
        if (currentMeetingsView === 'live') document.getElementById('servantsMeetingLiveSection')?.classList.toggle('hidden', s);
        else document.getElementById('standardCardsContainer')?.classList.toggle('hidden', s);
    } else if (currentTab === 'Visitations') {
        if (currentVisitView === 'dashboard') document.getElementById('visitationDashboardSection')?.classList.toggle('hidden', s);
        else document.getElementById('standardCardsContainer')?.classList.toggle('hidden', s);
    } else {
        document.getElementById('standardCardsContainer')?.classList.toggle('hidden', s);
    }
}

// 13. دوال الطباعة واستخراج التقارير
function setupPrintHeader(reportTitle) {
    const titleEl = document.getElementById('printReportTitle'), servEl = document.getElementById('printServantName'), dateEl = document.getElementById('printCurrentDate');
    if (titleEl) titleEl.innerText = reportTitle;
    if (servEl) servEl.innerText = currentUser ? `${currentUser.ServantName} (${currentUser.Role})` : "الأدمن";
    const now = new Date(); if (dateEl) dateEl.innerText = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
}

function buildAndPrintFamilies(familiesMap, reportTitle) {
    const printContainer = document.getElementById('printContainer'); if (!printContainer) return;
    const sortedHeads = Object.keys(familiesMap).sort((a, b) => a.localeCompare(b, 'ar'));
    if (sortedHeads.length === 0) { alert("لا توجد أسر مطابقة للطباعة!"); return; }
    printContainer.innerHTML = sortedHeads.map((headName, idx) => {
        const members = familiesMap[headName], headRec = members.find(m => m["الاسم ثلاثي"] === headName) || members[0];
        const addressStr = [getMemberArea(headRec), getFieldValNormalized(headRec, "اسم الشارع"), getFieldValNormalized(headRec, "رقم المنزل")].filter(Boolean).join(' - ') || "غير محدد";
        const phoneStr = headRec?.["هاتف الاسرة"] || headRec?.["تليفون العمل/المحمول"] || "-";
        const membersStr = members.map((m, mIdx) => `${mIdx + 1}. ${m["الاسم ثلاثي"] || "-"} (${m["تليفون العمل/المحمول"] || "-"})`).join(' • ');
        return `<div class="print-family-row"><div><strong>${idx + 1}. رب الأسرة: ${headName}</strong> | العنوان: ${addressStr} | الهاتف: ${phoneStr}</div><div><strong>أفراد الأسرة:</strong> ${membersStr}</div></div>`;
    }).join('');
    setupPrintHeader(reportTitle);
    setTimeout(() => { window.print(); printContainer.innerHTML = ""; }, 200);
}

// 14. أحداث مساعدة والتمرير
function toggleAddMode(mode) {
    const headFieldWrapper = document.getElementById('wrapper_اسم_رب_الاسرة'), nameInput = document.querySelector('input[name="الاسم ثلاثي"]'), relationSelect = document.querySelector('select[name="صلة القرابة"]');
    if (!headFieldWrapper) return;
    if (mode === "new_head") {
        headFieldWrapper.innerHTML = `<label class="block font-bold mb-1 text-slate-700 text-xs">اسم رب الأسرة (تلقائي)</label><input type="text" name="اسم رب الاسرة" id="input_head_name" readonly class="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-xs text-slate-500">`;
        if (nameInput) {
            const h = document.getElementById('input_head_name');
            if (h) h.value = nameInput.value;
            nameInput.oninput = (e) => { const hEl = document.getElementById('input_head_name'); if (hEl) hEl.value = e.target.value; };
        }
        if (relationSelect) relationSelect.value = "زوج";
    } else {
        const heads = new Set(rawData.map(r => r["اسم رب الاسرة"]).filter(Boolean));
        headFieldWrapper.innerHTML = `<label class="block font-bold mb-1 text-slate-700 text-xs">اسم رب الأسرة *</label><input type="text" name="اسم رب الاسرة" list="familyHeadsList" oninput="checkLiveNameDuplicates()" required class="w-full p-2.5 bg-slate-50 border border-indigo-300 rounded-xl font-bold text-xs"><datalist id="familyHeadsList">${Array.from(heads).sort().map(h => `<option value="${h}">`).join('')}</datalist>`;
        if (nameInput) nameInput.oninput = null;
        if (relationSelect) relationSelect.value = "";
    }
    checkLiveNameDuplicates();
}

function updateGradeDropdown(stg, grd="") {
    const sel = document.querySelector('select[name="الصف"], select[name="Grade"], select[name="AssignedGrade"]');
    if (!sel) return;
    sel.innerHTML = `<option value="">اختر الصف...</option><option value="الكل">الكل</option>` + (STAGE_GRADES[stg] || []).map(g => `<option value="${g}" ${g===grd?'selected':''}>${g}</option>`).join('');
}

function handleGenderChange(v) {
    const rSel = document.querySelector('select[name="صلة القرابة"]'), mSel = document.querySelector('select[name="الحالة الاجتماعية"]');
    if (rSel) Array.from(rSel.options).forEach(o => o.disabled = v==="ذكر" ? ["زوجة","ابنة","والدة","أخت"].includes(o.value) : v==="انثي" ? ["زوج","ابن","والد","أخ"].includes(o.value) : false);
    if (mSel) Array.from(mSel.options).forEach(o => o.disabled = v==="ذكر" ? ["متزوجة","انسة","ارملة"].includes(o.value) : v==="انثي" ? ["متزوج","اعزب","ارمل"].includes(o.value) : false);
}

function calculateAge(dobStr, nationalId = "") {
    const currentYear = 2026, nid = String(nationalId || "").trim();
    if (nid.length === 14 && /^\d+$/.test(nid) && (nid[0] === '2' || nid[0] === '3')) {
        const birthY = (nid[0] === '2' ? 1900 : 2000) + parseInt(nid.substring(1, 3), 10);
        if (birthY > 1900 && birthY <= currentYear) return currentYear - birthY;
    }
    const match = String(dobStr || "").match(/\b(19\d\d|20\d\d)\b/);
    if (match) { const birthY = parseInt(match[1], 10); if (birthY > 1900 && birthY <= currentYear) return currentYear - birthY; }
    return null;
}

window.addEventListener('scroll', () => {
    const topBtn = document.getElementById('scrollTopBtn'), bottomBtn = document.getElementById('scrollBottomBtn');
    if (!topBtn || !bottomBtn) return;
    topBtn.classList.toggle('opacity-0', window.scrollY <= 250);
    topBtn.classList.toggle('pointer-events-none', window.scrollY <= 250);
    const atBottom = (window.innerHeight + window.scrollY) >= (document.body.offsetHeight - 50);
    bottomBtn.classList.toggle('opacity-0', atBottom);
    bottomBtn.classList.toggle('pointer-events-none', atBottom);
});
/* ==================== نهاية الملف ==================== */
