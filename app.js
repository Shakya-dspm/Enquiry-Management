// Local development uses the same-origin proxy in local-server.cjs. Static deployments
// use the provider URL directly; the provider currently omits ACAO on actual responses.
const API_BASE = typeof location !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(location.hostname)
  ? "/api/Enquiry"
  : "https://api.freeprojectapi.com/api/Enquiry";
const HR = 36e5, SLA = { high: 4, normal: 24, low: 72 };
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const ago = (t) => { const h=Math.round((Date.now()-t)/HR); return h<1?"just now":h<24?h+" h ago":Math.round(h/24)+" d ago"; };
const dur = (ms) => { const h=Math.max(1,Math.round(ms/HR)); return h<24?h+" h":Math.round(h/24)+" d"; };
const due = (e) => e.created + (SLA[e.priority] || 24) * HR;
function mapEnquiry(x) {
  const created=Date.parse(x.enquiryDate || x.created || "") || Date.now();
  const message=x.message ?? "";
  const e={id:String(x.enquiryId ?? x.id),name:x.customerName ?? x.name ?? "Unknown customer",email:x.customerEmail ?? x.email ?? "",subject:x.subject ?? (message.length>72?message.slice(0,69)+"...":message || "Enquiry"),message,categoryId:String(x.categoryId ?? ""),statusId:String(x.statusId ?? ""),priority:x.priority ?? "normal",converted:!!x.isConverted,assignee:x.assignee ?? null,notes:[],replies:x.feedback?[{text:x.feedback,at:created}]:[],history:[],created};
  e.due=due(e); e.overdue=!stat(e.statusId).isFinal && Date.now()>e.due; return e;
}
async function api(method,path,body,quiet) {
  const route=path.split("?")[0], parts=route.split("/"), action=parts[0], id=parts[1];
  const endpoints={"get-enquiries":"get-enquiries","get-categories":"get-categories","get-statuses":"get-statuses","get-enquiry":"get-enquiry/"+id,"create-enquiry":"create-enquiry","update-enquiry":"update-enquiry/"+id,"delete-enquiry":"delete-enquiry/"+id,"create-category":"create-category","update-category":"update-category/"+id,"delete-category":"delete-category/"+id,"create-status":"create-status","update-status":"update-status/"+id,"delete-status":"delete-status/"+id};
  const endpoint=endpoints[action] || (action==="filter-enquiries"?"get-enquiries":null);
  if(!endpoint) throw new Error("Unsupported API operation");
  let payload=body;
  if(body && action.includes("enquiry")) {
    payload={};
    if(action==="create-enquiry") Object.assign(payload,{customerName:body.name,customerEmail:body.email,customerPhone:body.phone || "",message:[body.subject,body.message].filter(Boolean).join("\n\n"),categoryId:Number(body.categoryId),statusId:Number(sts.find(s=>/new/i.test(s.name))?.id || 0),enquiryType:"",enquiryDate:new Date().toISOString(),followUpDate:new Date().toISOString()});
    else {
      if("name" in body) payload.customerName=body.name;
      if("email" in body) payload.customerEmail=body.email;
      if("message" in body) payload.message=body.message;
      if("categoryId" in body) payload.categoryId=Number(body.categoryId);
      if("statusId" in body) payload.statusId=Number(body.statusId);
      if("reply" in body || "note" in body) payload.feedback=body.reply ?? body.note;
    }
  } else if(body && action.includes("category")) {
    payload={}; if("name" in body) payload.categoryName=body.name; if("description" in body) payload.description=body.description;
  } else if(body && action.includes("status")) {
    payload={}; if("name" in body) payload.statusName=body.name; if("isFinal" in body) payload.isActive=!!body.isFinal;
  }
  const t0=performance.now(); let response;
  try { response=await fetch(`${API_BASE}/${endpoint}`,{method,headers:{Accept:"application/json",...(method!=="GET"?{"Content-Type":"application/json"}:{})},...(method!=="GET"?{body:JSON.stringify(payload ?? {})}:{})}); }
  catch { throw new Error("The browser could not reach FreeProjectAPI. This may be blocked by provider CORS on static hosting; use `node local-server.cjs` for local development."); }
  let raw=null; if(response.status!==204){try{raw=await response.json();}catch{}}
  if(!response.ok || raw?.result===false) throw Object.assign(new Error(raw?.message || `API request failed (${response.status})`),{out:{error:raw?.message || "api_error"}});
  let out=raw?.data ?? raw;
  if(action==="get-enquiries" || action==="filter-enquiries"){const rows=Array.isArray(out)?out:[];out={data:rows.map(mapEnquiry),total:rows.length};}
  if(action==="get-enquiry") out=mapEnquiry(out || {});
  if(action==="get-categories") out={data:(Array.isArray(out)?out:[]).map(c=>({id:String(c.categoryId),name:c.categoryName,description:c.description||"",enquiries:0}))};
  if(action==="get-statuses") out={data:(Array.isArray(out)?out:[]).map((s,i)=>({id:String(s.statusId),name:s.statusName,order:i+1,color:"#6b7688",isFinal:/done|resolved|closed/i.test(s.statusName),enquiries:0}))};
  if(!quiet) logCall(method,endpoint,body,response.status,raw,Math.round(performance.now()-t0));
  return out;
}
// ================= Console, helpers =================
function logCall(m, path, body, st, out, ms) {
  const d = document.createElement("div");
  d.className = "call";
  const s = out === null ? "(no content)" : JSON.stringify(out, null, 2);
  d.innerHTML =
    `<div class="l"><span class="m ${m}">${m}</span><span>/api/Enquiry/${esc(path)}</span><span class="${st < 400 ? "ok" : "bad"}">${st}</span><span class="ms">${ms} ms</span></div>` +
    (body && Object.keys(body).length
      ? `<pre>${esc(JSON.stringify(body))}</pre>`
      : "") +
    `<pre>${esc(s.length > 900 ? s.slice(0, 900) + "\n?" : s)}</pre>`;
  $("log").prepend(d);
  while ($("log").children.length > 25) $("log").lastChild.remove();
}
$("clr").onclick = () => {
  $("log").innerHTML = "";
};
let tt;
function toast(m) {
  const t = $("toast");
  t.textContent = m;
  t.classList.add("on");
  clearTimeout(tt);
  tt = setTimeout(() => t.classList.remove("on"), 4000);
}
function msgFor(o) {
  if (o.error === "in_use")
    return `In use by ${o.enquiries} enquiries. Move them to another one first.`;
  if (o.error === "invalid_transition")
    return `Can?占퐐 move from ${o.from} to ${o.to}. Allowed: ${o.allowed.join(" or ")}.`;
  if (o.error === "validation_failed")
    return `Please fill in: ${o.fields.join(", ")}.`;
  if (o.error === "duplicate_name") return `"${o.name}" already exists.`;
  if (o.error === "min_statuses")
    return "Keep at least two statuses so enquiries can progress.";
  return "Something went wrong. Please try again.";
}
async function run(f) {
  try {
    return await f();
  } catch (e) {
    if (e.out) {
      toast(msgFor(e.out));
      return;
    }
    throw e;
  }
}
function arm(b, fn) {
  if (b.dataset.armed) {
    fn();
    return;
  }
  b.dataset.armed = 1;
  const t = b.textContent;
  b.textContent = "Confirm delete";
  setTimeout(() => {
    delete b.dataset.armed;
    b.textContent = t;
  }, 3000);
}

// ================= State and rendering =================
let cats = [],
  sts = [],
  selected = null,
  tab = "enq";
const stat = (id) =>
  sts.find((s) => s.id === id) || {
    name: "Unknown",
    color: "#888",
    isFinal: false,
  };
const catName = (id) =>
  (cats.find((c) => c.id === id) || { name: "Uncategorised" }).name;
const tag = (s) =>
  `<span class="tag"><i style="background:${esc(s.color)}"></i>${esc(s.name)}</span>`;
const ini = (n) =>
  n
    .split(" ")
    .map((w) => w[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
const opts = (arr, all) =>
  (all ? `<option value="">${all}</option>` : "") +
  arr.map((x) => `<option value="${x.id}">${esc(x.name)}</option>`).join("");
const setOpts = (id, h) => {
  const v = $(id).value;
  $(id).innerHTML = h;
  $(id).value = v;
};

async function loadMeta(quiet) {
  cats = (await api("GET", "get-categories", null, quiet)).data;
  sts = (await api("GET", "get-statuses", null, quiet)).data;
  setOpts("fs", opts(sts, "All statuses"));
  setOpts("fc", opts(cats, "All categories"));
}
async function loadStats() {
  const r = await api("GET", "get-enquiries", null, true),
    op = r.data.filter((e) => !stat(e.statusId).isFinal),
    od = op.filter((e) => e.overdue).length;
  const items = [
    ["Total", r.total],
    ["Open", op.length],
    ["Overdue", od, od > 0],
    ["Converted", r.data.filter((e) => e.converted).length],
  ].concat(
    sts.map((s) => [s.name, r.data.filter((e) => e.statusId === s.id).length]),
  );
  $("stats").innerHTML = items
    .map(
      ([l, v, w]) =>
        `<div class="stat${w ? " warn" : ""}"><b>${v}</b><small>${esc(l)}</small></div>`,
    )
    .join("");
}
async function loadList() {
  const q = new URLSearchParams();
  [
    ["statusId", "fs"],
    ["categoryId", "fc"],
    ["q", "q"],
    ["sort", "sf"],
  ].forEach(([k, i]) => {
    const v = $(i).value.trim();
    if (v) q.set(k, v);
  });
  const r = await api("GET", "get-enquiries");
  const filters = new URLSearchParams(q);
  r.data = r.data.filter(e => (!filters.get("statusId") || e.statusId === filters.get("statusId")) && (!filters.get("categoryId") || e.categoryId === filters.get("categoryId")) && (!filters.get("priority") || e.priority === filters.get("priority")) && (!filters.get("q") || (e.name + " " + e.subject + " " + e.message).toLowerCase().includes(filters.get("q").toLowerCase()))).sort((a,b) => filters.get("sort")==="oldest" ? a.created-b.created : b.created-a.created);
  $("list").innerHTML = r.data.length
    ? r.data
        .map(
          (e) =>
            `<li class="row" tabindex="0" role="option" aria-selected="${e.id === selected}" data-id="${e.id}"><span class="av sm" aria-hidden="true">${ini(e.name)}</span><div class="rb"><div class="top"><b>${esc(e.subject)}</b><span>${e.overdue ? '<span class="tag late">Overdue</span> ' : ""}${tag(stat(e.statusId))}</span></div><small>${esc(e.name)} 쨌 ${esc(catName(e.categoryId))} 쨌 ${ago(e.created)}${e.priority === "high" ? " 쨌 high priority" : ""}</small></div></li>`,
        )
        .join("")
    : '<li class="empty">No enquiries match these filters. Clear them or create a new enquiry.</li>';
}
const upd = async (id, b) => {
  await run(() => api("PUT", "update-enquiry/" + id, b));
  refresh();
};
async function loadDetail(id) {
  if (!id) {
    $("detail").innerHTML =
      '<div class="empty">Select an enquiry to see its details, or create a new one.</div>';
    return;
  }
  let e;
  try {
    e = await api("GET", "get-enquiry/" + id);
  } catch (x) {
    selected = null;
    $("detail").innerHTML =
      '<div class="empty">That enquiry no longer exists.</div>';
    return;
  }
  const s = stat(e.statusId),
    i = sts.findIndex((x) => x.id === e.statusId),
    next = sts[i + 1],
    prev = sts[i - 1],
    bad = sts.find((x, j) => Math.abs(j - i) > 1),
    late = !s.isFinal && Date.now() > due(e),
    fn = e.name.split(" ")[0];
  $("detail").innerHTML = `<div class="detail"><h2>${esc(e.subject)}</h2>
  <div class="meta">${esc(e.name)} 쨌 ${esc(e.email)} 쨌 received ${ago(e.created)} 쨌 <span class="${late ? "late" : ""}">${s.isFinal ? "SLA stopped" : late ? "SLA overdue by " + dur(Date.now() - due(e)) : "SLA due in " + dur(due(e) - Date.now())}</span></div>
  <div class="msg">${esc(e.message)}</div>
  <ol class="steps" aria-label="Status progress">${sts.map((x, j) => `<li class="${j === i ? "cur" : j < i ? "past" : ""}">${esc(x.name)}</li>`).join("")}</ol>
  <div class="ctl">${next ? `<button class="pri" data-to="${next.id}">Move to ${esc(next.name)}</button>` : ""}${prev ? `<button data-to="${prev.id}">Back to ${esc(prev.name)}</button>` : ""}</div>
  <div class="ctl"><label for="cat">Category</label><select id="cat">${cats.map((c) => `<option value="${c.id}" ${c.id === e.categoryId ? "selected" : ""}>${esc(c.name)}</option>`).join("")}</select>
   <button class="dan" id="del">Delete</button></div>
  ${e.history.length ? "<h3>Status history</h3>" + e.history.map((h) => `<div class="note">${esc(h.from)} to ${esc(h.to)}<small>${ago(h.at)}</small></div>`).join("") : ""}
  <h3>Customer feedback</h3>
  ${e.replies.length ? e.replies.map((r) => `<div class="note">${esc(r.text)}<small>Sent to ${esc(e.email)} 쨌 ${ago(r.at)}</small></div>`).join("") : '<p class="meta">No replies yet. The first reply moves a new enquiry to the next status.</p>'}
  <select id="tpl" aria-label="Reply template"><option value="">Start from a template</option><option value="ack">Acknowledge receipt</option><option value="info">Ask for more information</option><option value="done">Confirm resolution</option></select>
  <textarea id="rt" rows="3" placeholder="Record customer feedback" aria-label="Customer feedback" style="margin:8px 0"></textarea>
  <button class="pri" id="send">Save feedback</button>
  </div>`;
  const T = {
    ack: `Hi ${fn}, thanks for getting in touch. We?占퐒e received your enquiry and will update you shortly.`,
    info: `Hi ${fn}, could you share a few more details so we can help? Order numbers or dates would be useful.`,
    done: `Hi ${fn}, we?占퐒e resolved your enquiry. Reply to this message if anything still looks wrong.`,
  };
  $("tpl").onchange = () => {
    $("rt").value = T[$("tpl").value] || "";
  };
  document
    .querySelectorAll("[data-to]")
    .forEach((b) => (b.onclick = () => upd(id, { statusId: b.dataset.to })));
  if ($("bad")) $("bad").onclick = () => upd(id, { statusId: bad.id });
  $("cat").onchange = () => upd(id, { categoryId: $("cat").value });
  $("send").onclick = () => upd(id, { reply: $("rt").value });
  $("del").onclick = (ev) =>
    arm(ev.currentTarget, async () => {
      await run(() => api("DELETE", "delete-enquiry/" + id));
      selected = null;
      refresh();
    });
}
function renderManage() {
  $("catBody").innerHTML = cats.length
    ? cats
        .map(
          (c) =>
            `<tr><td>${esc(c.name)}</td><td>${esc(c.description)}</td><td>${c.enquiries}</td><td class="ra"><button data-ed="category" data-id="${c.id}">Edit</button> <button class="dan" data-del="category" data-id="${c.id}">Delete</button></td></tr>`,
        )
        .join("")
    : '<tr><td colspan="4" class="empty">No categories yet. Add one to start sorting enquiries.</td></tr>';
  $("staBody").innerHTML = sts
    .map(
      (s) =>
        `<tr><td>${s.order}</td><td>${tag(s)}</td><td>${s.isFinal ? "Yes" : "No"}</td><td>${s.enquiries}</td><td class="ra"><button data-ed="status" data-id="${s.id}">Edit</button> <button class="dan" data-del="status" data-id="${s.id}">Delete</button></td></tr>`,
    )
    .join("");
}
async function refresh() {
  const state=$("apiState"); state.hidden=false; state.classList.remove("error"); state.textContent="Loading enquiries from FreeProjectAPI...";
  try {
    await loadMeta(true);
    await Promise.all([loadStats(),loadDash(),loadList(),loadDetail(selected)]);
    renderManage(); state.hidden=true;
  } catch(e) {
    state.hidden=false; state.classList.add("error");
    state.textContent=e.message || "Could not load data from FreeProjectAPI. Please refresh to try again.";
    $("list").innerHTML='<li class="empty">Enquiries could not be loaded. Check your connection and refresh.</li>';
  }
}
async function show(t) {
  tab = t;
  document
    .querySelectorAll("[data-tab]")
    .forEach((b) => b.setAttribute("aria-selected", b.dataset.tab === t));
  ["dash", "enq", "cat", "sta"].forEach((k) => ($("v-" + k).hidden = k !== t));
  if (t === "dash") loadDash();
  if (t === "cat" || t === "sta") {
    await loadMeta(false);
    renderManage();
  }
}

async function loadDash() {
  const r = await api("GET", "get-enquiries", null, true),
    d = r.data,
    fin = (e) => stat(e.statusId).isFinal,
    op = d.filter((e) => !fin(e)),
    od = op.filter((e) => e.overdue).length;
  const pct = d.length
      ? Math.round(((d.length - op.length) / d.length) * 100)
      : 0,
    convertedCount = d.filter((e) => e.converted).length;
  const days = Array.from({ length: 7 }, () => ({ o: 0, c: 0 }));
  d.forEach((e) => {
    const i = 6 - Math.min(6, Math.floor((Date.now() - e.created) / (24 * HR)));
    days[i][fin(e) ? "c" : "o"]++;
  });
  const tot = days.map((p) => p.o + p.c),
    max = Math.max(1, ...tot);
  const lbl = (i) =>
    new Date(Date.now() - (6 - i) * 24 * HR).toLocaleDateString("en", {
      weekday: "short",
    });
  const pts = tot
    .map((v, i) => `${(i * 100) / 6},${30 - (v / max) * 26}`)
    .join(" ");
  const card = (c, t, n, v, sub) =>
    `<div class="card sc" style="--c:${c}"><h4>${t}</h4><div class="top"><span class="n">${n}</span>${v}</div>${sub}</div>`;
  $("cards").innerHTML =
    card(
      "#f05b5b",
      "Total enquiries",
      d.length,
      `<div class="donut" style="--p:${pct}" role="img" aria-label="${pct}% completed"></div>`,
      `<small>${pct}% completed</small>`,
    ) +
    card(
      "#2f80ed",
      "Open enquiries",
      op.length,
      "",
      `<div class="bar"><i style="width:${op.length ? Math.round(((op.length - od) / op.length) * 100) : 100}%"></i></div><small>Within SLA ${op.length - od} 쨌 Overdue ${od}</small>`,
    ) +
    card(
      "#6cc644",
      "Customers",
      new Set(d.map((e) => e.email)).size,
      `<svg viewBox="0 0 100 32" width="90" height="32" aria-hidden="true"><polyline points="${pts}" fill="none" stroke="var(--c)" stroke-width="2"/></svg>`,
      `<small>${tot.reduce((a, b) => a + b, 0)} enquiries in the last 7 days</small>`,
    ) +
    card(
      "#2ecfc9",
      "Converted enquiries",
      convertedCount,
      `<div class="donut" style="--p:${d.length ? Math.round(convertedCount / d.length * 100) : 0}" role="img" aria-label="${d.length ? Math.round(convertedCount / d.length * 100) : 0}% converted"></div>`,
      `<small>${d.length ? Math.round(convertedCount / d.length * 100) : 0}% of enquiries</small>`,
    );
  $("week").innerHTML =
    `<div class="wk">${days.map((p, i) => `<div class="col"><div class="tr" title="${p.o} open, ${p.c} completed"><i style="height:${(p.o / max) * 100}%;background:var(--acc)"></i><i style="height:${(p.c / max) * 100}%;background:#2ecfc9"></i></div><small>${lbl(i)}</small></div>`).join("")}</div><p class="mute" style="margin:12px 0 0"><span class="dot" style="background:var(--acc);margin-left:0"></span>Open<span class="dot" style="background:#2ecfc9"></span>Completed</p>`;
  const ag = {};
  d.filter(fin).forEach((e) => {
    if (e.assignee) ag[e.assignee] = (ag[e.assignee] || 0) + 1;
  });
  const top = Object.entries(ag)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  $("agents").innerHTML = top.length
    ? `<div class="ag">${top.map(([n, c], i) => `<div style="background:${["#6c5ce7", "#0b8a85", "#2f6fd0"][i]}"><b>${esc(n)}</b><small>${c} resolved</small><span class="rk">${["1st", "2nd", "3rd"][i]}</span></div>`).join("")}</div>`
    : '<p class="mute">No resolved enquiries yet.</p>';
  $("recent").innerHTML = [...d]
    .sort((a, b) => b.created - a.created)
    .slice(0, 3)
    .map(
      (e) =>
        `<div class="rc"><b>${esc(e.subject)}</b> <small>${ago(e.created)}</small><br><small>${esc(e.name)} 쨌 ${esc(catName(e.categoryId))} 쨌 ${esc(stat(e.statusId).name)}</small></div>`,
    )
    .join("");
}
$("gs").onkeydown = (e) => {
  if (e.key === "Enter") {
    $("q").value = $("gs").value;
    show("enq");
    loadList();
  }
};
document.addEventListener("click", (e) => {
  const g = e.target.closest("[data-go]");
  if (g) show(g.dataset.go);
});

// ================= Events =================
document
  .querySelectorAll("[data-tab]")
  .forEach((b) => (b.onclick = () => show(b.dataset.tab)));
$("list").addEventListener("click", (e) => {
  const r = e.target.closest(".row");
  if (r) {
    selected = r.dataset.id;
    refresh();
  }
});
$("list").addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") {
    const r = e.target.closest(".row");
    if (r) {
      e.preventDefault();
      selected = r.dataset.id;
      refresh();
    }
  }
});
let tm;
$("q").oninput = () => {
  clearTimeout(tm);
  tm = setTimeout(loadList, 300);
};
["fs", "fc", "sf"].forEach((i) => ($(i).onchange = loadList));
$("rst").onclick = () => { selected = null; refresh(); toast("Data refreshed from FreeProjectAPI."); };
for (const id of ["v-cat", "v-sta"])
  $(id).addEventListener("click", (ev) => {
    const b = ev.target.closest("button");
    if (!b) return;
    if (b.dataset.new) openDlg(b.dataset.new);
    else if (b.dataset.ed) openDlg(b.dataset.ed, b.dataset.id);
    else if (b.dataset.del)
      arm(b, async () => {
        await run(() =>
          api("DELETE", "delete-" + b.dataset.del + "/" + b.dataset.id),
        );
        refresh();
      });
  });

// ================= Create / edit dialog =================
const FORMS = {
  enquiry: [
    ["name", "Name", "text"],
    ["email", "Email", "email"],
    ["phone", "Phone", "tel"],
    ["subject", "Subject", "text"],
    ["message", "Message", "textarea"],
    ["categoryId", "Category", "cat"],
    ["priority", "Priority", "pri"],
  ],
  category: [
    ["name", "Name", "text"],
    ["description", "Description", "text"],
  ],
  status: [
    ["name", "Name", "text"],
    ["order", "Position in workflow", "number"],
    ["color", "Colour", "color"],
    ["isFinal", "Stops the SLA clock (work is done)", "check"],
  ],
};
function fieldHtml([k, l, t], v) {
  const id = "f_" + k;
  if (t === "check")
    return `<label class="chk"><input type="checkbox" id="${id}" ${v ? "checked" : ""}> ${l}</label>`;
  let c;
  if (t === "textarea")
    c = `<textarea id="${id}" rows="4">${esc(v)}</textarea>`;
  else if (t === "cat")
    c = `<select id="${id}">${cats.map((x) => `<option value="${x.id}" ${x.id === v ? "selected" : ""}>${esc(x.name)}</option>`).join("")}</select>`;
  else if (t === "pri")
    c = `<select id="${id}">${["high", "normal", "low"].map((x) => `<option ${x === v ? "selected" : ""}>${x}</option>`).join("")}</select>`;
  else c = `<input id="${id}" type="${t}" value="${esc(v)}">`;
  return `<label for="${id}">${l}</label>${c}`;
}
let ed = null;
function openDlg(type, id) {
  ed = { type, id };
  const cur = id
    ? (type === "category" ? cats : sts).find((x) => x.id === id)
    : {
        priority: "normal",
        categoryId: cats[0] && cats[0].id,
        order: sts.length + 1,
        color: "#6b7688",
        isFinal: false,
      };
  $("dt").textContent = (id ? "Edit " : "New ") + type;
  $("dfields").innerHTML = FORMS[type]
    .map((f) => fieldHtml(f, cur[f[0]] ?? ""))
    .join("");
  $("derr").textContent = "";
  $("dlg").showModal();
  $("dfields").querySelector("input,select,textarea").focus();
}
$("newBtn").onclick = async () => {
  if (!cats.length) await loadMeta(true);
  openDlg("enquiry");
};
$("cancel").onclick = () => $("dlg").close();
$("save").onclick = async () => {
  const body = {};
  FORMS[ed.type].forEach(([k, , t]) => {
    const el = $("f_" + k);
    body[k] =
      t === "check" ? el.checked : t === "number" ? Number(el.value) : el.value;
  });
  try {
    const r = await api(
      ed.id ? "PUT" : "POST",
      (ed.id ? "update-" : "create-") + ed.type + (ed.id ? "/" + ed.id : ""),
      body,
    );
    $("dlg").close();
    if (ed.type === "enquiry") {
      selected = r.id;
      await show("enq");
    }
    refresh();
  } catch (x) {
    $("derr").textContent = x.out
      ? msgFor(x.out)
      : "Something went wrong. Try again.";
  }
};

$("today").textContent = new Date().toLocaleDateString("en", {
  weekday: "long",
  day: "numeric",
  month: "long",
});
refresh();
