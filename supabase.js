// ============================================================
// Verbinding met Supabase (inloggen en database)
// ============================================================
//
// De Project URL en de publishable key mogen openbaar zijn.
// Je gegevens worden beschermd door de beveiligingsregels in de database
// (Row Level Security, zie supabase/schema.sql), niet door deze sleutel.
// Zet hier NOOIT de secret key of service_role key neer.

const SUPABASE_URL = "https://qcuahxaqmgygnqlbjvbt.supabase.co";
const SUPABASE_SLEUTEL = "sb_publishable_7uv9D1f9mvc2nr7qbjQwGg_H-Xe1LDJ";

// "supabase" komt uit het script dat index.html van jsDelivr laadt.
// createClient maakt een verbinding waarmee we kunnen inloggen en de database gebruiken.
const db = supabase.createClient(SUPABASE_URL, SUPABASE_SLEUTEL);
