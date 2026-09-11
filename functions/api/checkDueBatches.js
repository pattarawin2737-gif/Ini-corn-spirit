export async function onRequestPost(context) {
  return handleCheck(context);
}

export async function onRequestGet(context) {
  return handleCheck(context);
}

async function handleCheck(context) {
  const { env } = context;
  try {
    const db = env.DB;
    if (!db) {
      return new Response(JSON.stringify({ success: false, error: "Database not connected" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // Get today's date in Thailand timezone (Asia/Bangkok) as YYYY-MM-DD
    const now = new Date();
    const bkkDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(now);

    // 1. Fetch Telegram Bot Token & Chat ID
    let botToken = '';
    let chatId = '';
    let notifyOnDue = 'true';
    try {
      const { results: settingsRows } = await db.prepare("SELECT Key, Value FROM SystemSettings WHERE Key IN ('telegram_bot_token', 'telegram_chat_id', 'notify_on_due')").all();
      (settingsRows || []).forEach(r => {
        if (r.Key === 'telegram_bot_token') botToken = r.Value;
        if (r.Key === 'telegram_chat_id') chatId = r.Value;
        if (r.Key === 'notify_on_due') notifyOnDue = r.Value;
      });
    } catch (e) {}

    if (notifyOnDue === 'false') {
      return new Response(JSON.stringify({ success: true, message: "Due date notification is disabled in settings", notifiedCount: 0 }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    if (!botToken || !chatId) {
      return new Response(JSON.stringify({ success: false, error: "Telegram Bot Token หรือ Chat ID ยังไม่ได้ตั้งค่า" }), {
        headers: { "Content-Type": "application/json" }
      });
    }

    // 2. Fetch Active (non-completed) Batches
    const { results: batches } = await db.prepare(`
      SELECT ID, Title, Date, Status, FermentationDays, FormulaType, RawData, Username
      FROM BatchData
      WHERE Status NOT IN (
        'เสร็จสมบูรณ์กลั่น', 'เสร็จสมบูรณ์แช่', 'เสร็จสมบูรณ์หมัก',
        'เสร็จสมบูรณ์', 'เสร็จสิ้นการทำโซดา', 'ประวัติกลั่น', 'ประวัติแช่', 'ประวัติหมัก'
      )
    `).all();

    const thaiMonths = [
      'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
      'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'
    ];
    function formatThaiDate(dStr) {
      if (!dStr) return '';
      const d = new Date(dStr);
      if (isNaN(d.getTime())) return dStr;
      return `${d.getDate()} ${thaiMonths[d.getMonth()]} ${d.getFullYear() + 543}`;
    }

    const notifiedList = [];

    for (const b of (batches || [])) {
      let raw = {};
      try {
        raw = typeof b.RawData === 'string' ? JSON.parse(b.RawData) : (b.RawData || {});
      } catch(e) {}

      let endDate = raw.dateFermentEnd || raw.dateEnd;
      if (!endDate) continue;
      if (endDate.includes('T')) endDate = endDate.split('T')[0];

      // Check if the batch is due today
      if (endDate === bkkDate) {
        // Prevent duplicate alerts on the same day
        const settingKey = `tg_due_notified_${b.ID}_${bkkDate}`;
        const existing = await db.prepare("SELECT Value FROM SystemSettings WHERE Key = ?").bind(settingKey).first();
        if (existing) continue;

        const type = raw.spiritsType || (b.FormulaType === 10 ? 'โซดา' : 'สุรา');
        const startDateFmt = formatThaiDate(b.Date) || b.Date || '-';
        const endDateFmt = formatThaiDate(endDate) || endDate;
        const days = b.FermentationDays || raw.fermentationDays || raw.fermentDays || 0;

        const message = `🚨 <b>แจ้งเตือนแบทช์ครบกำหนดหมักวันนี้!</b>\n` +
                        `แบทช์: <b>${b.Title || '-'}</b>\n` +
                        `ประเภท: ${type}\n` +
                        `สถานะปัจจุบัน: <b>${b.Status || '-'}</b>\n` +
                        `วันที่เริ่มหมัก: ${startDateFmt}\n` +
                        `สิ้นสุดการหมัก: <b>${endDateFmt}</b> (ครบกำหนดวันนี้ ⚠️)\n` +
                        `จำนวนวันที่หมัก (วัน): <b>${days} วัน</b>\n` +
                        `📌 ถึงกำหนดเปิดถังหมัก / ตรวจสอบการหมักแล้วครับ`;

        // Send via Telegram API
        const tgRes = await fetch(`https://api.telegram.org/bot${botToken.trim()}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId.trim(),
            text: message,
            parse_mode: 'HTML',
            disable_web_page_preview: true
          })
        });

        const tgData = await tgRes.json();
        if (tgData.ok) {
          await db.prepare("INSERT OR REPLACE INTO SystemSettings (Key, Value, UpdatedAt) VALUES (?, 'true', ?)").bind(settingKey, now.toISOString()).run();
          notifiedList.push(b.Title);
        }
      }
    }

    return new Response(JSON.stringify({ 
      success: true, 
      date: bkkDate, 
      notifiedCount: notifiedList.length, 
      notifiedList: notifiedList 
    }), {
      headers: { "Content-Type": "application/json" }
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.toString() }), {
      status: 500,
      headers: { "Content-Type": "application/json" }
    });
  }
}
