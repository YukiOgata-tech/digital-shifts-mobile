-- Supabaseの公開スキーマ関数にはanon/authenticated/service_roleへの既定GRANTが付くため、
-- モバイル用RPCからanonの明示GRANTを除去する。

revoke execute on function public.record_mobile_attendance_event(
  uuid, public.attendance_event_type, text, numeric, numeric, numeric, text
) from anon;

revoke execute on function public.submit_mobile_manual_attendance(
  uuid, date, time, time, integer, text
) from anon;
