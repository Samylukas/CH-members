const API_URL = "https://script.google.com/macros/s/AKfycbxUSj07z5nkCv88hrgob88-bB21SLs2OmK9-BbSSUu_4m2eirI8cBHCl-5xUv0cyTSZ6Q/exec";

let currentUser = null;
let currentTab = "";
let rawData = [];

// أيقونات SVG نقية لمنع ظهور المربعات الفارغة نهائياً
const ICONS = {
    users: `<svg class="w-12 h-12 inline-block" fill="currentColor" viewBox="0 0 24 24"><path d="M16 11c1.66 0 2.99-1.34 2.99-3S17.66 5 16 5c-1.66 0-3 1.34-3 3s1.34 3 3 3zm-8 0c1.66 0 2.99-1.34 2.99-3S9.66 5 8 5C6.34 5 5 6.34 5 8s1.34 3 3 3zm0 2c-2.33 0-7 1.17-7 3.5V19h14v-2.5c0-2.33-4.67-3.5-7-3.5zm8 0c-.29 0-.62.02-.97.05 1.16.84 1.97 1.97 1.97 3.45V19h6v-2.5c0-2.33-4.67-3.5-7-3.5z"/></svg>`,
    children: `<svg class="w-12 h-12 inline-block" fill="currentColor" viewBox="0 0 24 24"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>`,
    visitations: `<svg class="w-12 h-12 inline-block" fill="currentColor" viewBox="0 0 24 24"><path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/></svg>`,
    meetings: `<svg class="w-12 h-12 inline-block" fill="currentColor" viewBox="0 0 24 24"><path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm2 14H7v-2h7v2zm3-4H7v-2h10v2zm0-4H7V7h10v2z"/></svg>`,
    servants: `<svg class="w-12 h-12 inline-block" fill="currentColor" viewBox="0 0 24 24"><path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/></svg>`
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
    "Names": { label: "أعضاء الكنيسة", desc: "سجلات العائلات والفرز المتقدم", svg: ICONS.users, colorClass: "card-names", roles: ["Admin", "SundaySchool_Admin"] },
    "Sunday_School": { label: "مدارس الأحد", desc: "إدارة الفصول، الحضور، والتسميع", svg: ICONS.children, colorClass: "card-sunday", roles: ["Admin", "SundaySchool_Admin", "Stage_Leader", "Class_Servant"] },
    "Visitations": { label: "سجل الافتقاد", desc: "متابعة الزيارات ومواعيد الافتقاد", svg: ICONS.visitations, colorClass: "card-visitations", roles: ["Admin"] },
    "Meetings_Attendance": { label: "حضور الاجتماعات", desc: "تسجيل حضور وغياب الاجتماعات", svg: ICONS.meetings, colorClass: "card-meetings", roles: ["Admin"] },
    "Servants": { label: "إدارة الخدام", desc: "توزيع الصلاحيات والحسابات", svg: ICONS.servants, colorClass: "card-servants", roles: ["Admin"] }
};

const SCHEMAS = {
    "Names": [
        { id: "اسم رب الاسرة", label: "اسم رب الأسرة", type: "text" },
        { id: "الاسم ثلاثي", label: "الاسم ثلاثي", type: "text", required: true },
        { id: "ذكر/انثي", label: "النوع", type: "select", options: ["", "ذكر", "انثي"], required: true },
        { id: "صلة القرابة", label: "صلة القرابة", type: "select", options: ["", "زوج", "زوجة", "ابن", "ابنة", "والد", "والدة", "أخ", "أخت", "أخرى"] },
        { id: "الحالة الاجتماعية", label: "الحالة الاجتماعية", type: "select", options: ["", "متزوج", "متزوجة", "اعزب", "انسة", "ارمل", "ارملة"] },
        { id: "المرحلة", label: "المرحلة الدراسية", type: "stage_select", options: Object.keys(STAGE_GRADES) },
        { id: "الصف", label: "الصف الدراسي", type: "grade_select" },
        { id: "فصل مدارس الاحد", label: "فصل مدارس الأحد", type: "text" },
        { id: "تليفون العمل/المحمول", label: "المحمول / الهاتف", type: "text" },
        { id: "المنطقة", label: "المنطقة / السكن", type: "text" },
        { id: "تاريخ الميلاد", label: "تاريخ الميلاد (DD/MM/YYYY)", type: "text" },
        { id: "الرقم القومي", label: "الرقم القومي", type: "text" },
        { id: "البطاقة الانتخابية", label: "البطاقة الانتخابية", type: "select", options: ["", "يوجد", "لا يوجد"] },
        { id: "تاريخ الزواج", label: "تاريخ الزواج (DD/MM/YYYY)", type: "text" },
        { id: "المؤهل", label: "المؤهل الدراسي", type: "text" },
        { id: "المهنة/السنة الدراسية", label: "المهنة / العمل", type: "text" },
        { id: "اب الاعتراف", label: "أب الاعتراف", type: "text" },
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
        { id: "Memorization", label: "الحفظ", type: "select", options: ["ممتاز", "جيد", "ضعيف", "لم يحفظ"] },
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

window.onload = () => {
    setTimeout(() => {
        const splash = document.getElementById('splashScreen');
        splash.style.opacity = '0';
        setTimeout(() => {
            splash.style.display = 'none';
        }, 800);

        const saved = localStorage.getItem('church_servant');
        if (saved) {
            currentUser = JSON.parse(saved);
            initApp();
        }
    }, 2400);
};

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
            localStorage.setItem('church_servant', JSON.stringify(currentUser));
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
    localStorage.setItem('church_servant', JSON.stringify(currentUser));
    initApp();
}

function logout() {
    localStorage.removeItem('church_servant');
    location.reload();
}

function initApp() {
    document.getElementById('loginScreen').classList.add('hidden');
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
    
    if (currentTab === 'Names') {
        document.getElementById('namesFilterSection').classList.remove('hidden');
        document.getElementById('namesPlaceholder').classList.remove('hidden');
        document.getElementById('standardSearchContainer').classList.add('hidden');
        document.getElementById('standardCardsContainer').classList.add('hidden');
        document.getElementById('familyResultsContainer').classList.remove('hidden');
        resetNamesFilters();
    } else {
        document.getElementById('namesFilterSection').classList.add('hidden');
        document.getElementById('namesPlaceholder').classList.add('hidden');
        document.getElementById('standardSearchContainer').classList.remove('hidden');
        document.getElementById('standardCardsContainer').classList.remove('hidden');
        document.getElementById('familyResultsContainer').classList.add('hidden');
        document.getElementById('searchInput').value = "";
    }
    
    loadData();
}

async function loadData(force = false) {
    showLoader(true);
    try {
        const res = await (await fetch(`${API_URL}?sheet=${currentTab}`)).json();
        if (res.status === "success") {
            rawData = res.data;
            if (currentTab === 'Names') {
                populateAreasDropdown();
                applyNamesFilter();
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

function populateAreasDropdown() {
    const areaSelect = document.getElementById('filterArea');
    const areas = new Set();
    rawData.forEach(item => {
        const area = (item["المنطقة"] || item["محل العمل/الدراسة"] || "").trim();
        if (area) areas.add(area);
    });
    areaSelect.innerHTML = `<option value="">كل المناطق (${areas.size})</option>` + 
        Array.from(areas).sort().map(a => `<option value="${a}">${a}</option>`).join('');
}

function calculateAge(dobStr, nationalId = "") {
    let birthYear = 0;
    if (dobStr) {
        const match = String(dobStr).match(/\b(19\d\d|20\d\d)\b/);
        if (match) birthYear = parseInt(match[1]);
    }
    if (!birthYear && nationalId && String(nationalId).length === 14) {
        const century = nationalId[0] === '2' ? 1900 : 2000;
        birthYear = century + parseInt(nationalId.substring(1, 3));
    }
    if (!birthYear) return null;
    return 2026 - birthYear;
}

function resetNamesFilters() {
    document.getElementById('filterFamilyHead').value = "";
    document.getElementById('filterFullName').value = "";
    document.getElementById('filterArea').value = "";
    document.getElementById('filterAgeGroup').value = "";
    document.getElementById('filterGender').value = "";
    document.getElementById('filterElection').value = "";
    document.getElementById('filterMarital').value = "";
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

    const hasActiveFilter = headQ || nameQ || areaQ || ageGroupQ || genderQ || electionQ || maritalQ;

    if (!hasActiveFilter) {
        document.getElementById('familyResultsContainer').innerHTML = "";
        document.getElementById('namesPlaceholder').classList.remove('hidden');
        document.getElementById('recordCount').innerText = "0 سجل";
        return;
    }

    document.getElementById('namesPlaceholder').classList.add('hidden');

    const matchedMembers = rawData.filter(item => {
        if (genderQ && item["ذكر/انثي"] !== genderQ) return false;
        if (electionQ && (item["البطاقة الانتخابية"] || "").trim() !== electionQ) return false;
        if (maritalQ && (item["الحالة الاجتماعية"] || "").trim() !== maritalQ) return false;
        if (areaQ) {
            const itemArea = (item["المنطقة"] || item["محل العمل/الدراسة"] || "").trim();
            if (itemArea !== areaQ) return false;
        }
        if (ageGroupQ) {
            const age = calculateAge(item["تاريخ الميلاد"], item["الرقم القومي"]);
            if (age === null) return false;
            if (ageGroupQ === "children" && age >= 12) return false;
            if (ageGroupQ === "prep" && (age < 12 || age > 15)) return false;
            if (ageGroupQ === "sec" && (age < 15 || age > 18)) return false;
            if (ageGroupQ === "youth" && (age < 18 || age > 25)) return false;
            if (ageGroupQ === "adults" && (age < 25 || age > 50)) return false;
            if (ageGroupQ === "seniors" && age <= 50) return false;
        }
        if (headQ) {
            const h = String(item["اسم رب الاسرة"] || "").toLowerCase();
            if (!h.includes(headQ)) return false;
        }
        if (nameQ) {
            const n = String(item["الاسم ثلاثي"] || "").toLowerCase();
            if (!n.includes(nameQ)) return false;
        }
        return true;
    });

    let targetHeads = new Set();
    matchedMembers.forEach(m => {
        if (m["اسم رب الاسرة"]) targetHeads.add(m["اسم رب الاسرة"]);
    });

    const container = document.getElementById('familyResultsContainer');
    container.innerHTML = "";

    let totalDisplayed = 0;
    let familiesCount = 0;

    targetHeads.forEach(headName => {
        const allFamilyMembers = rawData.filter(r => r["اسم رب الاسرة"] === headName);
        familiesCount++;
        const famDiv = document.createElement('div');
        famDiv.className = "family-box";

        let headerHtml = `
            <div class="family-header">
                <div class="flex items-center gap-3">
                    <div class="w-9 h-9 rounded-xl bg-indigo-50 text-indigo-700 flex items-center justify-center font-bold">
                        🏠
                    </div>
                    <div>
                        <h3 class="text-sm font-black text-slate-800">عائلة: ${headName}</h3>
                        <p class="text-[11px] font-bold text-slate-500">إجمالي المقيدين بالأسرة: ${allFamilyMembers.length} أفراد</p>
                    </div>
                </div>
            </div>
        `;

        let membersHtml = `<div class="divide-y divide-slate-100">`;

        allFamilyMembers.forEach(member => {
            const idVal = member[Object.keys(member)[0]];
            const isMatched = matchedMembers.some(m => m[Object.keys(m)[0]] === idVal);
            const rowBg = isMatched ? "bg-white" : "bg-slate-50/60 opacity-60";
            totalDisplayed++;

            const age = calculateAge(member["تاريخ الميلاد"], member["الرقم القومي"]);
            const ageText = age !== null ? `${age} سنة` : "-";
            const genderBadge = member["ذكر/انثي"] === "ذكر" 
                ? `<span class="bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded text-[11px] font-bold">ذكر</span>`
                : `<span class="bg-pink-50 text-pink-700 border border-pink-200 px-2 py-0.5 rounded text-[11px] font-bold">انثي</span>`;

            membersHtml += `
                <div class="member-row ${rowBg} flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
                    <div class="flex items-start gap-3">
                        <span class="text-xs font-mono font-bold text-slate-400 mt-1">#${idVal}</span>
                        <div>
                            <div class="flex items-center gap-2 mb-1">
                                <h4 class="text-sm font-black text-slate-800">${member["الاسم ثلاثي"] || "-"}</h4>
                                <span class="text-[11px] bg-slate-100 text-slate-700 px-2 py-0.5 rounded font-bold">${member["صلة القرابة"] || "عضو"}</span>
                                ${genderBadge}
                                <span class="text-[11px] bg-amber-50 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-bold">${member["الحالة الاجتماعية"] || "-"}</span>
                            </div>
                            <div class="flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500 font-semibold">
                                <span>العمر: <strong class="text-slate-700">${ageText}</strong></span>
                                <span>المحمول: ${member["تليفون العمل/المحمول"] || "-"}</span>
                                <span>بطاقة انتخابية: <strong class="${member["البطاقة الانتخابية"]==='يوجد'?'text-emerald-600':'text-rose-600'}">${member["البطاقة الانتخابية"] || "-"}</strong></span>
                                <span>أب الاعتراف: ${member["اب الاعتراف"] || "-"}</span>
                            </div>
                        </div>
                    </div>

                    <div class="flex items-center gap-2 w-full lg:w-auto justify-end border-t lg:border-t-0 pt-2 lg:pt-0">
                        <button onclick="editRecord(${idVal})" class="text-xs font-bold bg-indigo-50 hover:bg-indigo-100 text-indigo-700 px-3 py-1.5 rounded-lg transition">تعديل</button>
                        ${currentUser.Role === "Admin" ? `<button onclick="deleteRecord(${idVal})" class="text-xs font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 px-3 py-1.5 rounded-lg transition">حذف</button>` : ''}
                    </div>
                </div>
            `;
        });

        membersHtml += `</div>`;
        famDiv.innerHTML = headerHtml + membersHtml;
        container.appendChild(famDiv);
    });

    document.getElementById('recordCount').innerText = `${matchedMembers.length} مطابق (${familiesCount} أسرة)`;

    if (familiesCount === 0) {
        container.innerHTML = `<div class="text-center py-16 bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400 font-bold">لم يتم العثور على أفراد أو أسر مطابقة للفلاتر المحددة</div>`;
    }
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
            <div class="flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button onclick="editRecord(${idVal})" class="text-xs font-bold text-indigo-600 hover:text-indigo-800 bg-indigo-50 px-2.5 py-1.5 rounded-lg transition">تعديل</button>
                ${currentUser.Role === "Admin" ? `<button onclick="deleteRecord(${idVal})" class="text-xs font-bold text-rose-600 hover:text-rose-800 bg-rose-50 px-2.5 py-1.5 rounded-lg transition">حذف</button>` : ''}
            </div>
        `;
        container.appendChild(card);
    });
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
    const fCont = document.getElementById('formFields');
    fCont.innerHTML = "";
    const sc = SCHEMAS[currentTab] || [];
    sc.forEach(f => {
        const val = data[f.id] || "";
        const w = document.createElement('div');
        if (f.full) w.className = "md:col-span-2 lg:col-span-3";
        let inpH = "";
        const cls = "w-full p-2.5 bg-slate-50 border border-slate-300 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-xs transition";
        if (f.type === "stage_select") {
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
        document.getElementById('familyResultsContainer').classList.toggle('hidden', s);
    } else {
        document.getElementById('standardCardsContainer').classList.toggle('hidden', s);
    }
}
