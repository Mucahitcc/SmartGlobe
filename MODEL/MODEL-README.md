# MODEL Klasörü

Bu klasör, uygulamanın görüntüleyeceği **Cesium 3D Tiles** veri setlerini barındırır.

Örnek veriler, dosya boyutu ve veri gizliliği nedeniyle depoya dahil edilmemiştir.

## Kendi verinizi ekleme

1. Fotogrametri veya Lidar çıktınızı 3D Tiles formatına dönüştürün
   (Agisoft Metashape, Cesium ion veya benzeri bir araçla)
2. Oluşan klasörü bu dizine yerleştirin
3. Yönetim panelinden **Proje Ekle** ile `tileset.json` dosyasının yolunu tanımlayın
4. Ana ekrandaki proje listesinden seçerek görüntüleyin

## Beklenen yapı

```
MODEL/
└── proje_adi/
    ├── tileset.json
    └── ... (b3dm, pnts vb. döşeme dosyaları)
```
