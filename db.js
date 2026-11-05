// تهيئة قاعدة البيانات المحلية على جهاز المستخدم
const localDB = new Dexie("ChurchCareDB");

localDB.version(1).stores({
    names: "++ID, [المرحلة+الصف], اسم رب الاسرة, الاسم ثلاثي",
    sunday_school: "++ID, SessionDate, Stage, Grade, ClassName",
    visitations: "++ID, VisitDate, MemberID, FollowUpDate",
    meetings: "++ID, MeetingDate, MemberID",
    servants: "++ID, Username, Role",
    pending_sync: "++queueId, sheet, action, data, timestamp" // طابور العمليات غير المتزامنة
});

// حفظ البيانات المجلوبة من الشيت محلياً (Cache Invalidation)
async function cacheSheetDataLocally(sheetName, data) {
    if (!data || data.length === 0) return;
    const table = localDB.table(sheetName.toLowerCase());
    await table.clear();
    await table.bulkPut(data);
}

// تنفيذ العملية محلياً وإضافتها لطابور المزامنة
async function executeOperation(sheetName, action, payload) {
    const table = localDB.table(sheetName.toLowerCase());

    // 1. التطبيق الفوري على الواجهة وقاعدة البيانات المحلية
    if (action === "add" || action === "batch_add") {
        if (Array.isArray(payload)) {
            await table.bulkAdd(payload);
        } else {
            await table.add(payload);
        }
    } else if (action === "update") {
        const idKey = Object.keys(payload)[0];
        await table.put(payload);
    } else if (action === "delete") {
        const id = Object.values(payload)[0];
        await table.delete(id);
    }

    // 2. إذا كان متصلاً، يرسل للشيت، وإلا يودع في طابور المعلقات
    if (navigator.onLine) {
        try {
            await fetch(API_URL, {
                method: "POST",
                body: JSON.stringify({ sheet: sheetName, action: action, data: payload })
            });
        } catch (e) {
            await queueOfflineOperation(sheetName, action, payload);
        }
    } else {
        await queueOfflineOperation(sheetName, action, payload);
    }
}

// حفظ العملية في طابور الانتظار
async function queueOfflineOperation(sheetName, action, payload) {
    await localDB.pending_sync.add({
        sheet: sheetName,
        action: action,
        data: payload,
        timestamp: new Date().toISOString()
    });
}

// إفراغ طابور العمليات المعلقة فور عودة الإنترنت
async function syncPendingQueueToServer() {
    const pending = await localDB.pending_sync.toArray();
    if (pending.length === 0) return;

    for (const item of pending) {
        try {
            await fetch(API_URL, {
                method: "POST",
                body: JSON.stringify({ sheet: item.sheet, action: item.action, data: item.data })
            });
            await localDB.pending_sync.delete(item.queueId);
        } catch (err) {
            break; // توقف إذا انقطع الاتصال مجدداً
        }
    }
}

// مراقبة عودة الاتصال تلقائياً
window.addEventListener("online", () => {
    syncPendingQueueToServer();
});
