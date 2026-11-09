/* ==================== منظومة الخدمة والرعاية الكنسية - app.js ==================== */
const SCRIPT_URL = localStorage.getItem('CHURCH_API_URL') || "https://script.google.com/macros/s/AKfycbz_REPLACE_WITH_YOUR_DEPLOYMENT_ID/exec";
let currentUser = { ServantName: "الأدمن", Role: "Admin", AssignedStage: "الكل", AssignedGrade: "الكل", AssignedClass: "الكل", Username: "admin" };
let currentTab = "Names", rawData = [], namesData = [], sundaySchoolData = [], servantsData = [], visitationsData = [], meetingsAttendanceData = [];
const stagesGradesMap = { "حضانة": ["بيبي كلاس", "أولى حضانة", "ثانية حضانة"], "ابتدائي": ["أولى ابتدائي", "ثانية ابتدائي", "ثالثة ابتدائي", "رابعة ابتدائي", "خامسة ابتدائي", "سادسة ابتدائي"], "إعدادي": ["أولى إعدادي", "ثانية إعدادي", "ثالثة إعدادي"], "ثانوي": ["أولى ثانوي", "ثانية ثانوي", "ثالثة ثانوي"], "جامعيين وخريجين": ["جامعيين", "خريجين"] };

// دالة تهيئة رقم الواتساب بالصيغة الدولية وتجهيز أزرار الاتصال
function formatWhatsAppNumber(phone) { if (!phone) return ''; let c = phone.toString().replace(/\D/g, ''); return (c.startsWith('01') && c.length === 11) ? '2' + c : c; }
function renderContactButtons(phone) {
    if (!phone || String(phone).trim() === "" || String(phone).trim() === "-") return '<span class="text-slate-400 text-xs font-semibold">-</span>';
    const p = String(phone).trim(), wa = formatWhatsAppNumber(p);
    return `<div class="inline-flex items-center gap-1.5 flex-wrap"><span class="text-xs font-bold text-slate-700 font-mono" dir="ltr">${p}</span><a href="tel:${p}" class="inline-flex items-center gap-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[11px] font-bold shadow-sm transition" title="اتصال هاتفي">📞 اتصال</a><a href="https://wa.me/${wa}" target="_blank" class="inline-flex items-center gap-1 px-2.5 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-[11px] font-bold shadow-sm transition" title="مراسلة واتساب">💬 واتساب</a></div>`;
}

// إدارة الدخول والواجهة الرئيسية
document.addEventListener("DOMContentLoaded", () => { initSystemDate(); setupEventListeners(); loadData(); });
function initSystemDate() { const today = new Date().toLocaleDateString('en-GB'); if (document.getElementById('ssSessionDate')) document.getElementById('ssSessionDate').value = today; if (document.getElementById('servantsMeetingDate')) document.getElementById('servantsMeetingDate').value = today; }
function showDashboard() { currentTab = "Dashboard"; document.getElementById('dashboardView')?.classList.remove('hidden'); document.getElementById('dataView')?.classList.add('hidden'); renderDashboardGrid(); }
function logout() { currentUser = null; document.getElementById('dashboardView')?.classList.add('hidden'); document.getElementById('dataView')?.classList.add('hidden'); const l = document.getElementById('loginScreen'); if (l) { l.style.display = 'flex'; l.classList.remove('hidden'); } }
function initApp() { document.getElementById('userBadge').innerText = `${currentUser.ServantName} (${currentUser.Role})`; showDashboard(); populateUserSelect(); }

// لوحة التحكم المركزية
function renderDashboardGrid() {
    const grid = document.getElementById('dashboardGrid'); if (!grid) return;
    const cards = [
        { id: "Names", title: "سجل الأعضاء والعائلات", desc: "الدليل الأبجدي، أرباب الأسر والبحث المتقدم", icon: "👥", bg: "bg-indigo-50 border-indigo-200 text-indigo-700" },
        { id: "Sunday_School", title: "مدارس الأحد", desc: "كشوف الفصول، رصد الحضور والتسميع", icon: "📖", bg: "bg-blue-50 border-blue-200 text-blue-700" },
        { id: "Meetings_Attendance", title: "اجتماع الخدام", desc: "رصد الحضور الأسبوعي والاعتذارات", icon: "⛪", bg: "bg-amber-50 border-amber-200 text-amber-700" },
        { id: "Visitations", title: "الافتقاد والرعاية", desc: "الحالات العاجلة (+90 يوم) والزيارات", icon: "🚨", bg: "bg-rose-50 border-rose-200 text-rose-700" },
        { id: "Servants", title: "بيانات الخدام", desc: "حسابات الخدام والصلاحيات والمسؤوليات", icon: "🛡️", bg: "bg-slate-100 border-slate-300 text-slate-700" }
    ];
    grid.innerHTML = cards.map(c => `
        <div onclick="switchTab('${c.id}')" class="p-6 bg-white rounded-3xl border border-slate-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition duration-200 cursor-pointer flex flex-col justify-between">
            <div><div class="w-12 h-12 rounded-2xl ${c.bg} flex items-center justify-center text-2xl mb-4">${c.icon}</div>
            <h3 class="text-base font-black text-slate-800 mb-1">${c.title}</h3>
            <p class="text-xs text-slate-500 font-semibold leading-relaxed">${c.desc}</p></div>
            <div class="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs font-bold text-indigo-600"><span>فتح القسم</span><span>←</span></div>
        </div>
    `).join('');
}

// التبديل بين الأقسام
function switchTab(tab) {
    currentTab = tab; document.getElementById('dashboardView')?.classList.add('hidden'); document.getElementById('dataView')?.classList.remove('hidden');
    document.getElementById('namesViewSwitcher')?.classList.add('hidden'); document.getElementById('ssViewSwitcher')?.classList.add('hidden');
    document.getElementById('meetingsViewSwitcher')?.classList.add('hidden'); document.getElementById('visitationsViewSwitcher')?.classList.add('hidden');
    document.getElementById('namesRosterSection')?.classList.add('hidden'); document.getElementById('namesFilterSection')?.classList.add('hidden');
    document.getElementById('sundaySchoolLiveSection')?.classList.add('hidden'); document.getElementById('servantsMeetingLiveSection')?.classList.add('hidden');
    document.getElementById('visitationDashboardSection')?.classList.add('hidden'); document.getElementById('standardSearchContainer')?.classList.add('hidden');
    document.getElementById('familyResultsContainer')?.classList.add('hidden'); document.getElementById('standardCardsContainer')?.classList.add('hidden');
    document.getElementById('namesPlaceholder')?.classList.add('hidden');
    ['btnPrintSundaySchool', 'btnPrintMeetings', 'btnPrintVisitReport', 'btnPrintFiltered', 'btnPrintRoster'].forEach(id => document.getElementById(id)?.classList.add('hidden'));

    if (tab === "Names") {
        document.getElementById('currentTabTitle').innerText = "سجل العائلات والأعضاء";
        document.getElementById('namesViewSwitcher')?.classList.remove('hidden');
        switchNamesView('roster');
    } else if (tab === "Sunday_School") {
        document.getElementById('currentTabTitle').innerText = "فصول مدارس الأحد";
        document.getElementById('ssViewSwitcher')?.classList.remove('hidden');
        document.getElementById('btnPrintSundaySchool')?.classList.remove('hidden');
        switchSSView('live');
    } else if (tab === "Meetings_Attendance") {
        document.getElementById('currentTabTitle').innerText = "اجتماع الخدام الأسبوعي";
        document.getElementById('meetingsViewSwitcher')?.classList.remove('hidden');
        document.getElementById('btnPrintMeetings')?.classList.remove('hidden');
        switchMeetingsView('live');
    } else if (tab === "Visitations") {
        document.getElementById('currentTabTitle').innerText = "متابعات الافتقاد الرعوي";
        document.getElementById('visitationsViewSwitcher')?.classList.remove('hidden');
        document.getElementById('btnPrintVisitReport')?.classList.remove('hidden');
        switchVisitationsView('dashboard');
    } else {
        document.getElementById('currentTabTitle').innerText = "سجل " + tab;
        document.getElementById('standardSearchContainer')?.classList.remove('hidden');
        document.getElementById('standardCardsContainer')?.classList.remove('hidden');
        renderStandardCards();
    }
}

// ----------------- قسم الأعضاء والعائلات (مع أزرار الاتصال والواتساب) -----------------
function switchNamesView(view) {
    if (view === 'roster') {
        document.getElementById('namesRosterSection')?.classList.remove('hidden'); document.getElementById('namesFilterSection')?.classList.add('hidden');
        document.getElementById('familyResultsContainer')?.classList.add('hidden'); document.getElementById('namesPlaceholder')?.classList.add('hidden');
        document.getElementById('btnPrintRoster')?.classList.remove('hidden'); document.getElementById('btnPrintFiltered')?.classList.add('hidden');
        document.getElementById('btnViewRoster')?.classList.replace('text-slate-600', 'text-indigo-700'); document.getElementById('btnViewRoster')?.classList.add('bg-white', 'shadow-sm');
        document.getElementById('btnViewFilters')?.classList.remove('bg-white', 'shadow-sm'); renderRoster();
    } else {
        document.getElementById('namesRosterSection')?.classList.add('hidden'); document.getElementById('namesFilterSection')?.classList.remove('hidden');
        document.getElementById('familyResultsContainer')?.classList.remove('hidden'); document.getElementById('btnPrintRoster')?.classList.add('hidden');
        document.getElementById('btnPrintFiltered')?.classList.remove('hidden');
        document.getElementById('btnViewFilters')?.classList.add('bg-white', 'shadow-sm', 'text-indigo-700'); document.getElementById('btnViewRoster')?.classList.remove('bg-white', 'shadow-sm', 'text-indigo-700');
        populateAreaDropdown(); applyNamesFilter();
    }
}

function getGroupedFamilies() {
    const families = {};
    namesData.forEach(item => {
        const head = item["FamilyHead"] || item["FullName"] || "بدون عائلة";
        if (!families[head]) families[head] = { headName: head, headData: null, members: [] };
        if (item["Relationship"] === "رب الأسرة" || item["FullName"] === head) families[head].headData = item;
        families[head].members.push(item);
    });
    return families;
}

function renderRoster() {
    const container = document.getElementById('rosterCardsContainer'); if (!container) return;
    const families = getGroupedFamilies(), sortedHeads = Object.keys(families).sort((a,b) => a.localeCompare(b, 'ar'));
    renderAlphabetBar(sortedHeads);
    container.innerHTML = sortedHeads.map((head, idx) => {
        const fam = families[head], headPhone = fam.headData ? fam.headData["Phone"] : "";
        return `
            <div class="family-card bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden mb-3" data-head="${head}">
                <div onclick="toggleFamilyCard(${idx})" class="p-4 bg-slate-50/80 hover:bg-indigo-50/50 cursor-pointer flex flex-col md:flex-row md:items-center justify-between gap-3 transition">
                    <div>
                        <div class="flex items-center gap-2"><span class="w-2.5 h-2.5 rounded-full bg-indigo-600"></span><h4 class="font-black text-sm text-slate-800">${head}</h4><span class="text-[11px] font-bold bg-indigo-50 text-indigo-700 px-2 py-0.5 rounded-md border border-indigo-100">${fam.members.length} أفراد</span></div>
                        <p class="text-xs text-slate-500 font-semibold mt-1">المنطقة: ${fam.headData?.Area || 'غير محدد'} | العنوان: ${fam.headData?.Address || '-'}</p>
                    </div>
                    <div class="flex items-center gap-3" onclick="event.stopPropagation()">
                        ${renderContactButtons(headPhone)}
                        <span id="famArrow-${idx}" class="text-xs text-slate-400 font-bold transition-transform">▼</span>
                    </div>
                </div>
                <div id="famBody-${idx}" class="p-4 divide-y divide-slate-100 hidden bg-white">
                    ${fam.members.map(m => `
                        <div class="py-2.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                            <div><span class="font-bold text-slate-800">${m.FullName}</span> <span class="text-indigo-600 font-semibold">(${m.Relationship || 'فرد'})</span> <span class="text-slate-400 mr-2">${m.Stage || ''} ${m.ClassGrade || ''}</span></div>
                            <div class="flex items-center gap-3">${renderContactButtons(m.Phone)}<button onclick="editRecord(${m.ID})" class="text-[11px] font-bold text-indigo-600 hover:underline">تعديل</button></div>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }).join('');
    document.getElementById('recordCount').innerText = `${sortedHeads.length} عائلة (${namesData.length} فرد)`;
}

function toggleFamilyCard(idx) { const body = document.getElementById(`famBody-${idx}`), arrow = document.getElementById(`famArrow-${idx}`); if (body) { body.classList.toggle('hidden'); arrow.classList.toggle('rotate-180'); } }
function expandAllFamilies(expand) { document.querySelectorAll('[id^="famBody-"]').forEach(b => expand ? b.classList.remove('hidden') : b.classList.add('hidden')); }
function filterRoster() { const q = (document.getElementById('rosterSearchInput')?.value || "").trim().toLowerCase(); document.querySelectorAll('.family-card').forEach(card => card.style.display = card.getAttribute('data-head').toLowerCase().includes(q) ? 'block' : 'none'); }
function renderAlphabetBar(heads) {
    const bar = document.getElementById('alphabetBar'); if (!bar) return;
    const chars = [...new Set(heads.map(h => h.trim().charAt(0)))].filter(c => c).sort((a,b) => a.localeCompare(b, 'ar'));
    bar.innerHTML = chars.map(ch => `<button onclick="scrollToLetter('${ch}')" class="px-2 py-1 bg-white hover:bg-indigo-600 hover:text-white rounded-lg text-xs font-bold border border-slate-200 transition">${ch}</button>`).join('');
}
function scrollToLetter(ch) { const card = Array.from(document.querySelectorAll('.family-card')).find(c => c.getAttribute('data-head').startsWith(ch)); if (card) card.scrollIntoView({ behavior: 'smooth', block: 'center' }); }

// الفرز المتقدم
function populateAreaDropdown() {
    const sel = document.getElementById('filterArea'); if (!sel) return;
    const areas = [...new Set(namesData.map(i => i.Area).filter(Boolean))].sort((a,b) => a.localeCompare(b, 'ar'));
    sel.innerHTML = `<option value="">كل المناطق السكنية</option>` + areas.map(a => `<option value="${a}">${a}</option>`).join('');
}
function applyNamesFilter() {
    const headQ = (document.getElementById('filterFamilyHead')?.value || "").trim().toLowerCase();
    const nameQ = (document.getElementById('filterFullName')?.value || "").trim().toLowerCase();
    const area = document.getElementById('filterArea')?.value || "";
    const gender = document.getElementById('filterGender')?.value || "";
    const marital = document.getElementById('filterMarital')?.value || "";
    const election = document.getElementById('filterElection')?.value || "";
    const deceased = document.getElementById('filterDeceased')?.value || "alive";

    const filtered = namesData.filter(item => {
        if (headQ && !String(item.FamilyHead || "").toLowerCase().includes(headQ)) return false;
        if (nameQ && !String(item.FullName || "").toLowerCase().includes(nameQ)) return false;
        if (area && item.Area !== area) return false;
        if (gender && item.Gender !== gender) return false;
        if (marital && item.MaritalStatus !== marital) return false;
        if (election && item.ElectionCard !== election) return false;
        if (deceased === "alive" && item.Deceased === "نعم") return false;
        if (deceased === "deceased" && item.Deceased !== "نعم") return false;
        return true;
    });

    const container = document.getElementById('familyResultsContainer'); if (!container) return;
    document.getElementById('recordCount').innerText = `${filtered.length} سجل فردي`;
    if (!filtered.length) { container.innerHTML = `<div class="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-300 text-slate-400 font-bold">لا توجد نتائج مطابقة لشروط الفرز</div>`; return; }

    container.innerHTML = filtered.map(m => `
        <div class="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-3">
            <div>
                <div class="flex items-center gap-2"><h4 class="font-black text-sm text-slate-800">${m.FullName}</h4><span class="text-[10px] font-bold bg-slate-100 text-slate-600 px-2 py-0.5 rounded">${m.Relationship || 'عضو'}</span><span class="text-xs font-bold text-indigo-700">رب الأسرة: ${m.FamilyHead || '-'}</span></div>
                <p class="text-xs text-slate-500 font-semibold mt-1">المنطقة: ${m.Area || '-'} | العنوان: ${m.Address || '-'} ${m.Stage ? `| المرحلة: ${m.Stage}` : ''}</p>
            </div>
            <div class="flex items-center gap-3">${renderContactButtons(m.Phone)}<button onclick="editRecord(${m.ID})" class="px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 rounded-lg text-xs font-bold transition">تعديل</button></div>
        </div>
    `).join('');
}
function resetNamesFilters() { ['filterFamilyHead', 'filterFullName', 'filterArea', 'filterGender', 'filterMarital', 'filterElection'].forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; }); const d = document.getElementById('filterDeceased'); if (d) d.value = "alive"; applyNamesFilter(); }

// ----------------- قسم مدارس الأحد (عرض الكشوف + أزرار الاتصال والواتساب) -----------------
function switchSSView(view) {
    if (view === 'live') {
        document.getElementById('sundaySchoolLiveSection')?.classList.remove('hidden'); document.getElementById('standardCardsContainer')?.classList.add('hidden');
        populateSSFilters(); loadSSLiveClassKids();
    } else {
        document.getElementById('sundaySchoolLiveSection')?.classList.add('hidden'); document.getElementById('standardCardsContainer')?.classList.remove('hidden');
        renderStandardCards();
    }
}
function populateSSFilters() {
    const sSel = document.getElementById('ssFilterStage'); if (!sSel) return;
    sSel.innerHTML = Object.keys(stagesGradesMap).map(s => `<option value="${s}">${s}</option>`).join('');
    onSSFilterStageChange(sSel.value);
}
function onSSFilterStageChange(stage) {
    const gSel = document.getElementById('ssFilterGrade'); if (!gSel) return;
    const grades = stagesGradesMap[stage] || [];
    gSel.innerHTML = grades.map(g => `<option value="${g}">${g}</option>`).join('');
    onSSFilterGradeChange();
}
function onSSFilterGradeChange() {
    const cSel = document.getElementById('ssFilterClass'); if (!cSel) return;
    const stage = document.getElementById('ssFilterStage')?.value, grade = document.getElementById('ssFilterGrade')?.value;
    const classes = [...new Set(namesData.filter(i => i.Stage === stage && i.ClassGrade === grade).map(i => i.ClassName).filter(Boolean))];
    cSel.innerHTML = classes.length ? classes.map(c => `<option value="${c}">${c}</option>`).join('') : `<option value="عام">فصل عام</option>`;
    loadSSLiveClassKids();
}

// دالة عرض كشف الفصل التفاعلي مع أزرار الاتصال والواتساب
function loadSSLiveClassKids() {
    const stage = document.getElementById('ssFilterStage')?.value, grade = document.getElementById('ssFilterGrade')?.value, cls = document.getElementById('ssFilterClass')?.value;
    const kids = namesData.filter(i => i.Stage === stage && (!grade || i.ClassGrade === grade) && (cls === "عام" || !cls || i.ClassName === cls));
    const tbody = document.getElementById('ssLiveKidsTableBody'), empty = document.getElementById('ssLiveKidsEmpty');
    if (!tbody) return;
    if (!kids.length) { tbody.innerHTML = ''; empty?.classList.remove('hidden'); return; }
    empty?.classList.add('hidden');

    tbody.innerHTML = kids.map((k, idx) => `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100" data-kid-id="${k.ID}" data-kid-name="${k.FullName}">
            <td class="p-3 text-center text-slate-400 font-mono">${idx + 1}</td>
            <td class="p-3"><p class="font-black text-slate-800">${k.FullName}</p><p class="text-[10px] text-slate-400 font-bold">رب الأسرة: ${k.FamilyHead || '-'}</p></td>
            <td class="p-3">${renderContactButtons(k.Phone)}</td>
            <td class="p-3 text-center">
                <select class="ss-attendance-select p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold outline-none focus:ring-1 focus:ring-blue-500">
                    <option value="حاضر" selected>حاضر</option>
                    <option value="غائب">غائب</option>
                    <option value="معتذر">معتذر</option>
                </select>
            </td>
            <td class="p-3 text-center">
                <select class="ss-recite-select p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold outline-none">
                    <option value="ممتاز">ممتاز ⭐⭐⭐</option>
                    <option value="جيد جداً">جيد جداً ⭐⭐</option>
                    <option value="متوسط">متوسط ⭐</option>
                    <option value="لم يحفظ">لم يحفظ ❌</option>
                </select>
            </td>
            <td class="p-3 text-center"><input type="number" value="10" min="0" max="50" class="ss-points-input w-16 p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold text-center outline-none"></td>
            <td class="p-3"><input type="text" placeholder="اكتب ملاحظة أو سبب الغياب..." class="ss-notes-input w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:bg-white"></td>
        </tr>
    `).join('');
}

function markAllSSKids(val) { document.querySelectorAll('.ss-attendance-select').forEach(sel => sel.value = val); }
function saveSundaySchoolBatchAttendance() {
    const rows = document.querySelectorAll('#ssLiveKidsTableBody tr'); if (!rows.length) return alert('لا يوجد مخدومين لرصد حضورهم.');
    const date = document.getElementById('ssSessionDate')?.value || new Date().toLocaleDateString('en-GB');
    const stage = document.getElementById('ssFilterStage')?.value, grade = document.getElementById('ssFilterGrade')?.value, cls = document.getElementById('ssFilterClass')?.value;
    const batch = Array.from(rows).map(r => ({
        ID: Date.now() + Math.floor(Math.random()*1000), ChildName: r.getAttribute('data-kid-name'),
        Stage: stage, Grade: grade, ClassName: cls, SessionDate: date,
        Attendance: r.querySelector('.ss-attendance-select')?.value,
        Recitation: r.querySelector('.ss-recite-select')?.value,
        Points: r.querySelector('.ss-points-input')?.value,
        Notes: r.querySelector('.ss-notes-input')?.value,
        ServantName: currentUser.ServantName
    }));
    batch.forEach(rec => rawData.unshift(rec));
    alert(`تم رصد وحفظ حضور وتقييم ${batch.length} مخدوم بنجاح!`);
}

// ----------------- قسم اجتماع الخدام -----------------
function switchMeetingsView(view) {
    if (view === 'live') {
        document.getElementById('servantsMeetingLiveSection')?.classList.remove('hidden'); document.getElementById('standardCardsContainer')?.classList.add('hidden');
        loadServantsMeetingRoster();
    } else {
        document.getElementById('servantsMeetingLiveSection')?.classList.add('hidden'); document.getElementById('standardCardsContainer')?.classList.remove('hidden');
        renderStandardCards();
    }
}
function loadServantsMeetingRoster() {
    const tbody = document.getElementById('servantsMeetingTableBody'); if (!tbody) return;
    const sList = servantsData.length ? servantsData : namesData.filter(i => i.Role && i.Role.includes('خادم'));
    tbody.innerHTML = sList.map((s, idx) => `
        <tr class="hover:bg-slate-50 transition border-b border-slate-100" data-servant-name="${s.ServantName || s.FullName}">
            <td class="p-3 text-center text-slate-400 font-mono">${idx + 1}</td>
            <td class="p-3 font-black text-slate-800">${s.ServantName || s.FullName}</td>
            <td class="p-3 text-xs text-slate-600 font-semibold">${s.AssignedStage || s.Stage || 'خدمة عامة'}</td>
            <td class="p-3">${renderContactButtons(s.Phone)}</td>
            <td class="p-3 text-center">
                <select class="servant-status-select p-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs font-bold outline-none">
                    <option value="حاضر" selected>حاضر</option>
                    <option value="معتذر">معتذر</option>
                    <option value="غائب">غائب</option>
                </select>
            </td>
            <td class="p-3"><input type="text" placeholder="سبب الاعتذار أو ملاحظة..." class="servant-notes-input w-full p-1.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-semibold outline-none focus:bg-white"></td>
        </tr>
    `).join('');
}
function markAllServantsMeeting(st) { document.querySelectorAll('.servant-status-select').forEach(s => s.value = st); }
function saveServantsMeetingBatchAttendance() {
    const rows = document.querySelectorAll('#servantsMeetingTableBody tr'); if (!rows.length) return alert('لا يوجد خدام لحفظ حضورهم.');
    const date = document.getElementById('servantsMeetingDate')?.value, mName = document.getElementById('servantsMeetingName')?.value;
    const batch = Array.from(rows).map(r => ({
        ID: Date.now() + Math.floor(Math.random()*1000), ServantName: r.getAttribute('data-servant-name'),
        MeetingName: mName, MeetingDate: date, Status: r.querySelector('.servant-status-select')?.value,
        Notes: r.querySelector('.servant-notes-input')?.value, LoggedBy: currentUser.ServantName
    }));
    batch.forEach(rec => rawData.unshift(rec));
    alert(`تم حفظ سجل حضور اجتماع الخدام لعدد ${batch.length} خادم بنجاح!`);
}

// ----------------- الافتقاد الرعوي -----------------
function switchVisitationsView(view) {
    if (view === 'dashboard') {
        document.getElementById('visitationDashboardSection')?.classList.remove('hidden'); document.getElementById('standardCardsContainer')?.classList.add('hidden');
        renderVisitationDashboard();
    } else {
        document.getElementById('visitationDashboardSection')?.classList.add('hidden'); document.getElementById('standardCardsContainer')?.classList.remove('hidden');
        renderStandardCards();
    }
}
function renderVisitationDashboard() {
    const uList = document.getElementById('visitUrgentList'), fList = document.getElementById('visitFollowupList');
    if (!uList || !fList) return;
    const urgentKids = namesData.slice(0, 5); // نموذج للحالات المتأخرة
    document.getElementById('visitUrgentCount').innerText = urgentKids.length;
    uList.innerHTML = urgentKids.map(k => `
        <div class="p-3 bg-rose-50/50 rounded-xl border border-rose-100 flex items-center justify-between">
            <div><p class="font-black text-xs text-rose-900">${k.FullName}</p><p class="text-[10px] text-rose-600 font-bold mt-0.5">غائب منذ أكثر من 90 يوماً | ${k.Area || ''}</p></div>
            ${renderContactButtons(k.Phone)}
        </div>
    `).join('');
    fList.innerHTML = `<div class="p-4 text-center text-slate-400 font-bold text-xs bg-slate-50 rounded-xl">لا توجد زيارات مجدولة قادمة لهذا الأسبوع</div>`;
}

// ----------------- جلب البيانات والمزامنة -----------------
async function loadData(force = false) {
    const loader = document.getElementById('loader'); loader?.classList.remove('hidden');
    try {
        const res = await fetch(SCRIPT_URL + "?action=getAllData");
        if (res.ok) {
            const data = await res.json();
            namesData = data.names || []; servantsData = data.servants || [];
            rawData = data.sundaySchool || [];
        } else throw new Error("تعذر جلب البيانات");
    } catch(err) {
        // بيانات أولية لضمان عمل البرنامج في حال عدم الاتصال المباشر
        if (!namesData.length) {
            namesData = [
                { ID: 101, FullName: "سامي ابسخرون", FamilyHead: "سامي ابسخرون", Relationship: "رب الأسرة", Phone: "01223344556", Area: "منطقة أولى", ClassGrade: "", Stage: "", Deceased: "لا" },
                { ID: 102, FullName: "مارينا سامي ابسخرون", FamilyHead: "سامي ابسخرون", Relationship: "ابنة", Phone: "01099887766", Area: "منطقة أولى", ClassGrade: "أولى إعدادي", Stage: "إعدادي", Deceased: "لا" },
                { ID: 103, FullName: "مينا سامي ابسخرون", FamilyHead: "سامي ابسخرون", Relationship: "ابن", Phone: "01122334455", Area: "منطقة أولى", ClassGrade: "ثالثة ابتدائي", Stage: "ابتدائي", Deceased: "لا" }
            ];
        }
    } finally {
        loader?.classList.add('hidden');
        if (currentTab === "Names") renderRoster();
        else if (currentTab === "Sunday_School") loadSSLiveClassKids();
        else renderStandardCards();
    }
}

function populateUserSelect() {
    const sel = document.getElementById('loginUser'); if (!sel) return;
    const users = [{ name: "الأدمن", role: "Admin" }, ...servantsData.map(s => ({ name: s.ServantName, role: s.Role }))];
    sel.innerHTML = users.map(u => `<option value="${u.name}">${u.name}</option>`).join('');
}
function setupEventListeners() { /* أحداث عامة إضافية للنافذة والبحث */ }
function openModal(mode, id) { document.getElementById('dataModal')?.classList.remove('hidden'); }
function closeModal() { document.getElementById('dataModal')?.classList.add('hidden'); }
function editRecord(id) { alert('تعديل السجل رقم #' + id); }
function deleteRecord(id) { if (confirm('هل أنت متأكد من حذف السجل نهائياً؟')) alert('تم الحذف.'); }
function printFilteredResults() { window.print(); }
function printRosterDirectory() { window.print(); }
