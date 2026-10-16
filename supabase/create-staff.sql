-- 1. Buat user staff terlebih dahulu di Supabase Dashboard:
--    Authentication -> Users -> Add user.
-- 2. Setelah user dibuat, ganti email di bawah lalu jalankan SQL ini.

update public.profiles p
set role = 'staff', updated_at = now()
from auth.users u
where p.id = u.id
  and lower(u.email) = lower('staff@kampus.ac.id');

-- Verifikasi:
select p.id, u.email, p.name, p.role
from public.profiles p
join auth.users u on u.id = p.id
where lower(u.email) = lower('staff@kampus.ac.id');
