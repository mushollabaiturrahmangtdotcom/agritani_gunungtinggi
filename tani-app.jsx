import { useState, useRef, useEffect, useCallback } from "react";

// ─── Firebase Config (ganti dengan config Firebase Anda) ───
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDgENEXLI4CR8fxgdzTYN3dpL5MyQ6ughU",
  projectId: "agritani-gunungtinggi",
  databaseURL: "https://agritani-gunungtinggi-default-rtdb.asia-southeast1.firebasedatabase.app",
  storageBucket: "agritani-gunungtinggi.firebasestorage.app",
};

// ─── Firebase REST helper ───
const fbUrl = (path) =>
  `${FIREBASE_CONFIG.databaseURL}/${path}.json?auth=${FIREBASE_CONFIG.apiKey}`;

async function fbGet(path) {
  const r = await fetch(fbUrl(path));
  return r.ok ? r.json() : null;
}
async function fbSet(path, data) {
  await fetch(fbUrl(path), { method: "PUT", body: JSON.stringify(data) });
}
async function fbPush(path, data) {
  const r = await fetch(fbUrl(path), { method: "POST", body: JSON.stringify(data) });
  return r.json();
}

// ─── Anthropic API helper ───
async function callClaude(messages, systemPrompt = "", useVision = false) {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 1000,
      system: systemPrompt,
      messages,
    }),
  });
  const data = await response.json();
  return data.content?.map((c) => c.text || "").join("") || "Gagal mendapat respons.";
}

// ─── Color palette ───
const colors = {
  primary: "#2D6A4F",
  primary2: "#40916C",
  accent: "#95D5B2",
  light: "#D8F3DC",
  bg: "#F0FBF3",
  text: "#1B4332",
  muted: "#52796F",
  white: "#FFFFFF",
  warning: "#E9C46A",
  danger: "#E76F51",
  info: "#48CAE4",
  gold: "#F4A261",
};

// ─── Data statis ───
const KELOMPOK_TANI = [
  { id: 1, nama: "Marga Tani", desa: "Kelurahan Gunung Tinggi", kec: "Batulicin", kota: "Tanah Bumbu", kontak: "081234567890", komoditas: ["Padi"], anggota: 45, lat: -3.47135, lng: 115.95373 },
  { id: 2, nama: "GAPOKTAN BINA Bersama", desa: "Kelurahan Gunung Tinggi", kec: "Batulicin", kota: "Tanah Bumbu", kontak: "081234567890", komoditas: ["Padi"], anggota: 45, lat: -3.47135, lng: 115.95373 },

];

const HARGA_PASAR = [
  { komoditas: "Padi (GKP)", satuan: "kg", harga: 5200, trend: "up", persen: 2.1 },
  { komoditas: "Jagung", satuan: "kg", harga: 4800, trend: "up", persen: 1.5 },
  { komoditas: "Kedelai", satuan: "kg", harga: 9500, trend: "down", persen: 0.8 },
  { komoditas: "Cabai Merah", satuan: "kg", harga: 28000, trend: "up", persen: 5.2 },
  { komoditas: "Bawang Merah", satuan: "kg", harga: 22000, trend: "down", persen: 1.2 },
  { komoditas: "Tomat", satuan: "kg", harga: 8500, trend: "up", persen: 3.4 },
  { komoditas: "Singkong", satuan: "kg", harga: 1800, trend: "stable", persen: 0 },
  { komoditas: "Karet", satuan: "kg", harga: 12500, trend: "up", persen: 1.8 },
];

const TIPS_PERTANIAN = [
  { id: 1, judul: "Cara Mengatasi Hama Wereng Padi", kategori: "Hama", isi: "Gunakan varietas tahan wereng, tanam serempak, dan gunakan pestisida nabati dari daun mimba bila serangan ringan." },
  { id: 2, judul: "Pemupukan Organik untuk Sayuran", kategori: "Nutrisi", isi: "Kompos matang, pupuk kandang, dan pupuk hijau meningkatkan kesuburan tanah secara berkelanjutan." },
  { id: 3, judul: "Irigasi Tetes untuk Hemat Air", kategori: "Irigasi", isi: "Sistem irigasi tetes menghemat air 30-50% dibanding irigasi konvensional dan mengurangi risiko penyakit jamur." },
  { id: 4, judul: "Rotasi Tanaman Cegah Penyakit", kategori: "Budidaya", isi: "Ganti jenis tanaman setiap musim tanam untuk memutus siklus hama dan penyakit tanah." },
];

// ─── Main App ───
export default function TaniApp() {
  const [tab, setTab] = useState("home");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const [diseaseResult, setDiseaseResult] = useState(null);
  const [diseaseLoading, setDiseaseLoading] = useState(false);
  const [capturedImage, setCapturedImage] = useState(null);
  const [searchKT, setSearchKT] = useState("");
  const [jadwalList, setJadwalList] = useState([
    { id: 1, tanaman: "Padi IR64", lahan: "0.5 ha", tanam: "2026-06-10", panen: "2026-10-10", catatan: "Pupuk NPK minggu ke-3" },
  ]);
  const [jadwalForm, setJadwalForm] = useState({ tanaman: "", lahan: "", tanam: "", panen: "", catatan: "" });
  const [showJadwalForm, setShowJadwalForm] = useState(false);
  const [cuaca, setCuaca] = useState(null);
  const [selectedKT, setSelectedKT] = useState(null);
  const fileRef = useRef();
  const chatEndRef = useRef();

  // Fetch cuaca (Open-Meteo, gratis)
  useEffect(() => {
    fetch("https://api.open-meteo.com/v1/forecast?latitude=-3.47242&longitude=115.95039&current=temperature_2m,weathercode,windspeed_10m,relative_humidity_2m&daily=temperature_2m_max,temperature_2m_min,precipitation_sum&timezone=Asia%2FMakassar&forecast_days=5")
      .then((r) => r.json())
      .then((d) => setCuaca(d))
      .catch(() => {});
  }, []);

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: "smooth" }); }, [chatMessages]);

  const weatherCode = (code) => {
    if (code === 0) return { label: "Cerah", icon: "☀️" };
    if (code <= 3) return { label: "Berawan", icon: "⛅" };
    if (code <= 67) return { label: "Hujan", icon: "🌧️" };
    if (code <= 77) return { label: "Bersalju", icon: "❄️" };
    return { label: "Badai", icon: "⛈️" };
  };

  // ── Chat AI ──
  const sendChat = async () => {
    if (!chatInput.trim() || chatLoading) return;
    const userMsg = { role: "user", content: chatInput };
    const newMsgs = [...chatMessages, userMsg];
    setChatMessages(newMsgs);
    setChatInput("");
    setChatLoading(true);
    try {
      const reply = await callClaude(
        newMsgs,
        "Kamu adalah asisten pertanian ahli untuk petani Indonesia, khususnya Kalimantan Selatan. Jawab dalam Bahasa Indonesia yang mudah dipahami petani. Fokus pada pertanian tropis, hama, pupuk, cuaca, dan hasil panen. Jawab singkat dan praktis."
      );
      setChatMessages([...newMsgs, { role: "assistant", content: reply }]);
    } catch {
      setChatMessages([...newMsgs, { role: "assistant", content: "Maaf, terjadi kesalahan koneksi." }]);
    }
    setChatLoading(false);
  };

  // ── Deteksi Penyakit ──
  const handleImageUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      const base64 = ev.target.result.split(",")[1];
      setCapturedImage(ev.target.result);
      setDiseaseResult(null);
      setDiseaseLoading(true);
      try {
        const response = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            system: "Kamu adalah ahli patologi tanaman. Analisis gambar tanaman dan identifikasi penyakit/hama. Jawab dalam Bahasa Indonesia dengan format JSON: {\"tanaman\": \"...\", \"kondisi\": \"...\", \"penyakit\": \"...\", \"penyebab\": \"...\", \"gejala\": \"...\", \"pengobatan\": \"...\", \"pencegahan\": \"...\", \"tingkat_keparahan\": \"ringan/sedang/parah\"}. Hanya JSON, tanpa komentar.",
            messages: [{
              role: "user",
              content: [
                { type: "image", source: { type: "base64", media_type: file.type || "image/jpeg", data: base64 } },
                { type: "text", text: "Analisis kondisi tanaman dalam foto ini." }
              ]
            }]
          })
        });
        const data = await response.json();
        const text = data.content?.map((c) => c.text || "").join("") || "{}";
        const clean = text.replace(/```json|```/g, "").trim();
        setDiseaseResult(JSON.parse(clean));
      } catch {
        setDiseaseResult({ penyakit: "Gagal menganalisis", penyebab: "Error koneksi", pengobatan: "Coba lagi", tingkat_keparahan: "unknown" });
      }
      setDiseaseLoading(false);
    };
    reader.readAsDataURL(file);
  };

  // ── Jadwal ──
  const addJadwal = () => {
    if (!jadwalForm.tanaman) return;
    setJadwalList([...jadwalList, { ...jadwalForm, id: Date.now() }]);
    setJadwalForm({ tanaman: "", lahan: "", tanam: "", panen: "", catatan: "" });
    setShowJadwalForm(false);
  };

  const filteredKT = KELOMPOK_TANI.filter((kt) =>
    kt.nama.toLowerCase().includes(searchKT.toLowerCase()) ||
    kt.kec.toLowerCase().includes(searchKT.toLowerCase()) ||
    kt.komoditas.some((k) => k.toLowerCase().includes(searchKT.toLowerCase()))
  );

  // ── Styles ──
  const S = {
    app: { fontFamily: "'Nunito', system-ui, sans-serif", background: colors.bg, minHeight: "100vh", maxWidth: 430, margin: "0 auto", position: "relative", paddingBottom: 72 },
    header: { background: `linear-gradient(135deg, ${colors.primary} 0%, ${colors.primary2} 100%)`, color: "#fff", padding: "20px 20px 16px", position: "sticky", top: 0, zIndex: 10 },
    headerTitle: { fontSize: 20, fontWeight: 800, margin: 0, letterSpacing: -0.5 },
    headerSub: { fontSize: 12, opacity: 0.8, marginTop: 2 },
    nav: { position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)", width: "100%", maxWidth: 430, background: "#fff", borderTop: `1px solid ${colors.accent}`, display: "flex", zIndex: 20, boxShadow: "0 -4px 20px rgba(0,0,0,0.08)" },
    navBtn: (active) => ({ flex: 1, padding: "10px 0 8px", border: "none", background: "none", cursor: "pointer", display: "flex", flexDirection: "column", alignItems: "center", gap: 3, color: active ? colors.primary : colors.muted, fontFamily: "inherit" }),
    navIcon: { fontSize: 22 },
    navLabel: (active) => ({ fontSize: 9, fontWeight: active ? 700 : 500, letterSpacing: 0.3, textTransform: "uppercase" }),
    content: { padding: "0 0 8px" },
    card: { background: "#fff", borderRadius: 16, margin: "12px 16px", padding: 16, boxShadow: "0 2px 12px rgba(45,106,79,0.08)", border: `1px solid ${colors.light}` },
    sectionTitle: { fontSize: 13, fontWeight: 800, color: colors.muted, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 },
    btn: (color = colors.primary) => ({ background: color, color: "#fff", border: "none", borderRadius: 12, padding: "10px 18px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "inherit" }),
    input: { border: `1.5px solid ${colors.accent}`, borderRadius: 10, padding: "10px 14px", fontSize: 14, fontFamily: "inherit", background: colors.bg, width: "100%", boxSizing: "border-box", outline: "none", color: colors.text },
    badge: (color) => ({ background: color + "22", color: color, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, display: "inline-block" }),
    pill: { background: colors.light, color: colors.primary, fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 20, display: "inline-block", margin: "2px 2px 0 0" },
  };

  const NAV_ITEMS = [
    { id: "home", icon: "🏡", label: "Beranda" },
    { id: "ai", icon: "🤖", label: "Tanya AI" },
    { id: "scan", icon: "📷", label: "Scan" },
    { id: "kelompok", icon: "👥", label: "Kelompok" },
    { id: "jadwal", icon: "📅", label: "Jadwal" },
  ];

  // ─────────────── PAGES ───────────────

  const HomePage = () => (
    <div>
      {/* Cuaca */}
      <div style={{ ...S.card, background: `linear-gradient(135deg, ${colors.primary2}, ${colors.primary})`, color: "#fff", border: "none" }}>
        <div style={{ fontSize: 12, opacity: 0.8, marginBottom: 4 }}>📍 Tanah Bumbu, Kalteng</div>
        {cuaca ? (
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ fontSize: 48 }}>{weatherCode(cuaca.current.weathercode).icon}</div>
              <div>
                <div style={{ fontSize: 36, fontWeight: 800 }}>{Math.round(cuaca.current.temperature_2m)}°C</div>
                <div style={{ fontSize: 14, opacity: 0.9 }}>{weatherCode(cuaca.current.weathercode).label}</div>
              </div>
            </div>
            <div style={{ display: "flex", gap: 16, marginTop: 12, fontSize: 12, opacity: 0.85 }}>
              <span>💧 {cuaca.current.relative_humidity_2m}%</span>
              <span>🌬️ {Math.round(cuaca.current.windspeed_10m)} km/h</span>
            </div>
            {/* Forecast 5 hari */}
            <div style={{ display: "flex", gap: 8, marginTop: 14, overflowX: "auto", paddingBottom: 4 }}>
              {cuaca.daily.time.slice(0, 5).map((t, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,0.15)", borderRadius: 10, padding: "8px 10px", textAlign: "center", minWidth: 52 }}>
                  <div style={{ fontSize: 10, opacity: 0.8 }}>{new Date(t).toLocaleDateString("id", { weekday: "short" })}</div>
                  <div style={{ fontSize: 18, margin: "4px 0" }}>{weatherCode(cuaca.daily.weathercode?.[i] || 0).icon}</div>
                  <div style={{ fontSize: 11, fontWeight: 700 }}>{Math.round(cuaca.daily.temperature_2m_max[i])}°</div>
                  <div style={{ fontSize: 10, opacity: 0.7 }}>{Math.round(cuaca.daily.temperature_2m_min[i])}°</div>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <div style={{ fontSize: 13, opacity: 0.8 }}>Memuat cuaca...</div>
        )}
      </div>

      {/* Menu cepat */}
      <div style={{ padding: "0 16px" }}>
        <div style={S.sectionTitle}>Menu Cepat</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { icon: "🤖", label: "Tanya AI", sub: "Konsultasi pertanian", tab: "ai", color: colors.primary },
            { icon: "📷", label: "Scan Penyakit", sub: "Foto & analisis", tab: "scan", color: "#E76F51" },
            { icon: "👥", label: "Kelompok Tani", sub: "Cari kelompok", tab: "kelompok", color: "#48CAE4" },
            { icon: "📅", label: "Jadwal Tanam", sub: "Atur jadwal", tab: "jadwal", color: colors.gold },
          ].map((m) => (
            <button key={m.tab} onClick={() => setTab(m.tab)} style={{ background: "#fff", border: `1px solid ${colors.light}`, borderRadius: 14, padding: 14, textAlign: "left", cursor: "pointer", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
              <div style={{ fontSize: 28, marginBottom: 6 }}>{m.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 800, color: m.color }}>{m.label}</div>
              <div style={{ fontSize: 11, color: colors.muted, marginTop: 2 }}>{m.sub}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Harga Pasar */}
      <div style={{ ...S.card, marginTop: 12 }}>
        <div style={S.sectionTitle}>💰 Harga Pasar Hari Ini</div>
        {HARGA_PASAR.map((h) => (
          <div key={h.komoditas} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderBottom: `1px solid ${colors.light}` }}>
            <div style={{ fontSize: 14, color: colors.text, fontWeight: 600 }}>{h.komoditas}</div>
            <div style={{ textAlign: "right" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: colors.text }}>Rp {h.harga.toLocaleString()}/{h.satuan}</div>
              <div style={{ fontSize: 11, color: h.trend === "up" ? "#2D9E5F" : h.trend === "down" ? colors.danger : colors.muted }}>
                {h.trend === "up" ? "▲" : h.trend === "down" ? "▼" : "─"} {h.persen > 0 ? `${h.persen}%` : "Stabil"}
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Tips */}
      <div style={{ ...S.card }}>
        <div style={S.sectionTitle}>📚 Tips Pertanian</div>
        {TIPS_PERTANIAN.map((t) => (
          <div key={t.id} style={{ marginBottom: 12, paddingBottom: 12, borderBottom: `1px solid ${colors.light}` }}>
            <span style={S.badge(colors.primary)}>{t.kategori}</span>
            <div style={{ fontSize: 14, fontWeight: 700, color: colors.text, margin: "6px 0 3px" }}>{t.judul}</div>
            <div style={{ fontSize: 13, color: colors.muted, lineHeight: 1.5 }}>{t.isi}</div>
          </div>
        ))}
      </div>
    </div>
  );

  const AIPage = () => (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 130px)" }}>
      <div style={{ padding: "12px 16px 0" }}>
        <div style={{ ...S.card, background: colors.light, border: "none", padding: "12px 14px", margin: 0 }}>
          <div style={{ fontSize: 13, color: colors.primary, fontWeight: 700 }}>🌱 Asisten Pertanian AI</div>
          <div style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>Tanya tentang hama, pupuk, cuaca tanam, panen, dan lainnya.</div>
        </div>
      </div>

      {/* Chat area */}
      <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px" }}>
        {chatMessages.length === 0 && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 8 }}>
            {["Cara mengatasi hama wereng?", "Kapan waktu tanam padi terbaik?", "Dosis pupuk urea untuk jagung?", "Cara buat pestisida nabati?"].map((q) => (
              <button key={q} onClick={() => { setChatInput(q); }} style={{ background: "#fff", border: `1px solid ${colors.accent}`, borderRadius: 10, padding: "10px 12px", fontSize: 12, color: colors.primary, cursor: "pointer", textAlign: "left", fontFamily: "inherit", fontWeight: 600 }}>
                {q}
              </button>
            ))}
          </div>
        )}
        {chatMessages.map((m, i) => (
          <div key={i} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start", marginBottom: 10 }}>
            {m.role === "assistant" && <div style={{ fontSize: 22, marginRight: 8, alignSelf: "flex-end" }}>🌿</div>}
            <div style={{ maxWidth: "78%", background: m.role === "user" ? colors.primary : "#fff", color: m.role === "user" ? "#fff" : colors.text, borderRadius: m.role === "user" ? "16px 16px 4px 16px" : "16px 16px 16px 4px", padding: "10px 14px", fontSize: 13, lineHeight: 1.6, boxShadow: "0 2px 8px rgba(0,0,0,0.08)", border: m.role === "assistant" ? `1px solid ${colors.light}` : "none", whiteSpace: "pre-wrap" }}>
              {m.content}
            </div>
          </div>
        ))}
        {chatLoading && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 0" }}>
            <div style={{ fontSize: 22 }}>🌿</div>
            <div style={{ background: "#fff", borderRadius: 12, padding: "10px 14px", fontSize: 13, color: colors.muted, border: `1px solid ${colors.light}` }}>Sedang berpikir...</div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Input */}
      <div style={{ padding: "10px 16px 12px", background: colors.bg, borderTop: `1px solid ${colors.light}` }}>
        <div style={{ display: "flex", gap: 8 }}>
          <input value={chatInput} onChange={(e) => setChatInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && sendChat()} placeholder="Tanyakan seputar pertanian..." style={{ ...S.input, flex: 1 }} />
          <button onClick={sendChat} disabled={chatLoading} style={{ ...S.btn(), borderRadius: 10, padding: "10px 14px" }}>➤</button>
        </div>
      </div>
    </div>
  );

  const ScanPage = () => (
    <div style={{ padding: "0 16px" }}>
      <div style={{ ...S.card, textAlign: "center", border: `2px dashed ${colors.accent}`, background: colors.light }}>
        <div style={{ fontSize: 48, marginBottom: 8 }}>📷</div>
        <div style={{ fontSize: 15, fontWeight: 800, color: colors.primary, marginBottom: 4 }}>Deteksi Penyakit Tanaman</div>
        <div style={{ fontSize: 13, color: colors.muted, marginBottom: 14, lineHeight: 1.5 }}>Ambil atau upload foto tanaman untuk mendeteksi penyakit, hama, dan cara penanganannya menggunakan AI.</div>
        <input ref={fileRef} type="file" accept="image/*" capture="environment" onChange={handleImageUpload} style={{ display: "none" }} />
        <div style={{ display: "flex", gap: 8, justifyContent: "center" }}>
          <button onClick={() => { fileRef.current.removeAttribute("capture"); fileRef.current.click(); }} style={S.btn(colors.muted)}>
            🖼️ Galeri
          </button>
          <button onClick={() => { fileRef.current.setAttribute("capture", "environment"); fileRef.current.click(); }} style={S.btn()}>
            📷 Kamera
          </button>
        </div>
      </div>

      {capturedImage && (
        <div style={S.card}>
          <img src={capturedImage} alt="Tanaman" style={{ width: "100%", borderRadius: 10, marginBottom: 12 }} />
          {diseaseLoading && (
            <div style={{ textAlign: "center", padding: 16 }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🔍</div>
              <div style={{ fontSize: 14, color: colors.muted }}>AI sedang menganalisis tanaman...</div>
            </div>
          )}
          {diseaseResult && !diseaseLoading && (
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ fontSize: 16, fontWeight: 800, color: colors.text }}>{diseaseResult.tanaman || "Tanaman"}</div>
                <span style={S.badge(diseaseResult.tingkat_keparahan === "parah" ? colors.danger : diseaseResult.tingkat_keparahan === "sedang" ? colors.gold : colors.primary)}>
                  {diseaseResult.tingkat_keparahan?.toUpperCase() || "TERDETEKSI"}
                </span>
              </div>
              {[
                { label: "🦠 Penyakit", val: diseaseResult.penyakit },
                { label: "⚠️ Penyebab", val: diseaseResult.penyebab },
                { label: "😷 Gejala", val: diseaseResult.gejala },
                { label: "💊 Pengobatan", val: diseaseResult.pengobatan },
                { label: "🛡️ Pencegahan", val: diseaseResult.pencegahan },
              ].map((row) => row.val && (
                <div key={row.label} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 800, color: colors.muted, marginBottom: 2 }}>{row.label}</div>
                  <div style={{ fontSize: 13, color: colors.text, lineHeight: 1.6, background: colors.bg, borderRadius: 8, padding: "8px 10px" }}>{row.val}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );

  const KelompokPage = () => (
    <div style={{ padding: "0 16px" }}>
      <input value={searchKT} onChange={(e) => setSearchKT(e.target.value)} placeholder="🔍 Cari nama, kecamatan, komoditas..." style={{ ...S.input, margin: "12px 0" }} />
      <div style={{ fontSize: 12, color: colors.muted, marginBottom: 8 }}>{filteredKT.length} kelompok ditemukan</div>
      {filteredKT.map((kt) => (
        <div key={kt.id} style={{ ...S.card, cursor: "pointer", transition: "transform 0.1s", ...(selectedKT?.id === kt.id ? { border: `2px solid ${colors.primary}` } : {}) }} onClick={() => setSelectedKT(selectedKT?.id === kt.id ? null : kt)}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: 15, fontWeight: 800, color: colors.text }}>{kt.nama}</div>
              <div style={{ fontSize: 12, color: colors.muted, marginTop: 3 }}>📍 {kt.desa}, {kt.kec}, {kt.kota}</div>
            </div>
            <span style={S.badge(colors.primary2)}>{kt.anggota} anggota</span>
          </div>
          <div style={{ marginTop: 8 }}>
            {kt.komoditas.map((k) => <span key={k} style={S.pill}>{k}</span>)}
          </div>
          {selectedKT?.id === kt.id && (
            <div style={{ marginTop: 12, paddingTop: 12, borderTop: `1px solid ${colors.light}` }}>
              <div style={{ display: "flex", gap: 10 }}>
                <a href={`tel:${kt.kontak}`} style={{ ...S.btn(), textDecoration: "none", flex: 1, justifyContent: "center", fontSize: 13 }}>📞 Hubungi</a>
                <a href={`https://maps.google.com/?q=${kt.lat},${kt.lng}`} target="_blank" rel="noreferrer" style={{ ...S.btn(colors.info), textDecoration: "none", flex: 1, justifyContent: "center", fontSize: 13 }}>🗺️ Peta</a>
              </div>
            </div>
          )}
        </div>
      ))}
    </div>
  );

  const JadwalPage = () => (
    <div style={{ padding: "0 16px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "12px 0" }}>
        <div style={{ fontSize: 15, fontWeight: 800, color: colors.text }}>📅 Jadwal Tanam Saya</div>
        <button onClick={() => setShowJadwalForm(!showJadwalForm)} style={S.btn()}>+ Tambah</button>
      </div>

      {showJadwalForm && (
        <div style={{ ...S.card, border: `2px solid ${colors.primary}` }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: colors.primary, marginBottom: 12 }}>Tambah Jadwal Baru</div>
          {[
            { key: "tanaman", label: "Jenis Tanaman", placeholder: "cth: Padi IR64" },
            { key: "lahan", label: "Luas Lahan", placeholder: "cth: 0.5 ha" },
            { key: "tanam", label: "Tanggal Tanam", placeholder: "", type: "date" },
            { key: "panen", label: "Estimasi Panen", placeholder: "", type: "date" },
            { key: "catatan", label: "Catatan", placeholder: "Opsional" },
          ].map((f) => (
            <div key={f.key} style={{ marginBottom: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: colors.muted, marginBottom: 4 }}>{f.label}</div>
              <input type={f.type || "text"} value={jadwalForm[f.key]} onChange={(e) => setJadwalForm({ ...jadwalForm, [f.key]: e.target.value })} placeholder={f.placeholder} style={S.input} />
            </div>
          ))}
          <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
            <button onClick={addJadwal} style={{ ...S.btn(), flex: 1 }}>✓ Simpan</button>
            <button onClick={() => setShowJadwalForm(false)} style={{ ...S.btn(colors.muted), flex: 1 }}>✕ Batal</button>
          </div>
        </div>
      )}

      {jadwalList.map((j) => {
        const today = new Date();
        const tanam = new Date(j.tanam);
        const panen = new Date(j.panen);
        const total = panen - tanam;
        const elapsed = today - tanam;
        const progress = Math.min(100, Math.max(0, Math.round((elapsed / total) * 100)));
        const hariPanen = Math.max(0, Math.round((panen - today) / (1000 * 60 * 60 * 24)));

        return (
          <div key={j.id} style={S.card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
              <div>
                <div style={{ fontSize: 16, fontWeight: 800, color: colors.text }}>🌾 {j.tanaman}</div>
                <div style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>📐 {j.lahan}</div>
              </div>
              <span style={S.badge(hariPanen < 14 ? colors.gold : colors.primary)}>
                {hariPanen > 0 ? `${hariPanen} hari lagi` : "Panen!"}
              </span>
            </div>
            <div style={{ display: "flex", gap: 16, margin: "10px 0", fontSize: 12, color: colors.muted }}>
              <span>🌱 Tanam: {j.tanam}</span>
              <span>🌾 Panen: {j.panen}</span>
            </div>
            {/* Progress bar */}
            <div style={{ background: colors.light, borderRadius: 99, height: 8, overflow: "hidden" }}>
              <div style={{ width: `${progress}%`, height: "100%", background: `linear-gradient(90deg, ${colors.accent}, ${colors.primary})`, borderRadius: 99, transition: "width 0.5s" }} />
            </div>
            <div style={{ fontSize: 11, color: colors.muted, marginTop: 4 }}>{progress}% masa tanam</div>
            {j.catatan && <div style={{ fontSize: 12, color: colors.muted, marginTop: 8, fontStyle: "italic" }}>📝 {j.catatan}</div>}
            <button onClick={() => setJadwalList(jadwalList.filter((x) => x.id !== j.id))} style={{ marginTop: 10, background: "none", border: `1px solid ${colors.danger}22`, color: colors.danger, borderRadius: 8, padding: "6px 12px", fontSize: 12, cursor: "pointer", fontFamily: "inherit" }}>🗑️ Hapus</button>
          </div>
        );
      })}

      {jadwalList.length === 0 && (
        <div style={{ textAlign: "center", padding: 32, color: colors.muted }}>
          <div style={{ fontSize: 48, marginBottom: 8 }}>📅</div>
          <div style={{ fontSize: 14 }}>Belum ada jadwal tanam</div>
        </div>
      )}
    </div>
  );

  const PAGE_MAP = { home: <HomePage />, ai: <AIPage />, scan: <ScanPage />, kelompok: <KelompokPage />, jadwal: <JadwalPage /> };
  const PAGE_TITLES = { home: "Agritani Gunung Tinggi", ai: "Tanya AI Pertanian", scan: "Deteksi Penyakit", kelompok: "Kelompok Tani", jadwal: "Jadwal Tanam" };

  return (
    <div style={S.app}>
      <link href="https://fonts.googleapis.com/css2?family=Nunito:wght@400;600;700;800;900&display=swap" rel="stylesheet" />
      <div style={S.header}>
        <div style={S.headerTitle}>🌿 {PAGE_TITLES[tab]}</div>
        <div style={S.headerSub}>Aplikasi Pertanian Cerdas Kalimantan Selatan</div>
      </div>
      <div style={S.content}>{PAGE_MAP[tab]}</div>
      <nav style={S.nav}>
        {NAV_ITEMS.map((n) => (
          <button key={n.id} onClick={() => setTab(n.id)} style={S.navBtn(tab === n.id)}>
            <span style={S.navIcon}>{n.icon}</span>
            <span style={S.navLabel(tab === n.id)}>{n.label}</span>
          </button>
        ))}
      </nav>
    </div>
  );
}
