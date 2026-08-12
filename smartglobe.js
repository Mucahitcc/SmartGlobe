var viewer;
var tilesets = {};
var osmKatman = null; // harita katmanı açık mı kapalı mı

async function cesiumBaslat() {

  // ion limiti dolarsa ESRI'ye geç (alttaki yorum bloğu)
  Cesium.Ion.defaultAccessToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJqdGkiOiI0MmIxNDkzNy1hYmFkLTQ4OTYtODllMS04NTM3OTgzZThhZDIiLCJpZCI6NDE3NDE4LCJpYXQiOjE3NzYwNjU2ODZ9.PahaEqLryUaymFrwt0YCyETc-pRsUwzCUYXpBx4Y8xw';

  // ESRI alternatifi (ücretsiz, kayıt gerektirmez):
  // var esriUydu = new Cesium.UrlTemplateImageryProvider({
  //   url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
  //   credit: "ESRI World Imagery"
  // });
  // imageryProvider: false yerine esriUydu yaz, terrainProvider satırını kaldır.

  viewer = new Cesium.Viewer('cesiumContainer', {
    baseLayerPicker: false,
    animation: false,
    timeline: false,
    vrButton: false,
    geocoder: false,
    homeButton: false,
    infoBox: false,
    sceneModePicker: false,
    navigationHelpButton: false,
    selectionIndicator: false
  });

  viewer.cesiumWidget.creditContainer.style.display = "none";

  viewer.scene.screenSpaceCameraController.minimumZoomDistance = 1;
  viewer.scene.screenSpaceCameraController.maximumZoomDistance = 10000000;
  viewer.scene.screenSpaceCameraController.zoomFactor = 8;

  viewer.screenSpaceEventHandler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);

  viewer.scene.skyAtmosphere = new Cesium.SkyAtmosphere();
  viewer.scene.skyBox = undefined;
  viewer.scene.backgroundColor = Cesium.Color.TRANSPARENT;

  var araziBtn = document.getElementById("arazi3d");
  araziBtn.style.backgroundColor = viewer.scene.globe.show ? "rgba(8,13,26,0.85)" : "rgba(60,120,200,0.3)";

  var uyduBtn = document.getElementById('uyduHarita');
  var btnEtiket = document.getElementById('btnEtiket');
  uyduBtn.addEventListener('click', function() {
    if (!osmKatman) {
      osmKatman = viewer.imageryLayers.addImageryProvider(new Cesium.OpenStreetMapImageryProvider());
      btnEtiket.textContent = 'Uydu Getir';
    } else {
      viewer.imageryLayers.remove(osmKatman);
      osmKatman = null;
      btnEtiket.textContent = 'Harita Getir';
    }
  });

  var ciftTikHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
  ciftTikHandler.setInputAction(function(hareket) {
    var sahne = viewer.scene;
    var secilenNesne = sahne.pick(hareket.position);
    var pozisyon = sahne.pickPosition(hareket.position);
    if (!Cesium.defined(pozisyon)) return;

    var kameraPoz = viewer.camera.positionWC;
    var yon = Cesium.Cartesian3.subtract(pozisyon, kameraPoz, new Cesium.Cartesian3());
    var mesafe = Cesium.Cartesian3.magnitude(yon);
    var yonNorm = Cesium.Cartesian3.normalize(yon, new Cesium.Cartesian3());

    if (!Cesium.defined(secilenNesne) || !Cesium.defined(secilenNesne.primitive) || secilenNesne.primitive instanceof Cesium.Globe) {
      var offset1 = Cesium.Cartesian3.multiplyByScalar(yonNorm, mesafe - 500.0, new Cesium.Cartesian3());
      var yeniPoz1 = Cesium.Cartesian3.add(kameraPoz, offset1, new Cesium.Cartesian3());
      viewer.camera.flyTo({ duration: 1.3, destination: yeniPoz1, orientation: { direction: yonNorm, up: viewer.camera.up } });
    } else {
      var offset2 = Cesium.Cartesian3.multiplyByScalar(yonNorm, mesafe - 50, new Cesium.Cartesian3());
      var yeniPoz2 = Cesium.Cartesian3.add(kameraPoz, offset2, new Cesium.Cartesian3());
      viewer.camera.flyTo({ duration: 1.3, destination: yeniPoz2, orientation: { direction: yonNorm, up: viewer.camera.up } });
    }
  }, Cesium.ScreenSpaceEventType.LEFT_DOUBLE_CLICK);

 ilkGorus();

  ortoPerspToggle(viewer);
  mesafeOlcumBaslat(viewer, { snapPixelRadius: 6, pointSize: 8, lineWidth: 2 });
  alanOlcumBaslat(viewer, { snapPixelRadius: 6, pointSize: 8, lineWidth: 2, outlineColor: Cesium.Color.YELLOW });
  yukseklikOlcumBaslat(viewer, { snapPixelRadius: 6, pointSize: 8, lineWidth: 2 });

var token = localStorage.getItem('sgToken');
fetch('http://localhost:3000/api/projeler', {
  headers: { 'authorization': token }
})
.then(function(res) { return res.json(); })
.then(function(projeler) {
  var select = document.getElementById('modelSec');
  projeler.forEach(function(proje) {
    var option = document.createElement('option');
    option.value = proje.id;
    option.textContent = proje.ad;
    select.appendChild(option);
  });
});
  pinKurulum(viewer);
}



document.addEventListener("DOMContentLoaded", function() {

  olcumButonlariKur(['measureBtn', 'alanOlcum', 'yukseklikOlcumBtn', 'KoordinatOku'], 'active');

  document.getElementById("modelSec").addEventListener("change", modelGetir);

  cesiumBaslat();


  var kaydetBtn = document.getElementById("cizimKaydet");
  kaydetBtn.disabled = true;

  window.kaydetEtkinlestir = function() {
    kaydetBtn.disabled = false;
    kaydetBtn.classList.add("active");
  };

  window.kaydetDeaktifEt = function() {
    kaydetBtn.disabled = true;
    kaydetBtn.classList.remove("active");
  };

  function kaydetDurumGuncelle() {
    var herhangiAktif = ['measureBtn','alanOlcum','KoordinatOku'].some(function(id) {
      return document.getElementById(id).classList.contains('active');
    });
    if (herhangiAktif) window.kaydetEtkinlestir();
    else window.kaydetDeaktifEt();
  }

  kaydetBtn.addEventListener("click", function() {
    var featurelar = [];

    function kartezyanLonLat(c) {
      var carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(c);
      return [
        Cesium.Math.toDegrees(carto.longitude),
        Cesium.Math.toDegrees(carto.latitude),
        carto.height || 0
      ];
    }

    function alanHesapla(pozisyonlar) {
      var ellipsoid = Cesium.Ellipsoid.WGS84;
      var cartos = pozisyonlar.map(function(p) { return Cesium.Cartographic.fromCartesian(p, ellipsoid); });
      var lat0 = cartos.reduce(function(s, c) { return s + c.latitude; }, 0) / cartos.length;
      var R = ellipsoid.maximumRadius;
      var pts2d = cartos.map(function(c) { return { x: c.longitude * Math.cos(lat0) * R, y: c.latitude * R }; });
      var alan = 0;
      for (var i = 0, j = pts2d.length - 1; i < pts2d.length; j = i++) {
        alan += pts2d[j].x * pts2d[i].y - pts2d[i].x * pts2d[j].y;
      }
      return Math.abs(alan) * 0.5;
    }

    viewer.entities.values.forEach(function(ent) {
      var tip = ent.properties?.measurementType;

      if (tip === "distance" && ent.polyline) {
        var pts = ent.polyline.positions.getValue ? ent.polyline.positions.getValue() : ent.polyline.positions;
        var uzunluk = 0;
        for (var i = 1; i < pts.length; i++) uzunluk += Cesium.Cartesian3.distance(pts[i-1], pts[i]);
        var coords = pts.map(kartezyanLonLat);
        featurelar.push({
          type: "Feature",
          geometry: { type: "LineString", coordinates: coords.map(function(c) { return [c[0], c[1]]; }) },
          properties: { uzunluk_m: Number(uzunluk.toFixed(2)) }
        });
      }
      else if (tip === "area" && ent.polyline) {
        var pts2 = ent.polyline.positions.getValue ? ent.polyline.positions.getValue() : ent.polyline.positions;
        var cevre = 0;
        for (var j = 1; j < pts2.length; j++) cevre += Cesium.Cartesian3.distance(pts2[j-1], pts2[j]);
        var coords2 = pts2.map(kartezyanLonLat);
        var alan = alanHesapla(pts2);
        featurelar.push({
          type: "Feature",
          geometry: { type: "Polygon", coordinates: [coords2.map(function(c) { return [c[0], c[1], c[2]]; })] },
          properties: { cevre_m: Number(cevre.toFixed(2)), alan_m2: Number(alan.toFixed(2)) }
        });
      }
      else if (tip === "coordinate" && ent.position) {
        var pos = ent.position.getValue ? ent.position.getValue() : ent.position;
        var coord = kartezyanLonLat(pos);
        featurelar.push({
          type: "Feature",
          geometry: { type: "Point", coordinates: [coord[0], coord[1], coord[2]] },
          properties: { boylam: Number(coord[0].toFixed(6)), enlem: Number(coord[1].toFixed(6)), yukseklik: Number(coord[2].toFixed(2)) }
        });
      }
    });

    if (!featurelar.length) { window.kaydetDeaktifEt(); return; }

    var geojson = {
      type: "FeatureCollection",
      name: "smartglobe_cizim",
      crs: { type: "name", properties: { name: "EPSG:4326" } },
      features: featurelar
    };

    var blob = new Blob([JSON.stringify(geojson, null, 2)], { type: "application/json" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = "smartglobe_cizim.geojson";
    link.click();
  });

  ['measureBtn','alanOlcum','KoordinatOku'].forEach(function(id) {
    document.getElementById(id).addEventListener('click', function() {
      setTimeout(kaydetDurumGuncelle, 0);
    });
  });

  viewer && viewer.entities.collectionChanged.addEventListener(kaydetDurumGuncelle);


  // dxf kaydet
  var dxfBtn = document.getElementById("dxfKabu");
  dxfBtn.disabled = true;

  function dxfDurumGuncelle() {
    var aktif = ['measureBtn','alanOlcum','KoordinatOku'].some(function(id) {
      return document.getElementById(id).classList.contains('active');
    });
    dxfBtn.disabled = !aktif;
    aktif ? dxfBtn.classList.add("active") : dxfBtn.classList.remove("active");
  }

  ['measureBtn','alanOlcum','KoordinatOku'].forEach(function(id) {
    document.getElementById(id).addEventListener('click', function() { setTimeout(dxfDurumGuncelle, 0); });
  });

  dxfBtn.addEventListener("click", function() {
    var dxfsatirlar = [
      "0\nSECTION\n2\nHEADER\n0\nENDSEC\n",
      "0\nSECTION\n2\nTABLES\n0\nENDSEC\n",
      "0\nSECTION\n2\nBLOCKS\n0\nENDSEC\n",
      "0\nSECTION\n2\nENTITIES\n"
    ];

    function turefZonBul(lon) {
      var merkezler = [27, 30, 33, 36, 39, 42, 45];
      var en_yakin = merkezler[0], min_fark = Math.abs(lon - merkezler[0]);
      merkezler.forEach(function(c) {
        var fark = Math.abs(lon - c);
        if (fark < min_fark) { min_fark = fark; en_yakin = c; }
      });
      return { epsg: 5254 + ((en_yakin - 27) / 3), meridyen: en_yakin };
    }

    function kartezyanLonLatH(c) {
      var carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(c);
      return [Cesium.Math.toDegrees(carto.longitude), Cesium.Math.toDegrees(carto.latitude), carto.height || 0];
    }

    function projTanimEkle(epsg, meridyen) {
      if (!proj4.defs['EPSG:' + epsg]) {
        proj4.defs('EPSG:' + epsg, '+proj=tmerc +lat_0=0 +lon_0=' + meridyen + ' +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs');
      }
    }

    var tumBoylamlar = [];

    viewer.entities.values.forEach(function(ent) {
      var tip = ent.properties?.measurementType;
      var pts = [];

      if ((tip === "distance" || tip === "area") && ent.polyline) {
        pts = ent.polyline.positions.getValue ? ent.polyline.positions.getValue() : ent.polyline.positions;
      } else if (tip === "coordinate" && ent.position) {
        pts = [ent.position.getValue ? ent.position.getValue() : ent.position];
      }

      if (!pts.length) return;

      var cartos = pts.map(function(p) { return Cesium.Ellipsoid.WGS84.cartesianToCartographic(p); });
      var ortaLon = cartos.reduce(function(s, c) { return s + Cesium.Math.toDegrees(c.longitude); }, 0) / cartos.length;
      var zone = turefZonBul(ortaLon);
      projTanimEkle(zone.epsg, zone.meridyen);
      tumBoylamlar.push(ortaLon);

      if (tip === "distance") {
        dxfsatirlar.push("0\nLWPOLYLINE\n8\n0\n62\n7\n");
        dxfsatirlar.push("90\n" + pts.length + "\n70\n0\n");
        pts.forEach(function(p) {
          var llh = kartezyanLonLatH(p);
          var xy = proj4("EPSG:4326", "EPSG:" + zone.epsg, [llh[0], llh[1]]);
          dxfsatirlar.push("10\n" + xy[0] + "\n20\n" + xy[1] + "\n30\n" + llh[2] + "\n");
        });
      } else if (tip === "area") {
        dxfsatirlar.push("0\nLWPOLYLINE\n8\n0\n62\n3\n");
        dxfsatirlar.push("90\n" + (pts.length + 1) + "\n70\n1\n");
        pts.concat(pts[0]).forEach(function(p) {
          var llh = kartezyanLonLatH(p);
          var xy = proj4("EPSG:4326", "EPSG:" + zone.epsg, [llh[0], llh[1]]);
          dxfsatirlar.push("10\n" + xy[0] + "\n20\n" + xy[1] + "\n30\n" + llh[2] + "\n");
        });
      } else if (tip === "coordinate") {
        var llh = kartezyanLonLatH(pts[0]);
        var xy = proj4("EPSG:4326", "EPSG:" + zone.epsg, [llh[0], llh[1]]);
        dxfsatirlar.push("0\nPOINT\n8\n0\n62\n1\n");
        dxfsatirlar.push("10\n" + xy[0] + "\n20\n" + xy[1] + "\n30\n" + llh[2] + "\n");
      }
    });

    dxfsatirlar.push("0\nENDSEC\n0\nEOF");

    var dosyaAdi = "smartglobe_cizim_TMUNKNOWN.dxf";
    if (tumBoylamlar.length) {
      var ortaLon2 = tumBoylamlar.reduce(function(s, l) { return s + l; }, 0) / tumBoylamlar.length;
      dosyaAdi = "smartglobe_cizim_TM" + turefZonBul(ortaLon2).meridyen + ".dxf";
    }

    var blob = new Blob([dxfsatirlar.join('')], { type: "application/dxf" });
    var link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = dosyaAdi;
    link.click();
  });

});


document.addEventListener("DOMContentLoaded", function() {
  var kmzBtn = document.getElementById("kmzKaydet");
  if (!kmzBtn) return;

  kmzBtn.disabled = true;

  var eskiEtkin = window.kaydetEtkinlestir || function() {};
  var eskiDeaktif = window.kaydetDeaktifEt || function() {};

  window.kaydetEtkinlestir = function() {
    eskiEtkin();
    kmzBtn.disabled = false;
    kmzBtn.classList.add("active");
  };

  window.kaydetDeaktifEt = function() {
    eskiDeaktif();
    kmzBtn.disabled = true;
    kmzBtn.classList.remove("active");
  };

  function kartezyanLonLatH(c) {
    var carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(c);
    return [Cesium.Math.toDegrees(carto.longitude), Cesium.Math.toDegrees(carto.latitude), carto.height || 0];
  }

  function kmlKoord(a) { return a[0].toFixed(6) + "," + a[1].toFixed(6) + "," + a[2].toFixed(2); }

  function kmlOlustur() {
    var ts = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
    var kml = '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n' +
      '<n>smartglobe_' + ts + '</n>\n' +
      '<Style id="cizgi"><LineStyle><color>ff00ffff</color><width>2</width></LineStyle></Style>\n' +
      '<Style id="alan"><LineStyle><color>ff00ffff</color><width>2</width></LineStyle><PolyStyle><color>4c00ffff</color></PolyStyle></Style>\n' +
      '<Style id="nokta"><IconStyle><Icon><href>http://maps.google.com/mapfiles/kml/paddle/wht-circle.png</href></Icon></IconStyle></Style>\n';

    var mesafeSegment = [], alanlar = [], noktalar = [];

    viewer.entities.values.forEach(function(ent) {
      var tip = ent.properties?.measurementType;
      if (tip === "distance" && ent.polyline) {
        var arr = ent.polyline.positions.getValue ? ent.polyline.positions.getValue() : ent.polyline.positions;
        if (arr && arr.length >= 2) {
          for (var i = 1; i < arr.length; i++) mesafeSegment.push({ a: arr[i-1], b: arr[i] });
        }
      } else if (tip === "area" && ent.polyline) {
        var arr2 = ent.polyline.positions.getValue ? ent.polyline.positions.getValue() : ent.polyline.positions;
        if (arr2 && arr2.length >= 3) alanlar.push(arr2.slice());
      } else if (tip === "coordinate" && ent.position) {
        var p = ent.position.getValue ? ent.position.getValue() : ent.position;
        noktalar.push(p);
      }
    });

    if (mesafeSegment.length) {
      var coords = mesafeSegment.map(function(s) { return kmlKoord(kartezyanLonLatH(s.a)); }).join(" ");
      kml += '<Placemark>\n<styleUrl>#cizgi</styleUrl>\n<LineString><altitudeMode>absolute</altitudeMode><coordinates>' + coords + '</coordinates></LineString>\n</Placemark>\n';
    }

    alanlar.forEach(function(pts, idx) {
      var kapali = pts.slice();
      if (kapali[0] !== kapali[kapali.length-1]) kapali.push(kapali[0]);
      var coords = kapali.map(function(p) { return kmlKoord(kartezyanLonLatH(p)); }).join(" ");
      kml += '<Placemark>\n<n>Alan ' + (idx+1) + '</n>\n<styleUrl>#alan</styleUrl>\n<Polygon><altitudeMode>absolute</altitudeMode><outerBoundaryIs><LinearRing><coordinates>' + coords + '</coordinates></LinearRing></outerBoundaryIs></Polygon>\n</Placemark>\n';
    });

    noktalar.forEach(function(p, idx) {
      var a = kartezyanLonLatH(p);
      kml += '<Placemark>\n<n>Nokta ' + (idx+1) + '</n>\n<styleUrl>#nokta</styleUrl>\n<Point><altitudeMode>absolute</altitudeMode><coordinates>' + kmlKoord(a) + '</coordinates></Point>\n</Placemark>\n';
    });

    kml += '</Document>\n</kml>';
    return kml;
  }

  kmzBtn.addEventListener("click", async function() {
    var olcumVar = viewer?.entities?.values?.some(function(e) { return e.properties?.measurementType; });
    if (!olcumVar) return;

    var kml = kmlOlustur();

    if (window.JSZip) {
      var zip = new JSZip();
      zip.file("doc.kml", kml);
      var blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
      var a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "smartglobe_cizim.kmz"; a.click();
    } else {
      var blob2 = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
      var a2 = document.createElement("a"); a2.href = URL.createObjectURL(blob2); a2.download = "smartglobe_cizim.kml"; a2.click();
    }
  });
});


function olcumButonlariKur(butonIdler, aktifClass) {
  var butonlar = butonIdler.map(function(id) { return document.getElementById(id); });
  butonlar.forEach(function(btn) {
    btn.addEventListener('click', function() {
      var simdAktif = btn.classList.contains(aktifClass);
      butonlar.forEach(function(b) { b.classList.remove(aktifClass); b.disabled = false; });
      if (!simdAktif) {
        btn.classList.add(aktifClass);
        butonlar.filter(function(b) { return b !== btn; }).forEach(function(b) { b.disabled = true; });
      }
    });
  });
}

async function modelYukleGoster(projeId) {
  for (var k in tilesets) {
    viewer.scene.primitives.remove(tilesets[k]);
    delete tilesets[k];
  }

  var token = localStorage.getItem('sgToken');
  var cevap = await fetch('http://localhost:3000/api/projeler', {
    headers: { 'authorization': token }
  });
  var projeler = await cevap.json();
  var proje = projeler.find(function(p) { return p.id == projeId; });
  if (!proje) return;

  var tileset = await Cesium.Cesium3DTileset.fromUrl(proje.model_yolu, {
    maximumScreenSpaceError: 1
  });
  viewer.scene.primitives.add(tileset);
  offsetUygula(tileset, proje.y_offset || 0);
  tilesets[projeId] = tileset;
  viewer.zoomTo(tileset);
}
// tileset yükseklik offseti
function offsetUygula(tileset, offset) {
  var bs = tileset.boundingSphere;
  var carto = Cesium.Cartographic.fromCartesian(bs.center);
  var yuzey = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, 0.0);
  var kaymis = Cesium.Cartesian3.fromRadians(carto.longitude, carto.latitude, offset);
  var fark = Cesium.Cartesian3.subtract(kaymis, yuzey, new Cesium.Cartesian3());
  tileset.modelMatrix = Cesium.Matrix4.fromTranslation(fark);
}

function modelGetir() {
  var secim = document.getElementById("modelSec").value;
  if (secim === 'a') { ilkGorus(); return; }
  modelYukleGoster(secim);
}

function eveDon() {
  var yuklenenler = Object.keys(tilesets);
  if (yuklenenler.length > 0) {
    viewer.zoomTo(tilesets[yuklenenler[0]]);
  } else {
    ilkGorus();
  }
}


function koordinataUc(lon, lat, yukseklik) {
  viewer.camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(lon, lat, yukseklik),
    orientation: { heading: Cesium.Math.toRadians(0), pitch: Cesium.Math.toRadians(-90), roll: 0.0 },
    duration: 0.5
  });
}

function ilkGorus() {
  viewer.camera.setView({
    destination: Cesium.Cartesian3.fromDegrees(0, 20.0, 15000000),
    orientation: {
      heading: 0,
      pitch: Cesium.Math.toRadians(-90.0),
      roll: 0
    }
  });

  setTimeout(function() {
    viewer.camera.flyTo({
      destination: Cesium.Cartesian3.fromDegrees(35.6, 39.0, 1500000),
      orientation: {
        heading: Cesium.Math.toRadians(0.0),
        pitch: Cesium.Math.toRadians(-90.0),
        roll: 0.0
      },
      duration: 3.5
    });
  }, 300);
}

function setTopView() {
  var camera = viewer.camera;
  var sahne = viewer.scene;
  var ekranMerkez = new Cesium.Cartesian2(viewer.canvas.clientWidth / 2, viewer.canvas.clientHeight / 2);

  var secilen = sahne.pick(ekranMerkez);
  var kartezyanPoz;

  if (Cesium.defined(secilen) && Cesium.defined(secilen.primitive)) {
    kartezyanPoz = sahne.pickPosition(ekranMerkez);
  } else {
    kartezyanPoz = camera.pickEllipsoid(ekranMerkez, sahne.globe.ellipsoid);
  }

  if (!kartezyanPoz) return;

  var carto = Cesium.Ellipsoid.WGS84.cartesianToCartographic(kartezyanPoz);
  camera.flyTo({
    destination: Cesium.Cartesian3.fromDegrees(
      Cesium.Math.toDegrees(carto.longitude),
      Cesium.Math.toDegrees(carto.latitude),
      camera.positionCartographic.height
    ),
    orientation: { heading: 0.0, pitch: Cesium.Math.toRadians(-90.0), roll: 0.0 },
    duration: 0.5
  });
}

function arazi3dGetir() {
  var globe = viewer.scene.globe;
  var btn = document.getElementById("arazi3d");
  globe.show = !globe.show;
  btn.style.backgroundColor = globe.show ? "rgba(8,13,26,0.85)" : "rgba(60,120,200,0.3)";
}


var koordinatEkrani = document.createElement('div');
Object.assign(koordinatEkrani.style, {
  position: 'absolute', bottom: '10px', left: '10px',
  padding: '5px', backgroundColor: 'rgba(78,102,138,0.8)',
  color: 'white', fontFamily: 'Arial, sans-serif', fontSize: '12px',
  borderRadius: '5px', display: 'none', zIndex: 999
});
document.body.appendChild(koordinatEkrani);

var koordOkuBtn = document.querySelector('#KoordinatOku');
var txtAktarBtn = document.querySelector('#TXTaktar');
var koordHandler = null;
var koordAktif = false;
var koordinatListesi = [];
var koordinatEntityler = [];

function aktarDurumAyarla(aktif) {
  txtAktarBtn.disabled = !aktif;
  txtAktarBtn.style.opacity = aktif ? '1' : '0.7';
  if (aktif && typeof window.kaydetEtkinlestir === 'function') window.kaydetEtkinlestir();
  if (!aktif && typeof window.kaydetDeaktifEt === 'function') window.kaydetDeaktifEt();
}
aktarDurumAyarla(false);

koordOkuBtn.addEventListener('click', function() {
  if (koordAktif) {
    if (koordHandler) { koordHandler.destroy(); koordHandler = null; }
    koordAktif = false;
    koordOkuBtn.style.backgroundColor = 'rgba(8,13,26,0.85)';
    koordinatEntityler.forEach(function(entity) { viewer.entities.remove(entity); });
    koordinatEntityler = [];
    koordinatListesi = [];
    koordinatEkrani.style.display = 'none';
    aktarDurumAyarla(false);
  } else {
    koordHandler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
    koordHandler.setInputAction(function(click) {
      var pikPoz = viewer.scene.pickPosition(click.position);
      if (!Cesium.defined(pikPoz)) return;

      var carto = Cesium.Cartographic.fromCartesian(pikPoz);
      var lon = Cesium.Math.toDegrees(carto.longitude);
      var lat = Cesium.Math.toDegrees(carto.latitude);
      var hgt = carto.height;

      var epsg = null;
      var zonMer = Math.round(lon / 3) * 3;
      if (zonMer >= 21 && zonMer <= 45) {
        var kod = 5254 + (zonMer - 27) / 3;
        epsg = 'EPSG:' + kod;
        if (!proj4.defs(epsg)) {
          proj4.defs(epsg, '+proj=tmerc +lat_0=0 +lon_0=' + zonMer + ' +k=1 +x_0=500000 +y_0=0 +ellps=GRS80 +units=m +no_defs');
        }
      }

      var turefX = 'N/A', turefY = 'N/A';
      if (epsg) {
        var xy = proj4('EPSG:4326', epsg, [lon, lat]);
        turefX = xy[0].toFixed(3); turefY = xy[1].toFixed(3);
      }

      koordinatEkrani.style.display = 'block';
      koordinatEkrani.innerHTML = '<strong style="color:yellow;">TUREF (' + (epsg||'Dışında') + ')</strong><br>' +
        'X: ' + turefX + ' &nbsp; Y: ' + turefY + ' &nbsp; Z: ' + hgt.toFixed(2) + ' m<br><br>' +
        '<strong style="color:yellow;">WGS84</strong><br>' +
        'Boylam: ' + lon.toFixed(6) + ' &nbsp; Enlem: ' + lat.toFixed(6) + ' &nbsp; H: ' + hgt.toFixed(2) + ' m';

      var entity = viewer.entities.add({
        position: pikPoz,
        point: { pixelSize: 7, color: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 1, disableDepthTestDistance: Infinity }
      });
      entity.properties = entity.properties || new Cesium.PropertyBag();
      entity.properties.measurementType = 'coordinate';
      koordinatEntityler.push(entity);

      koordinatListesi.push({
        id: koordinatListesi.length + 1,
        turefX: turefX, turefY: turefY, turefZ: hgt.toFixed(2),
        epsg: epsg || 'N/A'
      });

      aktarDurumAyarla(true);
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

    koordAktif = true;
    koordOkuBtn.style.backgroundColor = 'rgba(60,120,200,0.5)';
    aktarDurumAyarla(true);
  }
});

txtAktarBtn.addEventListener('click', function() {
  if (!koordAktif || txtAktarBtn.disabled || !koordinatListesi.length) return;
  var metin = koordinatListesi.map(function(c) { return c.id + ' ' + c.turefX + ' ' + c.turefY + ' ' + c.turefZ; }).join('\n');
  var blob = new Blob([metin], { type: 'text/plain' });
  var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'TUREF_Koordinatlar.txt'; a.click();
});


function yakinNokta(scene, pos2D, r) {
  var cv = scene.canvas;
  var p = scene.pickPosition(pos2D);
  if (Cesium.defined(p)) return p;

  var yonler = [[r,0],[-r,0],[0,r],[0,-r],[r,r],[-r,r],[r,-r],[-r,-r]];
  for (var i = 0; i < yonler.length; i++) {
    var x = pos2D.x + yonler[i][0], y = pos2D.y + yonler[i][1];
    if (x < 0 || y < 0 || x > cv.width || y > cv.height) continue;
    p = scene.pickPosition(new Cesium.Cartesian2(x, y));
    if (Cesium.defined(p)) return p;
  }
  return undefined;
}


function mesafeOlcumBaslat(viewer, opts) {
  opts = opts || {};
  var snapR = opts.snapPixelRadius || 6;
  var ptSize = opts.pointSize || 8;
  var lineW = opts.lineWidth || 2;

  var olcuyorum = false;
  var tumKalicilar = [];
  var suankiEntityler = [];
  var tikladiklarim = [];
  var toplamMesafe = 0;
  var toplamEtiket = null;

  var dynNokta = null, dynCizgi = null, dynEtiket = null;

  var btn = document.getElementById("measureBtn");
  var handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

  function enYakinPiksel(scene, pos2D, r) {
    var cv = scene.canvas;
    var en_iyi, min_uzaklik = Infinity;
    for (var dx = -r; dx <= r; dx++) {
      for (var dy = -r; dy <= r; dy++) {
        var p = new Cesium.Cartesian2(pos2D.x + dx, pos2D.y + dy);
        if (p.x < 0 || p.y < 0 || p.x > cv.width || p.y > cv.height) continue;
        var w = scene.pickPosition(p);
        if (Cesium.defined(w)) {
          var d2 = dx*dx + dy*dy;
          if (d2 < min_uzaklik) { en_iyi = w; min_uzaklik = d2; }
        }
      }
    }
    return en_iyi;
  }

  function noktaEkle(c) {
    var e = viewer.entities.add({
      position: c,
      point: { pixelSize: ptSize, color: Cesium.Color.YELLOW, disableDepthTestDistance: Infinity }
    });
    e.properties = e.properties || new Cesium.PropertyBag();
    e.properties.measurementType = "distance";
    window.kaydetEtkinlestir && window.kaydetEtkinlestir();
    suankiEntityler.push(e);
    return e;
  }

  function segmentEkle(a, b) {
    var e = viewer.entities.add({
      polyline: { positions: [a, b], width: lineW, material: Cesium.Color.YELLOW, depthFailMaterial: Cesium.Color.YELLOW }
    });
    e.properties = e.properties || new Cesium.PropertyBag();
    e.properties.measurementType = "distance";
    window.kaydetEtkinlestir && window.kaydetEtkinlestir();
    suankiEntityler.push(e);
    return e;
  }

  function etiketEkle(c, yazi) {
    var e = viewer.entities.add({
      position: c,
      label: {
        text: yazi, font: 'bold 14px sans-serif',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 4,
        backgroundColor: Cesium.Color.fromBytes(20, 100, 244),
        backgroundPadding: new Cesium.Cartesian2(5, 5),
        disableDepthTestDistance: Infinity,
        pixelOffset: new Cesium.Cartesian2(0, -20)
      }
    });
    suankiEntityler.push(e);
    return e;
  }

  function dinamikOlustur() {
    if (!dynNokta) {
      dynNokta = viewer.entities.add({ point: { pixelSize: ptSize, color: Cesium.Color.YELLOW, disableDepthTestDistance: Infinity } });
    }
    if (!dynCizgi) {
      dynCizgi = viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(function() {
            if (!tikladiklarim.length || !dynNokta.position) return [];
            return [tikladiklarim[tikladiklarim.length-1], dynNokta.position.getValue()];
          }, false),
          width: lineW, material: Cesium.Color.YELLOW
        }
      });
    }
    if (!dynEtiket) {
      dynEtiket = viewer.entities.add({
        label: {
          text: '', font: 'bold 14px sans-serif',
          style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.YELLOW,
          showBackground: true, backgroundColor: Cesium.Color.fromBytes(20, 100, 244),
          disableDepthTestDistance: Infinity, pixelOffset: new Cesium.Cartesian2(0, -10)
        }
      });
    }
  }

  function olcumBitir() {
    [dynCizgi, dynEtiket].forEach(function(e) { if (e) e.show = false; });
    if (tikladiklarim.length >= 2) {
      tumKalicilar.push(...suankiEntityler);
    } else {
      suankiEntityler.forEach(function(e) { viewer.entities.remove(e); });
      if (toplamEtiket) { viewer.entities.remove(toplamEtiket); toplamEtiket = null; }
    }
    suankiEntityler = []; tikladiklarim = []; toplamMesafe = 0;
  }

  function hepsiniTemizle() {
    tumKalicilar.concat(suankiEntityler).forEach(function(e) { viewer.entities.remove(e); });
    tumKalicilar = []; suankiEntityler = [];
    if (toplamEtiket) { viewer.entities.remove(toplamEtiket); toplamEtiket = null; }
    tikladiklarim = []; toplamMesafe = 0;
  }

  btn.addEventListener("click", function() {
    olcuyorum = !olcuyorum;
    btn.classList.toggle("active", olcuyorum);
    btn.style.backgroundColor = olcuyorum ? 'rgba(60,120,200,0.5)' : 'rgba(8,13,26,0.85)';
    if (!olcuyorum) {
      hepsiniTemizle();
      [dynNokta, dynCizgi, dynEtiket].forEach(function(e) { if (e) viewer.entities.remove(e); });
      dynNokta = dynCizgi = dynEtiket = null;
    } else {
      dinamikOlustur();
    }
  });

  handler.setInputAction(function(m) {
    if (!olcuyorum) return;
    dinamikOlustur();
    var w = yakinNokta(viewer.scene, m.endPosition, snapR);
    if (!Cesium.defined(w)) { [dynNokta,dynCizgi,dynEtiket].forEach(function(e) { if (e) e.show = false; }); return; }
    [dynNokta,dynCizgi,dynEtiket].forEach(function(e) { if (e) e.show = true; });
    dynNokta.position = w;
    if (tikladiklarim.length) {
      var onceki = tikladiklarim[tikladiklarim.length-1];
      var orta = Cesium.Cartesian3.midpoint(onceki, w, new Cesium.Cartesian3());
      dynEtiket.position = orta;
      dynEtiket.label.text = ' ' + Cesium.Cartesian3.distance(onceki, w).toFixed(2) + ' m';
    } else {
      dynEtiket.position = w; dynEtiket.label.text = '';
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  handler.setInputAction(function() {
    if (!olcuyorum || !dynNokta?.position) return;
    var w = dynNokta.position.getValue();
    if (!Cesium.defined(w)) return;
    noktaEkle(w);
    if (tikladiklarim.length) {
      var onceki = tikladiklarim[tikladiklarim.length-1];
      segmentEkle(onceki, w);
      var d = Cesium.Cartesian3.distance(onceki, w);
      toplamMesafe += d;
      etiketEkle(Cesium.Cartesian3.midpoint(onceki, w, new Cesium.Cartesian3()), ' ' + d.toFixed(2) + ' m');
    }
    tikladiklarim.push(w);
    if (tikladiklarim.length >= 3) {
      if (toplamEtiket) viewer.entities.remove(toplamEtiket);
      toplamEtiket = viewer.entities.add({
        position: w,
        label: {
          text: 'Top.: ' + toplamMesafe.toFixed(2) + ' m',
          font: 'bold 15px sans-serif', style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3.2,
          showBackground: true, backgroundColor: Cesium.Color.fromBytes(2, 35, 69),
          backgroundPadding: new Cesium.Cartesian2(5, 5),
          disableDepthTestDistance: Infinity, pixelOffset: new Cesium.Cartesian2(0, -15)
        }
      });
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  handler.setInputAction(function() {
    if (!olcuyorum || !tikladiklarim.length) return;
    olcumBitir();
  }, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
}


function hizSinirla(fn) {
  var bekliyor = false, sonArg;
  return function(arg) {
    sonArg = arg;
    if (bekliyor) return;
    bekliyor = true;
    requestAnimationFrame(function() { bekliyor = false; fn(sonArg); });
  };
}

function yerelDuzlem(orijin) {
  var enu = Cesium.Transforms.eastNorthUpToFixedFrame(orijin);
  var ters = Cesium.Matrix4.inverse(enu, new Cesium.Matrix4());
  return {
    xy: function(cart) {
      var v = Cesium.Matrix4.multiplyByPoint(ters, cart, new Cesium.Cartesian3());
      return { x: v.x, y: v.y };
    }
  };
}

function alanOlcumBaslat(viewer, opts) {
  opts = opts || {};
  var snapR = opts.snapPixelRadius || 6;
  var ptSize = opts.pointSize || 8;
  var lineW = opts.lineWidth || 2;
  var renk = opts.outlineColor || Cesium.Color.YELLOW;

  var olcuyorum = false;
  var handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
  var tumKalicilar = [];
  var tikladiklarim = [];

  var dynNokta = null, dynCizgi = null, dynEtiket = null;
  var hoverPoz = null, dynPozlar = [], enu = null;

  function frame() { if (viewer?.scene) viewer.scene.requestRender(); }

  function dinamikOlustur() {
    if (!dynNokta) {
      dynNokta = viewer.entities.add({ position: undefined, point: { pixelSize: ptSize, color: renk, disableDepthTestDistance: Infinity }, show: false });
    }
    if (!dynCizgi) {
      dynCizgi = viewer.entities.add({
        polyline: { positions: new Cesium.CallbackProperty(function() { return dynPozlar; }, false), width: lineW, material: renk, depthFailMaterial: renk },
        show: false
      });
    }
    if (!dynEtiket) {
      dynEtiket = viewer.entities.add({
        position: undefined,
        label: {
          text: '', font: 'bold 14px sans-serif', style: Cesium.LabelStyle.FILL_AND_OUTLINE,
          fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
          showBackground: true, backgroundColor: Cesium.Color.fromBytes(20, 100, 244, 200),
          disableDepthTestDistance: Infinity, pixelOffset: new Cesium.Cartesian2(0, -10)
        },
        show: false
      });
    }
  }

  function merkez(pozlar) {
    var t = pozlar.reduce(function(a, p) { a.x+=p.x; a.y+=p.y; a.z+=p.z; return a; }, new Cesium.Cartesian3(0,0,0));
    return new Cesium.Cartesian3(t.x/pozlar.length, t.y/pozlar.length, t.z/pozlar.length);
  }

  function alanHesap(pozlar) {
    if (!pozlar || pozlar.length < 3) return 0;
    if (!enu) enu = yerelDuzlem(merkez(pozlar));
    var pts = pozlar.map(function(p) { return enu.xy(p); });
    var a = 0, j = pts.length - 1;
    for (var i = 0; i < pts.length; j = i++) a += pts[j].x * pts[i].y - pts[i].x * pts[j].y;
    return Math.abs(a) * 0.5;
  }

  function noktaEkle(c) {
    var e = viewer.entities.add({ position: c, point: { pixelSize: ptSize, color: renk, disableDepthTestDistance: Infinity } });
    tumKalicilar.push(e);
  }

  function kapaliCizgiEkle(pts) {
    var kapali = pts.concat(pts[0]);
    var e = viewer.entities.add({ polyline: { positions: kapali, width: lineW, material: renk, depthFailMaterial: renk } });
    e.properties = e.properties || new Cesium.PropertyBag();
    e.properties.measurementType = "area";
    if (typeof window.kaydetEtkinlestir === 'function') window.kaydetEtkinlestir();
    tumKalicilar.push(e);
  }

  function alanEtiketiEkle(pts) {
    var merk = merkez(pts);
    enu = yerelDuzlem(merk);
    var alan = alanHesap(pts).toFixed(2);
    var e = viewer.entities.add({
      position: merk,
      label: {
        text: 'Alan: ' + alan + ' m²', font: 'bold 16px sans-serif',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3,
        showBackground: true, backgroundColor: Cesium.Color.fromBytes(20, 100, 244, 200),
        disableDepthTestDistance: Infinity, pixelOffset: new Cesium.Cartesian2(0, -10)
      }
    });
    tumKalicilar.push(e);
  }

  function temizle() { tumKalicilar.forEach(function(e) { viewer.entities.remove(e); }); tumKalicilar = []; }

  var mouseMove = hizSinirla(function(evt) {
    if (!olcuyorum) return;
    dinamikOlustur();
    var w = yakinNokta(viewer.scene, evt.endPosition, snapR);
    hoverPoz = w;
    if (!Cesium.defined(w)) { dynNokta.show = dynCizgi.show = dynEtiket.show = false; frame(); return; }
    dynNokta.position = w; dynNokta.show = true;
    var taban = tikladiklarim.length ? tikladiklarim.concat([w]) : [w];
    dynPozlar = taban.length >= 2 ? taban.concat([tikladiklarim[0]]) : taban;
    dynCizgi.show = taban.length >= 2;
    if (taban.length >= 3) {
      if (!enu) enu = yerelDuzlem(merkez(taban));
      dynEtiket.label.text = 'Alan: ' + alanHesap(taban).toFixed(2) + ' m²';
      dynEtiket.position = merkez(taban);
      dynEtiket.show = true;
    } else { dynEtiket.show = false; }
    frame();
  });

  function solTik() {
    if (!olcuyorum || !Cesium.defined(hoverPoz)) return;
    var w = Cesium.Cartesian3.clone(hoverPoz);
    tikladiklarim.push(w); noktaEkle(w);
    enu = yerelDuzlem(merkez(tikladiklarim));
    frame();
  }

  function sagTik() {
    if (!olcuyorum || tikladiklarim.length < 3) return;
    kapaliCizgiEkle(tikladiklarim); alanEtiketiEkle(tikladiklarim);
    tikladiklarim = []; dynPozlar = [];
    dynNokta.show = dynCizgi.show = dynEtiket.show = false;
    enu = null; frame();
  }

  function handlerBagla() {
    handler.setInputAction(mouseMove, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    handler.setInputAction(solTik, Cesium.ScreenSpaceEventType.LEFT_CLICK);
    handler.setInputAction(sagTik, Cesium.ScreenSpaceEventType.RIGHT_CLICK);
  }

  function handlerKopar() {
    handler.removeInputAction(Cesium.ScreenSpaceEventType.MOUSE_MOVE);
    handler.removeInputAction(Cesium.ScreenSpaceEventType.LEFT_CLICK);
    handler.removeInputAction(Cesium.ScreenSpaceEventType.RIGHT_CLICK);
  }

  var btn = document.getElementById('alanOlcum');
  btn.addEventListener('click', function() {
    olcuyorum = !olcuyorum;
    btn.classList.toggle('active', olcuyorum);
    btn.style.backgroundColor = olcuyorum ? 'rgba(60,120,200,0.5)' : 'rgba(8,13,26,0.85)';
    if (olcuyorum) {
      tikladiklarim = []; dynPozlar = []; enu = null; dinamikOlustur(); handlerBagla();
    } else {
      handlerKopar();
      if (dynNokta) dynNokta.show = false;
      if (dynCizgi) dynCizgi.show = false;
      if (dynEtiket) dynEtiket.show = false;
      temizle();
    }
    frame();
  });
}


function yukseklikOlcumBaslat(viewer, opts) {
  opts = opts || {};
  var snapR = opts.snapPixelRadius || 6;
  var ptSize = opts.pointSize || 8;
  var lineW = opts.lineWidth || 2;

  var olcuyorum = false;
  var temelNokta = null;
  var tumKalicilar = [];
  var dynNokta, dynHipo, dynYat, dynDik;
  var dynEtHipo, dynEtYat, dynEtDik;
  var simdikiPik = null;

  var handler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
  var btn = document.getElementById("yukseklikOlcumBtn");

  function enYakinPiksel(scene, pos2D, r) {
    var cv = scene.canvas;
    var en_iyi, min_d = Infinity;
    for (var dx = -r; dx <= r; dx++) {
      for (var dy = -r; dy <= r; dy++) {
        var p = new Cesium.Cartesian2(pos2D.x + dx, pos2D.y + dy);
        if (p.x < 0 || p.y < 0 || p.x > cv.width || p.y > cv.height) continue;
        var w = scene.pickPosition(p);
        if (Cesium.defined(w)) { var d2 = dx*dx+dy*dy; if (d2 < min_d) { en_iyi = w; min_d = d2; } }
      }
    }
    return en_iyi;
  }

  function dinamikOlustur() {
    if (!dynNokta) {
      dynNokta = viewer.entities.add({
        position: new Cesium.CallbackProperty(function() { return simdikiPik; }, false),
        point: { pixelSize: ptSize, color: Cesium.Color.YELLOW, disableDepthTestDistance: Infinity }
      });
    }
    if (!dynHipo) {
      dynHipo = viewer.entities.add({ polyline: { positions: new Cesium.CallbackProperty(function() { return temelNokta && simdikiPik ? [temelNokta, simdikiPik] : []; }, false), width: lineW, material: Cesium.Color.YELLOW } });
    }
    if (!dynYat) {
      dynYat = viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(function() {
            if (!temelNokta || !simdikiPik) return [];
            var c1 = Cesium.Ellipsoid.WGS84.cartesianToCartographic(temelNokta);
            var c2 = Cesium.Ellipsoid.WGS84.cartesianToCartographic(simdikiPik);
            var duz = new Cesium.Cartographic(c2.longitude, c2.latitude, c1.height);
            return [temelNokta, Cesium.Ellipsoid.WGS84.cartographicToCartesian(duz)];
          }, false),
          width: lineW, material: Cesium.Color.WHITE
        }
      });
    }
    if (!dynDik) {
      dynDik = viewer.entities.add({
        polyline: {
          positions: new Cesium.CallbackProperty(function() {
            if (!temelNokta || !simdikiPik) return [];
            var c1 = Cesium.Ellipsoid.WGS84.cartesianToCartographic(temelNokta);
            var c2 = Cesium.Ellipsoid.WGS84.cartesianToCartographic(simdikiPik);
            var duz = new Cesium.Cartographic(c2.longitude, c2.latitude, c1.height);
            return [Cesium.Ellipsoid.WGS84.cartographicToCartesian(duz), simdikiPik];
          }, false),
          width: lineW, material: Cesium.Color.BLUE
        }
      });
    }

    function cbPos(getterFn) { return new Cesium.CallbackProperty(getterFn, false); }
    function cbTxt(getterFn) { return new Cesium.CallbackProperty(getterFn, false); }
    var etiketBase = { font: 'bold 14px sans-serif', style: Cesium.LabelStyle.FILL_AND_OUTLINE, fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3, disableDepthTestDistance: Infinity, pixelOffset: new Cesium.Cartesian2(0, -10) };

    if (!dynEtHipo) {
      dynEtHipo = viewer.entities.add({
        position: cbPos(function() { return temelNokta && simdikiPik ? Cesium.Cartesian3.midpoint(temelNokta, simdikiPik, new Cesium.Cartesian3()) : null; }),
        label: Object.assign({}, etiketBase, { text: cbTxt(function() { return temelNokta && simdikiPik ? Cesium.Cartesian3.distance(temelNokta, simdikiPik).toFixed(2) + ' m' : ''; }) })
      });
    }
    if (!dynEtYat) {
      dynEtYat = viewer.entities.add({
        position: cbPos(function() {
          if (!temelNokta || !simdikiPik) return null;
          var c1 = Cesium.Ellipsoid.WGS84.cartesianToCartographic(temelNokta);
          var c2 = Cesium.Ellipsoid.WGS84.cartesianToCartographic(simdikiPik);
          var pH = Cesium.Ellipsoid.WGS84.cartographicToCartesian(new Cesium.Cartographic(c2.longitude, c2.latitude, c1.height));
          return Cesium.Cartesian3.midpoint(temelNokta, pH, new Cesium.Cartesian3());
        }),
        label: Object.assign({}, etiketBase, { text: cbTxt(function() {
          if (!temelNokta || !simdikiPik) return '';
          var c1 = Cesium.Ellipsoid.WGS84.cartesianToCartographic(temelNokta);
          var c2 = Cesium.Ellipsoid.WGS84.cartesianToCartographic(simdikiPik);
          var pH = Cesium.Ellipsoid.WGS84.cartographicToCartesian(new Cesium.Cartographic(c2.longitude, c2.latitude, c1.height));
          return Cesium.Cartesian3.distance(temelNokta, pH).toFixed(2) + ' m';
        }) })
      });
    }
    if (!dynEtDik) {
      dynEtDik = viewer.entities.add({
        position: cbPos(function() {
          if (!temelNokta || !simdikiPik) return null;
          var c1 = Cesium.Ellipsoid.WGS84.cartesianToCartographic(temelNokta);
          var c2 = Cesium.Ellipsoid.WGS84.cartesianToCartographic(simdikiPik);
          var pH = Cesium.Ellipsoid.WGS84.cartographicToCartesian(new Cesium.Cartographic(c2.longitude, c2.latitude, c1.height));
          return Cesium.Cartesian3.midpoint(pH, simdikiPik, new Cesium.Cartesian3());
        }),
        label: Object.assign({}, etiketBase, { text: cbTxt(function() {
          if (!temelNokta || !simdikiPik) return '';
          var c1 = Cesium.Ellipsoid.WGS84.cartesianToCartographic(temelNokta);
          var c2 = Cesium.Ellipsoid.WGS84.cartesianToCartographic(simdikiPik);
          var pH = Cesium.Ellipsoid.WGS84.cartographicToCartesian(new Cesium.Cartographic(c2.longitude, c2.latitude, c1.height));
          return Cesium.Cartesian3.distance(pH, simdikiPik).toFixed(2) + ' m';
        }) })
      });
    }
  }

  function hepsiniSil() {
    tumKalicilar.forEach(function(e) { viewer.entities.remove(e); });
    [dynNokta,dynHipo,dynYat,dynDik,dynEtHipo,dynEtYat,dynEtDik].forEach(function(e) { if (e) viewer.entities.remove(e); });
    tumKalicilar = []; temelNokta = simdikiPik = null;
    dynNokta = dynHipo = dynYat = dynDik = dynEtHipo = dynEtYat = dynEtDik = null;
  }

  btn.addEventListener("click", function() {
    olcuyorum = !olcuyorum;
    btn.classList.toggle("active", olcuyorum);
    btn.style.backgroundColor = olcuyorum ? 'rgba(60,120,200,0.5)' : 'rgba(8,13,26,0.85)';
    if (!olcuyorum) hepsiniSil();
    else dinamikOlustur();
  });

  handler.setInputAction(function(evt) {
    if (!olcuyorum) return;
    dinamikOlustur();
    var w = enYakinPiksel(viewer.scene, evt.endPosition, snapR);
    simdikiPik = w;
    if (!Cesium.defined(w)) {
      [dynNokta,dynHipo,dynYat,dynDik,dynEtHipo,dynEtYat,dynEtDik].forEach(function(e) { if (e) e.show = false; });
      return;
    }
    dynNokta.show = true;
    var kenarGoster = Boolean(temelNokta);
    [dynHipo,dynYat,dynDik,dynEtHipo,dynEtYat,dynEtDik].forEach(function(e) { if (e) e.show = kenarGoster; });
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  handler.setInputAction(function() {
    if (!olcuyorum || !Cesium.defined(simdikiPik)) return;

    if (!temelNokta) {
      temelNokta = Cesium.Cartesian3.clone(simdikiPik);
      var pt = viewer.entities.add({ position: temelNokta, point: { pixelSize: ptSize, color: Cesium.Color.YELLOW } });
      tumKalicilar.push(pt);
      return;
    }

    var p1 = temelNokta, p2 = simdikiPik;
    var c1 = Cesium.Ellipsoid.WGS84.cartesianToCartographic(p1);
    var c2 = Cesium.Ellipsoid.WGS84.cartesianToCartographic(p2);
    var pH = Cesium.Ellipsoid.WGS84.cartographicToCartesian(new Cesium.Cartographic(c2.longitude, c2.latitude, c1.height));

    [p1, pH, p2].forEach(function(poz) {
      var pt = viewer.entities.add({ position: poz, point: { pixelSize: ptSize, color: Cesium.Color.YELLOW } });
      tumKalicilar.push(pt);
    });

    var kenarlar = [
      { pts: [p1, p2], renk: Cesium.Color.YELLOW },
      { pts: [p1, pH], renk: Cesium.Color.WHITE },
      { pts: [pH, p2], renk: Cesium.Color.BLUE }
    ];
    kenarlar.forEach(function(k) {
      var e = viewer.entities.add({ polyline: { positions: k.pts, width: lineW, material: k.renk } });
      tumKalicilar.push(e);
    });

    var dHipo = Cesium.Cartesian3.distance(p1, p2);
    var dYat = Cesium.Cartesian3.distance(p1, pH);
    var dDik = Cesium.Cartesian3.distance(pH, p2);

    [[Cesium.Cartesian3.midpoint(p1,p2,new Cesium.Cartesian3()), dHipo],
     [Cesium.Cartesian3.midpoint(p1,pH,new Cesium.Cartesian3()), dYat],
     [Cesium.Cartesian3.midpoint(pH,p2,new Cesium.Cartesian3()), dDik]].forEach(function(item) {
      var e = viewer.entities.add({
        position: item[0],
        label: { text: item[1].toFixed(2) + ' m', font: 'bold 14px sans-serif', style: Cesium.LabelStyle.FILL_AND_OUTLINE, fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 3, pixelOffset: new Cesium.Cartesian2(0, -10) }
      });
      tumKalicilar.push(e);
    });

    [dynNokta,dynHipo,dynYat,dynDik,dynEtHipo,dynEtYat,dynEtDik].forEach(function(e) { if (e) e.show = false; });
    temelNokta = null;
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}


function ortoPerspToggle(viewer) {
  var orjFrustum = viewer.camera.frustum;
  var orjFov = orjFrustum.fov;
  var orjNear = orjFrustum.near;
  var orjFar = orjFrustum.far;

  var ortografik = false;
  var btn = document.getElementById('ortoPerspektif');
  var ikon = document.querySelector('#ortoPerspektif img');

  function ikonGuncelle(mod) {
    ikon.src = mod === 'ortho' ? 'icon/ortografik.png' : 'icon/perspektif.png';
    btn.title = mod === 'ortho' ? 'Ortografik' : 'Perspektif';
  }

  function odakNokta() {
    var merkez = new Cesium.Cartesian2(viewer.canvas.clientWidth * 0.5, viewer.canvas.clientHeight * 0.5);
    var ray = viewer.camera.getPickRay(merkez);
    var p = viewer.scene.globe.pick(ray, viewer.scene);
    return Cesium.defined(p) ? p : viewer.camera.pickEllipsoid(merkez, viewer.scene.globe.ellipsoid);
  }

  btn.addEventListener('click', function() {
    var en = viewer.canvas.clientWidth / viewer.canvas.clientHeight;
    if (!ortografik) {
      var odak = odakNokta();
      if (!Cesium.defined(odak)) return;
      var uzaklik = Cesium.Cartesian3.distance(viewer.camera.positionWC, odak);
      var genislik = 2.0 * uzaklik * Math.tan(orjFov * 0.5);
      viewer.camera.frustum = new Cesium.OrthographicFrustum({ width: genislik, near: orjNear, far: orjFar, aspectRatio: en });
      ortografik = true; ikonGuncelle('ortho');
    } else {
      viewer.camera.frustum = new Cesium.PerspectiveFrustum({ fov: orjFov, near: orjNear, far: orjFar, aspectRatio: en });
      ortografik = false; ikonGuncelle('persp');
    }
  });

  ikonGuncelle('persp');
}


document.getElementById("ucDereceCizgi").addEventListener("click", function() {
  turefMeridyenToggle(viewer);
});

var meridyenEntityler = [];

function turefMeridyenToggle(viewer) {
  if (meridyenEntityler.length) {
    meridyenEntityler.forEach(function(e) { viewer.entities.remove(e); });
    meridyenEntityler = [];
    return;
  }

  var merler = [27, 30, 33, 36, 39, 42, 45];
  var minLat = 35.5, maxLat = 42.2;

  merler.forEach(function(lon) {
    var merkez = viewer.entities.add({
      polyline: { positions: Cesium.Cartesian3.fromDegreesArray([lon, minLat, lon, maxLat]), width: 2, material: Cesium.Color.CYAN.withAlpha(0.8), clampToGround: true }
    });
    var sol = viewer.entities.add({
      polyline: { positions: Cesium.Cartesian3.fromDegreesArray([lon-1.5, minLat, lon-1.5, maxLat]), width: 2, material: Cesium.Color.YELLOW.withAlpha(0.9), clampToGround: true }
    });
    var sag = viewer.entities.add({
      polyline: { positions: Cesium.Cartesian3.fromDegreesArray([lon+1.5, minLat, lon+1.5, maxLat]), width: 2, material: Cesium.Color.YELLOW.withAlpha(0.9), clampToGround: true }
    });
    var etiket = viewer.entities.add({
      position: Cesium.Cartesian3.fromDegrees(lon, maxLat),
      label: { text: ' ' + lon + '°', font: '14px sans-serif', fillColor: Cesium.Color.CYAN, style: Cesium.LabelStyle.FILL_AND_OUTLINE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2, verticalOrigin: Cesium.VerticalOrigin.BOTTOM, pixelOffset: new Cesium.Cartesian2(0, -12), showBackground: true }
    });

    meridyenEntityler.push(merkez, sol, sag, etiket);
  });
}


var pinHandler = null;
var pinEntityler = [];
var sonTikPoz = null;
var sonPinEntity = null;
var suruklenenPin = null;
var hoverdaPin = null;

function pinKurulum(viewer) {
  viewer.scene.globe.depthTestAgainstTerrain = true;

  var btnPin = document.getElementById("pinAt");
  var panel = document.getElementById("pinInputPanel");
  var pinMetin = document.getElementById("pinText");
  var kaydetBtn = document.getElementById("pinSaveBtn");
  var kapatBtn = document.getElementById("pinCloseBtn");

  btnPin.addEventListener("click", function() {
    btnPin.classList.add("active");
    btnPin.style.backgroundColor = 'rgba(60,120,200,0.5)';

    if (pinHandler) { pinHandler.destroy(); pinHandler = null; }

    pinHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
    pinHandler.setInputAction(function(click) {
      var poz = yuzeyPozAl(viewer, click.position);
      if (!Cesium.defined(poz)) return;

      var entity = viewer.entities.add({
        position: poz,
        billboard: {
          image: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI0MCIgaGVpZ2h0PSI1MCIgdmlld0JveD0iMCAwIDQwIDUwIj48cGF0aCBkPSJNMjAgMEM4Ljk1IDAgMCA4Ljk1IDAgMjBjMCA1Ljc0IDIuNiAxMC44OCA2LjY3IDE0LjQ3YTM4LjQ2IDM4LjQ2IDAgMCAwIDkuNjcgMTAuNTVjMi4xMyAxLjg3IDUuMDYgMS44NyA3LjE5IDBhMzguNCAzOC40IDAgMCAwIDkuNjctMTAuNTVDMzcuNCAzMC44OCA0MCAyNS43NCA0MCAyMCA0MCA4Ljk1IDMxLjA1IDAgMjAgMHoiIGZpbGw9IiNmMTQ2NDgiLz48Y2lyY2xlIGN4PSIyMCIgY3k9IjE4IiByPSI4IiBmaWxsPSJ3aGl0ZSIvPjwvc3ZnPg==",
          scale: 0.7,
          verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
          disableDepthTestDistance: Infinity
        },
        label: { text: "", show: false }
      });

      pinEntityler.push(entity);
      sonTikPoz = poz;
      sonPinEntity = entity;

      pinMetin.value = "";
      panel.style.display = "block";
      panelPozAyarla(viewer, poz, panel);

      pinHandler.destroy(); pinHandler = null;
      btnPin.classList.remove("active");
      btnPin.style.backgroundColor = 'rgba(8,13,26,0.85)';
    }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
  });

  kaydetBtn.addEventListener("click", function() {
    if (!sonTikPoz || !sonPinEntity) return;
    var metin = pinMetin.value.trim();
    if (metin) {
      sonPinEntity.label = {
        text: metin, font: "bold 16px sans-serif",
        fillColor: Cesium.Color.WHITE, outlineColor: Cesium.Color.BLACK, outlineWidth: 2,
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        verticalOrigin: Cesium.VerticalOrigin.TOP,
        pixelOffset: new Cesium.Cartesian2(0, -60),
        showBackground: true,
        backgroundColor: Cesium.Color.fromBytes(20, 100, 244, 200),
        backgroundPadding: new Cesium.Cartesian2(10, 7),
        disableDepthTestDistance: Infinity, show: true
      };
    }
    panel.style.display = "none";
    sonTikPoz = null; sonPinEntity = null;
  });

  kapatBtn.addEventListener("click", function() {
    panel.style.display = "none";
    sonTikPoz = null; sonPinEntity = null;
  });

  var dragHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);

  dragHandler.setInputAction(function(click) {
    var secilen = viewer.scene.pick(click.position);
    if (Cesium.defined(secilen) && pinEntityler.includes(secilen.id)) {
      suruklenenPin = secilen.id;
      viewer.scene.screenSpaceCameraController.enableRotate = false;
      viewer.scene.screenSpaceCameraController.enableZoom = false;
    }
  }, Cesium.ScreenSpaceEventType.LEFT_DOWN);

  dragHandler.setInputAction(function(hareket) {
    if (suruklenenPin) {
      var yeniPoz = yuzeyPozAl(viewer, hareket.endPosition);
      if (Cesium.defined(yeniPoz)) suruklenenPin.position = yeniPoz;
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);

  dragHandler.setInputAction(function() {
    suruklenenPin = null;
    viewer.scene.screenSpaceCameraController.enableRotate = true;
    viewer.scene.screenSpaceCameraController.enableZoom = true;
  }, Cesium.ScreenSpaceEventType.LEFT_UP);

  var tikHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
  tikHandler.setInputAction(function(click) {
    if (suruklenenPin) return;
    var secilen = viewer.scene.pick(click.position);
    if (Cesium.defined(secilen) && pinEntityler.includes(secilen.id)) {
      viewer.entities.remove(secilen.id);
      var idx = pinEntityler.indexOf(secilen.id);
      if (idx !== -1) pinEntityler.splice(idx, 1);
    }
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  var hoverHandler = new Cesium.ScreenSpaceEventHandler(viewer.canvas);
  hoverHandler.setInputAction(function(hareket) {
    if (suruklenenPin) return;
    var secilen = viewer.scene.pick(hareket.endPosition);
    if (hoverdaPin && hoverdaPin !== secilen?.id) {
      hoverTemizle(hoverdaPin); hoverdaPin = null;
    }
    if (Cesium.defined(secilen) && pinEntityler.includes(secilen.id) && !hoverdaPin) {
      hoverdaPin = secilen.id; hoverGoster(secilen.id);
    }
  }, Cesium.ScreenSpaceEventType.MOUSE_MOVE);
}

function hoverGoster(pinEntity) {
  if (pinEntity.billboard) pinEntity.billboard.scale = 0.9;
  var silIkonu = viewer.entities.add({
    position: pinEntity.position,
    billboard: {
      image: "data:image/svg+xml;charset=utf-8," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24"><circle cx="12" cy="12" r="12" fill="red" opacity="0.8"/><text x="12" y="18" font-size="16" font-family="Arial" text-anchor="middle" fill="white">×</text></svg>'),
      verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
      pixelOffset: new Cesium.Cartesian2(0, 10),
      disableDepthTestDistance: Infinity, scale: 0.8
    }
  });
  pinEntity.removeIcon = silIkonu;
}

function hoverTemizle(pinEntity) {
  if (pinEntity.billboard) pinEntity.billboard.scale = 0.7;
  if (pinEntity.removeIcon) { viewer.entities.remove(pinEntity.removeIcon); pinEntity.removeIcon = null; }
}

function panelPozAyarla(viewer, worldPos, panel) {
  if (!Cesium.defined(worldPos)) return;
  var ekranPoz = viewer.scene.cartesianToCanvasCoordinates(worldPos);
  if (!Cesium.defined(ekranPoz)) return;

  var sol = ekranPoz.x + 10;
  var ust = ekranPoz.y - 60;

  if (sol + panel.offsetWidth > viewer.canvas.clientWidth) sol = viewer.canvas.clientWidth - panel.offsetWidth - 10;
  if (ust < 0) ust = 10;
  if (ust + panel.offsetHeight > viewer.canvas.clientHeight) ust = viewer.canvas.clientHeight - panel.offsetHeight - 10;

  panel.style.left = sol + "px";
  panel.style.top = ust + "px";
}

function yuzeyPozAl(viewer, ekranPoz) {
  if (!ekranPoz) return null;
  var poz = viewer.scene.pickPosition(ekranPoz);
  if (!Cesium.defined(poz) || globeYuzeyindeMi(viewer, poz)) {
    var ray = viewer.camera.getPickRay(ekranPoz);
    if (!ray) return null;
    var secilen = viewer.scene.pick(ekranPoz);
    if (Cesium.defined(secilen) && Cesium.defined(secilen.primitive)) {
      var sonuc = viewer.scene.pickFromRay(ray);
      if (Cesium.defined(sonuc)) return sonuc.position;
    }
    poz = viewer.scene.globe.pick(ray, viewer.scene);
  }
  return poz;
}

function globeYuzeyindeMi(viewer, poz) {
  if (!Cesium.defined(poz)) return false;
  var carto = Cesium.Cartographic.fromCartesian(poz);
  var h = viewer.scene.globe.getHeight(carto);
  return Math.abs(carto.height - (h || 0)) < 1.0;
}

var kullaniciAdiSpan = document.getElementById('kullaniciAdi');
var ad = localStorage.getItem('sgAd') || 'Kullanici';
var rol = localStorage.getItem('sgRol');

if (kullaniciAdiSpan) {
  kullaniciAdiSpan.textContent = '👤 ' + ad;
}

if (rol === 'admin') {
  document.getElementById('yonetimBtn').style.display = 'block';
}
function cikisYap() {
  localStorage.removeItem('sgToken');
  window.location.href = 'login.html';
}