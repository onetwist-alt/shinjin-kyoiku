/* ===== 責任者側 ===== */

let me = null;
let employees = [], items = [], admins = [], reports = [];
const progressMap = {}, approvalsMap = {}, unlockedMap = {}, unlockedVideoMap = {}, memosMap = {}, practiceMap = {};
let practiceSettings = { useDefault: true, custom: [] };
let appSettings = { phaseLock: false };
let reportFilter = 'all', reportEmp = '';
let currentEmp = null, empNotes = [], empReports = [], empDaily = {};
let operators = [];            // 操作する責任者の名前リスト（settings/app.operators）
let accountName = '';          // ログインアカウントに付いている名前

/* 日報の確認：共有アカウントでも誰が確認したか分かるように名前をキーにする */
function myConfirmKey(r) {
  const c = r.confirmations || {};
  const k = Object.keys(c).find(k => k === me.name || (c[k] && c[k].name === me.name) || (k === me.uid && operators.length === 0));
  return k || null;
}
function confirmedByMe(r) { return !!myConfirmKey(r); }

function operatorStorageKey() { return 'operatorName_' + (me ? me.uid : ''); }
function applyOperator(name) {
  me.name = name || accountName;
  try { if (name) localStorage.setItem(operatorStorageKey(), name); } catch (e) {}
  $('#me-name').textContent = me.name;
  const b = $('#btn-operator');
  if (b) b.textContent = `👤 ${me.name}`;
  $('#my-name-disp').textContent = me.name;
}
function openOperatorModal(required) {
  openModal(`<h3>誰が操作しますか？</h3>
    <p class="muted small">承認・日報の確認・指導記録に、選んだ名前が記録されます。人が変わるときは右上の 👤 から切り替えてください</p>
    <div class="value-chips op-chips" style="margin:8px 0 12px">${operators.map(n => `<button type="button" class="chip ${n === me.name ? 'active' : ''}" data-op="${esc(n)}">${esc(n)}</button>`).join('')}</div>
    <div class="inline-form"><input id="op-new" placeholder="名前を追加（例：佐藤）"><button type="button" class="btn btn-ghost" id="op-add">追加</button></div>
    <p id="op-error" class="error"></p>
    ${required ? '' : '<button type="button" class="btn btn-ghost btn-block" id="op-cancel">閉じる</button>'}`, { sticky: !!required });
  const modal = $('#modal');
  modal.addEventListener('click', async e => {
    const c = e.target.closest('[data-op]');
    if (c) { applyOperator(c.dataset.op); closeModal(); toast(`${c.dataset.op} として操作します`, 'ok'); renderReports(); renderPending(); if (currentEmp) renderEmpDetail(); }
  });
  if (!required) $('#op-cancel').addEventListener('click', closeModal);
  const add = async () => {
    const n = $('#op-new').value.trim();
    if (!n) return;
    if (operators.includes(n)) { $('#op-error').textContent = 'すでにあります'; return; }
    try {
      const next = [...operators, n];
      await db.doc('settings/app').set({ operators: next, updatedAt: FV.serverTimestamp() }, { merge: true });
      operators = next; appSettings.operators = next;
      applyOperator(n); closeModal(); renderOperatorsSetting();
      toast(`${n} を追加し、${n} として操作します`, 'ok');
    } catch (err) { $('#op-error').textContent = authErrorMessage(err); }
  };
  $('#op-add').addEventListener('click', add);
  $('#op-new').addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); add(); } });
}
function renderOperatorsSetting() {
  const el = $('#op-list');
  if (!el) return;
  el.innerHTML = operators.length ? operators.map(n => `<div class="row"><div class="row-main">${esc(n)}${n === me.name ? ' <span class="badge badge-type">いま操作中</span>' : ''}</div><button type="button" class="btn btn-ghost btn-sm" data-op-del="${esc(n)}">削除</button></div>`).join('') : '<p class="muted small">まだ名前がありません。ログイン後に出る画面か、下の欄から追加してください</p>';
}
async function saveOperators(next) {
  await db.doc('settings/app').set({ operators: next, updatedAt: FV.serverTimestamp() }, { merge: true });
  operators = next; appSettings.operators = next;
  renderOperatorsSetting();
}
let empCal = newCalState();
let empTab = 'record';   // 社員詳細のサブタブ: record / items / practice

const pubItems = () => items.filter(i => i.published !== false);
const activeEmployees = () => employees.filter(e => e.active !== false);

document.addEventListener('DOMContentLoaded', () => {
  applyAppName('責任者');
  bindLoginForm();
  $('#blocked-logout').addEventListener('click', () => auth.signOut());
  $('#btn-logout').addEventListener('click', () => { if (confirm('ログアウトしますか？')) auth.signOut(); });
  $$('.tabbar button').forEach(b => b.addEventListener('click', () => setTab(b.dataset.tab)));

  $('#pending-list').addEventListener('click', onPendingClick);

  $('#btn-add-emp').addEventListener('click', openAddEmployee);
  $('#emp-list').addEventListener('click', e => {
    const card = e.target.closest('[data-emp]');
    if (card) openEmployee(card.dataset.emp);
  });
  $('#btn-emp-back').addEventListener('click', closeEmployee);
  $('#emp-detail').addEventListener('click', onEmpDetailClick);

  $$('[data-rfilter]').forEach(c => c.addEventListener('click', () => {
    reportFilter = c.dataset.rfilter;
    $$('[data-rfilter]').forEach(x => x.classList.toggle('active', x === c));
    renderReports();
  }));
  $('#report-emp-filter').addEventListener('change', e => { reportEmp = e.target.value; renderReports(); });
  $('#reports-list').addEventListener('click', onReportClick);

  $('#btn-add-item').addEventListener('click', () => openItemModal(null));
  $('#btn-bulk-items').addEventListener('click', openBulkModal);
  $('#items-list').addEventListener('click', onItemsClick);
  bindItemDrag();
  $('#items-phase-chips').addEventListener('click', e => {
    const ph = e.target.closest('[data-iphase]');
    if (ph) { itemsPhase = ph.dataset.iphase; renderItems(); }
  });
  $('#type-seg').addEventListener('click', e => {
    const b = e.target.closest('[data-type]');
    if (b) { itemsType = b.dataset.type; renderItems(); }
  });

  $('#btn-add-admin').addEventListener('click', openAddAdmin);
  $('#admin-list').addEventListener('click', onAdminListClick);
  $('#btn-edit-my-name').addEventListener('click', editMyName);
  $('#btn-operator').addEventListener('click', () => openOperatorModal(false));
  $('#btn-backup').addEventListener('click', e => exportBackup(e.target));
  $('#op-add-setting').addEventListener('click', async () => {
    const n = $('#op-new-setting').value.trim();
    if (!n) return;
    if (operators.includes(n)) { toast('すでにあります', 'err'); return; }
    try { await saveOperators([...operators, n]); $('#op-new-setting').value = ''; toast(`${n} を追加しました`, 'ok'); }
    catch (err) { toast(authErrorMessage(err), 'err'); }
  });
  $('#op-list').addEventListener('click', async e => {
    const b = e.target.closest('[data-op-del]');
    if (!b || !confirm(`${b.dataset.opDel} を名前リストから外しますか？（過去の記録はそのまま残ります）`)) return;
    try { await saveOperators(operators.filter(n => n !== b.dataset.opDel)); toast('外しました'); }
    catch (err) { toast(authErrorMessage(err), 'err'); }
  });
  $('#pw-save').addEventListener('click', savePracticeWords);
  $('#tier-save').addEventListener('click', saveTiers);
  $('#tier-list').addEventListener('click', e => {
    const all = e.target.closest('[data-tier-all]');
    if (all) {
      e.preventDefault();
      SHORTCUT_SETS[all.dataset.tierAll].items.forEach(it => { tierDraft[it.id] = all.dataset.tier; });
      $$(`.tier-row`, $('#tier-list')).forEach(paintTierRow);
      return;
    }
    const b = e.target.closest('.seg-tier [data-tier]');
    if (!b) return;
    const row = b.closest('.tier-row');
    tierDraft[row.dataset.tierId] = b.dataset.tier;
    paintTierRow(row);
  });
  $('#pass-save').addEventListener('click', savePassLine);
  $('#nt-save').addEventListener('click', e => saveNotifySettings(e.target));
  $('#nt-test').addEventListener('click', e => testNotify(e.target));
  $('#phase-lock').addEventListener('change', async e => {
    const on = e.target.checked;
    if (on && !confirm('段階の許可制をオンにします。\n許可していない段階は社員に表示されなくなります。\nいま進行中の段階と最初の段階は、全員分を自動で許可します。よろしいですか？')) { e.target.checked = false; return; }
    e.target.disabled = true;
    try {
      if (on) await autoUnlockAll();
      await db.doc('settings/app').set({ phaseLock: on, updatedAt: FV.serverTimestamp() }, { merge: true });
      appSettings.phaseLock = on;
      renderEmployees();
      if (currentEmp) renderEmpDetail();
      toast(on ? '段階の許可制をオンにしました' : '段階の許可制をオフにしました', 'ok');
    } catch (err) {
      toast(authErrorMessage(err), 'err');
      e.target.checked = !on;
    } finally { e.target.disabled = false; }
  });
  bindRefresh(refreshAll);

  auth.onAuthStateChanged(onAuth);
});

/* 最新の状態に更新（開いている社員詳細はそのまま開き直す） */
async function refreshAll(btn) {
  if (!me || (btn && btn.disabled)) return;
  setBusy(btn, true, '更新中…');
  try {
    if (await checkForNewVersion(true)) return;
    const openId = currentEmp ? currentEmp.id : null;
    await loadAll();
    renderAll();
    if (openId) await openEmployee(openId);
    toast('最新の状態に更新しました', 'ok');
  } catch (err) {
    toast(authErrorMessage(err), 'err');
  } finally {
    setBusy(btn, false);
  }
}

/* ---- 認証 ---- */
async function onAuth(user) {
  if (!user) { me = null; showLoginWithSplash(); return; }
  showView('view-loading');
  const email = (user.email || '').toLowerCase();
  try {
    const adm = await db.doc('admins/' + email).get();
    if (!adm.exists) {
      showBlocked('このアカウントは責任者として登録されていません。責任者に「責任者を追加」してもらうか、社員画面からログインしてください。');
      return;
    }
    accountName = adm.data().name || email;
    me = { uid: user.uid, email, name: accountName };
    $('#me-name').textContent = me.name;
    await loadAll();
    operators = appSettings.operators || [];
    let stored = '', needPick = false;
    try { stored = localStorage.getItem(operatorStorageKey()) || ''; } catch (e) {}
    if (operators.length && stored && operators.includes(stored)) applyOperator(stored);
    else { applyOperator(''); needPick = operators.length > 0; }
    renderAll();
    setTab('pending');
    showView('view-main');
    checkForNewVersion(false);
    if (needPick) openOperatorModal(true);
  } catch (err) {
    showBlocked('読み込みに失敗しました：' + authErrorMessage(err));
  }
}

function showBlocked(msg) {
  $('#blocked-msg').textContent = msg;
  showView('view-blocked');
}

/* ---- データ読み込み ---- */
async function loadAll() {
  const [empSnap, it, admSnap, repSnap, app, pw] = await Promise.all([
    db.collection('employees').get(),
    fetchItems(false),
    db.collection('admins').get(),
    db.collection('reports').orderBy('createdAt', 'desc').limit(150).get(),
    fetchAppSettings(),
    fetchPracticeWords(),
    fetchNotifySettings(),
  ]);
  appSettings = app;
  practiceSettings = pw;
  employees = empSnap.docs.map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja'));
  items = it;
  admins = admSnap.docs.map(d => ({ email: d.id, ...d.data() }));
  reports = repSnap.docs.map(d => ({ id: d.id, ...d.data() }));
  await loadProgress();
  markLoaded();
}

async function loadProgress() {
  const results = await Promise.all(employees.flatMap(e => [
    db.doc('progress/' + e.id).get(),
    db.doc('approvals/' + e.id).get(),
  ]));
  employees.forEach((e, i) => {
    const p = results[i * 2], a = results[i * 2 + 1];
    progressMap[e.id] = p.exists ? (p.data().done || {}) : {};
    memosMap[e.id] = p.exists ? (p.data().memos || {}) : {};
    practiceMap[e.id] = p.exists ? (p.data().practice || {}) : {};
    approvalsMap[e.id] = a.exists ? (a.data().items || {}) : {};
    unlockedMap[e.id] = a.exists ? (a.data().unlocked || {}) : {};
    unlockedVideoMap[e.id] = a.exists ? (a.data().unlockedVideo || {}) : {};
  });
}

async function reloadItems() {
  items = await fetchItems(false);
}

function renderAll() {
  renderPending();
  renderEmployees();
  renderReportFilter();
  renderReports();
  renderItems();
  renderAdmins();
  renderPhaseLockSetting();
  renderPracticeSettings();
  renderOperatorsSetting();
  renderNotifySettings();
  $('#my-name-disp').textContent = me.name;
  const ob = $('#btn-operator'); if (ob) ob.textContent = `👤 ${me.name}`;
}

/* ---- 練習：言葉リストの設定 ---- */
/* ショートカットの重要度（必須／便利／ほぼ使わない） */
let tierDraft = {};
function renderTierSettings() {
  const el = $('#tier-list');
  if (!el) return;
  tierDraft = { ...(practiceSettings.tiers || {}) };
  el.innerHTML = Object.entries(SHORTCUT_SETS).map(([k, set]) => `<details class="tier-set" open>
    <summary><b>${esc(set.name)}</b> <span class="muted small">${set.items.length} 個</span>
      <span class="tier-bulk">${TIER_ORDER.map(t => `<button type="button" class="chip" data-tier-all="${k}" data-tier="${t}">全部 ${TIER_LABELS[t]}</button>`).join('')}</span></summary>
    ${set.items.map(it => `<div class="row tier-row" data-tier-id="${esc(it.id)}">
      <div class="row-main"><kbd>${esc(it.show)}</kbd> ${esc(it.label)}</div>
      <div class="seg seg-tier">${TIER_ORDER.map(t => `<button type="button" data-tier="${t}" class="${tierOf(it.id, tierDraft) === t ? 'active' : ''}">${TIER_LABELS[t]}</button>`).join('')}</div>
    </div>`).join('')}
  </details>`).join('');
}
function paintTierRow(row) {
  const id = row.dataset.tierId, cur = tierOf(id, tierDraft);
  $$('[data-tier]', row).forEach(b => b.classList.toggle('active', b.dataset.tier === cur));
}
async function saveTiers() {
  const btn = $('#tier-save');
  setBusy(btn, true, '保存中…');
  try {
    await db.doc('settings/practice').set({ tiers: tierDraft, updatedAt: FV.serverTimestamp() }, { merge: true });
    practiceSettings.tiers = { ...tierDraft };
    toast('重要度を保存しました', 'ok');
  } catch (err) { toast(authErrorMessage(err), 'err'); }
  finally { setBusy(btn, false); }
}

/* ---- チャットワーク通知の設定 ---- */
function renderNotifySettings() {
  const c = notifyConf || {};
  const ev = c.events || {};
  $('#nt-enabled').checked = !!c.enabled;
  $('#nt-url').value = c.gasUrl || '';
  $('#nt-room').value = c.roomId || '';
  $('#nt-report').checked = ev.report !== false;
  $('#nt-daily').checked = ev.daily !== false;
  $('#nt-comment').checked = ev.comment !== false;
}
async function saveNotifySettings(btn) {
  const conf = {
    enabled: $('#nt-enabled').checked,
    gasUrl: $('#nt-url').value.trim(),
    roomId: $('#nt-room').value.trim(),
    events: { report: $('#nt-report').checked, daily: $('#nt-daily').checked, comment: $('#nt-comment').checked },
    updatedAt: FV.serverTimestamp(),
  };
  if (conf.enabled && !/^https:\/\/script\.google\.com\//.test(conf.gasUrl)) {
    toast('GAS のウェブアプリ URL（https://script.google.com/… ）を入れてください', 'err');
    return;
  }
  setBusy(btn, true, '保存中…');
  try {
    await db.doc('settings/notify').set(conf, { merge: true });
    notifyConf = { ...conf };
    toast('通知の設定を保存しました', 'ok');
  } catch (err) { toast(authErrorMessage(err), 'err'); }
  finally { setBusy(btn, false); }
}
async function testNotify(btn) {
  if (!notifyConf || !notifyConf.gasUrl) { toast('先に設定を保存してください', 'err'); return; }
  setBusy(btn, true, '送信中…');
  const saved = notifyConf.enabled;
  notifyConf.enabled = true;
  const ok = await notifyChatwork('report', `[info][title]テスト送信[/title]新人教育アプリからのテストです（${me.name}）[/info]`);
  notifyConf.enabled = saved;
  $('#nt-result').textContent = ok ? '送信しました。チャットワークのルームを確認してください' : '送信できませんでした。URL とデプロイ設定（アクセスできるユーザー＝全員）を確認してください';
  setBusy(btn, false);
}

function renderPracticeSettings() {
  renderTierSettings();
  const pass = practiceSettings.pass || {};
  $('#pass-cpm').value = pass.typingCpm || '';
  $('#pass-acc').value = pass.typingAcc || '';
  $('#pass-sc').value = pass.shortcutScore || '';
  $('#pw-default').checked = practiceSettings.useDefault !== false;
  $('#pw-words').value = (practiceSettings.custom || []).map(w => w.display && w.display !== w.kana ? `${w.display}｜${w.kana}` : w.kana).join('\n');
}
function parsePracticeWords(text) {
  const words = [], errors = [];
  text.split(/\r?\n/).map(l => l.trim()).filter(Boolean).forEach(line => {
    const parts = line.split(/\s*(?:｜|\||→|➡|\t)\s*/).map(x => x.trim()).filter(Boolean);
    const display = parts[0], kana = toHiragana(parts[1] || parts[0]);
    const bad = invalidKanaChars(kana);
    if (bad.length) errors.push(`「${line}」：よみに変換できない文字（${bad.join(' ')}）。「表示｜よみ」の形でひらがなの読みを付けてください`);
    else words.push({ display, kana });
  });
  return { words, errors };
}
async function savePassLine() {
  const num = id => { const v = Number($('#' + id).value); return isFinite(v) && v > 0 ? v : 0; };
  const pass = { typingCpm: num('pass-cpm'), typingAcc: Math.min(100, num('pass-acc')), shortcutScore: Math.min(10, num('pass-sc')) };
  const btn = $('#pass-save');
  setBusy(btn, true, '保存中…');
  try {
    await db.doc('settings/practice').set({ pass, updatedAt: FV.serverTimestamp() }, { merge: true });
    practiceSettings.pass = pass;
    renderEmployees();
    toast('合格ラインを保存しました', 'ok');
  } catch (err) { toast(authErrorMessage(err), 'err'); }
  finally { setBusy(btn, false); }
}
function passBadgesFor(uid) {
  const pr = practiceMap[uid] || {}, pass = practiceSettings.pass || {};
  const out = [];
  if (passLineText('typing', pass) && (pr.typing && (pr.typing.passedAt || practicePassed('typing', pr.typing, pass)))) out.push('<span class="badge badge-approved">🏅 タイピング合格</span>');
  if (passLineText('shortcuts', pass) && (pr.shortcuts && (pr.shortcuts.passedAt || practicePassed('shortcuts', pr.shortcuts, pass)))) out.push('<span class="badge badge-approved">🏅 ショートカット合格</span>');
  return out.join(' ');
}
async function savePracticeWords() {
  const { words, errors } = parsePracticeWords($('#pw-words').value);
  const errEl = $('#pw-error');
  errEl.innerHTML = errors.map(e => esc(e)).join('<br>');
  if (errors.length) return;
  const btn = $('#pw-save');
  setBusy(btn, true, '保存中…');
  try {
    await db.doc('settings/practice').set({ words, useDefault: $('#pw-default').checked, updatedAt: FV.serverTimestamp() }, { merge: true });
    practiceSettings = { ...practiceSettings, useDefault: $('#pw-default').checked, custom: words };
    toast(`言葉リストを保存しました（追加 ${words.length} 語）`, 'ok');
  } catch (err) { toast(authErrorMessage(err), 'err'); }
  finally { setBusy(btn, false); }
}
function practiceRecordHtml(uid) {
  const pr = practiceMap[uid] || {};
  const t = pr.typing || {}, sc = pr.shortcuts || {};
  if (!t.best && !sc.best) return '<p class="muted small">まだ練習の記録はありません</p>';
  const last = (h, n) => (h || []).slice(-n).reverse();
  const pass = practiceSettings.pass || {};
  const passLine = (kind, rec) => { const line = passLineText(kind, pass); if (!line) return ''; const ok = rec.passedAt || practicePassed(kind, rec, pass); return ok ? ` <span class="badge badge-approved">🏅 合格</span>` : ` <span class="badge badge-none">合格ライン ${line} 未達</span>`; };
  return `
    <div class="row"><div class="row-main"><b>タイピング</b>${passLine('typing', t)}${t.best ? `<div class="muted small">ベスト ${t.best.cpm} 打鍵/分・正確率 ${t.best.acc}%（${fmtDateTime(t.best.at)}）</div>` : '<div class="muted small">記録なし</div>'}
      ${last(t.history, 3).map(h => `<div class="muted small">${fmtDateTime(h.at)}　${h.cpm} 打鍵/分・${h.acc}%・${h.words} 語</div>`).join('')}</div></div>
    <div class="row"><div class="row-main"><b>ショートカット</b>${passLine('shortcuts', sc)}${sc.best ? `<div class="muted small">ベスト ${sc.best.score}/${sc.best.total} 正解・${sc.best.seconds}秒（${fmtDateTime(sc.best.at)}）</div>` : '<div class="muted small">記録なし</div>'}
      ${last(sc.history, 3).map(h => `<div class="muted small">${fmtDateTime(h.at)}　${h.score}/${h.total}・${h.seconds}秒${h.hints ? `・答えを見た ${h.hints}` : ''}${h.mustMiss ? `・<span style="color:var(--danger)">必須ミス ${h.mustMiss}</span>` : ''}・${esc(h.sets || '')}</div>`).join('')}</div></div>`;
}

/* ---- 段階の許可 ---- */
function phaseListFor() { return groupByPhase(pubItems().filter(i => typeOf(i) === 'check')); }
function videoGroupsFor() { return groupItems(pubItems().filter(i => typeOf(i) === 'video')); }
async function setVideoUnlocked(uid, name, on) {
  if (on) {
    await db.doc('approvals/' + uid).set({ unlockedVideo: { [name]: true } }, { merge: true });
  } else {
    await db.doc('approvals/' + uid).update(new firebase.firestore.FieldPath('unlockedVideo', name), FV.delete())
      .catch(err => { if (err && err.code === 'not-found') return; throw err; });
  }
  unlockedVideoMap[uid] = { ...(unlockedVideoMap[uid] || {}) };
  if (on) unlockedVideoMap[uid][name] = true; else delete unlockedVideoMap[uid][name];
}
function canUnlockNext(uid) {
  if (!appSettings.phaseLock) return null;
  const phases = phaseListFor();
  const locked = phases.filter(p => !unlockedMap[uid] || !unlockedMap[uid][p.name]);
  if (!locked.length) return null;
  const open = phases.filter(p => unlockedMap[uid] && unlockedMap[uid][p.name]);
  const allDone = open.every(p => p.items.every(i => statusOf(i.id, progressMap[uid], approvalsMap[uid]) === 'approved'));
  return { next: locked[0].name, ready: open.length === 0 || allDone };
}
async function setPhaseUnlocked(uid, name, on) {
  if (on) {
    await db.doc('approvals/' + uid).set({ unlocked: { [name]: true } }, { merge: true });
  } else {
    await db.doc('approvals/' + uid).update(new firebase.firestore.FieldPath('unlocked', name), FV.delete())
      .catch(err => { if (err && err.code === 'not-found') return; throw err; });
  }
  unlockedMap[uid] = { ...(unlockedMap[uid] || {}) };
  if (on) unlockedMap[uid][name] = true; else delete unlockedMap[uid][name];
}
/* 許可制をオンにするとき、進行中の段階と最初の段階を自動で許可する */
async function autoUnlockAll() {
  const phases = phaseListFor(), vgroups = videoGroupsFor();
  if (!phases.length && !vgroups.length) return;
  const batch = db.batch();
  employees.forEach(e => {
    const map = { ...(unlockedMap[e.id] || {}) }, vmap = { ...(unlockedVideoMap[e.id] || {}) };
    const active = list => list.some(i => statusOf(i.id, progressMap[e.id], approvalsMap[e.id]) !== 'none');
    phases.forEach((p, k) => { if (k === 0 || active(p.items)) map[p.name] = true; });
    vgroups.forEach((g, k) => { if (k === 0 || active(g.items)) vmap[g.name] = true; });
    unlockedMap[e.id] = map; unlockedVideoMap[e.id] = vmap;
    batch.set(db.doc('approvals/' + e.id), { unlocked: map, unlockedVideo: vmap }, { merge: true });
  });
  await batch.commit();
}
function renderPhaseLockSetting() {
  const cb = $('#phase-lock');
  if (cb) cb.checked = !!appSettings.phaseLock;
}

/* ================= 確認待ち ================= */
function memoView(uid, itemId) {
  const m = (memosMap[uid] || {})[itemId];
  return m ? `<div class="memo-view">📝 ${esc(m.text)}<span class="muted small"> ${fmtDateTime(m.at)}</span></div>` : '';
}

function pendingFor(uid) {
  return pubItems().filter(i => statusOf(i.id, progressMap[uid], approvalsMap[uid]) === 'pending');
}

function renderPending() {
  const wrap = $('#pending-list');
  const cards = [];
  let total = 0;
  for (const e of activeEmployees()) {
    const pend = pendingFor(e.id);
    if (!pend.length) continue;
    total += pend.length;
    cards.push(`<div class="card">
      <div class="card-head"><b>${esc(e.name)}</b><button class="btn btn-ghost btn-sm" data-approve-all="${e.id}">すべて承認（${pend.length}）</button></div>
      ${pend.map(i => `<div class="row">
        <div class="row-main"><span class="badge badge-type">${TYPE_LABELS[i.type] || ''}</span> ${esc(i.title)}
          <div class="muted small">${esc([i.phase, i.group].filter(Boolean).join(' / '))}${[i.phase, i.group].some(Boolean) ? '　' : ''}${fmtDateTime(progressMap[e.id][i.id])} に履修</div>${memoView(e.id, i.id)}</div>
        <button class="btn btn-primary btn-sm" data-approve="${e.id}" data-item="${i.id}">✅ 承認</button>
      </div>`).join('')}
    </div>`);
  }
  const unconf = reports.filter(r => !confirmedByMe(r)).length;
  $('#pending-summary').innerHTML = `
    <div class="stat"><b>${total}</b><span>確認待ち</span></div>
    <div class="stat"><b>${unconf}</b><span>未確認の日報</span></div>
    <div class="stat"><b>${activeEmployees().length}</b><span>社員</span></div>`;
  const badge = $('#tab-badge-pending');
  badge.textContent = total;
  badge.hidden = !total;
  wrap.innerHTML = cards.length ? cards.join('') : '<p class="empty">確認待ちの項目はありません</p>';
}

async function onPendingClick(e) {
  const one = e.target.closest('[data-approve]');
  if (one) { await doApprove(one.dataset.approve, [one.dataset.item], one); return; }
  const all = e.target.closest('[data-approve-all]');
  if (all) {
    const uid = all.dataset.approveAll;
    const ids = pendingFor(uid).map(i => i.id);
    if (!ids.length) return;
    if (!confirm(`${ids.length} 件をまとめて承認しますか？`)) return;
    await doApprove(uid, ids, all);
  }
}

async function doApprove(uid, itemIds, btn) {
  setBusy(btn, true, '…');
  try {
    const now = Date.now();
    const entry = {};
    for (const id of itemIds) entry[id] = { at: now, by: me.name };
    await db.doc('approvals/' + uid).set({ items: entry }, { merge: true });
    approvalsMap[uid] = { ...(approvalsMap[uid] || {}), ...entry };
    toast(itemIds.length > 1 ? `${itemIds.length} 件を承認しました` : '承認しました', 'ok');
    renderPending(); renderEmployees();
    if (currentEmp && currentEmp.id === uid) renderEmpDetail();
  } catch (err) {
    toast(authErrorMessage(err), 'err');
    setBusy(btn, false);
  }
}

async function doUnapprove(uid, itemId, btn) {
  if (!confirm('承認を取り消しますか？（社員側は「確認待ち」に戻ります）')) return;
  setBusy(btn, true, '…');
  try {
    await db.doc('approvals/' + uid).update({ ['items.' + itemId]: FV.delete() });
    if (approvalsMap[uid]) delete approvalsMap[uid][itemId];
    toast('承認を取り消しました');
    renderPending(); renderEmployees();
    if (currentEmp && currentEmp.id === uid) renderEmpDetail();
  } catch (err) {
    toast(authErrorMessage(err), 'err');
    setBusy(btn, false);
  }
}

/* ================= 社員 ================= */
function renderEmployees() {
  const wrap = $('#emp-list');
  const pub = pubItems();
  if (!employees.length) {
    wrap.innerHTML = '<p class="empty">社員はまだいません。「社員を追加」から登録します</p>';
    return;
  }
  wrap.innerHTML = employees.map(e => {
    const s = progressSummary(pub, progressMap[e.id], approvalsMap[e.id]);
    const pct = s.total ? Math.round(s.approved / s.total * 100) : 0;
    const last = reports.find(r => r.uid === e.id);
    return `<div class="card emp-card ${e.active === false ? 'inactive' : ''}" data-emp="${e.id}">
      <div class="card-head"><b>${esc(e.name)}</b>
        ${e.active === false ? '<span class="badge badge-none">停止中</span>' : ''}
        ${s.pending ? `<span class="badge badge-pending">確認待ち ${s.pending}</span>` : ''}
        ${(() => { const n = canUnlockNext(e.id); return n && n.ready ? `<span class="badge badge-approved">「${esc(n.next)}」を許可できます</span>` : ''; })()}
        ${Object.keys(memosMap[e.id] || {}).length ? `<span class="badge badge-type">📝 メモ ${Object.keys(memosMap[e.id]).length}</span>` : ''}
        ${passBadgesFor(e.id)}
      </div>
      <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
      <div class="emp-meta"><span>承認 ${s.approved}/${s.total}（${pct}%）</span><span>最終日報 ${last ? fmtYmd(last.date) : 'なし'}</span></div>
    </div>`;
  }).join('');
}

function openAddEmployee() {
  openModal(`<h3>社員を追加</h3>
    <form id="emp-form">
      <label>名前<input id="ef-name" required placeholder="例：山田 太郎"></label>
      <label>メールアドレス（ログインID）<input id="ef-email" type="email" required inputmode="email" autocapitalize="off" autocomplete="off"></label>
      <label>初期パスワード（6文字以上）<input id="ef-pw" type="text" required minlength="6" autocomplete="off" autocapitalize="off"></label>
      <p class="muted small">作成後、メールアドレスと初期パスワードを本人に伝えてください</p>
      <p id="ef-error" class="error"></p>
      <div class="btn-row">
        <button type="button" class="btn btn-ghost" id="ef-cancel">キャンセル</button>
        <button type="submit" class="btn btn-primary" id="ef-submit">作成する</button>
      </div>
    </form>`);
  $('#ef-cancel').addEventListener('click', closeModal);
  $('#emp-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#ef-name').value.trim();
    const email = $('#ef-email').value.trim().toLowerCase();
    const pw = $('#ef-pw').value;
    const errEl = $('#ef-error');
    errEl.textContent = '';
    const btn = $('#ef-submit');
    setBusy(btn, true, '作成中…');
    try {
      const uid = await createAuthUser(email, pw);
      await db.doc('employees/' + uid).set({ name, email, active: true, createdAt: FV.serverTimestamp() });
      employees.push({ id: uid, name, email, active: true });
      employees.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja'));
      progressMap[uid] = {}; approvalsMap[uid] = {};
      renderEmployees(); renderReportFilter(); renderPending();
      showCreated('社員を作成しました', name, email, pw);
    } catch (err) {
      errEl.textContent = authErrorMessage(err);
      setBusy(btn, false);
    }
  });
}

function showCreated(title, name, email, pw) {
  openModal(`<h3>${esc(title)}</h3>
    <p>本人に伝える内容：</p>
    <div class="cred-box" id="cred-text">名前：${esc(name)}<br>メール：${esc(email)}<br>パスワード：${esc(pw)}<br>ログイン：${esc(location.href.replace(/admin\.html.*$/, '').replace(/#.*$/, ''))}</div>
    <div class="btn-row">
      <button type="button" class="btn btn-ghost" id="cred-copy">コピー</button>
      <button type="button" class="btn btn-primary" id="cred-close">閉じる</button>
    </div>`);
  $('#cred-close').addEventListener('click', closeModal);
  $('#cred-copy').addEventListener('click', async () => {
    const text = $('#cred-text').innerText;
    try { await navigator.clipboard.writeText(text); toast('コピーしました', 'ok'); }
    catch (e) { toast('コピーできませんでした。長押しで選択してください', 'err'); }
  });
}

async function openEmployee(id) {
  const switching = !currentEmp || currentEmp.id !== id;
  currentEmp = employees.find(e => e.id === id);
  if (!currentEmp) return;
  if (switching) { empCal = newCalState(); empTab = 'record'; }
  $('#emp-list-view').hidden = true;
  $('#emp-detail-view').hidden = false;
  $('#emp-detail').innerHTML = '<div class="spinner"></div>';
  window.scrollTo(0, 0);
  try {
    const [noteSnap, repSnap] = await Promise.all([
      db.doc('notes/' + id).get(),
      db.collection('reports').where('uid', '==', id).get(),
    ]);
    empNotes = noteSnap.exists ? (noteSnap.data().entries || []) : [];
    empDaily = noteSnap.exists ? (noteSnap.data().daily || {}) : {};
    empReports = repSnap.docs.map(d => ({ id: d.id, ...d.data() }))
      .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
    renderEmpDetail();
  } catch (err) {
    $('#emp-detail').innerHTML = `<p class="error">${esc(authErrorMessage(err))}</p>`;
  }
}

function closeEmployee() {
  currentEmp = null;
  $('#emp-detail-view').hidden = true;
  $('#emp-list-view').hidden = false;
  renderEmployees();
}

function renderEmpDetail() {
  const e = currentEmp;
  if (!e) return;
  const done = progressMap[e.id] || {}, appr = approvalsMap[e.id] || {};
  const pub = pubItems();
  const s = progressSummary(pub, done, appr);
  const notes = [...empNotes].sort((a, b) => (b.at || 0) - (a.at || 0));

  const checks = pub.filter(i => typeOf(i) === 'check'), texts = pub.filter(i => typeOf(i) === 'text'), videos = pub.filter(i => typeOf(i) === 'video');
  const phases = groupByPhase(checks);
  const vgroups = groupItems(videos);
  const lock = appSettings.phaseLock;
  const itemRow = i => {
    const st = statusOf(i.id, done, appr);
    let action = '';
    if (st === 'pending') action = `<button class="btn btn-primary btn-sm" data-approve="${i.id}">✅ 承認</button>`;
    else if (st === 'approved') action = `<button class="btn btn-ghost btn-sm" data-unapprove="${i.id}">取消</button>`;
    else action = `<button class="btn btn-ghost btn-sm" data-approve="${i.id}">承認</button>`;
    const sub = st === 'approved' ? `${esc(appr[i.id].by || '')} ${fmtDateTime(appr[i.id].at)}`
      : st === 'pending' ? `${fmtDateTime(done[i.id])} に履修` : '';
    return `<div class="row">
      <div class="row-main"><span class="badge badge-${st}">${STATUS_LABELS[st]}</span> ${esc(i.title)}${sub ? `<div class="muted small">${sub}</div>` : ''}${memoView(e.id, i.id)}</div>
      ${action}
    </div>`;
  };
  const sumLabel = list => { const ps = progressSummary(list, done, appr); return `<span class="muted small">${ps.approved} / ${ps.total}</span>`; };
  let itemsHtml = '';
  if (checks.length) itemsHtml += `<h3 class="phase-title">【チェック】 ${sumLabel(checks)}</h3>` + phases.map(p => {
    const lockMark = lock && !(unlockedMap[e.id] || {})[p.name] ? '🔒 ' : '';
    return `${phases.length > 1 || p.name !== '全般' ? `<h3 class="section-title">${lockMark}${esc(p.name)} ${sumLabel(p.items)}</h3>` : ''}` +
      p.groups.map(g => `<div class="muted small" style="margin:6px 4px 0">${esc(g.name)}</div>${g.items.map(itemRow).join('')}`).join('');
  }).join('');
  if (texts.length) itemsHtml += `<h3 class="phase-title">【説明あり】 ${sumLabel(texts)}</h3>` + texts.map(itemRow).join('');
  if (videos.length) itemsHtml += `<h3 class="phase-title">【ビデオ】 ${sumLabel(videos)}</h3>` + vgroups.map(g => {
    const lockMark = lock && !(unlockedVideoMap[e.id] || {})[g.name] ? '🔒 ' : '';
    return `<h3 class="section-title">${lockMark}${esc(g.name)} ${sumLabel(g.items)}</h3>${g.items.map(itemRow).join('')}`;
  }).join('');

  $('#emp-detail').innerHTML = `
    <div class="card">
      <div class="card-head"><h2>${esc(e.name)}</h2>${e.active === false ? '<span class="badge badge-none">停止中</span>' : ''}<button class="btn btn-ghost btn-sm" data-act="rename">名前を変更</button></div>
      <p class="muted small">${esc(e.email || '')}</p>
      <div class="btn-row">
        <button class="btn btn-ghost btn-sm" data-act="reset-pw">パスワード再設定メール</button>
        <button class="btn ${e.active === false ? 'btn-primary' : 'btn-ghost'} btn-sm" data-act="toggle-active">${e.active === false ? 'アカウントを再開' : '一時停止（あとで再開できます）'}</button>
        <button class="btn btn-danger btn-sm" data-act="delete-emp">退職・削除</button>
      </div>
    </div>

    <div class="seg emp-subtabs" id="emp-subtabs">
      <button type="button" data-etab="record" class="${empTab === 'record' ? 'active' : ''}">📅 記録・日報</button>
      <button type="button" data-etab="items" class="${empTab === 'items' ? 'active' : ''}">📚 許可・教育項目${s.pending ? `<small>${s.pending}</small>` : ''}</button>
      <button type="button" data-etab="practice" class="${empTab === 'practice' ? 'active' : ''}">⌨️ 練習</button>
    </div>

    <div class="emp-pane" data-pane="record" ${empTab === 'record' ? '' : 'hidden'}>
    <div id="daily-card"></div>

    <div class="card">
      <h3>ひとことメモ <span class="muted small">（社員には表示されません）</span></h3>
      <div id="notes-list">${notes.length ? notes.map((n, idx) => `<div class="note">
        <div class="note-meta"><span>${esc(n.author || '')}</span><span>${fmtDateTime(n.at)}</span><button class="btn btn-ghost btn-sm" data-del-note="${idx}">削除</button></div>
        <p>${esc(n.text)}</p>
      </div>`).join('') : '<p class="muted small">まだメモはありません</p>'}</div>
      <label>メモを追加<textarea id="note-text" rows="3" placeholder="気づき・申し送りなど"></textarea></label>
      <button class="btn btn-primary btn-block" data-act="add-note">メモを追加</button>
    </div>

    <div class="card">
      <h3>日報一覧 <span class="muted small">${empReports.length} 件</span></h3>
      <div id="emp-reports">${empReports.length ? empReports.slice(0, 30).map(r => reportCard(r)).join('') : '<p class="muted small">まだ日報はありません</p>'}</div>
    </div>
    </div>

    <div class="emp-pane" data-pane="items" ${empTab === 'items' ? '' : 'hidden'}>
    ${appSettings.phaseLock ? `<div class="card">
      <h3>段階・カテゴリの許可 <span class="muted small">許可したものだけ社員に表示されます（説明ありは常に表示）</span></h3>
      ${phases.length ? '<div class="muted small" style="margin:6px 4px 0">チェックの段階</div>' + phases.map(p => {
        const on = !!(unlockedMap[e.id] || {})[p.name];
        const ps = progressSummary(p.items, done, appr);
        return `<div class="row">
          <div class="row-main">${on ? '' : '🔒 '}${esc(p.name)}<div class="muted small">${ps.approved} / ${ps.total} 承認${ps.pending ? `・確認待ち ${ps.pending}` : ''}</div></div>
          <button class="btn ${on ? 'btn-ghost' : 'btn-primary'} btn-sm" data-unlock="${esc(p.name)}" data-on="${on ? '0' : '1'}">${on ? '許可を取り消す' : '許可する'}</button>
        </div>`;
      }).join('') : ''}
      ${vgroups.length ? '<div class="muted small" style="margin:10px 4px 0">ビデオのカテゴリ</div>' + vgroups.map(g => {
        const on = !!(unlockedVideoMap[e.id] || {})[g.name];
        const ps = progressSummary(g.items, done, appr);
        return `<div class="row">
          <div class="row-main">${on ? '' : '🔒 '}${esc(g.name)}<div class="muted small">${ps.approved} / ${ps.total} 承認${ps.pending ? `・確認待ち ${ps.pending}` : ''}</div></div>
          <button class="btn ${on ? 'btn-ghost' : 'btn-primary'} btn-sm" data-unlock-video="${esc(g.name)}" data-on="${on ? '0' : '1'}">${on ? '許可を取り消す' : '許可する'}</button>
        </div>`;
      }).join('') : ''}
      ${!phases.length && !vgroups.length ? '<p class="muted small">公開中の項目がありません</p>' : ''}
      ${(() => { const n = canUnlockNext(e.id); return n ? `<button class="btn btn-primary btn-block" data-unlock="${esc(n.next)}" data-on="1">次の段階「${esc(n.next)}」を許可する</button>` : ''; })()}
    </div>` : ''}

    <div class="card">
      <h3>教育項目 <span class="muted small">承認 ${s.approved}/${s.total}・確認待ち ${s.pending}</span></h3>
      ${stampGrid(pub, done, appr)}
      ${itemsHtml || '<p class="muted small">公開中の項目がありません</p>'}
    </div>
    </div>

    <div class="emp-pane" data-pane="practice" ${empTab === 'practice' ? '' : 'hidden'}>
    <div class="card">
      <h3>⌨️ 練習の記録</h3>
      ${practiceRecordHtml(e.id)}
    </div>
    </div>`;
  window.__notesSorted = notes;
  renderDailyCard();
}

/* ---- 社員の削除（退職） ---- */
function openDeleteEmployee(e) {
  openModal(`<h3>${esc(e.name)} さんを削除</h3>
    <p class="muted small">削除すると、その社員はログインできなくなります。<b>すでにログイン中の端末もその場で強制ログアウト</b>されます</p>
    <label>残し方
      <select id="del-mode">
        <option value="keep">記録を残して削除（履修・日報・指導記録は責任者側に残ります）</option>
        <option value="all">記録も完全に削除（履修・承認・メモ・指導記録・日報をすべて消す）</option>
      </select>
    </label>
    <p class="hint">確認のため、下の欄に社員の名前「${esc(e.name)}」を入力してください</p>
    <label>名前<input id="del-name" autocomplete="off" placeholder="${esc(e.name)}"></label>
    <p class="hint">※ログイン用アカウント自体は Firebase に残ります。完全に消す場合は Firebase コンソール → Authentication → Users から <b>${esc(e.email || '')}</b> を削除してください（このアプリからは使えない状態になっています）</p>
    <p id="del-error" class="error"></p>
    <div class="btn-row">
      <button type="button" class="btn btn-ghost" id="del-cancel">キャンセル</button>
      <button type="button" class="btn btn-danger" id="del-run">削除する</button>
    </div>`);
  $('#del-cancel').addEventListener('click', closeModal);
  $('#del-run').addEventListener('click', async () => {
    if ($('#del-name').value.trim() !== e.name) { $('#del-error').textContent = '名前が一致しません'; return; }
    const mode = $('#del-mode').value;
    const btn = $('#del-run');
    setBusy(btn, true, '削除中…');
    try {
      if (mode === 'all') {
        const reps = await db.collection('reports').where('uid', '==', e.id).get();
        for (let i = 0; i < reps.docs.length; i += 400) {
          const batch = db.batch();
          reps.docs.slice(i, i + 400).forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
        const batch = db.batch();
        ['progress/' + e.id, 'approvals/' + e.id, 'notes/' + e.id].forEach(pp => batch.delete(db.doc(pp)));
        await batch.commit();
      }
      // 最後に在籍情報を消す（社員側はこれを見張っていて即ログアウトになる）
      await db.doc('employees/' + e.id).delete();
      employees = employees.filter(x => x.id !== e.id);
      [progressMap, approvalsMap, unlockedMap, unlockedVideoMap, memosMap, practiceMap].forEach(m => { delete m[e.id]; });
      if (mode === 'all') reports = reports.filter(r => r.uid !== e.id);
      closeModal();
      closeEmployee();
      renderAll();
      toast(`${e.name} さんを削除しました`, 'ok');
    } catch (err) {
      $('#del-error').textContent = authErrorMessage(err);
      setBusy(btn, false);
    }
  });
}

/* ---- バックアップ（全データの書き出し） ---- */
async function exportBackup(btn) {
  setBusy(btn, true, '書き出し中…');
  try {
    const cols = ['employees', 'items', 'admins', 'reports', 'progress', 'approvals', 'notes', 'settings'];
    const data = { exportedAt: new Date().toISOString(), exportedBy: me.name, app: 'shinjin-kyoiku', version: APP_VERSION, collections: {} };
    for (const c of cols) {
      const snap = await db.collection(c).get();
      data.collections[c] = {};
      snap.docs.forEach(d => { data.collections[c][d.id] = d.data(); });
    }
    const counts = cols.map(c => `${c} ${Object.keys(data.collections[c]).length}`).join('・');
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const d = new Date();
    a.href = url;
    a.download = `shinjin-kyoiku-backup-${d.getFullYear()}${pad2(d.getMonth() + 1)}${pad2(d.getDate())}.json`;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    $('#backup-result').textContent = `書き出しました（${counts}）`;
    toast('バックアップを書き出しました', 'ok');
  } catch (err) {
    $('#backup-result').textContent = '書き出せませんでした：' + authErrorMessage(err);
  } finally { setBusy(btn, false); }
}

/* ---- 責任者の日報（社員ごと・日別・カレンダー） ---- */
function empDayMarks(uid) {
  const marks = {};
  const add = (key, f) => { if (!key) return; marks[key] = marks[key] || { a: false, b: false, n: 0 }; f(marks[key]); };
  Object.keys(empDaily).forEach(dt => add(dt, m => { m.a = true; }));
  empReports.forEach(r => add(r.date, m => { m.b = true; }));
  Object.values(progressMap[uid] || {}).forEach(ts => add(ymdOf(ts), m => { m.n++; }));
  Object.values(approvalsMap[uid] || {}).forEach(x => add(ymdOf(x && x.at), m => { m.n++; }));
  return marks;
}
function empDayActivity(uid, dt) {
  const byId = {}; items.forEach(i => { byId[i.id] = i; });
  const rows = [];
  Object.entries(progressMap[uid] || {}).forEach(([id, ts]) => { if (ymdOf(ts) === dt) rows.push({ at: ts, html: `<span class="badge badge-pending">履修</span> ${esc((byId[id] || {}).title || '（削除された項目）')} <span class="muted small">${fmtDateTime(ts)}</span>` }); });
  Object.entries(approvalsMap[uid] || {}).forEach(([id, x]) => { if (x && ymdOf(x.at) === dt) rows.push({ at: x.at, html: `<span class="badge badge-approved">承認</span> ${esc((byId[id] || {}).title || '（削除された項目）')} <span class="muted small">${esc(x.by || '')} ${fmtDateTime(x.at)}</span>` }); });
  Object.entries(memosMap[uid] || {}).forEach(([id, m]) => { if (m && ymdOf(m.at) === dt) rows.push({ at: m.at, html: `<span class="badge badge-type">📝メモ</span> ${esc((byId[id] || {}).title || '')}：${esc(m.text)}` }); });
  const pr = practiceMap[uid] || {};
  ((pr.typing || {}).history || []).forEach(h => { if (ymdOf(h.at) === dt) rows.push({ at: h.at, html: `<span class="badge badge-type">⌨️練習</span> タイピング ${h.cpm} 打鍵/分・正確率 ${h.acc}% <span class="muted small">${fmtDateTime(h.at)}</span>` }); });
  ((pr.shortcuts || {}).history || []).forEach(h => { if (ymdOf(h.at) === dt) rows.push({ at: h.at, html: `<span class="badge badge-type">⌨️練習</span> ショートカット ${h.score}/${h.total}・${h.seconds}秒 <span class="muted small">${fmtDateTime(h.at)}</span>` }); });
  return rows.sort((x, y) => (x.at || 0) - (y.at || 0));
}
function renderDailyCard() {
  const card = $('#daily-card');
  const e = currentEmp;
  if (!card || !e) return;
  const dt = empCal.sel;
  const x = empDaily[dt];
  const rep = empReports.find(r => r.date === dt);
  const acts = empDayActivity(e.id, dt);
  const legend = `<span><i class="dot dot-a"></i>責任者の記録</span><span><i class="dot dot-b"></i>社員の日報</span><span>✓ 履修・承認の数</span>`;
  card.innerHTML = `<div class="card">
    <h3>責任者の日報 <span class="muted small">（この社員について・社員には表示されません）　記録のある日：${Object.keys(empDaily).length} 日${dailyCommentCount() ? `・コメント ${dailyCommentCount()} 件` : ''}</span></h3>
    ${calendarHtml(empCal.y, empCal.m, empDayMarks(e.id), dt, legend)}
    <div class="day-panel">
      <h4>${fmtYmd(dt)} の ${esc(e.name)} さんの動き</h4>
      ${acts.length ? `<ul class="day-list">${acts.map(a => `<li>${a.html}</li>`).join('')}</ul>` : '<p class="muted small">この日の履修・承認・メモ・練習はありません</p>'}
      <h4>${fmtYmd(dt)} の日報</h4>
      ${rep ? reportBodyHtml(rep) + `<div class="confirms">${Object.values(rep.confirmations || {}).map(c => `<span class="chip-ok">✅ ${esc(c.name)}</span>`).join('') || '<span class="muted small">未確認</span>'} <button class="btn ${confirmedByMe(rep) ? 'btn-ghost' : 'btn-primary'} btn-sm" data-confirm="${rep.id}">${confirmedByMe(rep) ? '確認を取り消す' : '✅ 確認した'}</button></div>` : '<p class="muted small">この日の日報はまだ出ていません</p>'}
      <h4>${fmtYmd(dt)} の責任者の記録 ${x ? `<span class="muted small">（${esc(x.author || '')}・${fmtDateTime(x.at)} 保存）</span>` : ''}</h4>
      <label>指導したこと<textarea id="dl-taught" rows="3" placeholder="教えたこと、見せたこと、やらせたこと">${esc(x ? x.taught : '')}</textarea></label>
      <label>懸念点<textarea id="dl-concern" rows="2" placeholder="気になる点、つまずいているところ">${esc(x ? x.concern : '')}</textarea></label>
      <label>報告事項・以後の進め方<textarea id="dl-next" rows="3" placeholder="上長への共有事項、次にやらせること、引き継ぎ">${esc(x ? x.next : '')}</textarea></label>
      <label>記入者<input id="dl-author" value="${esc(x && x.author ? x.author : me.name)}"></label>
      <div class="btn-row">
        ${x ? `<button class="btn btn-danger" data-daily-del="${dt}">この日の記録を削除</button>` : ''}
        <button class="btn btn-primary" data-act="save-daily">この日の記録を保存</button>
      </div>
      ${dailyCommentsHtml(dt, x)}
    </div>
  </div>`;
}
/* 報告事項に対する上長コメント */
function dailyCommentCount() { return Object.values(empDaily).reduce((n, x) => n + ((x.comments || []).length), 0); }
function dailyCommentsHtml(dt, x) {
  if (!x) return '<p class="muted small" style="margin-top:10px">この日の記録を保存すると、上長のコメントを書けます</p>';
  const list = (x.comments || []).slice().sort((a, b) => (a.at || 0) - (b.at || 0));
  return `<div class="dl-comments">
    <h4>上長からのコメント <span class="muted small">（報告事項・以後の進め方について）</span></h4>
    ${list.length ? list.map((c, i) => `<div class="comment">
      <div class="note-meta"><b>${esc(c.author || '')}</b><span>${fmtDateTime(c.at)}</span><button class="btn btn-ghost btn-sm" data-comment-del="${i}">削除</button></div>
      <p>${esc(c.text)}</p>
    </div>`).join('') : '<p class="muted small">まだコメントはありません</p>'}
    <label>コメントを追加<textarea id="dl-comment" rows="2" placeholder="指示、補足、判断など"></textarea></label>
    <div class="btn-row"><button class="btn btn-ghost" data-act="add-comment">コメントを追加</button></div>
  </div>`;
}
async function addDailyComment(btn) {
  const dt = empCal.sel;
  const x = empDaily[dt];
  if (!x) { toast('先にこの日の記録を保存してください', 'err'); return; }
  const text = $('#dl-comment').value.trim();
  if (!text) { toast('コメントを書いてください', 'err'); return; }
  const entry = { text, author: me.name, at: Date.now() };
  setBusy(btn, true, '追加中…');
  try {
    const comments = [...(x.comments || []), entry];
    await db.doc('notes/' + currentEmp.id).set({ daily: { [dt]: { comments } } }, { merge: true });
    empDaily[dt] = { ...x, comments };
    renderDailyCard();
    toast('コメントを追加しました', 'ok');
    notifyChatwork('comment', `[info][title]上長コメント（${esc(currentEmp.name)} さん・${fmtYmd(dt)}）[/title]${entry.author}：\n${entry.text}\n\n（元の報告事項）${(x.next || '').slice(0, 120)}[/info]`);
  } catch (err) { toast(authErrorMessage(err), 'err'); setBusy(btn, false); }
}
async function deleteDailyComment(idx) {
  const dt = empCal.sel, x = empDaily[dt];
  if (!x) return;
  const list = (x.comments || []).slice().sort((a, b) => (a.at || 0) - (b.at || 0));
  const target = list[idx];
  if (!target || !confirm('このコメントを削除しますか？')) return;
  try {
    const comments = (x.comments || []).filter(c => !(c.at === target.at && c.text === target.text && c.author === target.author));
    await db.doc('notes/' + currentEmp.id).set({ daily: { [dt]: { comments } } }, { merge: true });
    empDaily[dt] = { ...x, comments };
    renderDailyCard();
    toast('削除しました');
  } catch (err) { toast(authErrorMessage(err), 'err'); }
}

async function saveDaily(btn) {
  const dt = empCal.sel;
  const prev = empDaily[dt] || {};
  const entry = { taught: $('#dl-taught').value.trim(), concern: $('#dl-concern').value.trim(), next: $('#dl-next').value.trim(), author: $('#dl-author').value.trim() || me.name, at: Date.now(), comments: prev.comments || [] };
  if (!entry.taught && !entry.concern && !entry.next) { toast('内容を書いてください', 'err'); return; }
  setBusy(btn, true, '保存中…');
  try {
    await db.doc('notes/' + currentEmp.id).set({ daily: { [dt]: entry } }, { merge: true });
    empDaily[dt] = entry;
    renderDailyCard();
    toast(`${fmtYmd(dt)} の記録を保存しました`, 'ok');
    const body = [entry.taught && '【指導したこと】' + entry.taught, entry.concern && '【懸念点】' + entry.concern, entry.next && '【報告事項・以後の進め方】' + entry.next].filter(Boolean).join('\n');
    notifyChatwork('daily', `[info][title]責任者の記録（${esc(currentEmp.name)} さん・${fmtYmd(dt)}）[/title]記入者：${entry.author}\n${body}[/info]`);
  } catch (err) { toast(authErrorMessage(err), 'err'); setBusy(btn, false); }
}
async function deleteDaily(dt) {
  if (!confirm(`${fmtYmd(dt)} の記録を削除しますか？`)) return;
  try {
    await db.doc('notes/' + currentEmp.id).update(new firebase.firestore.FieldPath('daily', dt), FV.delete());
    delete empDaily[dt];
    renderDailyCard();
    toast('削除しました');
  } catch (err) { toast(authErrorMessage(err), 'err'); }
}

async function onEmpDetailClick(ev) {
  const e = currentEmp;
  if (!e) return;
  const t = ev.target;
  const approveBtn = t.closest('[data-approve]');
  if (approveBtn) { await doApprove(e.id, [approveBtn.dataset.approve], approveBtn); return; }
  const unBtn = t.closest('[data-unapprove]');
  if (unBtn) { await doUnapprove(e.id, unBtn.dataset.unapprove, unBtn); return; }
  const confBtn = t.closest('[data-confirm]');
  if (confBtn) { await toggleConfirm(confBtn.dataset.confirm, confBtn); return; }
  const unlockV = t.closest('[data-unlock-video]');
  if (unlockV) {
    const on = unlockV.dataset.on === '1';
    if (!on && !confirm(`ビデオ「${unlockV.dataset.unlockVideo}」の許可を取り消しますか？`)) return;
    setBusy(unlockV, true, '…');
    try {
      await setVideoUnlocked(e.id, unlockV.dataset.unlockVideo, on);
      renderEmpDetail(); renderEmployees();
      toast(on ? `「${unlockV.dataset.unlockVideo}」を許可しました` : '許可を取り消しました', 'ok');
    } catch (err) { toast(authErrorMessage(err), 'err'); setBusy(unlockV, false); }
    return;
  }
  const unlockBtn = t.closest('[data-unlock]');
  if (unlockBtn) {
    const on = unlockBtn.dataset.on === '1';
    if (!on && !confirm(`「${unlockBtn.dataset.unlock}」の許可を取り消しますか？（社員側で見えなくなります。履修・承認の記録は残ります）`)) return;
    setBusy(unlockBtn, true, '…');
    try {
      await setPhaseUnlocked(e.id, unlockBtn.dataset.unlock, on);
      renderEmpDetail(); renderEmployees();
      toast(on ? `「${unlockBtn.dataset.unlock}」を許可しました` : '許可を取り消しました', 'ok');
    } catch (err) { toast(authErrorMessage(err), 'err'); setBusy(unlockBtn, false); }
    return;
  }
  const etab = t.closest('[data-etab]');
  if (etab) {
    empTab = etab.dataset.etab;
    $$('#emp-subtabs [data-etab]').forEach(b => b.classList.toggle('active', b.dataset.etab === empTab));
    $$('#emp-detail .emp-pane').forEach(p => { p.hidden = p.dataset.pane !== empTab; });
    window.scrollTo(0, 0);
    return;
  }
  const calDay = t.closest('[data-cal-day]');
  if (calDay) { empCal.sel = calDay.dataset.calDay; renderDailyCard(); return; }
  if (t.closest('[data-cal-prev]')) { calNav(empCal, -1); renderDailyCard(); return; }
  if (t.closest('[data-cal-next]')) { calNav(empCal, 1); renderDailyCard(); return; }
  if (t.closest('[data-cal-today]')) { calNav(empCal, 0); renderDailyCard(); return; }
  const cDel = t.closest('[data-comment-del]');
  if (cDel) { await deleteDailyComment(Number(cDel.dataset.commentDel)); return; }
  const dDel = t.closest('[data-daily-del]');
  if (dDel) { await deleteDaily(dDel.dataset.dailyDel); return; }
  const delNote = t.closest('[data-del-note]');
  if (delNote) {
    const entry = (window.__notesSorted || [])[Number(delNote.dataset.delNote)];
    if (!entry || !confirm('このメモを削除しますか？')) return;
    try {
      await db.doc('notes/' + e.id).update({ entries: FV.arrayRemove(entry) });
      empNotes = empNotes.filter(n => !(n.at === entry.at && n.text === entry.text && n.author === entry.author));
      renderEmpDetail();
    } catch (err) { toast(authErrorMessage(err), 'err'); }
    return;
  }
  const act = t.closest('[data-act]');
  if (!act) return;
  const kind = act.dataset.act;

  if (kind === 'save-daily') { await saveDaily(act); return; }
  if (kind === 'add-comment') { await addDailyComment(act); return; }
  if (kind === 'add-note') {
    const text = $('#note-text').value.trim();
    if (!text) { toast('メモを入力してください', 'err'); return; }
    const entry = { text, author: me.name, at: Date.now() };
    setBusy(act, true);
    try {
      await db.doc('notes/' + e.id).set({ entries: FV.arrayUnion(entry) }, { merge: true });
      empNotes.push(entry);
      renderEmpDetail();
      toast('メモを追加しました', 'ok');
    } catch (err) { toast(authErrorMessage(err), 'err'); setBusy(act, false); }
  } else if (kind === 'rename') {
    const name = prompt('新しい名前', e.name);
    if (!name || name.trim() === e.name) return;
    try {
      await db.doc('employees/' + e.id).update({ name: name.trim() });
      e.name = name.trim();
      employees.sort((a, b) => (a.name || '').localeCompare(b.name || '', 'ja'));
      renderEmpDetail();
      toast('名前を変更しました', 'ok');
    } catch (err) { toast(authErrorMessage(err), 'err'); }
  } else if (kind === 'toggle-active') {
    const next = e.active === false;
    if (!confirm(next ? 'アカウントを再開しますか？' : 'アカウントを停止しますか？（停止中はログインしても使えなくなります）')) return;
    try {
      await db.doc('employees/' + e.id).update({ active: next });
      e.active = next;
      renderEmpDetail(); renderPending();
      toast(next ? '再開しました' : '停止しました', 'ok');
    } catch (err) { toast(authErrorMessage(err), 'err'); }
  } else if (kind === 'delete-emp') {
    openDeleteEmployee(e);
  } else if (kind === 'reset-pw') {
    if (!e.email || !confirm(`${e.email} にパスワード再設定メールを送りますか？`)) return;
    try {
      await auth.sendPasswordResetEmail(e.email);
      toast('再設定メールを送りました', 'ok');
    } catch (err) { toast(authErrorMessage(err), 'err'); }
  }
}

/* ================= 日報 ================= */
function renderReportFilter() {
  const sel = $('#report-emp-filter');
  sel.innerHTML = '<option value="">全員</option>' + employees.map(e => `<option value="${e.id}" ${reportEmp === e.id ? 'selected' : ''}>${esc(e.name)}</option>`).join('');
}

function reportCard(r) {
  const conf = Object.values(r.confirmations || {});
  const mine = confirmedByMe(r);
  const checks = r.checks || [];
  const doneN = checks.filter(c => c.done).length;
  return `<div class="card" data-report="${r.id}">
    <div class="report-head"><b>${esc(r.name || '')}</b><span class="date">${fmtYmd(r.date)}</span>${checks.length ? `<span class="right">チェック ${doneN}/${checks.length}</span>` : ''}</div>
    ${checks.length ? `<ul class="check-list">${checks.map(c => `<li class="${c.done ? 'on' : ''}">${c.done ? '☑' : '☐'} ${esc(c.label)}</li>`).join('')}</ul>` : ''}
    ${reportBodyHtml(r)}
    <div class="confirms">${conf.length ? conf.map(c => `<span class="chip-ok">✅ ${esc(c.name)}</span>`).join('') : '<span class="muted">まだ誰も確認していません</span>'}</div>
    <button class="btn ${mine ? 'btn-ghost' : 'btn-primary'} btn-sm" data-confirm="${r.id}">${mine ? '確認を取り消す' : '✅ 確認した'}</button>
  </div>`;
}

function renderReports() {
  const wrap = $('#reports-list');
  let list = reports;
  if (reportEmp) list = list.filter(r => r.uid === reportEmp);
  if (reportFilter === 'unconfirmed') list = list.filter(r => !confirmedByMe(r));
  if (!list.length) {
    wrap.innerHTML = `<p class="empty">${reports.length ? '該当する日報はありません' : 'まだ日報は提出されていません'}</p>`;
    return;
  }
  wrap.innerHTML = list.map(r => reportCard(r)).join('');
}

async function onReportClick(e) {
  const btn = e.target.closest('[data-confirm]');
  if (btn) await toggleConfirm(btn.dataset.confirm, btn);
}

async function toggleConfirm(id, btn) {
  const r = reports.find(x => x.id === id) || empReports.find(x => x.id === id);
  if (!r) return;
  const existingKey = myConfirmKey(r);
  const mine = !!existingKey;
  const key = existingKey || me.name;
  setBusy(btn, true, '…');
  try {
    const value = mine ? FV.delete() : { name: me.name, at: Date.now() };
    await db.doc('reports/' + id).update(new firebase.firestore.FieldPath('confirmations', key), value);
    for (const arr of [reports, empReports]) {
      const x = arr.find(y => y.id === id);
      if (!x) continue;
      x.confirmations = { ...(x.confirmations || {}) };
      if (mine) delete x.confirmations[key]; else x.confirmations[key] = { name: me.name, at: Date.now() };
    }
    toast(mine ? '確認を取り消しました' : '確認しました', 'ok');
    renderReports(); renderPending();
    if (currentEmp) renderEmpDetail();
  } catch (err) {
    toast(authErrorMessage(err), 'err');
    setBusy(btn, false);
  }
}

/* ================= 教育項目 ================= */
let itemsPhase = '*';
let itemsType = 'check';

function renderItems() {
  const wrap = $('#items-list');
  renderTypeSeg($('#type-seg'), items, itemsType);
  const ofType = items.filter(i => typeOf(i) === itemsType);
  if (!ofType.length) {
    $('#items-phase-chips').innerHTML = '';
    wrap.innerHTML = `<p class="empty">${TYPE_LABELS[itemsType]}の項目はまだありません。「項目を追加」か「まとめ登録」で登録できます</p>`;
    return;
  }
  const rowHtml = i => `
      <div class="row item-row ${i.published === false ? 'unpub' : ''}" data-id="${i.id}">
        <span class="drag-handle" data-drag="${i.id}" title="ドラッグで並び替え">☰</span>
        <div class="order-btns"><button type="button" data-move="${i.id}" data-dir="-1">▲</button><button type="button" data-move="${i.id}" data-dir="1">▼</button></div>
        <div class="row-main" data-edit="${i.id}">
          ${i.published === false ? '<span class="badge badge-none">非公開</span> ' : ''}${i.autoBy ? `<span class="badge badge-approved">🏅 ${i.autoBy === 'typing' ? 'タイピング' : 'ショートカット'}合格で自動</span> ` : ''}${esc(i.title)}
          ${i.description ? `<div class="muted small clamp">${esc(i.description)}</div>` : ''}
        </div>
      </div>`;
  if (itemsType === 'check') {
    const allPhases = groupByPhase(ofType);
    if (itemsPhase !== '*' && !allPhases.some(p => p.name === itemsPhase)) itemsPhase = '*';
    $('#items-phase-chips').innerHTML = allPhases.length > 1
      ? `<button class="chip ${itemsPhase === '*' ? 'active' : ''}" data-iphase="*">すべて</button>` +
        allPhases.map(p => `<button class="chip ${p.name === itemsPhase ? 'active' : ''}" data-iphase="${esc(p.name)}">${esc(p.name)}</button>`).join('')
      : '';
    const shown = itemsPhase === '*' ? allPhases : allPhases.filter(p => p.name === itemsPhase);
    wrap.innerHTML = shown.map(p => `
      ${allPhases.length > 1 && itemsPhase === '*' ? `<h3 class="phase-title">${esc(p.name)}<button type="button" class="rename-btn" data-rename-phase="${esc(p.name)}">名前を変更</button></h3>` : ''}
      ${p.groups.map(g => `<h3 class="section-title">${esc(g.name)}<button type="button" class="rename-btn" data-rename-group="${esc(g.name)}" data-in-phase="${esc(p.name)}">名前を変更</button></h3>
      <div class="group-list">${g.items.map(rowHtml).join('')}</div>`).join('')}`).join('');
  } else if (itemsType === 'video') {
    $('#items-phase-chips').innerHTML = '';
    wrap.innerHTML = groupItems(ofType).map(g => `<h3 class="section-title">${esc(g.name)}<button type="button" class="rename-btn" data-rename-group="${esc(g.name)}">名前を変更</button></h3>
      <div class="group-list">${g.items.map(rowHtml).join('')}</div>`).join('');
  } else {
    $('#items-phase-chips').innerHTML = '';
    wrap.innerHTML = `<div class="group-list">${ofType.map(rowHtml).join('')}</div>`;
  }
}

async function onItemsClick(e) {
  const rp = e.target.closest('[data-rename-phase]');
  if (rp) { await renameLabel('phase', rp.dataset.renamePhase, null); return; }
  const rg = e.target.closest('[data-rename-group]');
  if (rg) { await renameLabel('group', rg.dataset.renameGroup, rg.dataset.inPhase ?? null); return; }
  const mv = e.target.closest('[data-move]');
  if (mv) { await moveItem(mv.dataset.move, Number(mv.dataset.dir)); return; }
  const ed = e.target.closest('[data-edit]');
  if (ed) openItemModal(items.find(i => i.id === ed.dataset.edit));
}

/* 段階／カテゴリの名前をまとめて変更（同じ名前にすれば別枠になっていたものが1つにまとまる） */
async function renameLabel(kind, oldName, inPhase) {
  const label = kind === 'phase' ? '段階' : 'カテゴリ';
  const targets = items.filter(i => typeOf(i) === itemsType && (kind === 'phase'
    ? phaseName(i) === oldName
    : (groupName(i) === oldName && (inPhase == null || phaseName(i) === inPhase))));
  if (!targets.length) return;
  const input = prompt(`${label}「${oldName}」の新しい名前（${targets.length} 件をまとめて変更します）`, oldName === 'その他' || oldName === '全般' ? '' : oldName);
  if (input == null) return;
  const newName = input.trim();
  if (newName === oldName) return;
  try {
    const batch = db.batch();
    targets.forEach(i => batch.update(db.doc('items/' + i.id), { [kind]: newName }));
    await batch.commit();
    targets.forEach(i => { i[kind] = newName; });
    renderItems(); renderPending(); renderEmployees();
    toast(`${label}を「${newName || (kind === 'phase' ? '全般' : 'その他')}」に変更しました`, 'ok');
  } catch (err) {
    toast(authErrorMessage(err), 'err');
    await reloadItems(); renderItems();
  }
}

/* 同じ段階・カテゴリの中の項目（並び順）*/
function siblingsOf(item) {
  const t = typeOf(item);
  return items.filter(i => typeOf(i) === t
      && (t !== 'check' || phaseName(i) === phaseName(item))
      && (t === 'text' || groupName(i) === groupName(item)))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
}
/* order が重複・未設定なら全体を振り直す（1回きり） */
async function ensureUniqueOrders() {
  const seen = new Set(); let bad = false;
  for (const it of items) { if (typeof it.order !== 'number' || seen.has(it.order)) { bad = true; break; } seen.add(it.order); }
  if (!bad) return;
  items.forEach((it, k) => { it.order = k; });
  const batch = db.batch();
  items.forEach(it => batch.update(db.doc('items/' + it.id), { order: it.order }));
  await batch.commit();
}
/* ids の順に、その並びの order 値を割り当て直して保存 */
async function applyOrder(ids) {
  const targets = ids.map(id => items.find(i => i.id === id)).filter(Boolean);
  const orders = targets.map(i => i.order).sort((a, b) => a - b);
  const changed = [];
  targets.forEach((it, k) => { if (it.order !== orders[k]) { it.order = orders[k]; changed.push(it); } });
  items.sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  if (!changed.length) return;
  const batch = db.batch();
  changed.forEach(it => batch.update(db.doc('items/' + it.id), { order: it.order }));
  await batch.commit();
}

async function moveItem(id, dir) {
  const item = items.find(i => i.id === id);
  if (!item) return;
  try {
    await ensureUniqueOrders();
    const sib = siblingsOf(item);
    const idx = sib.findIndex(i => i.id === id);
    const j = idx + dir;
    if (idx < 0 || j < 0 || j >= sib.length) { toast(dir < 0 ? 'いちばん上です' : 'いちばん下です'); return; }
    const ids = sib.map(i => i.id);
    [ids[idx], ids[j]] = [ids[j], ids[idx]];
    await applyOrder(ids);
    renderItems();
  } catch (err) {
    toast(authErrorMessage(err), 'err');
    await reloadItems(); renderItems();
  }
}

/* ---- ドラッグで並び替え（同じカテゴリの中） ---- */
let drag = null;
function bindItemDrag() {
  const wrap = $('#items-list');
  wrap.addEventListener('pointerdown', e => {
    const h = e.target.closest('[data-drag]');
    if (!h) return;
    const row = h.closest('.item-row');
    const list = row && row.parentElement;
    if (!list) return;
    e.preventDefault();
    try { h.setPointerCapture(e.pointerId); } catch (err) {}
    drag = { row, list, handle: h, moved: false };
    row.classList.add('dragging');
  });
  wrap.addEventListener('pointermove', e => {
    if (!drag) return;
    e.preventDefault();
    const y = e.clientY;
    const rows = Array.from(drag.list.querySelectorAll('.item-row')).filter(r => r !== drag.row);
    let before = null;
    for (const r of rows) {
      const rect = r.getBoundingClientRect();
      if (y < rect.top + rect.height / 2) { before = r; break; }
    }
    const cur = drag.row.nextElementSibling;
    if (before !== cur) {
      if (before) drag.list.insertBefore(drag.row, before); else drag.list.appendChild(drag.row);
      drag.moved = true;
    }
    if (y < 90) window.scrollBy(0, -12); else if (y > window.innerHeight - 90) window.scrollBy(0, 12);
  });
  const end = async e => {
    if (!drag) return;
    const { row, list, moved } = drag;
    drag = null;
    row.classList.remove('dragging');
    if (!moved) return;
    const ids = Array.from(list.querySelectorAll('.item-row')).map(r => r.dataset.id);
    try {
      await ensureUniqueOrders();
      await applyOrder(ids);
      toast('並び順を保存しました', 'ok');
    } catch (err) {
      toast(authErrorMessage(err), 'err');
      await reloadItems(); renderItems();
    }
  };
  wrap.addEventListener('pointerup', end);
  wrap.addEventListener('pointercancel', end);
}

/* 入力欄の下に、登録済みの値をタップで選べるボタンを出す */
function valueChips(inputId, values) {
  if (!values.length) return '';
  return `<div class="value-chips" data-for="${inputId}">${values.map(v => `<button type="button" class="chip" data-value="${esc(v)}">${esc(v)}</button>`).join('')}</div>`;
}
function bindValueChips(root) {
  $$('.value-chips', root).forEach(box => {
    box.addEventListener('click', e => {
      const b = e.target.closest('[data-value]');
      if (!b) return;
      const input = $('#' + box.dataset.for);
      if (!input) return;
      input.value = b.dataset.value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      $$('[data-value]', box).forEach(x => x.classList.toggle('active', x === b));
    });
  });
}
function existingPhases() { return [...new Set(items.filter(i => typeOf(i) === 'check').map(i => (i.phase || '').trim()).filter(Boolean))]; }
function existingGroups(type) { return [...new Set(items.filter(i => typeOf(i) === (type || 'check')).map(i => (i.group || '').trim()).filter(Boolean))]; }

function phaseDatalist(id) {
  const phases = [...new Set(items.map(i => (i.phase || '').trim()).filter(Boolean))];
  return `<datalist id="${id}">${phases.map(p => `<option value="${esc(p)}">`).join('')}</datalist>`;
}

function groupDatalist(id, type) {
  const groups = existingGroups(type);
  return `<datalist id="${id}">${groups.map(g => `<option value="${esc(g)}">`).join('')}</datalist>`;
}

function openItemModal(item) {
  const isNew = !item;
  const it = item || { type: itemsType, phase: itemsType === 'check' && itemsPhase !== '*' ? itemsPhase : '', group: '', title: '', description: '', videoUrl: '', published: true };
  openModal(`<h3>${isNew ? '項目を追加' : '項目を編集'}</h3>
    <form id="item-form">
      <label>種類
        <select id="it-type">${['check', 'text', 'video'].map(t => `<option value="${t}" ${it.type === t ? 'selected' : ''}>${TYPE_LABELS[t]}</option>`).join('')}</select>
      </label>
      <div id="it-phase-wrap">
      <label>段階（任意・チェックのみ）
        <input id="it-phase" list="it-phase-list" value="${esc(it.phase || '')}" placeholder="例：1週目" autocomplete="off">
        ${phaseDatalist('it-phase-list')}
      </label>
      ${valueChips('it-phase', existingPhases())}
      </div>
      <div id="it-group-wrap">
      <label>カテゴリ（任意）
        <input id="it-group" list="it-group-list" value="${esc(it.group || '')}" placeholder="例：座学系 / 実践編" autocomplete="off">
        ${groupDatalist('it-group-list', it.type)}
      </label>
      ${valueChips('it-group', existingGroups(it.type))}
      </div>
      <label>題名<input id="it-title" value="${esc(it.title)}" required></label>
      <label>説明（任意）<textarea id="it-desc" rows="5">${esc(it.description || '')}</textarea></label>
      <label id="it-video-wrap" ${it.type === 'video' ? '' : 'hidden'}>ビデオのURL
        <input id="it-video" type="url" value="${esc(it.videoUrl || '')}" placeholder="https://..." inputmode="url" autocapitalize="off">
      </label>
      <label>練習の合格で自動履修（任意）
        <select id="it-auto">
          <option value="" ${!it.autoBy ? 'selected' : ''}>なし</option>
          <option value="typing" ${it.autoBy === 'typing' ? 'selected' : ''}>タイピングの合格ライン達成で履修済みにする</option>
          <option value="shortcuts" ${it.autoBy === 'shortcuts' ? 'selected' : ''}>ショートカットの合格ライン達成で履修済みにする</option>
        </select>
      </label>
      <label class="check"><input type="checkbox" id="it-pub" ${it.published !== false ? 'checked' : ''}><span>社員に公開する</span></label>
      <p id="it-error" class="error"></p>
      <div class="btn-row">
        ${isNew ? '' : '<button type="button" class="btn btn-danger" id="it-delete">削除</button>'}
        <button type="button" class="btn btn-ghost" id="it-cancel">キャンセル</button>
        <button type="submit" class="btn btn-primary" id="it-save">保存</button>
      </div>
    </form>`);
  const syncTypeFields = () => {
    const t = $('#it-type').value;
    $('#it-video-wrap').hidden = t !== 'video';
    $('#it-phase-wrap').hidden = t !== 'check';
    $('#it-group-wrap').hidden = t === 'text';
  };
  $('#it-type').addEventListener('change', syncTypeFields);
  syncTypeFields();
  bindValueChips($('#modal'));
  $('#it-cancel').addEventListener('click', closeModal);
  if (!isNew) $('#it-delete').addEventListener('click', async () => {
    if (!confirm(`「${it.title}」を削除しますか？`)) return;
    try {
      await db.doc('items/' + it.id).delete();
      closeModal();
      await reloadItems();
      renderItems(); renderPending(); renderEmployees();
      toast('削除しました');
    } catch (err) { $('#it-error').textContent = authErrorMessage(err); }
  });
  $('#item-form').addEventListener('submit', async e => {
    e.preventDefault();
    const t = $('#it-type').value;
    const data = {
      type: t,
      phase: t === 'check' ? $('#it-phase').value.trim() : '',
      group: t === 'text' ? '' : $('#it-group').value.trim(),
      title: $('#it-title').value.trim(),
      description: $('#it-desc').value.trim(),
      videoUrl: $('#it-type').value === 'video' ? $('#it-video').value.trim() : '',
      autoBy: $('#it-auto').value,
      published: $('#it-pub').checked,
      updatedAt: FV.serverTimestamp(),
    };
    if (!data.title) return;
    if (data.type === 'video' && !data.videoUrl) { $('#it-error').textContent = 'ビデオのURLを入れてください'; return; }
    const btn = $('#it-save');
    setBusy(btn, true, '保存中…');
    try {
      if (isNew) {
        data.order = items.length ? Math.max(...items.map(i => i.order ?? 0)) + 1 : 0;
        data.createdAt = FV.serverTimestamp();
        await db.collection('items').add(data);
      } else {
        await db.doc('items/' + it.id).update(data);
      }
      closeModal();
      await reloadItems();
      renderItems(); renderPending(); renderEmployees();
      toast(isNew ? '追加しました' : '保存しました', 'ok');
    } catch (err) {
      $('#it-error').textContent = authErrorMessage(err);
      setBusy(btn, false);
    }
  });
}

const CHECK_CELL = /^(true|false|☐|☑|✓|✔|□|■|x|○|●)$/i;

function makeBulkItem(parts, type, phase, group) {
  parts = parts.map(s => (s || '').trim()).filter(Boolean);
  const title = parts[0] || '';
  let description = '', videoUrl = '';
  for (const p of parts.slice(1)) {
    if (/^https?:\/\/\S+$/i.test(p) && !videoUrl) videoUrl = p;
    else description = description ? description + '\n' + p : p;
  }
  let t = type;
  if (t === 'auto') t = videoUrl ? 'video' : (description ? 'text' : 'check');
  if (t !== 'check') phase = '';
  if (t === 'text') group = '';
  return { title, description, videoUrl, type: t, phase, group };
}

/* まとめ登録の解析
   - タブ区切り（スプレッドシートからのコピー）：列の位置から 段階／カテゴリ／題名／説明 を判定
   - 手書き：「# 段階」「## カテゴリ」「題名｜説明｜URL」 */
function parseBulk(text, type, defaults = {}) {
  const lines = text.replace(/\r/g, '').split('\n');
  const out = [];
  let phase = (defaults.phase || '').trim();
  let group = (defaults.group || '').trim();
  const hasTab = lines.some(l => l.includes('\t'));

  if (!hasTab) {
    for (const raw of lines) {
      const line = raw.trim();
      if (!line) continue;
      let m;
      if ((m = line.match(/^##\s*(.+)$/))) { group = m[1].trim(); continue; }
      if ((m = line.match(/^#\s*(.+)$/))) { phase = m[1].trim(); group = (defaults.group || '').trim(); continue; }
      out.push(makeBulkItem(line.split(/\s*(?:｜|\||➡|→)\s*/), type, phase, group));
    }
    return out;
  }

  const rows = parseTsvRows(text).map(r => r.map(c => c.trim()).map(c => CHECK_CELL.test(c) ? '' : c));
  const firstIdx = rows.map(r => r.findIndex(c => c)).filter(i => i >= 0);
  if (!firstIdx.length) return out;
  // 題名の列 = 一番多く使われている「行の最初の文字がある列」
  const counts = {};
  firstIdx.forEach(i => { counts[i] = (counts[i] || 0) + 1; });
  const titleCol = Number(Object.entries(counts).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]);
  // 見出しの列 = 題名より左で文字がある列。最後の1列がカテゴリ、それより左は段階
  const headerCols = [...new Set(rows.flatMap(r => r.map((c, i) => (c && i < titleCol) ? i : -1).filter(i => i >= 0)))].sort((a, b) => a - b);
  const groupCol = headerCols.length ? headerCols[headerCols.length - 1] : -1;
  const phaseCols = headerCols.length > 1 ? headerCols.slice(0, -1) : [];
  const phaseVals = {};
  for (const r of rows) {
    if (!r.some(c => c)) continue;
    let phaseChanged = false;
    phaseCols.forEach((col, k) => {
      if (r[col]) {
        phaseVals[col] = r[col];
        phaseCols.slice(k + 1).forEach(c2 => { delete phaseVals[c2]; });
        phaseChanged = true;
      }
    });
    if (phaseChanged) {
      phase = phaseCols.map(c => phaseVals[c]).filter(Boolean).join(' ');
      group = (defaults.group || '').trim();
    }
    if (groupCol >= 0 && r[groupCol]) group = r[groupCol];
    const title = r[titleCol];
    if (!title) {
      // 題名が空で右側に文だけある行 → 直前の項目の説明の続き
      const rest = r.slice(titleCol + 1).filter(Boolean);
      if (rest.length && out.length) {
        const prev = out[out.length - 1];
        prev.description = (prev.description ? prev.description + '\n' : '') + rest.join('\n');
        if (prev.type === 'check' && type === 'auto') prev.type = 'text';
      }
      continue;
    }
    out.push(makeBulkItem([title, ...r.slice(titleCol + 1)], type, phase, group));
  }
  return out;
}

/* タブ区切りを行×セルに分解。"…" で囲まれたセル（改行入り）にも対応 */
function parseTsvRows(text) {
  const rows = []; let row = [], cell = '', inQ = false, quoted = false;
  const src = text.replace(/\r/g, '');
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQ) {
      if (ch === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else inQ = false; }
      else cell += ch;
    } else if (ch === '"' && cell === '' && !quoted) { inQ = true; quoted = true; }
    else if (ch === '\t') { row.push(cell); cell = ''; quoted = false; }
    else if (ch === '\n') { row.push(cell); rows.push(row); row = []; cell = ''; quoted = false; }
    else cell += ch;
  }
  row.push(cell); rows.push(row);
  return rows;
}

function openBulkModal() {
  openModal(`<h3>まとめ登録</h3>
    <div class="hint">スプレッドシートの表をコピーしてそのまま貼り付けできます（チェック欄の TRUE/FALSE は無視。「1週目」「座学系」などの見出し行は段階・カテゴリとして自動で認識）。<br>手書きの場合は1行に1項目「題名｜説明」、ビデオは「題名｜説明｜URL」。「# 1週目」「## 座学系」と書くと、そこから下がその段階・カテゴリになります。<br>チェック＝段階・カテゴリあり／説明あり＝どちらも無し／ビデオ＝カテゴリのみ</div>
    <form id="bulk-form">
      <label>種類
        <select id="bk-type">
          <option value="check" ${itemsType === 'check' ? 'selected' : ''}>チェック</option>
          <option value="text" ${itemsType === 'text' ? 'selected' : ''}>説明あり</option>
          <option value="video" ${itemsType === 'video' ? 'selected' : ''}>ビデオ</option>
          <option value="auto">自動（URLあり→ビデオ／説明あり→説明あり／それ以外→チェック）</option>
        </select>
      </label>
      <div id="bk-phase-wrap">
      <label>段階（貼り付けた中に段階の見出しが無いときに使います）
        <input id="bk-phase" list="bk-phase-list" placeholder="例：1週目" autocomplete="off">
        ${phaseDatalist('bk-phase-list')}
      </label>
      ${valueChips('bk-phase', existingPhases())}
      </div>
      <div id="bk-group-wrap">
      <label>カテゴリ（貼り付けた中にカテゴリの見出しが無いときに使います）
        <input id="bk-group" list="bk-group-list" placeholder="例：座学系" autocomplete="off">
        ${groupDatalist('bk-group-list', itemsType)}
      </label>
      ${valueChips('bk-group', existingGroups(itemsType))}
      </div>
      <label>項目
        <textarea id="bk-text" rows="10" placeholder="出勤時の挨拶｜元気よく「おはようございます」&#10;タイムカードの押し方&#10;接客マナー動画｜視聴後に責任者へ報告｜https://..."></textarea>
      </label>
      <p id="bk-preview" class="muted small"></p>
      <p id="bk-error" class="error"></p>
      <div class="btn-row">
        <button type="button" class="btn btn-ghost" id="bk-cancel">キャンセル</button>
        <button type="submit" class="btn btn-primary" id="bk-submit">登録する</button>
      </div>
    </form>`);
  const bulkDefaults = () => ({ phase: $('#bk-phase').value, group: $('#bk-group').value });
  const preview = () => {
    const rows = parseBulk($('#bk-text').value, $('#bk-type').value, bulkDefaults());
    if (!rows.length) { $('#bk-preview').innerHTML = ''; return; }
    const byPhase = groupByPhase(rows).map(p => `${esc(p.name)}：${p.groups.map(g => `${esc(g.name)} ${g.items.length}`).join('・')}`);
    $('#bk-preview').innerHTML = `${rows.length} 件を登録します（チェック ${rows.filter(r => r.type === 'check').length}・説明あり ${rows.filter(r => r.type === 'text').length}・ビデオ ${rows.filter(r => r.type === 'video').length}）<br>${byPhase.join('<br>')}`;
  };
  ['bk-text', 'bk-phase', 'bk-group'].forEach(id => $('#' + id).addEventListener('input', preview));
  const syncBulkFields = () => {
    const t = $('#bk-type').value;
    $('#bk-phase-wrap').hidden = !(t === 'check' || t === 'auto');
    $('#bk-group-wrap').hidden = t === 'text';
  };
  $('#bk-type').addEventListener('change', () => { syncBulkFields(); preview(); });
  syncBulkFields();
  bindValueChips($('#modal'));
  $('#bk-cancel').addEventListener('click', closeModal);
  $('#bulk-form').addEventListener('submit', async e => {
    e.preventDefault();
    const rows = parseBulk($('#bk-text').value, $('#bk-type').value, bulkDefaults());
    if (!rows.length) { $('#bk-error').textContent = '項目を入力してください'; return; }
    const btn = $('#bk-submit');
    setBusy(btn, true, '登録中…');
    try {
      let order = items.length ? Math.max(...items.map(i => i.order ?? 0)) + 1 : 0;
      for (let i = 0; i < rows.length; i += 400) {
        const batch = db.batch();
        for (const r of rows.slice(i, i + 400)) {
          batch.set(db.collection('items').doc(), { ...r, order: order++, published: true, createdAt: FV.serverTimestamp() });
        }
        await batch.commit();
      }
      closeModal();
      await reloadItems();
      renderItems(); renderPending(); renderEmployees();
      toast(`${rows.length} 件を登録しました`, 'ok');
    } catch (err) {
      $('#bk-error').textContent = authErrorMessage(err);
      setBusy(btn, false);
    }
  });
}

/* ================= 設定 ================= */
function renderAdmins() {
  $('#admin-count').textContent = `${admins.length} / ${MAX_ADMINS}`;
  $('#admin-list').innerHTML = admins.map(a => `<div class="row">
    <div class="row-main"><b>${esc(a.name || '')}</b>${a.email === me.email ? ' <span class="badge badge-type">自分</span>' : ''}<div class="muted small">${esc(a.email)}</div></div>
    ${a.email === me.email ? '' : `<button type="button" class="btn btn-ghost btn-sm" data-remove-admin="${esc(a.email)}">外す</button>`}
  </div>`).join('');
  $('#btn-add-admin').hidden = admins.length >= MAX_ADMINS;
}

function openAddAdmin() {
  openModal(`<h3>責任者を追加</h3>
    <form id="admin-form">
      <label>名前（表示名）<input id="af-name" required placeholder="例：佐藤"></label>
      <label>メールアドレス（ログインID）<input id="af-email" type="email" required inputmode="email" autocapitalize="off" autocomplete="off"></label>
      <label>パスワード（6文字以上）<input id="af-pw" type="text" minlength="6" autocomplete="off" autocapitalize="off"></label>
      <p class="muted small">すでにこのメールでログインアカウントがある場合は、パスワードを空にすると責任者権限だけ付けられます</p>
      <p id="af-error" class="error"></p>
      <div class="btn-row">
        <button type="button" class="btn btn-ghost" id="af-cancel">キャンセル</button>
        <button type="submit" class="btn btn-primary" id="af-submit">追加する</button>
      </div>
    </form>`);
  $('#af-cancel').addEventListener('click', closeModal);
  $('#admin-form').addEventListener('submit', async e => {
    e.preventDefault();
    const name = $('#af-name').value.trim();
    const email = $('#af-email').value.trim().toLowerCase();
    const pw = $('#af-pw').value;
    const errEl = $('#af-error');
    errEl.textContent = '';
    if (admins.length >= MAX_ADMINS) { errEl.textContent = `責任者は ${MAX_ADMINS} 人までです`; return; }
    if (admins.some(a => a.email === email)) { errEl.textContent = 'すでに責任者として登録されています'; return; }
    const btn = $('#af-submit');
    setBusy(btn, true, '追加中…');
    try {
      if (pw) await createAuthUser(email, pw);
      await db.doc('admins/' + email).set({ name, createdAt: FV.serverTimestamp() });
      admins.push({ email, name });
      renderAdmins();
      if (pw) showCreated('責任者を追加しました', name, email, pw);
      else { closeModal(); toast('責任者権限を付けました', 'ok'); }
    } catch (err) {
      errEl.textContent = authErrorMessage(err);
      setBusy(btn, false);
    }
  });
}

async function onAdminListClick(e) {
  const btn = e.target.closest('[data-remove-admin]');
  if (!btn) return;
  const email = btn.dataset.removeAdmin;
  if (!confirm(`${email} を責任者から外しますか？（ログインアカウント自体は残ります）`)) return;
  try {
    await db.doc('admins/' + email).delete();
    admins = admins.filter(a => a.email !== email);
    renderAdmins();
    toast('責任者から外しました');
  } catch (err) { toast(authErrorMessage(err), 'err'); }
}

async function editMyName() {
  const name = prompt('表示名', me.name);
  if (!name || name.trim() === me.name) return;
  try {
    await db.doc('admins/' + me.email).update({ name: name.trim() });
    me.name = name.trim();
    $('#me-name').textContent = me.name;
    $('#my-name-disp').textContent = me.name;
    const a = admins.find(x => x.email === me.email); if (a) a.name = me.name;
    renderAdmins();
    toast('表示名を変更しました', 'ok');
  } catch (err) { toast(authErrorMessage(err), 'err'); }
}
