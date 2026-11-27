/* ==================== منظومة الخدمة والرعاية الكنسية - app.js ==================== */

// 1. الإعدادات الأساسية والمتغيرات العامة والجلسة
const API_URL = "https://script.google.com/macros/s/AKfycbxUSj07z5nkCv88hrgob88-bB21SLs2OmK9-BbSSUu_4m2eirI8cBHCl-5xUv0cyTSZ6Q/exec";
let currentUser = null, sessionToken = "", currentTab = "", rawData = [], backendAreas = [], namesCacheData = [], servantsCacheData = [], visitationsData = [];
let currentNamesView = "roster", currentSSView = "live", currentMeetingsView = "live", currentVisitView = "dashboard", currentServantsView = "list";
let servantsConfessionsSummaryData = [], currentServantsConfRows = [];
let selectedLetter = "الكل", currentSSLiveKids = [], currentSSReportRows = [], currentServantsMeetingList = [], ssChartInstances = {}, selectedChartStage = "الكل";
let loginUsersList = [{ username: "admin", label: "الأدمن" }];

// استرجاع الجلسة المحفوظة عند تحديث الصفحة وتحميل قائمة الخدام
window.addEventListener('load', () => {
    sessionStorage.removeItem('church_current_user');
    sessionStorage.removeItem('church_session_token');
    const passInp = document.getElementById('loginPass');
    if (passInp) {
        passInp.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                handleLogin(e);
            }
        });
    }
    if (window.location.hash === '#family') {
        openFamilyPortal();
    }
    initOfflineSupport();
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

// 2. دوال تنسيق ومعالجة الهواتف والتواريخ والواتساب
const PHONE_FIELD_KEYS = ["تليفون العمل/المحمول", "هاتف الاسرة", "رقم التليفون"];
const DATE_FIELD_KEYS = ["تاريخ الميلاد", "تاريخ الزواج", "تاريخ الوفاة", "تاريخ اخر اعتراف", "SessionDate", "MeetingDate", "VisitDate", "FollowUpDate"];
const EGYPT_GOV_CODES = ["13", "15", "40", "45", "46", "47", "48", "50", "55", "57", "62", "64", "65", "66", "68", "69", "82", "84", "86", "88", "92", "93", "95", "96", "97"];

function normalizeEgyptianPhone(phone) {
    if (phone === undefined || phone === null) return "";
    let raw = String(phone).trim().replace(/^'+/, "");
    if (!raw || raw === "-") return "";
    if (raw.startsWith("+") || raw.startsWith("00")) {
        return raw.replace(/[^+\d]/g, "");
    }
    let digits = raw.replace(/\D/g, "");
    if (!digits) return "";
    // إزالة كود الدولة 20 أو 0020 إن وجد لإعادة الصيغة المحلية القياسية
    if (digits.startsWith("0020") && digits.length >= 13) digits = "0" + digits.slice(4);
    else if (digits.startsWith("20") && digits.length === 12 && /^201[0125]/.test(digits)) digits = "0" + digits.slice(2);
    // استعادة الصفر الأول الساقط من Google Sheets للموبايل (10 أرقام تبدأ بـ 10/11/12/15)
    if (digits.length === 10 && /^1[0125]/.test(digits)) {
        return "0" + digits;
    }
    // استعادة الصفر الأول الساقط للأرضي المحافظات (9 أرقام تبدأ بكود المحافظة مثل 653334840 -> 0653334840)
    if (digits.length === 9 && EGYPT_GOV_CODES.includes(digits.slice(0, 2))) {
        return "0" + digits;
    }
    // استعادة الصفر الأول الساقط لأرضي القاهرة والجيزة (8 أرقام تبدأ بـ 2 أو 3)
    if (digits.length === 8 && /^[23]/.test(digits)) {
        return "0" + digits;
    }
    return digits;
}

function isValidEgyptianPhone(phone, allowLandline = true) {
    const norm = normalizeEgyptianPhone(phone);
    if (!norm) return true;
    if (norm.startsWith("+") || norm.startsWith("00")) return norm.replace(/\D/g, "").length >= 10;
    if (/^01[0125]\d{8}$/.test(norm)) return true;
    if (allowLandline && /^0[2-9]\d{7,8}$/.test(norm)) return true;
    return false;
}

function formatDisplayDate(val) {
    if (val === undefined || val === null) return "";
    let s = String(val).trim().replace(/^'+/, "");
    if (!s || s === "-") return "";

    // 1. معالجة صيغة ISO القادمة من السيرفر مثل 1985-05-31T21:00:00.000Z بتوقيت القاهرة الصحيح
    if (/^\+?\d{4,6}-\d{2}-\d{2}T/.test(s)) {
        const cleanIso = s.replace(/\+$/, "");
        const d = new Date(cleanIso);
        if (!isNaN(d.getTime())) {
            try {
                const parts = new Intl.DateTimeFormat('en-GB', {
                    timeZone: 'Africa/Cairo',
                    day: '2-digit',
                    month: '2-digit',
                    year: 'numeric'
                }).formatToParts(d);
                const day = parts.find(p => p.type === 'day')?.value;
                const month = parts.find(p => p.type === 'month')?.value;
                const year = parseInt(parts.find(p => p.type === 'year')?.value || "0", 10);
                if (year >= 1900 && year <= 2100 && day && month) {
                    return `${day}/${month}/${year}`;
                }
            } catch (e) {}
        }
        return ""; // تجاهل التواريخ التالفة ذات السنوات غير المنطقية مثل 078676
    }

    // 2. معالجة صيغة YYYY-MM-DD أو YYYY/MM/DD
    const ymd = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})$/);
    if (ymd) {
        const y = parseInt(ymd[1], 10);
        if (y < 1900 || y > 2100) return "";
        return `${ymd[3].padStart(2, '0')}/${ymd[2].padStart(2, '0')}/${ymd[1]}`;
    }

    // 3. معالجة صيغة DD/MM/YYYY أو D-M-YYYY
    const dmy = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
    if (dmy) {
        const y = parseInt(dmy[3], 10);
        if (y < 1900 || y > 2100) return "";
        return `${dmy[1].padStart(2, '0')}/${dmy[2].padStart(2, '0')}/${dmy[3]}`;
    }

    // 4. معالجة إدخال 8 أرقام متصلة مثل 01061985 -> 01/06/1985
    const digits8 = s.match(/^(\d{2})(\d{2})(\d{4})$/);
    if (digits8) {
        const d = parseInt(digits8[1], 10), m = parseInt(digits8[2], 10), y = parseInt(digits8[3], 10);
        if (d >= 1 && d <= 31 && m >= 1 && m <= 12 && y >= 1900 && y <= 2100) {
            return `${digits8[1]}/${digits8[2]}/${digits8[3]}`;
        }
    }

    return s;
}

function isValidCalendarDate(dateStr) {
    if (!dateStr) return true;
    const m = String(dateStr).trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return false;
    const day = parseInt(m[1], 10), month = parseInt(m[2], 10), year = parseInt(m[3], 10);
    if (year < 1900 || year > 2035 || month < 1 || month > 12 || day < 1) return false;
    const daysInMonth = new Date(year, month, 0).getDate();
    return day <= daysInMonth;
}

function sanitizeRecordFields(row) {
    if (!row || typeof row !== "object") return row;
    const copy = { ...row };
    const keys = Object.keys(copy);
    keys.forEach(k => {
        const nk = normalizeArabic(k);
        if (nk === "اسم رب الاسرة" && !copy["اسم رب الاسرة"]) {
            copy["اسم رب الاسرة"] = String(copy[k] || "").trim();
        } else if (PHONE_FIELD_KEYS.some(pk => normalizeArabic(pk) === nk)) {
            const normP = normalizeEgyptianPhone(copy[k]);
            if (normP) copy[k] = normP;
        } else if (DATE_FIELD_KEYS.some(dk => normalizeArabic(dk) === nk)) {
            copy[k] = formatDisplayDate(copy[k]);
        }
    });
    if (!copy["اسم رب الاسرة"] && copy["الاسم ثلاثي"] !== undefined && keys.length > 1 && keys[1] !== "الاسم ثلاثي") {
        copy["اسم رب الاسرة"] = String(copy[keys[1]] || "").trim();
    }
    return copy;
}

function formatWhatsAppNumber(phone) {
    const norm = normalizeEgyptianPhone(phone);
    if (!norm) return '';
    let cleaned = norm.replace(/\D/g, '');
    return (cleaned.startsWith('01') && cleaned.length === 11) ? '2' + cleaned : cleaned;
}
function renderContactButtons(phone) {
    const cleanPhone = normalizeEgyptianPhone(phone);
    if (!cleanPhone || cleanPhone === "-") return '';
    const waPhone = formatWhatsAppNumber(cleanPhone);
    return `<a href="tel:${cleanPhone}" title="اتصال هاتفي" onclick="event.stopPropagation()" class="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition"><span>📞 اتصال</span></a><a href="https://wa.me/${waPhone}" target="_blank" title="مراسلة عبر واتساب" onclick="event.stopPropagation()" class="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[10px] font-bold shadow-sm transition"><span>💬 واتساب</span></a>`;
}

// 3. الأيقونات والخرائط المرجعية
const ICONS = {
    users: `<svg class="w-12 h-12 inline-block text-emerald-600" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
    children: `<svg class="w-12 h-12 inline-block text-blue-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
    visitations: `<svg class="w-12 h-12 inline-block text-rose-600" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`,
    meetings: `<svg class="w-12 h-12 inline-block text-amber-500" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>`,
    servants: `<svg class="w-12 h-12 inline-block text-purple-600" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>`,
    audit: `<svg class="w-12 h-12 inline-block text-slate-700" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-6h2v6zm0-8h-2V7h2v2z"/></svg>`,
    cross: `<svg class="w-12 h-12 inline-block text-purple-700" fill="currentColor" viewBox="0 0 24 24"><path d="M10 2h4v6h6v4h-6v10h-4V12H4V8h6V2z"/></svg>`
};
const STAGE_GRADES = { "حضانة": ["بيبي كلاس", "أولى حضانة", "ثانية حضانة"], "ابتدائي": ["الصف الأول", "الصف الثاني", "الصف الثالث", "الصف الرابع", "الصف الخامس", "الصف السادس"], "إعدادي": ["الصف الأول الإعدادي", "الصف الثاني الإعدادي", "الصف الثالث الإعدادي"], "ثانوي": ["الصف الأول الثانوي", "الصف الثاني الثانوي", "الصف الثالث الثانوي"], "جامعي": ["الفرقة الأولى", "الفرقة الثانية", "الفرقة الثالثة", "الفرقة الرابعة", "بكالوريوس / تخرج"], "خريجين": ["خريج"] };
const TABS_INFO = {
    "Names": { label: "أعضاء الكنيسة", desc: "دليل أرباب الأسر والفرز المتقدم", svg: ICONS.users, accent: "from-emerald-500 to-teal-600", iconBg: "bg-emerald-50 ring-emerald-100", hoverText: "group-hover:text-emerald-700", roles: ["Admin", "Priest"] },
    "Sunday_School": { label: "مدارس الأحد", desc: "كشوف الفصول والحضور والإحصائيات", svg: ICONS.children, accent: "from-blue-500 to-indigo-600", iconBg: "bg-blue-50 ring-blue-100", hoverText: "group-hover:text-blue-700", roles: ["Admin", "Priest", "SundaySchool_Admin", "Stage_Leader", "Class_Servant"] },
    "Visitations": { label: "سجل الافتقاد", desc: "افتقاد الفصول والأسر وتقارير الإنجاز", svg: ICONS.visitations, accent: "from-rose-500 to-pink-600", iconBg: "bg-rose-50 ring-rose-100", hoverText: "group-hover:text-rose-700", roles: ["Admin", "Priest", "SundaySchool_Admin", "Stage_Leader", "Class_Servant"] },
    "Meetings_Attendance": { label: "حضور الاجتماعات", desc: "رصد حضور اجتماع الخدام الأسبوعي", svg: ICONS.meetings, accent: "from-amber-500 to-orange-600", iconBg: "bg-amber-50 ring-amber-100", hoverText: "group-hover:text-amber-700", roles: ["Admin", "Priest", "SundaySchool_Admin"] },
    "Servants": { label: "إدارة الخدام", desc: "توزيع الصلاحيات وربط الخدام", svg: ICONS.servants, accent: "from-purple-500 to-violet-600", iconBg: "bg-purple-50 ring-purple-100", hoverText: "group-hover:text-purple-700", roles: ["Admin"] },
    "Audit_Log": { label: "سجل المراقبة", desc: "متابعة دخول الخدام والتعديلات", svg: ICONS.audit, accent: "from-slate-600 to-slate-800", iconBg: "bg-slate-100 ring-slate-200", hoverText: "group-hover:text-slate-900", roles: ["Admin"] },
    "Confessions": { label: "سجل الاعترافات", desc: "سجل اعترافات الأبناء (للآباء الكهنة فقط)", svg: ICONS.cross, accent: "from-purple-600 to-indigo-700", iconBg: "bg-purple-50 ring-purple-200", hoverText: "group-hover:text-purple-800", roles: ["Priest", "Admin"], priestOnly: true }
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
        { id: "رقم المنزل", label: "رقم المنزل", type: "text" }, { id: "الدور", label: "الدور", type: "text" },
        { id: "شقة", label: "شقة", type: "text" }, { id: "هاتف الاسرة", label: "هاتف الأسرة الأرضي / البديل", type: "text" },
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
        { id: "Password", label: "كلمة المرور", type: "text", required: true }, { id: "Role", label: "الصلاحية", type: "select", options: ["Admin", "Priest", "SundaySchool_Admin", "Stage_Leader", "Class_Servant"] },
        { id: "AssignedStage", label: "المرحلة / النطاق المسند", type: "select", options: ["الكل", "مدارس الأحد (حضانة - ثانوي)", "حضانة وابتدائي", "الجامعة والخريجين", ...Object.keys(STAGE_GRADES)] }, { id: "AssignedGrade", label: "الصف المسند", type: "text" },
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
    const currentVal = document.getElementById('loginUser')?.value || '';
    if (!listEl) return;
    const q = normalizeArabic(filterText).toLowerCase();
    const filtered = loginUsersList.filter(u => !q || (u.normLabel || normalizeArabic(u.label).toLowerCase()).includes(q));
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
    if (labelSpan) { labelSpan.innerText = label; labelSpan.classList.remove('text-slate-400'); }
    if (menu) menu.classList.add('hidden');
    if (arrow) arrow.style.transform = 'rotate(0deg)';
    document.getElementById('loginPass')?.focus();
}

function getLoginRolePriority(role, name = "") {
    const r = String(role || "").trim();
    if (r === "Priest" || /^(?:قدس\s+)?(?:ابونا\s+)?(?:القمص|القس|ابونا)\b/.test(normalizeArabic(name))) return 1;
    if (r === "SundaySchool_Admin") return 2;
    if (r === "Stage_Leader") return 3;
    if (r === "Class_Servant") return 4;
    if (r === "Admin") return 99;
    return 5;
}

function buildSortedLoginList(listData) {
    const items = [];
    listData.forEach((s, idx) => {
        if (s.Username && s.Username !== "admin" && s.Status !== "موقوف") {
            const cleanName = String(s.ServantName || s.Username).replace(/\s*\([^)]*\)/g, '').trim();
            const role = String(s.Role || "").trim();
            items.push({
                username: String(s.Username).trim(),
                label: cleanName,
                normLabel: normalizeArabic(cleanName).toLowerCase(),
                role: role,
                priority: getLoginRolePriority(role, cleanName),
                origIdx: idx
            });
        }
    });
    items.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        if (a.priority === 1) return a.origIdx - b.origIdx;
        return a.label.localeCompare(b.label, 'ar');
    });
    items.push({ username: "admin", label: "الأدمن", role: "Admin", priority: 99, origIdx: 999999 });
    return items;
}

async function loadServantsListForLogin() {
    // تحميل فوري من الكاش المحلي لتظهر الأسماء حتى بدون إنترنت
    try {
        const cachedList = JSON.parse(localStorage.getItem('church_cache_login_users') || 'null');
        if (Array.isArray(cachedList) && cachedList.length > 0) {
            loginUsersList = cachedList;
            renderLoginUserOptions('');
        }
    } catch (e) {}

    if (!navigator.onLine) {
        updateConnectionIndicator(false);
        return;
    }

    try {
        const res = await fetch(`${API_URL}?sheet=Servants_List`);
        const data = await res.json();
        const listData = (data.status === "success" && Array.isArray(data.data)) ? data.data : [];
        if (listData.length > 0) {
            loginUsersList = buildSortedLoginList(listData);
            try { localStorage.setItem('church_cache_login_users', JSON.stringify(loginUsersList)); } catch (e) {}
            renderLoginUserOptions('');
            updateConnectionIndicator(true);
            return;
        }
    } catch(e) {}

    // احتياطي في حال كان السكربت يستخدم ?sheet=Servants
    try {
        const res = await fetch(`${API_URL}?sheet=Servants`);
        const data = await res.json();
        if (data.status === "success" && Array.isArray(data.data) && data.data.length > 0) {
            servantsCacheData = data.data;
            loginUsersList = buildSortedLoginList(data.data);
            try { localStorage.setItem('church_cache_login_users', JSON.stringify(loginUsersList)); } catch (e) {}
            renderLoginUserOptions('');
            updateConnectionIndicator(true);
        }
    } catch(e) {}
}

async function handleLogin(e) {
    if (e) { try { e.preventDefault(); e.stopPropagation(); } catch(err) {} }
    const btn = document.getElementById('loginBtn'), err = document.getElementById('loginError');
    const userVal = (document.getElementById('loginUser')?.value || "").trim(), passVal = (document.getElementById('loginPass')?.value || "").trim();
    if (!userVal) {
        if (err) { err.innerText = "يرجى اختيار اسم المستخدم أولاً"; err.classList.remove('hidden'); }
        return false;
    }
    if (!passVal) return false;
    if (btn) { btn.disabled = true; btn.innerHTML = `جاري التحقق من السيرفر...`; }
    if (err) err.classList.add('hidden');

    // محاولة الدخول في وضع عدم الاتصال (الكاش) إذا لم يتوفر إنترنت
    if (!navigator.onLine) {
        const offlineUser = await verifyOfflineCredentials(userVal, passVal);
        if (offlineUser) {
            currentUser = offlineUser.user;
            sessionToken = offlineUser.token || `offline_${Date.now()}`;
            isOfflineSession = true;
            sessionStorage.setItem('church_current_user', JSON.stringify(currentUser));
            sessionStorage.setItem('church_session_token', sessionToken);
            if (btn) { btn.disabled = false; btn.innerText = "تسجيل الدخول"; }
            updateConnectionIndicator(false);
            initApp(false);
            return false;
        } else {
            if (err) {
                err.innerText = "أنت غير متصل بالإنترنت. للدخول بدون نت، يجب تسجيل الدخول مرة واحدة مسبقاً على هذا الجهاز أثناء وجود إنترنت بنفس كلمة المرور.";
                err.classList.remove('hidden');
            }
            if (btn) { btn.disabled = false; btn.innerText = "تسجيل الدخول"; }
            return false;
        }
    }

    try {
        const res = await fetch(API_URL, { method: 'POST', body: JSON.stringify({ action: 'login', data: { username: userVal, password: passVal } }) });
        const data = await res.json();
        if (data.status === "success" && data.user) {
            currentUser = data.user;
            sessionToken = data.token || `local_${Date.now()}`;
            isOfflineSession = false;
            sessionStorage.setItem('church_current_user', JSON.stringify(currentUser));
            sessionStorage.setItem('church_session_token', sessionToken);
            await saveOfflineCredentials(userVal, passVal, currentUser, sessionToken);
            updateConnectionIndicator(true);
            initApp(false);
            // مزامنة أي عمليات معلقة وتجهيز الكاش في الخلفية
            setTimeout(() => {
                syncOfflineQueue(false);
                warmOfflineCachesInBackground();
            }, 600);
            return false;
        } else if (err) {
            err.innerText = data.message || "اسم المستخدم أو كلمة المرور غير صحيحة";
            err.classList.remove('hidden');
        }
    } catch (error) {
        // في حالة انقطاع الإنترنت المفاجئ أثناء الضغط على تسجيل الدخول، نحاول الدخول من الكاش
        updateConnectionIndicator(false);
        const offlineUser = await verifyOfflineCredentials(userVal, passVal);
        if (offlineUser) {
            currentUser = offlineUser.user;
            sessionToken = offlineUser.token || `offline_${Date.now()}`;
            isOfflineSession = true;
            sessionStorage.setItem('church_current_user', JSON.stringify(currentUser));
            sessionStorage.setItem('church_session_token', sessionToken);
            initApp(false);
            return false;
        }
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
    const login = document.getElementById('loginScreen'), landing = document.getElementById('landingScreen'), badge = document.getElementById('userBadge');
    const hdr = document.getElementById('appHeader'), mn = document.getElementById('appMain'), scBtns = document.getElementById('floatingScrollBtns');
    if (login) { login.style.display = 'none'; login.classList.add('hidden'); }
    if (landing) { landing.style.display = 'none'; landing.classList.add('hidden'); }
    if (hdr) hdr.classList.remove('hidden');
    if (mn) { mn.classList.remove('hidden'); mn.classList.add('flex'); }
    if (scBtns) { scBtns.classList.remove('hidden'); scBtns.classList.add('flex'); }
    if (badge && currentUser) {
        const titleLabel = isPriestUser(currentUser) ? "أب الاعتراف:" : "الخادم:";
        badge.innerHTML = `<span>${titleLabel} <span class="font-black text-indigo-700">${currentUser.ServantName}</span></span><span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md font-mono text-[10px] font-bold border border-indigo-200">${currentUser.Role}</span>`;
    }
    buildDashboard();
    showDashboard();
    if (!isRestoredSession) {
        sendAuditLog("تسجيل دخول", "النظام", "تم تسجيل الدخول بنجاح");
    }
}

function isPriestUser(userObj) {
    if (!userObj) return false;
    if (String(userObj.Role || "").trim() === "Priest") return true;
    const nameNorm = normalizeArabic(userObj.ServantName || "");
    return /^(?:قدس\s+)?(?:ابونا\s+)?(?:القمص|القس|ابونا)\b/.test(nameNorm);
}

function getUserAllowedStages(userObj) {
    const allStages = Object.keys(STAGE_GRADES);
    if (!userObj) return allStages;
    const raw = String(userObj.AssignedStage || "").trim();
    if (!raw || raw === "الكل") return allStages;
    if (raw === "مدارس الأحد (حضانة - ثانوي)") return ["حضانة", "ابتدائي", "إعدادي", "ثانوي"];
    if (raw === "حضانة وابتدائي") return ["حضانة", "ابتدائي"];
    if (raw === "الجامعة والخريجين") return ["جامعي", "خريجين"];
    const parts = raw.split(/[،,]+/).map(s => s.trim()).filter(Boolean);
    const matched = allStages.filter(st => parts.some(p => normalizeArabic(p) === normalizeArabic(st)));
    return matched.length > 0 ? matched : allStages;
}

function isStageAllowedForUser(stageName, userObj = currentUser) {
    const allowed = getUserAllowedStages(userObj);
    return allowed.some(st => normalizeArabic(st) === normalizeArabic(stageName));
}

function buildDashboard() {
    const grid = document.getElementById('dashboardGrid');
    if (!grid || !currentUser) return;
    grid.innerHTML = "";
    const visibleKeys = Object.keys(TABS_INFO).filter(k => {
        if (!TABS_INFO[k].roles.includes(currentUser.Role)) return false;
        if (TABS_INFO[k].priestOnly && !isPriestUser(currentUser)) return false;
        return true;
    });
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

    ['namesViewSwitcher', 'ssViewSwitcher', 'meetingsViewSwitcher', 'visitationsViewSwitcher', 'servantsViewSwitcher'].forEach(id => { const el = document.getElementById(id); el?.classList.add('hidden'); el?.classList.remove('flex'); });
    ['sundaySchoolLiveSection', 'sundaySchoolReportSection', 'sundaySchoolChartsSection', 'servantsMeetingLiveSection', 'visitationDashboardSection', 'visitationReportsSection', 'priestConfessionsSection', 'servantsConfessionsSection', 'namesRosterSection', 'namesFilterSection', 'namesPlaceholder', 'familyResultsContainer', 'standardSearchContainer', 'standardCardsContainer'].forEach(id => {
        const el = document.getElementById(id);
        if (el) { el.classList.add('hidden'); if (id === 'sundaySchoolChartsSection') el.style.display = 'none'; }
    });
    ['btnPrintSundaySchool', 'btnPrintMeetings', 'btnPdfMeetings', 'btnPrintFiltered', 'btnPdfFiltered', 'btnPrintRoster', 'btnPdfRoster', 'btnPrintVisitReport', 'btnPdfVisitReport'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    
    const btnAdd = document.getElementById('btnAddNewRecord');
    const btnExp = document.getElementById('btnExportExcel');
    if (btnAdd) {
        if (sectionKey === 'Audit_Log' || sectionKey === 'Confessions') btnAdd.classList.add('hidden');
        else btnAdd.classList.remove('hidden');
    }
    if (btnExp) {
        if (sectionKey === 'Confessions') btnExp.classList.add('hidden');
        else btnExp.classList.remove('hidden');
    }

    if (sectionKey === 'Names') { const sw = document.getElementById('namesViewSwitcher'); sw?.classList.remove('hidden'); sw?.classList.add('flex'); switchNamesView('roster'); }
    else if (sectionKey === 'Sunday_School') { const sw = document.getElementById('ssViewSwitcher'); sw?.classList.remove('hidden'); sw?.classList.add('flex'); document.getElementById('btnPrintSundaySchool')?.classList.remove('hidden'); switchSSView('live'); }
    else if (sectionKey === 'Meetings_Attendance') { const sw = document.getElementById('meetingsViewSwitcher'); sw?.classList.remove('hidden'); sw?.classList.add('flex'); document.getElementById('btnPrintMeetings')?.classList.remove('hidden'); document.getElementById('btnPdfMeetings')?.classList.remove('hidden'); switchMeetingsView('live'); }
    else if (sectionKey === 'Visitations') { const sw = document.getElementById('visitationsViewSwitcher'); sw?.classList.remove('hidden'); sw?.classList.add('flex'); document.getElementById('btnPrintVisitReport')?.classList.remove('hidden'); document.getElementById('btnPdfVisitReport')?.classList.remove('hidden'); switchVisitationsView('dashboard'); }
    else if (sectionKey === 'Confessions') { document.getElementById('priestConfessionsSection')?.classList.remove('hidden'); }
    else if (sectionKey === 'Servants') { const sw = document.getElementById('servantsViewSwitcher'); sw?.classList.remove('hidden'); sw?.classList.add('flex'); switchServantsView('list'); }
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
        btnRosterPrint?.classList.remove('hidden'); document.getElementById('btnPdfRoster')?.classList.remove('hidden'); btnFiltered?.classList.add('hidden'); document.getElementById('btnPdfFiltered')?.classList.add('hidden');
        buildAlphabetBar(); renderFamilyHeadsRoster();
    } else {
        if (btnFilters) btnFilters.className = "px-4 py-2 rounded-lg text-xs font-black transition bg-white text-indigo-700 shadow-sm";
        if (btnRoster) btnRoster.className = "px-4 py-2 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
        rosterSec?.classList.add('hidden'); filterSec?.classList.remove('hidden'); resultsSec?.classList.remove('hidden');
        btnFiltered?.classList.remove('hidden'); document.getElementById('btnPdfFiltered')?.classList.remove('hidden'); btnRosterPrint?.classList.add('hidden'); document.getElementById('btnPdfRoster')?.classList.add('hidden');
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

// ==================== فهرس البحث السريع (Pre-normalized Index + Debounce) ====================
let cachedFamiliesRosterIndex = null;
let cachedFamiliesRosterSourceRef = null;
let cachedPriestConfSummaryMap = new Map();

function createDebounce(fn, delayMs = 150) {
    let timerId = null;
    return function (...args) {
        if (timerId) clearTimeout(timerId);
        timerId = setTimeout(() => {
            timerId = null;
            fn.apply(this, args);
        }, delayMs);
    };
}

function getSearchIndex(row) {
    if (!row || typeof row !== "object") {
        return { name: "", head: "", phone: "", area: "", all: "" };
    }
    if (row._searchIdx) return row._searchIdx;
    const name = normalizeArabic(row["الاسم ثلاثي"] || row["ChildName"] || row["ServantName"] || row["MemberName"] || "").toLowerCase();
    const head = normalizeArabic(row["اسم رب الاسرة"] || "").toLowerCase();
    const phone = String(row["تليفون العمل/المحمول"] || row["هاتف الاسرة"] || row["رقم التليفون"] || "").trim();
    const area = normalizeArabic(row["المنطقة"] || "").toLowerCase();
    const all = normalizeArabic(Object.values(row).map(v => (v === null || v === undefined ? "" : String(v))).join(" ")).toLowerCase();
    const idxObj = { name, head, phone, area, all };
    try {
        Object.defineProperty(row, "_searchIdx", {
            value: idxObj,
            enumerable: false,
            configurable: true,
            writable: true
        });
    } catch (e) {}
    return idxObj;
}

function rebuildFamiliesRosterIndex() {
    const familiesMap = {};
    rawData.forEach(member => {
        const headName = String(member["اسم رب الاسرة"] || "").trim();
        if (!headName) return;
        if (!familiesMap[headName]) familiesMap[headName] = [];
        familiesMap[headName].push(member);
    });

    const sortedHeadNames = Object.keys(familiesMap).sort((a, b) => a.localeCompare(b, 'ar'));
    cachedFamiliesRosterIndex = sortedHeadNames.map(headName => {
        const members = sortFamilyMembers(familiesMap[headName], headName);
        const normHead = normalizeArabic(headName).toLowerCase();
        const combinedSearch = normHead + " " + members.map(m => {
            const idx = getSearchIndex(m);
            return `${idx.name} ${idx.phone}`;
        }).join(" ");
        return {
            headName,
            normHead,
            firstChar: normHead ? normHead[0] : "",
            members,
            searchBlob: combinedSearch
        };
    });
    cachedFamiliesRosterSourceRef = rawData;
    return cachedFamiliesRosterIndex;
}

function getFamiliesRosterIndex() {
    if (cachedFamiliesRosterIndex && cachedFamiliesRosterSourceRef === rawData) {
        return cachedFamiliesRosterIndex;
    }
    return rebuildFamiliesRosterIndex();
}

function rebuildPriestConfSummaryIndex() {
    cachedPriestConfSummaryMap = new Map();
    priestSpiritualChildren.forEach(m => {
        getSearchIndex(m);
        const hist = getMemberConfessionHistory(m);
        const latestDate = hist.length > 0 ? hist[0].date : "";
        const days = latestDate ? getDaysSinceDate(latestDate) : null;
        cachedPriestConfSummaryMap.set(String(m["ID"]), { latestDate, days, count: hist.length });
    });
}

const debouncedRenderRoster = createDebounce(() => renderFamilyHeadsRoster(), 150);
const debouncedApplyNamesFilter = createDebounce(() => applyNamesFilter(), 150);
const debouncedRenderStandardCards = createDebounce(() => renderStandardCards(), 150);
const debouncedFilterPriestChildren = createDebounce(() => filterPriestChildrenList(), 150);

function onNamesSearchInput() { debouncedApplyNamesFilter(); }
function onStandardSearchInput() { debouncedRenderStandardCards(); }
function onConfessionSearchInput() { debouncedFilterPriestChildren(); }

function filterRoster() { debouncedRenderRoster(); }

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
    return getFieldValNormalized(item, "المنطقة");
}

function mergeFamilySheetIntoNames(namesRows, familyRows) {
    if (!Array.isArray(namesRows)) return [];
    if (!Array.isArray(familyRows) || familyRows.length === 0) return namesRows;
    const famMap = {};
    familyRows.forEach(f => {
        const head = normalizeArabic(getFieldValNormalized(f, "اسم رب الاسرة"));
        if (!head) return;
        famMap[head] = {
            area: getFieldValNormalized(f, "المنطقة"),
            street: getFieldValNormalized(f, "اسم الشارع"),
            house: getFieldValNormalized(f, "العنوان رقم المنزل") || getFieldValNormalized(f, "رقم المنزل"),
            floor: getFieldValNormalized(f, "الدور"),
            apt: getFieldValNormalized(f, "شقة"),
            phone: normalizeEgyptianPhone(getFieldValNormalized(f, "رقم التليفون") || getFieldValNormalized(f, "هاتف الاسرة")),
            district: getFieldValNormalized(f, "القسم/القرية")
        };
    });
    return namesRows.map(m => {
        const head = normalizeArabic(getFieldValNormalized(m, "اسم رب الاسرة"));
        const fam = famMap[head];
        if (!fam) return m;
        const copy = { ...m };
        if (!getFieldValNormalized(copy, "المنطقة") && fam.area) copy["المنطقة"] = fam.area;
        if (!getFieldValNormalized(copy, "اسم الشارع") && fam.street) copy["اسم الشارع"] = fam.street;
        if (!getFieldValNormalized(copy, "رقم المنزل") && fam.house) copy["رقم المنزل"] = fam.house;
        if (!getFieldValNormalized(copy, "الدور") && fam.floor) copy["الدور"] = fam.floor;
        if (!getFieldValNormalized(copy, "شقة") && fam.apt) copy["شقة"] = fam.apt;
        if (!getFieldValNormalized(copy, "هاتف الاسرة") && fam.phone) copy["هاتف الاسرة"] = fam.phone;
        return copy;
    });
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
        backendAreas.forEach(a => { const clean = String(a || "").trim(); if (clean && clean !== "-" && clean.length > 1) areas.add(clean); });
    }
    rawData.forEach(item => {
        const a = getMemberArea(item);
        if (a) areas.add(a);
    });
    // Remove empty strings or just dashes
    const sortedAreas = Array.from(areas).filter(a => a && a !== "-" && a.length > 1).sort((a, b) => a.localeCompare(b, 'ar'));
    areaSelect.innerHTML = `<option value="">كل المناطق السكنية (${sortedAreas.length})</option>` + sortedAreas.map(a => `<option value="${a}">${a}</option>`).join('');
    
    // Ensure previous selection is kept if valid, otherwise reset
    if (prevVal && sortedAreas.includes(prevVal)) areaSelect.value = prevVal;
    else areaSelect.value = "";
    
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

function getMemberBirthTimestamp(member) {
    if (!member) return Number.MAX_SAFE_INTEGER;
    const dobFormatted = formatDisplayDate(member["تاريخ الميلاد"]);
    if (dobFormatted) {
        const parts = dobFormatted.split('/');
        if (parts.length === 3) {
            const dt = new Date(Number(parts[2]), Number(parts[1]) - 1, Number(parts[0]));
            if (!isNaN(dt.getTime())) return dt.getTime();
        }
    }
    const nid = String(member["الرقم القومي"] || "").trim().replace(/\D/g, '');
    if (nid.length === 14 && (nid[0] === '2' || nid[0] === '3')) {
        const century = nid[0] === '2' ? 1900 : 2000;
        const yr = century + parseInt(nid.substring(1, 3), 10);
        const mo = parseInt(nid.substring(3, 5), 10) - 1;
        const dy = parseInt(nid.substring(5, 7), 10);
        const dt = new Date(yr, mo, dy);
        if (!isNaN(dt.getTime()) && yr >= 1900 && yr <= 2026) return dt.getTime();
    }
    return Number.MAX_SAFE_INTEGER;
}

function getFamilyMemberRolePriority(member, headName = "") {
    const rel = normalizeArabic(member["صلة القرابة"] || "");
    const gender = normalizeArabic(member["ذكر/انثي"] || "");
    const fullN = normalizeArabic(member["الاسم ثلاثي"] || "");
    const headN = normalizeArabic(headName || member["اسم رب الاسرة"] || "");
    const isHead = headN && fullN && (fullN === headN || (fullN.split(' ').length >= 2 && headN.startsWith(fullN.split(' ').slice(0, 2).join(' '))));

    // 1. الزوج (رب الأسرة)
    if (rel === "زوج" || rel === "رب اسره" || (isHead && gender !== "انثي" && rel !== "زوجه" && rel !== "والده" && rel !== "ابنه" && rel !== "اخت")) {
        return 1;
    }
    // 2. الزوجة
    if (rel === "زوجه") {
        return 2;
    }
    // 3. الأبناء والبنات حسب السن (من الأكبر للأصغر)
    if (rel === "ابن" || rel === "ابنه" || rel === "ابن/ابنه" || rel === "") {
        return 3;
    }
    // 4. باقي الأقارب (والد / والدة / أخ / أخت / أخرى)
    return 4;
}

function sortFamilyMembers(membersList, headName = "") {
    if (!Array.isArray(membersList)) return [];
    return [...membersList].sort((a, b) => {
        const pA = getFamilyMemberRolePriority(a, headName);
        const pB = getFamilyMemberRolePriority(b, headName);
        if (pA !== pB) return pA - pB;

        const dobA = getMemberBirthTimestamp(a);
        const dobB = getMemberBirthTimestamp(b);
        if (dobA !== dobB) return dobA - dobB; // تاريخ الميلاد الأقدم أولاً (الأكبر سناً أولاً)

        return String(a["الاسم ثلاثي"] || "").localeCompare(String(b["الاسم ثلاثي"] || ""), 'ar');
    });
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
    const normQuery = normalizeArabic(document.getElementById('rosterSearchInput')?.value || "").toLowerCase();
    const normLetterChar = selectedLetter !== "الكل" ? normalizeArabic(selectedLetter)[0] : "";

    const rosterIndex = getFamiliesRosterIndex();
    const filteredFamilies = rosterIndex.filter(entry => {
        if (normLetterChar && entry.firstChar !== normLetterChar) return false;
        if (normQuery && !entry.searchBlob.includes(normQuery)) return false;
        return true;
    });

    const recCount = document.getElementById('recordCount');
    if (recCount) recCount.innerText = `${filteredFamilies.length} أسرة`;
    if (filteredFamilies.length === 0) { container.innerHTML = `<div class="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400 font-bold">لم يتم العثور على أرباب أسر مطابقين</div>`; return; }

    filteredFamilies.forEach((entry, index) => {
        const headName = entry.headName;
        const familyMembers = entry.members;
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
                                    ${(currentUser.Role === "Admin" || currentUser.Role === "Priest") ? `<button onclick="deleteRecord(${mId})" class="text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 px-2 py-1 rounded-lg transition">حذف</button>` : ''}
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
    const fs = document.getElementById('filterSortBy'); if (fs) fs.value = "family";
    const cont = document.getElementById('familyResultsContainer'); if (cont) cont.innerHTML = "";
    document.getElementById('namesPlaceholder')?.classList.remove('hidden');
    const countBadge = document.getElementById('recordCount'); if (countBadge) countBadge.innerText = "0 سجل";
}

function applyNamesFilter() {
    const headQ = normalizeArabic(document.getElementById('filterFamilyHead')?.value || "").toLowerCase(), nameQ = normalizeArabic(document.getElementById('filterFullName')?.value || "").toLowerCase();
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
        if (headQ || nameQ) {
            const idx = getSearchIndex(item);
            if (headQ && !idx.head.includes(headQ)) return false;
            if (nameQ && !idx.name.includes(nameQ)) return false;
        }
        return true;
    });

    const sortBy = document.getElementById('filterSortBy')?.value || "family";
    matchedMembers.sort((a, b) => {
        const dobA = getMemberBirthTimestamp(a);
        const dobB = getMemberBirthTimestamp(b);
        const nameA = String(a["الاسم ثلاثي"] || "").trim();
        const nameB = String(b["الاسم ثلاثي"] || "").trim();
        
        if (sortBy === "age_desc") {
            if (dobA !== dobB) return dobA - dobB; // أصغر رقم = أقدم تاريخ = أكبر سناً
            return nameA.localeCompare(nameB, 'ar');
        } else if (sortBy === "age_asc") {
            if (dobA !== dobB) return dobB - dobA; // أكبر رقم = أحدث تاريخ = أصغر سناً
            return nameA.localeCompare(nameB, 'ar');
        } else if (sortBy === "alpha") {
            return nameA.localeCompare(nameB, 'ar');
        } else {
            // Default: "family"
            const headA = String(a["اسم رب الاسرة"] || "").trim();
            const headB = String(b["اسم رب الاسرة"] || "").trim();
            const headCmp = headA.localeCompare(headB, 'ar');
            if (headCmp !== 0) return headCmp;
            const pA = getFamilyMemberRolePriority(a, headA);
            const pB = getFamilyMemberRolePriority(b, headB);
            if (pA !== pB) return pA - pB;
            if (dobA !== dobB) return dobA - dobB;
            return nameA.localeCompare(nameB, 'ar');
        }
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
                <div class="flex items-center gap-2 no-print flex-wrap w-full md:w-auto justify-end">${renderContactButtons(member["تليفون العمل/المحمول"])}<button onclick="editRecord(${idVal})" class="text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-xl transition">تعديل</button>${(currentUser.Role === "Admin" || currentUser.Role === "Priest") ? `<button onclick="deleteRecord(${idVal})" class="text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded-xl transition">حذف</button>` : ''}</div>
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
        if (headQ || nameQ) {
            const idx = getSearchIndex(item);
            if (headQ && !idx.head.includes(headQ)) return false;
            if (nameQ && !idx.name.includes(nameQ)) return false;
        }
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
    const btnLive = document.getElementById('btnSSLiveRoster'), btnRep = document.getElementById('btnSSReport'), btnHist = document.getElementById('btnSSHistory'), btnCharts = document.getElementById('btnSSCharts');
    const liveSec = document.getElementById('sundaySchoolLiveSection'), repSec = document.getElementById('sundaySchoolReportSection'), cardsSec = document.getElementById('standardCardsContainer');
    const searchSec = document.getElementById('standardSearchContainer'), chartsSec = ensureChartsSectionExists();
    const btnAdd = document.getElementById('btnAddNewRecord');

    [btnLive, btnRep, btnHist, btnCharts].forEach(btn => { if (btn) btn.className = "px-3.5 py-2 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900"; });
    liveSec?.classList.add('hidden'); repSec?.classList.add('hidden'); cardsSec?.classList.add('hidden'); searchSec?.classList.add('hidden');
    if (chartsSec) { chartsSec.classList.add('hidden'); chartsSec.style.display = 'none'; }
    btnAdd?.classList.add('hidden');

    if (view === 'live') { if (btnLive) btnLive.className = "px-3.5 py-2 rounded-lg text-xs font-black transition bg-white text-blue-700 shadow-sm"; liveSec?.classList.remove('hidden'); initSundaySchoolLiveView(); }
    else if (view === 'report') { if (btnRep) btnRep.className = "px-3.5 py-2 rounded-lg text-xs font-black transition bg-white text-indigo-700 shadow-sm"; repSec?.classList.remove('hidden'); initSSReportView(); }
    else if (view === 'history') { if (btnHist) btnHist.className = "px-3.5 py-2 rounded-lg text-xs font-black transition bg-white text-blue-700 shadow-sm"; cardsSec?.classList.remove('hidden'); searchSec?.classList.remove('hidden'); btnAdd?.classList.remove('hidden'); renderStandardCards(); }
    else if (view === 'charts') { if (btnCharts) btnCharts.className = "px-3.5 py-2 rounded-lg text-xs font-black transition bg-white text-blue-700 shadow-sm"; if (chartsSec) { chartsSec.classList.remove('hidden'); chartsSec.style.display = 'block'; } initSSChartsView(); }
}

async function initSundaySchoolLiveView() {
    const dateInput = document.getElementById('ssSessionDate'), now = new Date();
    if (dateInput) dateInput.value = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    if (namesCacheData.length === 0) { try { const [res, famRes] = await Promise.all([apiFetch(`${API_URL}?sheet=Names`), apiFetch(`${API_URL}?sheet=${encodeURIComponent("Family name")}`).catch(() => ({ status: "err" }))]); if (res.status === "success") namesCacheData = ((famRes.status === "success") ? mergeFamilySheetIntoNames(res.data, famRes.data) : res.data).map(sanitizeRecordFields); } catch(e) {} }

    const stageSel = document.getElementById('ssFilterStage');
    if (!stageSel) return;
    const allowedStages = getUserAllowedStages(currentUser);
    stageSel.innerHTML = allowedStages.map(s => `<option value="${s}">${s}</option>`).join('');
    if (allowedStages.length === 1) { stageSel.value = allowedStages[0]; stageSel.disabled = true; }
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
    const stage = document.getElementById('ssFilterStage')?.value || "", grade = document.getElementById('ssFilterGrade')?.value || "", genderFilter = document.getElementById('ssFilterGender')?.value || "";
    if (visitationsData.length === 0) { try { const res = await apiFetch(`${API_URL}?sheet=Visitations`); if (res.status === "success") visitationsData = res.data.map(sanitizeRecordFields); } catch(e) {} }

    const matched = namesCacheData.filter(kid => {
        if (isMemberDeceased(kid) || kid["مدارس الأحد"] === "غير مشترك") return false;
        if (normalizeArabic(kid["المرحلة"]) !== normalizeArabic(stage)) return false;
        if (grade && normalizeArabic(kid["الصف"]) !== normalizeArabic(grade)) return false;
        if (genderFilter && normalizeGender(kid["ذكر/انثي"]) !== genderFilter) return false;
        return true;
    }).sort((a, b) => String(a["الاسم ثلاثي"]).localeCompare(String(b["الاسم ثلاثي"]), 'ar'));

    currentSSLiveKids = matched.map(kid => {
        const kId = kid["ID"] || kid[Object.keys(kid)[0]], kName = kid["الاسم ثلاثي"], fHead = kid["اسم رب الاسرة"] || "", phone = kid["تليفون العمل/المحمول"] || kid["هاتف الاسرة"] || "-";
        return {
            id: kId, name: kName, familyHead: fHead, phone: phone, stage: kid["المرحلة"] || stage, grade: kid["الصف"] || grade || "-", className: (genderFilter === "ذكر" ? "بنين" : (genderFilter === "انثي" ? "بنات" : "مجمّع")),
            lastAttendance: getLastKidAttendanceInfo(kName, kId), lastVisit: getLastKidVisitInfo(kName, kId, fHead),
            attendance: "حاضر", notes: ""
        };
    });
    renderSSLiveKidsTable();
}

function renderSSLiveKidsTable() {
    const tbody = document.getElementById('ssLiveKidsTableBody'), emptyNotice = document.getElementById('ssLiveKidsEmpty');
    if (!tbody) return;
    const thead = tbody.closest('table')?.querySelector('thead');
    if (thead) {
        thead.innerHTML = `<tr><th class="p-3 w-10 text-center">م</th><th class="p-3">اسم المخدوم والصف</th><th class="p-3 text-center">آخر حضور</th><th class="p-3 text-center">آخر افتقاد</th><th class="p-3">التواصل والمحمول</th><th class="p-3 text-center">حضور اليوم</th><th class="p-3">ملاحظات الافتقاد</th></tr>`;
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
            <td class="p-3"><input type="text" placeholder="ملاحظة..." value="${kid.notes}" oninput="currentSSLiveKids[${idx}].notes = this.value" class="w-full p-1.5 bg-slate-50 border border-slate-200 rounded-xl font-bold text-xs outline-none"></td>
        `;
        tbody.appendChild(tr);
    });
}

function toggleSSKidAttendance(index) { const kid = currentSSLiveKids[index]; if (!kid) return; kid.attendance = (kid.attendance === "حاضر") ? "غائب" : "حاضر"; renderSSLiveKidsTable(); }
function markAllSSKids(status) { currentSSLiveKids.forEach(kid => { kid.attendance = status; }); renderSSLiveKidsTable(); }

async function saveSundaySchoolBatchAttendance() {
    if (currentSSLiveKids.length === 0) { alert("لا يوجد مخدومين في الكشف لحفظهم!"); return; }
    const sessionDate = (document.getElementById('ssSessionDate')?.value || "").trim();
    if (!sessionDate) { alert("يرجى كتابة تاريخ الحصة أولاً!"); return; }

    // فحص منع تكرار رصد الحضور لنفس اليوم والفصل
    const stageVal = document.getElementById('ssFilterStage')?.value || "";
    const gradeVal = document.getElementById('ssFilterGrade')?.value || "";
    const genderVal = document.getElementById('ssFilterGender')?.value || "";
    const classNameVal = genderVal === "ذكر" ? "بنين" : (genderVal === "انثي" ? "بنات" : "مجمّع");
    
    const alreadyRecorded = rawData.some(r => 
        String(r["SessionDate"] || "").trim() === sessionDate &&
        normalizeArabic(r["Stage"]) === normalizeArabic(stageVal) &&
        (!gradeVal || normalizeArabic(r["Grade"]) === normalizeArabic(gradeVal)) &&
        normalizeArabic(r["ClassName"]) === normalizeArabic(classNameVal)
    );
    if (alreadyRecorded) {
        if (!confirm(`⚠️ تنبيه: تم رصد حضور هذا الفصل (${stageVal} ${gradeVal} ${classNameVal}) بتاريخ ${sessionDate} مسبقاً!\nهل أنت متأكد من أنك تريد تسجيله مرة أخرى؟`)) return;
    } else {
        if (!confirm(`هل أنت متأكد من حفظ سجل حضور (${currentSSLiveKids.length}) مخدوم لتاريخ: ${sessionDate}؟`)) return;
    }

    const btn = document.getElementById('btnSaveSSBatch');
    if (btn) { btn.disabled = true; btn.innerHTML = `جاري الحفظ بالسجلات...`; }
    const payload = currentSSLiveKids.map(kid => ({ "Stage": kid.stage, "Grade": kid.grade, "ClassName": kid.className, "SessionDate": sessionDate, "ChildID": kid.id, "ChildName": kid.name, "ServantName": currentUser ? currentUser.ServantName : "خادم الفصل", "Attendance": kid.attendance, "Notes": kid.notes }));
    try {
        const data = await apiPost({ sheet: "Sunday_School", action: "batch_add", data: payload });
        if (data.status === "success") {
            sendAuditLog("رصد حضور مدارس الأحد", "Sunday_School", `تم حفظ كشف (${payload.length}) مخدوم - ${stageVal} ${gradeVal} ${classNameVal} بتاريخ ${sessionDate}`);
            alert("✓ " + data.message);
            loadData();
        } else alert("خطأ أثناء الحفظ: " + data.message);
    } catch(err) { alert("تعذر الاتصال بالخادم لحفظ الحضور: " + (err.message || "")); }
    finally { if (btn) { btn.disabled = false; btn.innerHTML = `💾 حفظ حضور الفصل كاملاً`; } }
}

// ==================== تقرير الحضور المجمع خلال فترة زمنية (من - إلى) ====================
function parseDateToTimestamp(dStr) {
    const formatted = formatDisplayDate(dStr);
    if (!formatted) return null;
    const m = formatted.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (!m) return null;
    const dt = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
    return isNaN(dt.getTime()) ? null : dt.getTime();
}

function setSSReportQuickRange(preset) {
    const fromInp = document.getElementById('ssReportFromDate');
    const toInp = document.getElementById('ssReportToDate');
    if (!fromInp || !toInp) return;
    const now = new Date();
    const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    if (preset === 'month') {
        fromInp.value = `01/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        toInp.value = todayStr;
    } else if (preset === '3months') {
        const past = new Date(now.getFullYear(), now.getMonth() - 3, now.getDate());
        fromInp.value = `${String(past.getDate()).padStart(2, '0')}/${String(past.getMonth() + 1).padStart(2, '0')}/${past.getFullYear()}`;
        toInp.value = todayStr;
    } else if (preset === 'all') {
        fromInp.value = "";
        toInp.value = "";
    }
    generateSSPeriodReport();
}

async function initSSReportView() {
    const fromInp = document.getElementById('ssReportFromDate');
    const toInp = document.getElementById('ssReportToDate');
    const now = new Date();
    if (fromInp && !fromInp.value) {
        fromInp.value = `01/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    }
    if (toInp && !toInp.value) {
        toInp.value = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    }

    if (namesCacheData.length === 0) {
        try {
            const [res, famRes] = await Promise.all([
                apiFetch(`${API_URL}?sheet=Names`),
                apiFetch(`${API_URL}?sheet=${encodeURIComponent("Family name")}`).catch(() => ({ status: "err" }))
            ]);
            if (res.status === "success") {
                namesCacheData = ((famRes.status === "success") ? mergeFamilySheetIntoNames(res.data, famRes.data) : res.data).map(sanitizeRecordFields);
            }
        } catch (e) {}
    }

    const stageSel = document.getElementById('ssReportStage');
    const badgeEl = document.getElementById('ssReportScopeBadge');
    if (stageSel) {
        const allowedStages = getUserAllowedStages(currentUser);
        const isAll = allowedStages.length === Object.keys(STAGE_GRADES).length;
        if (allowedStages.length === 1) {
            stageSel.innerHTML = `<option value="${allowedStages[0]}">${allowedStages[0]}</option>`;
            stageSel.value = allowedStages[0];
            stageSel.disabled = true;
            if (badgeEl) badgeEl.innerText = `نطاق الصلاحية: ${allowedStages[0]}`;
        } else {
            stageSel.innerHTML = `<option value="">${isAll ? "كل المراحل" : "كل مراحل النطاق"}</option>` + allowedStages.map(s => `<option value="${s}">${s}</option>`).join('');
            stageSel.disabled = false;
            if (badgeEl) badgeEl.innerText = isAll ? "نطاق الصلاحية: الخدمة بالكامل" : `نطاق الصلاحية: ${currentUser.AssignedStage}`;
        }
        onSSReportStageChange(stageSel.value);
    }
}

function onSSReportStageChange(stage) {
    const grdSel = document.getElementById('ssReportGrade');
    if (grdSel) {
        if (!stage) {
            grdSel.innerHTML = `<option value="">كل الصفوف</option>`;
            grdSel.disabled = true;
        } else {
            grdSel.innerHTML = `<option value="">كل الصفوف</option>` + (STAGE_GRADES[stage] || []).map(g => `<option value="${g}">${g}</option>`).join('');
            if (currentUser.Role === "Class_Servant" && currentUser.AssignedGrade && currentUser.AssignedGrade !== "الكل") {
                grdSel.value = currentUser.AssignedGrade;
                grdSel.disabled = true;
            } else {
                grdSel.disabled = false;
            }
        }
    }
    generateSSPeriodReport();
}

function generateSSPeriodReport() {
    const stage = document.getElementById('ssReportStage')?.value || "";
    const grade = document.getElementById('ssReportGrade')?.value || "";
    const genderFilter = document.getElementById('ssReportGender')?.value || "";
    const fromRaw = (document.getElementById('ssReportFromDate')?.value || "").trim();
    const toRaw = (document.getElementById('ssReportToDate')?.value || "").trim();
    const sortBy = document.getElementById('ssReportSort')?.value || "alpha";

    const fromFormatted = formatDisplayDate(fromRaw);
    const toFormatted = formatDisplayDate(toRaw);
    if (fromRaw && !isValidCalendarDate(fromFormatted)) {
        alert("⚠️ صيغة (من تاريخ) غير صحيحة! يرجى إدخالها بصيغة DD/MM/YYYY مثل 01/11/2026.");
        return;
    }
    if (toRaw && !isValidCalendarDate(toFormatted)) {
        alert("⚠️ صيغة (إلى تاريخ) غير صحيحة! يرجى إدخالها بصيغة DD/MM/YYYY مثل 17/11/2026.");
        return;
    }

    const fromTs = fromFormatted ? parseDateToTimestamp(fromFormatted) : null;
    const toTs = toFormatted ? parseDateToTimestamp(toFormatted) : null;

    // 1. تصفية سجلات الحضور ضمن النطاق والفترة الزمنية
    const filteredLogs = rawData.filter(rec => {
        const stg = normalizeArabic(rec["Stage"]);
        const grd = normalizeArabic(rec["Grade"]);
        if (!isStageAllowedForUser(rec["Stage"], currentUser)) return false;
        if (currentUser.Role === "Class_Servant" && currentUser.AssignedGrade && currentUser.AssignedGrade !== "الكل" && grd !== normalizeArabic(currentUser.AssignedGrade)) return false;
        if (stage && stg !== normalizeArabic(stage)) return false;
        if (grade && grd !== normalizeArabic(grade)) return false;

        const recTs = parseDateToTimestamp(rec["SessionDate"]);
        if (fromTs !== null && (recTs === null || recTs < fromTs)) return false;
        if (toTs !== null && (recTs === null || recTs > toTs)) return false;
        return true;
    });

    // 2. تجهيز قائمة الطلاب المسجلين في هذا النطاق من شيت الأعضاء
    const registeredKids = namesCacheData.filter(kid => {
        if (isMemberDeceased(kid) || kid["مدارس الأحد"] === "غير مشترك") return false;
        const stg = normalizeArabic(kid["المرحلة"]);
        const grd = normalizeArabic(kid["الصف"]);
        if (!isStageAllowedForUser(kid["المرحلة"], currentUser)) return false;
        if (currentUser.Role === "Class_Servant" && currentUser.AssignedGrade && currentUser.AssignedGrade !== "الكل" && grd !== normalizeArabic(currentUser.AssignedGrade)) return false;
        if (stage) {
            if (stg !== normalizeArabic(stage)) return false;
        } else {
            // إذا اختار "كل المراحل"، نعرض المشتركين في مدارس الأحد أو من لديهم مرحلة دراسية
            if (kid["مدارس الأحد"] !== "مشترك" && !stg) return false;
        }
        if (grade && grd !== normalizeArabic(grade)) return false;
        if (genderFilter && normalizeGender(kid["ذكر/انثي"]) !== genderFilter) return false;
        return true;
    });

    // بناء خريطة الطلاب لتجميع الحضور بدقة بدون تكرار لنفس اليوم
    const studentMap = new Map();
    const idToKey = new Map();
    const nameToKey = new Map();

    registeredKids.forEach(kid => {
        const kId = String(kid["ID"] || "").trim();
        const kName = String(kid["الاسم ثلاثي"] || "").trim();
        const normN = normalizeArabic(kName);
        const key = kId ? `id_${kId}` : `name_${normN}`;
        if (!studentMap.has(key)) {
            studentMap.set(key, {
                id: kId,
                name: kName,
                stage: kid["المرحلة"] || stage || "-",
                grade: kid["الصف"] || grade || "-",
                gender: normalizeGender(kid["ذكر/انثي"]),
                phone: kid["تليفون العمل/المحمول"] || kid["هاتف الاسرة"] || "-",
                presentDates: new Set(),
                absentDates: new Set()
            });
            if (kId) idToKey.set(kId, key);
            if (normN) nameToKey.set(normN, key);
        }
    });

    // حساب تواريخ الحصص المنعقدة في الفترة
    const distinctSessionDates = new Set();

    filteredLogs.forEach(rec => {
        const cId = String(rec["ChildID"] || "").trim();
        const cName = String(rec["ChildName"] || "").trim();
        const normN = normalizeArabic(cName);
        let key = (cId && idToKey.has(cId)) ? idToKey.get(cId) : (nameToKey.has(normN) ? nameToKey.get(normN) : null);

        // إذا كان السجل لطالب غير موجود في القائمة المفلترة (مثلاً بسبب اختلاف النوع)، نتحقق من فلتر النوع أولاً
        if (!key) {
            const memberRec = namesCacheData.find(m => (cId && String(m["ID"]).trim() === cId) || normalizeArabic(m["الاسم ثلاثي"]) === normN);
            const recGender = memberRec ? normalizeGender(memberRec["ذكر/انثي"]) : (normalizeArabic(rec["ClassName"]) === "بنين" ? "ذكر" : (normalizeArabic(rec["ClassName"]) === "بنات" ? "انثي" : ""));
            if (genderFilter && recGender && recGender !== genderFilter) return;

            key = cId ? `id_${cId}` : `name_${normN}`;
            if (!studentMap.has(key)) {
                studentMap.set(key, {
                    id: cId,
                    name: cName || "غير مسمى",
                    stage: rec["Stage"] || stage || "-",
                    grade: rec["Grade"] || grade || "-",
                    gender: recGender,
                    phone: memberRec ? (memberRec["تليفون العمل/المحمول"] || memberRec["هاتف الاسرة"] || "-") : "-",
                    presentDates: new Set(),
                    absentDates: new Set()
                });
                if (cId) idToKey.set(cId, key);
                if (normN) nameToKey.set(normN, key);
            }
        }

        const sDate = formatDisplayDate(rec["SessionDate"]) || String(rec["SessionDate"] || "").trim();
        if (!sDate) return;
        distinctSessionDates.add(sDate);

        const stObj = studentMap.get(key);
        const isPresent = String(rec["Attendance"] || "").trim() === "حاضر";
        if (isPresent) {
            stObj.presentDates.add(sDate);
            stObj.absentDates.delete(sDate);
        } else if (!stObj.presentDates.has(sDate)) {
            stObj.absentDates.add(sDate);
        }
    });

    const totalPeriodSessions = distinctSessionDates.size;

    currentSSReportRows = Array.from(studentMap.values()).map(st => {
        const presentCount = st.presentDates.size;
        const absentCount = st.absentDates.size;
        const denom = Math.max(totalPeriodSessions, presentCount + absentCount);
        const pct = denom > 0 ? Math.round((presentCount / denom) * 100) : 0;
        const sortedPresentDates = Array.from(st.presentDates).sort((a, b) => parseDateForSort(a) - parseDateForSort(b));
        return {
            ...st,
            presentCount,
            absentCount,
            totalSessions: denom,
            pct,
            presentDatesList: sortedPresentDates
        };
    });

    // ترتيب النتائج حسب الاختيار
    currentSSReportRows.sort((a, b) => {
        if (sortBy === "present_desc") {
            if (b.presentCount !== a.presentCount) return b.presentCount - a.presentCount;
            return a.name.localeCompare(b.name, 'ar');
        } else if (sortBy === "present_asc") {
            if (a.presentCount !== b.presentCount) return a.presentCount - b.presentCount;
            return a.name.localeCompare(b.name, 'ar');
        }
        return a.name.localeCompare(b.name, 'ar');
    });

    renderSSPeriodReportTable(totalPeriodSessions);
}

function renderSSPeriodReportTable(totalPeriodSessions) {
    const tbody = document.getElementById('ssReportTableBody');
    const emptyEl = document.getElementById('ssReportEmpty');
    const kpiEl = document.getElementById('ssReportKpiCards');
    const recCount = document.getElementById('recordCount');

    if (recCount) recCount.innerText = `${currentSSReportRows.length} مخدوم بالتقرير`;

    const totalKids = currentSSReportRows.length;
    const totalPresentSum = currentSSReportRows.reduce((acc, r) => acc + r.presentCount, 0);
    const totalPossibleSum = currentSSReportRows.reduce((acc, r) => acc + r.totalSessions, 0);
    const avgPct = totalPossibleSum > 0 ? Math.round((totalPresentSum / totalPossibleSum) * 100) : 0;
    const zeroAttendanceCount = currentSSReportRows.filter(r => r.presentCount === 0).length;

    if (kpiEl) {
        kpiEl.innerHTML = `
            <div class="bg-white/95 p-4 rounded-2xl border border-indigo-200 shadow-sm text-center"><span class="block text-xs font-bold text-slate-500 mb-1">إجمالي المخدومين</span><span class="text-2xl font-black text-indigo-700">${totalKids}</span><span class="block text-[11px] font-bold text-slate-400 mt-0.5">مخدوم في النطاق</span></div>
            <div class="bg-white/95 p-4 rounded-2xl border border-blue-200 shadow-sm text-center"><span class="block text-xs font-bold text-slate-500 mb-1">عدد الحصص في الفترة</span><span class="text-2xl font-black text-blue-600">${totalPeriodSessions}</span><span class="block text-[11px] font-bold text-slate-400 mt-0.5">حصة مسجلة</span></div>
            <div class="bg-white/95 p-4 rounded-2xl border border-emerald-200 shadow-sm text-center"><span class="block text-xs font-bold text-slate-500 mb-1">متوسط نسبة الحضور</span><span class="text-2xl font-black text-emerald-600">${avgPct}%</span><span class="block text-[11px] font-bold text-slate-400 mt-0.5">إجمالي الحضور: ${totalPresentSum}</span></div>
            <div class="bg-white/95 p-4 rounded-2xl border border-rose-200 shadow-sm text-center"><span class="block text-xs font-bold text-slate-500 mb-1">لم يحضروا في الفترة (0)</span><span class="text-2xl font-black text-rose-600">${zeroAttendanceCount}</span><span class="block text-[11px] font-bold text-slate-400 mt-0.5">يحتاجون افتقاد</span></div>
        `;
    }

    if (!tbody) return;
    tbody.innerHTML = "";
    if (currentSSReportRows.length === 0) {
        emptyEl?.classList.remove('hidden');
        return;
    }
    emptyEl?.classList.add('hidden');

    currentSSReportRows.forEach((row, idx) => {
        const pctBadge = row.pct >= 75
            ? `bg-emerald-50 text-emerald-700 border-emerald-200`
            : row.pct >= 40
                ? `bg-amber-50 text-amber-800 border-amber-200`
                : `bg-rose-50 text-rose-700 border-rose-200`;
        const datesHtml = row.presentDatesList.length > 0
            ? row.presentDatesList.map(d => `<span class="inline-block bg-emerald-50 text-emerald-800 border border-emerald-200 px-1.5 py-0.5 rounded text-[10px] font-mono ml-1 mb-0.5">${d}</span>`).join('')
            : `<span class="text-[11px] text-slate-400">لم يحضر في هذه الفترة</span>`;

        const tr = document.createElement('tr');
        tr.className = "hover:bg-slate-50 transition border-b border-slate-100";
        tr.innerHTML = `
            <td class="p-3 text-center font-bold text-slate-400">${idx + 1}</td>
            <td class="p-3"><p class="font-black text-slate-800 text-xs sm:text-sm">${row.name}</p><p class="text-[10px] text-slate-500 font-bold mt-0.5">${row.stage} - <span class="text-indigo-600">${row.grade}</span></p></td>
            <td class="p-3"><div class="flex flex-col gap-1"><span class="font-mono text-xs font-bold text-slate-700" dir="ltr">${row.phone}</span><div class="flex items-center gap-1 flex-wrap">${renderContactButtons(row.phone)}</div></div></td>
            <td class="p-3 text-center"><span class="inline-block px-3 py-1 rounded-xl bg-emerald-100 text-emerald-800 font-black text-xs">${row.presentCount}</span></td>
            <td class="p-3 text-center"><span class="inline-block px-3 py-1 rounded-xl bg-rose-50 text-rose-700 font-bold text-xs">${row.absentCount}</span></td>
            <td class="p-3 text-center font-black text-slate-600">${row.totalSessions}</td>
            <td class="p-3 text-center"><span class="px-2.5 py-1 rounded-lg font-black text-xs border ${pctBadge}">${row.pct}%</span></td>
            <td class="p-3">${datesHtml}</td>
        `;
        tbody.appendChild(tr);
    });
}

function shareSSPeriodReportWhatsApp() {
    if (!currentSSReportRows || currentSSReportRows.length === 0) {
        alert("لا توجد بيانات في التقرير للمشاركة!");
        return;
    }
    const stage = document.getElementById('ssReportStage')?.value || "الكل";
    const grade = document.getElementById('ssReportGrade')?.value || "كل الصفوف";
    const gender = document.getElementById('ssReportGender')?.value || "";
    const fromD = (document.getElementById('ssReportFromDate')?.value || "").trim() || "البداية";
    const toD = (document.getElementById('ssReportToDate')?.value || "").trim() || "اليوم";
    const genderLabel = gender === 'ذكر' ? ' (بنين)' : gender === 'انثي' ? ' (بنات)' : '';

    let text = `*تقرير الحضور المجمع - مدارس الأحد${genderLabel}*\n`;
    text += `المرحلة: ${stage} | الصف: ${grade}\n`;
    text += `الفترة: من ${fromD} إلى ${toD}\n\n`;

    currentSSReportRows.forEach((r, idx) => {
        text += `${idx + 1}. *${r.name}*\n`;
        text += `✅ حضر: *${r.presentCount}* من ${r.totalSessions} (${r.pct}%)\n`;
        if (r.phone && r.phone !== "-") text += `📞 ${r.phone}\n`;
        text += `──────────\n`;
    });
    shareToWhatsApp(text);
}

function exportSSPeriodReportExcel() {
    if (!currentSSReportRows || currentSSReportRows.length === 0) {
        alert("لا توجد بيانات في التقرير للتصدير!");
        return;
    }
    const headers = ["م", "اسم المخدوم", "المرحلة", "الصف", "المحمول", "مرات الحضور", "مرات الغياب", "إجمالي الحصص", "نسبة الحضور %", "تواريخ الحضور"];
    const csvRows = [headers.join(',')];
    currentSSReportRows.forEach((r, idx) => {
        const vals = [
            idx + 1,
            r.name,
            r.stage,
            r.grade,
            r.phone,
            r.presentCount,
            r.absentCount,
            r.totalSessions,
            `${r.pct}%`,
            r.presentDatesList.join(' - ')
        ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`);
        csvRows.push(vals.join(','));
    });
    const csvString = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    const now = new Date();
    link.download = `تقرير_الحضور_المجمع_${now.getFullYear()}-${now.getMonth()+1}-${now.getDate()}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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
    const allowedStages = getUserAllowedStages(currentUser);
    const isAll = allowedStages.length === Object.keys(STAGE_GRADES).length;
    let availableStages = [];
    if (allowedStages.length === 1) {
        availableStages = [allowedStages[0]];
        selectedChartStage = allowedStages[0];
        if (badgeEl) badgeEl.innerText = `نطاق الصلاحية: ${allowedStages[0]}${currentUser.AssignedGrade && currentUser.AssignedGrade !== 'الكل' ? ' - ' + currentUser.AssignedGrade : ''}`;
    } else {
        availableStages = ["الكل", ...allowedStages];
        if (selectedChartStage !== "الكل" && !allowedStages.includes(selectedChartStage)) selectedChartStage = "الكل";
        if (badgeEl) badgeEl.innerText = isAll ? "نطاق الصلاحية: الخدمة بالكامل" : `نطاق الصلاحية: ${currentUser.AssignedStage}`;
    }
    tabsEl.innerHTML = availableStages.map(st => `<button type="button" onclick="selectChartStage('${st}')" class="px-3.5 py-1.5 rounded-xl text-xs font-black transition ${selectedChartStage === st ? 'bg-indigo-600 text-white shadow-sm' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}">${st === "الكل" ? (isAll ? "🌐 الخدمة كلها" : "🌐 كامل النطاق") : st}</button>`).join('');
}

function selectChartStage(stage) { selectedChartStage = stage; initSSChartsView(); }

async function initSSChartsView() {
    const chartsSec = ensureChartsSectionExists();
    if (chartsSec) { chartsSec.classList.remove('hidden'); chartsSec.style.display = 'block'; }
    try { await ensureChartJsLoaded(); } catch (e) { alert(e.message); return; }
    if (namesCacheData.length === 0) { try { const [res, famRes] = await Promise.all([apiFetch(`${API_URL}?sheet=Names`), apiFetch(`${API_URL}?sheet=${encodeURIComponent("Family name")}`).catch(() => ({ status: "err" }))]); if (res.status === "success") namesCacheData = ((famRes.status === "success") ? mergeFamilySheetIntoNames(res.data, famRes.data) : res.data).map(sanitizeRecordFields); } catch(e) {} }
    buildChartsStageTabs();

    let allowedRecords = rawData.filter(item => {
        const grd = normalizeArabic(item["Grade"]), cls = normalizeArabic(item["ClassName"]);
        if (!isStageAllowedForUser(item["Stage"], currentUser)) return false;
        if (currentUser.Role === "Class_Servant") {
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
    const allowedStages = getUserAllowedStages(currentUser);
    stageSel.innerHTML = `<option value="">اختر المرحلة...</option>` + allowedStages.map(s => `<option value="${s}">${s}</option>`).join('');
    if (allowedStages.length === 1) {
        stageSel.value = allowedStages[0]; stageSel.disabled = true; updatePrintGradesDropdown(allowedStages[0]);
        if (currentUser.AssignedGrade && currentUser.AssignedGrade !== "الكل") { const grd = document.getElementById('ssPrintGrade'); if (grd) grd.value = currentUser.AssignedGrade; }
    } else stageSel.disabled = false;
    modal.classList.remove('hidden');
}
function closeSundaySchoolPrintModal() { document.getElementById('ssPrintModal')?.classList.add('hidden'); }
function updatePrintGradesDropdown(stage) { const grdSel = document.getElementById('ssPrintGrade'); if (grdSel) grdSel.innerHTML = `<option value="">كل الصفوف</option>` + (STAGE_GRADES[stage] || []).map(g => `<option value="${g}">${g}</option>`).join(''); }

async function generateAndPrintClassRoster() {
    const stage = document.getElementById('ssPrintStage')?.value || "", grade = document.getElementById('ssPrintGrade')?.value || "", genderFilter = document.getElementById('ssPrintGender')?.value || "";
    if (!stage) { alert("يرجى اختيار المرحلة الدراسية أولاً!"); return; }
    let membersList = namesCacheData;
    if (membersList.length === 0) { try { const res = await apiFetch(`${API_URL}?sheet=Names`); if (res.status === "success") membersList = res.data.map(sanitizeRecordFields); } catch(e) {} }
    const classKids = membersList.filter(item => {
        if (isMemberDeceased(item) || item["مدارس الأحد"] === "غير مشترك") return false;
        if (normalizeArabic(item["المرحلة"]) !== normalizeArabic(stage)) return false;
        if (grade && normalizeArabic(item["الصف"]) !== normalizeArabic(grade)) return false;
        if (genderFilter && normalizeGender(item["ذكر/انثي"]) !== genderFilter) return false;
        return true;
    }).sort((a, b) => String(a["الاسم ثلاثي"]).localeCompare(String(b["الاسم ثلاثي"]), 'ar'));
    
    if (classKids.length === 0) { alert("لم يتم العثور على مخدومين مسجلين بهذه المواصفات!"); return; }
    closeSundaySchoolPrintModal();
    
    const genderLabel = genderFilter === 'ذكر' ? ' (بنين)' : genderFilter === 'انثي' ? ' (بنات)' : ' (مجمّع)';
    let text = `*كشف حضور مدارس الأحد${genderLabel}*
المرحلة: ${stage} ${grade ? '| '+grade : ''}

`;
    classKids.forEach((kid, idx) => {
        text += `${idx + 1}. *${kid["الاسم ثلاثي"]}*
📞 ${kid["تليفون العمل/المحمول"] || "-"}
──────────
`;
    });
    shareToWhatsApp(text);
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

function isSundaySchoolMeetingServant(s) {
    if (!s) return false;
    const status = String(s["Status"] || "").trim();
    const username = String(s["Username"] || "").trim().toLowerCase();
    const role = String(s["Role"] || "").trim();
    if (status === "موقوف" || username === "admin" || role === "Admin") return false;

    const stageNorm = normalizeArabic(s["AssignedStage"] || "");
    const classNorm = normalizeArabic(s["AssignedClass"] || "");

    // استبعاد كهنة وخدام الجامعة والخريجين والشباب
    if (stageNorm.includes("جامع") || stageNorm.includes("خريج") || stageNorm.includes("شباب")) return false;

    // استبعاد خدام القطاعات والخدمات الأخرى خارج مدارس الأحد
    const excludedSectors = ["المرضي", "السيدات", "الكشافه", "الكورال", "المسرح", "الكرازه", "الشمامسه", "الشباب", "الجامعه", "الخريجين"];
    if (excludedSectors.some(sec => classNorm.includes(sec))) return false;

    return true;
}

function getMeetingStageOrder(stageStr) {
    const st = normalizeArabic(stageStr || "");
    if (st.includes("حضانه وابتدائي") || st.includes("مدارس الاحد")) return 0;
    if (st.includes("حضانه")) return 1;
    if (st.includes("ابتدائي")) return 2;
    if (st.includes("اعدادي")) return 3;
    if (st.includes("ثانوي")) return 4;
    return 9;
}

function getMeetingGradeOrder(stageStr, gradeStr) {
    const gNorm = normalizeArabic(gradeStr || "");
    if (!gNorm || gNorm === "الكل") return 0;
    const allGrades = Object.values(STAGE_GRADES).flat();
    const idx = allGrades.findIndex(g => normalizeArabic(g) === gNorm);
    return idx >= 0 ? idx + 1 : 99;
}

function getServantMeetingRank(s, origIdx) {
    const role = String(s["Role"] || "").trim();
    const stageNorm = normalizeArabic(s["AssignedStage"] || "");
    const isSSStage = ["حضانه", "ابتدائي", "اعدادي", "ثانوي"].some(st => stageNorm.includes(st));

    // 1. الآباء الكهنة (بنفس ترتيب الشيت)
    if (role === "Priest" || isPriestUser(s)) {
        return { group: 1, stageOrd: 0, gradeOrd: 0, origIdx };
    }
    // 2. أمين عام الخدمة
    if (role === "SundaySchool_Admin") {
        return { group: 2, stageOrd: 0, gradeOrd: 0, origIdx };
    }
    // 3. أمناء خدمة المراحل
    if (role === "Stage_Leader") {
        return { group: 3, stageOrd: getMeetingStageOrder(s["AssignedStage"]), gradeOrd: 0, origIdx };
    }
    // 4. خدام الفصول (حضانة -> ابتدائي -> إعدادي -> ثانوي، ومرتبين بالصفوف)
    if (isSSStage) {
        return {
            group: 4,
            stageOrd: getMeetingStageOrder(s["AssignedStage"]),
            gradeOrd: getMeetingGradeOrder(s["AssignedStage"], s["AssignedGrade"]),
            origIdx
        };
    }
    // 5. الخدام غير المكلفين بفصول (التابعون لمدارس الأحد مثل الافتقاد والخدمة المعاونة)
    return { group: 5, stageOrd: 9, gradeOrd: 99, origIdx };
}

async function initServantsMeetingLiveView() {
    const dateInput = document.getElementById('servantsMeetingDate'), now = new Date();
    if (dateInput) dateInput.value = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
    if (servantsCacheData.length === 0) { try { const res = await apiFetch(`${API_URL}?sheet=Servants`); if (res.status === "success") servantsCacheData = res.data; } catch(e) {} }
    if (namesCacheData.length === 0) { try { const [res, famRes] = await Promise.all([apiFetch(`${API_URL}?sheet=Names`), apiFetch(`${API_URL}?sheet=${encodeURIComponent("Family name")}`).catch(() => ({ status: "err" }))]); if (res.status === "success") namesCacheData = ((famRes.status === "success") ? mergeFamilySheetIntoNames(res.data, famRes.data) : res.data).map(sanitizeRecordFields); } catch(e) {} }

    const activeServants = servantsCacheData
        .map((s, idx) => ({ s, idx }))
        .filter(({ s }) => isSundaySchoolMeetingServant(s));

    currentServantsMeetingList = activeServants.map(({ s, idx }) => {
        const member = namesCacheData.find(m => normalizeArabic(m["الاسم ثلاثي"]) === normalizeArabic(s["ServantName"]));
        let realPhone = (member && member["تليفون العمل/المحمول"]) ? member["تليفون العمل/المحمول"] : (/^\d+$/.test(s["Username"]) ? s["Username"] : "-");
        const rank = getServantMeetingRank(s, idx);
        return {
            id: s["ID"] || s[Object.keys(s)[0]],
            name: s["ServantName"],
            phone: realPhone,
            role: s["Role"] || "خادم",
            scope: `${s["AssignedStage"] || "الكل"} ${s["AssignedGrade"] ? '- ' + s["AssignedGrade"] : ''} ${s["AssignedClass"] ? '(' + s["AssignedClass"] + ')' : ''}`,
            status: "حاضر",
            notes: "",
            _rank: rank
        };
    }).sort((a, b) => {
        if (a._rank.group !== b._rank.group) return a._rank.group - b._rank.group;
        if (a._rank.group === 1) return a._rank.origIdx - b._rank.origIdx;
        if (a._rank.stageOrd !== b._rank.stageOrd) return a._rank.stageOrd - b._rank.stageOrd;
        if (a._rank.gradeOrd !== b._rank.gradeOrd) return a._rank.gradeOrd - b._rank.gradeOrd;
        return String(a.name || "").localeCompare(String(b.name || ""), 'ar');
    });
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
    if (currentServantsMeetingList.length === 0) { alert("لا يوجد خدام في الكشف للمشاركة!"); return; }
    let text = `*كشف حضور: ${meetingName}*
التاريخ: ${meetingDate}

`;
    currentServantsMeetingList.forEach((s, idx) => {
        let statusIcon = s.status === 'حاضر' ? '✅' : s.status === 'معتذر' ? '⚠️' : '❌';
        text += `${idx + 1}. *${s.name}* ${statusIcon}
`;
        if (s.notes) text += `📌 ملاحظة: ${s.notes}
`;
    });
    shareToWhatsApp(text);
}

function openAddServantQuickModal() { currentTab = 'Servants'; openModal('add'); }
async function populateServantsDatalist() {
    if (namesCacheData.length === 0) { try { const [res, famRes] = await Promise.all([apiFetch(`${API_URL}?sheet=Names`), apiFetch(`${API_URL}?sheet=${encodeURIComponent("Family name")}`).catch(() => ({ status: "err" }))]); if (res.status === "success") namesCacheData = ((famRes.status === "success") ? mergeFamilySheetIntoNames(res.data, famRes.data) : res.data).map(sanitizeRecordFields); } catch(e) {} }
    const dl = document.getElementById('servantsNamesList'); if (dl) dl.innerHTML = namesCacheData.filter(m => !isMemberDeceased(m)).map(m => `<option value="${m['الاسم ثلاثي']}">`).join('');
}
function onServantNameSelected(selectedName) {
    const member = namesCacheData.find(m => m["الاسم ثلاثي"] === selectedName), usernameInput = document.querySelector('input[name="Username"]');
    if (member && usernameInput && !usernameInput.value && member["تليفون العمل/المحمول"]) usernameInput.value = member["تليفون العمل/المحمول"];
}

// 10. قسم الافتقاد والمتابعة الرعوية الذكي (حسب الصلاحية: كاهن/أدمن بالمناطق والأسر والأفراد، أمين مرحلة، خادم فصل)
let currentVisitAchievementRows = [];
let currentVisitAchievementMode = "area"; // "area" for Priest/Admin, "stage" for Stage_Leader/SS_Admin/Class_Servant
const debouncedRenderVisitWorkspace = createDebounce(() => renderVisitationWorkspace(), 150);
function onVisitSearchInput() { debouncedRenderVisitWorkspace(); }

function isPriestOrAdminUser() {
    return currentUser && (currentUser.Role === "Admin" || currentUser.Role === "Priest" || isPriestUser(currentUser));
}

function switchVisitationsView(view) {
    currentVisitView = view;
    const btnDash = document.getElementById('btnVisitDashboard');
    const btnRep = document.getElementById('btnVisitReports');
    const btnHist = document.getElementById('btnVisitHistory');
    const dashSec = document.getElementById('visitationDashboardSection');
    const repSec = document.getElementById('visitationReportsSection');
    const cardsSec = document.getElementById('standardCardsContainer');
    const searchSec = document.getElementById('standardSearchContainer');
    const btnAdd = document.getElementById('btnAddNewRecord');
    const btnPrint = document.getElementById('btnPrintVisitReport');
    const btnPdf = document.getElementById('btnPdfVisitReport');

    [btnDash, btnRep, btnHist].forEach(b => {
        if (b) b.className = "px-3.5 py-2 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
    });
    dashSec?.classList.add('hidden');
    repSec?.classList.add('hidden');
    cardsSec?.classList.add('hidden');
    searchSec?.classList.add('hidden');
    btnAdd?.classList.add('hidden');
    btnPrint?.classList.add('hidden');
    btnPdf?.classList.add('hidden');

    if (view === 'dashboard') {
        if (btnDash) btnDash.className = "px-3.5 py-2 rounded-lg text-xs font-black transition bg-white text-rose-700 shadow-sm";
        dashSec?.classList.remove('hidden');
        btnPrint?.classList.remove('hidden');
        btnPdf?.classList.remove('hidden');
        initVisitationsDashboard();
    } else if (view === 'reports') {
        if (btnRep) btnRep.className = "px-3.5 py-2 rounded-lg text-xs font-black transition bg-white text-rose-700 shadow-sm";
        repSec?.classList.remove('hidden');
        initVisitationsReportsView();
    } else {
        if (btnHist) btnHist.className = "px-3.5 py-2 rounded-lg text-xs font-black transition bg-white text-rose-700 shadow-sm";
        cardsSec?.classList.remove('hidden');
        searchSec?.classList.remove('hidden');
        btnAdd?.classList.remove('hidden');
        renderStandardCards();
    }
}

async function ensureVisitationBaseDataLoaded() {
    if (namesCacheData.length === 0) {
        try {
            const [res, famRes] = await Promise.all([
                apiFetch(`${API_URL}?sheet=Names`),
                apiFetch(`${API_URL}?sheet=${encodeURIComponent("Family name")}`).catch(() => ({ status: "err" }))
            ]);
            if (res.status === "success") {
                namesCacheData = ((famRes.status === "success") ? mergeFamilySheetIntoNames(res.data, famRes.data) : res.data).map(sanitizeRecordFields);
            }
        } catch (e) {}
    }
    if (visitationsData.length === 0) {
        try {
            const res = await apiFetch(`${API_URL}?sheet=Visitations`);
            if (res.status === "success") visitationsData = res.data.map(sanitizeRecordFields);
        } catch (e) {}
    }
}

async function initVisitationsDashboard() {
    await ensureVisitationBaseDataLoaded();

    const priestFilters = document.getElementById('visitPriestFilters');
    const servantFilters = document.getElementById('visitServantFilters');
    const titleEl = document.getElementById('visitWorkspaceTitle');
    const subEl = document.getElementById('visitWorkspaceSubtitle');
    const badgeEl = document.getElementById('visitScopeBadge');

    if (isPriestOrAdminUser()) {
        priestFilters?.classList.remove('hidden');
        servantFilters?.classList.add('hidden');
        if (titleEl) titleEl.innerHTML = `<span>🎯</span> افتقاد الأسر والأفراد حسب المنطقة`;
        if (subEl) subEl.innerText = "اختر المنطقة السكنية أو ابحث باسم الأسرة أو الفرد وسجّل الزيارة أو المكالمة فوراً";
        if (badgeEl) badgeEl.innerText = "نطاق الصلاحية: الكنيسة بالكامل";

        // تعبئة قائمة المناطق السكنية
        const areaSel = document.getElementById('visitFilterArea');
        if (areaSel) {
            const prev = areaSel.value;
            const areasSet = new Set();
            namesCacheData.forEach(m => {
                const a = getMemberArea(m);
                if (a && a !== "-" && a.length > 1) areasSet.add(a);
            });
            const sortedAreas = Array.from(areasSet).sort((a, b) => a.localeCompare(b, 'ar'));
            areaSel.innerHTML = `<option value="">كل المناطق السكنية (${sortedAreas.length})</option>` + sortedAreas.map(a => `<option value="${a}">${a}</option>`).join('');
            if (prev && sortedAreas.includes(prev)) areaSel.value = prev;
        }
    } else {
        priestFilters?.classList.add('hidden');
        servantFilters?.classList.remove('hidden');
        const allowedStages = getUserAllowedStages(currentUser);
        const stageSel = document.getElementById('visitSSStage');

        if (currentUser.Role === "Class_Servant") {
            if (titleEl) titleEl.innerHTML = `<span>🎯</span> افتقاد مخدومي فصلي`;
            if (subEl) subEl.innerText = "سجّل الافتقاد التليفوني أو الزيارة المنزلية لأبناء فصلك بضغطة واحدة";
            if (badgeEl) badgeEl.innerText = `فصل: ${currentUser.AssignedStage || ''} ${currentUser.AssignedGrade ? '- ' + currentUser.AssignedGrade : ''} ${currentUser.AssignedClass ? '(' + currentUser.AssignedClass + ')' : ''}`;
        } else {
            if (titleEl) titleEl.innerHTML = `<span>🎯</span> افتقاد ومتابعة المرحلة`;
            if (subEl) subEl.innerText = "متابعة افتقاد مخدومي المرحلة وتسجيل الزيارات والمكالمات";
            if (badgeEl) badgeEl.innerText = `نطاق الصلاحية: ${currentUser.AssignedStage || 'الكل'}`;
        }

        if (stageSel) {
            stageSel.innerHTML = allowedStages.map(s => `<option value="${s}">${s}</option>`).join('');
            if (allowedStages.length === 1) {
                stageSel.value = allowedStages[0];
                stageSel.disabled = true;
            } else {
                stageSel.disabled = false;
            }
            onVisitSSStageChange(stageSel.value);
            renderVisitationFollowups();
            return;
        }
    }

    renderVisitationFollowups();
    renderVisitationWorkspace();
}

function onVisitSSStageChange(stage) {
    const grdSel = document.getElementById('visitSSGrade');
    if (grdSel) {
        grdSel.innerHTML = `<option value="">كل الصفوف</option>` + (STAGE_GRADES[stage] || []).map(g => `<option value="${g}">${g}</option>`).join('');
        if (currentUser.Role === "Class_Servant" && currentUser.AssignedGrade && currentUser.AssignedGrade !== "الكل") {
            grdSel.value = currentUser.AssignedGrade;
            grdSel.disabled = true;
        } else {
            grdSel.disabled = false;
        }
    }
    renderVisitationWorkspace();
}

function getLatestVisitRecordForMember(memberId, memberName, familyHead = "") {
    if (!visitationsData || visitationsData.length === 0) return null;
    const normM = normalizeArabic(memberName);
    const normH = normalizeArabic(familyHead);
    const matched = visitationsData.filter(v => {
        const vId = String(v["MemberID"] || "").trim();
        const vName = normalizeArabic(v["MemberName"]);
        if (memberId && vId && vId === String(memberId).trim()) return true;
        if (normM && vName === normM) return true;
        if (normH && vName === normH) return true;
        return false;
    });
    if (matched.length === 0) return null;
    matched.sort((a, b) => parseDateForSort(b["VisitDate"]) - parseDateForSort(a["VisitDate"]));
    return matched[0];
}

function renderVisitationWorkspace() {
    const listEl = document.getElementById('visitUrgentList');
    const countBadge = document.getElementById('visitUrgentCount');
    const headingEl = document.getElementById('visitListHeading');
    if (!listEl) return;
    listEl.innerHTML = "";

    const now = new Date();
    const cards = [];

    if (isPriestOrAdminUser()) {
        const areaQ = (document.getElementById('visitFilterArea')?.value || "").trim();
        const searchQ = normalizeArabic(document.getElementById('visitSearchInput')?.value || "").toLowerCase();
        const targetMode = document.getElementById('visitTargetMode')?.value || "families";
        const statusFilter = document.getElementById('visitStatusFilterPriest')?.value || "overdue";

        if (targetMode === "families") {
            const familiesMap = {};
            namesCacheData.forEach(m => {
                if (isMemberDeceased(m)) return;
                const head = String(m["اسم رب الاسرة"] || "").trim();
                if (!head) return;
                if (!familiesMap[head]) familiesMap[head] = [];
                familiesMap[head].push(m);
            });

            Object.keys(familiesMap).forEach(headName => {
                const members = familiesMap[headName];
                const headRec = members.find(m => m["الاسم ثلاثي"] === headName || m["صلة القرابة"] === "زوج") || members[0];
                const area = getMemberArea(headRec) || members.map(m => getMemberArea(m)).find(Boolean) || "غير محددة";
                if (areaQ && normalizeArabic(area) !== normalizeArabic(areaQ)) return;

                if (searchQ) {
                    const blob = normalizeArabic(headName + " " + members.map(m => `${m["الاسم ثلاثي"]} ${m["تليفون العمل/المحمول"] || ""}`).join(" ")).toLowerCase();
                    if (!blob.includes(searchQ)) return;
                }

                const lastDateStr = getLastFamilyVisitDate(members);
                const isNever = (lastDateStr === "لم يُفتقد بعد" || lastDateStr === "لا يوجد سجل");
                const daysSince = isNever ? 9999 : Math.floor((now - parseDateForSort(lastDateStr)) / (1000 * 60 * 60 * 24));
                const isOverdue = isNever || daysSince > 90;

                if (statusFilter === "overdue" && !isOverdue) return;
                if (statusFilter === "visited" && isOverdue) return;

                cards.push({
                    id: headRec?.["ID"] || "",
                    name: headName,
                    sub: `🏠 أسرة (${members.length} أفراد) | 📍 ${area}`,
                    phone: headRec?.["هاتف الاسرة"] || headRec?.["تليفون العمل/المحمول"] || "-",
                    lastDateStr: isNever ? "لم تُفتقد بعد" : lastDateStr,
                    daysSince,
                    isOverdue,
                    area
                });
            });
            if (headingEl) headingEl.innerText = areaQ ? `أسر منطقة: ${areaQ}` : "قائمة افتقاد الأسر";
        } else {
            namesCacheData.forEach(m => {
                if (isMemberDeceased(m)) return;
                const area = getMemberArea(m) || "غير محددة";
                if (areaQ && normalizeArabic(area) !== normalizeArabic(areaQ)) return;
                if (searchQ) {
                    const idx = getSearchIndex(m);
                    if (!idx.name.includes(searchQ) && !idx.head.includes(searchQ) && !idx.phone.includes(searchQ)) return;
                }
                const latestV = getLatestVisitRecordForMember(m["ID"], m["الاسم ثلاثي"], m["اسم رب الاسرة"]);
                const isNever = !latestV;
                const daysSince = isNever ? 9999 : Math.floor((now - parseDateForSort(latestV["VisitDate"])) / (1000 * 60 * 60 * 24));
                const isOverdue = isNever || daysSince > 90;

                if (statusFilter === "overdue" && !isOverdue) return;
                if (statusFilter === "visited" && isOverdue) return;

                cards.push({
                    id: m["ID"] || "",
                    name: m["الاسم ثلاثي"] || "-",
                    sub: `🏠 أسرة: ${m["اسم رب الاسرة"] || "-"} | 📍 ${area}`,
                    phone: m["تليفون العمل/المحمول"] || m["هاتف الاسرة"] || "-",
                    lastDateStr: isNever ? "لم يُفتقد بعد" : `${latestV["VisitDate"]} (${latestV["VisitType"] || ""})`,
                    daysSince,
                    isOverdue,
                    area
                });
            });
            if (headingEl) headingEl.innerText = areaQ ? `أفراد منطقة: ${areaQ}` : "قائمة افتقاد الأفراد";
        }
    } else {
        // خادم فصل أو أمين مرحلة أو أمين عام مدارس الأحد
        const stage = document.getElementById('visitSSStage')?.value || "";
        const grade = document.getElementById('visitSSGrade')?.value || "";
        const searchQ = normalizeArabic(document.getElementById('visitSSSearchInput')?.value || "").toLowerCase();
        const statusFilter = document.getElementById('visitStatusFilterSS')?.value || "all";
        const assignedClsNorm = normalizeArabic(currentUser.AssignedClass || "");
        const forcedGender = (currentUser.Role === "Class_Servant" || currentUser.Role === "Stage_Leader")
            ? (assignedClsNorm === "بنين" ? "ذكر" : assignedClsNorm === "بنات" ? "انثي" : "")
            : "";

        namesCacheData.forEach(kid => {
            if (isMemberDeceased(kid) || kid["مدارس الأحد"] === "غير مشترك") return;
            if (stage && normalizeArabic(kid["المرحلة"]) !== normalizeArabic(stage)) return;
            if (grade && normalizeArabic(kid["الصف"]) !== normalizeArabic(grade)) return;
            if (forcedGender && normalizeGender(kid["ذكر/انثي"]) !== forcedGender) return;
            if (searchQ) {
                const idx = getSearchIndex(kid);
                if (!idx.name.includes(searchQ) && !idx.head.includes(searchQ) && !idx.phone.includes(searchQ)) return;
            }

            const latestV = getLatestVisitRecordForMember(kid["ID"], kid["الاسم ثلاثي"], kid["اسم رب الاسرة"]);
            const isNever = !latestV;
            const daysSince = isNever ? 9999 : Math.floor((now - parseDateForSort(latestV["VisitDate"])) / (1000 * 60 * 60 * 24));
            const isOverdue = isNever || daysSince > 30;

            if (statusFilter === "overdue" && !isOverdue) return;
            if (statusFilter === "visited" && isOverdue) return;

            cards.push({
                id: kid["ID"] || "",
                name: kid["الاسم ثلاثي"] || "-",
                sub: `🎓 ${kid["المرحلة"] || ""} - ${kid["الصف"] || ""} | 🏠 ${kid["اسم رب الاسرة"] || "-"}`,
                phone: kid["تليفون العمل/المحمول"] || kid["هاتف الاسرة"] || "-",
                lastDateStr: isNever ? "لم يُفتقد بعد" : `${latestV["VisitDate"]} (${latestV["VisitType"] || ""})`,
                daysSince,
                isOverdue,
                area: getMemberArea(kid) || "-"
            });
        });
        if (headingEl) headingEl.innerText = `قائمة افتقاد: ${stage} ${grade ? '- ' + grade : ''}`;
    }

    cards.sort((a, b) => b.daysSince - a.daysSince || a.name.localeCompare(b.name, 'ar'));
    if (countBadge) countBadge.innerText = `${cards.length}`;
    const recCount = document.getElementById('recordCount');
    if (recCount) recCount.innerText = `${cards.length} حالة`;

    if (cards.length === 0) {
        listEl.innerHTML = `<div class="md:col-span-2 text-center text-slate-400 font-bold py-12">لا توجد حالات مطابقة للبحث أو الفلتر المحدد.</div>`;
        return;
    }

    const slice = cards.slice(0, 80);
    let html = slice.map(rec => {
        const delayLabel = rec.daysSince === 9999 ? "لم يُفتقد أبدًا" : (rec.isOverdue ? `متأخر منذ ${rec.daysSince} يوم` : `تم منذ ${rec.daysSince} يوم`);
        const badgeCls = rec.isOverdue ? "bg-rose-50 text-rose-700 border-rose-200" : "bg-emerald-50 text-emerald-700 border-emerald-200";
        const safeName = rec.name.replace(/'/g, "\'");
        return `
            <div class="bg-slate-50/70 p-3.5 rounded-2xl border ${rec.isOverdue ? 'border-rose-200' : 'border-slate-200'} flex flex-col justify-between gap-2.5">
                <div class="flex justify-between items-start gap-2">
                    <div class="min-w-0">
                        <h4 class="text-sm font-black text-slate-800 truncate">${rec.name}</h4>
                        <p class="text-[11px] text-slate-500 font-semibold mt-0.5">${rec.sub}</p>
                        <p class="text-[11px] text-slate-600 font-mono mt-0.5" dir="ltr">📞 ${rec.phone}</p>
                    </div>
                    <span class="shrink-0 text-[10px] font-black px-2 py-0.5 rounded-full border ${badgeCls}">${delayLabel}</span>
                </div>
                <div class="flex items-center justify-between gap-2 pt-2 border-t border-slate-200/70 flex-wrap">
                    <div class="flex items-center gap-1.5">${renderContactButtons(rec.phone)}</div>
                    <div class="flex items-center gap-1.5">
                        <button type="button" onclick="quickAddVisitation('${rec.id}', '${safeName}', 'تليفوني')" class="bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 px-2.5 py-1.5 rounded-xl text-[11px] font-black transition cursor-pointer">📞 تليفوني</button>
                        <button type="button" onclick="quickAddVisitation('${rec.id}', '${safeName}', 'منزلي')" class="bg-rose-50 hover:bg-rose-600 text-rose-700 hover:text-white border border-rose-200 px-2.5 py-1.5 rounded-xl text-[11px] font-black transition cursor-pointer">🏠 منزلي</button>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    if (cards.length > 80) {
        html += `<div class="md:col-span-2 text-center py-2 text-[11px] text-slate-500 font-bold">يتم عرض أول 80 نتيجة من إجمالي ${cards.length} — استخدم البحث أو المنطقة للتخصيص</div>`;
    }
    listEl.innerHTML = html;
}

function renderVisitationFollowups() {
    const banner = document.getElementById('visitFollowupBanner');
    const followupList = document.getElementById('visitFollowupList');
    const countBadge = document.getElementById('visitFollowupCount');
    if (!followupList || !banner) return;

    const now = new Date(); now.setHours(0, 0, 0, 0);
    const nextWeek = new Date(now.getTime() + (7 * 24 * 60 * 60 * 1000));

    const upcoming = visitationsData.filter(v => {
        const dStr = String(v["FollowUpDate"] || "").trim();
        if (!dStr || dStr === "-") return false;
        const fDate = parseDateForSort(dStr);
        if (!(fDate >= now && fDate <= nextWeek)) return false;
        if (!isPriestOrAdminUser() && currentUser?.Role === "Class_Servant") {
            return normalizeArabic(v["VisitorName"]) === normalizeArabic(currentUser.ServantName);
        }
        return true;
    }).sort((a, b) => parseDateForSort(a.FollowUpDate) - parseDateForSort(b.FollowUpDate));

    if (countBadge) countBadge.innerText = upcoming.length;
    if (upcoming.length === 0) {
        banner.classList.add('hidden');
        return;
    }
    banner.classList.remove('hidden');
    followupList.innerHTML = upcoming.map(rec => `
        <div class="bg-white p-3 rounded-xl border border-indigo-200 flex justify-between items-center gap-2">
            <div>
                <h4 class="text-xs sm:text-sm font-black text-slate-800">${rec.MemberName}</h4>
                <p class="text-[11px] text-slate-500 font-semibold">👤 ${rec.VisitorName} | 🗓️ <strong class="text-indigo-700">${rec.FollowUpDate}</strong></p>
            </div>
            <button onclick="quickAddVisitation('${rec.MemberID}', '${String(rec.MemberName || '').replace(/'/g, "\'")}', '${rec.VisitType || 'منزلي'}')" class="bg-indigo-50 text-indigo-700 hover:bg-indigo-600 hover:text-white px-3 py-1.5 rounded-xl text-[11px] font-black transition shrink-0">+ متابعة</button>
        </div>
    `).join('');
}

function quickAddVisitation(memberId, memberName, visitType = "منزلي") {
    currentTab = 'Visitations';
    openModal('add');
    setTimeout(() => {
        const idInp = document.querySelector('input[name="MemberID"]');
        const nameInp = document.querySelector('input[name="MemberName"]');
        const dateInp = document.querySelector('input[name="VisitDate"]');
        const visitorInp = document.querySelector('input[name="VisitorName"]');
        const typeSel = document.querySelector('select[name="VisitType"]');
        const notesInp = document.querySelector('textarea[name="Notes"]');
        if (idInp) idInp.value = memberId;
        if (nameInp) nameInp.value = memberName;
        const now = new Date();
        if (dateInp) dateInp.value = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;
        if (visitorInp && currentUser) visitorInp.value = currentUser.ServantName;
        if (typeSel && visitType) typeSel.value = visitType;
        if (notesInp) notesInp.focus();
    }, 80);
}

// ==================== تقارير إنجاز الافتقاد (بالمناطق للكهنة/الأدمن، وبالمراحل والخدام لمدارس الأحد) ====================
async function initVisitationsReportsView() {
    await ensureVisitationBaseDataLoaded();
    renderVisitationReports();
}

function isVisitInSelectedPeriod(visitDateStr, period) {
    if (period === "all") return true;
    const formatted = formatDisplayDate(visitDateStr);
    if (!formatted) return false;
    const dt = parseDateForSort(formatted);
    if (isNaN(dt.getTime()) || dt.getTime() <= 0) return false;
    const now = new Date();
    if (period === "month") {
        return dt.getFullYear() === now.getFullYear() && dt.getMonth() === now.getMonth();
    }
    if (period === "3months") {
        const diffDays = (now - dt) / (1000 * 60 * 60 * 24);
        return diffDays >= 0 && diffDays <= 92;
    }
    if (period === "year") {
        return dt.getFullYear() === now.getFullYear();
    }
    return true;
}

function renderVisitationReports() {
    const period = document.getElementById('visitReportPeriod')?.value || "3months";
    const kpiEl = document.getElementById('visitRepKpiCards');
    const tablesEl = document.getElementById('visitRepTablesContainer');
    const titleEl = document.getElementById('visitRepMainTitle');
    const subEl = document.getElementById('visitRepSubTitle');
    if (!tablesEl) return;

    const periodVisits = visitationsData.filter(v => isVisitInSelectedPeriod(v["VisitDate"], period));

    if (isPriestOrAdminUser()) {
        currentVisitAchievementMode = "area";
        if (titleEl) titleEl.innerHTML = `<span>📊</span> تقرير إنجاز الافتقاد مقسّماً بالمناطق السكنية`;
        if (subEl) subEl.innerText = "يوضح عدد الأسر بكل منطقة، وما تم افتقاده (منزلي / تليفوني)، ونسبة الإنجاز";

        // تجميع الأسر حسب المنطقة
        const areaStats = {};
        const familyToArea = {};
        const memberIdToFamily = {};
        const memberNameToFamily = {};

        namesCacheData.forEach(m => {
            if (isMemberDeceased(m)) return;
            const head = String(m["اسم رب الاسرة"] || "").trim();
            if (!head) return;
            const normH = normalizeArabic(head);
            const area = getMemberArea(m) || familyToArea[normH] || "غير محددة";
            if (!familyToArea[normH] || familyToArea[normH] === "غير محددة") familyToArea[normH] = area;
            if (m["ID"]) memberIdToFamily[String(m["ID"]).trim()] = normH;
            if (m["الاسم ثلاثي"]) memberNameToFamily[normalizeArabic(m["الاسم ثلاثي"])] = normH;
        });

        Object.keys(familyToArea).forEach(normH => {
            const area = familyToArea[normH] || "غير محددة";
            if (!areaStats[area]) {
                areaStats[area] = { area, totalFamilies: 0, visitedFamiliesSet: new Set(), homeCount: 0, phoneCount: 0, otherCount: 0 };
            }
            areaStats[area].totalFamilies++;
        });

        let totalHome = 0, totalPhone = 0;
        periodVisits.forEach(v => {
            const vId = String(v["MemberID"] || "").trim();
            const vName = normalizeArabic(v["MemberName"]);
            const famKey = (vId && memberIdToFamily[vId]) || memberNameToFamily[vName] || (familyToArea[vName] ? vName : null);
            const area = famKey ? (familyToArea[famKey] || "غير محددة") : "غير محددة";
            if (!areaStats[area]) {
                areaStats[area] = { area, totalFamilies: 0, visitedFamiliesSet: new Set(), homeCount: 0, phoneCount: 0, otherCount: 0 };
            }
            if (famKey) areaStats[area].visitedFamiliesSet.add(famKey);
            const vType = String(v["VisitType"] || "").trim();
            if (vType.includes("تليفون")) { areaStats[area].phoneCount++; totalPhone++; }
            else if (vType.includes("منزل")) { areaStats[area].homeCount++; totalHome++; }
            else { areaStats[area].otherCount++; }
        });

        const rows = Object.values(areaStats).map(a => {
            const visited = a.visitedFamiliesSet.size;
            const remaining = Math.max(0, a.totalFamilies - visited);
            const pct = a.totalFamilies > 0 ? Math.round((visited / a.totalFamilies) * 100) : 0;
            return {
                label: a.area,
                total: a.totalFamilies,
                visited,
                remaining,
                homeCount: a.homeCount,
                phoneCount: a.phoneCount,
                totalVisits: a.homeCount + a.phoneCount + a.otherCount,
                pct
            };
        }).sort((a, b) => b.total - a.total);

        currentVisitAchievementRows = rows;
        const sumFamilies = rows.reduce((acc, r) => acc + r.total, 0);
        const sumVisited = rows.reduce((acc, r) => acc + r.visited, 0);
        const overallPct = sumFamilies > 0 ? Math.round((sumVisited / sumFamilies) * 100) : 0;

        if (kpiEl) {
            kpiEl.innerHTML = `
                <div class="bg-white/95 p-4 rounded-2xl border border-slate-200 shadow-sm text-center"><span class="block text-xs font-bold text-slate-500 mb-1">إجمالي الأسر</span><span class="text-2xl font-black text-slate-800">${sumFamilies}</span></div>
                <div class="bg-white/95 p-4 rounded-2xl border border-emerald-200 shadow-sm text-center"><span class="block text-xs font-bold text-slate-500 mb-1">أسر تم افتقادها</span><span class="text-2xl font-black text-emerald-600">${sumVisited}</span><span class="block text-[11px] font-bold text-slate-400">نسبة الإنجاز: ${overallPct}%</span></div>
                <div class="bg-white/95 p-4 rounded-2xl border border-rose-200 shadow-sm text-center"><span class="block text-xs font-bold text-slate-500 mb-1">زيارات منزلية</span><span class="text-2xl font-black text-rose-600">${totalHome}</span></div>
                <div class="bg-white/95 p-4 rounded-2xl border border-blue-200 shadow-sm text-center"><span class="block text-xs font-bold text-slate-500 mb-1">افتقاد تليفوني</span><span class="text-2xl font-black text-blue-600">${totalPhone}</span></div>
            `;
        }

        tablesEl.innerHTML = `
            <div class="bg-white/95 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="overflow-x-auto nice-scrollbar">
                    <table class="w-full text-right text-xs">
                        <thead class="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                            <tr>
                                <th class="p-3 w-10 text-center">م</th>
                                <th class="p-3">المنطقة السكنية</th>
                                <th class="p-3 text-center">إجمالي الأسر</th>
                                <th class="p-3 text-center text-emerald-700">تم افتقادها</th>
                                <th class="p-3 text-center text-rose-700">متبقي</th>
                                <th class="p-3 text-center">🏠 منزلي</th>
                                <th class="p-3 text-center">📞 تليفوني</th>
                                <th class="p-3 text-center">نسبة الإنجاز</th>
                            </tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-bold">
                            ${rows.map((r, idx) => `
                                <tr class="hover:bg-slate-50">
                                    <td class="p-3 text-center text-slate-400">${idx + 1}</td>
                                    <td class="p-3 font-black text-slate-800">${r.label}</td>
                                    <td class="p-3 text-center">${r.total}</td>
                                    <td class="p-3 text-center text-emerald-700">${r.visited}</td>
                                    <td class="p-3 text-center text-rose-600">${r.remaining}</td>
                                    <td class="p-3 text-center">${r.homeCount}</td>
                                    <td class="p-3 text-center">${r.phoneCount}</td>
                                    <td class="p-3 text-center">
                                        <span class="px-2.5 py-0.5 rounded-lg font-black ${r.pct >= 70 ? 'bg-emerald-50 text-emerald-700' : r.pct >= 30 ? 'bg-amber-50 text-amber-800' : 'bg-rose-50 text-rose-700'}">${r.pct}%</span>
                                    </td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    } else {
        // أمناء المراحل وأمين عام مدارس الأحد وخدام الفصول
        currentVisitAchievementMode = "stage";
        if (titleEl) titleEl.innerHTML = `<span>📊</span> متابعة إنجاز افتقاد المرحلة والخدام`;
        if (subEl) subEl.innerText = "إحصائيات التغطية حسب الصفوف ونشاط كل خادم في المرحلة";

        const allowedStages = getUserAllowedStages(currentUser);
        const scopedKids = namesCacheData.filter(kid => {
            if (isMemberDeceased(kid) || kid["مدارس الأحد"] === "غير مشترك") return false;
            if (!allowedStages.some(st => normalizeArabic(st) === normalizeArabic(kid["المرحلة"]))) return false;
            if (currentUser.Role === "Class_Servant" && currentUser.AssignedGrade && currentUser.AssignedGrade !== "الكل" && normalizeArabic(kid["الصف"]) !== normalizeArabic(currentUser.AssignedGrade)) return false;
            return true;
        });

        const kidIdToGrade = {};
        const kidNameToGrade = {};
        const gradeStats = {};

        scopedKids.forEach(kid => {
            const gKey = `${kid["المرحلة"] || ""} - ${kid["الصف"] || "عام"}`;
            if (!gradeStats[gKey]) gradeStats[gKey] = { label: gKey, total: 0, visitedSet: new Set(), homeCount: 0, phoneCount: 0 };
            gradeStats[gKey].total++;
            if (kid["ID"]) kidIdToGrade[String(kid["ID"]).trim()] = gKey;
            if (kid["الاسم ثلاثي"]) kidNameToGrade[normalizeArabic(kid["الاسم ثلاثي"])] = gKey;
        });

        const servantActivity = {};
        let totalHome = 0, totalPhone = 0;

        periodVisits.forEach(v => {
            const vId = String(v["MemberID"] || "").trim();
            const vName = normalizeArabic(v["MemberName"]);
            const gKey = (vId && kidIdToGrade[vId]) || kidNameToGrade[vName];
            if (!gKey) return;

            gradeStats[gKey].visitedSet.add(vId || vName);
            const vType = String(v["VisitType"] || "").trim();
            const isPhone = vType.includes("تليفون");
            const isHome = vType.includes("منزل");
            if (isPhone) { gradeStats[gKey].phoneCount++; totalPhone++; }
            else if (isHome) { gradeStats[gKey].homeCount++; totalHome++; }

            const visitor = String(v["VisitorName"] || "غير محدد").trim();
            if (!servantActivity[visitor]) servantActivity[visitor] = { name: visitor, home: 0, phone: 0, total: 0, lastDate: "" };
            servantActivity[visitor].total++;
            if (isPhone) servantActivity[visitor].phone++;
            else if (isHome) servantActivity[visitor].home++;
            if (!servantActivity[visitor].lastDate || parseDateForSort(v["VisitDate"]) > parseDateForSort(servantActivity[visitor].lastDate)) {
                servantActivity[visitor].lastDate = v["VisitDate"];
            }
        });

        const gradeRows = Object.values(gradeStats).map(g => {
            const visited = g.visitedSet.size;
            const remaining = Math.max(0, g.total - visited);
            const pct = g.total > 0 ? Math.round((visited / g.total) * 100) : 0;
            return { label: g.label, total: g.total, visited, remaining, homeCount: g.homeCount, phoneCount: g.phoneCount, pct };
        });
        currentVisitAchievementRows = gradeRows;

        const servantRows = Object.values(servantActivity).sort((a, b) => b.total - a.total);
        const sumKids = gradeRows.reduce((acc, r) => acc + r.total, 0);
        const sumVisited = gradeRows.reduce((acc, r) => acc + r.visited, 0);
        const overallPct = sumKids > 0 ? Math.round((sumVisited / sumKids) * 100) : 0;

        if (kpiEl) {
            kpiEl.innerHTML = `
                <div class="bg-white/95 p-4 rounded-2xl border border-slate-200 shadow-sm text-center"><span class="block text-xs font-bold text-slate-500 mb-1">إجمالي المخدومين</span><span class="text-2xl font-black text-slate-800">${sumKids}</span></div>
                <div class="bg-white/95 p-4 rounded-2xl border border-emerald-200 shadow-sm text-center"><span class="block text-xs font-bold text-slate-500 mb-1">تم افتقادهم</span><span class="text-2xl font-black text-emerald-600">${sumVisited}</span><span class="block text-[11px] font-bold text-slate-400">نسبة التغطية: ${overallPct}%</span></div>
                <div class="bg-white/95 p-4 rounded-2xl border border-rose-200 shadow-sm text-center"><span class="block text-xs font-bold text-slate-500 mb-1">زيارات منزلية</span><span class="text-2xl font-black text-rose-600">${totalHome}</span></div>
                <div class="bg-white/95 p-4 rounded-2xl border border-blue-200 shadow-sm text-center"><span class="block text-xs font-bold text-slate-500 mb-1">افتقاد تليفوني</span><span class="text-2xl font-black text-blue-600">${totalPhone}</span></div>
            `;
        }

        tablesEl.innerHTML = `
            <div class="bg-white/95 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="p-3.5 bg-slate-50 border-b border-slate-100 font-black text-xs text-slate-800">📚 إنجاز الافتقاد حسب الصفوف</div>
                <div class="overflow-x-auto nice-scrollbar">
                    <table class="w-full text-right text-xs">
                        <thead class="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                            <tr><th class="p-3">الصف</th><th class="p-3 text-center">المخدومين</th><th class="p-3 text-center text-emerald-700">تم افتقادهم</th><th class="p-3 text-center text-rose-700">متبقي</th><th class="p-3 text-center">🏠 منزلي</th><th class="p-3 text-center">📞 تليفوني</th><th class="p-3 text-center">التغطية</th></tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-bold">
                            ${gradeRows.map(r => `<tr><td class="p-3 font-black text-slate-800">${r.label}</td><td class="p-3 text-center">${r.total}</td><td class="p-3 text-center text-emerald-700">${r.visited}</td><td class="p-3 text-center text-rose-600">${r.remaining}</td><td class="p-3 text-center">${r.homeCount}</td><td class="p-3 text-center">${r.phoneCount}</td><td class="p-3 text-center"><span class="px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-700 font-black">${r.pct}%</span></td></tr>`).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
            <div class="bg-white/95 rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                <div class="p-3.5 bg-slate-50 border-b border-slate-100 font-black text-xs text-slate-800">👥 نشاط الافتقاد لكل خادم في الفترة</div>
                <div class="overflow-x-auto nice-scrollbar">
                    <table class="w-full text-right text-xs">
                        <thead class="bg-slate-100 text-slate-700 font-black border-b border-slate-200">
                            <tr><th class="p-3">اسم الخادم</th><th class="p-3 text-center">🏠 منزلي</th><th class="p-3 text-center">📞 تليفوني</th><th class="p-3 text-center">الإجمالي</th><th class="p-3 text-center">آخر افتقاد</th></tr>
                        </thead>
                        <tbody class="divide-y divide-slate-100 font-bold">
                            ${servantRows.length > 0 ? servantRows.map(s => `<tr><td class="p-3 font-black text-slate-800">${s.name}</td><td class="p-3 text-center">${s.home}</td><td class="p-3 text-center">${s.phone}</td><td class="p-3 text-center text-indigo-700 font-black">${s.total}</td><td class="p-3 text-center font-mono">${s.lastDate || '-'}</td></tr>`).join('') : `<tr><td colspan="5" class="p-6 text-center text-slate-400">لم تُسجل زيارات في هذه الفترة بعد</td></tr>`}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }
}

function exportVisitAchievementPdf() {
    if (!currentVisitAchievementRows || currentVisitAchievementRows.length === 0) {
        alert("لا توجد بيانات في التقرير لتصديرها!");
        return;
    }
    const periodEl = document.getElementById('visitReportPeriod');
    const periodLabel = periodEl ? periodEl.options[periodEl.selectedIndex].text : "";
    const colTitle = currentVisitAchievementMode === "area" ? "المنطقة السكنية" : "المرحلة / الصف";
    const unitTitle = currentVisitAchievementMode === "area" ? "الأسر" : "المخدومين";

    const rowsHtml = currentVisitAchievementRows.map((r, idx) => `
        <tr>
            <td style="text-align:center;font-weight:800;">${idx + 1}</td>
            <td style="font-weight:800;">${r.label}</td>
            <td style="text-align:center;">${r.total}</td>
            <td style="text-align:center;font-weight:900;color:#047857;">${r.visited}</td>
            <td style="text-align:center;font-weight:800;color:#be123c;">${r.remaining}</td>
            <td style="text-align:center;">${r.homeCount}</td>
            <td style="text-align:center;">${r.phoneCount}</td>
            <td style="text-align:center;font-weight:900;">${r.pct}%</td>
        </tr>
    `).join('');

    const tableHtml = `
        <table class="pdf-table">
            <thead>
                <tr>
                    <th style="width:6%;text-align:center;">م</th>
                    <th style="width:28%;">${colTitle}</th>
                    <th style="width:11%;text-align:center;">إجمالي ${unitTitle}</th>
                    <th style="width:11%;text-align:center;">تم افتقادها</th>
                    <th style="width:10%;text-align:center;">متبقي</th>
                    <th style="width:11%;text-align:center;">منزلي</th>
                    <th style="width:11%;text-align:center;">تليفوني</th>
                    <th style="width:12%;text-align:center;">الإنجاز</th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    `;
    const repTitle = currentVisitAchievementMode === "area" ? "تقرير إنجاز الافتقاد بالمناطق السكنية" : "تقرير متابعة إنجاز افتقاد المرحلة";
    openOfficialPdfPreview(repTitle, `الفترة: ${periodLabel}`, tableHtml);
}

function shareVisitAchievementWhatsApp() {
    if (!currentVisitAchievementRows || currentVisitAchievementRows.length === 0) {
        alert("لا توجد بيانات للمشاركة!");
        return;
    }
    const periodEl = document.getElementById('visitReportPeriod');
    const periodLabel = periodEl ? periodEl.options[periodEl.selectedIndex].text : "";
    let text = `*تقرير إنجاز الافتقاد (${periodLabel})*

`;
    currentVisitAchievementRows.forEach((r, idx) => {
        text += `${idx + 1}. *${r.label}*
`;
        text += `✅ تم: ${r.visited} من ${r.total} (${r.pct}%) | 🏠 منزلي: ${r.homeCount} | 📞 تليفوني: ${r.phoneCount}
──────────
`;
    });
    shareToWhatsApp(text);
}

function exportVisitAchievementExcel() {
    if (!currentVisitAchievementRows || currentVisitAchievementRows.length === 0) {
        alert("لا توجد بيانات للتصدير!");
        return;
    }
    const headers = ["م", "المنطقة / الصف", "الإجمالي", "تم افتقاده", "متبقي", "منزلي", "تليفوني", "نسبة الإنجاز %"];
    const csvRows = [headers.join(",")];
    currentVisitAchievementRows.forEach((r, idx) => {
        csvRows.push([idx + 1, r.label, r.total, r.visited, r.remaining, r.homeCount, r.phoneCount, `${r.pct}%`].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`).join(","));
    });
    const blob = new Blob(["\uFEFF" + csvRows.join("\n")], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `تقرير_انجاز_الافتقاد.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}

function printVisitReport() {
    const urgentItems = Array.from(document.getElementById('visitUrgentList')?.children || []).filter(n => n.tagName === "DIV" && n.querySelector('h4'));
    let text = `*كشف الافتقاد المباشر*
التاريخ: ${new Date().toLocaleDateString('ar-EG')}

`;
    urgentItems.forEach((node, idx) => {
        const name = node.querySelector('h4')?.innerText || "";
        const sub = node.querySelector('p')?.innerText || "";
        const phone = node.querySelectorAll('p')[1]?.innerText || "";
        text += `${idx + 1}. *${name}*
${sub}
${phone}
──────────
`;
    });
    if (urgentItems.length === 0) text += "لا توجد حالات حالياً.";
    shareToWhatsApp(text);
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
        let val = (f.id === "المنطقة") ? getMemberArea(data) : getFieldValNormalized(data, f.id);
        const isPhoneField = PHONE_FIELD_KEYS.includes(f.id);
        const isDateField = DATE_FIELD_KEYS.includes(f.id);
        if (isPhoneField) val = normalizeEgyptianPhone(val);
        if (isDateField) val = formatDisplayDate(val);

        const w = document.createElement('div');
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
        else if (isPhoneField) {
            const ph = f.id === "هاتف الاسرة" ? "065xxxxxxx أو 01xxxxxxxxx" : "01xxxxxxxxx";
            inpH = `<input type="tel" dir="ltr" inputmode="tel" name="${f.id}" value="${val}" placeholder="${ph}" onblur="this.value = normalizeEgyptianPhone(this.value)" ${f.required?'required':''} class="${cls} text-left font-mono">`;
        }
        else if (isDateField) {
            inpH = `<input type="text" dir="ltr" inputmode="numeric" name="${f.id}" value="${val}" placeholder="DD/MM/YYYY" onblur="this.value = formatDisplayDate(this.value)" ${f.required?'required':''} class="${cls} text-left font-mono">`;
        }
        else if (f.id === "الرقم القومي") {
            const isPartialNid = val && !/^([23])\d{13}$/.test(val);
            const borderOverride = isPartialNid ? "border-amber-400 bg-amber-50/40" : "";
            const hintHtml = isPartialNid ? `<span class="block text-[10px] text-amber-700 font-bold mt-1">⚠️ الرقم المسجل غير مكتمل (${val.length} أرقام) — أكمله إلى 14 رقماً أو امسحه.</span>` : "";
            inpH = `<input type="text" dir="ltr" inputmode="numeric" maxlength="14" name="${f.id}" value="${val}" placeholder="14 رقم (اختياري)" oninput="onNationalIdInput(this.value)" class="${cls} ${borderOverride} text-left font-mono">${hintHtml}`;
        }
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

    // توحيد والتحقق من صحة أرقام الهواتف والتواريخ قبل الحفظ في جميع الأقسام
    PHONE_FIELD_KEYS.forEach(pk => {
        if (payload[pk]) payload[pk] = normalizeEgyptianPhone(payload[pk]);
    });
    DATE_FIELD_KEYS.forEach(dk => {
        if (payload[dk]) payload[dk] = formatDisplayDate(payload[dk]);
    });

    if (payload["تليفون العمل/المحمول"] && !isValidEgyptianPhone(payload["تليفون العمل/المحمول"], true)) {
        alert("⚠️ رقم المحمول / الهاتف غير صحيح!\nيجب أن يتكون رقم المحمول المصري من 11 رقماً ويبدأ بـ (010 أو 011 أو 012 أو 015)، أو رقم أرضي بكود المحافظة (مثل 065...).");
        return;
    }
    if (payload["هاتف الاسرة"] && !isValidEgyptianPhone(payload["هاتف الاسرة"], true)) {
        alert("⚠️ رقم هاتف الأسرة غير صحيح!\nيرجى إدخال 11 رقماً للمحمول (01xxxxxxxxx) أو رقم الأرضي مسبوقاً بكود المحافظة (مثل 065xxxxxxx).");
        return;
    }
    for (const dk of DATE_FIELD_KEYS) {
        if (payload[dk] && !isValidCalendarDate(payload[dk])) {
            alert(`⚠️ صيغة التاريخ في خانة (${dk}) غير صحيحة!\nيرجى إدخال التاريخ بصيغة: يوم/شهر/سنة (مثال: 01/06/1985).`);
            return;
        }
    }

    if (currentTab === 'Names') {
        if (!payload["اسم رب الاسرة"]) { alert("خطأ: لا يمكن حفظ العضو بدون تحديد اسم رب الأسرة!"); return; }
        if (payload["الرقم القومي"] && !/^([23])\d{13}$/.test(payload["الرقم القومي"])) {
            alert("⚠️ الرقم القومي غير صحيح!\nيجب أن يتكون الرقم القومي المصري من 14 رقماً بالضبط ويبدأ بـ 2 أو 3 (أو اترك الخانة فارغة إذا لم يتوفر).");
            return;
        }
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
    const query = normalizeArabic(document.getElementById('searchInput')?.value || "").toLowerCase(), container = document.getElementById('standardCardsContainer');
    if (!container) return; container.innerHTML = "";

    let filtered = rawData.filter(item => {
        if (currentTab === "Sunday_School") {
            if (!isStageAllowedForUser(item["Stage"], currentUser)) return false;
            if (currentUser.Role === "Class_Servant" && currentUser.AssignedClass && currentUser.AssignedClass !== "الكل" && item["ClassName"] !== currentUser.AssignedClass) return false;
        }
        if (!query) return true;
        return getSearchIndex(item).all.includes(query);
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
        container.innerHTML = `<div class="overflow-x-auto nice-scrollbar"><table class="w-full text-right text-xs"><thead class="bg-slate-100 text-slate-700 font-black border-b border-slate-200"><tr><th class="p-3 w-12 text-center">م</th><th class="p-3">التاريخ</th><th class="p-3">المرحلة والصف</th><th class="p-3">الفصل</th><th class="p-3">اسم المخدوم</th><th class="p-3 text-center">الحضور</th><th class="p-3">ملاحظات</th><th class="p-3 text-center no-print">إجراءات</th></tr></thead><tbody class="divide-y divide-slate-100 font-semibold">${filtered.map((item, idx) => { const idVal = item[Object.keys(item)[0]]; return `<tr class="hover:bg-slate-50"><td class="p-3 text-center text-slate-400 font-bold">${idx + 1}</td><td class="p-3 font-mono">${item["SessionDate"] || "-"}</td><td class="p-3"><span class="bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded font-bold">${item["Stage"] || "-"}</span> ${item["Grade"] || ""}</td><td class="p-3">${item["ClassName"] || "-"}</td><td class="p-3 font-black text-slate-800">${item["ChildName"] || "-"}</td><td class="p-3 text-center"><span class="px-2.5 py-1 rounded-lg font-black text-[11px] ${item["Attendance"]==='حاضر'?'bg-emerald-50 text-emerald-700':'bg-rose-50 text-rose-700'}">${item["Attendance"] || "-"}</span></td><td class="p-3 text-slate-500">${item["Notes"] || "-"}</td><td class="p-3 text-center no-print"><button onclick="editRecord(${idVal})" class="text-xs font-bold text-indigo-600 hover:underline ml-2">تعديل</button>${(currentUser.Role === "Admin" || currentUser.Role === "Priest") ? `<button onclick="deleteRecord(${idVal})" class="text-xs font-bold text-rose-600 hover:underline">حذف</button>` : ''}</td></tr>`; }).join('')}</tbody></table></div>`;
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

        card.innerHTML = `<div><div class="flex justify-between items-start mb-3"><h4 class="font-black text-sm text-slate-800 truncate">${title}</h4><span class="text-[10px] font-mono font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded">#${idVal}</span></div><div class="mb-4">${details}</div></div><div class="flex justify-end gap-2 pt-3 border-t border-slate-100 no-print"><button onclick="editRecord(${idVal})" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1.5 rounded-lg transition">تعديل</button>${(currentUser.Role === "Admin" || currentUser.Role === "Priest") ? `<button onclick="deleteRecord(${idVal})" class="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 px-2.5 py-1.5 rounded-lg transition">حذف</button>` : ''}</div>`;
        container.appendChild(card);
    });
}

// 12. دوال الاتصال المؤمّن بالسيرفر، سجل المراقبة، وتصدير Excel
function handleSessionExpired() {
    sessionStorage.clear();
    currentUser = null;
    sessionToken = "";
    const login = document.getElementById('loginScreen');
    if (login) {
        login.classList.remove('hidden');
        login.style.display = 'flex';
    }
}

async function apiFetch(url) {
    const sheetMatch = url.match(/[?&]sheet=([^&]+)/);
    const sheetKey = sheetMatch ? decodeURIComponent(sheetMatch[1]) : "";

    // إذا لم يكن هناك إنترنت، نرجع البيانات المخزنة في الكاش فوراً
    if (!navigator.onLine) {
        updateConnectionIndicator(false);
        const cached = getCachedSheetData(sheetKey);
        if (cached) return { ...cached, fromCache: true };
        return { status: "success", data: [], areas: [], fromCache: true, noCacheYet: true };
    }

    const sep = url.includes('?') ? '&' : '?';
    const fullUrl = `${url}${sep}token=${encodeURIComponent(sessionToken)}&t=${Date.now()}`;
    try {
        const response = await fetch(fullUrl, { method: 'GET', redirect: 'follow' });
        if (!response.ok) throw new Error(`خطأ استجابة السيرفر: ${response.status}`);
        const res = await response.json();
        updateConnectionIndicator(true);
        if (res.status === "unauthorized") {
            alert(res.message || "انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى.");
            handleSessionExpired();
            throw new Error("Unauthorized");
        }
        if (res.status === "success" && sheetKey) {
            saveCachedSheetData(sheetKey, res);
        }
        return res;
    } catch (err) {
        if (err.message === "Unauthorized") throw err;
        // في حال انقطاع الاتصال الفعلي، نرجع من الكاش تلقائياً
        updateConnectionIndicator(false);
        const cached = getCachedSheetData(sheetKey);
        if (cached) return { ...cached, fromCache: true };
        throw err;
    }
}

async function apiPost(bodyObj) {
    const payloadWithToken = { ...bodyObj, token: sessionToken, user: currentUser ? currentUser.ServantName : "" };

    // في وضع عدم الاتصال: نحفظ العملية في طابور المزامنة ونحدّث الكاش المحلي فوراً
    if (!navigator.onLine) {
        updateConnectionIndicator(false);
        return queueOfflineOperation(bodyObj);
    }

    try {
        const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payloadWithToken) });
        const res = await response.json();
        updateConnectionIndicator(true);
        if (res.status === "unauthorized") {
            alert(res.message || "انتهت صلاحية الجلسة، يرجى تسجيل الدخول مرة أخرى.");
            handleSessionExpired();
            throw new Error("Unauthorized");
        }
        return res;
    } catch (err) {
        if (err.message === "Unauthorized") throw err;
        updateConnectionIndicator(false);
        return queueOfflineOperation(bodyObj);
    }
}

function sendAuditLog(actionType, targetSheet, recordDetails) {
    if (!currentUser || !navigator.onLine) return;
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
            const targetSheetParam = (currentTab === 'Confessions') ? 'Confessions_Log' : currentTab;
            const res = await apiFetch(`${API_URL}?sheet=${encodeURIComponent(targetSheetParam)}`);
            if (res.status === "success") {
                rawData = Array.isArray(res.data) ? res.data.map(sanitizeRecordFields) : [];
                backendAreas = res.areas || [];
                if (currentTab === 'Names') {
                    try {
                        const famRes = await apiFetch(`${API_URL}?sheet=${encodeURIComponent("Family name")}`);
                        if (famRes.status === "success" && Array.isArray(famRes.data)) {
                            rawData = mergeFamilySheetIntoNames(rawData, famRes.data);
                            famRes.data.forEach(f => {
                                const a = getFieldValNormalized(f, "المنطقة");
                                if (a && a !== "-" && !backendAreas.includes(a)) backendAreas.push(a);
                            });
                        }
                    } catch (e) {}
                    namesCacheData = rawData; populateAreasDropdown();
                    if (currentNamesView === 'roster') { buildAlphabetBar(); renderFamilyHeadsRoster(); } else applyNamesFilter();
                    if (visitationsData.length === 0) {
                        apiFetch(`${API_URL}?sheet=Visitations`).then(d => {
                            if (d.status === "success") { visitationsData = d.data.map(sanitizeRecordFields); if (currentNamesView === 'roster') renderFamilyHeadsRoster(); }
                        }).catch(() => {});
                    }
                } else if (currentTab === 'Sunday_School') {
                    if (currentSSView === 'live') initSundaySchoolLiveView();
                    else if (currentSSView === 'report') initSSReportView();
                    else if (currentSSView === 'charts') initSSChartsView();
                    else renderStandardCards();
                } else if (currentTab === 'Meetings_Attendance') {
                    if (currentMeetingsView === 'live') initServantsMeetingLiveView(); else renderStandardCards();
                } else if (currentTab === 'Visitations') {
                    visitationsData = rawData;
                    if (currentVisitView === 'dashboard') initVisitationsDashboard();
                    else if (currentVisitView === 'reports') initVisitationsReportsView();
                    else renderStandardCards();
                } else if (currentTab === 'Confessions') {
                    await initPriestConfessionsView();
                } else if (currentTab === 'Servants') {
                    servantsCacheData = rawData;
                    if (currentServantsView === 'confessions') initServantsConfessionsView(); else renderStandardCards();
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
        else if (currentSSView === 'report') document.getElementById('sundaySchoolReportSection')?.classList.toggle('hidden', s);
        else if (currentSSView === 'charts') document.getElementById('sundaySchoolChartsSection')?.classList.toggle('hidden', s);
        else document.getElementById('standardCardsContainer')?.classList.toggle('hidden', s);
    } else if (currentTab === 'Meetings_Attendance') {
        if (currentMeetingsView === 'live') document.getElementById('servantsMeetingLiveSection')?.classList.toggle('hidden', s);
        else document.getElementById('standardCardsContainer')?.classList.toggle('hidden', s);
    } else if (currentTab === 'Visitations') {
        if (currentVisitView === 'dashboard') document.getElementById('visitationDashboardSection')?.classList.toggle('hidden', s);
        else if (currentVisitView === 'reports') document.getElementById('visitationReportsSection')?.classList.toggle('hidden', s);
        else document.getElementById('standardCardsContainer')?.classList.toggle('hidden', s);
    } else if (currentTab === 'Confessions') {
        document.getElementById('priestConfessionsSection')?.classList.toggle('hidden', s);
    } else if (currentTab === 'Servants') {
        if (currentServantsView === 'confessions') document.getElementById('servantsConfessionsSection')?.classList.toggle('hidden', s);
        else document.getElementById('standardCardsContainer')?.classList.toggle('hidden', s);
    } else {
        document.getElementById('standardCardsContainer')?.classList.toggle('hidden', s);
    }
}

// 13. دوال الطباعة واستخراج التقارير
async function shareToWhatsApp(text) {
    const cleanText = String(text || "").trim();
    if (!cleanText) return;
    // نسخ النص للحافظة تلقائياً كنسخة احتياطية دائمة
    try {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(cleanText);
        }
    } catch (e) {}

    // إذا كان التقرير طويلاً (أكثر من 3500 حرف)، نستخدم الحافظة لتفادي حد طول الروابط في المتصفح والأندرويد
    if (cleanText.length > 3500) {
        alert("📋 التقرير كبير وتم نسخه بالكامل إلى الحافظة تلقائياً!\nسيتم فتح واتساب الآن؛ اختر المحادثة واضغط (لصق / Paste).");
        window.open("https://wa.me/", "_blank");
        return;
    }
    const url = `https://wa.me/?text=${encodeURIComponent(cleanText)}`;
    window.open(url, '_blank');
}

function buildAndPrintFamilies(familiesMap, reportTitle) {
    let text = `*${reportTitle}*
التاريخ: ${new Date().toLocaleDateString('ar-EG')}

`;
    const sortedHeads = Object.keys(familiesMap).sort((a, b) => a.localeCompare(b, 'ar'));
    if (sortedHeads.length === 0) { alert("لا توجد أسر مطابقة للمشاركة!"); return; }
    
    sortedHeads.forEach((headName, idx) => {
        const members = sortFamilyMembers(familiesMap[headName], headName), headRec = members.find(m => m["الاسم ثلاثي"] === headName) || members[0];
        const addressStr = [getMemberArea(headRec), getFieldValNormalized(headRec, "اسم الشارع"), getFieldValNormalized(headRec, "رقم المنزل")].filter(Boolean).join(' - ') || "غير محدد";
        const phoneStr = headRec?.["هاتف الاسرة"] || headRec?.["تليفون العمل/المحمول"] || "-";
        
        text += `*${idx + 1}. أسرة: ${headName}*
`;
        text += `📍 العنوان: ${addressStr}
`;
        text += `📞 الهاتف: ${phoneStr}
`;
        text += `👥 الأفراد:
`;
        members.forEach((m, mIdx) => {
            text += `  ${mIdx + 1}- ${m["الاسم ثلاثي"] || "-"} (${m["تليفون العمل/المحمول"] || "-"})
`;
        });
        text += `──────────
`;
    });
    shareToWhatsApp(text);
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

function onNationalIdInput(nidVal) {
    const nid = String(nidVal || "").trim();
    if (nid.length === 14 && /^([23])\d{13}$/.test(nid)) {
        const century = nid[0] === '2' ? '19' : '20';
        const yy = nid.substring(1, 3), mm = nid.substring(3, 5), dd = nid.substring(5, 7);
        const derivedDob = `${dd}/${mm}/${century}${yy}`;
        const dobInp = document.querySelector('#formFields input[name="تاريخ الميلاد"]');
        if (dobInp && !dobInp.value && isValidCalendarDate(derivedDob)) {
            dobInp.value = derivedDob;
        }
        const genderDigit = parseInt(nid[12], 10);
        const derivedGender = (genderDigit % 2 === 1) ? "ذكر" : "انثي";
        const gSel = document.querySelector('#formFields select[name="ذكر/انثي"]');
        if (gSel && !gSel.value) {
            gSel.value = derivedGender;
            handleGenderChange(derivedGender);
        }
    }
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

// ==================== النافذة الافتتاحية وبوابة استعلام رب الأسرة ====================
let lastLogoTouchTime = 0;

function handleLandingLogoTouch(e) {
    const now = Date.now();
    if (now - lastLogoTouchTime < 400) {
        if (e) e.preventDefault();
        openServantsLoginModal();
    }
    lastLogoTouchTime = now;
}

function openServantsLoginModal() {
    const login = document.getElementById('loginScreen');
    const err = document.getElementById('loginError');
    const passInp = document.getElementById('loginPass');
    if (err) err.classList.add('hidden');
    if (passInp) passInp.value = "";
    if (login) {
        login.classList.remove('hidden');
        login.style.display = 'flex';
        setTimeout(() => passInp?.focus(), 50);
    }
}

function closeServantsLoginModal() {
    const login = document.getElementById('loginScreen');
    const err = document.getElementById('loginError');
    const passInp = document.getElementById('loginPass');
    if (err) err.classList.add('hidden');
    if (passInp) passInp.value = "";
    if (login) {
        login.style.display = 'none';
        login.classList.add('hidden');
    }
}

let lastFamilyPortalResult = null;

function resetFamilyPortalFields() {
    lastFamilyPortalResult = null;
    const nidInp = document.getElementById('fpNationalId');
    const phoneInp = document.getElementById('fpPhone');
    const resCont = document.getElementById('fpResultContainer');
    if (nidInp) nidInp.value = "";
    if (phoneInp) phoneInp.value = "";
    if (resCont) {
        resCont.classList.add('hidden');
        resCont.innerHTML = "";
    }
}

window.addEventListener('pagehide', resetFamilyPortalFields);
window.addEventListener('beforeunload', resetFamilyPortalFields);

function openFamilyPortal() {
    resetFamilyPortalFields();
    const fp = document.getElementById('familyPortalScreen');
    if (fp) {
        fp.classList.remove('hidden');
        fp.style.display = 'block';
        setTimeout(() => document.getElementById('fpNationalId')?.focus(), 50);
    }
}

function closeFamilyPortal() {
    resetFamilyPortalFields();
    const fp = document.getElementById('familyPortalScreen');
    if (fp) {
        fp.style.display = 'none';
        fp.classList.add('hidden');
    }
    if (window.location.hash === '#family') {
        history.replaceState(null, '', window.location.pathname + window.location.search);
    }
}

async function handleFamilyPortalLookup() {
    const nidInp = document.getElementById('fpNationalId');
    const phoneInp = document.getElementById('fpPhone');
    const btn = document.getElementById('fpSearchBtn');
    const resCont = document.getElementById('fpResultContainer');
    if (!nidInp || !phoneInp || !resCont) return;

    const nid = String(nidInp.value || "").trim().replace(/\D/g, '');
    const phone = normalizeEgyptianPhone(phoneInp.value);
    nidInp.value = nid;
    phoneInp.value = phone;

    if (!/^[23]\d{13}$/.test(nid)) {
        alert("⚠️ يرجى إدخال الرقم القومي المكون من 14 رقماً بشكل صحيح.");
        nidInp.focus();
        return;
    }
    if (!/^01[0125]\d{8}$/.test(phone) && !/^0[2-9]\d{7,8}$/.test(phone)) {
        alert("⚠️ يرجى إدخال رقم موبايل صحيح مكون من 11 رقماً.");
        phoneInp.focus();
        return;
    }

    if (btn) { btn.disabled = true; btn.innerHTML = "جاري البحث والتحقق بأمان..."; }
    resCont.classList.add('hidden');
    resCont.innerHTML = "";

    try {
        const response = await fetch(API_URL, {
            method: 'POST',
            body: JSON.stringify({
                action: 'family_lookup',
                data: { nationalId: nid, phone: phone }
            })
        });
        const res = await response.json();

        if (res.status === "success" && res.family && Array.isArray(res.members)) {
            lastFamilyPortalResult = { nid, phone, family: res.family, members: res.members };
            renderFamilyPortalSuccess(res.family, res.members);
        } else {
            const msg = res.message || "البيانات غير مسجلة أو غير مطابقة في قاعدة البيانات.";
            resCont.innerHTML = `
                <div class="bg-rose-50 border border-rose-200 rounded-2xl p-4 text-center space-y-1.5">
                    <p class="text-sm font-black text-rose-800">⚠️ ${msg}</p>
                    <p class="text-xs text-rose-700 font-semibold leading-relaxed">إذا لم تكن بيانات أسرتكم مسجلة بعد أو تم تغيير رقم الموبايل، يرجى التواصل مع إدارة الكنيسة عبر أرقام التواصل الموضحة في لوحة الإعلانات لتسجيل أو تحديث البيانات.</p>
                </div>
            `;
            resCont.classList.remove('hidden');
        }
    } catch (err) {
        alert("تعذر الاتصال بالسيرفر، يرجى التأكد من الإنترنت والمحاولة مرة أخرى.");
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = "<span>🔍</span><span>عرض بيانات الأسرة</span>"; }
    }
}

function renderFamilyPortalSuccess(family, members) {
    const resCont = document.getElementById('fpResultContainer');
    if (!resCont) return;

    const sortedMembers = sortFamilyMembers(members.map(m => ({
        ...m,
        "الاسم ثلاثي": m.name,
        "صلة القرابة": m.relation,
        "ذكر/انثي": m.gender,
        "تاريخ الميلاد": m.dob
    })), family.familyHead);

    const addressParts = [
        family.area ? `منطقة: ${family.area}` : "",
        family.street ? `شارع: ${family.street}` : "",
        family.house ? `منزل/عمارة: ${family.house}` : "",
        family.floor ? `الدور: ${family.floor}` : "",
        family.apt ? `شقة: ${family.apt}` : ""
    ].filter(Boolean).join(" — ") || "غير مسجل تفصيلياً";

    const membersHtml = sortedMembers.map((m, idx) => {
        const gBadge = m.gender === "ذكر"
            ? `<span class="text-[10px] bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-bold">ذكر</span>`
            : m.gender === "انثي"
                ? `<span class="text-[10px] bg-pink-50 text-pink-700 px-2 py-0.5 rounded-full font-bold">انثي</span>`
                : "";
        const eduInfo = m.stage ? `${m.stage}${m.grade ? ' (' + m.grade + ')' : ''}` : (m.qualification || "-");
        return `
            <div class="p-3 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                    <div class="flex items-center gap-1.5 flex-wrap mb-1">
                        <span class="text-xs font-black text-indigo-700">${idx + 1}.</span>
                        <span class="text-xs sm:text-sm font-black text-slate-800">${m.name || "-"}</span>
                        <span class="text-[10px] bg-white border border-slate-200 text-slate-700 px-2 py-0.5 rounded-full font-bold">${m.relation || "عضو"}</span>
                        ${gBadge}
                        ${m.maritalStatus ? `<span class="text-[10px] bg-amber-50 text-amber-800 px-2 py-0.5 rounded-full font-bold">${m.maritalStatus}</span>` : ""}
                    </div>
                    <div class="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-600 font-semibold">
                        <span>🎂 الميلاد: <strong class="font-mono text-slate-800">${m.dob || "غير مسجل"}</strong></span>
                        <span>📱 المحمول: <strong class="font-mono text-slate-800" dir="ltr">${m.phone || "غير مسجل"}</strong></span>
                        <span>🎓 المرحلة/المؤهل: <strong class="text-slate-800">${eduInfo}</strong></span>
                    </div>
                </div>
            </div>
        `;
    }).join('');

    resCont.innerHTML = `
        <div class="space-y-5">
            <div class="bg-emerald-50 border border-emerald-200 rounded-2xl p-4">
                <div class="flex items-center justify-between flex-wrap gap-2 mb-2">
                    <h3 class="text-base font-black text-emerald-950">🏠 أسرة: ${family.familyHead}</h3>
                    <span class="bg-emerald-600 text-white px-2.5 py-0.5 rounded-full text-[11px] font-black">${sortedMembers.length} أفراد</span>
                </div>
                <p class="text-xs text-emerald-900 font-bold">📍 العنوان: ${addressParts}</p>
                ${family.familyPhone ? `<p class="text-xs text-emerald-900 font-bold mt-1">☎️ هاتف الأسرة: <span class="font-mono" dir="ltr">${family.familyPhone}</span></p>` : ""}
            </div>

            <div class="space-y-2.5">
                <h4 class="text-xs font-black text-slate-700">👥 أفراد الأسرة المسجلون (الزوج ➔ الزوجة ➔ الأبناء):</h4>
                ${membersHtml}
            </div>
        </div>
    `;
    resCont.classList.remove('hidden');
}


// ==================== بوابة سجل الاعترافات للآباء الكهنة فقط ====================
let priestSpiritualChildren = [];
let priestConfessionsLogs = [];
let selectedConfessorMember = null;
let priestConfFilterMode = "all";
let showOlderConfessions = false;

function extractPriestTokensClient(name) {
    let s = normalizeArabic(name).replace(/[/\\\-]+/g, " ").replace(/\s+/g, " ").trim();
    s = s.replace(/^(?:قدس\s+)?(?:ابونا\s+)?(?:القمص|القس|ابونا)\s*/g, "").trim();
    return s ? s.split(" ").filter(Boolean) : [];
}

function isSameConfessionFatherClient(priestAccountName, memberFatherField) {
    const pRaw = normalizeArabic(priestAccountName).replace(/[/\\\-]+/g, " ").replace(/\s+/g, " ").trim();
    const mRaw = normalizeArabic(memberFatherField).replace(/[/\\\-]+/g, " ").replace(/\s+/g, " ").trim();
    if (!pRaw || !mRaw) return false;
    if (pRaw === mRaw) return true;
    const pTokens = extractPriestTokensClient(pRaw);
    const mTokens = extractPriestTokensClient(mRaw);
    if (pTokens.length === 0 || mTokens.length === 0) return false;
    if (pTokens[0] !== mTokens[0]) return false;
    if (mTokens.length === 1 || pTokens.length === 1) return true;
    return pTokens[1] === mTokens[1];
}

function getMemberConfessionHistory(member) {
    if (!member) return [];
    const mId = String(member["ID"] || "").trim();
    const mNameNorm = normalizeArabic(member["الاسم ثلاثي"]);
    const matchedLogs = priestConfessionsLogs.filter(log => {
        const lMid = String(log["MemberID"] || "").trim();
        const lNameNorm = normalizeArabic(log["MemberName"]);
        return (mId && lMid && lMid === mId) || (mNameNorm && lNameNorm && lNameNorm === mNameNorm);
    }).map(log => ({
        id: log["ID"],
        date: formatDisplayDate(log["ConfessionDate"]) || String(log["ConfessionDate"] || "").trim(),
        priest: String(log["PriestName"] || "").trim(),
        notes: String(log["Notes"] || "").trim(),
        fromSheet: true
    }));

    // دمج تاريخ آخر اعتراف المسجل مسبقاً في ملف العضو إن لم يكن موجوداً في سجل الاعترافات التفصيلي
    const legacyLastDate = formatDisplayDate(member["تاريخ اخر اعتراف"]);
    if (legacyLastDate && !matchedLogs.some(l => l.date === legacyLastDate)) {
        matchedLogs.push({
            id: null,
            date: legacyLastDate,
            priest: String(member["اب الاعتراف"] || currentUser?.ServantName || "").trim(),
            notes: "مسجل مسبقاً في ملف العضو",
            fromSheet: false
        });
    }

    matchedLogs.sort((a, b) => parseDateForSort(b.date) - parseDateForSort(a.date));
    return matchedLogs;
}

function getDaysSinceDate(dateStr) {
    const formatted = formatDisplayDate(dateStr);
    if (!formatted) return null;
    const dt = parseDateForSort(formatted);
    if (isNaN(dt.getTime()) || dt.getTime() <= 0) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    dt.setHours(0, 0, 0, 0);
    return Math.floor((now.getTime() - dt.getTime()) / (1000 * 60 * 60 * 24));
}

function formatRelativeArabicDays(days) {
    if (days === null || days === undefined) return "";
    if (days < 0) return `بعد ${Math.abs(days)} يوم`;
    if (days === 0) return "اليوم";
    if (days === 1) return "أمس";
    if (days === 2) return "منذ يومين";
    if (days <= 10) return `منذ ${days} أيام`;
    if (days < 30) return `منذ ${days} يوماً`;
    const months = Math.floor(days / 30);
    if (months === 1) return "منذ شهر";
    if (months === 2) return "منذ شهرين";
    if (months <= 10) return `منذ ${months} شهور`;
    return `منذ ${months} شهراً`;
}

async function initPriestConfessionsView() {
    if (!isPriestUser(currentUser)) {
        alert("عذراً، هذا القسم متاح للآباء الكهنة فقط.");
        showDashboard();
        return;
    }

    priestConfessionsLogs = Array.isArray(rawData) ? rawData : [];

    // جلب أبناء الاعتراف التابعين لهذا الأب الكاهن فقط من السيرفر
    try {
        const res = await apiFetch(`${API_URL}?sheet=Priest_Members`);
        if (res.status === "success" && Array.isArray(res.data)) {
            priestSpiritualChildren = res.data.map(sanitizeRecordFields).filter(m =>
                isSameConfessionFatherClient(currentUser.ServantName, m["اب الاعتراف"])
            );
        }
    } catch (e) {
        // احتياطي من الكاش المحلي مع تطبيق نفس فلتر أب الاعتراف الصارم
        priestSpiritualChildren = namesCacheData.filter(m =>
            !isMemberDeceased(m) && isSameConfessionFatherClient(currentUser.ServantName, m["اب الاعتراف"])
        );
    }

    priestSpiritualChildren.sort((a, b) =>
        String(a["الاسم ثلاثي"] || "").localeCompare(String(b["الاسم ثلاثي"] || ""), 'ar')
    );

    const titleEl = document.getElementById('priestPortalTitle');
    if (titleEl) titleEl.innerText = `أهلاً بقدسك — ${currentUser.ServantName}`;

    rebuildPriestConfSummaryIndex();
    updatePriestConfessionsKpis();
    filterPriestChildrenList();

    // تحديث بطاقة الفرد المختار إن وجدت
    if (selectedConfessorMember) {
        const freshMember = priestSpiritualChildren.find(m => String(m["ID"]) === String(selectedConfessorMember["ID"])) || selectedConfessorMember;
        selectedConfessorMember = freshMember;
        renderSelectedConfessorPanel();
    }
}

function updatePriestConfessionsKpis() {
    const total = priestSpiritualChildren.length;
    let active12m = 0;
    let overdue = 0;

    priestSpiritualChildren.forEach(m => {
        const hist = getMemberConfessionHistory(m);
        if (hist.length === 0) {
            overdue++;
            return;
        }
        const days = getDaysSinceDate(hist[0].date);
        if (days !== null && days <= 365) active12m++;
        if (days === null || days > 90) overdue++;
    });

    const elTotal = document.getElementById('priestTotalChildrenCount');
    const el12m = document.getElementById('priestActive12mCount');
    const elOver = document.getElementById('priestOverdueCount');
    const recCount = document.getElementById('recordCount');

    if (elTotal) elTotal.innerText = total;
    if (el12m) el12m.innerText = active12m;
    if (elOver) elOver.innerText = overdue;
    if (recCount) recCount.innerText = `${total} من أبنائك`;
}

function setPriestConfFilter(mode) {
    priestConfFilterMode = mode;
    const btns = {
        all: document.getElementById('btnConfFilterAll'),
        overdue: document.getElementById('btnConfFilterOverdue'),
        recent: document.getElementById('btnConfFilterRecent')
    };
    Object.keys(btns).forEach(k => {
        if (!btns[k]) return;
        btns[k].className = (k === mode)
            ? "px-3.5 py-2 rounded-xl text-xs font-black transition bg-purple-700 text-white shadow-xs"
            : "px-3.5 py-2 rounded-xl text-xs font-black transition bg-slate-100 text-slate-700 hover:bg-slate-200";
    });
    filterPriestChildrenList();
}

function filterPriestChildrenList() {
    const listEl = document.getElementById('confessionMembersList');
    if (!listEl) return;

    const q = normalizeArabic(document.getElementById('confessionSearchInput')?.value || "").toLowerCase();

    const filtered = priestSpiritualChildren.filter(m => {
        const summary = cachedPriestConfSummaryMap.get(String(m["ID"]));
        const days = summary ? summary.days : null;

        if (priestConfFilterMode === "overdue" && !(days === null || days > 90)) return false;
        if (priestConfFilterMode === "recent" && !(days !== null && days <= 365)) return false;

        if (q) {
            const idx = getSearchIndex(m);
            if (!idx.name.includes(q) && !idx.head.includes(q) && !idx.phone.includes(q)) return false;
        }
        return true;
    });

    if (filtered.length === 0) {
        listEl.innerHTML = `<div class="md:col-span-2 text-center py-10 text-slate-400 font-bold text-xs">لا يوجد أبناء مطابقون لبحثك ضمن قائمة أبناء قدسك</div>`;
        return;
    }

    const displaySlice = filtered.slice(0, 60);
    let html = displaySlice.map(m => {
        const mId = m["ID"];
        const summary = cachedPriestConfSummaryMap.get(String(mId));
        const latestDate = summary ? summary.latestDate : "";
        const days = summary ? summary.days : null;
        const isSelected = selectedConfessorMember && String(selectedConfessorMember["ID"]) === String(mId);

        let badgeHtml = `<span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">لم يُسجل بعد</span>`;
        if (latestDate) {
            if (days !== null && days <= 90) {
                badgeHtml = `<span class="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full font-bold">✓ ${latestDate}</span>`;
            } else {
                badgeHtml = `<span class="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded-full font-bold">⚠️ ${latestDate}</span>`;
            }
        }

        return `
            <div onclick="selectPriestChildForConfession(${mId})" class="p-3 rounded-2xl border cursor-pointer transition flex items-center justify-between gap-2 ${isSelected ? 'bg-purple-50 border-purple-500 shadow-xs' : 'bg-slate-50/80 hover:bg-purple-50/40 border-slate-200'}">
                <div class="min-w-0">
                    <p class="text-xs sm:text-sm font-black text-slate-800 truncate">${m["الاسم ثلاثي"]}</p>
                    <p class="text-[11px] text-slate-500 font-semibold truncate mt-0.5">🏠 ${m["اسم رب الاسرة"] || "-"} | 📍 ${m["المنطقة"] || "-"}</p>
                </div>
                <div class="flex flex-col items-end shrink-0 gap-1">
                    ${badgeHtml}
                    <span class="text-[10px] font-bold text-purple-700">فتح السجل ←</span>
                </div>
            </div>
        `;
    }).join('');

    if (filtered.length > 60) {
        html += `<div class="md:col-span-2 text-center py-2 text-[11px] text-slate-500 font-bold">يتم عرض أول 60 نتيجة من إجمالي ${filtered.length} — اكتب الاسم للوصول السريع</div>`;
    }
    listEl.innerHTML = html;
}

function selectPriestChildForConfession(memberId) {
    const member = priestSpiritualChildren.find(m => String(m["ID"]) === String(memberId));
    if (!member) return;
    selectedConfessorMember = member;
    showOlderConfessions = false;
    filterPriestChildrenList();
    renderSelectedConfessorPanel();
    setTimeout(() => {
        document.getElementById('confessionDetailPanel')?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }, 60);
}

function renderSelectedConfessorPanel() {
    const panel = document.getElementById('confessionDetailPanel');
    if (!panel || !selectedConfessorMember) return;

    const m = selectedConfessorMember;
    const allHistory = getMemberConfessionHistory(m);

    // تصفية اعترافات آخر 12 شهراً (365 يوماً)
    const last12MonthsHistory = allHistory.filter(item => {
        const d = getDaysSinceDate(item.date);
        return d === null || d <= 365;
    });
    const olderHistory = allHistory.filter(item => {
        const d = getDaysSinceDate(item.date);
        return d !== null && d > 365;
    });

    const displayedHistory = showOlderConfessions ? allHistory : last12MonthsHistory;
    const latestDate = allHistory.length > 0 ? allHistory[0].date : "لم يُسجل بعد";
    const latestDays = allHistory.length > 0 ? getDaysSinceDate(allHistory[0].date) : null;
    const relText = latestDays !== null ? ` (${formatRelativeArabicDays(latestDays)})` : "";

    const age = calculateAge(m["تاريخ الميلاد"], m["الرقم القومي"]);
    const phone = m["تليفون العمل/المحمول"] || m["هاتف الاسرة"] || "-";

    const now = new Date();
    const todayStr = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()}`;

    const timelineHtml = displayedHistory.length === 0
        ? `<div class="text-center py-8 bg-slate-50 rounded-2xl border border-dashed border-slate-200 text-xs text-slate-500 font-bold">لا توجد اعترافات مسجلة خلال الـ 12 شهراً الماضية.</div>`
        : displayedHistory.map((entry, idx) => {
            const dSince = getDaysSinceDate(entry.date);
            const relBadge = dSince !== null ? `<span class="text-[10px] bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-full font-bold">${formatRelativeArabicDays(dSince)}</span>` : "";
            const delBtn = entry.fromSheet && entry.id
                ? `<button type="button" onclick="deleteConfessionEntry(${entry.id})" class="text-[11px] font-bold text-rose-600 hover:bg-rose-50 px-2.5 py-1 rounded-lg transition">حذف</button>`
                : "";
            return `
                <div class="flex items-center justify-between gap-3 p-3.5 rounded-2xl border ${idx === 0 ? 'bg-purple-50/60 border-purple-200' : 'bg-white border-slate-200/80'}">
                    <div class="flex items-start gap-3">
                        <div class="w-8 h-8 rounded-xl ${idx === 0 ? 'bg-purple-700 text-white' : 'bg-slate-100 text-slate-700'} flex items-center justify-center font-black text-xs shrink-0 mt-0.5">✝</div>
                        <div>
                            <div class="flex items-center gap-2 flex-wrap">
                                <span class="text-sm font-black text-slate-900 font-mono" dir="ltr">${entry.date}</span>
                                ${relBadge}
                                ${idx === 0 ? '<span class="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-black">أحدث اعتراف</span>' : ''}
                            </div>
                            <p class="text-[11px] text-slate-600 font-semibold mt-0.5">أب الاعتراف: <strong>${entry.priest || currentUser.ServantName}</strong></p>
                            ${entry.notes ? `<p class="text-xs text-purple-900 bg-purple-100/60 px-2.5 py-1 rounded-lg font-bold mt-1.5">📝 ${entry.notes}</p>` : ''}
                        </div>
                    </div>
                    <div>${delBtn}</div>
                </div>
            `;
        }).join('');

    const olderToggleHtml = olderHistory.length > 0
        ? `<div class="text-center pt-2">
               <button type="button" onclick="toggleOlderConfessionsView()" class="text-xs font-black text-indigo-700 hover:underline">
                   ${showOlderConfessions ? '▲ إخفاء السجلات الأقدم من 12 شهر' : `▼ عرض السجل الأقدم من 12 شهر (${olderHistory.length} سجل)`}
               </button>
           </div>`
        : "";

    panel.innerHTML = `
        <div class="bg-purple-50/80 p-5 border-b border-purple-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
                <div class="flex items-center gap-2 flex-wrap">
                    <h4 class="text-base sm:text-lg font-black text-slate-900">${m["الاسم ثلاثي"]}</h4>
                    ${age !== null ? `<span class="text-[11px] bg-white border border-slate-200 text-slate-700 px-2.5 py-0.5 rounded-full font-bold">${age} سنة</span>` : ''}
                    ${m["المرحلة"] ? `<span class="text-[11px] bg-indigo-100 text-indigo-800 px-2.5 py-0.5 rounded-full font-bold">${m["المرحلة"]} ${m["الصف"] ? '(' + m["الصف"] + ')' : ''}</span>` : ''}
                </div>
                <p class="text-xs text-slate-600 font-semibold mt-1">🏠 الأسرة: <strong>${m["اسم رب الاسرة"] || "-"}</strong> | 📍 المنطقة: <strong>${m["المنطقة"] || "-"}</strong> | 📱 <span class="font-mono" dir="ltr">${phone}</span></p>
            </div>
            <div class="flex items-center gap-2 flex-wrap">
                ${renderContactButtons(phone)}
                <button type="button" onclick="closeSelectedConfessorPanel()" class="px-3 py-1.5 rounded-xl bg-white border border-slate-200 hover:bg-slate-100 text-slate-600 font-bold text-xs">إغلاق ✕</button>
            </div>
        </div>

        <div class="p-5 sm:p-6 space-y-6">
            <!-- ملخص الاعتراف -->
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div class="p-3.5 rounded-2xl bg-indigo-50/70 border border-indigo-100 flex items-center justify-between">
                    <span class="text-xs font-bold text-indigo-900">🗓️ آخر اعتراف مسجل:</span>
                    <span class="text-xs sm:text-sm font-black text-indigo-950">${latestDate}${relText}</span>
                </div>
                <div class="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-100 flex items-center justify-between">
                    <span class="text-xs font-bold text-emerald-900">📊 عدد مرات الاعتراف (آخر 12 شهر):</span>
                    <span class="text-xs sm:text-sm font-black text-emerald-950">${last12MonthsHistory.length} مرة</span>
                </div>
            </div>

            <!-- تسجيل اعتراف جديد -->
            <div class="bg-slate-50 p-4 rounded-2xl border border-slate-200 space-y-3">
                <h5 class="text-xs font-black text-purple-900">✝️ تسجيل اعتراف جديد</h5>
                <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 items-end">
                    <div>
                        <label class="block text-[11px] font-bold text-slate-600 mb-1">تاريخ الاعتراف (DD/MM/YYYY)</label>
                        <input type="text" id="newConfessionDateInput" dir="ltr" value="${todayStr}" onblur="this.value = formatDisplayDate(this.value)" class="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-black text-center font-mono outline-none focus:ring-2 focus:ring-purple-600">
                    </div>
                    <div class="sm:col-span-2">
                        <label class="block text-[11px] font-bold text-slate-600 mb-1">ملاحظة خاصة بأب الاعتراف (اختياري — سرية تماماً)</label>
                        <input type="text" id="newConfessionNotesInput" placeholder="مثال: متابعة قانون روحي / زيارة منزلية..." class="w-full p-2.5 bg-white border border-slate-300 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-purple-600">
                    </div>
                </div>
                <button type="button" id="btnRecordConfessionNow" onclick="submitNewConfessionEntry()" class="w-full py-3 bg-purple-700 hover:bg-purple-800 text-white font-black rounded-xl text-xs sm:text-sm shadow-md transition cursor-pointer">
                    ✝️ حفظ وتسجيل الاعتراف الآن
                </button>
            </div>

            <!-- الخط الزمني لآخر 12 شهر -->
            <div class="space-y-3">
                <div class="flex items-center justify-between">
                    <h5 class="text-xs sm:text-sm font-black text-slate-800">📜 سجل الاعترافات خلال آخر 12 شهراً (${last12MonthsHistory.length})</h5>
                </div>
                <div class="space-y-2.5">
                    ${timelineHtml}
                </div>
                ${olderToggleHtml}
            </div>
        </div>
    `;
    panel.classList.remove('hidden');
}

function closeSelectedConfessorPanel() {
    selectedConfessorMember = null;
    const panel = document.getElementById('confessionDetailPanel');
    if (panel) {
        panel.classList.add('hidden');
        panel.innerHTML = "";
    }
    filterPriestChildrenList();
}

function toggleOlderConfessionsView() {
    showOlderConfessions = !showOlderConfessions;
    renderSelectedConfessorPanel();
}

async function submitNewConfessionEntry() {
    if (!selectedConfessorMember || !isPriestUser(currentUser)) return;
    const dateInp = document.getElementById('newConfessionDateInput');
    const notesInp = document.getElementById('newConfessionNotesInput');
    const btn = document.getElementById('btnRecordConfessionNow');

    const confDate = formatDisplayDate(dateInp?.value || "");
    const notes = (notesInp?.value || "").trim();

    if (!confDate || !isValidCalendarDate(confDate)) {
        alert("⚠️ يرجى إدخال تاريخ اعتراف صحيح بصيغة DD/MM/YYYY.");
        dateInp?.focus();
        return;
    }

    const existingHist = getMemberConfessionHistory(selectedConfessorMember);
    if (existingHist.some(h => h.date === confDate && h.fromSheet)) {
        if (!confirm(`تنبيه: يوجد اعتراف مسجل بالفعل لهذا الابن بتاريخ ${confDate}.
هل تريد تسجيل اعتراف آخر في نفس اليوم؟`)) return;
    }

    if (btn) { btn.disabled = true; btn.innerText = "جاري التسجيل..."; }
    try {
        const res = await apiPost({
            action: "add_confession",
            data: {
                MemberID: selectedConfessorMember["ID"],
                MemberName: selectedConfessorMember["الاسم ثلاثي"],
                ConfessionDate: confDate,
                Notes: notes
            }
        });
        if (res.status === "success") {
            if (res.record) {
                priestConfessionsLogs.push(sanitizeRecordFields(res.record));
            }
            if (res.latestConfessionDate) {
                selectedConfessorMember["تاريخ اخر اعتراف"] = res.latestConfessionDate;
            }
            updatePriestConfessionsKpis();
            filterPriestChildrenList();
            renderSelectedConfessorPanel();
            alert("✓ تم تسجيل الاعتراف وتحديث تاريخ آخر اعتراف بنجاح.");
        } else {
            alert("خطأ: " + (res.message || "تعذر تسجيل الاعتراف"));
        }
    } catch (e) {
        alert("تعذر الاتصال بالسيرفر أثناء تسجيل الاعتراف.");
    } finally {
        if (btn) { btn.disabled = false; btn.innerText = "✝️ حفظ وتسجيل الاعتراف الآن"; }
    }
}

async function deleteConfessionEntry(confessionId) {
    if (!confirm("هل أنت متأكد من حذف سجل الاعتراف هذا؟")) return;
    try {
        const res = await apiPost({
            action: "delete_confession",
            data: { ID: confessionId }
        });
        if (res.status === "success") {
            priestConfessionsLogs = priestConfessionsLogs.filter(l => Number(l["ID"]) !== Number(confessionId));
            if (selectedConfessorMember && res.latestConfessionDate !== undefined) {
                selectedConfessorMember["تاريخ اخر اعتراف"] = res.latestConfessionDate;
            }
            updatePriestConfessionsKpis();
            filterPriestChildrenList();
            renderSelectedConfessorPanel();
        } else {
            alert("خطأ: " + (res.message || "تعذر حذف السجل"));
        }
    } catch (e) {
        alert("تعذر الاتصال بالسيرفر.");
    }
}


// ==================== نظام الكاش والمزامنة ومؤشر الاتصال (Offline-First v34) ====================
let isAppOnline = navigator.onLine;
let isOfflineSession = false;
let isSyncingQueue = false;

let connectivityCheckTimer = null;
let isCheckingConnectivity = false;
let lastRenderedConnState = null;

async function checkRealConnectivity() {
    if (isCheckingConnectivity) return isAppOnline;
    if (!navigator.onLine) {
        updateConnectionIndicator(false);
        return false;
    }
    isCheckingConnectivity = true;
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timeoutId = controller ? setTimeout(() => controller.abort(), 1800) : null;
    try {
        // فحص اتصال إنترنت خارجي حقيقي (لا يتأثر بالملفات المحلية داخل APK الأندرويد أو كاش المتصفح)
        await fetch(`https://clients3.google.com/generate_204?ping=${Date.now()}`, {
            method: 'GET',
            mode: 'no-cors',
            cache: 'no-store',
            signal: controller ? controller.signal : undefined
        });
        if (timeoutId) clearTimeout(timeoutId);
        const wasOffline = !isAppOnline;
        updateConnectionIndicator(true);
        if (wasOffline) {
            loadServantsListForLogin();
            if (currentUser) syncOfflineQueue(false);
        }
        return true;
    } catch (e) {
        if (timeoutId) clearTimeout(timeoutId);
        updateConnectionIndicator(false);
        return false;
    } finally {
        isCheckingConnectivity = false;
    }
}

function initOfflineSupport() {
    updateConnectionIndicator(navigator.onLine);
    updatePendingSyncUI();
    checkRealConnectivity();

    window.addEventListener('online', () => {
        checkRealConnectivity();
    });

    window.addEventListener('offline', () => {
        updateConnectionIndicator(false);
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            checkRealConnectivity();
        }
    });

    window.addEventListener('focus', () => {
        checkRealConnectivity();
    });

    // فحص دوري كل ثانيتين (2000ms) وتثبيت الحالة لحين تغيّرها فعلياً
    if (connectivityCheckTimer) clearInterval(connectivityCheckTimer);
    connectivityCheckTimer = setInterval(() => {
        if (document.visibilityState === 'visible') {
            checkRealConnectivity();
        }
    }, 2000);
}

function updateConnectionIndicator(onlineState) {
    const nextState = Boolean(onlineState);
    isAppOnline = nextState;
    if (lastRenderedConnState === nextState) {
        return; // تثبيت المؤشر بدون إعادة رسم إلا عند تغيّر الحالة فعلياً
    }
    lastRenderedConnState = nextState;

    const headerBadge = document.getElementById('headerConnBadge');
    const landingBadge = document.getElementById('landingConnBadge');

    const applyBadge = (el) => {
        if (!el) return;
        if (isAppOnline) {
            el.className = "cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border bg-emerald-50 text-emerald-700 border-emerald-200 transition-all";
            el.innerHTML = `<span class="dot-online"></span><span>متصل</span>`;
        } else {
            el.className = "cursor-pointer inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black border bg-rose-50 text-rose-700 border-rose-200 transition-all";
            el.innerHTML = `<span class="dot-offline"></span><span>غير متصل (وضع الكاش)</span>`;
        }
    };

    applyBadge(headerBadge);
    applyBadge(landingBadge);
    updatePendingSyncUI();
}

function getSheetCacheStorageKey(sheetName) {
    const uKey = (sheetName === 'Confessions_Log' || sheetName === 'Priest_Members')
        ? `_${normalizeArabic(currentUser?.Username || 'guest')}`
        : '';
    return `church_sheet_cache_${sheetName}${uKey}`;
}

function saveCachedSheetData(sheetName, resObj) {
    if (!sheetName || !resObj) return;
    try {
        const toSave = {
            status: "success",
            data: resObj.data || [],
            areas: resObj.areas || [],
            savedAt: Date.now()
        };
        localStorage.setItem(getSheetCacheStorageKey(sheetName), JSON.stringify(toSave));
    } catch (e) {
        // إذا امتلأت مساحة التخزين، ننظف كاش سجل المراقبة الأقل أهمية
        try { localStorage.removeItem('church_sheet_cache_Audit_Log'); } catch (err) {}
    }
}

function getCachedSheetData(sheetName) {
    if (!sheetName) return null;
    try {
        const raw = localStorage.getItem(getSheetCacheStorageKey(sheetName));
        if (!raw) return null;
        return JSON.parse(raw);
    } catch (e) {
        return null;
    }
}

async function hashPasswordForOffline(username, password) {
    const rawStr = `church_v34::${String(username).trim()}::${String(password).trim()}`;
    try {
        if (window.crypto && window.crypto.subtle) {
            const buf = new TextEncoder().encode(rawStr);
            const hashBuf = await window.crypto.subtle.digest('SHA-256', buf);
            return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
        }
    } catch (e) {}
    // احتياطي FNV-1a في حال عدم توفر Web Crypto
    let h = 2166136261;
    for (let i = 0; i < rawStr.length; i++) {
        h ^= rawStr.charCodeAt(i);
        h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
    }
    return String(h >>> 0);
}

async function saveOfflineCredentials(username, password, userObj, token) {
    try {
        const authMap = JSON.parse(localStorage.getItem('church_offline_auth_map') || '{}');
        const h = await hashPasswordForOffline(username, password);
        authMap[String(username).trim()] = {
            hash: h,
            user: userObj,
            token: token,
            savedAt: Date.now()
        };
        localStorage.setItem('church_offline_auth_map', JSON.stringify(authMap));
    } catch (e) {}
}

async function verifyOfflineCredentials(username, password) {
    try {
        const authMap = JSON.parse(localStorage.getItem('church_offline_auth_map') || '{}');
        const rec = authMap[String(username).trim()];
        if (!rec || !rec.hash || !rec.user) return null;
        const h = await hashPasswordForOffline(username, password);
        if (h === rec.hash) return rec;
    } catch (e) {}
    return null;
}

function getOfflineSyncQueue() {
    try {
        const q = JSON.parse(localStorage.getItem('church_offline_sync_queue') || '[]');
        return Array.isArray(q) ? q : [];
    } catch (e) {
        return [];
    }
}

function saveOfflineSyncQueue(queue) {
    try {
        localStorage.setItem('church_offline_sync_queue', JSON.stringify(queue || []));
    } catch (e) {}
    updatePendingSyncUI();
}

function updatePendingSyncUI() {
    const btn = document.getElementById('pendingSyncBtn');
    const lbl = document.getElementById('pendingSyncLabel');
    if (!btn || !lbl) return;
    const queue = getOfflineSyncQueue();
    if (queue.length === 0) {
        btn.classList.add('hidden');
        return;
    }
    btn.classList.remove('hidden');
    if (isSyncingQueue) {
        lbl.innerText = `جاري المزامنة (${queue.length})...`;
        btn.disabled = true;
    } else {
        lbl.innerText = isAppOnline ? `مزامنة الآن (${queue.length})` : `بانتظار النت (${queue.length})`;
        btn.disabled = false;
    }
}

function queueOfflineOperation(bodyObj) {
    if (!bodyObj || bodyObj.sheet === 'Audit_Log') {
        return { status: "success", offlineQueued: true };
    }

    const queue = getOfflineSyncQueue();
    queue.push({
        id: `q_${Date.now()}_${Math.floor(Math.random() * 10000)}`,
        body: bodyObj,
        createdAt: new Date().toISOString()
    });
    saveOfflineSyncQueue(queue);

    // تحديث متفائل للكاش المحلي ليظهر السجل المضاف فوراً على الشاشة حتى قبل المزامنة
    try {
        if (bodyObj.action === 'batch_add' && bodyObj.sheet && Array.isArray(bodyObj.data)) {
            const cached = getCachedSheetData(bodyObj.sheet) || { status: "success", data: [], areas: [] };
            const baseId = Date.now();
            bodyObj.data.forEach((item, idx) => {
                cached.data.push({ ID: baseId + idx, ...item });
            });
            saveCachedSheetData(bodyObj.sheet, cached);
        } else if (bodyObj.action === 'add' && bodyObj.sheet && bodyObj.data) {
            const cached = getCachedSheetData(bodyObj.sheet) || { status: "success", data: [], areas: [] };
            cached.data.push({ ID: Date.now(), ...bodyObj.data });
            saveCachedSheetData(bodyObj.sheet, cached);
        } else if (bodyObj.action === 'add_confession' && bodyObj.data) {
            const cached = getCachedSheetData('Confessions_Log') || { status: "success", data: [], areas: [] };
            const tempRec = {
                ID: Date.now(),
                MemberID: bodyObj.data.MemberID,
                MemberName: bodyObj.data.MemberName,
                PriestName: currentUser?.ServantName || "",
                ConfessionDate: bodyObj.data.ConfessionDate,
                Notes: bodyObj.data.Notes || ""
            };
            cached.data.push(tempRec);
            saveCachedSheetData('Confessions_Log', cached);
            return {
                status: "success",
                offlineQueued: true,
                record: tempRec,
                latestConfessionDate: bodyObj.data.ConfessionDate,
                message: "تم الحفظ في الكاش المحلي (غير متصل) — سيتم المزامنة تلقائياً فور عودة الإنترنت."
            };
        }
    } catch (e) {}

    return {
        status: "success",
        offlineQueued: true,
        message: "تم الحفظ في الكاش المحلي (غير متصل) — سيتم المزامنة تلقائياً فور عودة الإنترنت."
    };
}

async function syncOfflineQueue(showAlertIfEmpty = false) {
    if (isSyncingQueue) return;
    const queue = getOfflineSyncQueue();
    if (queue.length === 0) {
        if (showAlertIfEmpty) alert("✓ جميع البيانات متزامنة بالفعل مع السيرفر.");
        return;
    }
    if (!navigator.onLine) {
        if (showAlertIfEmpty) alert("⚠️ لا يوجد اتصال بالإنترنت حالياً. ستتم المزامنة تلقائياً فور عودة الاتصال.");
        return;
    }

    isSyncingQueue = true;
    updatePendingSyncUI();

    let syncedCount = 0;
    const remaining = [];
    let authFailed = false;

    for (let i = 0; i < queue.length; i++) {
        const item = queue[i];
        try {
            const payload = {
                ...item.body,
                token: sessionToken,
                user: currentUser ? currentUser.ServantName : ""
            };
            const response = await fetch(API_URL, { method: 'POST', body: JSON.stringify(payload) });
            const res = await response.json();
            if (res.status === "success") {
                syncedCount++;
            } else if (res.status === "unauthorized") {
                authFailed = true;
                remaining.push(...queue.slice(i));
                break;
            } else {
                // في حالة خطأ بيانات منطقي، نتجاهل هذا العنصر حتى لا يعطل باقي الطابور
                syncedCount++;
            }
        } catch (err) {
            // انقطع الإنترنت مرة أخرى أثناء المزامنة
            updateConnectionIndicator(false);
            remaining.push(...queue.slice(i));
            break;
        }
    }

    isSyncingQueue = false;
    saveOfflineSyncQueue(remaining);

    if (authFailed) {
        alert(`⚠️ تم الاحتفاظ بـ (${remaining.length}) عملية في الكاش، يرجى إعادة تسجيل الدخول الآن لإتمام مزامنتها مع السيرفر.`);
        handleSessionExpired();
        return;
    }

    if (syncedCount > 0) {
        alert(`✓ تمت مزامنة (${syncedCount}) عملية بنجاح مع السيرفر!`);
        if (currentTab) {
            loadData(true);
        }
    }
}

async function warmOfflineCachesInBackground() {
    if (!navigator.onLine || !currentUser) return;
    const sheetsToWarm = [];
    const role = currentUser.Role;
    if (role === "Admin" || role === "Priest") {
        sheetsToWarm.push("Names", "Family name", "Sunday_School", "Visitations", "Meetings_Attendance");
        if (isPriestUser(currentUser)) {
            sheetsToWarm.push("Priest_Members", "Confessions_Log");
        }
    } else if (role === "SundaySchool_Admin") {
        sheetsToWarm.push("Names", "Family name", "Sunday_School", "Meetings_Attendance", "Servants");
    } else {
        sheetsToWarm.push("Names", "Family name", "Sunday_School", "Visitations");
    }

    for (const sh of sheetsToWarm) {
        if (!navigator.onLine) break;
        try {
            await apiFetch(`${API_URL}?sheet=${encodeURIComponent(sh)}`);
        } catch (e) {}
    }
}


// ==================== سجل متابعة اعترافات الخدام (داخل تبويب إدارة الخدام) ====================
function switchServantsView(view) {
    currentServantsView = view;
    const btnList = document.getElementById('btnServantsList');
    const btnConf = document.getElementById('btnServantsConfessions');
    const cardsSec = document.getElementById('standardCardsContainer');
    const searchSec = document.getElementById('standardSearchContainer');
    const confSec = document.getElementById('servantsConfessionsSection');
    const btnAdd = document.getElementById('btnAddNewRecord');

    if (view === 'list') {
        if (btnList) btnList.className = "px-4 py-2 rounded-lg text-xs font-black transition bg-white text-purple-700 shadow-sm";
        if (btnConf) btnConf.className = "px-4 py-2 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
        cardsSec?.classList.remove('hidden');
        searchSec?.classList.remove('hidden');
        confSec?.classList.add('hidden');
        btnAdd?.classList.remove('hidden');
        renderStandardCards();
    } else {
        if (btnConf) btnConf.className = "px-4 py-2 rounded-lg text-xs font-black transition bg-white text-purple-700 shadow-sm";
        if (btnList) btnList.className = "px-4 py-2 rounded-lg text-xs font-black transition text-slate-600 hover:text-slate-900";
        cardsSec?.classList.add('hidden');
        searchSec?.classList.add('hidden');
        confSec?.classList.remove('hidden');
        btnAdd?.classList.add('hidden');
        initServantsConfessionsView();
    }
}

function getServantConfessionFollowupRank(s, origIdx) {
    const role = String(s["Role"] || "").trim();
    const stageNorm = normalizeArabic(s["AssignedStage"] || "");
    const isSSStage = ["حضانه", "ابتدائي", "اعدادي", "ثانوي"].some(st => stageNorm.includes(st));

    // 1. أمناء عموم الخدمة
    if (role === "SundaySchool_Admin") {
        return { group: 1, groupLabel: "أمناء عموم الخدمة", stageOrd: 0, gradeOrd: 0, origIdx };
    }
    // 2. أمناء المراحل
    if (role === "Stage_Leader") {
        return { group: 2, groupLabel: "أمناء المراحل", stageOrd: getMeetingStageOrder(s["AssignedStage"]), gradeOrd: 0, origIdx };
    }
    // 3. خدام الفصول (حضانة -> ابتدائي -> إعدادي -> ثانوي، وبالصفوف)
    if (isSSStage) {
        return {
            group: 3,
            groupLabel: "خدام الفصول",
            stageOrd: getMeetingStageOrder(s["AssignedStage"]),
            gradeOrd: getMeetingGradeOrder(s["AssignedStage"], s["AssignedGrade"]),
            origIdx
        };
    }
    // 4. الخدام غير المكلفين بفصول
    return { group: 4, groupLabel: "الخدام غير المكلفين بفصول", stageOrd: 9, gradeOrd: 99, origIdx };
}

async function initServantsConfessionsView() {
    const yearSel = document.getElementById('servantsConfYearSelect');
    if (yearSel && !yearSel.value) {
        yearSel.value = String(new Date().getFullYear());
    }

    if (servantsCacheData.length === 0) {
        try {
            const res = await apiFetch(`${API_URL}?sheet=Servants`);
            if (res.status === "success") servantsCacheData = res.data;
        } catch (e) {}
    }

    if (namesCacheData.length === 0) {
        try {
            const [res, famRes] = await Promise.all([
                apiFetch(`${API_URL}?sheet=Names`),
                apiFetch(`${API_URL}?sheet=${encodeURIComponent("Family name")}`).catch(() => ({ status: "err" }))
            ]);
            if (res.status === "success") {
                namesCacheData = ((famRes.status === "success") ? mergeFamilySheetIntoNames(res.data, famRes.data) : res.data).map(sanitizeRecordFields);
            }
        } catch (e) {}
    }

    try {
        const res = await apiFetch(`${API_URL}?sheet=Servants_Confessions_Summary`);
        if (res.status === "success" && Array.isArray(res.data)) {
            servantsConfessionsSummaryData = res.data.map(r => ({
                MemberID: String(r.MemberID || "").trim(),
                MemberName: String(r.MemberName || "").trim(),
                PriestName: String(r.PriestName || "").trim(),
                ConfessionDate: formatDisplayDate(r.ConfessionDate) || String(r.ConfessionDate || "").trim()
            }));
        }
    } catch (e) {}

    renderServantsConfessionsList();
}

function renderServantsConfessionsList() {
    const container = document.getElementById('servantsConfListContainer');
    const kpiEl = document.getElementById('servantsConfKpiCards');
    if (!container) return;

    const yearMode = document.getElementById('servantsConfYearSelect')?.value || String(new Date().getFullYear());
    const searchQ = normalizeArabic(document.getElementById('servantsConfSearchInput')?.value || "").toLowerCase();
    const statusFilter = document.getElementById('servantsConfStatusFilter')?.value || "all";

    // استبعاد الأدمن والآباء الكهنة والموقوفين
    const targetServants = servantsCacheData
        .map((s, idx) => ({ s, idx }))
        .filter(({ s }) => {
            const status = String(s["Status"] || "").trim();
            const role = String(s["Role"] || "").trim();
            const username = String(s["Username"] || "").trim().toLowerCase();
            if (status === "موقوف" || username === "admin" || role === "Admin" || role === "Priest" || isPriestUser(s)) return false;
            return true;
        });

    const rows = targetServants.map(({ s, idx }) => {
        const sName = String(s["ServantName"] || "").trim();
        const normSName = normalizeArabic(sName);
        const sTokens = normSName.split(" ").filter(Boolean);

        // مطابقة الخادم مع سجل العضو في شيت Names لاستخراج أب الاعتراف و ID وتاريخ آخر اعتراف
        const memberRec = namesCacheData.find(m => {
            const mNorm = normalizeArabic(m["الاسم ثلاثي"]);
            if (mNorm === normSName) return true;
            const mTokens = mNorm.split(" ").filter(Boolean);
            if (sTokens.length >= 3 && mTokens.length >= 3 && sTokens.slice(0, 3).join(" ") === mTokens.slice(0, 3).join(" ")) return true;
            return false;
        });

        const memberId = memberRec ? String(memberRec["ID"] || "").trim() : "";
        let fatherName = memberRec ? String(memberRec["اب الاعتراف"] || "").trim() : "";
        const phone = memberRec ? (memberRec["تليفون العمل/المحمول"] || memberRec["هاتف الاسرة"] || "") : "";

        // جمع تواريخ الاعتراف من Confessions_Log (ملخص الخدام) + تاريخ آخر اعتراف في Names
        const allDatesSet = new Set();
        servantsConfessionsSummaryData.forEach(log => {
            const lMid = String(log.MemberID || "").trim();
            const lNorm = normalizeArabic(log.MemberName);
            const isMatch = (memberId && lMid && lMid === memberId) || (lNorm && lNorm === normSName);
            if (isMatch && log.ConfessionDate) {
                allDatesSet.add(log.ConfessionDate);
                if (!fatherName && log.PriestName) fatherName = log.PriestName;
            }
        });

        const legacyDate = memberRec ? formatDisplayDate(memberRec["تاريخ اخر اعتراف"]) : "";
        if (legacyDate) allDatesSet.add(legacyDate);

        // تجميع التواريخ حسب كل سنة ميلادية لوحدها
        const datesByYear = {};
        Array.from(allDatesSet).forEach(dStr => {
            const parts = String(dStr).split("/");
            const yr = (parts.length === 3 && /^\d{4}$/.test(parts[2])) ? parts[2] : "غير محدد";
            if (!datesByYear[yr]) datesByYear[yr] = [];
            datesByYear[yr].push(dStr);
        });
        Object.keys(datesByYear).forEach(yr => {
            datesByYear[yr].sort((a, b) => parseDateForSort(b) - parseDateForSort(a));
        });

        // تصفية التواريخ على مدار السنة الميلادية المختارة (أو كل السنوات أو آخر 12 شهر)
        const periodDates = Array.from(allDatesSet).filter(dStr => {
            if (yearMode === "all_by_year") return true;
            if (yearMode === "last12m") {
                const days = getDaysSinceDate(dStr);
                return days !== null && days <= 365;
            }
            const parts = String(dStr).split("/");
            return parts.length === 3 && parts[2] === yearMode;
        }).sort((a, b) => parseDateForSort(b) - parseDateForSort(a));

        const allSortedDates = Array.from(allDatesSet).sort((a, b) => parseDateForSort(b) - parseDateForSort(a));
        const latestDate = allSortedDates.length > 0 ? allSortedDates[0] : "";
        const daysSinceLatest = latestDate ? getDaysSinceDate(latestDate) : null;
        const isRegular = daysSinceLatest !== null && daysSinceLatest <= 90;

        const rank = getServantConfessionFollowupRank(s, idx);
        const scope = [s["AssignedStage"], s["AssignedGrade"], s["AssignedClass"]].filter(v => v && String(v).trim() !== "" && String(v).trim() !== "الكل").join(" - ") || (s["AssignedStage"] || "الخدمة");

        return {
            name: sName,
            fatherName: fatherName || "غير مسجل",
            phone,
            role: s["Role"] || "Class_Servant",
            scope,
            rank,
            periodDates,
            datesByYear,
            latestDate,
            daysSinceLatest,
            isRegular
        };
    }).sort((a, b) => {
        if (a.rank.group !== b.rank.group) return a.rank.group - b.rank.group;
        if (a.rank.stageOrd !== b.rank.stageOrd) return a.rank.stageOrd - b.rank.stageOrd;
        if (a.rank.gradeOrd !== b.rank.gradeOrd) return a.rank.gradeOrd - b.rank.gradeOrd;
        return a.name.localeCompare(b.name, 'ar');
    });

    const filtered = rows.filter(r => {
        if (statusFilter === "regular" && !r.isRegular) return false;
        if (statusFilter === "overdue" && r.isRegular) return false;
        if (searchQ) {
            const blob = normalizeArabic(`${r.name} ${r.fatherName} ${r.scope}`).toLowerCase();
            if (!blob.includes(searchQ)) return false;
        }
        return true;
    });

    currentServantsConfRows = filtered;

    const recCount = document.getElementById('recordCount');
    if (recCount) recCount.innerText = `${filtered.length} خادم`;

    const totalCount = filtered.length;
    const regularCount = filtered.filter(r => r.isRegular).length;
    const overdueCount = filtered.filter(r => !r.isRegular && r.latestDate).length;
    const neverCount = filtered.filter(r => !r.latestDate).length;

    if (kpiEl) {
        kpiEl.innerHTML = `
            <div class="bg-white/95 p-4 rounded-2xl border border-purple-200 shadow-sm text-center"><span class="block text-xs font-bold text-slate-500 mb-1">إجمالي الخدام</span><span class="text-2xl font-black text-purple-700">${totalCount}</span></div>
            <div class="bg-white/95 p-4 rounded-2xl border border-emerald-200 shadow-sm text-center"><span class="block text-xs font-bold text-slate-500 mb-1">منتظمون (آخر 3 شهور)</span><span class="text-2xl font-black text-emerald-600">${regularCount}</span></div>
            <div class="bg-white/95 p-4 rounded-2xl border border-amber-200 shadow-sm text-center"><span class="block text-xs font-bold text-slate-500 mb-1">متأخرون (+3 شهور)</span><span class="text-2xl font-black text-amber-600">${overdueCount}</span></div>
            <div class="bg-white/95 p-4 rounded-2xl border border-rose-200 shadow-sm text-center"><span class="block text-xs font-bold text-slate-500 mb-1">لم يُسجل لهم اعتراف</span><span class="text-2xl font-black text-rose-600">${neverCount}</span></div>
        `;
    }

    if (filtered.length === 0) {
        container.innerHTML = `<div class="text-center py-14 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400 font-bold text-xs">لا يوجد خدام مطابقون للبحث المحدد</div>`;
        return;
    }

    let html = "";
    let lastGroup = -1;
    let counter = 1;

    filtered.forEach(r => {
        if (r.rank.group !== lastGroup) {
            lastGroup = r.rank.group;
            html += `<div class="pt-2"><span class="inline-block px-3.5 py-1 rounded-xl bg-purple-900 text-white text-xs font-black shadow-xs">${r.rank.groupLabel}</span></div>`;
        }

        const statusBadge = r.isRegular
            ? `<span class="text-[10px] bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 rounded-full font-black">✓ منتظم</span>`
            : r.latestDate
                ? `<span class="text-[10px] bg-amber-50 text-amber-800 border border-amber-200 px-2.5 py-0.5 rounded-full font-black">⚠️ متأخر (${formatRelativeArabicDays(r.daysSinceLatest)})</span>`
                : `<span class="text-[10px] bg-rose-50 text-rose-700 border border-rose-200 px-2.5 py-0.5 rounded-full font-black">لم يُسجل</span>`;

        let datesHtml = "";
        if (yearMode === "all_by_year") {
            const yrs = Object.keys(r.datesByYear || {}).sort((a, b) => b.localeCompare(a));
            if (yrs.length === 0) {
                datesHtml = `<span class="text-[11px] text-slate-400 font-bold">لا توجد اعترافات مسجلة</span>`;
            } else {
                datesHtml = `<div class="w-full space-y-1.5 mt-1">` + yrs.map(yr => `
                    <div class="flex flex-wrap items-center gap-1.5">
                        <span class="text-[10px] font-black bg-slate-800 text-white px-2 py-0.5 rounded-md">سنة ${yr} (${r.datesByYear[yr].length})</span>
                        ${r.datesByYear[yr].map(d => `<span class="inline-block bg-purple-50 text-purple-900 border border-purple-200 px-2 py-0.5 rounded-lg text-[11px] font-mono font-bold">✝ ${d}</span>`).join(" ")}
                    </div>
                `).join("") + `</div>`;
            }
        } else {
            datesHtml = r.periodDates.length > 0
                ? r.periodDates.map(d => `<span class="inline-block bg-purple-50 text-purple-900 border border-purple-200 px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold">✝ ${d}</span>`).join(" ")
                : `<span class="text-[11px] text-slate-400 font-bold">لا توجد اعترافات مسجلة في (${yearMode === 'last12m' ? 'آخر 12 شهراً' : 'سنة ' + yearMode})</span>`;
        }

        html += `
            <div class="bg-white/95 rounded-2xl p-4 border border-slate-200 shadow-xs space-y-2.5">
                <div class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <div class="flex items-center gap-2 flex-wrap">
                        <span class="w-6 h-6 rounded-lg bg-purple-100 text-purple-800 flex items-center justify-center text-[11px] font-black">${counter++}</span>
                        <h4 class="text-sm font-black text-slate-800">${r.name}</h4>
                        <span class="text-[11px] bg-indigo-50 text-indigo-800 border border-indigo-200 px-2.5 py-0.5 rounded-full font-bold">أب الاعتراف: ${r.fatherName}</span>
                        <span class="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full font-bold">${r.scope}</span>
                    </div>
                    <div class="flex items-center gap-1.5 flex-wrap">
                        ${statusBadge}
                        <span class="text-[11px] font-black text-purple-800 bg-purple-50 px-2 py-0.5 rounded-lg border border-purple-100">${r.periodDates.length} مرة</span>
                    </div>
                </div>
                <div class="pt-2 border-t border-slate-100 flex flex-wrap gap-1.5 items-center">
                    <span class="text-[11px] font-black text-slate-500 ml-1">تواريخ الاعتراف:</span>
                    ${datesHtml}
                </div>
            </div>
        `;
    });

    container.innerHTML = html;
}

function shareServantsConfessionsWhatsApp() {
    if (!currentServantsConfRows || currentServantsConfRows.length === 0) {
        alert("لا توجد بيانات للمشاركة!");
        return;
    }
    const yearMode = document.getElementById('servantsConfYearSelect')?.value || String(new Date().getFullYear());
    const periodLabel = yearMode === "last12m" ? "آخر 12 شهراً" : `سنة ${yearMode}`;
    let text = `*تقرير متابعة اعترافات الخدام (${periodLabel})*

`;
    let lastG = -1;
    currentServantsConfRows.forEach((r, idx) => {
        if (r.rank.group !== lastG) {
            lastG = r.rank.group;
            text += `
📌 *${r.rank.groupLabel}*
`;
        }
        text += `${idx + 1}. *${r.name}* — أب الاعتراف: ${r.fatherName}
`;
        text += `   ✝ التواريخ (${r.periodDates.length}): ${r.periodDates.length > 0 ? r.periodDates.join(' ، ') : 'لا يوجد'}
`;
    });
    shareToWhatsApp(text);
}

function exportServantsConfessionsExcel() {
    if (!currentServantsConfRows || currentServantsConfRows.length === 0) {
        alert("لا توجد بيانات للتصدير!");
        return;
    }
    const yearMode = document.getElementById('servantsConfYearSelect')?.value || String(new Date().getFullYear());
    const headers = ["م", "التصنيف", "اسم الخادم", "أب الاعتراف", "مجال الخدمة", "عدد الاعترافات", "تواريخ الاعتراف", "آخر اعتراف"];
    const csvRows = [headers.join(",")];
    currentServantsConfRows.forEach((r, idx) => {
        const vals = [
            idx + 1,
            r.rank.groupLabel,
            r.name,
            r.fatherName,
            r.scope,
            r.periodDates.length,
            r.periodDates.join(" - "),
            r.latestDate || "-"
        ].map(v => `"${String(v ?? "").replace(/"/g, '""')}"`);
        csvRows.push(vals.join(","));
    });
    const csvString = "\uFEFF" + csvRows.join("\n");
    const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `متابعة_اعترافات_الخدام_${yearMode}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
}


// ==================== محرك تصدير التقارير الرسمية PDF مع لوجو الكنيسة ومنع قص الصفحات (v40) ====================
function openOfficialPdfPreview(reportTitle, subtitle, bodyHtml) {
    const modal = document.getElementById('officialPdfPreviewModal');
    const contentEl = document.getElementById('officialPdfContent');
    const titleEl = document.getElementById('officialPdfModalTitle');
    if (!modal || !contentEl) return;

    const nowStr = new Date().toLocaleDateString('ar-EG', { year: 'numeric', month: 'long', day: 'numeric' });
    const supervisor = currentUser ? currentUser.ServantName : "إدارة الكنيسة";

    if (titleEl) titleEl.innerText = reportTitle;

    contentEl.innerHTML = `
        <div class="pdf-avoid-break flex items-center justify-between gap-4 pb-4 mb-5 border-b-2 border-blue-900">
            <div class="text-right">
                <p class="text-[11px] font-black text-blue-900">إيبارشية البحر الأحمر للأقباط الأرثوذكس</p>
                <h2 class="text-base sm:text-lg font-black text-slate-900 mt-0.5">كنيسة السيدة العذراء مريم والشهيدة بربارة بالقصير</h2>
                <p class="text-xs font-black text-indigo-800 mt-1">${reportTitle}</p>
                ${subtitle ? `<p class="text-[11px] font-bold text-slate-500 mt-0.5">${subtitle}</p>` : ''}
            </div>
            <img src="logo.png" alt="شعار الكنيسة" class="w-16 h-16 sm:w-20 sm:h-20 object-contain shrink-0">
            <div class="text-left text-[11px] font-bold text-slate-600 shrink-0">
                <p>التاريخ: <span class="text-slate-900">${nowStr}</span></p>
                <p class="mt-1">المسؤول: <span class="text-slate-900">${supervisor}</span></p>
            </div>
        </div>
        <div class="space-y-4">
            ${bodyHtml}
        </div>
        <div class="pdf-avoid-break mt-8 pt-3 border-t border-slate-200 flex justify-between items-center text-[10px] font-bold text-slate-500">
            <span>منظومة الخدمة والرعاية الكنسية — تقرير رسمي</span>
            <span>توقيع أمين الخدمة / الأب الكاهن: ..........................</span>
        </div>
    `;

    modal.classList.remove('hidden');
    document.body.classList.add('pdf-print-mode');
}

function closeOfficialPdfPreview() {
    const modal = document.getElementById('officialPdfPreviewModal');
    if (modal) modal.classList.add('hidden');
    document.body.classList.remove('pdf-print-mode');
}

function triggerOfficialPdfPrint() {
    document.body.classList.add('pdf-print-mode');
    window.print();
}

// 1. PDF رسمي: متابعة اعترافات الخدام (كل خادم تحته مرات الاعتراف لكل سنة لوحدها + أب الاعتراف)
function exportServantsConfessionsPdf() {
    if (!currentServantsConfRows || currentServantsConfRows.length === 0) {
        alert("لا توجد بيانات في تقرير متابعة اعترافات الخدام لتصديرها!");
        return;
    }
    const yearMode = document.getElementById('servantsConfYearSelect')?.value || String(new Date().getFullYear());
    const periodLabel = yearMode === "all_by_year" ? "جميع السنوات (كل سنة على حدة)" : yearMode === "last12m" ? "آخر 12 شهراً" : `السنة الميلادية ${yearMode}`;

    let html = "";
    let lastGroup = -1;
    let counter = 1;

    currentServantsConfRows.forEach(r => {
        if (r.rank.group !== lastGroup) {
            if (lastGroup !== -1) html += `</tbody></table>`;
            lastGroup = r.rank.group;
            html += `
                <div class="pdf-group-title mt-4 mb-2 px-3 py-1.5 rounded-lg bg-blue-900 text-white text-xs font-black" style="-webkit-print-color-adjust:exact;print-color-adjust:exact;">
                    ${r.rank.groupLabel}
                </div>
                <table class="pdf-table mb-3">
                    <thead>
                        <tr>
                            <th style="width:6%;text-align:center;">م</th>
                            <th style="width:24%;">اسم الخادم ومجال الخدمة</th>
                            <th style="width:18%;">أب الاعتراف</th>
                            <th style="width:10%;text-align:center;">العدد</th>
                            <th style="width:42%;">تواريخ الاعتراف (حسب السنة الميلادية)</th>
                        </tr>
                    </thead>
                    <tbody>
            `;
        }

        let datesCellHtml = "";
        if (yearMode === "all_by_year") {
            const yrs = Object.keys(r.datesByYear || {}).sort((a, b) => b.localeCompare(a));
            if (yrs.length === 0) {
                datesCellHtml = `<span style="color:#94a3b8;">لم يُسجل اعتراف</span>`;
            } else {
                datesCellHtml = yrs.map(yr => `
                    <div style="margin-bottom:4px;">
                        <strong style="color:#1e3a8a;">[${yr}] (${r.datesByYear[yr].length} مرة):</strong>
                        <span style="font-family:monospace;">${r.datesByYear[yr].join(" ، ")}</span>
                    </div>
                `).join("");
            }
        } else {
            datesCellHtml = r.periodDates.length > 0
                ? `<span style="font-family:monospace;font-weight:700;">${r.periodDates.join(" ، ")}</span>`
                : `<span style="color:#94a3b8;">لم يُسجل اعتراف خلال الفترة</span>`;
        }

        html += `
            <tr>
                <td style="text-align:center;font-weight:800;">${counter++}</td>
                <td><strong style="font-size:12px;">${r.name}</strong><div style="font-size:10px;color:#475569;margin-top:2px;">${r.scope}</div></td>
                <td style="font-weight:700;color:#1e3a8a;">${r.fatherName}</td>
                <td style="text-align:center;font-weight:900;">${r.periodDates.length}</td>
                <td>${datesCellHtml}</td>
            </tr>
        `;
    });

    if (lastGroup !== -1) html += `</tbody></table>`;
    openOfficialPdfPreview("تقرير متابعة اعترافات الخدام", `النطاق الزمني: ${periodLabel} — إجمالي الخدام: ${currentServantsConfRows.length}`, html);
}

// 2. PDF رسمي: تقرير الحضور المجمع لمدارس الأحد (بفترة)
function exportSSPeriodReportPdf() {
    if (!currentSSReportRows || currentSSReportRows.length === 0) {
        alert("لا توجد بيانات في تقرير الحضور المجمع لتصديرها!");
        return;
    }
    const stage = document.getElementById('ssReportStage')?.value || "كل المراحل";
    const grade = document.getElementById('ssReportGrade')?.value || "كل الصفوف";
    const gender = document.getElementById('ssReportGender')?.value || "";
    const fromD = (document.getElementById('ssReportFromDate')?.value || "").trim() || "البداية";
    const toD = (document.getElementById('ssReportToDate')?.value || "").trim() || "اليوم";
    const genderLabel = gender === 'ذكر' ? ' — بنين' : gender === 'انثي' ? ' — بنات' : '';

    const rowsHtml = currentSSReportRows.map((r, idx) => `
        <tr>
            <td style="text-align:center;font-weight:800;">${idx + 1}</td>
            <td><strong>${r.name}</strong><div style="font-size:10px;color:#475569;">${r.stage} - ${r.grade}</div></td>
            <td style="font-family:monospace;text-align:center;" dir="ltr">${r.phone || "-"}</td>
            <td style="text-align:center;font-weight:900;color:#047857;">${r.presentCount}</td>
            <td style="text-align:center;font-weight:800;color:#be123c;">${r.absentCount}</td>
            <td style="text-align:center;font-weight:800;">${r.pct}%</td>
            <td style="font-family:monospace;font-size:10px;">${r.presentDatesList.length > 0 ? r.presentDatesList.join(" ، ") : "-"}</td>
        </tr>
    `).join("");

    const tableHtml = `
        <table class="pdf-table">
            <thead>
                <tr>
                    <th style="width:5%;text-align:center;">م</th>
                    <th style="width:24%;">اسم المخدوم والصف</th>
                    <th style="width:14%;text-align:center;">المحمول</th>
                    <th style="width:8%;text-align:center;">حضور</th>
                    <th style="width:8%;text-align:center;">غياب</th>
                    <th style="width:9%;text-align:center;">النسبة</th>
                    <th style="width:32%;">تواريخ الحضور</th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    `;
    openOfficialPdfPreview(`تقرير الحضور المجمع — مدارس الأحد${genderLabel}`, `المرحلة: ${stage} | الصف: ${grade} | الفترة: من ${fromD} إلى ${toD}`, tableHtml);
}

// 3. PDF رسمي: كشف حضور وغياب فصل مدارس الأحد (دفتر الحضور)
async function generateAndExportClassRosterPdf() {
    const stage = document.getElementById('ssPrintStage')?.value || "";
    const grade = document.getElementById('ssPrintGrade')?.value || "";
    const genderFilter = document.getElementById('ssPrintGender')?.value || "";
    if (!stage) { alert("يرجى اختيار المرحلة الدراسية أولاً!"); return; }

    let membersList = namesCacheData;
    if (membersList.length === 0) {
        try { const res = await apiFetch(`${API_URL}?sheet=Names`); if (res.status === "success") membersList = res.data.map(sanitizeRecordFields); } catch (e) {}
    }
    const classKids = membersList.filter(item => {
        if (isMemberDeceased(item) || item["مدارس الأحد"] === "غير مشترك") return false;
        if (normalizeArabic(item["المرحلة"]) !== normalizeArabic(stage)) return false;
        if (grade && normalizeArabic(item["الصف"]) !== normalizeArabic(grade)) return false;
        if (genderFilter && normalizeGender(item["ذكر/انثي"]) !== genderFilter) return false;
        return true;
    }).sort((a, b) => String(a["الاسم ثلاثي"]).localeCompare(String(b["الاسم ثلاثي"]), 'ar'));

    if (classKids.length === 0) { alert("لم يتم العثور على مخدومين مسجلين بهذه المواصفات!"); return; }
    closeSundaySchoolPrintModal();

    const genderLabel = genderFilter === 'ذكر' ? ' (بنين)' : genderFilter === 'انثي' ? ' (بنات)' : ' (مجمّع)';
    const rowsHtml = classKids.map((kid, idx) => `
        <tr>
            <td style="text-align:center;font-weight:800;">${idx + 1}</td>
            <td style="font-weight:800;">${kid["الاسم ثلاثي"]}</td>
            <td style="font-family:monospace;text-align:center;" dir="ltr">${kid["تليفون العمل/المحمول"] || kid["هاتف الاسرة"] || "-"}</td>
            <td></td><td></td><td></td><td></td>
        </tr>
    `).join("");

    const tableHtml = `
        <table class="pdf-table">
            <thead>
                <tr>
                    <th style="width:6%;text-align:center;">م</th>
                    <th style="width:36%;">اسم المخدوم</th>
                    <th style="width:18%;text-align:center;">المحمول</th>
                    <th style="width:10%;text-align:center;">أسبوع 1</th>
                    <th style="width:10%;text-align:center;">أسبوع 2</th>
                    <th style="width:10%;text-align:center;">أسبوع 3</th>
                    <th style="width:10%;text-align:center;">أسبوع 4</th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    `;
    openOfficialPdfPreview(`كشف حضور وغياب فصل مدارس الأحد${genderLabel}`, `المرحلة: ${stage}${grade ? ' | الصف: ' + grade : ''} — عدد المخدومين: ${classKids.length}`, tableHtml);
}

// 4. PDF رسمي: كشف حضور اجتماع الخدام
function exportServantsMeetingPdf() {
    if (!currentServantsMeetingList || currentServantsMeetingList.length === 0) {
        alert("لا يوجد خدام في الكشف لتصديره!");
        return;
    }
    const meetingName = document.getElementById('servantsMeetingName')?.value || "اجتماع الخدام الأسبوعي";
    const meetingDate = document.getElementById('servantsMeetingDate')?.value || "";

    const rowsHtml = currentServantsMeetingList.map((s, idx) => `
        <tr>
            <td style="text-align:center;font-weight:800;">${idx + 1}</td>
            <td style="font-weight:800;">${s.name}</td>
            <td>${s.scope || "-"}</td>
            <td style="font-family:monospace;text-align:center;" dir="ltr">${s.phone || "-"}</td>
            <td style="text-align:center;font-weight:900;color:${s.status === 'حاضر' ? '#047857' : s.status === 'معتذر' ? '#b45309' : '#be123c'};">${s.status}</td>
            <td>${s.notes || "-"}</td>
        </tr>
    `).join("");

    const tableHtml = `
        <table class="pdf-table">
            <thead>
                <tr>
                    <th style="width:6%;text-align:center;">م</th>
                    <th style="width:26%;">اسم الخادم</th>
                    <th style="width:22%;">مجال الخدمة</th>
                    <th style="width:15%;text-align:center;">المحمول</th>
                    <th style="width:11%;text-align:center;">الحالة</th>
                    <th style="width:20%;">ملاحظات</th>
                </tr>
            </thead>
            <tbody>${rowsHtml}</tbody>
        </table>
    `;
    openOfficialPdfPreview(`كشف حضور: ${meetingName}`, `تاريخ الاجتماع: ${meetingDate} — إجمالي الخدام: ${currentServantsMeetingList.length}`, tableHtml);
}

// 5. PDF رسمي: تقرير الافتقاد الرعوي
function exportVisitReportPdf() {
    const urgentItems = Array.from(document.getElementById('visitUrgentList')?.children || []).filter(n => n.tagName === "DIV" && n.querySelector('h4'));
    const followupItems = Array.from(document.getElementById('visitFollowupList')?.children || []).filter(n => n.tagName === "DIV" && n.querySelector('h4'));

    let urgentRows = urgentItems.map((node, idx) => {
        const name = node.querySelector('h4').innerText;
        const meta = node.querySelector('p').innerText.split('|');
        const area = (meta[0] || "").replace('📍', '').trim();
        const phone = (meta[1] || "").replace('📞', '').trim();
        const delay = node.querySelectorAll('p')[1]?.innerText.replace('⏳ التأخير:', '').trim() || "";
        return `<tr><td style="text-align:center;font-weight:800;">${idx + 1}</td><td style="font-weight:800;">${name}</td><td>${area}</td><td style="font-family:monospace;text-align:center;" dir="ltr">${phone}</td><td style="color:#be123c;font-weight:800;">${delay}</td></tr>`;
    }).join("");
    if (!urgentRows) urgentRows = `<tr><td colspan="5" style="text-align:center;color:#64748b;">لا توجد حالات متأخرة حالياً</td></tr>`;

    let followRows = followupItems.map((node, idx) => {
        const name = node.querySelector('h4').innerText;
        const visitor = node.querySelector('p')?.innerText.replace('👤 الخادم المتابع:', '').trim() || "";
        const date = node.querySelectorAll('p')[1]?.innerText.replace('🗓️ موعد المتابعة:', '').trim() || "";
        return `<tr><td style="text-align:center;font-weight:800;">${idx + 1}</td><td style="font-weight:800;">${name}</td><td>${visitor}</td><td style="font-family:monospace;text-align:center;">${date}</td></tr>`;
    }).join("");
    if (!followRows) followRows = `<tr><td colspan="4" style="text-align:center;color:#64748b;">لا توجد متابعات مجدولة للأسبوع القادم</td></tr>`;

    const html = `
        <div class="pdf-group-title mb-2 px-3 py-1.5 rounded-lg bg-rose-700 text-white text-xs font-black" style="-webkit-print-color-adjust:exact;print-color-adjust:exact;">🚨 أسر بحاجة للافتقاد العاجل (+90 يوماً)</div>
        <table class="pdf-table mb-5">
            <thead><tr><th style="width:6%;text-align:center;">م</th><th style="width:32%;">اسم رب الأسرة</th><th style="width:22%;">المنطقة</th><th style="width:18%;text-align:center;">الهاتف</th><th style="width:22%;">مدة التأخير</th></tr></thead>
            <tbody>${urgentRows}</tbody>
        </table>
        <div class="pdf-group-title mb-2 px-3 py-1.5 rounded-lg bg-indigo-800 text-white text-xs font-black" style="-webkit-print-color-adjust:exact;print-color-adjust:exact;">🗓️ المتابعات المجدولة للأسبوع القادم</div>
        <table class="pdf-table">
            <thead><tr><th style="width:6%;text-align:center;">م</th><th style="width:36%;">اسم المخدوم / الأسرة</th><th style="width:34%;">الخادم المتابع</th><th style="width:24%;text-align:center;">موعد المتابعة</th></tr></thead>
            <tbody>${followRows}</tbody>
        </table>
    `;
    openOfficialPdfPreview("تقرير الافتقاد الرعوي والمتابعات", `حالات عاجلة: ${urgentItems.length} | متابعات قادمة: ${followupItems.length}`, html);
}

// 6. PDF رسمي: دليل الأسر ونتائج الفرز المتقدم
function exportFamiliesMapToPdf(familiesMap, reportTitle) {
    const sortedHeads = Object.keys(familiesMap).sort((a, b) => a.localeCompare(b, 'ar'));
    if (sortedHeads.length === 0) { alert("لا توجد أسر مطابقة لتصديرها!"); return; }

    const cardsHtml = sortedHeads.map((headName, idx) => {
        const members = sortFamilyMembers(familiesMap[headName], headName);
        const headRec = members.find(m => m["الاسم ثلاثي"] === headName) || members[0];
        const addressStr = [getMemberArea(headRec), getFieldValNormalized(headRec, "اسم الشارع"), getFieldValNormalized(headRec, "رقم المنزل")].filter(Boolean).join(' - ') || "غير محدد";
        const phoneStr = headRec?.["هاتف الاسرة"] || headRec?.["تليفون العمل/المحمول"] || "-";

        const mRows = members.map((m, mIdx) => `
            <tr>
                <td style="text-align:center;width:6%;">${mIdx + 1}</td>
                <td style="font-weight:800;width:34%;">${m["الاسم ثلاثي"] || "-"}</td>
                <td style="width:14%;text-align:center;">${m["صلة القرابة"] || "-"}</td>
                <td style="width:18%;font-family:monospace;text-align:center;" dir="ltr">${m["تليفون العمل/المحمول"] || "-"}</td>
                <td style="width:28%;">${m["المرحلة"] ? m["المرحلة"] + (m["الصف"] ? ' (' + m["الصف"] + ')' : '') : (m["المؤهل"] || "-")}</td>
            </tr>
        `).join("");

        return `
            <div class="pdf-card mb-3 border border-slate-300 rounded-xl overflow-hidden">
                <div style="background:#eff6ff;padding:6px 10px;border-bottom:1px solid #bfdbfe;-webkit-print-color-adjust:exact;print-color-adjust:exact;" class="flex justify-between items-center flex-wrap gap-2 text-xs">
                    <strong style="color:#1e3a8a;">${idx + 1}. أسرة: ${headName} (${members.length} أفراد)</strong>
                    <span style="color:#334155;">📍 ${addressStr} | 📞 <span dir="ltr">${phoneStr}</span></span>
                </div>
                <table class="pdf-table"><tbody>${mRows}</tbody></table>
            </div>
        `;
    }).join("");

    openOfficialPdfPreview(reportTitle, `إجمالي الأسر: ${sortedHeads.length}`, cardsHtml);
}

function exportRosterDirectoryPdf() {
    const query = (document.getElementById('rosterSearchInput')?.value || "").trim().toLowerCase();
    const familiesMap = {};
    rawData.forEach(m => {
        const head = (m["اسم رب الاسرة"] || "").trim(); if (!head) return;
        const normHead = normalizeArabic(head).toLowerCase();
        if (selectedLetter !== "الكل" && normHead[0] !== normalizeArabic(selectedLetter)[0]) return;
        if (query) {
            const hasHeadMatch = normHead.includes(normalizeArabic(query).toLowerCase());
            const hasMemberMatch = normalizeArabic(m["الاسم ثلاثي"]).toLowerCase().includes(normalizeArabic(query).toLowerCase());
            if (!hasHeadMatch && !hasMemberMatch) return;
        }
        if (!familiesMap[head]) familiesMap[head] = [];
        familiesMap[head].push(m);
    });
    exportFamiliesMapToPdf(familiesMap, `دليل أرباب الأسر والعائلات الأبجدي (حرف: ${selectedLetter})`);
}

function exportFilteredResultsPdf() {
    const headQ = normalizeArabic(document.getElementById('filterFamilyHead')?.value || "").toLowerCase();
    const nameQ = normalizeArabic(document.getElementById('filterFullName')?.value || "").toLowerCase();
    const areaQ = (document.getElementById('filterArea')?.value || "").trim();
    const ageGroupQ = document.getElementById('filterAgeGroup')?.value || "";
    const genderQ = document.getElementById('filterGender')?.value || "";
    const electionQ = document.getElementById('filterElection')?.value || "";
    const maritalQ = document.getElementById('filterMarital')?.value || "";
    const deceasedQ = document.getElementById('filterDeceased')?.value || "alive";

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
        if (headQ || nameQ) {
            const idx = getSearchIndex(item);
            if (headQ && !idx.head.includes(headQ)) return false;
            if (nameQ && !idx.name.includes(nameQ)) return false;
        }
        return true;
    });
    if (matchedMembers.length === 0) { alert("لا توجد سجلات مطابقة للفرز المحدد لتصديرها!"); return; }

    const familiesMap = {};
    matchedMembers.forEach(m => { const head = (m["اسم رب الاسرة"] || "").trim(); if (!head) return; if (!familiesMap[head]) familiesMap[head] = []; familiesMap[head].push(m); });
    const areaVal = areaQ || "كل المناطق";
    const ageVal = document.getElementById('filterAgeGroup')?.options[document.getElementById('filterAgeGroup')?.selectedIndex]?.text || "كل الأعمار";
    exportFamiliesMapToPdf(familiesMap, `بيان فرز السجلات: [${areaVal} - ${ageVal}]`);
}

/* ==================== نهاية الملف ==================== */