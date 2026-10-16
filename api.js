import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY, STORAGE_BUCKET, MAX_PHOTO_SIZE } from "./config.js";

if (!SUPABASE_URL || SUPABASE_URL.startsWith("GANTI_") || !SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.startsWith("GANTI_")) {
  console.warn("Konfigurasi Supabase belum diisi. Edit config.js sebelum deploy.");
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

const STATUSES = ["Belum Ditemukan", "Sedang Ditelusuri", "Barang Ditemukan", "Sudah Dikembalikan"];
const CATEGORIES = ["Elektronik", "Dokumen", "Aksesori", "Pakaian", "Kendaraan", "Lainnya"];

function fail(message) { throw new Error(message); }
function errorMessage(error, fallback = "Permintaan tidak dapat diproses.") {
  if (!error) return fallback;
  if (error.code === "23505") return "Data tersebut sudah digunakan.";
  if (error.code === "42501") return "Anda tidak memiliki izin untuk melakukan tindakan ini.";
  if (error.message?.includes("Invalid login credentials")) return "Email/NIM/username atau kata sandi tidak sesuai.";
  if (error.message?.includes("Email not confirmed")) return "Email belum dikonfirmasi. Silakan konfirmasi email terlebih dahulu.";
  return error.message || fallback;
}

function toReport(row, privateData = false) {
  if (!row) return null;
  const result = {
    id: row.id,
    reportNumber: row.report_number,
    itemName: row.item_name,
    category: row.category,
    description: row.description,
    photo: row.photo,
    location: row.location,
    lostAt: row.lost_at,
    status: row.status,
    staffNote: row.staff_note || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
  if (privateData) {
    result.contact = row.contact;
    result.reporterName = row.profiles?.name || row.reporter_name || "";
    result.nim = row.profiles?.nim || row.nim || "";
  }
  return result;
}

function profileUser(user, profile) {
  return {
    id: user.id,
    name: profile?.name || user.user_metadata?.name || "Pengguna",
    nim: profile?.nim || user.user_metadata?.nim || "",
    email: user.email || profile?.email || "",
    username: profile?.username || "",
    studyProgram: profile?.study_program || user.user_metadata?.studyProgram || "",
    role: profile?.role || "student",
  };
}

async function getUserContext() {
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error) throw new Error(errorMessage(error, "Sesi tidak dapat diperiksa."));
  if (!user) return { user: null, profile: null };
  const { data: profile, error: profileError } = await supabase.from("profiles").select("id,name,nim,username,study_program,role").eq("id", user.id).single();
  if (profileError) throw new Error(errorMessage(profileError, "Profil pengguna tidak dapat dimuat."));
  return { user, profile };
}

async function requireUser() {
  const context = await getUserContext();
  if (!context.user) fail("Silakan masuk untuk melanjutkan.");
  return context;
}

async function requireStaff() {
  const context = await requireUser();
  if (context.profile.role !== "staff") fail("Halaman ini hanya dapat diakses oleh petugas.");
  return context;
}

function validateReport(body) {
  const fields = { itemName: "Nama barang", category: "Kategori", description: "Deskripsi", location: "Lokasi terakhir", lostAt: "Tanggal dan waktu kehilangan", contact: "Kontak" };
  for (const [field, label] of Object.entries(fields)) {
    if (typeof body[field] !== "string" || !body[field].trim()) return `${label} wajib diisi.`;
    if (body[field].trim().length > 1200) return `${label} terlalu panjang.`;
  }
  if (body.itemName.trim().length > 120) return "Nama barang maksimal 120 karakter.";
  if (body.location.trim().length > 180) return "Lokasi maksimal 180 karakter.";
  if (body.contact.trim().length > 40) return "Kontak maksimal 40 karakter.";
  if (!CATEGORIES.includes(body.category)) return "Kategori barang tidak valid.";
  if (Number.isNaN(Date.parse(body.lostAt))) return "Tanggal kehilangan tidak valid.";
  return null;
}

async function uploadPhoto(file, userId) {
  if (!(file instanceof File) || !file.size) return null;
  if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) fail("Foto harus berformat JPG, PNG, atau WebP.");
  if (file.size > MAX_PHOTO_SIZE) fail("Ukuran foto maksimal 5 MB.");
  const extension = file.type === "image/jpeg" ? "jpg" : file.type === "image/png" ? "png" : "webp";
  const path = `${userId}/${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { contentType: file.type, upsert: false, cacheControl: "3600" });
  if (error) throw new Error(errorMessage(error, "Foto gagal diunggah."));
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
  return { path, url: data.publicUrl };
}

async function removePhotoByUrl(url) {
  if (!url) return;
  try {
    const marker = `/storage/v1/object/public/${STORAGE_BUCKET}/`;
    const index = url.indexOf(marker);
    if (index < 0) return;
    const path = decodeURIComponent(url.slice(index + marker.length));
    await supabase.storage.from(STORAGE_BUCKET).remove([path]);
  } catch (error) {
    console.warn("Foto lama tidak berhasil dihapus:", error);
  }
}

async function publicSearch(query) {
  const q = String(query || "").trim();
  if (q.length < 3 || q.length > 100) fail("Masukkan minimal 3 karakter untuk mencari laporan.");
  const { data, error } = await supabase.rpc("public_search_reports", { p_query: q });
  if (error) throw new Error(errorMessage(error, "Pencarian tidak dapat dilakukan."));
  return { reports: (data || []).map(toReport) };
}

async function publicDetail(reportNumber) {
  const { data, error } = await supabase.rpc("public_report_detail", { p_report_number: reportNumber });
  if (error) throw new Error(errorMessage(error, "Laporan tidak ditemukan."));
  if (!data?.report) fail("Laporan tidak ditemukan.");
  return { report: toReport(data.report), updates: data.updates || [] };
}

export async function api(url, options = {}) {
  try {
    const method = (options.method || "GET").toUpperCase();
    const path = new URL(url, window.location.origin).pathname;
    const query = new URL(url, window.location.origin).searchParams;
    const rawBody = options.body;
    let body = rawBody;
    if (typeof rawBody === "string") {
      try { body = JSON.parse(rawBody); } catch { body = rawBody; }
    }

    if (path === "/api/health") return { status: "ok" };

    if (path === "/api/auth/session" || path === "/api/auth/me") {
      const { user, profile } = await getUserContext();
      return { user: user ? profileUser(user, profile) : null };
    }

    if (path === "/api/auth/register" && method === "POST") {
      const { name, nim, email, studyProgram, password } = body || {};
      if (![name, nim, email, studyProgram, password].every((value) => typeof value === "string" && value.trim())) fail("Lengkapi semua data yang diminta.");
      if (password.length < 8) fail("Kata sandi minimal 8 karakter.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) fail("Format email tidak valid.");
      if (!/^[A-Za-z0-9.-]+$/.test(nim.trim())) fail("NIM hanya boleh berisi huruf, angka, titik, atau tanda hubung.");
      const { data, error } = await supabase.auth.signUp({
        email: email.trim(), password,
        options: { data: { name: name.trim(), nim: nim.trim(), studyProgram: studyProgram.trim() } },
      });
      if (error) throw new Error(errorMessage(error, "Pendaftaran gagal."));
      if (!data.user) fail("Akun tidak berhasil dibuat.");
      return { user: data.session ? profileUser(data.user, { name, nim, study_program: studyProgram, role: "student" }) : null };
    }

    if (path === "/api/auth/login" && method === "POST") {
      const { identifier, password } = body || {};
      if (!identifier || !password) fail("Email, NIM, atau username dan kata sandi wajib diisi.");
      let email = String(identifier).trim();
      if (!email.includes("@")) {
        const { data, error } = await supabase.rpc("resolve_login_email", { p_identifier: email });
        if (error) throw new Error(errorMessage(error, "Data masuk tidak sesuai."));
        if (!data) fail("Data masuk tidak sesuai.");
        email = data;
      }
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw new Error(errorMessage(error, "Data masuk tidak sesuai."));
      const { profile } = await getUserContext();
      return { user: profileUser(data.user, profile) };
    }

    if (path === "/api/auth/logout" && method === "POST") {
      const { error } = await supabase.auth.signOut();
      if (error) throw new Error(errorMessage(error, "Gagal keluar."));
      return { success: true };
    }

    if (path === "/api/profile" && method === "PATCH") {
      const { user, profile } = await requireUser();
      const { name, email, studyProgram } = body || {};
      if (![name, email, studyProgram].every((value) => typeof value === "string" && value.trim())) fail("Nama, email, dan program studi wajib diisi.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) fail("Format email tidak valid.");
      const { error: authError } = email.trim() !== user.email ? await supabase.auth.updateUser({ email: email.trim() }) : { error: null };
      if (authError) throw new Error(errorMessage(authError, "Email tidak dapat diperbarui."));
      const { data: updated, error } = await supabase.from("profiles").update({ name: name.trim(), study_program: studyProgram.trim() }).eq("id", user.id).select("id,name,nim,username,study_program,role").single();
      if (error) throw new Error(errorMessage(error, "Profil tidak dapat diperbarui."));
      return { user: profileUser(user, updated) };
    }

    if (path === "/api/dashboard") {
      const { user, profile } = await requireUser();
      if (profile.role === "staff") {
        const { data: rows, error } = await supabase.from("reports").select("*,profiles!reports_user_id_fkey(name,nim)").order("created_at", { ascending: false }).limit(8);
        if (error) throw new Error(errorMessage(error));
        const { data: statsRows, error: statsError } = await supabase.from("reports").select("status");
        if (statsError) throw new Error(errorMessage(statsError));
        const stats = { total: statsRows.length, new: statsRows.filter(r => r.status === STATUSES[0]).length, searching: statsRows.filter(r => r.status === STATUSES[1]).length, found: statsRows.filter(r => r.status === STATUSES[2]).length, returned: statsRows.filter(r => r.status === STATUSES[3]).length };
        return { stats, reports: rows.map(row => toReport(row, true)) };
      }
      const { data: rows, error } = await supabase.from("reports").select("*").eq("user_id", user.id).order("created_at", { ascending: false }).limit(6);
      if (error) throw new Error(errorMessage(error));
      const statsRows = rows;
      const { count, error: countError } = await supabase.from("reports").select("id", { count: "exact", head: true }).eq("user_id", user.id);
      if (countError) throw new Error(errorMessage(countError));
      const { data: allRows, error: allError } = await supabase.from("reports").select("status").eq("user_id", user.id);
      if (allError) throw new Error(errorMessage(allError));
      return { stats: { total: count || 0, inProgress: allRows.filter(r => r.status === STATUSES[1]).length, found: allRows.filter(r => r.status === STATUSES[2]).length, returned: allRows.filter(r => r.status === STATUSES[3]).length }, reports: statsRows.map(toReport) };
    }

    if (path === "/api/reports/mine") {
      const { user } = await requireUser();
      const { data, error } = await supabase.from("reports").select("*").eq("user_id", user.id).order("created_at", { ascending: false });
      if (error) throw new Error(errorMessage(error));
      return { reports: data.map(toReport) };
    }

    if (path === "/api/reports" && method === "POST") {
      const { user, profile } = await requireUser();
      if (profile.role !== "student") fail("Akun petugas tidak dapat membuat laporan mahasiswa.");
      const form = rawBody instanceof FormData ? Object.fromEntries(rawBody.entries()) : body;
      const validation = validateReport(form);
      if (validation) fail(validation);
      const file = rawBody instanceof FormData ? rawBody.get("photo") : null;
      const uploaded = file instanceof File && file.size ? await uploadPhoto(file, user.id) : null;
      const payload = { user_id: user.id, item_name: form.itemName.trim(), category: form.category, description: form.description.trim(), photo: uploaded?.url || null, location: form.location.trim(), lost_at: new Date(form.lostAt).toISOString(), contact: form.contact.trim() };
      const { data, error } = await supabase.from("reports").insert(payload).select("*").single();
      if (error) { if (uploaded) await removePhotoByUrl(uploaded.url); throw new Error(errorMessage(error, "Laporan gagal dibuat.")); }
      return { report: toReport(data), message: "Laporan berhasil dikirim." };
    }

    if (path === "/api/reports/search") return publicSearch(query.get("q"));
    if (path.startsWith("/api/reports/") && method === "GET") return publicDetail(decodeURIComponent(path.slice("/api/reports/".length)));

    if (path === "/api/found") {
      const { data, error } = await supabase.rpc("public_found_reports");
      if (error) throw new Error(errorMessage(error, "Daftar barang temuan tidak dapat dimuat."));
      return { reports: (data || []).map(toReport) };
    }

    if (path === "/api/staff/reports" && method === "GET") {
      await requireStaff();
      const status = query.get("status") || "";
      const q = query.get("q")?.trim() || "";
      let request = supabase.from("reports").select("*,profiles!reports_user_id_fkey(name,nim)").order("created_at", { ascending: false }).limit(100);
      if (status) request = request.eq("status", status);
      if (q) request = request.or(`report_number.ilike.%${q}%,item_name.ilike.%${q}%`);
      const { data, error } = await request;
      if (error) throw new Error(errorMessage(error));
      return { reports: data.map(row => toReport(row, true)) };
    }

    if (path === "/api/staff/reports" && method === "POST") {
      const { user } = await requireStaff();
      const validation = validateReport(body);
      if (validation) fail(validation);
      if (!STATUSES.includes(body.status)) fail("Status laporan tidak valid.");
      if (typeof body.note !== "string" || body.note.length > 500) fail("Catatan maksimal 500 karakter.");
      const { data, error } = await supabase.from("reports").insert({ user_id: user.id, item_name: body.itemName.trim(), category: body.category, description: body.description.trim(), location: body.location.trim(), lost_at: new Date(body.lostAt).toISOString(), contact: body.contact.trim(), status: body.status, staff_note: body.note.trim() }).select("*,profiles!reports_user_id_fkey(name,nim)").single();
      if (error) throw new Error(errorMessage(error, "Laporan gagal dibuat."));
      return { report: toReport(data, true), message: "Laporan berhasil ditambahkan." };
    }

    const staffMatch = path.match(/^\/api\/staff\/reports\/(.+)$/);
    if (staffMatch && method === "PATCH") {
      const { user } = await requireStaff();
      const id = decodeURIComponent(staffMatch[1]);
      const validation = validateReport(body);
      if (validation) fail(validation);
      if (!STATUSES.includes(body.status)) fail("Status laporan tidak valid.");
      if (typeof body.note !== "string" || body.note.length > 500) fail("Catatan maksimal 500 karakter.");
      const { data, error } = await supabase.from("reports").update({ item_name: body.itemName.trim(), category: body.category, description: body.description.trim(), location: body.location.trim(), lost_at: new Date(body.lostAt).toISOString(), contact: body.contact.trim(), status: body.status, staff_note: body.note.trim(), updated_at: new Date().toISOString() }).eq("id", id).select("*,profiles!reports_user_id_fkey(name,nim)").single();
      if (error) throw new Error(errorMessage(error, "Laporan tidak dapat diperbarui."));
      const { error: updateError } = await supabase.from("report_updates").insert({ report_id: data.id, staff_id: user.id, status: body.status, note: body.note.trim() });
      if (updateError) throw new Error(errorMessage(updateError, "Riwayat laporan tidak dapat disimpan."));
      return { report: toReport(data, true), message: "Laporan berhasil diperbarui." };
    }

    if (staffMatch && method === "DELETE") {
      await requireStaff();
      const id = decodeURIComponent(staffMatch[1]);
      const { data: report, error: readError } = await supabase.from("reports").select("id,photo").eq("id", id).single();
      if (readError) throw new Error(errorMessage(readError, "Laporan tidak ditemukan."));
      const { error } = await supabase.from("reports").delete().eq("id", id);
      if (error) throw new Error(errorMessage(error, "Laporan tidak dapat dihapus."));
      await removePhotoByUrl(report.photo);
      return { success: true, message: "Laporan berhasil dihapus." };
    }

    fail("Endpoint tidak ditemukan.");
  } catch (error) {
    throw new Error(errorMessage(error));
  }
}
