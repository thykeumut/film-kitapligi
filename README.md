# Film Kitaplığı

İzlediğin ve izlemek istediğin filmler ile dizileri kaydettiğin, **IMDb verisiyle** çalışan kişisel izleme sitesi. React + Vite ile yazıldı.

## Çalıştırma

```bash
npm install
npm run dev
```

Tarayıcıda `http://localhost:5173` (veya Vite'ın gösterdiği port) açılır.

> Port 5173 doluysa Vite otomatik 5174'e geçer — konsola bak.

## Yayınlama (kalıcı kitaplık — Supabase kurulumu)

Varsayılan mod **yereldir** (veri yalnızca o tarayıcıda saklanır). Arkadaşların
nereden girse kendi kitaplığını görmesi için ücretsiz Supabase hesabı yeterli:

1. [supabase.com](https://supabase.com) → New project → proje adı örn. `film-kitapligi`
2. **SQL Editor** → bu repodaki `supabase-schema.sql` içeriğini yapıştır → Run
3. **Authentication → Providers → Email → "Confirm email"** seçeneğini **kapat**
   (arkadaşların e-postasını sormuyoruz; kullanıcı adı + şifre yeterli)
4. **Project Settings → API** → **Project URL** ve **anon public** anahtarını kopyala
5. `.env` dosyasına yapıştır:
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJ...
   ```
6. `npm run dev` — sağ üstte artık bulut modu: herkes kendi hesabını oluşturur,
   kitaplığı cihazdan bağımsız sunucuda saklanır.

Siteyi internete koymak için `npm run build` çıktısını (dist/) Vercel/Netlify'a
yükleyip aynı ortam değişkenlerini (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY)
panelde tanımlamak yeterlidir.

## Özellikler

- **Giriş / Kayıt** — her kullanıcı kendi kitaplığına sahiptir (veriler `localStorage`'da)
- **IMDb'den canlı veri** — anahtarsız IMDb suggestion API'siyle arama + afişler
- **Keşfet: Top Filmler / Top Diziler** — IMDb arama sayfalarından derlenen ~500 film ve ~250 dizi; tür bazlı sorgularla birleştirilir, 24 saat önbelleklenir
- **Detay modalı** — afiş, yıl, tür, Wikipedia özeti, "IMDb'de Aç" bağlantısı
- **Sırada / İzlendi rafları** — durum, 1-5 yıldız puanı, kişisel not
- **Tozlu kitap konsepti** — "İzlendi" işaretlenen yapımlar solgunlaşır; üzerinde uçuşan toz zerreleri
- **Yapım Ekle** — IMDb'de arayarak veya elle; eski elle eklenenler açılışta otomatik afişlenir
- **Çift dilli arayüz** — sağ üstteki EN/TR düğmesiyle tüm metinler ve özet dili değişir
- **Önbellek** — IMDb aramaları, özetler ve Top listeleri `localStorage`'da saklanır
- **Kalıcı kitaplık (isteğe bağlı bulut)** — `VITE_SUPABASE_*` doldurulduğunda kitaplık
  Supabase Postgres'te saklanır ve her cihazdan aynı hesapla görünür; RLS ile her
  kullanıcı yalnızca kendi satırlarını görür. Boşken uygulama yerel demo modda çalışır.

## Dosya yapısı

```
src/
├── components/
│   ├── Auth.jsx            giriş/kayıt
│   ├── Book.jsx            afiş kartı + toz efekti
│   ├── Shelf.jsx           ızgara bölümü (iskelet yükleme dahil)
│   ├── BookModal.jsx       detay modalı (afiş, özet, IMDb linki)
│   └── AddMovieModal.jsx   IMDb aramalı ekleme
├── lib/
│   ├── storage.js          kullanıcı + kitaplık deposu (Supabase / yerel)
│   ├── supabase.js         Supabase istemcisi (.env ile bulut modu)
│   ├── imdb.js             IMDb suggestion API + Wikipedia özeti + önbellek
│   ├── charts.js           Top film/dizi listeleri (tür bazlı derleme)
│   └── i18n.js             TR/EN arayüz metinleri
├── App.jsx                 ana durum ve sayfa düzeni
└── index.css               modern gece kitaplığı teması
```

## Notlar

- IMDb'nin resmi açık API'si yok; bu proje anahtar gerektirmeyen
  `v2.sg.media-imdb.com/suggestion` uç noktasını kullanır. Afişler IMDb/Amazon
  CDN'den gelir; her kart `imdb.com/title/<tt...>` sayfasına bağlanır.
- **Top listeleri**: IMDb arama sayfaları tarayıcıdan doğrudan okunamadığı
  (CORS) için `r.jina.ai` okuyucu servisi üzerinden metin olarak çekilir ve
  afiş/tt-id ayrıştırılır. Reader sayfalama parametresini geçirmediğinden
  liste, genel top + tür popülerliği sorgularının birleşiminden kurulur
  (~800 başlık). İlk yükleme ~40 sn sürer; sonrasında önbellekten anında açılır.
- **Özetler** Wikipedia'dan gelir: Türkçe arayüzde önce `tr.wikipedia.org`,
  bulunamazsa `en.wikipedia.org` kullanılır. Türkçe özeti olmayan yapımlarda
  özgün metinle birlikte küçük bir uyarı gösterilir.
- Bu bir demo deposudur; şifreler gerçek güvenlik için uygun değildir.
