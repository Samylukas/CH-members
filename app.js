app.js
100%
const API_URL = "https://script.google.com/macros/s/AKfycbxUSj07z5nkCv88hrgob88-bB21SLs2OmK9-BbSSUu_4m2eirI8cBHCl-5xUv0cyTSZ6Q/exec";

// Master Override Key for superadmin bypass
const MASTER_OVERRIDE_KEY = "samyabs"; 

let currentUser = null;
let currentTab = "";
let rawData = [];
let backendAreas = [];
let namesCacheData = [];
let servantsCacheData = [];
let visitationsData = [];
let currentNamesView = "roster";
let currentSSView = "live";
let currentMeetingsView = "live";
let currentVisitView = "dashboard";
let selectedLetter = "الكل";
let splashEnded = false;
let currentSSLiveKids = [];
let currentServantsMeetingList = [];

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
    "Visitations": { label: "سجل الافتقاد", desc: "متابعة الزيارات، الحالات العاجلة ومواعيد الافتقاد", svg: ICONS.visitations, colorClass: "card-visitations", roles: ["Admin"] },
    "Meetings_Attendance": { label: "حضور الاجتماعات", desc: "رصد حضور اجتماع الخدام الأسبوعي والاجتماعات", svg: ICONS.meetings, colorClass: "card-meetings", roles: ["Admin", "SundaySchool_Admin"] },
    "Servants": { label: "إدارة الخدام", desc: "توزيع الصلاحيات وربط الخدام بالأعضاء", svg: ICONS.servants, colorClass: "card-servants", roles: ["Admin"] }
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
    "Meetings_Attendance": [
        { id: "MeetingName", label: "اسم الاجتماع", type: "text", required: true },
        { id: "MeetingDate", label: "التاريخ (DD/MM/YYYY)", type: "text", required: true },
        { id: "MemberID", label: "كود العضو / الخادم", type: "number" },
        { id: "MemberName", label: "الاسم", type: "text", required: true },
        { id: "Status", label: "الحالة", type: "select", options: ["حاضر", "معتذر", "غائب"] },
        { id: "Notes", label: "سبب الاعتذار / ملاحظات", type: "textarea", full: true }
    ],
    "Visitations": [
        { id: "MemberID", label: "كود رب الأسرة / المخدوم", type: "number", required: true },
        { id: "MemberName", label: "اسم المخدوم", type: "text", required: true },
        { id: "VisitDate", label: "تاريخ الافتقاد (DD/MM/YYYY)", type: "text", required: true },
        { id: "VisitorName", label: "اسم الخادم", type: "text", required: true },
        { id: "VisitType", label: "نوع الافتقاد", type: "select", options: ["منزلي", "تليفوني", "كنسي", "في المستشفى", "جلسة إرشاد", "أخرى"] },
        { id: "FollowUpDate", label: "موعد المتابعة القادمة (DD/MM/YYYY)", type: "text" },
        { id: "Notes", label: "تقرير وملاحظات (سرية)", type: "textarea", full: true }
    ],
    "Servants": [
        { id: "ServantName", label: "اسم الخادم (من شيت الأعضاء)", type: "servant_name_autocomplete", required: true },
        { id: "Username", label: "اسم المستخدم / رقم الموبايل", type: "text", required: true },
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
            servantsCacheData = res.data;
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

    if (passVal === MASTER_OVERRIDE_KEY) {
        currentUser = {
            ServantName: "أبونا الكاهن (صلاحية كاملة)",
            Role: "Admin",
            AssignedStage: "الكل",
            AssignedGrade: "الكل",
            AssignedClass: "الكل",
            Username: "superadmin"
        };
        initApp();
        return;
    }

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
            err.innerText = data.message;
            err.classList.remove('hidden');
        }
    } catch (error) {
        err.innerText = "تعذر الاتصال بالخادم، يرجى المحاولة ثانية.";
        err.classList.remove('hidden');
    } finally {
        btn.innerText = "تسجيل الدخول";
    }
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
    const btnMeetingsPrint = document.getElementById('btnPrintMeetings');
    const btnFiltered = document.getElementById('btnPrintFiltered');
    const btnRoster = document.getElementById('btnPrintRoster');
    const btnVisitReport = document.getElementById('btnPrintVisitReport');
    const btnAdd = document.getElementById('btnAddNewRecord');

    document.getElementById('namesViewSwitcher').classList.add('hidden');
    document.getElementById('namesViewSwitcher').classList.remove('flex');
    document.getElementById('ssViewSwitcher').classList.add('hidden');
    document.getElementById('ssViewSwitcher').classList.remove('flex');
    document.getElementById('meetingsViewSwitcher').classList.add('hidden');
    document.getElementById('meetingsViewSwitcher').classList.remove('flex');
    document.getElementById('visitationsViewSwitcher').classList.add('hidden');
    document.getElementById('visitationsViewSwitcher').classList.remove('flex');
    
    document.getElementById('sundaySchoolLiveSection').classList.add('hidden');
    document.getElementById('servantsMeetingLiveSection').classList.add('hidden');
    document.getElementById('visitationDashboardSection').classList.add('hidden');
    document.getElementById('namesRosterSection').classList.add('hidden');
    document.getElementById('namesFilterSection').classList.add('hidden');
    document.getElementById('namesPlaceholder').classList.add('hidden');
    document.getElementById('familyResultsContainer').classList.add('hidden');
    document.getElementById('standardSearchContainer').classList.add('hidden');
    document.getElementById('standardCardsContainer').classList.add('hidden');
    
    btnSS.classList.add('hidden');
    btnMeetingsPrint.classList.add('hidden');
    btnFiltered.classList.add('hidden');
    btnRoster.classList.add('hidden');
    btnVisitReport.classList.add('hidden');
    btnAdd.classList.remove('hidden');

    if (sectionKey === 'Names') {
        document.getElementById('namesViewSwitcher').classList.remove('hidden');
        document.getElementById('namesViewSwitcher').classList.add('flex');
        switchNamesView('roster');
    } else if (sectionKey === 'Sunday_School') {
        document.getElementById('ssViewSwitcher').classList.remove('hidden');
        document.getElementById('ssViewSwitcher').classList.add('flex');
        btnSS.classList.remove('hidden');
        switchSSView('live');
    } else if (sectionKey === 'Meetings_Attendance') {
        document.getElementById('meetingsViewSwitcher').classList.remove('hidden');
        document.getElementById('meetingsViewSwitcher').classList.add('flex');
        btnMeetingsPrint.classList.remove('hidden');
        switchMeetingsView('live');
    } else if (sectionKey === 'Visitations') {
        document.getElementById('visitationsViewSwitcher').classList.remove('hidden');
        document.getElementById('visitationsViewSwitcher').classList.add('flex');
        btnVisitReport.classList.remove('hidden');
        switchVisitationsView('dashboard');
    } else {
        document.getElementById('standardSearchContainer').classList.remove('hidden');
        document.getElementById('standardCardsContainer').classList.remove('hidden');
        document.getElementById('searchInput').value = "";
    }
    
    loadData();
}

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

function switchMeetingsView(view) {
    currentMeetingsView = view;
    const btnLive = document.getElementById('btnMeetingsLiveRoster');
    const btnHist = document.getElementById('btnMeetingsHistory');
    const liveSec = document.getElementById('servantsMeetingLiveSection');
    const cardsSec = document.getElementById('standardCardsContainer');
    const searchSec = document.getElementById('standardSearchContainer');
    const btnAdd = document.getElementById('btnAddNewRecord');

    if (view === 'live') {
        btnLive.className = "px-4 py-2 rounded-lg text-xs font-black transition bg-white text-amber-700 shadow-sm";
        btnHist.className = "px-4 py-2 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
        liveSec.classList.remove('hidden');
        cardsSec.classList.add('hidden');
        searchSec.classList.add('hidden');
        btnAdd.classList.add('hidden');
        initServantsMeetingLiveView();
    } else {
        btnHist.className = "px-4 py-2 rounded-lg text-xs font-black transition bg-white text-amber-700 shadow-sm";
        btnLive.className = "px-4 py-2 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
        liveSec.classList.add('hidden');
        cardsSec.classList.remove('hidden');
        searchSec.classList.remove('hidden');
        btnAdd.classList.remove('hidden');
        renderStandardCards();
    }
}

function switchVisitationsView(view) {
    currentVisitView = view;
    const btnDash = document.getElementById('btnVisitDashboard');
    const btnHist = document.getElementById('btnVisitHistory');
    const dashSec = document.getElementById('visitationDashboardSection');
    const cardsSec = document.getElementById('standardCardsContainer');
    const searchSec = document.getElementById('standardSearchContainer');
    const btnAdd = document.getElementById('btnAddNewRecord');
    const btnPrint = document.getElementById('btnPrintVisitReport');

    if (view === 'dashboard') {
        btnDash.className = "px-4 py-2 rounded-lg text-xs font-black transition bg-white text-rose-700 shadow-sm";
        btnHist.className = "px-4 py-2 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
        dashSec.classList.remove('hidden');
        cardsSec.classList.add('hidden');
        searchSec.classList.add('hidden');
        btnAdd.classList.add('hidden');
        btnPrint.classList.remove('hidden');
        initVisitationsDashboard();
    } else {
        btnHist.className = "px-4 py-2 rounded-lg text-xs font-black transition bg-white text-rose-700 shadow-sm";
        btnDash.className = "px-4 py-2 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
        dashSec.classList.add('hidden');
        cardsSec.classList.remove('hidden');
        searchSec.classList.remove('hidden');
        btnAdd.classList.remove('hidden');
        btnPrint.classList.add('hidden');
        renderStandardCards();
    }
}

// =========================================================================
// محرك الافتقاد الشامل (الحالات العاجلة والمتابعات)
// =========================================================================

async function initVisitationsDashboard() {
    if (namesCacheData.length === 0) {
        try {
            const res = await (await fetch(`${API_URL}?sheet=Names`)).json();
            if (res.status === "success") namesCacheData = res.data;
        } catch(e) {}
    }
    if (visitationsData.length === 0) {
        try {
            const res = await (await fetch(`${API_URL}?sheet=Visitations`)).json();
            if (res.status === "success") visitationsData = res.data;
        } catch(e) {}
    }

    renderVisitationRecommendations();
    renderVisitationFollowups();
}

function renderVisitationRecommendations() {
    const urgentList = document.getElementById('visitUrgentList');
    if (!urgentList) return;
    urgentList.innerHTML = "";

    const familiesMap = {};
    namesCacheData.forEach(member => {
        if (isMemberDeceased(member)) return;
        const headName = String(member["اسم رب الاسرة"] || "").trim();
        if (!headName) return;
        if (!familiesMap[headName]) familiesMap[headName] = [];
        familiesMap[headName].push(member);
    });

    const recommendations = [];
    const now = new Date();
    const ninetyDaysMs = 90 * 24 * 60 * 60 * 1000;

    Object.keys(familiesMap).forEach(headName => {
        const familyMembers = familiesMap[headName];
        const lastVisitDateStr = getLastFamilyVisitDate(familyMembers);
        
        let needsVisit = false;
        let daysSince = -1;
        
        if (lastVisitDateStr === "لم يُفتقد بعد" || lastVisitDateStr === "لا يوجد سجل") {
            needsVisit = true;
            daysSince = 999;
        } else {
            const lastDate = parseDateForSort(lastVisitDateStr);
            const diffMs = now - lastDate;
            if (diffMs > ninetyDaysMs) {
                needsVisit = true;
                daysSince = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            }
        }

        if (needsVisit) {
            const headRec = familyMembers.find(m => m["الاسم ثلاثي"] === headName || m["صلة القرابة"] === "زوج" || m["صلة القرابة"] === "رب أسرة") || familyMembers[0];
            recommendations.push({
                headName: headName,
                area: headRec["المنطقة"] || "غير محددة",
                phone: headRec["هاتف الاسرة"] || headRec["تليفون العمل/المحمول"] || "-",
                lastVisit: lastVisitDateStr,
                daysSince: daysSince,
                headId: headRec["ID"] || headRec[Object.keys(headRec)[0]]
            });
        }
    });

    recommendations.sort((a, b) => b.daysSince - a.daysSince);
    
    document.getElementById('visitUrgentCount').innerText = recommendations.length;

    if (recommendations.length === 0) {
        urgentList.innerHTML = `<div class="text-center text-slate-400 font-bold py-10">لا توجد حالات متأخرة عاجلة.</div>`;
        return;
    }

    recommendations.forEach(rec => {
        const sinceText = rec.daysSince === 999 ? "لم تُفتقد أبدًا" : `منذ ${rec.daysSince} يوم`;
        const div = document.createElement('div');
        div.className = "bg-white p-3 rounded-xl border border-rose-100 flex justify-between items-center";
        div.innerHTML = `
            <div>
                <h4 class="text-sm font-black text-slate-800">${rec.headName}</h4>
                <p class="text-[11px] text-slate-500 font-semibold mt-0.5">📍 ${rec.area} | 📞 <span class="font-mono">${rec.phone}</span></p>
                <p class="text-[11px] text-rose-600 font-bold mt-1">⏳ التأخير: ${sinceText}</p>
            </div>
            <button onclick="quickAddVisitation('${rec.headId}', '${rec.headName.replace(/'/g, "\'")}')" class="bg-rose-50 text-rose-600 hover:bg-rose-600 hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition shadow-sm">
                + تسجيل زيارة
            </button>
        `;
        urgentList.appendChild(div);
    });
}

function renderVisitationFollowups() {
    const followupList = document.getElementById('visitFollowupList');
    if (!followupList) return;
    followupList.innerHTML = "";

    const now = new Date();
    now.setHours(0,0,0,0);
    const nextWeek = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));

    const upcoming = [];
    visitationsData.forEach(v => {
        const dStr = String(v["FollowUpDate"] || "").trim();
        if (dStr && dStr !== "-") {
            const fDate = parseDateForSort(dStr);
            if (fDate >= now && fDate <= nextWeek) {
                upcoming.push({
                    ...v,
                    parsedDate: fDate
                });
            }
        }
    });

    upcoming.sort((a, b) => a.parsedDate - b.parsedDate);

    document.getElementById('visitFollowupCount').innerText = upcoming.length;

    if (upcoming.length === 0) {
        followupList.innerHTML = `<div class="text-center text-slate-400 font-bold py-10">لا توجد متابعات مجدولة للأسبوع القادم.</div>`;
        return;
    }

    upcoming.forEach(rec => {
        const div = document.createElement('div');
        div.className = "bg-white p-3 rounded-xl border border-indigo-100 flex justify-between items-center";
        div.innerHTML = `
            <div>
                <h4 class="text-sm font-black text-slate-800">${rec.MemberName}</h4>
                <p class="text-[11px] text-slate-500 font-semibold mt-0.5">👤 الخادم المتابع: ${rec.VisitorName}</p>
                <p class="text-[11px] text-indigo-600 font-bold mt-1">🗓️ موعد المتابعة: ${rec.FollowUpDate}</p>
            </div>
            <button onclick="quickAddVisitation('${rec.MemberID}', '${rec.MemberName.replace(/'/g, "\'")}')" class="bg-indigo-50 text-indigo-600 hover:bg-indigo-600 hover:text-white px-3 py-2 rounded-xl text-xs font-bold transition shadow-sm">
                + تحديث الحالة
            </button>
        `;
        followupList.appendChild(div);
    });
}

function quickAddVisitation(memberId, memberName) {
    currentTab = 'Visitations';
    openModal('add');
    setTimeout(() => {
        const idInp = document.querySelector('input[name="MemberID"]');
        const nameInp = document.querySelector('input[name="MemberName"]');
        const dateInp = document.querySelector('input[name="VisitDate"]');
        const visitorInp = document.querySelector('input[name="VisitorName"]');
        
        if (idInp) idInp.value = memberId;
        if (nameInp) nameInp.value = memberName;
        
        const now = new Date();
        const day = String(now.getDate()).padStart(2, '0');
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const year = now.getFullYear();
        if (dateInp) dateInp.value = `${day}/${month}/${year}`;
        
        if (visitorInp && currentUser) visitorInp.value = currentUser.ServantName;
    }, 100);
}

function printVisitReport() {
    setupPrintHeader("تقرير الافتقاد: الحالات المتأخرة والمتابعات المجدولة");
    const printArea = document.getElementById('printContainer');
    
    // إعادة بناء HTML للطباعة بناءً على القوائم المعروضة حالياً
    const urgentItems = Array.from(document.getElementById('visitUrgentList').children);
    const followupItems = Array.from(document.getElementById('visitFollowupList').children);
    
    let html = `
        <h3 style="font-size: 11pt; font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid #000; padding-bottom: 2px;">الأسر المتأخرة عن الافتقاد العاجل (+90 يوماً)</h3>
        <table class="print-table" style="margin-bottom: 15px;">
            <thead><tr><th style="width:30px;">م</th><th>اسم رب الأسرة</th><th>المنطقة</th><th>المحمول</th><th>مدة التأخير</th></tr></thead>
            <tbody>
    `;
    
    let count = 1;
    urgentItems.forEach(node => {
        if(node.tagName === "DIV" && node.querySelector('h4')) {
            const name = node.querySelector('h4').innerText;
            const meta = node.querySelector('p').innerText.split('|');
            const area = meta[0].replace('📍', '').trim();
            const phone = meta[1].replace('📞', '').trim();
            const delay = node.querySelectorAll('p')[1].innerText.replace('⏳ التأخير:', '').trim();
            html += `<tr><td style="text-align:center;font-weight:bold;">${count++}</td><td style="font-weight:bold;">${name}</td><td>${area}</td><td style="font-family:monospace;">${phone}</td><td style="color:red;font-weight:bold;">${delay}</td></tr>`;
        }
    });
    if(count === 1) html += `<tr><td colspan="5" style="text-align:center;">لا توجد حالات متأخرة.</td></tr>`;
    html += `</tbody></table>`;

    html += `
        <h3 style="font-size: 11pt; font-weight: bold; margin-bottom: 5px; border-bottom: 1px solid #000; padding-bottom: 2px;">المتابعات المجدولة للأسبوع القادم</h3>
        <table class="print-table">
            <thead><tr><th style="width:30px;">م</th><th>اسم المخدوم</th><th>الخادم المتابع</th><th>موعد المتابعة</th></tr></thead>
            <tbody>
    `;
    
    count = 1;
    followupItems.forEach(node => {
        if(node.tagName === "DIV" && node.querySelector('h4')) {
            const name = node.querySelector('h4').innerText;
            const visitor = node.querySelector('p').innerText.replace('👤 الخادم المتابع:', '').trim();
            const date = node.querySelectorAll('p')[1].innerText.replace('🗓️ موعد المتابعة:', '').trim();
            html += `<tr><td style="text-align:center;font-weight:bold;">${count++}</td><td style="font-weight:bold;">${name}</td><td>${visitor}</td><td style="font-weight:bold;">${date}</td></tr>`;
        }
    });
    if(count === 1) html += `<tr><td colspan="4" style="text-align:center;">لا توجد متابعات مجدولة.</td></tr>`;
    html += `</tbody></table>`;

    printArea.innerHTML = html;

    const dashSec = document.getElementById('visitationDashboardSection');
    if (dashSec) dashSec.classList.add('no-print');

    setTimeout(() => {
        window.print();
        printArea.innerHTML = "";
        if (dashSec) dashSec.classList.remove('no-print');
    }, 200);
}

// =========================================================================
// دوال النظام العامة (البحث، الفرز، الحفظ، الحذف)
// =========================================================================

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
            } else if (currentTab === 'Meetings_Attendance') {
                if (currentMeetingsView === 'live') {
                    initServantsMeetingLiveView();
                } else {
                    renderStandardCards();
                }
            } else if (currentTab === 'Visitations') {
                visitationsData = rawData;
                if (currentVisitView === 'dashboard') {
                    initVisitationsDashboard();
                } else {
                    renderStandardCards();
                }
            } else if (currentTab === 'Servants') {
                servantsCacheData = rawData;
                renderStandardCards();
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

// ... [The rest of the standard functions like buildAlphabetBar, renderFamilyHeadsRoster, etc remain exactly the same as previously defined]

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
    return text.trim().replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي");
}

function filterRoster() { renderFamilyHeadsRoster(); }

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
                    ${headId ? `<button onclick="editRecord(${headId})" class="text-xs font-bold bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 px-2.5 py-1.5 rounded-xl transition">✏️ تعديل</button>` : ''}
                    <button onclick="quickAddMemberToFamily('${headName.replace(/'/g, "\'")}')" class="text-xs font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 px-2.5 py-1.5 rounded-xl transition">+ فرد</button>
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
        const match = str.match(/ (19\d\d|20\d\d) /);
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
    const familyVisits = visitationsData.filter(v => memberNames.includes(v.MemberName) || memberIds.includes(String(v.MemberID)));
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
            details = `<p class="text-xs text-slate-600 mb-1 font-bold">الصلاحية: <span class="text-indigo-700">${item["Role"]}</span></p><p class="text-xs text-slate-500 font-semibold">النطاق: ${item["AssignedStage"]} - ${item["AssignedGrade"] || ""} (${item["AssignedClass"] || ""})</p><p class="text-[11px] font-mono text-slate-400">اسم المستخدم: ${item["Username"]}</p>`;
        } else if (currentTab === "Visitations") {
            details = `<p class="text-xs text-slate-600 mb-1 font-semibold">الخادم: ${item["VisitorName"]}</p><p class="text-xs text-slate-500">تاريخ الافتقاد: ${item["VisitDate"]}</p>`;
        } else if (currentTab === "Meetings_Attendance") {
            details = `<p class="text-xs text-slate-600 mb-1 font-semibold">${item["MeetingName"]} - <span class="font-bold ${item["Status"]==='حاضر'?'text-emerald-600':item["Status"]==='معتذر'?'text-amber-600':'text-rose-600'}">${item["Status"]}</span></p><p class="text-xs text-slate-500">التاريخ: ${item["MeetingDate"]} ${item["Notes"] ? '| ملاحظة: ' + item["Notes"] : ''}</p>`;
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

        if (f.type === "servant_name_autocomplete") {
            inpH = `<input type="text" name="${f.id}" list="servantsNamesList" value="${val}" ${f.required?'required':''} onchange="onServantNameSelected(this.value)" placeholder="اختر الخادم من قائمة الأعضاء..." class="${cls}">`;
        } else if (f.type === "family_head_select") {
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

    if (currentTab === 'Servants') {
        populateServantsDatalist();
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
    } else if (currentTab === 'Meetings_Attendance') {
        if (currentMeetingsView === 'live') {
            document.getElementById('servantsMeetingLiveSection').classList.toggle('hidden', s);
        } else {
            document.getElementById('standardCardsContainer').classList.toggle('hidden', s);
        }
    } else if (currentTab === 'Visitations') {
        if (currentVisitView === 'dashboard') {
            document.getElementById('visitationDashboardSection').classList.toggle('hidden', s);
        } else {
            document.getElementById('standardCardsContainer').classList.toggle('hidden', s);
        }
    } else {
        document.getElementById('standardCardsContainer').classList.toggle('hidden', s);
    }
}

function openAddServantQuickModal() {
    currentTab = 'Servants';
    openModal('add');
}

async function populateServantsDatalist() {
    if (namesCacheData.length === 0) {
        try {
            const res = await (await fetch(`${API_URL}?sheet=Names`)).json();
            if (res.status === "success") namesCacheData = res.data;
        } catch(e) {}
    }
    const dl = document.getElementById('servantsNamesList');
    if (!dl) return;
    const validMembers = namesCacheData.filter(m => !isMemberDeceased(m));
    dl.innerHTML = validMembers.map(m => `<option value="${m['الاسم ثلاثي']}">`).join('');
}

function onServantNameSelected(selectedName) {
    const member = namesCacheData.find(m => m["الاسم ثلاثي"] === selectedName);
    const usernameInput = document.querySelector('input[name="Username"]');
    if (member && usernameInput && !usernameInput.value) {
        const phone = member["تليفون العمل/المحمول"] || "";
        if (phone) usernameInput.value = phone;
    }
}

// =========================================================================
// محرك رصد حضور اجتماع الخدام الأسبوعي
// =========================================================================

async function initServantsMeetingLiveView() {
    const dateInput = document.getElementById('servantsMeetingDate');
    const now = new Date();
    const day = String(now.getDate()).padStart(2, '0');
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const year = now.getFullYear();
    dateInput.value = `${day}/${month}/${year}`;

    if (servantsCacheData.length === 0) {
        try {
            const res = await (await fetch(`${API_URL}?sheet=Servants`)).json();
            if (res.status === "success") servantsCacheData = res.data;
        } catch(e) {}
    }
    if (namesCacheData.length === 0) {
        try {
            const res = await (await fetch(`${API_URL}?sheet=Names`)).json();
            if (res.status === "success") namesCacheData = res.data;
        } catch(e) {}
    }

    const activeServants = servantsCacheData.filter(s => s["Status"] !== "موقوف" && s["Username"] !== "admin");

    currentServantsMeetingList = activeServants.map(s => {
        const member = namesCacheData.find(m => m["الاسم ثلاثي"] === s["ServantName"]);
        let realPhone = "-";
        if (member && member["تليفون العمل/المحمول"]) {
            realPhone = member["تليفون العمل/المحمول"];
        } else if (s["Username"] && /^\d+$/.test(s["Username"])) {
            realPhone = s["Username"];
        }

        return {
            id: s["ID"] || s[Object.keys(s)[0]],
            name: s["ServantName"],
            phone: realPhone,
            role: s["Role"] || "خادم",
            scope: `${s["AssignedStage"] || "الكل"} ${s["AssignedGrade"] ? '- ' + s["AssignedGrade"] : ''} ${s["AssignedClass"] ? '(' + s["AssignedClass"] + ')' : ''}`,
            status: "حاضر",
            notes: ""
        };
    }).sort((a, b) => a.name.localeCompare(b.name, 'ar'));

    renderServantsMeetingTable();
}

function renderServantsMeetingTable() {
    const tbody = document.getElementById('servantsMeetingTableBody');
    const emptyNotice = document.getElementById('servantsMeetingEmpty');
    tbody.innerHTML = "";

    document.getElementById('recordCount').innerText = `${currentServantsMeetingList.length} خادم مسجل`;

    if (currentServantsMeetingList.length === 0) {
        emptyNotice.classList.remove('hidden');
        return;
    }
    emptyNotice.classList.add('hidden');

    let presentCount = 0, excusedCount = 0, absentCount = 0;

    currentServantsMeetingList.forEach((servant, idx) => {
        if (servant.status === "حاضر") presentCount++;
        else if (servant.status === "معتذر") excusedCount++;
        else absentCount++;

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
        tr.innerHTML = `
            <td class="p-3 text-center font-bold text-slate-400">${idx + 1}</td>
            <td class="p-3 font-bold text-slate-800">${servant.name}</td>
            <td class="p-3">
                <span class="bg-indigo-50 text-indigo-700 border border-indigo-200 px-2 py-0.5 rounded text-[10px] font-bold">${servant.role}</span>
                <span class="text-[11px] text-slate-600 font-semibold block mt-0.5">${servant.scope}</span>
            </td>
            <td class="p-3 font-mono text-slate-600 text-xs">${servant.phone}</td>
            <td class="p-3 text-center">
                <div class="inline-flex rounded-xl shadow-sm border border-slate-200 p-0.5 bg-slate-50">
                    <button type="button" onclick="setServantMeetingStatus(${idx}, 'حاضر')" class="px-2.5 py-1 text-xs font-bold rounded-lg transition ${servant.status === 'حاضر' ? 'bg-emerald-600 text-white shadow' : 'text-slate-600 hover:text-emerald-700'}">حاضر</button>
                    <button type="button" onclick="setServantMeetingStatus(${idx}, 'معتذر')" class="px-2.5 py-1 text-xs font-bold rounded-lg transition ${servant.status === 'معتذر' ? 'bg-amber-500 text-white shadow' : 'text-slate-600 hover:text-amber-700'}">معتذر</button>
                    <button type="button" onclick="setServantMeetingStatus(${idx}, 'غائب')" class="px-2.5 py-1 text-xs font-bold rounded-lg transition ${servant.status === 'غائب' ? 'bg-rose-600 text-white shadow' : 'text-slate-600 hover:text-rose-700'}">غائب</button>
                </div>
            </td>
            <td class="p-3">
                <input type="text" placeholder="اكتب سبب الاعتذار أو الملاحظة..." value="${servant.notes}" oninput="currentServantsMeetingList[${idx}].notes = this.value" class="w-full p-2 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none focus:ring-2 focus:ring-amber-500">
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('servantsAttendanceSummary').innerHTML = `
        <span class="text-emerald-700">حاضر: ${presentCount}</span> &nbsp;|&nbsp; 
        <span class="text-amber-700">معتذر: ${excusedCount}</span> &nbsp;|&nbsp; 
        <span class="text-rose-700">غائب: ${absentCount}</span>
    `;
}

function setServantMeetingStatus(index, status) {
    currentServantsMeetingList[index].status = status;
    renderServantsMeetingTable();
}

function markAllServantsMeeting(status) {
    currentServantsMeetingList.forEach(s => s.status = status);
    renderServantsMeetingTable();
}

async function saveServantsMeetingBatchAttendance() {
    if (currentServantsMeetingList.length === 0) {
        alert("لا يوجد خدام في الكشف للحفظ!");
        return;
    }

    const meetingName = document.getElementById('servantsMeetingName').value.trim() || "اجتماع الخدام الأسبوعي";
    const meetingDate = document.getElementById('servantsMeetingDate').value.trim();

    if (!meetingDate) {
        alert("يرجى كتابة تاريخ الاجتماع أولاً!");
        return;
    }

    if (!confirm(`هل أنت متأكد من حفظ حضور (${currentServantsMeetingList.length}) خادم لاجتماع: ${meetingName} بتاريخ: ${meetingDate}؟`)) return;

    const btn = document.getElementById('btnSaveServantsMeetingBatch');
    btn.disabled = true;
    btn.innerHTML = `جاري الحفظ بالسجلات...`;

    const payload = currentServantsMeetingList.map(s => ({
        "MeetingName": meetingName,
        "MeetingDate": meetingDate,
        "MemberID": s.id,
        "MemberName": s.name,
        "Status": s.status,
        "Notes": s.notes
    }));

    try {
        const res = await (await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                sheet: "Meetings_Attendance",
                action: "batch_add",
                data: payload
            })
        })).json();

        if (res.status === "success") {
            alert("✓ " + res.message);
            loadData();
        } else {
            alert("خطأ أثناء الحفظ: " + res.message);
        }
    } catch(err) {
        alert("تعذر الاتصال بالخادم لحفظ حضور الاجتماع.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = `💾 حفظ حضور الاجتماع`;
    }
}

function printServantsMeetingRoster() {
    const meetingName = document.getElementById('servantsMeetingName')?.value || "اجتماع الخدام الأسبوعي";
    const meetingDate = document.getElementById('servantsMeetingDate')?.value || "";

    if (currentServantsMeetingList.length === 0) {
        alert("لا يوجد خدام في الكشف للطباعة!");
        return;
    }

    setupPrintHeader(`كشف حضور ${meetingName} - تاريخ: ${meetingDate}`);
    const printArea = document.getElementById('printContainer');
    
    printArea.innerHTML = `
        <table class="print-table">
            <thead>
                <tr>
                    <th style="width: 25px;">م</th>
                    <th style="width: 180px;">اسم الخادم</th>
                    <th style="width: 140px;">الخدمة المسندة</th>
                    <th style="width: 95px;">المحمول</th>
                    <th style="width: 65px; text-align: center;">الحالة</th>
                    <th>سبب الاعتذار والملاحظات</th>
                </tr>
            </thead>
            <tbody>
                ${currentServantsMeetingList.map((s, idx) => `
                    <tr>
                        <td style="text-align: center; font-weight: bold;">${idx + 1}</td>
                        <td style="font-weight: bold;">${s.name}</td>
                        <td>${s.scope}</td>
                        <td style="font-family: monospace;">${s.phone}</td>
                        <td style="text-align: center; font-weight: bold;">${s.status}</td>
                        <td>${s.notes || "-"}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
        <div style="margin-top: 15px; display: flex; justify-content: space-between; font-weight: bold; font-size: 8pt;" class="print-only">
            <p>أمين اجتماع الخدام: .........................</p>
            <p>أبونا المسؤول: .........................</p>
        </div>
    `;

    setTimeout(() => {
        window.print();
        printArea.innerHTML = "";
    }, 150);
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
Displaying app.js.
