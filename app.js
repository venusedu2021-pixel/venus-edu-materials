let MANIFEST = null;      // butun daraxt (root)
let currentPath = [];      // [{name, node}, ...] root'dan hozirgi joygacha

const contentEl = () => document.getElementById("content");
const breadcrumbEl = () => document.getElementById("breadcrumb");
const backBtn = () => document.getElementById("back-btn");

function buildKey(names) {
  return "unlocked:" + names.join("/");
}

function isUnlocked(names) {
  return sessionStorage.getItem(buildKey(names)) === "1";
}

function markUnlocked(names) {
  sessionStorage.setItem(buildKey(names), "1");
}

function emojiFor(node) {
  if (node.kind === "folder") {
    if (node.password_hash) return "🔒";
    const n = node.name.toLowerCase();
    if (n.includes("audio") || n.includes("tinglash")) return "🎧";
    if (n.includes("video")) return "🎬";
    if (n.includes("pdf") || n.includes("book") || n.includes("kitob")) return "📕";
    if (n.includes("test")) return "📝";
    if (n.includes("teacher") || n.includes("o'qituvch") || n.includes("o‘qituvch") || n.includes("ustoz")) return "👨‍🏫";
    if (n.includes("pack")) return "📦";
    return "📁";
  }
  return { document: "📄", audio: "🎵", video: "🎬", photo: "🖼" }[node.kind] || "📄";
}

async function sha256Hex(text) {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest("SHA-256", enc);
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function humanSize(mb) {
  if (mb < 1) return Math.round(mb * 1024) + " KB";
  return mb.toFixed(1) + " MB";
}

function renderBreadcrumb() {
  const bc = breadcrumbEl();
  bc.innerHTML = currentPath
    .map((p, i) => {
      const label = i === 0 ? "🏠 " + p.name : emojiFor(p.node) + " " + p.name;
      return `<span class="crumb" data-i="${i}">${label}</span>`;
    })
    .join('<span class="sep">›</span>');
  bc.querySelectorAll(".crumb").forEach((el) => {
    el.onclick = () => goTo(parseInt(el.dataset.i, 10));
  });
  backBtn().disabled = currentPath.length <= 1;
}

function goTo(index) {
  currentPath = currentPath.slice(0, index + 1);
  render();
}

function goBack() {
  if (currentPath.length > 1) goTo(currentPath.length - 2);
}

function openFolder(node) {
  const names = currentPath.map((p) => p.name).concat(node.name);
  currentPath.push({ name: node.name, node });
  if (node.password_hash && !isUnlocked(names)) {
    renderPasswordGate(node, names);
    return;
  }
  render();
}

function renderPasswordGate(node, names) {
  renderBreadcrumb();
  contentEl().innerHTML = `
    <div class="password-gate">
      <div class="lock-icon">🔒</div>
      <p><b>${node.name}</b> bo'limi parol bilan himoyalangan</p>
      <input type="password" id="pw-input" placeholder="Parolni kiriting">
      <div><button id="pw-submit">Kirish</button></div>
      <p id="pw-error" class="error"></p>
    </div>`;
  const submit = async () => {
    const val = document.getElementById("pw-input").value;
    const hash = await sha256Hex(val);
    if (hash === node.password_hash) {
      markUnlocked(names);
      render();
    } else {
      document.getElementById("pw-error").textContent = "Parol noto'g'ri, qaytadan urinib ko'ring";
    }
  };
  document.getElementById("pw-submit").onclick = submit;
  document.getElementById("pw-input").addEventListener("keydown", (e) => {
    if (e.key === "Enter") submit();
  });
}

function fileRow(f) {
  const row = document.createElement("div");
  const pathHtml = f.pathLabel ? `<div class="path">${f.pathLabel}</div>` : "";
  const header = `<span class="icon">${emojiFor(f)}</span><span class="name">${f.name}${pathHtml}</span><span class="size">${humanSize(f.size_mb)}</span>`;

  if (f.kind === "audio" || f.kind === "video" || f.kind === "photo") {
    // Audio/video/rasm - to'g'ridan-to'g'ri shu sahifada eshitish/ko'rish mumkin, yuklab olish shart emas
    row.className = "file-row file-row-media";
    let mediaHtml = "";
    if (f.kind === "audio") mediaHtml = `<audio controls preload="none" src="${f.url}"></audio>`;
    if (f.kind === "video") mediaHtml = `<video controls preload="none" src="${f.url}"></video>`;
    if (f.kind === "photo") mediaHtml = `<img class="inline-photo" src="${f.url}" alt="${f.name}">`;
    row.innerHTML = `<div class="row-header">${header}</div>${mediaHtml}`;
    return row;
  }

  // Hujjat (PDF va h.k.). Kichik fayllar ("inline": true) to'g'ridan-to'g'ri
  // GitHub Pages orqali beriladi - u yerda "yuklab olishga majburlash"
  // belgisi yo'q, shuning uchun oddiy <a href target="_blank"> havolasi
  // barcha brauzerlarda (jumladan iOS Safari'da ham) faylni to'g'ridan-to'g'ri
  // ochadi, hech qanday tashqi "viewer" xizmati kerak emas. Katta fayllar
  // GitHub Releases'da qoladi - u yerda fayl har doim "yuklab olish" sifatida
  // beriladi, shuning uchun ular uchun faqat yuklab olish tugmasi ko'rsatiladi.
  row.className = "file-row";
  if (f.inline) {
    row.innerHTML = `${header}<span class="actions"><a class="view-btn" href="${f.url}" target="_blank" rel="noopener">👁 Ko'rish</a><a class="dl-link" href="${f.url}" download rel="noopener" title="Yuklab olish">⬇</a></span>`;
  } else {
    row.innerHTML = `${header}<span class="actions"><a class="view-btn" href="${f.url}" target="_blank" rel="noopener">⬇ Yuklab olish</a></span>`;
  }
  return row;
}

function render() {
  const currentNode = currentPath[currentPath.length - 1].node;
  document.getElementById("search").value = "";
  renderBreadcrumb();
  const content = contentEl();
  content.innerHTML = "";

  if (currentNode.cover_url) {
    const img = document.createElement("img");
    img.src = currentNode.cover_url;
    img.className = "cover";
    img.alt = currentNode.name;
    content.appendChild(img);
  }

  const children = currentNode.children || [];
  if (children.length === 0) {
    content.innerHTML += '<p class="empty">Bu yerda hali hech narsa yo\'q</p>';
    return;
  }

  const folders = children.filter((c) => c.kind === "folder");
  const files = children.filter((c) => c.kind !== "folder");

  if (folders.length) {
    const grid = document.createElement("div");
    grid.className = "folder-grid";
    folders.forEach((f) => {
      const card = document.createElement("div");
      card.className = "folder-card";
      card.innerHTML = `<span class="icon">${emojiFor(f)}</span><span class="name">${f.name}</span>`;
      card.onclick = () => openFolder(f);
      grid.appendChild(card);
    });
    content.appendChild(grid);
  }

  if (files.length) {
    const list = document.createElement("div");
    list.className = "file-list";
    files.forEach((f) => list.appendChild(fileRow(f)));
    content.appendChild(list);
  }
}

function onSearch(e) {
  const q = e.target.value.trim().toLowerCase();
  if (!q) {
    render();
    return;
  }
  const results = [];
  function walk(node, names, labels) {
    (node.children || []).forEach((c) => {
      if (c.kind === "folder") {
        const childNames = names.concat(c.name);
        if (c.password_hash && !isUnlocked(childNames)) return; // qulflangan joyni qidiruvda ko'rsatmaymiz
        walk(c, childNames, labels.concat(c.name));
      } else if (c.name.toLowerCase().includes(q)) {
        results.push(Object.assign({}, c, { pathLabel: labels.join(" / ") }));
      }
    });
  }
  walk(MANIFEST, [MANIFEST.name], []);

  breadcrumbEl().innerHTML = `<span class="crumb">🔍 Qidiruv natijalari (${results.length})</span>`;
  backBtn().disabled = false;
  const content = contentEl();
  content.innerHTML = "";
  if (!results.length) {
    content.innerHTML = '<p class="empty">Hech narsa topilmadi</p>';
    return;
  }
  const list = document.createElement("div");
  list.className = "file-list";
  results.forEach((f) => list.appendChild(fileRow(f)));
  content.appendChild(list);
}

async function init() {
  try {
    const res = await fetch("materials.json", { cache: "no-store" });
    const data = await res.json();
    MANIFEST = data.root;
  } catch (e) {
    contentEl().innerHTML = '<p class="empty">Ma\'lumotlarni yuklab bo\'lmadi. Birozdan so\'ng qayta urinib ko\'ring.</p>';
    return;
  }
  currentPath = [{ name: MANIFEST.name, node: MANIFEST }];
  render();
  document.getElementById("search").addEventListener("input", onSearch);
  backBtn().addEventListener("click", goBack);
}

init();
