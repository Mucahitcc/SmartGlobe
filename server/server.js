// smartglobe backend
// express + mssql kullaniyoruz

require('dotenv').config();

const express = require('express');
const mssql = require('mssql');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');

const app = express();

// sadece izin verilen adreslerden istek kabul et
const izinliAdresler = (process.env.CORS_ORIGIN || 'http://localhost:3000')
  .split(',')
  .map(function(a) { return a.trim(); });

app.use(cors({
  origin: function(origin, cb) {
    // origin yoksa (Postman, ayni sunucudan servis) izin ver
    if (!origin || izinliAdresler.indexOf(origin) !== -1) return cb(null, true);
    cb(new Error('CORS: izin verilmeyen adres'));
  }
}));
app.use(express.json());

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_SURE = process.env.JWT_SURE || '8h';
const PORT = process.env.PORT || 3000;
const BCRYPT_TUR = 10;

// gizli anahtar yoksa hic baslatma - sessizce zayif calismaktansa durmasi iyi
if (!JWT_SECRET || JWT_SECRET.length < 32) {
  console.error('HATA: JWT_SECRET tanimli degil veya cok kisa.');
  console.error('.env dosyasi olusturun (ornek icin .env.example) ve uzun bir anahtar girin.');
  process.exit(1);
}

// veritabani baglanti ayarlari - .env dosyasindan okunuyor
const dbAyarlari = {
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME,
  options: {
    trustServerCertificate: true,
    enableArithAbort: true
  }
};

var baglanti; // db baglantisini burada tutuyoruz

// token kontrol - korunan sayfalarda kullaniyoruz
function tokenKontrol(req, res, next) {
  var baslik = req.headers['authorization'];
  if (!baslik) return res.status(401).json({ hata: 'Token yok' });
  // "Bearer xxx" formatini da duz token'i da kabul et
  var token = baslik.startsWith('Bearer ') ? baslik.slice(7) : baslik;
  try {
    var veri = jwt.verify(token, JWT_SECRET);
    req.kullanici = veri;
    next();
  } catch(e) {
    res.status(401).json({ hata: 'Token gecersiz' });
  }
}

// giris endpoint
app.post('/api/login', async function(req, res) {
  var kullanici_adi = req.body.kullanici_adi;
  var sifre = req.body.sifre;

  try {
    if (!kullanici_adi || !sifre) {
      return res.status(400).json({ hata: 'Kullanici adi ve sifre zorunlu' });
    }

    // sadece gerekli sutunlari cek
    var sonuc = await baglanti.request()
      .input('kullanici_adi', mssql.VarChar, kullanici_adi)
      .query("SELECT id, kullanici_adi, sifre, rol, ad_soyad FROM kullanicilar WHERE kullanici_adi = @kullanici_adi AND aktif = 1");

    // Kullanici yok ile sifre yanlis ayni mesaji doner.
    // Farkli mesaj verilirse saldirgan hangi kullanici adlarinin var oldugunu ogrenir.
    if (sonuc.recordset.length === 0) {
      return res.status(401).json({ hata: 'Kullanici adi veya sifre hatali' });
    }

    var kullanici = sonuc.recordset[0];

    var sifreDogru = await bcrypt.compare(sifre, kullanici.sifre || '');
    if (!sifreDogru) {
      return res.status(401).json({ hata: 'Kullanici adi veya sifre hatali' });
    }

    var token = jwt.sign(
      { id: kullanici.id, rol: kullanici.rol, ad: kullanici.ad_soyad },
      JWT_SECRET,
      { expiresIn: JWT_SURE }
    );

    res.json({ token: token, rol: kullanici.rol, ad: kullanici.ad_soyad });

  } catch(err) {
    console.log('login hatasi:', err.message);
    res.status(500).json({ hata: 'Sunucu hatasi' });
  }
});

// kullanici listesi - sadece admin gorebilir
app.get('/api/kullanicilar', tokenKontrol, async function(req, res) {
  if (req.kullanici.rol !== 'admin') return res.status(403).json({ hata: 'Yetkisiz' });
  try {
    var sonuc = await baglanti.request()
      .query("SELECT id, kullanici_adi, rol, ad_soyad, aktif FROM kullanicilar");
    res.json(sonuc.recordset);
  } catch(err) {
    res.status(500).json({ hata: err.message });
  }
});

// kullanici ekle - sadece admin
app.post('/api/kullanicilar', tokenKontrol, async function(req, res) {
  if (req.kullanici.rol !== 'admin') return res.status(403).json({ hata: 'Yetkisiz' });
  var kullanici_adi = req.body.kullanici_adi;
  var sifre = req.body.sifre;
  var ad_soyad = req.body.ad_soyad;
  var rol = req.body.rol || 'calisan';
  try {
    if (!kullanici_adi || !sifre) {
      return res.status(400).json({ hata: 'Kullanici adi ve sifre zorunlu' });
    }
    if (sifre.length < 8) {
      return res.status(400).json({ hata: 'Sifre en az 8 karakter olmali' });
    }

    // sifre asla duz metin saklanmaz
    var sifreHash = await bcrypt.hash(sifre, BCRYPT_TUR);

    await baglanti.request()
      .input('kullanici_adi', mssql.VarChar, kullanici_adi)
      .input('sifre', mssql.VarChar, sifreHash)
      .input('ad_soyad', mssql.VarChar, ad_soyad)
      .input('rol', mssql.VarChar, rol)
      .query("INSERT INTO kullanicilar (kullanici_adi, sifre, ad_soyad, rol) VALUES (@kullanici_adi, @sifre, @ad_soyad, @rol)");
    res.json({ mesaj: 'Kullanici eklendi' });
  } catch(err) {
    res.status(500).json({ hata: err.message });
  }
});

// kullanici sil - sadece admin
app.delete('/api/kullanicilar/:id', tokenKontrol, async function(req, res) {
  if (req.kullanici.rol !== 'admin') return res.status(403).json({ hata: 'Yetkisiz' });
  try {
    // once kullanici_proje tablosundan sil
    await baglanti.request()
      .input('id', mssql.Int, req.params.id)
      .query("DELETE FROM kullanici_proje WHERE kullanici_id = @id");
    // sonra kullaniciyi sil
    await baglanti.request()
      .input('id', mssql.Int, req.params.id)
      .query("DELETE FROM kullanicilar WHERE id = @id");
    res.json({ mesaj: 'Kullanici silindi' });
  } catch(err) {
    res.status(500).json({ hata: err.message });
  }
});

// bir kullanicinin projelerini getir - izin modali icin
app.get('/api/kullanicilar/:id/projeler', tokenKontrol, async function(req, res) {
  if (req.kullanici.rol !== 'admin') return res.status(403).json({ hata: 'Yetkisiz' });
  try {
    var sonuc = await baglanti.request()
      .input('kullanici_id', mssql.Int, req.params.id)
      .query("SELECT p.* FROM projeler p INNER JOIN kullanici_proje kp ON p.id = kp.proje_id WHERE kp.kullanici_id = @kullanici_id");
    res.json(sonuc.recordset);
  } catch(err) {
    res.status(500).json({ hata: err.message });
  }
});

// firma listesi - sadece admin gorebilir
app.get('/api/firmalar', tokenKontrol, async function(req, res) {
  if (req.kullanici.rol !== 'admin') return res.status(403).json({ hata: 'Yetkisiz' });
  try {
    var sonuc = await baglanti.request()
      .query("SELECT * FROM firmalar ORDER BY tarih DESC");
    res.json(sonuc.recordset);
  } catch(err) {
    res.status(500).json({ hata: err.message });
  }
});

// firma ekle - sadece admin
app.post('/api/firmalar', tokenKontrol, async function(req, res) {
  if (req.kullanici.rol !== 'admin') return res.status(403).json({ hata: 'Yetkisiz' });
  var ad = req.body.ad;
  var yetkili = req.body.yetkili;
  var telefon = req.body.telefon;
  var adres = req.body.adres;
  try {
    await baglanti.request()
      .input('ad', mssql.VarChar, ad)
      .input('yetkili', mssql.VarChar, yetkili)
      .input('telefon', mssql.VarChar, telefon)
      .input('adres', mssql.VarChar, adres)
      .query("INSERT INTO firmalar (ad, yetkili, telefon, adres) VALUES (@ad, @yetkili, @telefon, @adres)");
    res.json({ mesaj: 'Firma eklendi' });
  } catch(err) {
    res.status(500).json({ hata: err.message });
  }
});

// firma sil - once bagli projeleri kontrol et
app.delete('/api/firmalar/:id', tokenKontrol, async function(req, res) {
  if (req.kullanici.rol !== 'admin') return res.status(403).json({ hata: 'Yetkisiz' });
  try {
    // firmaya bagli proje var mi bak
    var kontrol = await baglanti.request()
      .input('id', mssql.Int, req.params.id)
      .query("SELECT COUNT(*) as sayi FROM projeler WHERE firma_id = @id");
    if (kontrol.recordset[0].sayi > 0) {
      return res.status(400).json({ hata: 'Firmaya ait projeler var, once projeleri silin' });
    }
    await baglanti.request()
      .input('id', mssql.Int, req.params.id)
      .query("DELETE FROM firmalar WHERE id = @id");
    res.json({ mesaj: 'Firma silindi' });
  } catch(err) {
    res.status(500).json({ hata: err.message });
  }
});

// proje listesi - admin hepsini gorur, calisan sadece atananları
// firma bilgisini de join ile cekiyoruz
app.get('/api/projeler', tokenKontrol, async function(req, res) {
  try {
    var sonuc;
    if (req.kullanici.rol === 'admin') {
      sonuc = await baglanti.request()
        .query("SELECT p.*, f.ad as firma_adi FROM projeler p LEFT JOIN firmalar f ON p.firma_id = f.id WHERE p.aktif = 1");
    } else {
      sonuc = await baglanti.request()
        .input('kullanici_id', mssql.Int, req.kullanici.id)
        .query("SELECT p.*, f.ad as firma_adi FROM projeler p LEFT JOIN firmalar f ON p.firma_id = f.id INNER JOIN kullanici_proje kp ON p.id = kp.proje_id WHERE kp.kullanici_id = @kullanici_id AND p.aktif = 1");
    }
    res.json(sonuc.recordset);
  } catch(err) {
    res.status(500).json({ hata: err.message });
  }
});

// bir projeye erisimi olan kullanicilari getir - erisim modali icin
app.get('/api/projeler/:id/kullanicilar', tokenKontrol, async function(req, res) {
  if (req.kullanici.rol !== 'admin') return res.status(403).json({ hata: 'Yetkisiz' });
  try {
    var sonuc = await baglanti.request()
      .input('proje_id', mssql.Int, req.params.id)
      .query("SELECT k.id, k.ad_soyad, k.kullanici_adi FROM kullanicilar k INNER JOIN kullanici_proje kp ON k.id = kp.kullanici_id WHERE kp.proje_id = @proje_id");
    res.json(sonuc.recordset);
  } catch(err) {
    res.status(500).json({ hata: err.message });
  }
});

// proje ekle - firma_id de aliyoruz artik
app.post('/api/projeler', tokenKontrol, async function(req, res) {
  if (req.kullanici.rol !== 'admin') return res.status(403).json({ hata: 'Yetkisiz' });
  var ad = req.body.ad;
  var model_yolu = req.body.model_yolu;
  var y_offset = req.body.y_offset || 0;
  var firma_id = req.body.firma_id || null;
  try {
    await baglanti.request()
      .input('ad', mssql.VarChar, ad)
      .input('model_yolu', mssql.VarChar, model_yolu)
      .input('y_offset', mssql.Float, y_offset)
      .input('firma_id', mssql.Int, firma_id)
      .query("INSERT INTO projeler (ad, model_yolu, y_offset, firma_id) VALUES (@ad, @model_yolu, @y_offset, @firma_id)");
    res.json({ mesaj: 'Proje eklendi' });
  } catch(err) {
    res.status(500).json({ hata: err.message });
  }
});

// proje sil - sadece admin
app.delete('/api/projeler/:id', tokenKontrol, async function(req, res) {
  if (req.kullanici.rol !== 'admin') return res.status(403).json({ hata: 'Yetkisiz' });
  try {
    // once yetkileri kaldir
    await baglanti.request()
      .input('id', mssql.Int, req.params.id)
      .query("DELETE FROM kullanici_proje WHERE proje_id = @id");
    await baglanti.request()
      .input('id', mssql.Int, req.params.id)
      .query("DELETE FROM projeler WHERE id = @id");
    res.json({ mesaj: 'Proje silindi' });
  } catch(err) {
    res.status(500).json({ hata: err.message });
  }
});

// kullaniciya proje ata
app.post('/api/yetki', tokenKontrol, async function(req, res) {
  if (req.kullanici.rol !== 'admin') return res.status(403).json({ hata: 'Yetkisiz' });
  var kullanici_id = req.body.kullanici_id;
  var proje_id = req.body.proje_id;
  try {
    // zaten atanmis mi kontrol et
    var kontrol = await baglanti.request()
      .input('kullanici_id', mssql.Int, kullanici_id)
      .input('proje_id', mssql.Int, proje_id)
      .query("SELECT * FROM kullanici_proje WHERE kullanici_id = @kullanici_id AND proje_id = @proje_id");
    if (kontrol.recordset.length > 0) return res.json({ mesaj: 'Zaten atanmis' });
    await baglanti.request()
      .input('kullanici_id', mssql.Int, kullanici_id)
      .input('proje_id', mssql.Int, proje_id)
      .query("INSERT INTO kullanici_proje (kullanici_id, proje_id) VALUES (@kullanici_id, @proje_id)");
    res.json({ mesaj: 'Proje atandi' });
  } catch(err) {
    res.status(500).json({ hata: err.message });
  }
});

// kullanicidan proje kaldir
app.delete('/api/yetki', tokenKontrol, async function(req, res) {
  if (req.kullanici.rol !== 'admin') return res.status(403).json({ hata: 'Yetkisiz' });
  var kullanici_id = req.body.kullanici_id;
  var proje_id = req.body.proje_id;
  try {
    await baglanti.request()
      .input('kullanici_id', mssql.Int, kullanici_id)
      .input('proje_id', mssql.Int, proje_id)
      .query("DELETE FROM kullanici_proje WHERE kullanici_id = @kullanici_id AND proje_id = @proje_id");
    res.json({ mesaj: 'Yetki kaldirildi' });
  } catch(err) {
    res.status(500).json({ hata: err.message });
  }
});

// sunucuyu baslat
async function baslat() {
  try {
    baglanti = await mssql.connect(dbAyarlari);
    console.log('veritabanina baglandi');
    app.listen(PORT, function() {
      console.log('sunucu ' + PORT + ' portunda calisiyor');
    });
  } catch(err) {
    console.error('baslangic hatasi:', err.message);
    process.exit(1);
  }
}

baslat();