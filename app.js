import { api } from "/api.js";
import { categories, statuses } from "/constants.js";

const appRoot = document.querySelector("#app");
const toastRegion = document.querySelector("#toast-region");
let currentUser = null;
let routeVersion = 0;
let searchResults = [];
let lastSearchQuery = null;
let reportDetail = null;
let staffReports = [];
let dashboardData = null;

const icons = {
  home: '<path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  file: '<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6M8 13h8M8 17h8"/>',
  box: '<path d="m12 3 9 5-9 5-9-5z"/><path d="M3 8v9l9 5 9-5V8M12 13v9"/>',
  check: '<path d="m5 12 4 4L19 6"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M5 21v-2a7 7 0 0 1 14 0v2"/>',
  logout: '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
  arrow: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  shield: '<path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11"/><path d="m9 12 2 2 4-4"/>',
  clock: '<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  pin: '<path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z"/><circle cx="12" cy="10" r="2"/>',
  eye: '<path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="m3 3 18 18M10.6 10.6a2 2 0 0 0 2.8 2.8"/><path d="M9.9 5.2A11 11 0 0 1 12 5c6.5 0 10 7 10 7a15.5 15.5 0 0 1-3 3.8M6.2 6.2C3.4 8 2 12 2 12s3.5 7 10 7a10 10 0 0 0 3-.5"/>',
  menu: '<path d="M4 6h16M4 12h16M4 18h16"/>',
  close: '<path d="m18 6-12 12M6 6l12 12"/>',
  mail: '<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
  phone: '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.4 19.4 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7l.5 3a2 2 0 0 1-.6 1.7L7.7 9.7a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 1.7-.6l3 .5a2 2 0 0 1 1.3 2.6Z"/>',
  spark: '<path d="m12 3 1.9 5.8L20 11l-6.1 2.2L12 19l-1.9-5.8L4 11l6.1-2.2L12 3Z"/><path d="m19 14 1 3 3 1-3 1-1 3-1-3-3-1 3-1 1-3Z"/>',
};

const icon = (name, className = "") => `<svg class="icon ${className}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.box}</svg>`;
const escapeHtml = (value = "") => String(value).replace(/[&<>"']/g, (char) => ({
  "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
})[char]);
const formatDate = (value) => value ? new Intl.DateTimeFormat("id-ID", {
  day: "numeric", month: "short", year: "numeric",
}).format(new Date(value)) : "—";
const statusClass = (status) => ({
  "Belum Ditemukan": "status-new",
  "Sedang Ditelusuri": "status-progress",
  "Barang Ditemukan": "status-found",
  "Sudah Dikembalikan": "status-returned",
}[status] || "status-new");
const statusBadge = (status) => `<span class="status-badge ${statusClass(status)}"><span></span>${escapeHtml(status)}</span>`;
function toast(message, type = "success") {
  const node = document.createElement("div");
  node.className = `toast toast-${type}`;
  node.textContent = message;
  toastRegion.append(node);
  window.setTimeout(() => node.remove(), 4200);
}

function routeFromHash() {
  const raw = window.location.hash.replace(/^#\/?/, "") || "home";
  const [path, ...queryParts] = raw.split("?");
  const params = new URLSearchParams(queryParts.join("?"));
  return { path, params };
}

function navigate(path) {
  window.location.hash = `#/${path}`;
}

function brand() {
  return `<a class="brand" href="#/home" aria-label="Beranda Sistem Kehilangan Barang">
    <span class="brand-mark"><img src="/assets/logo-uinam.png" alt="Logo resmi UIN Alauddin Makassar"></span>
    <span class="brand-copy"><strong>Sistem Kehilangan</strong><small>LAYANAN KAMPUS</small></span>
  </a>`;
}

function publicHeader() {
  return `<header class="site-header"><div class="nav-wrap">${brand()}
    <button class="mobile-menu-toggle" type="button" aria-label="Buka menu">${icon("menu")}</button>
    <nav class="public-nav" aria-label="Navigasi utama">
      <a href="#/home" data-nav>Beranda</a><a href="#/report" data-nav>Laporan</a><a href="#/found" data-nav>Barang Ditemukan</a>
      <a href="#/status" data-nav>Cek Status</a><a href="#/about" data-nav>Tentang</a>
    </nav>
    <div class="nav-actions">${currentUser
      ? `<a class="button button-ghost button-small" href="#/dashboard">Dashboard ${icon("arrow")}</a>`
      : `<a class="button button-ghost button-small" href="#/login">Masuk</a><a class="button button-primary button-small" href="#/register">Daftar</a>`}
    </div></div></header>`;
}

function renderHome() {
  return `${publicHeader()}<main>
    <section class="hero"><div class="hero-grid"><div class="hero-content">
      <span class="eyebrow"><span class="eyebrow-dot"></span> LAYANAN RESMI KAMPUS</span>
      <h1>Sistem Informasi<br><span>Kehilangan Barang.</span></h1>
      <p class="hero-lede">Laporkan kehilangan dan temukan kembali barangmu dengan bantuan petugas keamanan UIN Alauddin Makassar.</p>
      <div class="hero-actions"><a class="button button-primary button-large" href="#/report">Buat Laporan ${icon("arrow")}</a><a class="button button-ghost button-large" href="#/status">${icon("search")} Cek Status</a></div>
      <div class="hero-trust">${icon("shield")}<span>Terhubung langsung dengan petugas keamanan kampus</span></div>
    </div><div class="hero-art" aria-label="Ilustrasi barang yang sering hilang">
      <div class="art-orbit orbit-one"></div><div class="art-orbit orbit-two"></div>
      <div class="art-center">${icon("search")}</div>
      <div class="floating-item item-wallet"><span class="item-emoji">👛</span><small>Dompet</small></div>
      <div class="floating-item item-phone"><span class="item-emoji">📱</span><small>Handphone</small></div>
      <div class="floating-item item-keys"><span class="item-emoji">🔑</span><small>Kunci</small></div>
      <div class="floating-item item-bag"><span class="item-emoji">🎒</span><small>Tas</small></div>
      <div class="art-caption">${icon("spark")}<span>Setiap barang<br>punya jalan pulang.</span></div>
    </div></div></section>
    <section class="trust-strip"><div><strong>1 pintu</strong><span>layanan kehilangan kampus</span></div><i></i><div><strong>24/7</strong><span>akses pelaporan online</span></div><i></i><div><strong>Terpantau</strong><span>status laporan transparan</span></div></section>
    <section class="section-wrap benefits-section"><div class="section-heading"><span class="eyebrow">KENAPA LEWAT SINI?</span><h2>Lebih mudah, lebih tenang.</h2><p>Semua proses kehilangan dan penemuan barang di kampus terhubung dalam satu layanan.</p></div>
      <div class="benefit-grid">
        ${benefitCard("file", "Pelaporan praktis", "Kirim detail barang dan lokasi kehilangan dalam beberapa langkah saja.")}
        ${benefitCard("shield", "Bersama petugas", "Laporanmu langsung diteruskan ke petugas keamanan kampus.")}
        ${benefitCard("clock", "Status transparan", "Pantau perkembangan pencarian menggunakan nomor laporan unik.")}
      </div></section>
    <section class="steps-section"><div class="section-wrap"><div class="section-heading"><span class="eyebrow">TIGA LANGKAH SEDERHANA</span><h2>Mulai pencarianmu.</h2></div>
      <div class="steps-grid">${stepCard("01", "Buat laporan", "Ceritakan barang dan lokasi terakhir kamu melihatnya.")}${stepCard("02", "Petugas menelusuri", "Tim keamanan kampus membantu mencari dan mencocokkan informasi.")}${stepCard("03", "Pantau & ambil", "Cek status, lalu konfirmasi pengambilan barang dengan petugas.")}</div>
    </div></section>
    <section class="cta-section section-wrap"><div class="cta-card"><div><span class="eyebrow eyebrow-light">JANGAN MENUNGGU</span><h2>Mulai laporan kehilanganmu hari ini.</h2><p>Informasi yang lengkap membantu petugas menemukan barang lebih cepat.</p></div><a class="button button-white button-large" href="#/report">Buat Laporan ${icon("arrow")}</a></div></section>
  </main>${publicFooter()}`;
}

function benefitCard(symbol, title, description) {
  return `<article class="benefit-card"><span class="feature-icon">${icon(symbol)}</span><h3>${title}</h3><p>${description}</p></article>`;
}

function stepCard(number, title, description) {
  return `<article class="step-card"><span class="step-number">${number}</span><h3>${title}</h3><p>${description}</p></article>`;
}

function publicFooter() {
  return `<footer class="site-footer"><div class="footer-inner">${brand()}<p>Layanan informasi kehilangan barang<br>UIN Alauddin Makassar</p><span class="footer-copy">© ${new Date().getFullYear()} UIN Alauddin Makassar</span></div></footer>`;
}

function authPage(type) {
  const isRegister = type === "register";
  return `${publicHeader()}<main class="auth-page"><section class="auth-aside">
      <span class="eyebrow eyebrow-light">UIN ALAUDDIN MAKASSAR</span><h1>${isRegister ? "Satu langkah lebih dekat untuk menemukan." : "Selamat datang kembali."}</h1>
      <p>${isRegister ? "Buat akun mahasiswa untuk melaporkan dan memantau barang hilang di lingkungan kampus." : "Masuk untuk membuat laporan kehilangan, melihat status pencarian, dan mengelola profilmu."}</p>
      <div class="auth-aside-art"><span>🔎</span><span>🎒</span><span>🔑</span><span>📱</span></div>
    </section><section class="auth-form-wrap"><form class="form-card" id="${isRegister ? "register-form" : "login-form"}" novalidate>
      <span class="eyebrow">${isRegister ? "BUAT AKUN MAHASISWA" : "AKSES AKUN"}</span><h2>${isRegister ? "Daftar sekarang" : "Masuk ke akunmu"}</h2>
      <p class="form-intro">${isRegister ? "Gunakan data kampus yang aktif." : "Masukkan email atau NIM."}</p>
      ${isRegister ? `<label class="field"><span>Nama lengkap</span><input name="name" autocomplete="name" placeholder="Nama sesuai identitas" required maxlength="120"></label>
        <label class="field"><span>NIM</span><input name="nim" autocomplete="username" placeholder="Nomor induk mahasiswa" required maxlength="30"></label>
        <label class="field"><span>Email kampus</span><input name="email" type="email" autocomplete="email" placeholder="nama@uin-alauddin.ac.id" required></label>
        <label class="field"><span>Program studi</span><input name="studyProgram" placeholder="Contoh: Sistem Informasi" required maxlength="120"></label>
        ${passwordInput("password", "Kata sandi", "new-password")} ${passwordInput("confirmPassword", "Konfirmasi kata sandi", "new-password")}`
        : `<label class="field"><span>Email atau NIM</span><input name="identifier" autocomplete="username" placeholder="Masukkan email atau NIM" required></label>${passwordInput("password", "Kata sandi", "current-password")}`}
      <button class="button button-primary button-full button-large" type="submit">${isRegister ? "Buat Akun" : "Masuk"} ${icon("arrow")}</button>
      <p class="auth-switch">${isRegister ? "Sudah punya akun?" : "Belum punya akun?"} <a href="#/${isRegister ? "login" : "register"}">${isRegister ? "Masuk" : "Daftar sekarang"}</a></p>
    </form></section></main>${publicFooter()}`;
}

function passwordInput(name, label, autocomplete) {
  return `<label class="field"><span>${label}</span><span class="password-wrap"><input name="${name}" type="password" autocomplete="${autocomplete}" placeholder="Minimal 8 karakter" required minlength="8"><button type="button" class="password-toggle" aria-label="Tampilkan kata sandi">${icon("eye")}</button></span></label>`;
}

function sidebar(active) {
  const links = currentUser.role === "staff"
    ? [["dashboard", "Dashboard", "home"], ["staff-reports", "Kelola Laporan", "file"], ["found", "Barang Ditemukan", "box"], ["profile", "Profil", "user"]]
    : [["dashboard", "Dashboard", "home"], ["report", "Buat Laporan", "plus"], ["my-reports", "Laporan Saya", "file"], ["status", "Cek Status", "search"], ["profile", "Profil", "user"]];
  return `<aside class="dashboard-sidebar"><div class="sidebar-brand">${brand()}<button class="sidebar-close" type="button" aria-label="Tutup menu">${icon("close")}</button></div>
    <div class="sidebar-label">MENU UTAMA</div><nav class="sidebar-nav">${links.map(([route, label, symbol]) =>
      `<a href="#/${route}" class="${active === route ? "active" : ""}">${icon(symbol)}<span>${label}</span>${route === "report" ? '<span class="nav-plus">+</span>' : ""}</a>`).join("")}</nav>
    <div class="sidebar-help"><span class="feature-icon">${icon("shield")}</span><strong>Butuh bantuan?</strong><p>Hubungi petugas keamanan kampus.</p><a href="#/about">Info kontak ${icon("arrow")}</a></div>
    <button class="sidebar-logout" type="button" data-action="logout">${icon("logout")} Keluar</button>
  </aside>`;
}

function dashboardFrame(active, content) {
  const initials = currentUser.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase();
  return `<div class="dashboard-shell">${sidebar(active)}<div class="sidebar-overlay"></div><main class="dashboard-main">
    <header class="dashboard-topbar"><button type="button" class="dashboard-menu-toggle" aria-label="Buka menu">${icon("menu")}</button><div class="breadcrumb">Ruang Mahasiswa <span>/</span> <strong>${escapeHtml(active === "dashboard" ? "Dashboard" : active.replace("-", " ").replace(/\b\w/g, (letter) => letter.toUpperCase()))}</strong></div>
      <div class="topbar-user"><span class="avatar">${escapeHtml(initials)}</span><span><strong>${escapeHtml(currentUser.name)}</strong><small>${currentUser.role === "staff" ? "Petugas Keamanan" : "Mahasiswa"}</small></span></div>
    </header><div class="dashboard-content">${content}</div></main></div>`;
}

function pageHeading(kicker, title, description, action = "") {
  return `<div class="page-heading"><div><span class="eyebrow">${kicker}</span><h1>${title}</h1><p>${description}</p></div>${action}</div>`;
}

function renderDashboard() {
  const data = dashboardData || { stats: {}, reports: [] };
  if (data.error) {
    return dashboardFrame("dashboard", `${pageHeading("RINGKASAN AKTIVITAS", "Data belum tersedia", "Ringkasan dashboard belum dapat dimuat.")}
      <section class="panel-card"><div class="empty-state"><span class="feature-icon">${icon("clock")}</span><strong>Gagal memuat dashboard</strong><p>${escapeHtml(data.error)}</p><button class="button button-primary" type="button" data-action="retry-dashboard">Coba lagi</button></div></section>`);
  }
  const staff = currentUser.role === "staff";
  const stats = staff ? [
    ["Total laporan", data.stats.total || 0, "file", "stat-green"],
    ["Belum ditemukan", data.stats.new || 0, "search", "stat-blue"],
    ["Sedang ditelusuri", data.stats.searching || 0, "clock", "stat-orange"],
    ["Sudah ditemukan", data.stats.found || 0, "check", "stat-purple"],
  ] : [
    ["Total laporan", data.stats.total || 0, "file", "stat-green"],
    ["Dalam proses", data.stats.inProgress || 0, "clock", "stat-blue"],
    ["Barang ditemukan", data.stats.found || 0, "search", "stat-orange"],
    ["Sudah dikembalikan", data.stats.returned || 0, "check", "stat-purple"],
  ];
  const tableTitle = staff ? "Laporan terbaru" : "Laporan terbarumu";
  const table = data.reports.length ? `<div class="table-wrap"><table><thead><tr><th>Nomor laporan</th><th>Nama barang</th>${staff ? "<th>Pelapor</th>" : ""}<th>Tanggal</th><th>Status</th><th></th></tr></thead><tbody>
    ${data.reports.map((report) => `<tr><td><a class="report-link" href="#/detail/${encodeURIComponent(report.reportNumber)}">${escapeHtml(report.reportNumber)}</a></td><td><strong>${escapeHtml(report.itemName)}</strong><small>${escapeHtml(report.category)}</small></td>${staff ? `<td>${escapeHtml(report.reporterName)}<small>${escapeHtml(report.nim)}</small></td>` : ""}<td>${formatDate(report.createdAt)}</td><td>${statusBadge(report.status)}</td><td><a class="icon-link" href="#/detail/${encodeURIComponent(report.reportNumber)}" aria-label="Lihat detail">${icon("arrow")}</a></td></tr>`).join("")}
    </tbody></table></div>` : `<div class="empty-state"><span class="feature-icon">${icon("box")}</span><strong>Belum ada laporan</strong><p>${staff ? "Laporan terbaru yang masuk akan tampil di sini." : "Laporan kehilangan yang kamu buat akan muncul di sini."}</p>${staff ? "" : '<a class="button button-primary" href="#/report">Buat laporan pertama</a>'}</div>`;
  return dashboardFrame("dashboard", `${pageHeading(staff ? "PANEL PETUGAS" : `SELAMAT DATANG, ${escapeHtml(currentUser.name.split(" ")[0]).toUpperCase()}`, "Ringkasan aktivitas", staff ? "Pantau laporan dan tindak lanjuti pencarian barang di lingkungan kampus." : "Kelola laporan kehilangan dan pantau proses pencarian barangmu.", staff ? '<a class="button button-primary" href="#/staff-reports">Kelola laporan ' + icon("arrow") + "</a>" : '<a class="button button-primary" href="#/report">' + icon("plus") + " Buat laporan</a>")}
    <section class="stats-grid">${stats.map(([label, value, symbol, tint]) => `<article class="stat-card"><span class="stat-icon ${tint}">${icon(symbol)}</span><span class="stat-label">${label}</span><strong>${value}</strong><small>${staff ? "di seluruh kampus" : "laporan milikmu"}</small></article>`).join("")}</section>
    <section class="panel-card"><div class="panel-heading"><div><h2>${tableTitle}</h2><p>${staff ? "Laporan masuk dari seluruh mahasiswa." : "Perkembangan laporan yang kamu kirim."}</p></div><a class="text-link" href="#/${staff ? "staff-reports" : "my-reports"}">Lihat semua ${icon("arrow")}</a></div>${table}</section>
    <section class="dashboard-tip">${icon("spark")}<div><strong>Tips agar barang lebih mudah ditemukan</strong><p>Sertakan ciri-ciri unik dan lokasi yang spesifik saat membuat laporan.</p></div></section>`);
}

function renderReportForm() {
  return dashboardFrame("report", `${pageHeading("FORMULIR KEHILANGAN", "Ceritakan barangmu", "Semakin lengkap informasinya, semakin mudah petugas melakukan pencarian.")}
    <form class="panel-card report-form" id="report-form" novalidate>
      <div class="form-grid reporter-fields"><label class="field"><span>Nama pelapor</span><input value="${escapeHtml(currentUser.name)}" readonly></label><label class="field"><span>NIM</span><input value="${escapeHtml(currentUser.nim || "")}" readonly></label></div>
      <div class="form-section-title"><span class="step-number">01</span><div><h2>Informasi barang</h2><p>Jelaskan barang yang hilang sedetail mungkin.</p></div></div>
      <div class="form-grid"><label class="field"><span>Nama atau jenis barang <b>*</b></span><input name="itemName" placeholder="Contoh: Dompet kulit warna cokelat" required maxlength="120"></label>
        <label class="field"><span>Kategori barang <b>*</b></span><select name="category" required><option value="">Pilih kategori</option>${categories.map((category) => `<option>${category}</option>`).join("")}</select></label>
        <label class="field field-full"><span>Deskripsi dan ciri-ciri <b>*</b></span><textarea name="description" rows="4" maxlength="1200" placeholder="Warna, merek, tanda khusus, isi barang, dan ciri lain yang mudah dikenali" required></textarea><small class="field-hint">Jangan sertakan data sensitif seperti PIN atau kata sandi.</small></label>
        <label class="field field-full"><span>Foto barang <small>(opsional)</small></span><input class="file-input" type="file" name="photo" accept="image/jpeg,image/png,image/webp"><span class="upload-box">${icon("plus")}<strong>Pilih foto untuk diunggah</strong><small>JPG, PNG, atau WebP · Maksimal 5 MB</small></span><img class="photo-preview hidden" alt="Pratinjau foto barang"></label>
      </div>
      <div class="form-section-title form-section-space"><span class="step-number">02</span><div><h2>Lokasi dan waktu</h2><p>Bantu petugas mempersempit area pencarian.</p></div></div>
      <div class="form-grid"><label class="field"><span>Lokasi terakhir terlihat <b>*</b></span><input name="location" placeholder="Contoh: Perpustakaan lantai 2" required maxlength="180"></label>
        <label class="field"><span>Tanggal dan waktu kehilangan <b>*</b></span><input name="lostAt" type="datetime-local" required></label>
      </div>
      <div class="form-section-title form-section-space"><span class="step-number">03</span><div><h2>Kontak yang bisa dihubungi</h2><p>Informasi kontak hanya terlihat oleh petugas.</p></div></div>
      <div class="form-grid"><label class="field field-full"><span>Nomor telepon atau WhatsApp <b>*</b></span><input name="contact" type="tel" placeholder="Contoh: 081234567890" required maxlength="40"></label></div>
      <div class="form-footer"><p>${icon("shield")} Data kontakmu tidak ditampilkan pada pencarian publik.</p><button class="button button-primary button-large" type="submit">Kirim laporan ${icon("arrow")}</button></div>
    </form>`);
}

function reportTable(reports, options = {}) {
  if (!reports.length) return `<div class="empty-state"><span class="feature-icon">${icon("search")}</span><strong>${options.emptyTitle || "Belum ada laporan"}</strong><p>${options.emptyText || "Laporan akan ditampilkan di sini."}</p></div>`;
  return `<div class="table-wrap"><table><thead><tr><th>Nomor laporan</th><th>Barang</th>${options.staff ? "<th>Pelapor</th>" : ""}<th>Lokasi terakhir</th><th>Tanggal</th><th>Status</th>${options.manage ? "<th>Tindakan</th>" : ""}</tr></thead><tbody>${reports.map((report) => `<tr><td><a class="report-link" href="#/detail/${encodeURIComponent(report.reportNumber)}">${escapeHtml(report.reportNumber)}</a></td><td><strong>${escapeHtml(report.itemName)}</strong><small>${escapeHtml(report.category)}</small></td>${options.staff ? `<td>${escapeHtml(report.reporterName)}<small>${escapeHtml(report.nim)}</small></td>` : ""}<td>${escapeHtml(report.location)}</td><td>${formatDate(report.createdAt)}</td><td>${statusBadge(report.status)}</td>${options.manage ? `<td><button class="button button-ghost button-small" data-action="manage-report" data-id="${report.id}">Tindak lanjuti</button></td>` : ""}</tr>`).join("")}</tbody></table></div>`;
}

function renderMyReports() {
  if (dashboardData?.error) {
    return dashboardFrame("my-reports", `${pageHeading("ARSIP LAPORAN", "Laporan saya", "Semua laporan kehilangan yang pernah kamu kirim.")}
      <section class="panel-card"><div class="empty-state"><span class="feature-icon">${icon("clock")}</span><strong>Gagal memuat laporan</strong><p>${escapeHtml(dashboardData.error)}</p><button class="button button-primary" type="button" data-action="retry-reports">Coba lagi</button></div></section>`);
  }
  return dashboardFrame("my-reports", `${pageHeading("ARSIP LAPORAN", "Laporan saya", "Semua laporan kehilangan yang pernah kamu kirim.")}
    <section class="panel-card"><div class="panel-heading"><div><h2>Riwayat laporan</h2><p>Gunakan nomor laporan untuk membagikan atau mengecek status.</p></div><a class="button button-primary button-small" href="#/report">${icon("plus")} Laporan baru</a></div>${reportTable(dashboardData?.reports || [], { emptyTitle: "Belum ada laporan", emptyText: "Kamu belum melaporkan barang yang hilang." })}</section>`);
}

function renderStatusPage(error = "") {
  return `${publicHeader()}<main class="public-content page-status"><div class="status-hero">${pageHeading("PENCARIAN LAPORAN", "Di mana barangmu sekarang?", "Cari dengan nomor laporan atau kata kunci nama barang.")}
      <form class="search-form" id="status-search"><label class="sr-only" for="search-query">Nomor laporan atau nama barang</label><span>${icon("search")}</span><input id="search-query" name="q" value="${escapeHtml(routeFromHash().params.get("q") || "")}" placeholder="Contoh: LKB-2026-0001 atau dompet" minlength="3" required><button class="button button-primary" type="submit">Cari laporan</button></form>
    </div><section id="search-results" class="panel-card search-results">${error ? `<div class="empty-state"><span class="feature-icon">${icon("clock")}</span><strong>Pencarian belum berhasil</strong><p>${escapeHtml(error)}</p><button class="button button-primary" type="button" data-action="retry-search">Coba lagi</button></div>` : searchResults.length ? searchResultsMarkup() : `<div class="search-placeholder"><span class="feature-icon">${icon("search")}</span><strong>Belum melakukan pencarian</strong><p>Masukkan nomor laporan atau nama barang pada kolom di atas.</p></div>`}</section>
    <div class="privacy-note">${icon("shield")}<span>Informasi pribadi pelapor dan nomor kontak tidak ditampilkan dalam hasil pencarian publik.</span></div>
  </main>${publicFooter()}`;
}

function searchResultsMarkup() {
  return searchResults.length ? `<div class="panel-heading"><div><h2>Hasil pencarian</h2><p>Ditemukan ${searchResults.length} laporan yang sesuai.</p></div></div>${searchResults.map((report) => `<a class="search-result" href="#/detail/${encodeURIComponent(report.reportNumber)}">
    ${report.photo ? `<img src="${escapeHtml(report.photo)}" alt="" class="result-thumb">` : `<span class="result-thumb result-thumb-empty">${icon("box")}</span>`}
    <span class="result-main"><small>${escapeHtml(report.reportNumber)} · ${escapeHtml(report.category)}</small><strong>${escapeHtml(report.itemName)}</strong><span>${icon("pin")} ${escapeHtml(report.location)} · ${formatDate(report.lostAt)}</span></span>
    <span class="result-side">${statusBadge(report.status)}<span class="result-arrow">${icon("arrow")}</span></span>
  </a>`).join("")}` : `<div class="empty-state"><span class="feature-icon">${icon("search")}</span><strong>Laporan belum ditemukan</strong><p>Coba kata kunci lain atau periksa kembali nomor laporanmu.</p></div>`;
}

async function renderDetailPage(reportNumber, version) {
  let content = `<div class="loading-state"><span class="spinner"></span>Memuat detail laporan...</div>`;
  appRoot.innerHTML = `${publicHeader()}<main class="public-content">${content}</main>${publicFooter()}`;
  try {
    const data = await api(`/api/reports/${encodeURIComponent(reportNumber)}`);
    if (version !== routeVersion) return;
    reportDetail = data;
    const report = data.report;
    content = `<a class="back-link" href="#/status">${icon("arrow")} Kembali ke pencarian</a><div class="detail-heading"><div><span class="eyebrow">DETAIL LAPORAN</span><h1>${escapeHtml(report.itemName)}</h1><p>${escapeHtml(report.reportNumber)} · Dilaporkan ${formatDate(report.createdAt)}</p></div>${statusBadge(report.status)}</div>
      <div class="detail-grid"><section class="panel-card detail-card"><h2>Informasi barang</h2>${report.photo ? `<img class="detail-photo" src="${escapeHtml(report.photo)}" alt="Foto ${escapeHtml(report.itemName)}">` : ""}
        <dl class="detail-list"><div><dt>Kategori</dt><dd>${escapeHtml(report.category)}</dd></div><div><dt>Deskripsi & ciri-ciri</dt><dd>${escapeHtml(report.description)}</dd></div><div><dt>Lokasi terakhir</dt><dd>${icon("pin")} ${escapeHtml(report.location)}</dd></div><div><dt>Waktu kehilangan</dt><dd>${formatDate(report.lostAt)} · ${new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(report.lostAt))}</dd></div>${report.staffNote ? `<div><dt>Catatan petugas</dt><dd>${escapeHtml(report.staffNote)}</dd></div>` : ""}</dl></section>
      <section class="panel-card timeline-card"><h2>Perkembangan pencarian</h2><div class="timeline">${data.updates.map((update) => `<div class="timeline-item"><span class="timeline-marker"></span><div><strong>${escapeHtml(update.status)}</strong><small>${formatDate(update.createdAt)} · ${new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit" }).format(new Date(update.createdAt))}</small>${update.note ? `<p>${escapeHtml(update.note)}</p>` : ""}</div></div>`).join("")}</div>
      ${report.status === "Barang Ditemukan" ? `<div class="found-callout">${icon("check")}<p>Barangmu telah ditemukan! Hubungi petugas keamanan kampus untuk proses verifikasi dan pengambilan.</p></div>` : ""}
      <div class="privacy-note">${icon("shield")}<span>Informasi kontak hanya dapat diakses oleh petugas keamanan.</span></div></section></div>`;
  } catch (error) {
    if (version !== routeVersion) return;
    content = `<div class="empty-state detail-not-found"><span class="feature-icon">${icon("search")}</span><strong>Laporan tidak ditemukan</strong><p>${escapeHtml(error.message)}</p><a class="button button-primary" href="#/status">Cari laporan lain</a></div>`;
  }
  const main = appRoot.querySelector("main");
  if (main) main.innerHTML = content;
}

async function renderStaffReports() {
  const filters = `<div class="filter-row"><input id="staff-query" placeholder="Cari nomor, barang, atau nama pelapor"><select id="staff-status"><option value="">Semua status</option>${statuses.map((status) => `<option>${status}</option>`).join("")}</select></div>`;
  appRoot.innerHTML = dashboardFrame("staff-reports", `${pageHeading("PENGELOLAAN", "Laporan kehilangan", "Tambah, periksa, ubah, atau hapus laporan barang hilang.", `<button class="button button-primary" type="button" data-action="create-report">${icon("plus")} Tambah laporan</button>`)}
    <section class="panel-card"><div class="panel-heading"><div><h2>Daftar laporan</h2><p>Informasi kontak pelapor hanya tersedia untuk petugas.</p></div></div>${filters}<div id="staff-list">${reportTable(staffReports, { staff: true, manage: true })}</div></section>`);
  const version = routeVersion;
  try {
    const data = await api("/api/staff/reports");
    if (version !== routeVersion) return;
    staffReports = data.reports;
    const list = document.querySelector("#staff-list");
    if (list) list.innerHTML = reportTable(staffReports, { staff: true, manage: true });
  } catch (error) {
    toast(error.message, "error");
    const list = document.querySelector("#staff-list");
    if (list) list.innerHTML = `<div class="empty-state"><span class="feature-icon">${icon("clock")}</span><strong>Gagal memuat laporan</strong><p>${escapeHtml(error.message)}</p><button class="button button-primary" type="button" data-action="retry-staff">Coba lagi</button></div>`;
  }
}

function renderFoundPage() {
  const reports = staffReports.filter((report) => report.status === "Barang Ditemukan");
  const content = `<div class="page-heading"><div><span class="eyebrow">PAPAN BARANG TEMUAN</span><h1>Barang sudah ditemukan</h1><p>Daftar barang yang sudah ditemukan petugas keamanan kampus. Hubungi petugas untuk verifikasi pengambilan.</p></div></div>
    <div class="found-grid">${reports.length ? reports.map((report) => `<article class="found-card">${report.photo ? `<img src="${escapeHtml(report.photo)}" alt="Foto ${escapeHtml(report.itemName)}">` : `<div class="found-image-placeholder">${icon("box")}</div>`}<div class="found-card-body">${statusBadge(report.status)}<h2>${escapeHtml(report.itemName)}</h2><p>${escapeHtml(report.category)} · ${escapeHtml(report.location)}</p><a href="#/detail/${encodeURIComponent(report.reportNumber)}" class="text-link">Lihat informasi ${icon("arrow")}</a></div></article>`).join("") : `<div class="empty-state panel-card"><span class="feature-icon">${icon("box")}</span><strong>Belum ada barang yang diumumkan</strong><p>Barang yang ditemukan petugas akan ditampilkan di sini.</p></div>`}</div>`;
  if (currentUser) return dashboardFrame(currentUser.role === "staff" ? "found" : "status", content);
  return `${publicHeader()}<main class="public-content">${content}</main>${publicFooter()}`;
}

function renderProfile() {
  return dashboardFrame("profile", `${pageHeading("PENGATURAN AKUN", "Profil saya", "Pastikan informasi kontak dan program studi tetap aktif.")}
    <form class="panel-card profile-form" id="profile-form"><div class="form-section-title"><span class="avatar avatar-large">${escapeHtml(currentUser.name.split(/\s+/).slice(0, 2).map((part) => part[0]).join("").toUpperCase())}</span><div><h2>Informasi pribadi</h2><p>Data mahasiswa dan informasi akun.</p></div></div>
      <div class="form-grid"><label class="field"><span>Nama lengkap</span><input name="name" value="${escapeHtml(currentUser.name)}" required maxlength="120"></label><label class="field"><span>Email</span><input name="email" type="email" value="${escapeHtml(currentUser.email)}" required></label>
      ${currentUser.role === "student" ? `<label class="field"><span>NIM</span><input value="${escapeHtml(currentUser.nim || "")}" disabled><small class="field-hint">NIM tidak dapat diubah.</small></label><label class="field"><span>Program studi</span><input name="studyProgram" value="${escapeHtml(currentUser.studyProgram)}" required maxlength="120"></label>` : `<label class="field"><span>Peran</span><input value="Petugas Keamanan" disabled></label><input type="hidden" name="studyProgram" value="${escapeHtml(currentUser.studyProgram)}">`}</div>
      <div class="form-footer"><span></span><button class="button button-primary button-large" type="submit">Simpan perubahan ${icon("arrow")}</button></div></form>`);
}

function renderAbout() {
  const content = `<div class="page-heading"><div><span class="eyebrow">TENTANG LAYANAN</span><h1>Membantu kampus saling menjaga.</h1><p>Sistem Informasi Kehilangan Barang membantu sivitas akademika UIN Alauddin Makassar mengelola laporan kehilangan dan barang temuan secara terpusat.</p></div></div>
    <section class="about-grid"><article class="panel-card about-card"><span class="feature-icon">${icon("shield")}</span><h2>Terhubung dengan keamanan kampus</h2><p>Laporan diteruskan kepada petugas agar pencarian dan proses verifikasi barang dapat dikelola dengan lebih tertib.</p></article><article class="panel-card about-card"><span class="feature-icon">${icon("clock")}</span><h2>Informasi status yang jelas</h2><p>Setiap laporan mendapatkan nomor unik dan riwayat pembaruan status yang dapat dipantau oleh pelapor.</p></article></section>
    <section class="contact-card"><div><span class="eyebrow eyebrow-light">PERLU BANTUAN LANGSUNG?</span><h2>Hubungi petugas keamanan kampus</h2><p>Untuk verifikasi dan pengambilan barang yang ditemukan, datang langsung ke pos keamanan kampus.</p></div><span class="contact-icon">${icon("shield")}</span></section>
    <div class="logo-note">${icon("spark")}<span>Identitas kampus menggunakan aset logo resmi UIN Alauddin Makassar.</span></div>`;
  return `${publicHeader()}<main class="public-content about-page">${content}</main>${publicFooter()}`;
}

function renderLoading() {
  appRoot.innerHTML = `<main class="loading-screen"><span class="brand-mark"><img src="/assets/logo-uinam.png" alt=""></span><span class="spinner"></span><p>Menyiapkan ruang laporanmu...</p></main>`;
}

async function render() {
  const version = ++routeVersion;
  const { path, params } = routeFromHash();
  const protectedRoutes = ["dashboard", "report", "my-reports", "staff-reports", "profile"];
  if (protectedRoutes.includes(path)) {
    try {
      const data = await api("/api/auth/session");
      if (version !== routeVersion) return;
      if (!data.user) {
        currentUser = null;
        navigate("login");
        return;
      }
      currentUser = data.user;
    } catch {
      currentUser = null;
      toast("Sesi tidak dapat diperiksa. Silakan masuk kembali.", "error");
      navigate("login");
      return;
    }
  }
  if (path === "home") appRoot.innerHTML = renderHome();
  else if (path === "login" || path === "register") appRoot.innerHTML = authPage(path);
  else if (path === "about") appRoot.innerHTML = renderAbout();
  else if (path === "status") {
    const query = params.get("q")?.trim() || "";
    if (query.length >= 3 && query !== lastSearchQuery) {
      searchResults = [];
      lastSearchQuery = query;
      appRoot.innerHTML = `${publicHeader()}<main class="public-content page-status"><div class="status-hero">${pageHeading("PENCARIAN LAPORAN", "Di mana barangmu sekarang?", "Cari dengan nomor laporan atau kata kunci nama barang.")}<div class="search-form"><span>${icon("search")}</span><input value="${escapeHtml(query)}" readonly><span class="spinner"></span></div></div><section class="panel-card search-results"><div class="loading-state"><span class="spinner"></span>Mencari laporan...</div></section></main>${publicFooter()}`;
      try {
        const data = await api(`/api/reports/search?q=${encodeURIComponent(query)}`);
        if (version !== routeVersion) return;
        searchResults = data.reports;
        appRoot.innerHTML = renderStatusPage();
      } catch (error) {
        if (version !== routeVersion) return;
        toast(error.message, "error");
        appRoot.innerHTML = renderStatusPage(error.message);
      }
    } else {
      if (query.length < 3) {
        searchResults = [];
        lastSearchQuery = null;
      }
      appRoot.innerHTML = renderStatusPage();
    }
  }
  else if (path === "found") {
    try {
      const data = await api("/api/found");
      staffReports = data.reports;
    } catch (error) {
      toast(error.message, "error");
      if (version === routeVersion) {
        appRoot.innerHTML = `${publicHeader()}<main class="public-content">${pageHeading("PAPAN BARANG TEMUAN", "Daftar tidak tersedia", "Daftar barang temuan belum dapat dimuat.")}<section class="panel-card"><div class="empty-state"><strong>Gagal memuat barang temuan</strong><p>${escapeHtml(error.message)}</p><button class="button button-primary" type="button" data-action="retry-found">Coba lagi</button></div></section></main>${publicFooter()}`;
        return;
      }
    }
    if (version === routeVersion) appRoot.innerHTML = renderFoundPage();
  } else if (path.startsWith("detail/")) {
    await renderDetailPage(decodeURIComponent(path.slice("detail/".length)), version);
  } else if (path === "dashboard") {
    try {
      dashboardData = await api("/api/dashboard");
    } catch (error) {
      toast(error.message, "error");
      dashboardData = { error: error.message };
    }
    if (version === routeVersion) appRoot.innerHTML = renderDashboard();
  } else if (path === "report") {
    if (currentUser.role !== "student") return navigate("dashboard");
    appRoot.innerHTML = renderReportForm();
  } else if (path === "my-reports") {
    try {
      const data = await api("/api/reports/mine");
      if (version !== routeVersion) return;
      dashboardData = { reports: data.reports };
    } catch (error) {
      if (version !== routeVersion) return;
      toast(error.message, "error");
      dashboardData = { error: error.message };
    }
    appRoot.innerHTML = renderMyReports();
  } else if (path === "staff-reports") {
    if (currentUser.role !== "staff") return navigate("dashboard");
    await renderStaffReports();
  } else if (path === "profile") appRoot.innerHTML = renderProfile();
  else appRoot.innerHTML = `${publicHeader()}<main class="public-content"><div class="empty-state panel-card detail-not-found"><span class="feature-icon">${icon("search")}</span><strong>Halaman tidak ditemukan</strong><p>Alamat halaman yang dibuka tidak tersedia.</p><a class="button button-primary" href="#/home">Kembali ke beranda</a></div></main>${publicFooter()}`;
}

appRoot.addEventListener("submit", async (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;
  event.preventDefault();
  const values = new FormData(form);
  const submitButton = form.querySelector('[type="submit"]');
  if (submitButton) submitButton.disabled = true;
  try {
    if (form.id === "login-form") {
      const data = await api("/api/auth/login", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: values.get("identifier"), password: values.get("password") }),
      });
      currentUser = data.user;
      toast(`Selamat datang, ${currentUser.name.split(" ")[0]}!`);
      navigate("dashboard");
    } else if (form.id === "register-form") {
      if (values.get("password") !== values.get("confirmPassword")) throw new Error("Konfirmasi kata sandi tidak sama.");
      await api("/api/auth/register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.get("name"), nim: values.get("nim"), email: values.get("email"),
          studyProgram: values.get("studyProgram"), password: values.get("password"),
        }),
      });
      toast("Akun berhasil dibuat. Silakan masuk untuk mulai membuat laporan.");
      navigate("login");
    } else if (form.id === "report-form") {
      const lostAt = new Date(String(values.get("lostAt")));
      if (Number.isNaN(lostAt.getTime())) throw new Error("Tanggal dan waktu kehilangan tidak valid.");
      values.set("lostAt", lostAt.toISOString());
      const data = await api("/api/reports", { method: "POST", body: values });
      toast(`Laporan berhasil dibuat. Nomor laporanmu ${data.report.reportNumber}.`);
      searchResults = [];
      navigate(`detail/${encodeURIComponent(data.report.reportNumber)}`);
    } else if (form.id === "profile-form") {
      const data = await api("/api/profile", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: values.get("name"), email: values.get("email"),
          studyProgram: values.get("studyProgram") || currentUser.studyProgram,
        }),
      });
      currentUser = data.user;
      toast("Profil berhasil diperbarui.");
      render();
    } else if (form.id === "status-search") {
      const query = String(values.get("q")).trim();
      const data = await api(`/api/reports/search?q=${encodeURIComponent(query)}`);
      searchResults = data.reports;
      lastSearchQuery = query;
      window.location.hash = `#/status?q=${encodeURIComponent(query)}`;
      appRoot.innerHTML = renderStatusPage();
    }
  } catch (error) {
    toast(error.message, "error");
  } finally {
    if (submitButton?.isConnected) submitButton.disabled = false;
  }
});

appRoot.addEventListener("click", async (event) => {
  const target = event.target instanceof Element ? event.target : null;
  if (!target) return;
  const toggle = target.closest(".password-toggle");
  if (toggle) {
    const input = toggle.parentElement.querySelector("input");
    input.type = input.type === "password" ? "text" : "password";
    toggle.innerHTML = icon(input.type === "password" ? "eye" : "eyeOff");
    toggle.setAttribute("aria-label", input.type === "password" ? "Tampilkan kata sandi" : "Sembunyikan kata sandi");
  }
  if (target.closest(".mobile-menu-toggle")) document.querySelector(".public-nav")?.classList.toggle("nav-open");
  if (target.closest(".dashboard-menu-toggle")) {
    document.querySelector(".dashboard-sidebar")?.classList.add("sidebar-open");
    document.querySelector(".sidebar-overlay")?.classList.add("overlay-open");
  }
  if (target.closest(".sidebar-close") || target.closest(".sidebar-overlay")) {
    document.querySelector(".dashboard-sidebar")?.classList.remove("sidebar-open");
    document.querySelector(".sidebar-overlay")?.classList.remove("overlay-open");
  }
  const logoutButton = target.closest('[data-action="logout"]');
  if (logoutButton) {
    try {
      await api("/api/auth/logout", { method: "POST" });
      currentUser = null;
      toast("Kamu berhasil keluar.");
      navigate("home");
    } catch (error) {
      toast(error.message, "error");
    }
  }
  if (target.closest('[data-action^="retry-"]')) {
    await render();
    return;
  }
  if (target.closest('[data-action="retry-search"]')) {
    lastSearchQuery = null;
    await render();
    return;
  }
  const manageButton = target.closest('[data-action="manage-report"]');
  if (manageButton) {
    const report = staffReports.find((item) => String(item.id) === manageButton.dataset.id);
    if (report) showManageDialog(report);
  }
  if (target.closest('[data-action="create-report"]')) showManageDialog();
});

function showManageDialog(report = null) {
  const dialog = document.createElement("dialog");
  dialog.className = "manage-dialog report-dialog";
  const dateValue = report?.lostAt ? new Date(report.lostAt).toISOString().slice(0, 16) : "";
  dialog.innerHTML = `<form id="manage-form" class="manage-form"><button type="button" class="dialog-close" aria-label="Tutup">${icon("close")}</button>
    <span class="eyebrow">${report ? escapeHtml(report.reportNumber) : "PENGELOLAAN PETUGAS"}</span>
    <h2>${report ? "Ubah laporan" : "Tambah laporan"}</h2>
    <p class="dialog-item">${report ? `Pelapor: ${escapeHtml(report.reporterName)}${report.nim ? ` · ${escapeHtml(report.nim)}` : ""}` : "Laporan baru akan dicatat atas nama akun petugas."}</p>
    ${report ? `<div class="dialog-contact">${icon("phone")}<strong>${escapeHtml(report.contact)}</strong><span>Kontak pelapor · hanya untuk petugas</span></div>` : ""}
    <div class="form-grid"><label class="field"><span>Nama barang <b>*</b></span><input name="itemName" required maxlength="120" value="${escapeHtml(report?.itemName || "")}" placeholder="Contoh: Dompet hitam"></label>
    <label class="field"><span>Kategori <b>*</b></span><select name="category" required><option value="">Pilih kategori</option>${categories.map((category) => `<option ${category === report?.category ? "selected" : ""}>${category}</option>`).join("")}</select></label>
    <label class="field field-full"><span>Deskripsi dan ciri-ciri <b>*</b></span><textarea name="description" rows="3" maxlength="1200" required placeholder="Warna, merek, atau ciri khusus">${escapeHtml(report?.description || "")}</textarea></label>
    <label class="field"><span>Lokasi terakhir <b>*</b></span><input name="location" required maxlength="180" value="${escapeHtml(report?.location || "")}" placeholder="Gedung atau area kampus"></label>
    <label class="field"><span>Tanggal dan waktu kehilangan <b>*</b></span><input name="lostAt" type="datetime-local" required value="${dateValue}"></label>
    <label class="field field-full"><span>Kontak yang dapat dihubungi <b>*</b></span><input name="contact" required maxlength="40" value="${escapeHtml(report?.contact || "")}" placeholder="Nomor telepon atau WhatsApp"></label>
    <label class="field"><span>Status <b>*</b></span><select name="status" required>${statuses.map((status) => `<option ${status === (report?.status || statuses[0]) ? "selected" : ""}>${status}</option>`).join("")}</select></label>
    <label class="field"><span>Catatan pembaruan</span><textarea name="note" rows="2" maxlength="500" placeholder="Catatan untuk riwayat laporan">${escapeHtml(report?.staffNote || "")}</textarea></label></div>
    <div class="dialog-actions">${report ? '<button class="button button-danger" type="button" data-action="delete-report">Hapus laporan</button>' : "<span></span>"}<button class="button button-primary" type="submit">${report ? "Simpan perubahan" : "Buat laporan"} ${icon("arrow")}</button></div></form>`;
  document.body.append(dialog);
  dialog.showModal();
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog || event.target.closest(".dialog-close")) dialog.close();
  });
  dialog.addEventListener("close", () => dialog.remove(), { once: true });
  dialog.querySelector("#manage-form").addEventListener("submit", async (event) => {
    event.preventDefault();
    const values = new FormData(event.currentTarget);
    const button = event.currentTarget.querySelector('[type="submit"]');
    button.disabled = true;
    try {
      const lostAt = new Date(String(values.get("lostAt")));
      if (Number.isNaN(lostAt.getTime())) throw new Error("Tanggal dan waktu kehilangan tidak valid.");
      await api(report ? `/api/staff/reports/${report.id}` : "/api/staff/reports", {
        method: report ? "PATCH" : "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          itemName: values.get("itemName"),
          category: values.get("category"),
          description: values.get("description"),
          location: values.get("location"),
          lostAt: lostAt.toISOString(),
          contact: values.get("contact"),
          status: values.get("status"),
          note: values.get("note"),
        }),
      });
      toast(report ? "Laporan berhasil diperbarui." : "Laporan berhasil ditambahkan.");
      dialog.close();
      await renderStaffReports();
    } catch (error) {
      toast(error.message, "error");
      button.disabled = false;
    }
  });
  dialog.querySelector('[data-action="delete-report"]')?.addEventListener("click", async (event) => {
    if (!window.confirm(`Hapus laporan ${report.reportNumber} — ${report.itemName}? Tindakan ini tidak dapat dibatalkan.`)) return;
    const button = event.currentTarget;
    button.disabled = true;
    try {
      await api(`/api/staff/reports/${report.id}`, { method: "DELETE" });
      toast("Laporan berhasil dihapus.");
      dialog.close();
      await renderStaffReports();
    } catch (error) {
      toast(error.message, "error");
      button.disabled = false;
    }
  });
}

appRoot.addEventListener("change", (event) => {
  const target = event.target;
  if (target instanceof HTMLInputElement && target.matches('input[type="file"]')) {
    const file = target.files?.[0];
    const preview = target.closest(".field").querySelector(".photo-preview");
    if (!file) return;
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type) || file.size > 5 * 1024 * 1024) {
      target.value = "";
      preview.classList.add("hidden");
      toast("Pilih gambar JPG, PNG, atau WebP dengan ukuran maksimal 5 MB.", "error");
      return;
    }
    preview.src = URL.createObjectURL(file);
    preview.classList.remove("hidden");
  }
  if (target instanceof HTMLSelectElement && target.id === "staff-status") filterStaffReports();
});

appRoot.addEventListener("input", (event) => {
  if (event.target instanceof HTMLInputElement && event.target.id === "staff-query") filterStaffReports();
});

function filterStaffReports() {
  const query = (document.querySelector("#staff-query")?.value || "").toLocaleLowerCase("id");
  const status = document.querySelector("#staff-status")?.value || "";
  const filtered = staffReports.filter((report) =>
    (!status || report.status === status) &&
    [report.reportNumber, report.itemName, report.reporterName, report.nim].some((value) => String(value || "").toLocaleLowerCase("id").includes(query)));
  const list = document.querySelector("#staff-list");
  if (list) list.innerHTML = reportTable(filtered, { staff: true, manage: true, emptyTitle: "Tidak ada laporan yang cocok", emptyText: "Ubah kata kunci atau filter status." });
}

window.addEventListener("hashchange", render);
document.addEventListener("click", (event) => {
  const link = event.target instanceof Element ? event.target.closest("[data-nav]") : null;
  if (link) document.querySelector(".public-nav")?.classList.remove("nav-open");
});

renderLoading();
api("/api/auth/session").then(({ user }) => {
  currentUser = user;
  render();
}).catch((error) => {
  currentUser = null;
  render();
  toast(error.message, "error");
});
