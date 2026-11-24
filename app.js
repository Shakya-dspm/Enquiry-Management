const KEY = 'enq-demo-v3', HR = 36e5, SLA = { high: 4, normal: 24, low: 72 };
const seed = {
    categories: [{ id: 'cat_1', name: 'Sales', description: 'Quotes and pricing' }, { id: 'cat_2', name: 'Billing', description: 'Invoices and payments' }, { id: 'cat_3', name: 'Support', description: 'Help with a product' }, { id: 'cat_4', name: 'Partnership', description: 'Business partnerships' }],
    statuses: [{ id: 'st_1', name: 'New', order: 1, color: '#2f4bdb', isFinal: false }, { id: 'st_2', name: 'In progress', order: 2, color: '#d98a00', isFinal: false }, { id: 'st_3', name: 'Resolved', order: 3, color: '#17855a', isFinal: true }, { id: 'st_4', name: 'Closed', order: 4, color: '#6b7688', isFinal: true }],
    enquiries: [
        ...[['Kasun Silva', 'Delivery delay on order 7731', 'cat_3', 'st_4', 'normal', 'Ayesha', 150], ['Elena Rossi', 'Request for product catalogue', 'cat_1', 'st_3', 'low', 'Daniel', 110], ['Tom Hardy', 'Wrong item received', 'cat_3', 'st_3', 'high', 'Kasun', 90], ['Aisha Khan', 'Refund not received', 'cat_2', 'st_4', 'normal', 'Ayesha', 125], ['Ravi Kumar', 'Sponsorship proposal', 'cat_4', 'st_1', 'normal', null, 12]].map(([n, s, c, st, p, a, h], i) => ({ id: 'enq_110' + i, name: n, email: n.split(' ')[0].toLowerCase() + '@example.com', subject: s, message: 'Hello, ' + s.toLowerCase() + '. Could someone please look into this?', categoryId: c, statusId: st, priority: p, assignee: a, notes: [], replies: [], history: [], created: Date.now() - HR * h })),
        { id: 'enq_1001', name: 'Priya Fernando', email: 'priya@lankatea.example', subject: 'Bulk pricing for 500 units', message: 'We’d like a quote for 500 units delivered to Colombo, with net-30 terms.', categoryId: 'cat_1', statusId: 'st_1', priority: 'high', assignee: null, notes: [], replies: [], history: [], created: Date.now() - HR * 5 },
        { id: 'enq_1002', name: 'Marcus Webb', email: 'marcus@brightwell.example', subject: 'Invoice shows the wrong address', message: 'Invoice #4821 lists our old office. Can you reissue it?', categoryId: 'cat_2', statusId: 'st_2', priority: 'normal', assignee: 'Ayesha', notes: [{ text: 'Billing profile address is outdated.', at: Date.now() - HR * 20 }], replies: [], history: [{ from: 'New', to: 'In progress', at: Date.now() - HR * 22 }], created: Date.now() - HR * 30 },
        { id: 'enq_1003', name: 'Nimali Perera', email: 'nimali@harbor.example', subject: 'Partnership opportunity', message: 'We run a logistics network across South Asia and would like to discuss a referral programme.', categoryId: 'cat_4', statusId: 'st_3', priority: 'low', assignee: 'Daniel', notes: [], replies: [], history: [], created: Date.now() - HR * 70 }
    ]
};
let db; try { db = JSON.parse(localStorage.getItem(KEY) || 'null') } catch (e) { db = null }
if (!db || !db.enquiries) db = JSON.parse(JSON.stringify(seed));
const persist = () => { try { localStorage.setItem(KEY, JSON.stringify(db)) } catch (e) { } };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const E = (s, o) => { throw { s, o } };
const uid = p => p + '_' + Math.random().toString(36).slice(2, 7);
const find = (a, id) => a.find(x => x.id === id) || E(404, { error: 'not_found', id });
const must = (b, ks) => { const m = ks.filter(k => String(b[k] ?? '').trim() === ''); if (m.length) E(422, { error: 'validation_failed', fields: m }) };
const sorted = () => [...db.statuses].sort((a, b) => a.order - b.order);
const due = e => e.created + (SLA[e.priority] || 24) * HR;
const SORTS = { newest: (a, b) => b.created - a.created, oldest: (a, b) => a.created - b.created, priority: (a, b) => (SLA[a.priority] - SLA[b.priority]) || a.created - b.created, due: (a, b) => due(a) - due(b) };
const isOpen = e => !find(db.statuses, e.statusId).isFinal;
const sum = e => ({ id: e.id, name: e.name, email: e.email, assignee: e.assignee, subject: e.subject, categoryId: e.categoryId, statusId: e.statusId, priority: e.priority, created: e.created, due: due(e), overdue: isOpen(e) && Date.now() > due(e) });
const used = (k, id) => db.enquiries.filter(e => e[k] === id).length;
const withCount = (arr, k) => arr.map(x => ({ ...x, enquiries: used(k, x.id) }));
const catCheck = id => { if (!db.categories.some(c => c.id === id)) E(422, { error: 'invalid_category', id }) };
const nameDup = (arr, n, self) => { if (arr.some(x => x.id !== self && x.name.trim().toLowerCase() === n.trim().toLowerCase())) E(409, { error: 'duplicate_name', name: n }) };

const RT = {
    'GET get-enquiries': () => ({ data: db.enquiries.map(sum), total: db.enquiries.length }),
    'GET filter-enquiries': (id, b, p) => {
        const s = p.get('statusId'), c = p.get('categoryId'), pr = p.get('priority'), q = (p.get('q') || '').toLowerCase();
        const d = db.enquiries.filter(e => (!s || e.statusId === s) && (!c || e.categoryId === c) && (!pr || e.priority === pr) && (!q || (e.name + e.subject).toLowerCase().includes(q))).sort(SORTS[p.get('sort')] || SORTS.newest).map(sum);
        return { data: d, total: d.length }
    },
    'GET get-enquiry': id => find(db.enquiries, id),
    'POST create-enquiry': b => {
        must(b, ['name', 'email', 'subject', 'message', 'categoryId']); catCheck(b.categoryId);
        const e = { id: uid('enq'), name: b.name, email: b.email, subject: b.subject, message: b.message, categoryId: b.categoryId, statusId: sorted()[0].id, priority: b.priority || 'normal', assignee: null, notes: [], replies: [], history: [], created: Date.now() };
        db.enquiries.push(e); return [201, e]
    },
    'PUT update-enquiry': (id, b) => {
        const e = find(db.enquiries, id), s = sorted();
        if (b.categoryId) catCheck(b.categoryId);
        ['note', 'reply'].forEach(k => { if (k in b && !String(b[k]).trim()) E(422, { error: 'validation_failed', fields: [k] }) });
        const move = to => {
            const i = s.findIndex(x => x.id === e.statusId), j = s.findIndex(x => x.id === to);
            if (j < 0) E(422, { error: 'invalid_status', id: to });
            if (Math.abs(i - j) !== 1) E(409, { error: 'invalid_transition', from: s[i].name, to: s[j].name, allowed: [s[i - 1], s[i + 1]].filter(Boolean).map(x => x.name) });
            e.history.push({ from: s[i].name, to: s[j].name, at: Date.now() }); e.statusId = to
        };
        if (b.statusId && b.statusId !== e.statusId) move(b.statusId);
        ['name', 'email', 'subject', 'message', 'priority', 'assignee', 'categoryId'].forEach(k => { if (k in b) e[k] = b[k] });
        if (b.note) e.notes.push({ text: b.note, at: Date.now() });
        if (b.reply) { e.replies.push({ text: b.reply, at: Date.now() }); if (e.statusId === s[0].id && s[1]) move(s[1].id) }
        return e
    },
    'DELETE delete-enquiry': id => { find(db.enquiries, id); db.enquiries = db.enquiries.filter(e => e.id !== id); return [204, null] },
    'GET get-categories': () => ({ data: withCount(db.categories, 'categoryId') }),
    'POST create-category': b => { must(b, ['name']); nameDup(db.categories, b.name); const c = { id: uid('cat'), name: b.name.trim(), description: b.description || '' }; db.categories.push(c); return [201, c] },
    'PUT update-category': (id, b) => { const c = find(db.categories, id); if ('name' in b) { must(b, ['name']); nameDup(db.categories, b.name, id); c.name = b.name.trim() } if ('description' in b) c.description = b.description; return c },
    'DELETE delete-category': id => { find(db.categories, id); const n = used('categoryId', id); if (n) E(409, { error: 'in_use', enquiries: n }); db.categories = db.categories.filter(c => c.id !== id); return [204, null] },
    'GET get-statuses': () => ({ data: withCount(sorted(), 'statusId') }),
    'POST create-status': b => { must(b, ['name']); nameDup(db.statuses, b.name); const s = { id: uid('st'), name: b.name.trim(), order: Number(b.order) || db.statuses.length + 1, color: b.color || '#6b7688', isFinal: !!b.isFinal }; db.statuses.push(s); return [201, s] },
    'PUT update-status': (id, b) => {
        const s = find(db.statuses, id); if ('name' in b) { must(b, ['name']); nameDup(db.statuses, b.name, id); s.name = b.name.trim() }
        if ('order' in b) s.order = Number(b.order) || s.order; if ('color' in b) s.color = b.color; if ('isFinal' in b) s.isFinal = !!b.isFinal; return s
    },
    'DELETE delete-status': id => { find(db.statuses, id); if (db.statuses.length <= 2) E(409, { error: 'min_statuses' }); const n = used('statusId', id); if (n) E(409, { error: 'in_use', enquiries: n }); db.statuses = db.statuses.filter(s => s.id !== id); return [204, null] }
};
async function api(method, path, body, quiet) {
    const t0 = performance.now(); await sleep(90 + Math.random() * 140);
    const [p, qs] = path.split('?'), [route, id] = p.split('/'); let st = 200, out;
    try {
        const f = RT[method + ' ' + route]; if (!f) E(404, { error: 'not_found' }); const o = f(id, body || {}, new URLSearchParams(qs || ''));
        if (Array.isArray(o)) { st = o[0]; out = o[1] } else out = o
    }
    catch (x) { if (x && x.s) { st = x.s; out = x.o } else throw x }
    persist();
    if (!quiet) logCall(method, path, body, st, out, Math.round(performance.now() - t0));
    if (st >= 400) throw Object.assign(new Error(out.error), { out });
    return out;
}

// ================= Console, helpers =================
const $ = id => document.getElementById(id);
const esc = s => String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const ago = t => { const h = Math.round((Date.now() - t) / HR); return h < 1 ? 'just now' : h < 24 ? h + ' h ago' : Math.round(h / 24) + ' d ago' };
const dur = ms => { const h = Math.max(1, Math.round(ms / HR)); return h < 24 ? h + ' h' : Math.round(h / 24) + ' d' };
function logCall(m, path, body, st, out, ms) {
    const d = document.createElement('div'); d.className = 'call';
    const s = out === null ? '(no content)' : JSON.stringify(out, null, 2);
    d.innerHTML = `<div class="l"><span class="m ${m}">${m}</span><span>/api/Enquiry/${esc(path)}</span><span class="${st < 400 ? 'ok' : 'bad'}">${st}</span><span class="ms">${ms} ms</span></div>` + (body && Object.keys(body).length ? `<pre>→ ${esc(JSON.stringify(body))}</pre>` : '') + `<pre>${esc(s.length > 900 ? s.slice(0, 900) + '\n…' : s)}</pre>`;
    $('log').prepend(d); while ($('log').children.length > 25) $('log').lastChild.remove();
}
$('clr').onclick = () => { $('log').innerHTML = '' };
let tt; function toast(m) { const t = $('toast'); t.textContent = m; t.classList.add('on'); clearTimeout(tt); tt = setTimeout(() => t.classList.remove('on'), 4000) }
function msgFor(o) {
    if (o.error === 'in_use') return `In use by ${o.enquiries} enquiries. Move them to another one first.`;
    if (o.error === 'invalid_transition') return `Can’t move from ${o.from} to ${o.to}. Allowed: ${o.allowed.join(' or ')}.`;
    if (o.error === 'validation_failed') return `Please fill in: ${o.fields.join(', ')}.`;
    if (o.error === 'duplicate_name') return `“${o.name}” already exists.`;
    if (o.error === 'min_statuses') return 'Keep at least two statuses so enquiries can progress.';
    return 'Something went wrong. Please try again.';
}
async function run(f) { try { return await f() } catch (e) { if (e.out) { toast(msgFor(e.out)); return } throw e } }
function arm(b, fn) { if (b.dataset.armed) { fn(); return } b.dataset.armed = 1; const t = b.textContent; b.textContent = 'Confirm delete'; setTimeout(() => { delete b.dataset.armed; b.textContent = t }, 3000) }

// ================= State and rendering =================
let cats = [], sts = [], selected = null, tab = 'enq';
const stat = id => sts.find(s => s.id === id) || { name: 'Unknown', color: '#888', isFinal: false };
const catName = id => (cats.find(c => c.id === id) || { name: 'Uncategorised' }).name;
const tag = s => `<span class="tag"><i style="background:${esc(s.color)}"></i>${esc(s.name)}</span>`;
const ini = n => n.split(" ").map(w => w[0]).slice(0, 2).join("").toUpperCase();
const opts = (arr, all) => (all ? `<option value="">${all}</option>` : '') + arr.map(x => `<option value="${x.id}">${esc(x.name)}</option>`).join('');
const setOpts = (id, h) => { const v = $(id).value; $(id).innerHTML = h; $(id).value = v };

async function loadMeta(quiet) {
    cats = (await api('GET', 'get-categories', null, quiet)).data;
    sts = (await api('GET', 'get-statuses', null, quiet)).data;
    setOpts('fs', opts(sts, 'All statuses')); setOpts('fc', opts(cats, 'All categories'));
}
async function loadStats() {
    const r = await api('GET', 'get-enquiries', null, true), op = r.data.filter(e => !stat(e.statusId).isFinal), od = op.filter(e => e.overdue).length;
    const items = [['Total', r.total], ['Open', op.length], ['Overdue', od, od > 0], ['High priority open', op.filter(e => e.priority === 'high').length]].concat(sts.map(s => [s.name, r.data.filter(e => e.statusId === s.id).length]));
    $('stats').innerHTML = items.map(([l, v, w]) => `<div class="stat${w ? ' warn' : ''}"><b>${v}</b><small>${esc(l)}</small></div>`).join('');
}
async function loadList() {
    const q = new URLSearchParams();[['statusId', 'fs'], ['categoryId', 'fc'], ['priority', 'fp'], ['q', 'q'], ['sort', 'sf']].forEach(([k, i]) => { const v = $(i).value.trim(); if (v) q.set(k, v) });
    const r = await api('GET', 'filter-enquiries?' + q);
    $('list').innerHTML = r.data.length ? r.data.map(e => `<li class="row" tabindex="0" role="option" aria-selected="${e.id === selected}" data-id="${e.id}"><span class="av sm" aria-hidden="true">${ini(e.name)}</span><div class="rb"><div class="top"><b>${esc(e.subject)}</b><span>${e.overdue ? '<span class="tag late">Overdue</span> ' : ''}${tag(stat(e.statusId))}</span></div><small>${esc(e.name)} · ${esc(catName(e.categoryId))} · ${ago(e.created)}${e.priority === 'high' ? ' · high priority' : ''}</small></div></li>`).join('') : '<li class="empty">No enquiries match these filters. Clear them or create a new enquiry.</li>';
}
const upd = async (id, b) => { await run(() => api('PUT', 'update-enquiry/' + id, b)); refresh() };
async function loadDetail(id) {
    if (!id) { $('detail').innerHTML = '<div class="empty">Select an enquiry to see its details, or create a new one.</div>'; return }
    let e; try { e = await api('GET', 'get-enquiry/' + id) } catch (x) { selected = null; $('detail').innerHTML = '<div class="empty">That enquiry no longer exists.</div>'; return }
    const s = stat(e.statusId), i = sts.findIndex(x => x.id === e.statusId), next = sts[i + 1], prev = sts[i - 1], bad = sts.find((x, j) => Math.abs(j - i) > 1), late = !s.isFinal && Date.now() > due(e), fn = e.name.split(' ')[0];
    $('detail').innerHTML = `<div class="detail"><h2>${esc(e.subject)}</h2>
  <div class="meta">${esc(e.name)} · ${esc(e.email)} · received ${ago(e.created)} · <span class="${late ? 'late' : ''}">${s.isFinal ? 'SLA stopped' : late ? 'SLA overdue by ' + dur(Date.now() - due(e)) : 'SLA due in ' + dur(due(e) - Date.now())}</span></div>
  <div class="msg">${esc(e.message)}</div>
  <ol class="steps" aria-label="Status progress">${sts.map((x, j) => `<li class="${j === i ? 'cur' : j < i ? 'past' : ''}">${esc(x.name)}</li>`).join('')}</ol>
  <div class="ctl">${next ? `<button class="pri" data-to="${next.id}">Move to ${esc(next.name)}</button>` : ''}${prev ? `<button data-to="${prev.id}">Back to ${esc(prev.name)}</button>` : ''}</div>
  <div class="ctl"><label for="cat">Category</label><select id="cat">${cats.map(c => `<option value="${c.id}" ${c.id === e.categoryId ? 'selected' : ''}>${esc(c.name)}</option>`).join('')}</select>
   <label for="as">Assignee</label><select id="as"><option value="">Unassigned</option>${['Ayesha', 'Daniel', 'Kasun'].map(a => `<option ${a === e.assignee ? 'selected' : ''}>${a}</option>`).join('')}</select>
   <button class="dan" id="del">Delete</button></div>
  ${e.history.length ? '<h3>Status history</h3>' + e.history.map(h => `<div class="note">${esc(h.from)} to ${esc(h.to)}<small>${ago(h.at)}</small></div>`).join('') : ''}
  <h3>Customer replies</h3>
  ${e.replies.length ? e.replies.map(r => `<div class="note">${esc(r.text)}<small>Sent to ${esc(e.email)} · ${ago(r.at)}</small></div>`).join('') : '<p class="meta">No replies yet. The first reply moves a new enquiry to the next status.</p>'}
  <select id="tpl" aria-label="Reply template"><option value="">Start from a template</option><option value="ack">Acknowledge receipt</option><option value="info">Ask for more information</option><option value="done">Confirm resolution</option></select>
  <textarea id="rt" rows="3" placeholder="Write a reply to the customer" aria-label="Reply" style="margin:8px 0"></textarea>
  <button class="pri" id="send">Send reply</button>
  <h3>Internal notes</h3>
  ${e.notes.length ? e.notes.map(n => `<div class="note">${esc(n.text)}<small>${ago(n.at)}</small></div>`).join('') : '<p class="meta">No notes yet.</p>'}
  <div style="display:flex;gap:8px"><input id="nt" placeholder="Add a note for your team" aria-label="Note"><button class="pri" id="addNote">Add note</button></div></div>`;
    const T = { ack: `Hi ${fn}, thanks for getting in touch. We’ve received your enquiry and will update you shortly.`, info: `Hi ${fn}, could you share a few more details so we can help? Order numbers or dates would be useful.`, done: `Hi ${fn}, we’ve resolved your enquiry. Reply to this message if anything still looks wrong.` };
    $('tpl').onchange = () => { $('rt').value = T[$('tpl').value] || '' };
    document.querySelectorAll('[data-to]').forEach(b => b.onclick = () => upd(id, { statusId: b.dataset.to }));
    if ($('bad')) $('bad').onclick = () => upd(id, { statusId: bad.id });
    $('cat').onchange = () => upd(id, { categoryId: $('cat').value });
    $('as').onchange = () => upd(id, { assignee: $('as').value || null });
    $('send').onclick = () => upd(id, { reply: $('rt').value });
    $('addNote').onclick = () => upd(id, { note: $('nt').value });
    $('del').onclick = ev => arm(ev.currentTarget, async () => { await run(() => api('DELETE', 'delete-enquiry/' + id)); selected = null; refresh() });
}
function renderManage() {
    $('catBody').innerHTML = cats.length ? cats.map(c => `<tr><td>${esc(c.name)}</td><td>${esc(c.description)}</td><td>${c.enquiries}</td><td class="ra"><button data-ed="category" data-id="${c.id}">Edit</button> <button class="dan" data-del="category" data-id="${c.id}">Delete</button></td></tr>`).join('') : '<tr><td colspan="4" class="empty">No categories yet. Add one to start sorting enquiries.</td></tr>';
    $('staBody').innerHTML = sts.map(s => `<tr><td>${s.order}</td><td>${tag(s)}</td><td>${s.isFinal ? 'Yes' : 'No'}</td><td>${s.enquiries}</td><td class="ra"><button data-ed="status" data-id="${s.id}">Edit</button> <button class="dan" data-del="status" data-id="${s.id}">Delete</button></td></tr>`).join('');
}
async function refresh() { await loadMeta(true); loadStats(); loadDash(); await loadList(); await loadDetail(selected); renderManage() }
async function show(t) {
    tab = t; document.querySelectorAll('[data-tab]').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === t));
    ['dash', 'enq', 'cat', 'sta'].forEach(k => $('v-' + k).hidden = k !== t);
    if (t === 'dash') loadDash(); if (t === 'cat' || t === 'sta') { await loadMeta(false); renderManage() }
}

async function loadDash() {
    const r = await api('GET', 'get-enquiries', null, true), d = r.data, fin = e => stat(e.statusId).isFinal, op = d.filter(e => !fin(e)), od = op.filter(e => e.overdue).length;
    const pct = d.length ? Math.round((d.length - op.length) / d.length * 100) : 0, hi = op.filter(e => e.priority === 'high').length;
    const days = Array.from({ length: 7 }, () => ({ o: 0, c: 0 }));
    d.forEach(e => { const i = 6 - Math.min(6, Math.floor((Date.now() - e.created) / (24 * HR))); days[i][fin(e) ? 'c' : 'o']++ });
    const tot = days.map(p => p.o + p.c), max = Math.max(1, ...tot);
    const lbl = i => new Date(Date.now() - (6 - i) * 24 * HR).toLocaleDateString('en', { weekday: 'short' });
    const pts = tot.map((v, i) => `${i * 100 / 6},${30 - v / max * 26}`).join(' ');
    const pri = ['high', 'normal', 'low'].map(p => op.filter(e => e.priority === p).length), pm = Math.max(1, ...pri);
    const card = (c, t, n, v, sub) => `<div class="card sc" style="--c:${c}"><h4>${t}</h4><div class="top"><span class="n">${n}</span>${v}</div>${sub}</div>`;
    $('cards').innerHTML =
        card('#f05b5b', 'Total enquiries', d.length, `<div class="donut" style="--p:${pct}" role="img" aria-label="${pct}% completed"></div>`, `<small>${pct}% completed</small>`) +
        card('#2f80ed', 'Open enquiries', op.length, '', `<div class="bar"><i style="width:${op.length ? Math.round((op.length - od) / op.length * 100) : 100}%"></i></div><small>Within SLA ${op.length - od} · Overdue ${od}</small>`) +
        card('#6cc644', 'Customers', new Set(d.map(e => e.email)).size, `<svg viewBox="0 0 100 32" width="90" height="32" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--c)" stroke-width="2"/></svg>`, `<small>${tot.reduce((a, b) => a + b, 0)} enquiries in the last 7 days</small>`) +
        card('#2ecfc9', 'High priority open', hi, `<div class="mb" aria-hidden="true">${pri.map(v => `<i style="height:${v / pm * 100}%"></i>`).join('')}</div>`, `<small>High ${pri[0]} · Normal ${pri[1]} · Low ${pri[2]}</small>`);
    $('week').innerHTML = `<div class="wk">${days.map((p, i) => `<div class="col"><div class="tr" title="${p.o} open, ${p.c} completed"><i style="height:${p.o / max * 100}%;background:var(--acc)"></i><i style="height:${p.c / max * 100}%;background:#2ecfc9"></i></div><small>${lbl(i)}</small></div>`).join('')}</div><p class="mute" style="margin:12px 0 0"><span class="dot" style="background:var(--acc);margin-left:0"></span>Open<span class="dot" style="background:#2ecfc9"></span>Completed</p>`;
    const ag = {}; d.filter(fin).forEach(e => { if (e.assignee) ag[e.assignee] = (ag[e.assignee] || 0) + 1 });
    const top = Object.entries(ag).sort((a, b) => b[1] - a[1]).slice(0, 3);
    $('agents').innerHTML = top.length ? `<div class="ag">${top.map(([n, c], i) => `<div style="background:${['#6c5ce7', '#0b8a85', '#2f6fd0'][i]}"><b>${esc(n)}</b><small>${c} resolved</small><span class="rk">${['1st', '2nd', '3rd'][i]}</span></div>`).join('')}</div>` : '<p class="mute">No resolved enquiries yet.</p>';
    $('recent').innerHTML = [...d].sort((a, b) => b.created - a.created).slice(0, 3).map(e => `<div class="rc"><b>${esc(e.subject)}</b> <small>${ago(e.created)}</small><br><small>${esc(e.name)} · ${esc(catName(e.categoryId))} · ${esc(stat(e.statusId).name)}</small></div>`).join('');
}
$('gs').onkeydown = e => { if (e.key === 'Enter') { $('q').value = $('gs').value; show('enq'); loadList() } };
document.addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (g) show(g.dataset.go) });

// ================= Events =================
document.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => show(b.dataset.tab));
$('list').addEventListener('click', e => { const r = e.target.closest('.row'); if (r) { selected = r.dataset.id; refresh() } });
$('list').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { const r = e.target.closest('.row'); if (r) { e.preventDefault(); selected = r.dataset.id; refresh() } } });
let tm; $('q').oninput = () => { clearTimeout(tm); tm = setTimeout(loadList, 300) };
['fs', 'fc', 'fp', 'sf'].forEach(i => $(i).onchange = loadList);
$('rst').onclick = () => { db = JSON.parse(JSON.stringify(seed)); persist(); selected = null; refresh(); toast('Demo data reset.') };
for (const id of ['v-cat', 'v-sta']) $(id).addEventListener('click', ev => {
    const b = ev.target.closest('button'); if (!b) return;
    if (b.dataset.new) openDlg(b.dataset.new);
    else if (b.dataset.ed) openDlg(b.dataset.ed, b.dataset.id);
    else if (b.dataset.del) arm(b, async () => { await run(() => api('DELETE', 'delete-' + b.dataset.del + '/' + b.dataset.id)); refresh() });
});

// ================= Create / edit dialog =================
const FORMS = {
    enquiry: [['name', 'Name', 'text'], ['email', 'Email', 'email'], ['subject', 'Subject', 'text'], ['message', 'Message', 'textarea'], ['categoryId', 'Category', 'cat'], ['priority', 'Priority', 'pri']],
    category: [['name', 'Name', 'text'], ['description', 'Description', 'text']],
    status: [['name', 'Name', 'text'], ['order', 'Position in workflow', 'number'], ['color', 'Colour', 'color'], ['isFinal', 'Stops the SLA clock (work is done)', 'check']]
};
function fieldHtml([k, l, t], v) {
    const id = 'f_' + k;
    if (t === 'check') return `<label class="chk"><input type="checkbox" id="${id}" ${v ? 'checked' : ''}> ${l}</label>`;
    let c;
    if (t === 'textarea') c = `<textarea id="${id}" rows="4">${esc(v)}</textarea>`;
    else if (t === 'cat') c = `<select id="${id}">${cats.map(x => `<option value="${x.id}" ${x.id === v ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select>`;
    else if (t === 'pri') c = `<select id="${id}">${['high', 'normal', 'low'].map(x => `<option ${x === v ? 'selected' : ''}>${x}</option>`).join('')}</select>`;
    else c = `<input id="${id}" type="${t}" value="${esc(v)}">`;
    return `<label for="${id}">${l}</label>${c}`;
}
let ed = null;
function openDlg(type, id) {
    ed = { type, id };
    const cur = id ? (type === 'category' ? cats : sts).find(x => x.id === id) : { priority: 'normal', categoryId: cats[0] && cats[0].id, order: sts.length + 1, color: '#6b7688', isFinal: false };
    $('dt').textContent = (id ? 'Edit ' : 'New ') + type;
    $('dfields').innerHTML = FORMS[type].map(f => fieldHtml(f, cur[f[0]] ?? '')).join('');
    $('derr').textContent = ''; $('dlg').showModal(); $('dfields').querySelector('input,select,textarea').focus();
}
$('newBtn').onclick = async () => { if (!cats.length) await loadMeta(true); openDlg('enquiry') };
$('cancel').onclick = () => $('dlg').close();
$('save').onclick = async () => {
    const body = {}; FORMS[ed.type].forEach(([k, , t]) => { const el = $('f_' + k); body[k] = t === 'check' ? el.checked : t === 'number' ? Number(el.value) : el.value });
    try {
        const r = await api(ed.id ? 'PUT' : 'POST', (ed.id ? 'update-' : 'create-') + ed.type + (ed.id ? '/' + ed.id : ''), body);
        $('dlg').close(); if (ed.type === 'enquiry') { selected = r.id; await show('enq') } refresh();
    } catch (x) { $('derr').textContent = x.out ? msgFor(x.out) : 'Something went wrong. Try again.' }
};

$('today').textContent = new Date().toLocaleDateString('en', { weekday: 'long', day: 'numeric', month: 'long' });
refresh();
