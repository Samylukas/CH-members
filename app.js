const API_URL = "https://script.google.com/macros/s/AKfycbxUSj07z5nkCv88hrgob88-bB21SLs2OmK9-BbSSUu_4m2eirI8cBHCl-5xUv0cyTSZ6Q/exec";

let currentUser = null;
let currentTab = "";
let rawData = [];
let backendAreas = [];
let namesCacheData = []; // كاش لأعضاء شيت Names لتوليد كشوف الفصول
let visitationsData = [];
let currentNamesView = "roster";
let currentSSView = "live"; // 'live' لرصد حضور اليوم، 'history' للسجل السابق
let selectedLetter = "الكل";
let splashEnded = false;
let currentSSLiveKids = [];

function endSplash(e) {
    if (e) {
        try {
            e.preventDefault();
            e.stopPropagation();
        } catch(err) {}
    }
    if (splashEnded) return;
    splashEnded = true;

    const splash = document.getElementById('splashScreen');
    const video = document.getElementById('splashVideo');
    const login = document.getElementById('loginScreen');

    if (video) {
        try {
            video.pause();
            video.currentTime = 0;
            video.onended = null;
        } catch(err) {}
    }

    if (splash) {
        splash.style.pointerEvents = 'none';
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.style.display = 'none';
        }, 200);
    }

    if (login) {
        login.classList.remove('hidden');
        login.style.display = 'flex';
        setTimeout(() => {
            const passInput = document.getElementById('loginPass');
            if (passInput) passInput.focus();
        }, 300);
    }
}

window.onload = () => {
    loadServantsListForLogin();

    const video = document.getElementById('splashVideo');
    if (video) {
        video.muted = true;
        video.playbackRate = 1.3;

        video.onended = () => {
            endSplash();
        };

        const playPromise = video.play();
        if (playPromise !== undefined) {
            playPromise.catch(() => {
                endSplash();
            });
        }

        setTimeout(() => {
            endSplash();
        }, 9000);
    } else {
        endSplash();
    }
};

const ICONS = {
    users: `<svg class="w-12 h-12 inline-block text-emerald-600" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
    children: `<svg class="w-12 h-12 inline-block text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
    visitations: `<svg class="w-12 h-12 inline-block text-rose-600" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`,
    meetings: `<svg class="w-12 h-12 inline-block text-amber-500" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>`,
    servants: `<svg class="w-12 h-12 inline-block text-purple-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>`
};

const STAGE_GRADES = { 
    "حضانة": ["بيبي كلاس", "أولى حضانة", "ثانية حضانة"], 
    "ابتدائي": ["الصف الأول", "الصف الثاني", "الصف الثالث", "الصف الرابع", "الصف الخامس", "الصف السادس"], 
    "إعدادي": ["الصف الأول الإعدادي", "الصف الثاني الإعدادي", "الصف الثالث الإعدادي"], 
    "ثانوي": ["الصف الأول الثانوي", "الصف الثاني الثانوي", "الصف الثالث الثانوي"], 
    "جامعي": ["الفرقة الأولى", "الفرقة الثانية", "الفرقة الثالثة", "الفرقة الرابعة", "بكالوريوس / تخرج"], 
    "خريجين": ["خريج"] 
};

const TABS_INFO = {
    "Names": { label: "أعضاء الكنيسة", desc: "دليل أرباب الأسر، البيانات العائلية، والفرز المتقدم", svg: ICONS.users, colorClass: "card-names", roles: ["Admin", "SundaySchool_Admin"] },
    "Sunday_School": { label: "مدارس الأحد", desc: "كشف تحضير الفصول، الحضور، والتسميع", svg: ICONS.children, colorClass: "card-sunday", roles: ["Admin", "SundaySchool_Admin", "Stage_Leader", "Class_Servant"] },
    "Visitations": { label: "سجل الافتقاد", desc: "متابعة الزيارات ومواعيد الافتقاد", svg: ICONS.visitations, colorClass: "card-visitations", roles: ["Admin"] },
    "Meetings_Attendance": { label: "حضور الاجتماعات", desc: "تسجيل حضور وغياب الاجتماعات", svg: ICONS.meetings, colorClass: "card-meetings", roles: ["Admin"] },
    "Servants": { label: "إدارة الخدام", desc: "توزيع الصلاحيات والحسابات", svg: ICONS.servants, colorClass: "card-servants", roles: ["Admin"] }
};

const SCHEMAS = {
    "Names": [
        { id: "اسم رب الاسرة", label: "اسم رب الأسرة", type: "family_head_select", required: true },
        { id: "الاسم ثلاثي", label: "الاسم ثلاثي", type: "text", required: true },
        { id: "حالة القيد", label: "حالة القيد الكنسي", type: "select", options: ["على قيد الحياة", "منتقل (متوفى)"], required: true },
        { id: "تاريخ الوفاة", label: "تاريخ الوفاة (DD/MM/YYYY)", type: "text" },
        { id: "ذكر/انثي", label: "النوع", type: "select", options: ["", "ذكر", "انثي"], required: true },
        { id: "صلة القرابة", label: "صلة القرابة", type: "select", options: ["", "زوج", "زوجة", "ابن", "ابنة", "والد", "والدة", "أخ", "أخت", "أخرى"] },
        { id: "الحالة الاجتماعية", label: "الحالة الاجتماعية", type: "select", options: ["", "متزوج", "متزوجة", "اعزب", "انسة", "ارمل", "ارملة"] },
        { id: "المرحلة", label: "المرحلة الدراسية", type: "stage_select", options: Object.keys(STAGE_GRADES) },
        { id: "الصف", label: "الصف الدراسي", type: "grade_select" },
        { id: "فصل مدارس الاحد", label: "فصل مدارس الأحد", type: "text" },
        { id: "مدارس الأحد", label: "مدارس الأحد", type: "select", options: ["", "مشترك", "غير مشترك"] },
        { id: "أنهي مدارس الأحد", label: "أنهي مدارس الأحد (الكنيسة / الفصل)", type: "text" },
        { id: "تليفون العمل/المحمول", label: "المحمول / الهاتف", type: "text" },
        { id: "تاريخ الميلاد", label: "تاريخ الميلاد (DD/MM/YYYY)", type: "text" },
        { id: "الرقم القومي", label: "الرقم القومي", type: "text" },
        { id: "تاريخ اخر اعتراف", label: "تاريخ آخر اعتراف (DD/MM/YYYY)", type: "text" },
        { id: "اب الاعتراف", label: "أب الاعتراف", type: "text" },
        { id: "البطاقة الانتخابية", label: "البطاقة الانتخابية", type: "select", options: ["", "يوجد", "لا يوجد"] },
        { id: "تاريخ الزواج", label: "تاريخ الزواج (DD/MM/YYYY)", type: "text" },
        { id: "المؤهل", label: "المؤهل الدراسي", type: "text" },
        { id: "المهنة/السنة الدراسية", label: "المهنة / العمل", type: "text" },
        { id: "الخادم الروحي", label: "الخادم الروحي", type: "text" },
        { id: "المواظبة على حضور القداس", label: "حضور القداس", type: "select", options: ["", "بانتظام", "أحياناً", "منقطع"] },
        { id: "المواظبة على حضور الاجتماع", label: "حضور الاجتماع", type: "select", options: ["", "بانتظام", "أحياناً", "منقطع"] },
        { id: "الرتبة الكنسية", label: "الرتبة الكنسية", type: "select", options: ["", "شعب", "إبصلتس", "أغنسطس", "إيبودياكون", "دياكون", "شماسة"] },
        { id: "الموعد المناسب للافتقاد", label: "موعد الافتقاد المناسب", type: "text" },
        { id: "ملاحظات", label: "ملاحظات عامة", type: "textarea", full: true }
    ],
    "Sunday_School": [
        { id: "Stage", label: "المرحلة", type: "stage_select", options: Object.keys(STAGE_GRADES), required: true },
        { id: "Grade", label: "الصف", type: "grade_select", required: true },
        { id: "ClassName", label: "اسم الفصل", type: "text", required: true },
        { id: "SessionDate", label: "تاريخ الدرس (DD/MM/YYYY)", type: "text", required: true },
        { id: "ChildID", label: "كود المخدوم (ID)", type: "number" },
        { id: "ChildName", label: "اسم الطفل", type: "text", required: true },
        { id: "ServantName", label: "اسم الخادم", type: "text" },
        { id: "Attendance", label: "الحضور", type: "select", options: ["حاضر", "غائب"] },
        { id: "Memorization", label: "الحفظ", type: "select", options: ["ممتاز", "جيد", "مقبول", "لم يحفظ"] },
        { id: "Points", label: "النقاط", type: "number" },
        { id: "Notes", label: "ملاحظات", type: "textarea", full: true }
    ],
    "Visitations": [
        { id: "MemberID", label: "كود المخدوم", type: "number", required: true },
        { id: "MemberName", label: "اسم المخدوم", type: "text", required: true },
        { id: "VisitDate", label: "تاريخ الافتقاد (DD/MM/YYYY)", type: "text", required: true },
        { id: "VisitorName", label: "اسم الخادم", type: "text", required: true },
        { id: "VisitType", label: "نوع الافتقاد", type: "select", options: ["منزلي", "تليفوني", "كنسي", "أخرى"] },
        { id: "FollowUpDate", label: "تاريخ المتابعة (DD/MM/YYYY)", type: "text" },
        { id: "Notes", label: "تقرير وملاحظات", type: "textarea", full: true }
    ],
    "Meetings_Attendance": [
        { id: "MeetingName", label: "اسم الاجتماع", type: "text", required: true },
        { id: "MeetingDate", label: "التاريخ (DD/MM/YYYY)", type: "text", required: true },
        { id: "MemberID", label: "كود العضو", type: "number" },
        { id: "MemberName", label: "الاسم", type: "text", required: true },
        { id: "Status", label: "الحالة", type: "select", options: ["حاضر", "معتذر", "غائب"] },
        { id: "Notes", label: "ملاحظات", type: "textarea", full: true }
    ],
    "Servants": [
        { id: "ServantName", label: "اسم الخادم", type: "text", required: true },
        { id: "Username", label: "اسم المستخدم / الموبايل", type: "text", required: true },
        { id: "Password", label: "كلمة المرور", type: "text", required: true },
        { id: "Role", label: "الصلاحية", type: "select", options: ["Admin", "SundaySchool_Admin", "Stage_Leader", "Class_Servant"] },
        { id: "AssignedStage", label: "المرحلة المسندة", type: "select", options: ["الكل", ...Object.keys(STAGE_GRADES)] },
        { id: "AssignedGrade", label: "الصف المسند", type: "text" },
        { id: "AssignedClass", label: "الفصل المسند", type: "text" },
        { id: "Status", label: "الحالة", type: "select", options: ["نشط", "موقوف"] }
    ]
};

async function loadServantsListForLogin() {
    try {
        const res = await (await fetch(`${API_URL}?sheet=Servants`)).json();
        if (res.status === "success" && res.data.length > 0) {
            const select = document.getElementById('loginUser');
            select.innerHTML = `<option value="admin">أبونا الكاهن / الأدمن (admin)</option>`;
            res.data.forEach(s => {
                if (s.Username && s.Username !== "admin") {
                    select.innerHTML += `<option value="${s.Username}">${s.ServantName} (${s.Username})</option>`;
                }
            });
        }
    } catch(e) {}
}

function togglePasswordVisibility() {
    const input = document.getElementById('loginPass');
    const eye = document.getElementById('eyeIcon');
    if (input.type === "password") {
        input.type = "text";
        eye.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"/>`;
    } else {
        input.type = "password";
        eye.innerHTML = `<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"/>`;
    }
}

async function handleLogin(e) {
    e.preventDefault();
    const btn = document.getElementById('loginBtn');
    const err = document.getElementById('loginError');
    const userVal = document.getElementById('loginUser').value.trim();
    const passVal = document.getElementById('loginPass').value.trim();
    btn.innerHTML = `جاري التحقق...`;
    err.classList.add('hidden');

    try {
        const res = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({ action: 'login', data: { username: userVal, password: passVal } })
        });
        const data = await res.json();
        if (data.status === "success") {
            currentUser = data.user;
            initApp();
            return;
        } else {
            if (userVal === "admin" && passVal === "123456") {
                loginAsFallbackAdmin();
                return;
            }
            err.innerText = data.message;
            err.classList.remove('hidden');
        }
    } catch (error) {
        if (userVal === "admin" && passVal === "123456") {
            loginAsFallbackAdmin();
            return;
        }
        err.innerText = "تعذر الاتصال بالخادم، يرجى المحاولة ثانية.";
        err.classList.remove('hidden');
    } finally {
        btn.innerText = "تسجيل الدخول";
    }
}

function loginAsFallbackAdmin() {
    currentUser = { ServantName: "أبونا الكاهن / الأدمن", Role: "Admin", AssignedStage: "الكل", AssignedGrade: "الكل", AssignedClass: "الكل" };
    initApp();
}

function logout() {
    location.reload();
}

function initApp() {
    const login = document.getElementById('loginScreen');
    login.style.display = 'none';
    login.classList.add('hidden');

    document.getElementById('userBadge').innerHTML = `<span>الخادم: <span class="font-black text-indigo-700">${currentUser.ServantName}</span></span> <span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded ml-2 font-mono text-[11px] font-bold border border-indigo-200">${currentUser.Role}</span>`;
    buildDashboard();
    showDashboard();
}

function buildDashboard() {
    const grid = document.getElementById('dashboardGrid');
    grid.innerHTML = "";
    Object.keys(TABS_INFO).forEach(key => {
        const info = TABS_INFO[key];
        if (info.roles.includes(currentUser.Role)) {
            const card = document.createElement('div');
            card.className = `dashboard-card ${info.colorClass} p-8 flex flex-col items-center justify-center text-center cursor-pointer min-h-[200px]`;
            card.onclick = () => loadSection(key);
            card.innerHTML = `
                <div class="mb-4">${info.svg}</div>
                <h3 class="text-xl font-black text-slate-800 mb-2">${info.label}</h3>
                <p class="text-xs text-slate-500 font-bold">${info.desc}</p>
            `;
            grid.appendChild(card);
        }
    });
}

function showDashboard() {
    document.getElementById('dataView').classList.add('hidden');
    document.getElementById('dashboardView').classList.remove('hidden');
    currentTab = "";
}

function loadSection(sectionKey) {
    currentTab = sectionKey;
    document.getElementById('dashboardView').classList.add('hidden');
    document.getElementById('dataView').classList.remove('hidden');
    
    const info = TABS_INFO[sectionKey];
    document.getElementById('currentTabTitle').innerHTML = `${info.label}`;
    
    const btnSS = document.getElementById('btnPrintSundaySchool');
    const btnFiltered = document.getElementById('btnPrintFiltered');
    const btnRoster = document.getElementById('btnPrintRoster');
    const btnAdd = document.getElementById('btnAddNewRecord');

    // إخفاء كافة الواجهات الخاصة
    document.getElementById('namesViewSwitcher').classList.add('hidden');
    document.getElementById('namesViewSwitcher').classList.remove('flex');
    document.getElementById('ssViewSwitcher').classList.add('hidden');
    document.getElementById('ssViewSwitcher').classList.remove('flex');
    document.getElementById('sundaySchoolLiveSection').classList.add('hidden');
    document.getElementById('namesRosterSection').classList.add('hidden');
    document.getElementById('namesFilterSection').classList.add('hidden');
    document.getElementById('namesPlaceholder').classList.add('hidden');
    document.getElementById('familyResultsContainer').classList.add('hidden');
    document.getElementById('standardSearchContainer').classList.add('hidden');
    document.getElementById('standardCardsContainer').classList.add('hidden');
    btnSS.classList.add('hidden');
    btnFiltered.classList.add('hidden');
    btnRoster.classList.add('hidden');
    btnAdd.classList.remove('hidden');

    if (sectionKey === 'Names') {
        document.getElementById('namesViewSwitcher').classList.remove('hidden');
        document.getElementById('namesViewSwitcher').classList.add('flex');
        loadVisitationsCache();
        switchNamesView('roster');
    } else if (sectionKey === 'Sunday_School') {
        document.getElementById('ssViewSwitcher').classList.remove('hidden');
        document.getElementById('ssViewSwitcher').classList.add('flex');
        btnSS.classList.remove('hidden');
        switchSSView('live');
    } else {
        document.getElementById('standardSearchContainer').classList.remove('hidden');
        document.getElementById('standardCardsContainer').classList.remove('hidden');
        document.getElementById('searchInput').value = "";
    }
    
    loadData();
}

// تبديل واجهات مدارس الأحد: رصد مباشر أو سجلات قديمة
function switchSSView(view) {
    currentSSView = view;
    const btnLive = document.getElementById('btnSSLiveRoster');
    const btnHist = document.getElementById('btnSSHistory');
    const liveSec = document.getElementById('sundaySchoolLiveSection');
    const cardsSec = document.getElementById('standardCardsContainer');
    const searchSec = document.getElementById('standardSearchContainer');
    const btnAdd = document.getElementById('btnAddNewRecord');

    if (view === 'live') {
        btnLive.className = "px-4 py-2 rounded-lg text-xs font-black transition bg-white text-blue-700 shadow-sm";
        btnHist.className = "px-4 py-2 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
        liveSec.classList.remove('hidden');
        cardsSec.classList.add('hidden');
        searchSec.classList.add('hidden');
        btnAdd.classList.add('hidden');
        initSundaySchoolLiveView();
    } else {
        btnHist.className = "px-4 py-2 rounded-lg text-xs font-black transition bg-white text-blue-700 shadow-sm";
        btnLive.className = "px-4 py-2 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
        liveSec.classList.add('hidden');
        cardsSec.classList.remove('hidden');
        searchSec.classList.remove('hidden');
        btnAdd.classList.remove('hidden');
        renderStandardCards();
    }
}

// =========================================================================
// محرك رصد حضور وغياب مدارس الأحد المباشر للفصول
// =========================================================================

async function initSundaySchoolLiveView() {
    // 1. تعيين تاريخ اليوم كقيمة افتراضية (DD/MM/YYYY)
    const dateInput = document.getElementById('ssSessionDate');
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    dateInput.value = `${day}/${month}/${year}`;

    // 2. ضمان تحميل أعضاء شيت Names في الكاش
    if (namesCacheData.length === 0) {
        try {
            const res = await (await fetch(`${API_URL}?sheet=Names`)).json();
            if (res.status === "success") namesCacheData = res.data;
        } catch(e) {}
    }

    // 3. ملء قوائم المراحل والصفوف
    const stageSel = document.getElementById('ssFilterStage');
    stageSel.innerHTML = Object.keys(STAGE_GRADES).map(s => `<option value="${s}">${s}</option>`).join('');

    // تطبيق صلاحية الخادم
    if (currentUser.Role === "Stage_Leader" || currentUser.Role === "Class_Servant") {
        if (currentUser.AssignedStage && currentUser.AssignedStage !== "الكل") {
            stageSel.value = currentUser.AssignedStage;
            stageSel.disabled = true;
        }
    } else {
        stageSel.disabled = false;
    }

    onSSFilterStageChange(stageSel.value);
}

function onSSFilterStageChange(stage) {
    const grdSel = document.getElementById('ssFilterGrade');
    const grades = STAGE_GRADES[stage] || [];
    grdSel.innerHTML = `<option value="">كل الصفوف</option>` + grades.map(g => `<option value="${g}">${g}</option>`).join('');

    if (currentUser.Role === "Class_Servant" && currentUser.AssignedGrade && currentUser.AssignedGrade !== "الكل") {
        grdSel.value = currentUser.AssignedGrade;
        grdSel.disabled = true;
    } else {
        grdSel.disabled = false;
    }

    onSSFilterGradeChange();
}

function onSSFilterGradeChange() {
    const stage = document.getElementById('ssFilterStage').value;
    const grade = document.getElementById('ssFilterGrade').value;
    const classSel = document.getElementById('ssFilterClass');

    // استخراج أسماء الفصول المتاحة من شيت الأعضاء ديناميكياً
    const classes = new Set();
    namesCacheData.forEach(kid => {
        if (kid["المرحلة"] === stage && (!grade || kid["الصف"] === grade)) {
            const cName = (kid["فصل مدارس الاحد"] || kid["أنهي مدارس الأحد"] || "").trim();
            if (cName) classes.add(cName);
        }
    });

    classSel.innerHTML = `<option value="">كل الفصول (${classes.size})</option>` + 
        Array.from(classes).sort().map(c => `<option value="${c}">${c}</option>`).join('');

    if (currentUser.Role === "Class_Servant" && currentUser.AssignedClass && currentUser.AssignedClass !== "الكل") {
        classSel.value = currentUser.AssignedClass;
        classSel.disabled = true;
    } else {
        classSel.disabled = false;
    }

    loadSSLiveClassKids();
}

function loadSSLiveClassKids() {
    const stage = document.getElementById('ssFilterStage').value;
    const grade = document.getElementById('ssFilterGrade').value;
    const className = document.getElementById('ssFilterClass').value;

    // استخراج المخدومين المطابقين من شيت Names حصرياً
    const matched = namesCacheData.filter(kid => {
        if (isMemberDeceased(kid)) return false;
        if (kid["مدارس الأحد"] === "غير مشترك") return false;
        if (kid["المرحلة"] !== stage) return false;
        if (grade && kid["الصف"] !== grade) return false;
        if (className) {
            const cName = (kid["فصل مدارس الاحد"] || kid["أنهي مدارس الأحد"] || "").trim();
            if (cName !== className) return false;
        }
        return true;
    }).sort((a, b) => String(a["الاسم ثلاثي"]).localeCompare(String(b["الاسم ثلاثي"]), 'ar'));

    currentSSLiveKids = matched.map(kid => ({
        id: kid["ID"] || kid[Object.keys(kid)[0]],
        name: kid["الاسم ثلاثي"],
        phone: kid["تليفون العمل/المحمول"] || "-",
        stage: kid["المرحلة"] || stage,
        grade: kid["الصف"] || grade || "-",
        className: className || (kid["فصل مدارس الاحد"] || "عام"),
        attendance: "حاضر",
        memorization: "ممتاز",
        points: 10,
        notes: ""
    }));

    renderSSLiveKidsTable();
}

function renderSSLiveKidsTable() {
    const tbody = document.getElementById('ssLiveKidsTableBody');
    const emptyNotice = document.getElementById('ssLiveKidsEmpty');
    tbody.innerHTML = "";

    document.getElementById('recordCount').innerText = `${currentSSLiveKids.length} مخدوم بالفصل`;

    if (currentSSLiveKids.length === 0) {
        emptyNotice.classList.remove('hidden');
        return;
    }
    emptyNotice.classList.add('hidden');

    currentSSLiveKids.forEach((kid, idx) => {
        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
        tr.innerHTML = `
            <td class="p-3 text-center font-bold text-slate-400">${idx + 1}</td>
            <td class="p-3 font-bold text-slate-800">
                ${kid.name}
                <span class="block text-[10px] text-slate-500 font-semibold">${kid.stage} - ${kid.grade}</span>
            </td>
            <td class="p-3 font-mono text-slate-600 text-xs">${kid.phone}</td>
            <td class="p-3 text-center">
                <button type="button" onclick="toggleSSKidAttendance(${idx})" id="ss_btn_att_${idx}" 
                    class="px-3.5 py-1.5 rounded-xl font-black text-xs transition shadow-sm ${kid.attendance === 'حاضر' ? 'bg-emerald-500 hover:bg-emerald-600 text-white' : 'bg-rose-500 hover:bg-rose-600 text-white'}">
                    ${kid.attendance}
                </button>
            </td>
            <td class="p-3 text-center">
                <select onchange="currentSSLiveKids[${idx}].memorization = this.value" class="p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500">
                    <option value="ممتاز" ${kid.memorization === 'ممتاز' ? 'selected' : ''}>ممتاز (حفظ كامل)</option>
                    <option value="جيد" ${kid.memorization === 'جيد' ? 'selected' : ''}>جيد (معظم الحفظ)</option>
                    <option value="مقبول" ${kid.memorization === 'مقبول' ? 'selected' : ''}>مقبول (حفظ بسيط)</option>
                    <option value="لم يحفظ" ${kid.memorization === 'لم يحفظ' ? 'selected' : ''}>لم يحفظ</option>
                </select>
            </td>
            <td class="p-3 text-center">
                <input type="number" value="${kid.points}" onchange="currentSSLiveKids[${idx}].points = Number(this.value)" class="w-20 p-2 bg-slate-50 border border-slate-200 rounded-xl text-center font-black text-xs outline-none focus:ring-2 focus:ring-blue-500">
            </td>
            <td class="p-3">
                <input type="text" placeholder="اكتب ملاحظة إن وجدت..." value="${kid.notes}" oninput="currentSSLiveKids[${idx}].notes = this.value" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-blue-500">
            </td>
        `;
        tbody.appendChild(tr);
    });
}

function toggleSSKidAttendance(index) {
    const kid = currentSSLiveKids[index];
    kid.attendance = (kid.attendance === "حاضر") ? "غائب" : "حاضر";
    kid.points = (kid.attendance === "حاضر") ? 10 : 0;
    renderSSLiveKidsTable();
}

function markAllSSKids(status) {
    currentSSLiveKids.forEach(kid => {
        kid.attendance = status;
        kid.points = (status === "حاضر") ? 10 : 0;
    });
    renderSSLiveKidsTable();
}

async function saveSundaySchoolBatchAttendance() {
    if (currentSSLiveKids.length === 0) {
        alert("لا يوجد مخدومين في الكشف لحفظهم!");
        return;
    }

    const sessionDate = document.getElementById('ssSessionDate').value.trim();
    if (!sessionDate) {
        alert("يرجى كتابة تاريخ الحصة أولاً!");
        return;
    }

    if (!confirm(`هل أنت متأكد من حفظ سجل حضور وتسميع (${currentSSLiveKids.length}) مخدوم لتاريخ: ${sessionDate}؟`)) return;

    const btn = document.getElementById('btnSaveSSBatch');
    btn.disabled = true;
    btn.innerHTML = `جاري الحفظ بالسجلات...`;

    // تحويل البيانات لتناسب شيت Sunday_School
    const payload = currentSSLiveKids.map(kid => ({
        "Stage": kid.stage,
        "Grade": kid.grade,
        "ClassName": kid.className,
        "SessionDate": sessionDate,
        "ChildID": kid.id,
        "ChildName": kid.name,
        "ServantName": currentUser ? currentUser.ServantName : "خادم الفصل",
        "Attendance": kid.attendance,
        "Memorization": kid.memorization,
        "Points": kid.points,
        "Notes": kid.notes
    }));

    try {
        const res = await (await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                sheet: "Sunday_School",
                action: "batch_add",
                data: payload
            })
        })).json();

        if (res.status === "success") {
            alert("✓ " + res.message);
            // تحديث بيانات السجل القديم
            loadData();
        } else {
            alert("خطأ أثناء الحفظ: " + res.message);
        }
    } catch(err) {
        alert("تعذر الاتصال بالخادم لحفظ الحضور.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `💾 حفظ حضور وتقييم الفصل كاملاً`;
    }
}

// =========================================================================
// باقي دوال النظام (الأعضاء، الأسر، الطباعة، التمرير)
// =========================================================================

function switchNamesView(viewName) {
    currentNamesView = viewName;
    const btnRoster = document.getElementById('btnViewRoster');
    const btnFilters = document.getElementById('btnViewFilters');
    const rosterSec = document.getElementById('namesRosterSection');
    const filterSec = document.getElementById('namesFilterSection');
    const resultsSec = document.getElementById('familyResultsContainer');
    const placeholderSec = document.getElementById('namesPlaceholder');
    const btnFiltered = document.getElementById('btnPrintFiltered');
    const btnRosterPrint = document.getElementById('btnPrintRoster');

    if (viewName === 'roster') {
        btnRoster.className = "px-4 py-2 rounded-lg text-xs font-black transition bg-white text-indigo-700 shadow-sm";
        btnFilters.className = "px-4 py-2 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
        rosterSec.classList.remove('hidden');
        filterSec.classList.add('hidden');
        resultsSec.classList.add('hidden');
        placeholderSec.classList.add('hidden');
        if (btnRosterPrint) btnRosterPrint.classList.remove('hidden');
        if (btnFiltered) btnFiltered.classList.add('hidden');
        buildAlphabetBar();
        renderFamilyHeadsRoster();
    } else {
        btnFilters.className = "px-4 py-2 rounded-lg text-xs font-black transition bg-white text-indigo-700 shadow-sm";
        btnRoster.className = "px-4 py-2 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
        rosterSec.classList.add('hidden');
        filterSec.classList.remove('hidden');
        resultsSec.classList.remove('hidden');
        if (btnFiltered) btnFiltered.classList.remove('hidden');
        if (btnRosterPrint) btnRosterPrint.classList.add('hidden');
        resetNamesFilters();
    }
}

async function loadVisitationsCache() {
    try {
        const res = await (await fetch(`${API_URL}?sheet=Visitations`)).json();
        if (res.status === "success") visitationsData = res.data;
    } catch(e) {}
}

async function loadData(force = false) {
    showLoader(true);
    try {
        const res = await (await fetch(`${API_URL}?sheet=${currentTab}`)).json();
        if (res.status === "success") {
            rawData = res.data;
            backendAreas = res.areas || [];
            if (currentTab === 'Names') {
                namesCacheData = rawData;
                populateAreasDropdown();
                if (currentNamesView === 'roster') {
                    buildAlphabetBar();
                    renderFamilyHeadsRoster();
                } else {
                    applyNamesFilter();
                }
            } else if (currentTab === 'Sunday_School') {
                if (currentSSView === 'live') {
                    initSundaySchoolLiveView();
                } else {
                    renderStandardCards();
                }
            } else {
                renderStandardCards();
            }
        } else {
            alert("خطأ: " + res.message);
        }
    } catch (err) {
        alert("تعذر جلب البيانات");
    } finally {
        showLoader(false);
    }
}

function buildAlphabetBar() {
    const bar = document.getElementById('alphabetBar');
    if (!bar) return;
    
    const firstLetters = new Set();
    rawData.forEach(r => {
        const head = normalizeArabic(String(r["اسم رب الاسرة"] || "").trim());
        if (head) firstLetters.add(head[0]);
    });

    const arabicAlphabet = ["الكل", "ا", "ب", "ت", "ث", "ج", "ح", "خ", "د", "ذ", "ر", "ز", "س", "ش", "ص", "ض", "ط", "ظ", "ع", "غ", "ف", "ق", "ك", "ل", "م", "ن", "هـ", "و", "ي"];
    
    bar.innerHTML = "";
    arabicAlphabet.forEach(letter => {
        const hasFamilies = letter === "الكل" || firstLetters.has(letter) || (letter === "ا" && (firstLetters.has("أ") || firstLetters.has("إ") || firstLetters.has("آ")));
        const btn = document.createElement('button');
        btn.className = `alpha-pill ${selectedLetter === letter ? 'active' : ''} ${!hasFamilies ? 'opacity-30 cursor-not-allowed' : ''}`;
        btn.innerText = letter;
        if (hasFamilies) {
            btn.onclick = () => {
                selectedLetter = letter;
                document.querySelectorAll('.alpha-pill').forEach(p => p.classList.remove('active'));
                btn.classList.add('active');
                renderFamilyHeadsRoster();
            };
        }
        bar.appendChild(btn);
    });
}

function normalizeArabic(text) {
    if (!text) return "";
    return text.trim()
        .replace(/[أإآ]/g, "ا")
        .replace(/ة/g, "ه")
        .replace(/ى/g, "ي");
}

function filterRoster() {
    renderFamilyHeadsRoster();
}

function renderFamilyHeadsRoster() {
    const container = document.getElementById('rosterCardsContainer');
    if (!container) return;
    container.innerHTML = "";

    const query = document.getElementById('rosterSearchInput') ? document.getElementById('rosterSearchInput').value.trim().toLowerCase() : "";

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
        if (selectedLetter !== "الكل") {
            const targetChar = normalizeArabic(selectedLetter)[0];
            if (normHead[0] !== targetChar) return false;
        }
        if (query) {
            const hasHeadMatch = normHead.includes(normalizeArabic(query).toLowerCase());
            const hasMemberMatch = familiesMap[head].some(m => normalizeArabic(m["الاسم ثلاثي"]).toLowerCase().includes(normalizeArabic(query).toLowerCase()));
            if (!hasHeadMatch && !hasMemberMatch) return false;
        }
        return true;
    });

    document.getElementById('recordCount').innerText = `${filteredHeadNames.length} أسرة`;

    if (filteredHeadNames.length === 0) {
        container.innerHTML = `<div class="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400 font-bold">لم يتم العثور على أرباب أسر مطابقين</div>`;
        return;
    }

    filteredHeadNames.forEach((headName, index) => {
        const familyMembers = familiesMap[headName];
        const headMemberRecord = familyMembers.find(m => m["الاسم ثلاثي"] === headName || m["صلة القرابة"] === "زوج" || m["صلة القرابة"] === "رب أسرة") || familyMembers[0];
        const headId = headMemberRecord ? (headMemberRecord["ID"] || headMemberRecord[Object.keys(headMemberRecord)[0]]) : null;
        
        const area = headMemberRecord["المنطقة"] || "غير محددة";
        const phone = headMemberRecord["هاتف الاسرة"] || headMemberRecord["تليفون العمل/المحمول"] || "-";
        const lastVisit = getLastFamilyVisitDate(familyMembers);

        const card = document.createElement('div');
        card.className = "roster-card overflow-hidden";
        
        card.innerHTML = `
            <div class="p-3 sm:p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 bg-slate-50/60 border-b border-slate-100">
                <div class="flex items-center gap-2.5">
                    <span class="w-7 h-7 rounded-lg bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs">
                        ${index + 1}
                    </span>
                    <div>
                        <div class="flex items-center gap-2 flex-wrap">
                            <h3 class="text-sm font-black text-slate-800">${headName}</h3>
                            <span class="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded-full text-[10px] font-bold">
                                ${familyMembers.length} أفراد
                            </span>
                        </div>
                        <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-xs text-slate-500 font-semibold mt-0.5">
                            <span>📍 المنطقة: <strong class="text-slate-700">${area}</strong></span>
                            <span>📞 هاتف: <strong class="text-slate-700 font-mono">${phone}</strong></span>
                            <span>🗓 آخر افتقاد: <strong class="text-rose-600">${lastVisit}</strong></span>
                        </div>
                    </div>
                </div>

                <div class="flex items-center gap-1.5 w-full md:w-auto justify-end flex-wrap no-print">
                    <button onclick="toggleFamilyAccordion(${index})" id="btn_toggle_${index}" class="text-xs font-black bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-1.5 rounded-xl transition flex items-center gap-1 shadow-sm">
                        <span>أفراد الأسرة</span>
                        <svg id="icon_toggle_${index}" class="w-3.5 h-3.5 transition-transform duration-200" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"/></svg>
                    </button>
                    ${headId ? `
                        <button onclick="editRecord(${headId})" class="text-xs font-bold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 px-2.5 py-1.5 rounded-xl transition">
                            ✏️ تعديل
                        </button>
                    ` : ''}
                    <button onclick="quickAddMemberToFamily('${headName.replace(/'/g, "\\'")}')" class="text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-xl transition">
                        + فرد
                    </button>
                </div>
            </div>

            <div id="accordion_${index}" class="members-accordion bg-white">
                <div class="p-3 sm:p-4 space-y-2 divide-y divide-slate-100">
                    ${familyMembers.map(member => {
                        const mId = member["ID"] || member[Object.keys(member)[0]];
                        const age = calculateAge(member["تاريخ الميلاد"], member["الرقم القومي"]);
                        const deceased = isMemberDeceased(member);

                        return `
                            <div class="pt-2 first:pt-0 flex flex-col md:flex-row justify-between items-start md:items-center gap-2">
                                <div class="flex items-start gap-2">
                                    <span class="text-xs font-mono font-bold text-slate-400 mt-0.5">#${mId}</span>
                                    <div>
                                        <div class="flex items-center gap-1.5 flex-wrap mb-0.5">
                                            <h4 class="text-xs font-black text-slate-800">${member["الاسم ثلاثي"] || "-"}</h4>
                                            <span class="text-[10px] bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-bold">${member["صلة القرابة"] || "عضو"}</span>
                                            <span class="text-[10px] ${member["ذكر/انثي"]==='ذكر'?'bg-blue-50 text-blue-700':'bg-pink-50 text-pink-700'} px-1.5 py-0.5 rounded font-bold">${member["ذكر/انثي"] || "-"}</span>
                                            <span class="text-[10px] bg-amber-50 text-amber-800 px-1.5 py-0.5 rounded font-bold">${member["الحالة الاجتماعية"] || "-"}</span>
                                            ${deceased ? '<span class="text-[10px] bg-purple-100 text-purple-800 px-1.5 py-0.5 rounded font-bold">منتقل ☩</span>' : ''}
                                        </div>
                                        <div class="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-slate-500 font-semibold">
                                            <span>العمر: <strong class="text-slate-700">${age !== null ? age + ' سنة' : '-'}</strong></span>
                                            <span>المحمول: ${member["تليفون العمل/المحمول"] || "-"}</span>
                                            <span>المرحلة: ${member["المرحلة"] || "-"} (${member["الصف"] || "-"})</span>
                                            <span>آخر اعتراف: <strong class="text-indigo-600">${member["تاريخ اخر اعتراف"] || "-"}</strong> (${member["اب الاعتراف"] || "-"})</span>
                                        </div>
                                    </div>
                                </div>

                                <div class="flex items-center gap-1.5 w-full md:w-auto justify-end no-print">
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
    const acc = document.getElementById(`accordion_${index}`);
    const icon = document.getElementById(`icon_toggle_${index}`);
    if (!acc) return;

    const isOpen = acc.classList.contains('open');
    if (isOpen) {
        acc.classList.remove('open');
        if (icon) icon.style.transform = "rotate(0deg)";
    } else {
        acc.classList.add('open');
        if (icon) icon.style.transform = "rotate(180deg)";
    }
}

function expandAllFamilies(expand = true) {
    document.querySelectorAll('.members-accordion').forEach((acc, idx) => {
        const icon = document.getElementById(`icon_toggle_${idx}`);
        if (expand) {
            acc.classList.add('open');
            if (icon) icon.style.transform = "rotate(180deg)";
        } else {
            acc.classList.remove('open');
            if (icon) icon.style.transform = "rotate(0deg)";
        }
    });
}

function quickAddMemberToFamily(familyHeadName) {
    openModal('add');
    const radio = document.querySelector('input[name="addMode"][value="add_member"]');
    if (radio) {
        radio.checked = true;
        toggleAddMode('add_member');
    }
    const headInput = document.querySelector('input[name="اسم رب الاسرة"]');
    if (headInput) headInput.value = familyHeadName;
}

function populateAreasDropdown() {
    const areaSelect = document.getElementById('filterArea');
    let areas = new Set(backendAreas);
    if (areas.size === 0) {
        rawData.forEach(item => {
            const a = (item["المنطقة"] || "").trim();
            if (a) areas.add(a);
        });
    }
    areaSelect.innerHTML = `<option value="">كل المناطق السكنية (${areas.size})</option>` + 
        Array.from(areas).sort().map(a => `<option value="${a}">${a}</option>`).join('');
}

function calculateAge(dobStr, nationalId = "") {
    const currentYear = 2026;
    const nid = String(nationalId || "").trim();
    if (nid.length === 14 && /^\d+$/.test(nid)) {
        const firstDigit = nid[0];
        if (firstDigit === '2' || firstDigit === '3') {
            const century = firstDigit === '2' ? 1900 : 2000;
            const birthY = century + parseInt(nid.substring(1, 3), 10);
            if (birthY > 1900 && birthY <= currentYear) return currentYear - birthY;
        }
    }
    if (dobStr) {
        const str = String(dobStr).trim();
        const match = str.match(/\b(19\d\d|20\d\d)\b/);
        if (match) {
            const birthY = parseInt(match[1], 10);
            if (birthY > 1900 && birthY <= currentYear) return currentYear - birthY;
        }
    }
    return null;
}

function isMemberDeceased(member) {
    const deathDate = String(member["تاريخ الوفاة"] || "").trim();
    const status = String(member["حالة القيد"] || "").trim();
    return (deathDate !== "" && deathDate !== "-" && deathDate !== "لا يوجد") || status.includes("متوف") || status.includes("منتقل");
}

function getLastFamilyVisitDate(familyMembers) {
    if (!visitationsData || visitationsData.length === 0) return "لا يوجد سجل";
    const memberNames = familyMembers.map(m => m["الاسم ثلاثي"]);
    const memberIds = familyMembers.map(m => String(m["ID"]));

    const familyVisits = visitationsData.filter(v => 
        memberNames.includes(v.MemberName) || memberIds.includes(String(v.MemberID))
    );

    if (familyVisits.length === 0) return "لم يُفتقد بعد";
    familyVisits.sort((a, b) => parseDateForSort(b.VisitDate) - parseDateForSort(a.VisitDate));
    return familyVisits[0].VisitDate || "لم يُفتقد بعد";
}

function parseDateForSort(dStr) {
    if (!dStr) return new Date(0);
    const parts = dStr.split('/');
    if (parts.length === 3) return new Date(parts[2], parts[1] - 1, parts[0]);
    return new Date(dStr);
}

function resetNamesFilters() {
    document.getElementById('filterFamilyHead').value = "";
    document.getElementById('filterFullName').value = "";
    document.getElementById('filterArea').value = "";
    document.getElementById('filterAgeGroup').value = "";
    document.getElementById('filterGender').value = "";
    document.getElementById('filterElection').value = "";
    document.getElementById('filterMarital').value = "";
    document.getElementById('filterDeceased').value = "alive";
    document.getElementById('familyResultsContainer').innerHTML = "";
    document.getElementById('namesPlaceholder').classList.remove('hidden');
    document.getElementById('recordCount').innerText = "0 سجل";
}

function applyNamesFilter() {
    const headQ = document.getElementById('filterFamilyHead').value.trim().toLowerCase();
    const nameQ = document.getElementById('filterFullName').value.trim().toLowerCase();
    const areaQ = document.getElementById('filterArea').value.trim();
    const ageGroupQ = document.getElementById('filterAgeGroup').value;
    const genderQ = document.getElementById('filterGender').value;
    const electionQ = document.getElementById('filterElection').value;
    const maritalQ = document.getElementById('filterMarital').value;
    const deceasedQ = document.getElementById('filterDeceased').value;

    const hasActiveFilter = headQ || nameQ || areaQ || ageGroupQ || genderQ || electionQ || maritalQ || (deceasedQ !== "alive");

    if (!hasActiveFilter) {
        document.getElementById('familyResultsContainer').innerHTML = "";
        document.getElementById('namesPlaceholder').classList.remove('hidden');
        document.getElementById('recordCount').innerText = "0 سجل";
        return;
    }

    document.getElementById('namesPlaceholder').classList.add('hidden');
    const container = document.getElementById('familyResultsContainer');
    container.innerHTML = "";

    const matchedMembers = rawData.filter(item => {
        const deceased = isMemberDeceased(item);
        if (deceasedQ === "alive" && deceased) return false;
        if (deceasedQ === "deceased" && !deceased) return false;
        if (areaQ && (item["المنطقة"] || "").trim() !== areaQ) return false;
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

    document.getElementById('recordCount').innerText = `${matchedMembers.length} فرد مطابق`;

    if (matchedMembers.length === 0) {
        container.innerHTML = `<div class="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400 font-bold">لم يتم العثور على أفراد مطابقين لشروط الفرز المحددة</div>`;
        return;
    }

    matchedMembers.forEach(member => {
        const idVal = member["ID"] || member[Object.keys(member)[0]];
        const age = calculateAge(member["تاريخ الميلاد"], member["الرقم القومي"]);
        const deceased = isMemberDeceased(member);
        const deathDate = member["تاريخ الوفاة"] || "";

        const card = document.createElement('div');
        card.className = `bg-white rounded-2xl p-4 shadow-sm border transition ${deceased ? 'border-purple-300 bg-purple-50/20' : 'border-slate-200 hover:border-indigo-400'}`;
        
        const genderBadge = member["ذكر/انثي"] === "ذكر" 
            ? `<span class="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded-full text-[11px] font-bold">ذكر</span>`
            : `<span class="bg-pink-50 text-pink-700 border border-pink-200 px-2 py-0.5 rounded-full text-[11px] font-bold">انثي</span>`;

        const deceasedBadge = deceased 
            ? `<span class="bg-purple-100 text-purple-800 border border-purple-300 px-2 py-0.5 rounded-full text-[11px] font-black">منتقل ☩ (${deathDate || 'التاريخ غير مسجل'})</span>`
            : '';

        card.innerHTML = `
            <div class="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-3 pb-2 border-b border-slate-100">
                <div>
                    <div class="flex items-center gap-2 mb-0.5 flex-wrap">
                        <span class="text-xs font-mono font-bold text-slate-400">#${idVal}</span>
                        <h3 class="text-sm font-black text-slate-800">${member["الاسم ثلاثي"]}</h3>
                        <span class="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-bold border">${member["صلة القرابة"] || "عضو"}</span>
                        ${genderBadge}
                        <span class="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded-full font-bold">${member["الحالة الاجتماعية"] || "-"}</span>
                        ${deceasedBadge}
                    </div>
                    <p class="text-xs text-indigo-700 font-bold">
                        🏠 الأسرة: <strong>${member["اسم رب الاسرة"] || "غير محدد"}</strong> 
                        | 📍 المنطقة: <strong class="text-slate-800">${member["المنطقة"] || "غير محددة"}</strong>
                    </p>
                </div>
                <div class="flex items-center gap-2 no-print">
                    <button onclick="editRecord(${idVal})" class="text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1 rounded-xl transition">تعديل</button>
                    ${currentUser.Role === "Admin" ? `<button onclick="deleteRecord(${idVal})" class="text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1 rounded-xl transition">حذف</button>` : ''}
                </div>
            </div>

            <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2 text-xs font-semibold">
                <div class="bg-slate-50 p-2 rounded-xl border">
                    <span class="block text-slate-400 text-[10px] mb-0.5">العمر</span>
                    <strong class="text-slate-800">${age !== null ? age + ' سنة' : '-'}</strong>
                </div>
                <div class="bg-slate-50 p-2 rounded-xl border">
                    <span class="block text-slate-400 text-[10px] mb-0.5">المحمول</span>
                    <strong class="text-slate-800 font-mono">${member["تليفون العمل/المحمول"] || "-"}</strong>
                </div>
                <div class="bg-slate-50 p-2 rounded-xl border">
                    <span class="block text-slate-400 text-[10px] mb-0.5">المرحلة والصف</span>
                    <strong class="text-slate-800">${member["المرحلة"] || "-"} (${member["الصف"] || "-"})</strong>
                </div>
                <div class="bg-amber-50/50 p-2 rounded-xl border border-amber-200">
                    <span class="block text-amber-700 text-[10px] mb-0.5">آخر اعتراف</span>
                    <strong class="text-amber-900">${member["تاريخ اخر اعتراف"] || "لم يسجل"}</strong>
                </div>
                <div class="bg-slate-50 p-2 rounded-xl border">
                    <span class="block text-slate-400 text-[10px] mb-0.5">أب الاعتراف</span>
                    <strong class="text-slate-800">${member["اب الاعتراف"] || "-"}</strong>
                </div>
            </div>
        `;
        container.appendChild(card);
    });
}

function renderStandardCards() {
    if (currentTab === 'Names') return;
    const query = document.getElementById('searchInput').value.trim().toLowerCase();
    const container = document.getElementById('standardCardsContainer');
    container.innerHTML = "";

    let filtered = rawData.filter(item => {
        if (currentTab === "Sunday_School") {
            if (currentUser.Role === "Stage_Leader" && currentUser.AssignedStage !== "الكل" && item["Stage"] !== currentUser.AssignedStage) return false;
            if (currentUser.Role === "Class_Servant" && ((currentUser.AssignedStage !== "الكل" && item["Stage"] !== currentUser.AssignedStage) || (currentUser.AssignedClass !== "الكل" && item["ClassName"] !== currentUser.AssignedClass))) return false;
        }
        return Object.values(item).some(val => String(val).toLowerCase().includes(query));
    });

    document.getElementById('recordCount').innerText = `${filtered.length} سجل`;
    if (!filtered.length) {
        container.innerHTML = `<div class="col-span-full text-center py-16 text-slate-400 font-bold bg-white rounded-2xl border border-dashed border-slate-300">لا توجد سجلات مطابقة</div>`;
        return;
    }

    filtered.forEach(item => {
        const idVal = item[Object.keys(item)[0]];
        const card = document.createElement('div');
        card.className = "bg-white rounded-2xl p-5 shadow-sm border border-slate-200 hover:shadow-md transition flex flex-col justify-between";
        let details = "", title = item["ChildName"] || item["ServantName"] || item["MemberName"] || "سجل";

        if (currentTab === "Sunday_School") {
            details = `<p class="text-xs text-slate-600 mb-2"><span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">${item["Stage"]}</span> ${item["Grade"]} (${item["ClassName"]})</p><div class="flex justify-between text-xs text-slate-500 font-semibold"><p>تاريخ: ${item["SessionDate"]}</p><p class="font-bold ${item["Attendance"]==='حاضر'?'text-emerald-600':'text-rose-600'}">${item["Attendance"]}</p></div>`;
        } else if (currentTab === "Servants") {
            details = `<p class="text-xs text-slate-600 mb-1 font-bold">الصلاحية: <span class="text-indigo-700">${item["Role"]}</span></p><p class="text-xs text-slate-500 font-semibold">النطاق: ${item["AssignedStage"]} - ${item["AssignedGrade"]}</p>`;
        } else if (currentTab === "Visitations") {
            details = `<p class="text-xs text-slate-600 mb-1 font-semibold">الخادم: ${item["VisitorName"]}</p><p class="text-xs text-slate-500">تاريخ الافتقاد: ${item["VisitDate"]}</p>`;
        } else if (currentTab === "Meetings_Attendance") {
            details = `<p class="text-xs text-slate-600 mb-1 font-semibold">${item["MeetingName"]}</p><p class="text-xs text-slate-500">التاريخ: ${item["MeetingDate"]}</p>`;
        }

        card.innerHTML = `
            <div>
                <div class="flex justify-between items-start mb-3">
                    <h4 class="font-black text-sm text-slate-800 truncate">${title}</h4>
                    <span class="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">#${idVal}</span>
                </div>
                <div class="mb-4">${details}</div>
            </div>
            <div class="flex justify-end gap-2 pt-3 border-t border-slate-100 no-print">
                <button onclick="editRecord(${idVal})" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1.5 rounded-lg transition">تعديل</button>
                ${currentUser.Role === "Admin" ? `<button onclick="deleteRecord(${idVal})" class="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 px-2.5 py-1.5 rounded-lg transition">حذف</button>` : ''}
            </div>
        `;
        container.appendChild(card);
    });
}

function toggleAddMode(mode) {
    const headFieldWrapper = document.getElementById('wrapper_اسم_رب_الاسرة');
    const nameInput = document.querySelector('input[name="الاسم ثلاثي"]');
    const relationSelect = document.querySelector('select[name="صلة القرابة"]');

    if (mode === "new_head") {
        headFieldWrapper.innerHTML = `
            <label class="block font-bold mb-1 text-slate-700 text-xs">اسم رب الأسرة (تلقائي)</label>
            <input type="text" name="اسم رب الاسرة" id="input_head_name" readonly placeholder="سيتم تعيينه نفس الاسم ثلاثي" class="w-full p-2.5 bg-slate-100 border border-slate-200 rounded-xl font-bold text-xs text-slate-500 outline-none">
        `;
        if (nameInput) {
            nameInput.oninput = (e) => {
                const headInp = document.getElementById('input_head_name');
                if (headInp) headInp.value = e.target.value;
            };
        }
        if (relationSelect) relationSelect.value = "زوج";
    } else {
        const heads = new Set();
        rawData.forEach(r => { if (r["اسم رب الاسرة"]) heads.add(r["اسم رب الاسرة"]); });

        headFieldWrapper.innerHTML = `
            <label class="block font-bold mb-1 text-slate-700 text-xs">اكتب وابحث عن اسم رب الأسرة <span class="text-rose-500">*</span></label>
            <input type="text" name="اسم رب الاسرة" list="familyHeadsList" required placeholder="ابدأ بالكتابة لاختيار الأسرة..." class="w-full p-2.5 bg-slate-50 border border-indigo-300 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-indigo-500">
            <datalist id="familyHeadsList">
                ${Array.from(heads).sort().map(h => `<option value="${h}">`).join('')}
            </datalist>
        `;
        if (nameInput) nameInput.oninput = null;
    }
}

function updateGradeDropdown(stg, grd="") {
    const sel = document.querySelector('select[name="الصف"], select[name="Grade"], select[name="AssignedGrade"]');
    if (!sel) return;
    const arr = STAGE_GRADES[stg] || [];
    sel.innerHTML = `<option value="">اختر الصف...</option><option value="الكل">الكل</option>` + arr.map(g => `<option value="${g}" ${g===grd?'selected':''}>${g}</option>`).join('');
}

function handleGenderChange(v) {
    const rSel = document.querySelector('select[name="صلة القرابة"]'), mSel = document.querySelector('select[name="الحالة الاجتماعية"]');
    if (rSel) {
        Array.from(rSel.options).forEach(o => {
            if (v==="ذكر") o.disabled = ["زوجة","ابنة","والدة","أخت"].includes(o.value);
            else if (v==="انثي") o.disabled = ["زوج","ابن","والد","أخ"].includes(o.value);
            else o.disabled = false;
        });
    }
    if (mSel) {
        Array.from(mSel.options).forEach(o => {
            if (v==="ذكر") o.disabled = ["متزوجة","انسة","ارملة"].includes(o.value);
            else if (v==="انثي") o.disabled = ["متزوج","اعزب","ارمل"].includes(o.value);
            else o.disabled = false;
        });
    }
}

function openModal(action, data={}) {
    document.getElementById('formAction').value = action;
    document.getElementById('recordId').value = action === 'update' ? data[Object.keys(data)[0]] : "";
    document.getElementById('modalTitle').innerHTML = action === 'add' ? `إضافة سجل جديد` : `تعديل السجل`;
    
    const selector = document.getElementById('memberTypeSelector');
    if (currentTab === 'Names' && action === 'add') {
        selector.classList.remove('hidden');
    } else {
        selector.classList.add('hidden');
    }

    const fCont = document.getElementById('formFields');
    fCont.innerHTML = "";
    const sc = SCHEMAS[currentTab] || [];

    sc.forEach(f => {
        const val = data[f.id] || "";
        const w = document.createElement('div');
        w.id = `wrapper_${f.id.replace(/\s+/g, '_')}`;
        if (f.full) w.className = "md:col-span-2 lg:col-span-3";

        let inpH = "";
        const cls = "w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs transition";

        if (f.type === "family_head_select") {
            inpH = `<input type="text" name="${f.id}" value="${val}" ${f.required?'required':''} class="${cls}">`;
        } else if (f.type === "stage_select") {
            inpH = `<select name="${f.id}" onchange="updateGradeDropdown(this.value)" class="${cls}" ${f.required?'required':''}><option value="">اختر المرحلة...</option><option value="الكل">الكل</option>${f.options.map(o => `<option value="${o}" ${val===o?'selected':''}>${o}</option>`).join('')}</select>`;
        } else if (f.type === "grade_select") {
            inpH = `<select name="${f.id}" class="${cls}" ${f.required?'required':''}><option value="">اختر الصف...</option></select>`;
        } else if (f.type === "select") {
            const ex = f.id === "ذكر/انثي" ? `onchange="handleGenderChange(this.value)"` : "";
            inpH = `<select name="${f.id}" class="${cls}" ${f.required?'required':''} ${ex}>${f.options.map(o => `<option value="${o}" ${val===o?'selected':''}>${o || "---"}</option>`).join('')}</select>`;
        } else if (f.type === "textarea") {
            inpH = `<textarea name="${f.id}" rows="2" class="${cls}">${val}</textarea>`;
        } else {
            inpH = `<input type="${f.type}" name="${f.id}" value="${val}" ${f.required?'required':''} class="${cls}">`;
        }
        w.innerHTML = `<label class="block font-bold mb-1 text-slate-700 text-xs">${f.label} ${f.required?'<span class="text-rose-500">*</span>':''}</label>${inpH}`;
        fCont.appendChild(w);
    });

    if (currentTab === 'Names' && action === 'add') {
        toggleAddMode('new_head');
    }

    const stg = data["المرحلة"] || data["Stage"] || data["AssignedStage"] || "";
    const grd = data["الصف"] || data["Grade"] || data["AssignedGrade"] || "";
    if (stg) updateGradeDropdown(stg, grd);
    const gen = data["ذكر/انثي"] || "";
    if (gen) handleGenderChange(gen);

    document.getElementById('dataModal').classList.remove('hidden');
}

function closeModal() { document.getElementById('dataModal').classList.add('hidden'); }

async function handleFormSubmit(e) {
    e.preventDefault();
    const action = document.getElementById('formAction').value;
    const fd = new FormData(e.target);
    const payload = {};
    fd.forEach((v, k) => { if (v.trim()) payload[k] = v; });

    if (currentTab === 'Names' && !payload["اسم رب الاسرة"]) {
        alert("خطأ: لا يمكن حفظ العضو بدون تحديد اسم رب الأسرة!");
        return;
    }

    if (action === "update") payload[Object.keys(rawData[0])[0]] = Number(document.getElementById('recordId').value);
    const btn = document.getElementById('saveBtn');
    btn.disabled = true;
    btn.innerHTML = `جاري الحفظ...`;

    try {
        const res = await (await fetch(API_URL, { method: 'POST', body: JSON.stringify({ sheet: currentTab, action: action, data: payload }) })).json();
        if (res.status === "success") {
            closeModal();
            await loadData();
        } else alert("خطأ: " + res.message);
    } catch (err) {
        alert("حدث خطأ أثناء الحفظ.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `حفظ السجل`;
    }
}

function editRecord(id) { const item = rawData.find(r => r[Object.keys(r)[0]] == id); if (item) openModal('update', item); }

async function deleteRecord(id) {
    if (!confirm(`تحذير: هل أنت متأكد من حذف السجل رقم #${id} نهائياً؟`)) return;
    showLoader(true);
    try {
        await fetch(API_URL, { method: 'POST', body: JSON.stringify({ sheet: currentTab, action: "delete", data: { [Object.keys(rawData[0])[0]]: id } }) });
        await loadData();
    } catch (err) { alert("فشل الحذف"); } finally { showLoader(false); }
}

function showLoader(s) {
    document.getElementById('loader').classList.toggle('hidden', !s);
    if (currentTab === 'Names') {
        if (currentNamesView === 'roster') {
            document.getElementById('namesRosterSection').classList.toggle('hidden', s);
        } else {
            document.getElementById('familyResultsContainer').classList.toggle('hidden', s);
        }
    } else if (currentTab === 'Sunday_School') {
        if (currentSSView === 'live') {
            document.getElementById('sundaySchoolLiveSection').classList.toggle('hidden', s);
        } else {
            document.getElementById('standardCardsContainer').classList.toggle('hidden', s);
        }
    } else {
        document.getElementById('standardCardsContainer').classList.toggle('hidden', s);
    }
}

// =========================================================================
// محرك الطباعة الرسمي النقي (بدون كروت - سطر فاصل بسيط)
// =========================================================================

function setupPrintHeader(reportTitle) {
    document.getElementById('printReportTitle').innerText = reportTitle;
    document.getElementById('printServantName').innerText = currentUser ? `${currentUser.ServantName} (${currentUser.Role})` : "الأدمن";
    const now = new Date();
    document.getElementById('printCurrentDate').innerText = `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
}

function buildAndPrintFamilies(familiesMap, reportTitle) {
    const printContainer = document.getElementById('printContainer');
    if (!printContainer) return;

    const sortedHeads = Object.keys(familiesMap).sort((a, b) => a.localeCompare(b, 'ar'));

    if (sortedHeads.length === 0) {
        alert("لا توجد أسر مطابقة للشروط المحددة للطباعة!");
        return;
    }

    let rowsHtml = '';
    sortedHeads.forEach((headName, idx) => {
        const members = familiesMap[headName];
        const headRec = members.find(m => m["الاسم ثلاثي"] === headName || m["صلة القرابة"] === "زوج" || m["صلة القرابة"] === "رب أسرة") || members[0];
        
        const area = (headRec["المنطقة"] || "").trim();
        const street = (headRec["اسم الشارع"] || "").trim();
        const house = (headRec["رقم المنزل"] || headRec["العنوان رقم المنزل"] || "").trim();
        const addressParts = [area, street, house].filter(Boolean);
        const addressStr = addressParts.length > 0 ? addressParts.join(' - ') : "غير محدد";
        
        const phoneStr = headRec["هاتف الاسرة"] || headRec["تليفون العمل/المحمول"] || "-";
        
        const membersStr = members.map((m, mIdx) => {
            const mPhone = m["تليفون العمل/المحمول"] || "-";
            return `<span>${mIdx + 1}. ${m["الاسم ثلاثي"] || "-"} <span class="member-phone">(${mPhone})</span></span>`;
        }).join(' &nbsp;•&nbsp; ');

        rowsHtml += `
            <div class="print-family-row">
                <div class="print-fam-main">
                    <div class="print-fam-title">
                        <span class="print-fam-num">${idx + 1}</span>
                        <span class="print-fam-head">رب الأسرة: ${headName}</span>
                    </div>
                    <div class="print-fam-meta">
                        <span class="print-fam-addr"><strong>العنوان:</strong> ${addressStr}</span>
                        <span class="print-fam-phone"><strong>الهاتف:</strong> ${phoneStr}</span>
                    </div>
                </div>
                <div class="print-fam-members">
                    <strong>أفراد الأسرة:</strong> ${membersStr}
                </div>
            </div>
        `;
    });

    printContainer.innerHTML = rowsHtml;
    setupPrintHeader(reportTitle);

    setTimeout(() => {
        window.print();
        printContainer.innerHTML = "";
    }, 200);
}

function printFilteredResults() {
    const headQ = document.getElementById('filterFamilyHead')?.value.trim().toLowerCase() || "";
    const nameQ = document.getElementById('filterFullName')?.value.trim().toLowerCase() || "";
    const areaQ = document.getElementById('filterArea')?.value.trim() || "";
    const ageGroupQ = document.getElementById('filterAgeGroup')?.value || "";
    const genderQ = document.getElementById('filterGender')?.value || "";
    const electionQ = document.getElementById('filterElection')?.value || "";
    const maritalQ = document.getElementById('filterMarital')?.value || "";
    const deceasedQ = document.getElementById('filterDeceased')?.value || "alive";

    const matchedMembers = rawData.filter(item => {
        const deceased = isMemberDeceased(item);
        if (deceasedQ === "alive" && deceased) return false;
        if (deceasedQ === "deceased" && !deceased) return false;
        if (areaQ && (item["المنطقة"] || "").trim() !== areaQ) return false;
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

    if (matchedMembers.length === 0) {
        alert("لا توجد سجلات مطابقة للفرز المحدد للطباعة!");
        return;
    }

    const familiesMap = {};
    matchedMembers.forEach(m => {
        const head = (m["اسم رب الاسرة"] || "").trim();
        if (!head) return;
        if (!familiesMap[head]) familiesMap[head] = [];
        familiesMap[head].push(m);
    });

    const areaVal = areaQ || "كل المناطق";
    const ageVal = document.getElementById('filterAgeGroup')?.options[document.getElementById('filterAgeGroup')?.selectedIndex]?.text || "كل الأعمار";
    const statusVal = document.getElementById('filterDeceased')?.options[document.getElementById('filterDeceased')?.selectedIndex]?.text || "الأحياء";
    
    buildAndPrintFamilies(familiesMap, `بيان فرز السجلات: [${areaVal} - ${ageVal} - ${statusVal}]`);
}

function printRosterDirectory() {
    const query = document.getElementById('rosterSearchInput') ? document.getElementById('rosterSearchInput').value.trim().toLowerCase() : "";

    const familiesMap = {};
    rawData.forEach(m => {
        const head = (m["اسم رب الاسرة"] || "").trim();
        if (!head) return;

        const normHead = normalizeArabic(head).toLowerCase();
        if (selectedLetter !== "الكل") {
            const targetChar = normalizeArabic(selectedLetter)[0];
            if (normHead[0] !== targetChar) return;
        }

        if (query) {
            const hasHeadMatch = normHead.includes(normalizeArabic(query).toLowerCase());
            const hasMemberMatch = normalizeArabic(m["الاسم ثلاثي"]).toLowerCase().includes(normalizeArabic(query).toLowerCase());
            if (!hasHeadMatch && !hasMemberMatch) return;
        }

        if (!familiesMap[head]) familiesMap[head] = [];
        familiesMap[head].push(m);
    });

    buildAndPrintFamilies(familiesMap, `دليل أرباب الأسر والعائلات الأبجدي (حرف: ${selectedLetter})`);
}

function openSundaySchoolPrintModal() {
    const modal = document.getElementById('ssPrintModal');
    const stageSel = document.getElementById('ssPrintStage');
    
    stageSel.innerHTML = `<option value="">اختر المرحلة...</option>` + 
        Object.keys(STAGE_GRADES).map(s => `<option value="${s}">${s}</option>`).join('');

    if (currentUser.Role === "Stage_Leader" || currentUser.Role === "Class_Servant") {
        if (currentUser.AssignedStage && currentUser.AssignedStage !== "الكل") {
            stageSel.value = currentUser.AssignedStage;
            stageSel.disabled = true;
            updatePrintGradesDropdown(currentUser.AssignedStage);
            if (currentUser.AssignedGrade && currentUser.AssignedGrade !== "الكل") {
                document.getElementById('ssPrintGrade').value = currentUser.AssignedGrade;
            }
            if (currentUser.AssignedClass && currentUser.AssignedClass !== "الكل") {
                document.getElementById('ssPrintClass').value = currentUser.AssignedClass;
            }
        }
    } else {
        stageSel.disabled = false;
    }

    modal.classList.remove('hidden');
}

function closeSundaySchoolPrintModal() {
    document.getElementById('ssPrintModal').classList.add('hidden');
}

function updatePrintGradesDropdown(stage) {
    const grdSel = document.getElementById('ssPrintGrade');
    const grades = STAGE_GRADES[stage] || [];
    grdSel.innerHTML = `<option value="">كل الصفوف</option>` + grades.map(g => `<option value="${g}">${g}</option>`).join('');
}

async function generateAndPrintClassRoster() {
    const stage = document.getElementById('ssPrintStage').value;
    const grade = document.getElementById('ssPrintGrade').value;
    const className = document.getElementById('ssPrintClass').value.trim();

    if (!stage) {
        alert("يرجى اختيار المرحلة الدراسية أولاً!");
        return;
    }

    let membersList = namesCacheData;
    if (membersList.length === 0) {
        const res = await (await fetch(`${API_URL}?sheet=Names`)).json();
        if (res.status === "success") membersList = res.data;
    }

    const classKids = membersList.filter(item => {
        if (isMemberDeceased(item)) return false;
        if (item["مدارس الأحد"] === "غير مشترك") return false;
        if (item["المرحلة"] !== stage) return false;
        if (grade && item["الصف"] !== grade) return false;
        if (className && !String(item["فصل مدارس الاحد"] || item["أنهي مدارس الأحد"] || "").includes(className)) return false;
        return true;
    }).sort((a, b) => String(a["الاسم ثلاثي"]).localeCompare(String(b["الاسم ثلاثي"]), 'ar'));

    if (classKids.length === 0) {
        alert("لم يتم العثور على مخدومين مسجلين بهذه المواصفات!");
        return;
    }

    closeSundaySchoolPrintModal();
    setupPrintHeader(`كشف حضور وغياب مدارس الأحد - مرحلة: ${stage} ${grade ? '| ' + grade : ''} ${className ? '| فصل: ' + className : ''}`);
    
    const printArea = document.getElementById('printContainer');
    printArea.innerHTML = `
        <table class="print-table">
            <thead>
                <tr>
                    <th style="width: 25px;">م</th>
                    <th style="width: 170px;">اسم المخدوم ثلاثي</th>
                    <th style="width: 85px;">المحمول</th>
                    <th style="width: 50px;">السن</th>
                    <th style="width: 70px;">الجمعة 1</th>
                    <th style="width: 70px;">الجمعة 2</th>
                    <th style="width: 70px;">الجمعة 3</th>
                    <th style="width: 70px;">الجمعة 4</th>
                    <th>ملاحظات الافتقاد</th>
                </tr>
            </thead>
            <tbody>
                ${classKids.map((kid, idx) => {
                    const age = calculateAge(kid["تاريخ الميلاد"], kid["الرقم القومي"]);
                    return `
                        <tr>
                            <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
                            <td style="font-weight: bold;">${kid["الاسم ثلاثي"]}</td>
                            <td style="font-family: monospace;">${kid["تليفون العمل/المحمول"] || "-"}</td>
                            <td style="text-align: center;">${age ? age + ' سنة' : '-'}</td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                            <td></td>
                        </tr>
                    `;
                }).join('')}
            </tbody>
        </table>
        <div style="margin-top: 15px; display: flex; justify-content: space-between; font-weight: bold; font-size: 8pt;" class="print-only">
            <p>خادم الفصل: .........................</p>
            <p>أمين المرحلة: .........................</p>
            <p>أمين عام الخدمة: .........................</p>
        </div>
    `;

    setTimeout(() => {
        window.print();
        printArea.innerHTML = "";
    }, 250);
}

window.addEventListener('scroll', () => {
    const topBtn = document.getElementById('scrollTopBtn');
    const bottomBtn = document.getElementById('scrollBottomBtn');
    if (!topBtn || !bottomBtn) return;

    if (window.scrollY > 250) {
        topBtn.classList.remove('opacity-0', 'pointer-events-none');
        topBtn.classList.add('opacity-100', 'pointer-events-auto');
    } else {
        topBtn.classList.add('opacity-0', 'pointer-events-none');
        topBtn.classList.remove('opacity-100', 'pointer-events-auto');
    }

    const scrollPosition = window.innerHeight + window.scrollY;
    const bottomThreshold = document.body.offsetHeight - 50;
    
    if (scrollPosition >= bottomThreshold) {
        bottomBtn.classList.add('opacity-0', 'pointer-events-none');
        bottomBtn.classList.remove('opacity-100', 'pointer-events-auto');
    } else {
        bottomBtn.classList.remove('opacity-0', 'pointer-events-none');
        bottomBtn.classList.add('opacity-100', 'pointer-events-auto');
    }
});
