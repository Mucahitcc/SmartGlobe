/*
 * TEK SEFERLIK GECIS SCRIPTI
 *
 * Veritabanindaki duz metin sifreleri bcrypt hash'ine cevirir.
 * bcrypt formatinda olanlara ($2a$/$2b$ ile baslayanlar) dokunmaz,
 * bu yuzden birden fazla kez calistirmak zararsizdir.
 *
 * Kullanim:
 *   node scripts/sifreleri-hashle.js
 *
 * ONEMLI: Calistirmadan once veritabaninin yedegini alin.
 */

require('dotenv').config();
const mssql = require('mssql');
const bcrypt = require('bcryptjs');

const BCRYPT_TUR = 10;

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

// bcrypt hash'leri $2a$ / $2b$ / $2y$ ile baslar ve 60 karakterdir
function hashlenmisMi(deger) {
  return typeof deger === 'string' &&
         /^\$2[aby]\$/.test(deger) &&
         deger.length === 60;
}

async function calistir() {
  let baglanti;
  try {
    baglanti = await mssql.connect(dbAyarlari);
    console.log('Veritabanina baglanildi:', dbAyarlari.database);

    const sonuc = await baglanti.request()
      .query('SELECT id, kullanici_adi, sifre FROM kullanicilar');

    const kullanicilar = sonuc.recordset;
    console.log('Toplam kullanici:', kullanicilar.length);

    let cevrilen = 0;
    let atlanan = 0;
    let bos = 0;

    for (const k of kullanicilar) {
      if (!k.sifre) {
        console.log('  [BOS]    ' + k.kullanici_adi + ' - sifresi bos, atlandi');
        bos++;
        continue;
      }

      if (hashlenmisMi(k.sifre)) {
        console.log('  [ATLA]   ' + k.kullanici_adi + ' - zaten hashlenmis');
        atlanan++;
        continue;
      }

      const hash = await bcrypt.hash(k.sifre, BCRYPT_TUR);

      await baglanti.request()
        .input('id', mssql.Int, k.id)
        .input('sifre', mssql.VarChar, hash)
        .query('UPDATE kullanicilar SET sifre = @sifre WHERE id = @id');

      console.log('  [CEVIR]  ' + k.kullanici_adi);
      cevrilen++;
    }

    console.log('');
    console.log('Bitti. Cevrilen: ' + cevrilen + ' | Atlanan: ' + atlanan + ' | Bos: ' + bos);

    if (cevrilen > 0) {
      console.log('');
      console.log('NOT: sifre sutunu en az 60 karakter (VARCHAR(255) onerilir) olmali.');
      console.log('Kisa ise once su komutu calistirin:');
      console.log('  ALTER TABLE kullanicilar ALTER COLUMN sifre VARCHAR(255);');
    }

  } catch (err) {
    console.error('HATA:', err.message);
    process.exitCode = 1;
  } finally {
    if (baglanti) await baglanti.close();
  }
}

calistir();
