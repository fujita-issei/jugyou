/* ===========================================================
 * パーソナルログ: ToDo・日記・タイマー・ローカルLLM要約
 * - 全データ localStorage に保存
 * - HTML/CSS/JS のみ
 * =========================================================== */

/* ---------- タブ切替 ---------- */
const tabs = document.querySelectorAll('.tab');
const views = document.querySelectorAll('.view');
function showView(id) {
  views.forEach(v => v.classList.toggle('active', v.id === id));
  tabs.forEach(t => t.classList.toggle('active', t.dataset.target === id));
}
tabs.forEach(tab => tab.addEventListener('click', () => showView(tab.dataset.target)));

/* ---------- 日付ユーティリティ ---------- */
const pad2 = n => String(n).padStart(2, '0');
const fmtDate = (y, m, d) => `${y}-${pad2(m + 1)}-${pad2(d)}`;
const dateFromStr = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const todayStr = () => new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
const addDays = (s, n) => {
  const d = dateFromStr(s); d.setDate(d.getDate() + n); return fmtDate(d.getFullYear(), d.getMonth(), d.getDate());
};
const fmtJP = s => {
  const d = dateFromStr(s);
  const w = ['日','月','火','水','木','金','土'][d.getDay()];
  return `${d.getFullYear()}年${d.getMonth()+1}月${d.getDate()}日(${w})`;
};
const fmtTime = sec => {
  sec = Math.max(0, Math.floor(sec));
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  return `${pad2(h)}:${pad2(m)}:${pad2(s)}`;
};

/* ---------- ストレージキー ---------- */
const DIARY_KEY = 'diary:';         // diary:YYYY-MM-DD -> text
const TODO_KEY  = 'todos:';         // todos:YYYY-MM-DD -> [{id,text,planMin,elapsedSec,done,note,finishedAt,running,startedAt}]
const LOG_KEY   = 'todolog:';       // todolog:YYYY-MM-DD -> [{id,text,planMin,elapsedSec,note,finishedAt,diffSec}]
const LLM_KEY   = 'llm:saved';      // 保存した要約の配列
const SETTINGS_KEY = 'settings';    // {llmUrl, llmModel}

const loadJSON = (k, def) => { try { return JSON.parse(localStorage.getItem(k)) ?? def; } catch { return def; } };
const saveJSON = (k, v) => localStorage.setItem(k, JSON.stringify(v));

/* ---------- 選択中日付 ---------- */
let currentDate = todayStr();

const dateLabel = document.getElementById('date-label');
const dateBadge = document.getElementById('selected-date-badge');

function setDate(ymd) {
  currentDate = ymd;
  dateLabel.textContent = fmtJP(ymd);
  dateBadge.textContent = fmtJP(ymd);
  loadDiary(ymd);
  renderTodos();
  renderTodoLog();
  renderCalendar();
}

document.getElementById('date-prev').addEventListener('click', () => setDate(addDays(currentDate, -1)));
document.getElementById('date-next').addEventListener('click', () => setDate(addDays(currentDate, +1)));
document.getElementById('date-today').addEventListener('click', () => setDate(todayStr()));

/* ---------- 日記 ---------- */
const diaryDate = document.getElementById('diary-date');
const diaryText = document.getElementById('diary-text');
const diaryStatus = document.getElementById('diary-status');

function loadDiary(date) {
  diaryDate.textContent = date;
  diaryText.value = localStorage.getItem(DIARY_KEY + date) || '';
  diaryStatus.textContent = '';
}

// 自動保存(入力→debounce)
let diaryTimer = null;
diaryText.addEventListener('input', () => {
  clearTimeout(diaryTimer);
  diaryTimer = setTimeout(() => {
    localStorage.setItem(DIARY_KEY + currentDate, diaryText.value);
    diaryStatus.textContent = '自動保存しました';
    renderCalendar();
  }, 400);
});
document.getElementById('diary-save').addEventListener('click', () => {
  localStorage.setItem(DIARY_KEY + currentDate, diaryText.value);
  diaryStatus.textContent = '保存しました';
  renderCalendar();
});

/* ---------- ToDo ---------- */
const todoForm = document.getElementById('todo-form');
const todoTextEl = document.getElementById('todo-text');
const todoPlanEl = document.getElementById('todo-plan');
const todoListEl = document.getElementById('todo-list');
const todoEmptyEl = document.getElementById('todo-empty');

function getTodos(date) { return loadJSON(TODO_KEY + date, []); }
function setTodos(date, arr) { saveJSON(TODO_KEY + date, arr); }

todoForm.addEventListener('submit', e => {
  e.preventDefault();
  const text = todoTextEl.value.trim();
  if (!text) return;
  const planMin = Number(todoPlanEl.value) || null;
  const arr = getTodos(currentDate);
  arr.push({
    id: Date.now() + Math.floor(Math.random() * 999),
    text, planMin,
    elapsedSec: 0, done: false, note: '',
    running: false, startedAt: null,
    notified: false,
  });
  setTodos(currentDate, arr);
  todoTextEl.value = ''; todoPlanEl.value = '';
  renderTodos(); renderCalendar();
});

/* タスクのランニング状態は選択日に関わらずすべての日のタスクを参照する必要がある */
function forEachAllTodos(cb) {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key.startsWith(TODO_KEY)) continue;
    const date = key.slice(TODO_KEY.length);
    const arr = getTodos(date);
    let changed = false;
    for (const t of arr) {
      const r = cb(t, date);
      if (r === true) changed = true;
    }
    if (changed) setTodos(date, arr);
  }
}

function currentElapsed(t) {
  if (t.running && t.startedAt) {
    return t.elapsedSec + (Date.now() - t.startedAt) / 1000;
  }
  return t.elapsedSec;
}

function renderTodos() {
  const arr = getTodos(currentDate);
  todoListEl.innerHTML = '';
  todoEmptyEl.style.display = arr.length ? 'none' : 'block';

  arr.forEach(t => {
    const li = document.createElement('li');
    li.className = 'todo-item' + (t.done ? ' done' : '') + (t.running ? ' running' : '');
    li.dataset.id = t.id;

    const row = document.createElement('div');
    row.className = 'todo-row';

    const cb = document.createElement('input');
    cb.type = 'checkbox'; cb.checked = !!t.done;
    cb.title = '完了トグル';
    cb.addEventListener('change', () => {
      if (cb.checked) finishTask(t.id, false);
      else uncompleteTask(t.id);
    });

    const txt = document.createElement('span');
    txt.className = 'todo-text'; txt.textContent = t.text;

    const plan = document.createElement('span');
    plan.className = 'todo-plan';
    plan.textContent = t.planMin ? `予定 ${t.planMin}分` : '予定なし';

    const el = document.createElement('span');
    el.className = 'todo-elapsed';
    el.textContent = fmtTime(currentElapsed(t));

    const acts = document.createElement('span');
    acts.className = 'todo-actions';

    if (!t.done) {
      const sbtn = document.createElement('button');
      sbtn.className = t.running ? 'stop' : 'start';
      sbtn.textContent = t.running ? '⏸ 停止' : '▶ 開始';
      sbtn.addEventListener('click', () => toggleRun(t.id));
      acts.appendChild(sbtn);

      const fbtn = document.createElement('button');
      fbtn.className = 'finish';
      fbtn.textContent = '✓ 終了';
      fbtn.addEventListener('click', () => finishTask(t.id, true));
      acts.appendChild(fbtn);
    }

    const dbtn = document.createElement('button');
    dbtn.className = 'del'; dbtn.textContent = '🗑';
    dbtn.title = '削除';
    dbtn.addEventListener('click', () => deleteTask(t.id));
    acts.appendChild(dbtn);

    row.append(cb, txt, plan, el, acts);
    li.appendChild(row);

    // 差分表示
    if (t.done && t.planMin) {
      const diffSec = t.elapsedSec - t.planMin * 60;
      const d = document.createElement('div');
      d.className = 'todo-diff ' + (diffSec > 0 ? 'pos' : 'neg');
      const abs = fmtTime(Math.abs(diffSec));
      d.textContent = diffSec > 0 ? `予定より +${abs} 超過` : `予定より -${abs} 短縮`;
      li.appendChild(d);
    }

    // 完了コメント
    if (t.done) {
      const nt = document.createElement('textarea');
      nt.className = 'todo-note';
      nt.placeholder = '実際にどこまで進んだか / 気づいたこと（ログに保存されます）';
      nt.value = t.note || '';
      nt.addEventListener('change', () => updateTaskNote(t.id, nt.value));
      li.appendChild(nt);
    }

    todoListEl.appendChild(li);
  });
}

function toggleRun(id) {
  const arr = getTodos(currentDate);
  const t = arr.find(x => x.id === id);
  if (!t || t.done) return;

  if (t.running) {
    // 停止: elapsed に加算
    t.elapsedSec += (Date.now() - t.startedAt) / 1000;
    t.running = false; t.startedAt = null;
  } else {
    // 他タブや他日付の走行中タスクは全て停止 (単一走行)
    stopAllRunningTasks();
    t.running = true; t.startedAt = Date.now(); t.notified = false;
  }
  setTodos(currentDate, arr);
  renderTodos();
  renderActiveTimer();
}

function stopAllRunningTasks() {
  forEachAllTodos((t) => {
    if (t.running && t.startedAt) {
      t.elapsedSec += (Date.now() - t.startedAt) / 1000;
      t.running = false; t.startedAt = null;
      return true;
    }
    return false;
  });
}

function uncompleteTask(id) {
  const arr = getTodos(currentDate);
  const t = arr.find(x => x.id === id);
  if (!t) return;
  t.done = false; t.finishedAt = null;
  setTodos(currentDate, arr);
  // ログからも対応エントリを削除
  const log = loadJSON(LOG_KEY + currentDate, []);
  const idx = log.findIndex(x => x.id === id);
  if (idx >= 0) { log.splice(idx, 1); saveJSON(LOG_KEY + currentDate, log); }
  renderTodos(); renderTodoLog(); renderCalendar();
}

function finishTask(id, forceCheck) {
  const arr = getTodos(currentDate);
  const t = arr.find(x => x.id === id);
  if (!t) return;
  // 走行中なら elapsed に反映して停止
  if (t.running && t.startedAt) {
    t.elapsedSec += (Date.now() - t.startedAt) / 1000;
    t.running = false; t.startedAt = null;
  }
  t.done = true; t.finishedAt = Date.now();
  const diffSec = t.planMin ? (t.elapsedSec - t.planMin * 60) : null;

  // ログに追加 (既存エントリがあれば更新)
  const log = loadJSON(LOG_KEY + currentDate, []);
  const existing = log.findIndex(x => x.id === id);
  const entry = {
    id: t.id, text: t.text, planMin: t.planMin,
    elapsedSec: Math.round(t.elapsedSec),
    note: t.note || '',
    finishedAt: t.finishedAt,
    diffSec: diffSec == null ? null : Math.round(diffSec),
  };
  if (existing >= 0) log[existing] = entry; else log.push(entry);
  saveJSON(LOG_KEY + currentDate, log);
  setTodos(currentDate, arr);
  renderTodos(); renderTodoLog(); renderActiveTimer(); renderCalendar();
}

function updateTaskNote(id, note) {
  const arr = getTodos(currentDate);
  const t = arr.find(x => x.id === id);
  if (!t) return;
  t.note = note;
  setTodos(currentDate, arr);
  // ログも同期
  const log = loadJSON(LOG_KEY + currentDate, []);
  const l = log.find(x => x.id === id);
  if (l) { l.note = note; saveJSON(LOG_KEY + currentDate, log); }
  renderTodoLog();
}

function deleteTask(id) {
  if (!confirm('このタスクを削除しますか？（ログは残ります）')) return;
  const arr = getTodos(currentDate).filter(x => x.id !== id);
  setTodos(currentDate, arr);
  renderTodos(); renderActiveTimer(); renderCalendar();
}

/* ---------- ToDo完了ログ表示 ---------- */
const logEl = document.getElementById('todo-log');
const logEmpty = document.getElementById('todo-log-empty');
function renderTodoLog() {
  const log = loadJSON(LOG_KEY + currentDate, []);
  logEl.innerHTML = '';
  logEmpty.style.display = log.length ? 'none' : 'block';
  log.forEach(l => {
    const li = document.createElement('li');
    const title = document.createElement('div'); title.className = 'log-title'; title.textContent = l.text;
    const meta = document.createElement('div'); meta.className = 'log-meta';
    const parts = [`所要 ${fmtTime(l.elapsedSec)}`];
    if (l.planMin) parts.push(`予定 ${l.planMin}分`);
    if (l.diffSec != null) {
      const sign = l.diffSec >= 0 ? '+' : '-';
      parts.push(`差 ${sign}${fmtTime(Math.abs(l.diffSec))}`);
    }
    if (l.finishedAt) parts.push(new Date(l.finishedAt).toLocaleTimeString('ja-JP'));
    meta.textContent = parts.join(' / ');
    li.append(title, meta);
    if (l.note) {
      const nt = document.createElement('div'); nt.className = 'log-note'; nt.textContent = l.note;
      li.appendChild(nt);
    }
    logEl.appendChild(li);
  });
}

/* ---------- タイマータブ ---------- */
const activeTimerEl = document.getElementById('active-timer');
function findRunningTask() {
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (!key.startsWith(TODO_KEY)) continue;
    const date = key.slice(TODO_KEY.length);
    const arr = getTodos(date);
    const t = arr.find(x => x.running);
    if (t) return { task: t, date };
  }
  return null;
}

function renderActiveTimer() {
  const r = findRunningTask();
  if (!r) {
    activeTimerEl.innerHTML = '<div class="hint">ToDoタブのタスクで「▶ 開始」を押すとタイマーが動きます。</div>';
    return;
  }
  const { task, date } = r;
  const elapsed = currentElapsed(task);
  const planSec = task.planMin ? task.planMin * 60 : null;
  const remain = planSec != null ? planSec - elapsed : null;

  const bigTime = document.createElement('div'); bigTime.className = 'big-time';
  bigTime.textContent = fmtTime(elapsed);

  const bigText = document.createElement('div'); bigText.className = 'big-text';
  bigText.textContent = `${task.text} （${fmtJP(date)}）`;

  const bigPlan = document.createElement('div'); bigPlan.className = 'big-plan';
  if (planSec != null) {
    if (remain >= 0) bigPlan.textContent = `予定 ${task.planMin}分 / 残り ${fmtTime(remain)}`;
    else bigPlan.textContent = `予定 ${task.planMin}分 / ⚠ 超過 +${fmtTime(-remain)}`;
  } else {
    bigPlan.textContent = '予定時間なし（0秒から計測）';
  }

  const btnRow = document.createElement('div');
  btnRow.style.textAlign = 'center'; btnRow.style.marginTop = '12px';
  btnRow.style.display = 'flex'; btnRow.style.gap = '8px'; btnRow.style.justifyContent = 'center';
  const stop = document.createElement('button'); stop.className = 'link-btn sm'; stop.textContent = '⏸ 一時停止';
  stop.addEventListener('click', () => {
    // 一時停止: その日の toggleRun を呼ぶ
    const arr = getTodos(date);
    const t = arr.find(x => x.id === task.id);
    if (t && t.running) {
      t.elapsedSec += (Date.now() - t.startedAt) / 1000;
      t.running = false; t.startedAt = null;
      setTodos(date, arr);
      renderActiveTimer();
      if (date === currentDate) renderTodos();
    }
  });
  const finish = document.createElement('button'); finish.className = 'link-btn primary'; finish.textContent = '✓ 終了';
  finish.addEventListener('click', () => {
    const prevDate = currentDate;
    currentDate = date;
    finishTask(task.id, true);
    currentDate = prevDate;
    renderActiveTimer(); renderTodos(); renderTodoLog(); renderCalendar();
  });
  btnRow.append(stop, finish);

  activeTimerEl.innerHTML = '';
  activeTimerEl.append(bigTime, bigText, bigPlan, btnRow);
}

/* 1秒ごとに走行中タスクの表示更新と予定超過通知 */
setInterval(() => {
  // ToDoタブ上の経過時間を更新
  document.querySelectorAll('#todo-list .todo-item').forEach(li => {
    const id = Number(li.dataset.id);
    const t = getTodos(currentDate).find(x => x.id === id);
    if (!t || !t.running) return;
    const spanEl = li.querySelector('.todo-elapsed');
    if (spanEl) spanEl.textContent = fmtTime(currentElapsed(t));
  });
  renderActiveTimer();
  checkTimerNotification();
}, 1000);

/* ---------- 通知 ---------- */
const notifyBtn = document.getElementById('notify-enable');
const notifyStatus = document.getElementById('notify-status');
function updateNotifyStatus() {
  if (!('Notification' in window)) { notifyStatus.textContent = 'このブラウザは通知非対応'; return; }
  notifyStatus.textContent = `現在: ${Notification.permission}`;
}
notifyBtn.addEventListener('click', async () => {
  if (!('Notification' in window)) return;
  try { await Notification.requestPermission(); } catch {}
  updateNotifyStatus();
});
updateNotifyStatus();

function notifyUser(title, body) {
  if ('Notification' in window && Notification.permission === 'granted') {
    try { new Notification(title, { body }); } catch {}
  }
  // フォールバック: ページ内アラート(ブラウザによってはブロック)
  try {
    const beep = new AudioContext();
    const o = beep.createOscillator(); const g = beep.createGain();
    o.connect(g); g.connect(beep.destination); o.frequency.value = 880;
    g.gain.value = 0.08; o.start(); setTimeout(() => { o.stop(); beep.close(); }, 300);
  } catch {}
}

function checkTimerNotification() {
  // 全てのタスクを見て、予定時間を超過していて未通知なら通知
  forEachAllTodos((t) => {
    if (!t.running || t.done || !t.planMin || t.notified) return false;
    const elapsed = currentElapsed(t);
    if (elapsed >= t.planMin * 60) {
      t.notified = true;
      notifyUser('⏰ 予定時間に到達', `${t.text}（${t.planMin}分）`);
      return true;
    }
    return false;
  });
}

/* ---------- 現在時刻 ---------- */
const clock = document.getElementById('clock');
const clockDate = document.getElementById('clock-date');
function updateClock() {
  const n = new Date();
  clock.textContent = n.toLocaleTimeString('ja-JP');
  const w = ['日','月','火','水','木','金','土'][n.getDay()];
  clockDate.textContent = `${n.getFullYear()}年${n.getMonth()+1}月${n.getDate()}日(${w})`;
}
updateClock(); setInterval(updateClock, 1000);

/* ---------- カレンダー ---------- */
const calTitle = document.getElementById('cal-title');
const calGrid = document.getElementById('cal-grid');
const _today = new Date();
let calYear = _today.getFullYear();
let calMonth = _today.getMonth();

function renderCalendar() {
  calTitle.textContent = `${calYear}年${calMonth + 1}月`;
  calGrid.innerHTML = '';
  ['日','月','火','水','木','金','土'].forEach((w, i) => {
    const h = document.createElement('div');
    h.className = 'cal-week' + (i === 0 ? ' sun' : i === 6 ? ' sat' : '');
    h.textContent = w;
    calGrid.appendChild(h);
  });
  const first = new Date(calYear, calMonth, 1).getDay();
  const days = new Date(calYear, calMonth + 1, 0).getDate();
  for (let i = 0; i < first; i++) calGrid.appendChild(document.createElement('div'));
  const tStr = fmtDate(_today.getFullYear(), _today.getMonth(), _today.getDate());
  for (let d = 1; d <= days; d++) {
    const date = fmtDate(calYear, calMonth, d);
    const cell = document.createElement('button');
    cell.className = 'cal-day';
    if (date === tStr) cell.classList.add('today');
    if (date === currentDate) cell.classList.add('selected');
    cell.textContent = d;

    const marks = document.createElement('span'); marks.className = 'marks';
    if (localStorage.getItem(DIARY_KEY + date)) {
      const i = document.createElement('i'); i.style.background = '#2e7d32'; marks.appendChild(i);
    }
    if ((loadJSON(TODO_KEY + date, []) || []).length) {
      const i = document.createElement('i'); i.style.background = '#1a56db'; marks.appendChild(i);
    }
    if ((loadJSON(LOG_KEY + date, []) || []).length) {
      const i = document.createElement('i'); i.style.background = '#999'; marks.appendChild(i);
    }
    cell.appendChild(marks);

    cell.addEventListener('click', () => {
      setDate(date);
      showView('view-journal');
    });
    calGrid.appendChild(cell);
  }
}
function moveMonth(delta) {
  const d = new Date(calYear, calMonth + delta, 1);
  calYear = d.getFullYear(); calMonth = d.getMonth(); renderCalendar();
}
document.getElementById('cal-prev').addEventListener('click', () => moveMonth(-1));
document.getElementById('cal-next').addEventListener('click', () => moveMonth(1));
document.getElementById('cal-today').addEventListener('click', () => {
  calYear = _today.getFullYear(); calMonth = _today.getMonth(); renderCalendar();
});

/* ---------- ローカルLLM要約 (Ollama) ---------- */
const llmFrom = document.getElementById('llm-from');
const llmTo   = document.getElementById('llm-to');
const llmUrl  = document.getElementById('llm-url');
const llmModel = document.getElementById('llm-model');
const llmOut  = document.getElementById('llm-output');
const llmStatus = document.getElementById('llm-status');
const llmSaveBtn = document.getElementById('llm-save');

const settings = loadJSON(SETTINGS_KEY, {});
if (settings.llmUrl)   llmUrl.value   = settings.llmUrl;
if (settings.llmModel) llmModel.value = settings.llmModel;
[llmUrl, llmModel].forEach(el => el.addEventListener('change', () => {
  saveJSON(SETTINGS_KEY, { llmUrl: llmUrl.value.trim(), llmModel: llmModel.value.trim() });
}));

// デフォルト期間: 直近1週間
(function initRange() {
  const to = todayStr();
  const d = dateFromStr(to); d.setDate(d.getDate() - 6);
  llmFrom.value = fmtDate(d.getFullYear(), d.getMonth(), d.getDate());
  llmTo.value = to;
})();

document.getElementById('llm-range-week').addEventListener('click', () => {
  const to = todayStr(); const d = dateFromStr(to); d.setDate(d.getDate() - 6);
  llmFrom.value = fmtDate(d.getFullYear(), d.getMonth(), d.getDate()); llmTo.value = to;
});
document.getElementById('llm-range-month').addEventListener('click', () => {
  const to = todayStr(); const d = dateFromStr(to); d.setDate(d.getDate() - 29);
  llmFrom.value = fmtDate(d.getFullYear(), d.getMonth(), d.getDate()); llmTo.value = to;
});

function collectRange(from, to) {
  const rows = [];
  let cur = from;
  while (cur <= to) {
    const diary = localStorage.getItem(DIARY_KEY + cur) || '';
    const log = loadJSON(LOG_KEY + cur, []);
    if (diary || log.length) {
      rows.push({ date: cur, diary, log });
    }
    cur = addDays(cur, 1);
  }
  return rows;
}

function buildPrompt(rows) {
  const header =
    'あなたは個人の日々の活動ログを要約するアシスタントです。' +
    '以下は日付ごとの「今日あったこと(日記)」と「完了したToDoタスク(所要時間・予定差分・コメント)」です。' +
    '期間全体を踏まえて、以下を日本語で簡潔に出力してください:\n' +
    '1. 期間ハイライト(3〜5点)\n' +
    '2. タスクの出来・時間の使い方の傾向(予定との差分に注目)\n' +
    '3. 気づき/改善提案(2〜3点)\n\n';
  const body = rows.map(r => {
    const lines = [`### ${r.date}`];
    if (r.diary) lines.push(`[日記] ${r.diary}`);
    if (r.log.length) {
      lines.push('[完了ToDo]');
      r.log.forEach(l => {
        const diff = l.diffSec == null ? '' :
          (l.diffSec >= 0 ? ` 差+${Math.round(l.diffSec/60)}分` : ` 差${Math.round(l.diffSec/60)}分`);
        lines.push(`- ${l.text} (所要${Math.round(l.elapsedSec/60)}分${l.planMin?` 予定${l.planMin}分${diff}`:''})${l.note?` / ${l.note}`:''}`);
      });
    }
    return lines.join('\n');
  }).join('\n\n');
  return header + body;
}

async function runLLM() {
  const from = llmFrom.value, to = llmTo.value;
  if (!from || !to) { llmStatus.textContent = '期間を指定してください'; llmStatus.classList.add('err'); return; }
  if (from > to) { llmStatus.textContent = '開始日が終了日より後です'; llmStatus.classList.add('err'); return; }
  llmStatus.classList.remove('err');
  const rows = collectRange(from, to);
  if (!rows.length) {
    llmOut.textContent = '指定期間に日記・ToDoログがありません。';
    llmStatus.textContent = ''; llmSaveBtn.disabled = true; return;
  }
  const prompt = buildPrompt(rows);
  const url = (llmUrl.value || 'http://localhost:11434').replace(/\/$/, '') + '/api/generate';
  const model = llmModel.value || 'llama3.2';

  llmStatus.textContent = `接続中: ${url} (${model})`;
  llmOut.textContent = '';
  llmSaveBtn.disabled = true;

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model, prompt, stream: true }),
    });
    if (!res.ok || !res.body) {
      throw new Error(`HTTP ${res.status}: ${await res.text().catch(() => '')}`);
    }
    llmStatus.textContent = '生成中…';
    const reader = res.body.getReader();
    const dec = new TextDecoder();
    let buf = '', text = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buf += dec.decode(value, { stream: true });
      const lines = buf.split('\n'); buf = lines.pop();
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const j = JSON.parse(line);
          if (j.response) { text += j.response; llmOut.textContent = text; }
          if (j.done) { /* 終了 */ }
        } catch {}
      }
    }
    llmStatus.textContent = '完了';
    llmSaveBtn.disabled = !text.trim();
    llmSaveBtn.onclick = () => {
      const saved = loadJSON(LLM_KEY, []);
      saved.unshift({
        id: Date.now(), from, to, model, savedAt: Date.now(),
        text, days: rows.length,
      });
      saveJSON(LLM_KEY, saved.slice(0, 50));
      renderSavedSummaries();
      llmStatus.textContent = '保存しました';
    };
  } catch (e) {
    llmStatus.classList.add('err');
    llmStatus.textContent = '接続失敗';
    llmOut.textContent =
      `ローカルLLM(Ollama)に接続できませんでした。\n\n` +
      `エラー: ${e.message}\n\n` +
      `対処:\n` +
      `  1) https://ollama.com からインストール\n` +
      `  2) ターミナルで:  ollama pull ${model}\n` +
      `  3) ollama serve  (または Ollamaアプリを起動)\n` +
      `  4) CORSを許可: 環境変数  OLLAMA_ORIGINS=*  を設定して再起動\n` +
      `     (PowerShell: $env:OLLAMA_ORIGINS="*"; ollama serve)`;
  }
}
document.getElementById('llm-run').addEventListener('click', runLLM);

const savedUl = document.getElementById('llm-saved');
const savedEmpty = document.getElementById('llm-saved-empty');
function renderSavedSummaries() {
  const arr = loadJSON(LLM_KEY, []);
  savedUl.innerHTML = '';
  savedEmpty.style.display = arr.length ? 'none' : 'block';
  arr.forEach(s => {
    const li = document.createElement('li');
    const title = document.createElement('div'); title.className = 'log-title';
    title.textContent = `${s.from} 〜 ${s.to}  [${s.model}]`;
    const meta = document.createElement('div'); meta.className = 'log-meta';
    meta.textContent = `${new Date(s.savedAt).toLocaleString('ja-JP')} / ${s.days}日分`;
    const note = document.createElement('div'); note.className = 'log-note';
    note.textContent = s.text;
    const del = document.createElement('button'); del.className = 'link-btn sm danger';
    del.textContent = '削除'; del.style.marginTop = '4px';
    del.addEventListener('click', () => {
      const next = loadJSON(LLM_KEY, []).filter(x => x.id !== s.id);
      saveJSON(LLM_KEY, next); renderSavedSummaries();
    });
    li.append(title, meta, note, del);
    savedUl.appendChild(li);
  });
}
renderSavedSummaries();

/* ---------- 初期化 ---------- */
setDate(currentDate);
renderActiveTimer();
