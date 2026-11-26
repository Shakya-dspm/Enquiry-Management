const API_BASE = typeof location !== "undefined" && /^(localhost|127\.0\.0\.1)$/.test(location.hostname) && location.port === "8080"
  ? "/api/Enquiry"
  : "https://api.freeprojectapi.com/api/Enquiry";
const $ = (id) => document.getElementById(id);
const esc = (value) => String(value ?? "").replace(/[&<>\"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);
const dateText = (value) => { if (!value) return "Not provided"; const date = new Date(value); return Number.isNaN(date.getTime()) ? "Date unavailable" : date.toLocaleString(); };
const dateInput = (value) => { if (!value) return ""; const date = new Date(value); return Number.isNaN(date.getTime()) ? "" : new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const ago = (value) => {
  const time = new Date(value).getTime();
  if (!value || !Number.isFinite(time)) return "Not provided";
  const days = Math.floor((Date.now() - time) / 86400000);
  return days < 0 ? (days === -1 ? "Tomorrow" : `In ${Math.abs(days)} days`) : days === 0 ? "Today" : days === 1 ? "1 day ago" : `${days} days ago`;
};
function mapEnquiry(row) {
  return {
    id: String(row.enquiryId ?? row.id ?? ""),
    name: row.customerName ?? "Unknown customer",
    email: row.customerEmail ?? "",
    phone: row.customerPhone ?? "",
    message: row.message ?? "",
    categoryId: String(row.categoryId ?? ""),
    categoryName: row.categoryName ?? "Uncategorised",
    statusId: String(row.statusId ?? ""),
    statusName: row.statusName ?? "Unknown status",
    enquiryType: row.enquiryType ?? "",
    converted: Boolean(row.isConverted),
    created: row.enquiryDate ?? null,
    followUp: row.followUpDate ?? null,
    feedback: row.feedback ?? "",
  };
}
async function api(method, path, body, quiet) {
  const [route] = path.split("?"), [action, id] = route.split("/");
  const endpoints = {
    "get-enquiries": "get-enquiries", "get-enquiry": `get-enquiry/${id}`,
    "get-categories": "get-categories", "get-statuses": "get-statuses",
    "create-enquiry": "create-enquiry", "update-enquiry": `update-enquiry/${id}`,
    "delete-enquiry": `delete-enquiry/${id}`,
    "create-category": "create-category", "update-category": `update-category/${id}`,
    "delete-category": `delete-category/${id}`,
    "create-status": "create-status", "update-status": `update-status/${id}`,
    "delete-status": `delete-status/${id}`,
  };
  const endpoint = endpoints[action];
  if (!endpoint) throw new Error(`Unsupported API operation: ${action}`);
  let payload = body;
  if (body && action.includes("enquiry")) {
    payload = {};
    if (action === "create-enquiry") {
      const newStatus = statuses.find((s) => s.isActive && s.name.toLowerCase() === "new") || statuses.find((s) => s.isActive);
      Object.assign(payload, {
        customerName: body.name,
        customerEmail: body.email || null,
        customerPhone: body.phone || null,
        message: body.message || null,
        categoryId: body.categoryId ? Number(body.categoryId) : null,
        statusId: newStatus ? Number(newStatus.id) : null,
        enquiryType: body.enquiryType || "",
        isConverted: false,
        enquiryDate: new Date().toISOString(),
        followUpDate: body.followUp || null,
      });
    } else {
      // The API update model requires customerName, enquiryDate, isConverted,
      // and statusId on every PUT, so send the complete record rather than a patch.
      if ("name" in body) payload.customerName = body.name;
      if ("email" in body) payload.customerEmail = body.email || null;
      if ("phone" in body) payload.customerPhone = body.phone || null;
      if ("message" in body) payload.message = body.message || null;
      if ("enquiryType" in body) payload.enquiryType = body.enquiryType || null;
      if ("converted" in body) payload.isConverted = Boolean(body.converted);
      if ("created" in body) payload.enquiryDate = body.created;
      if ("categoryId" in body) payload.categoryId = body.categoryId ? Number(body.categoryId) : null;
      if ("statusId" in body) payload.statusId = Number(body.statusId);
      if ("followUp" in body) payload.followUpDate = body.followUp || null;
      if ("feedback" in body) payload.feedback = body.feedback || null;
    }
  } else if (body && action.includes("category")) {
    payload = {};
    if ("name" in body) payload.categoryName = body.name;
    if ("isActive" in body) payload.isActive = Boolean(body.isActive);
  } else if (body && action.includes("status")) {
    payload = {};
    if ("name" in body) payload.statusName = body.name;
    if ("isActive" in body) payload.isActive = Boolean(body.isActive);
  }
  const started = performance.now();
  let response;
  try {
    response = await fetch(`${API_BASE}/${endpoint}`, {
      method,
      headers: { Accept: "application/json", ...(method !== "GET" ? { "Content-Type": "application/json" } : {}) },
      ...(method !== "GET" ? { body: JSON.stringify(payload ?? {}) } : {}),
    });
  } catch {
    throw new Error("The browser could not reach FreeProjectAPI. Check your internet connection and whether the API is available; if the browser reports a CORS error, the API provider must allow this site's origin.");
  }
  let raw = null;
  if (response.status !== 204) { try { raw = await response.json(); } catch {} }
  if (!response.ok || raw?.result === false) {
    const detail = raw?.message || raw?.error?.filter?.(Boolean).join(", ");
    throw Object.assign(new Error(`${method} ${endpoint}: ${detail || `API request failed (${response.status})`}`), { out: raw });
  }
  let data = raw?.data ?? raw;
  if (action === "get-enquiries") data = (Array.isArray(data) ? data : []).map(mapEnquiry);
  if (action === "get-enquiry") data = mapEnquiry(data || {});
  if ((action === "create-enquiry" || action === "update-enquiry") && data && (data.enquiryId != null || data.id != null)) data = mapEnquiry(data);
  if (action === "get-categories") data = (Array.isArray(data) ? data : []).map((item) => ({
    id: String(item.categoryId), name: item.categoryName ?? "Unnamed category",
    isActive: Boolean(item.isActive), enquiries: 0,
  }));
  if (action === "get-statuses") data = (Array.isArray(data) ? data : []).map((item) => ({
    id: String(item.statusId), name: item.statusName ?? "Unnamed status",
    isActive: Boolean(item.isActive), enquiries: 0,
  }));
  if (!quiet) logCall(method, endpoint, body, response.status, raw, Math.round(performance.now() - started));
  return action === "get-enquiries" ? { data, total: data.length } : data;
}
// ================= Console, helpers =================
function logCall(method, path, body, status, output, ms) {
  const row = document.createElement("div");
  row.className = "call";
  const responseText = output === null ? "(no content)" : JSON.stringify(output, null, 2);
  row.innerHTML = `<div class="l"><span class="m ${esc(method)}">${esc(method)}</span><span>/api/Enquiry/${esc(path)}</span><span class="${status < 400 ? "ok" : "bad"}">${status}</span><span class="ms">${ms} ms</span></div>${body && Object.keys(body).length ? `<pre>${esc(JSON.stringify(body))}</pre>` : ""}<pre>${esc(responseText.length > 900 ? responseText.slice(0, 900) + "..." : responseText)}</pre>`;
  $("log").prepend(row);
  while ($("log").children.length > 25) $("log").lastChild.remove();
}
$("clr").onclick = () => { $("log").innerHTML = ""; };
let toastTimer;
function toast(message) {
  const node = $("toast"); node.textContent = message; node.classList.add("on");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => node.classList.remove("on"), 4000);
}
function errorText(error) { return error?.message || error?.out?.message || "Something went wrong. Try again."; }
function arm(button, action) {
  if (button.dataset.armed) { action(); return; }
  button.dataset.armed = "1"; const label = button.textContent; button.textContent = "Confirm delete";
  setTimeout(() => { delete button.dataset.armed; button.textContent = label; }, 3000);
}

let categories = [], statuses = [], enquiries = [], selected = null;
const labelFor = (items, item) => items.filter((candidate) => candidate.name === item.name).length > 1 ? `${item.name} (ID ${item.id})` : item.name;
const statusFor = (id) => statuses.find((item) => item.id === String(id)) || { id: String(id), name: "Unknown status", isActive: false };
const statusLabel = (id) => labelFor(statuses, statusFor(id));
const categoryFor = (id, fallback = "Uncategorised") => { const item = categories.find((entry) => entry.id === String(id)); return item ? labelFor(categories, item) : fallback; };
const tag = (name, active = true) => `<span class="tag"><i style="background:${active ? "#17855a" : "#8a93a3"}"></i>${esc(name)}</span>`;
const initials = (name) => String(name || "?").split(/\s+/).map((word) => word[0]).slice(0, 2).join("").toUpperCase();
const options = (items, allLabel) => (allLabel ? `<option value="">${allLabel}</option>` : "") + items.map((item) => `<option value="${esc(item.id)}">${esc(labelFor(items, item))}</option>`).join("");
function setOptions(id, html) { const old = $(id).value; $(id).innerHTML = html; $(id).value = old; }
async function loadMeta() {
  const [categoryResponse, statusResponse] = await Promise.all([api("GET", "get-categories", null, true), api("GET", "get-statuses", null, true)]);
  // Metadata endpoints return their arrays directly; only get-enquiries wraps
  // the result as { data, total }.
  categories = Array.isArray(categoryResponse) ? categoryResponse : [];
  statuses = Array.isArray(statusResponse) ? statusResponse : [];
  setOptions("fs", options(statuses, "All statuses"));
  setOptions("fc", options(categories, "All categories"));
}
function updateCounts() {
  const categoryCounts = new Map(), statusCounts = new Map();
  enquiries.forEach((item) => {
    categoryCounts.set(item.categoryId, (categoryCounts.get(item.categoryId) || 0) + 1);
    statusCounts.set(item.statusId, (statusCounts.get(item.statusId) || 0) + 1);
  });
  categories.forEach((item) => item.enquiries = categoryCounts.get(item.id) || 0);
  statuses.forEach((item) => item.enquiries = statusCounts.get(item.id) || 0);
}
function renderStats() {
  const converted = enquiries.filter((item) => item.converted).length;
  const uniqueCustomers = new Set(enquiries.map((item) => item.email.toLowerCase()).filter(Boolean)).size;
  const items = [["Enquiries", enquiries.length], ["Converted", converted], ["Customers with email", uniqueCustomers], ["Categories", categories.length]];
  $("stats").innerHTML = items.map(([label, value]) => `<div class="stat"><b>${value}</b><small>${esc(label)}</small></div>`).join("");
}
function renderList() {
  const query = $("q").value.trim().toLowerCase(), statusId = $("fs").value, categoryId = $("fc").value;
  const rows = enquiries.filter((item) => (!statusId || item.statusId === statusId) && (!categoryId || item.categoryId === categoryId) && (!query || `${item.name} ${item.email} ${item.message} ${item.enquiryType}`.toLowerCase().includes(query)));
  rows.sort((a, b) => {
    if ($("sf").value === "oldest") return new Date(a.created || 0) - new Date(b.created || 0);
    if ($("sf").value === "followup") return new Date(a.followUp || "9999-12-31") - new Date(b.followUp || "9999-12-31");
    return new Date(b.created || 0) - new Date(a.created || 0);
  });
  $("list").innerHTML = rows.length ? rows.map((item) => `<li class="row" tabindex="0" role="option" aria-selected="${item.id === selected}" data-id="${esc(item.id)}"><span class="av sm" aria-hidden="true">${esc(initials(item.name))}</span><div class="rb"><div class="top"><b>${esc(item.name)}</b><span>${tag(statusLabel(item.statusId), statusFor(item.statusId).isActive)}</span></div><small>${esc(item.message || "No message provided")}<br>${esc(categoryFor(item.categoryId, item.categoryName))} | ${ago(item.created)}${item.enquiryType ? ` | ${esc(item.enquiryType)}` : ""}</small></div></li>`).join("") : '<li class="empty">No enquiries match these filters.</li>';
}
const enquiryUpdateBody = (item, changes = {}) => ({
  name: item.name, email: item.email, phone: item.phone, message: item.message,
  enquiryType: item.enquiryType, converted: item.converted, created: item.created,
  categoryId: item.categoryId, statusId: item.statusId, followUp: item.followUp,
  feedback: item.feedback, ...changes,
});
async function loadDetail(id) {
  if (!id) { $("detail").innerHTML = '<div class="empty">Select an enquiry to see the customer details.</div>'; return; }
  let item;
  try { item = await api("GET", `get-enquiry/${encodeURIComponent(id)}`, null, true); }
  catch (error) { $("detail").innerHTML = `<div class="empty">${esc(errorText(error))}</div>`; return; }

  const statusOptions = statuses.filter((option) => option.isActive || option.id === item.statusId);
  $("detail").innerHTML = `<div class="detail"><h2>Enquiry #${esc(item.id)}</h2>
    <p class="meta">Received ${esc(dateText(item.created))}</p>
    <div class="msg">${esc(item.message || "No message provided")}</div>
    <dl class="record-fields"><div><dt>Customer</dt><dd>${esc(item.name)}</dd></div><div><dt>Email</dt><dd>${item.email ? `<a href="mailto:${esc(item.email)}">${esc(item.email)}</a>` : "Not provided"}</dd></div><div><dt>Phone</dt><dd>${item.phone ? `<a href="tel:${esc(item.phone)}">${esc(item.phone)}</a>` : "Not provided"}</dd></div><div><dt>Enquiry type</dt><dd>${esc(item.enquiryType || "Not provided")}</dd></div><div><dt>Converted</dt><dd>${item.converted ? "Yes" : "No"}</dd></div><div><dt>Follow-up date</dt><dd>${esc(dateText(item.followUp))}</dd></div></dl>
    <div class="ctl"><label for="detailCategory">Category</label><select id="detailCategory"><option value="">Unassigned</option>${categories.map((option) => `<option value="${esc(option.id)}" ${option.id === item.categoryId ? "selected" : ""}>${esc(labelFor(categories, option))}${option.isActive ? "" : " (inactive)"}</option>`).join("")}</select><label for="detailStatus">Status</label><select id="detailStatus">${statusOptions.map((option) => `<option value="${esc(option.id)}" ${option.id === item.statusId ? "selected" : ""}>${esc(labelFor(statuses, option))}</option>`).join("")}</select><label for="detailFollowUp">Follow-up date</label><input id="detailFollowUp" type="datetime-local" value="${dateInput(item.followUp)}"><button class="pri" id="updateEnquiry">Save changes</button><button class="dan" id="deleteEnquiry">Delete</button></div>
    <h3>Customer feedback</h3><p class="meta">${esc(item.feedback || "No feedback recorded.")}</p><textarea id="feedback" rows="3" maxlength="500" placeholder="Record customer feedback">${esc(item.feedback)}</textarea><button class="pri" id="saveFeedback">Save feedback</button></div>`;
  $("updateEnquiry").onclick = async () => {
    try { await api("PUT", `update-enquiry/${encodeURIComponent(item.id)}`, enquiryUpdateBody(item, { categoryId: $("detailCategory").value, statusId: $("detailStatus").value, followUp: $("detailFollowUp").value })); await refresh(item.id); toast("Enquiry updated."); }
    catch (error) { toast(errorText(error)); }
  };
  $("saveFeedback").onclick = async () => {
    try { await api("PUT", `update-enquiry/${encodeURIComponent(item.id)}`, enquiryUpdateBody(item, { feedback: $("feedback").value })); await refresh(item.id); toast("Feedback saved."); }
    catch (error) { toast(errorText(error)); }
  };
  $("deleteEnquiry").onclick = (event) => arm(event.currentTarget, async () => {
    try { await api("DELETE", `delete-enquiry/${encodeURIComponent(item.id)}`); selected = null; await refresh(); toast("Enquiry deleted."); }
    catch (error) { toast(errorText(error)); }
  });
}
function renderManage() {
  $("catBody").innerHTML = categories.length ? categories.map((item) => `<tr><td>${esc(labelFor(categories, item))}</td><td>${item.isActive ? "Yes" : "No"}</td><td>${item.enquiries}</td><td class="ra"><button data-ed="category" data-id="${esc(item.id)}">Edit</button> <button class="dan" data-del="category" data-id="${esc(item.id)}">Delete</button></td></tr>`).join("") : '<tr><td colspan="4" class="empty">No categories returned by the API.</td></tr>';
  $("staBody").innerHTML = statuses.length ? statuses.map((item) => `<tr><td>${tag(labelFor(statuses, item), item.isActive)}</td><td>${item.isActive ? "Yes" : "No"}</td><td>${item.enquiries}</td><td class="ra"><button data-ed="status" data-id="${esc(item.id)}">Edit</button> <button class="dan" data-del="status" data-id="${esc(item.id)}">Delete</button></td></tr>`).join("") : '<tr><td colspan="4" class="empty">No statuses returned by the API.</td></tr>';
}
function renderDashboard() {
  const converted = enquiries.filter((item) => item.converted).length;
  const customers = new Set(enquiries.map((item) => item.email.toLowerCase()).filter(Boolean)).size;
  const pastFollowUps = enquiries.filter((item) => !item.converted && item.followUp && new Date(item.followUp).getTime() < Date.now()).length;
  const cards = [["#f05b5b", "Enquiries", enquiries.length], ["#2f80ed", "Converted", converted], ["#6cc644", "Customers with email", customers], ["#d98a00", "Past follow-up dates", pastFollowUps]];
  $("cards").innerHTML = cards.map(([color, label, count]) => `<div class="card sc" style="--c:${color}"><h4>${label}</h4><div class="top"><span class="n">${count}</span></div><small>Current API records</small></div>`).join("");
  const days = Array.from({ length: 7 }, (_, index) => ({ label: new Date(Date.now() - (6 - index) * 86400000).toLocaleDateString("en", { weekday: "short" }), count: 0 }));
  enquiries.forEach((item) => { const age = Math.floor((Date.now() - new Date(item.created).getTime()) / 86400000); if (age >= 0 && age < 7) days[6 - age].count++; });
  const maximum = Math.max(1, ...days.map((day) => day.count));
  $("week").innerHTML = `<div class="wk">${days.map((day) => `<div class="col"><div class="tr" title="${day.count} enquiries"><i style="height:${(day.count / maximum) * 100}%;background:var(--acc)"></i></div><small>${day.label}</small></div>`).join("")}</div><p class="mute">Counted by enquiryDate.</p>`;
  const grouped = new Map();
  enquiries.forEach((item) => { const name = categoryFor(item.categoryId, item.categoryName); grouped.set(name, (grouped.get(name) || 0) + 1); });
  const topCategories = [...grouped].sort((a, b) => b[1] - a[1]).slice(0, 5);
  $("categoryCounts").innerHTML = topCategories.length ? `<div class="category-breakdown">${topCategories.map(([name, count]) => `<div><span>${esc(name)}</span><b>${count}</b></div>`).join("")}</div>` : '<p class="mute">No category counts available.</p>';
  $("recent").innerHTML = [...enquiries].sort((a, b) => new Date(b.created || 0) - new Date(a.created || 0)).slice(0, 4).map((item) => `<div class="rc"><b>${esc(item.name)}</b> <small>${ago(item.created)}</small><br><small>${esc(item.message || "No message provided")} | ${esc(categoryFor(item.categoryId, item.categoryName))} | ${esc(statusLabel(item.statusId))}</small></div>`).join("") || '<p class="mute">No enquiries returned by the API.</p>';
}
async function refresh(keepSelected = selected) {
  const state = $("apiState"); state.hidden = false; state.classList.remove("error"); state.textContent = "Loading data from FreeProjectAPI...";
  try {
    const [, result] = await Promise.all([loadMeta(), api("GET", "get-enquiries", null, true)]);
    enquiries = result.data; selected = keepSelected; updateCounts();
    renderStats(); renderDashboard(); renderList(); renderManage(); await loadDetail(selected);
    state.hidden = true;
  } catch (error) {
    state.hidden = false; state.classList.add("error"); state.textContent = errorText(error);
    $("list").innerHTML = '<li class="empty">Enquiries could not be loaded. Check the connection and refresh.</li>';
  }
}
function show(tab) {
  document.querySelectorAll("[data-tab]").forEach((button) => button.setAttribute("aria-selected", button.dataset.tab === tab));
  ["dash", "enq", "cat", "sta"].forEach((key) => { $("v-" + key).hidden = key !== tab; });
  const pages = {
    dash: ["Enquiry overview", new Date().toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long" })],
    enq: ["Enquiries", "Search, filter and update customer enquiries"],
    cat: ["Categories", "Organize enquiries with the categories provided by the API"],
    sta: ["Statuses", "Manage the status labels available in the API"],
  };
  $("pageTitle").textContent = pages[tab][0];
  $("today").textContent = pages[tab][1];
}
$("gs").onkeydown = (event) => { if (event.key === "Enter") { $("q").value = $("gs").value; show("enq"); renderList(); } };
document.addEventListener("click", (event) => { const link = event.target.closest("[data-go]"); if (link) show(link.dataset.go); });
document.querySelectorAll("[data-tab]").forEach((button) => { button.onclick = () => show(button.dataset.tab); });
$("list").addEventListener("click", (event) => { const row = event.target.closest(".row"); if (row) { selected = row.dataset.id; renderList(); loadDetail(selected); } });
$("list").addEventListener("keydown", (event) => { if (event.key === "Enter" || event.key === " ") { const row = event.target.closest(".row"); if (row) { event.preventDefault(); selected = row.dataset.id; renderList(); loadDetail(selected); } } });
let searchTimer;
$("q").oninput = () => { clearTimeout(searchTimer); searchTimer = setTimeout(renderList, 200); };
["fs", "fc", "sf"].forEach((id) => { $(id).onchange = renderList; });
$("rst").onclick = () => refresh(null);
for (const viewId of ["v-cat", "v-sta"]) $(viewId).addEventListener("click", async (event) => {
  const button = event.target.closest("button"); if (!button) return;
  if (button.dataset.new) { openDialog(button.dataset.new); return; }
  const type = button.dataset.ed || button.dataset.del;
  if (button.dataset.ed) { openDialog(type, button.dataset.id); return; }
  if (button.dataset.del) arm(button, async () => { try { await api("DELETE", `delete-${type}/${button.dataset.id}`); await refresh(); } catch (error) { toast(errorText(error)); } });
});
const forms = {
  enquiry: [["name", "Customer name", "text"], ["email", "Email", "email"], ["phone", "Phone", "tel"], ["message", "Message", "textarea"], ["enquiryType", "Enquiry type", "text"], ["followUp", "Follow-up date", "datetime-local"], ["categoryId", "Category", "category"]],
  category: [["name", "Category name", "text"], ["isActive", "Active", "check"]],
  status: [["name", "Status name", "text"], ["isActive", "Active", "check"]],
};
let editing = null;
function fieldMarkup([key, label, type], value) {
  const id = `field_${key}`;
  if (type === "check") return `<label class="chk"><input id="${id}" type="checkbox" ${value ? "checked" : ""}> ${label}</label>`;
  if (type === "textarea") return `<label for="${id}">${label}</label><textarea id="${id}" rows="4">${esc(value)}</textarea>`;
  if (type === "category") return `<label for="${id}">${label}</label><select id="${id}"><option value="">Unassigned</option>${categories.filter((item) => item.isActive || item.id === value).map((item) => `<option value="${esc(item.id)}" ${item.id === value ? "selected" : ""}>${esc(item.name)}</option>`).join("")}</select>`;
  const constraints = key === "name" ? ` required minlength="${editing.type === "enquiry" ? 2 : 1}" maxlength="${editing.type === "enquiry" ? 150 : 100}"` : key === "email" ? ' maxlength="150"' : key === "phone" ? ' maxlength="50"' : key === "message" ? ' minlength="10" maxlength="2000"' : key === "enquiryType" ? ' maxlength="100"' : "";
  return `<label for="${id}">${label}</label><input id="${id}" type="${type}" value="${esc(value)}"${constraints}>`;
}
function openDialog(type, id = null) {
  const collection = type === "category" ? categories : statuses;
  const current = id ? collection.find((item) => item.id === id) : { isActive: true, categoryId: "" };
  editing = { type, id };
  $("dt").textContent = `${id ? "Edit" : "New"} ${type}`;
  $("dfields").innerHTML = forms[type].map((field) => fieldMarkup(field, current[field[0]] ?? "")).join("");
  $("derr").textContent = ""; $("dlg").showModal(); $("dfields").querySelector("input,select,textarea")?.focus();
}
$("newBtn").onclick = () => openDialog("enquiry");
$("cancel").onclick = () => $("dlg").close();
$("save").onclick = async () => {
  if (!$("frm").reportValidity()) return;
  if (editing.type === "enquiry" && !statuses.some((status) => status.isActive)) {
    $("derr").textContent = "The API has no active status available for a new enquiry. Activate a status and try again.";
    return;
  }
  const body = {};
  forms[editing.type].forEach(([key, , type]) => { const field = $("field_" + key); body[key] = type === "check" ? field.checked : field.value; });
  try {
    const result = await api(editing.id ? "PUT" : "POST", `${editing.id ? "update-" : "create-"}${editing.type}${editing.id ? "/" + editing.id : ""}`, body);
    $("dlg").close(); await refresh(editing.type === "enquiry" ? result?.id : selected);
  } catch (error) { $("derr").textContent = errorText(error); }
};
$("today").textContent = new Date().toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long" });
refresh();
