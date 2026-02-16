# Ghid: Import Prețuri din Excel

## 📋 Prezentare Generală

Acest sistem permite importul prețurilor produselor din fișiere Excel (.xlsx, .xls) atât pentru produse cât și pentru sincronizare cu SmartBill.

---

## 🚀 Mod de Utilizare

### Opțiunea 1: Via Frontend (Recomandat) 👍

#### Pas 1: Accesează Pagina de Import
```
http://localhost/import-prices
```

#### Pas 2: Descarcă Template-ul Excel
- Click pe butonul "Descarcă Template Excel"
- Vei primi un fișier `price-import-template.xlsx`

#### Pas 3: Completează Template-ul
Exemplu de structură:

| sku | price |
|-----|-------|
| PAN-LED-6060-36W | 89.25 |
| SPOT-GU10-7W-WW | 14.88 |
| LIN-LED-120-36W | 77.35 |

**Coloane necesare:**
- `sku` / `code` / `Cod produs` - Codul produsului
- `price` / `pret` / `Pret` - Prețul produsului

**Coloane opționale (citite automat dacă există):**
- `Denumire produs` - Numele produsului (se actualizează)
- `Pretul contine TVA` - Da/Nu (se folosește pentru calcul)
- `Cota TVA` - Rata TVA (ex: 19, 9, 5)
- `Moneda` - Moneda (doar RON acceptat)
- `Unitate masura` - UM (ex: buc, kg, m)

#### Pas 4: Configurează Opțiunile

**TVA:**
- TVA % (default: 19%)
- "Prețul include TVA" - Da/Nu

**Coloane (opțional):**
- Lasă gol pentru detectare automată
- Sau specifică numele exact al coloanelor

**Mod Import:**
- ✅ **Preview** (recomandat prima dată) - Verifică fără a face modificări
- ⚠️ **Import REAL** - Actualizează efectiv prețurile

#### Pas 5: Încarcă și Procesează
1. Selectează fișierul Excel
2. Click "Preview Import" pentru a verifica
3. Verifică rezultatele
4. Dacă totul e OK, dezactivează "Preview" și click "IMPORT PREȚURI"

---

### Opțiunea 2: Via API (Pentru Automatizare)

#### A. Download Template
```bash
curl -X GET \
  'http://localhost:3000/api/v1/smartbill/template' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -o template.xlsx
```

#### B. Preview Import (fără modificări)
```bash
curl -X POST \
  'http://localhost:3000/api/v1/smartbill/import-prices' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -F 'file=@prices.xlsx' \
  -F 'dryRun=true' \
  -F 'vatRate=19' \
  -F 'priceIncludesVat=true'
```

#### C. Import Real
```bash
curl -X POST \
  'http://localhost:3000/api/v1/smartbill/import-prices' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -F 'file=@prices.xlsx' \
  -F 'dryRun=false' \
  -F 'vatRate=19' \
  -F 'priceIncludesVat=true'
```

---

## 📊 Parametri

### Parametri Opționali

| Parametru | Descriere | Default | Exemple |
|-----------|-----------|---------|---------|
| `skuColumn` | Numele coloanei cu SKU | Auto-detect | "sku", "code", "cod_produs" |
| `priceColumn` | Numele coloanei cu preț | Auto-detect | "price", "pret", "pret_vanzare" |
| `vatRate` | Rata TVA (%) | 19 | 19, 9, 5 |
| `priceIncludesVat` | Prețul include TVA | true | true, false |
| `dryRun` | Preview fără modificări | false | true, false |

---

## 📝 Formate Acceptate

### Formate Excel Acceptate
- `.xlsx` (Excel 2007+) ✅
- `.xls` (Excel 97-2003) ✅

### Structuri de Fișier Acceptate

#### Structură Minimă (Recomandată)
```
| sku           | price  |
|---------------|--------|
| PROD-001      | 100.00 |
| PROD-002      | 250.50 |
```

#### Structură Extinsă
```
| cod_produs    | pret_vanzare | tva | moneda |
|---------------|--------------|-----|--------|
| PROD-001      | 119.00       | 19  | RON    |
| PROD-002      | 297.60       | 19  | RON    |
```

#### Structură cu TVA Separat
```
| sku      | pret_fara_tva | tva |
|----------|---------------|-----|
| PROD-001 | 100.00        | 19  |
| PROD-002 | 250.50        | 19  |
```

#### Structură Completă Română (SmartBill Export)
```
| Denumire produs | Cod produs | Pret   | Pretul contine TVA | Unitate masura | Moneda | Cota TVA |
|-----------------|------------|--------|-------------------|----------------|--------|----------|
| Panou LED       | PAN-001    | 119.00 | Da                | buc            | RON    | 19       |
| Spot LED        | SPOT-002   | 14.88  | Da                | buc            | RON    | 19       |
```
**Notă**: Sistemul citește automat toate aceste coloane și folosește valorile pentru calcul corect al prețului fără TVA.

---

## 🔧 Detectare Automată Coloane

Sistemul detectează automat următoarele nume de coloane:

### Pentru SKU:
- `Cod produs` (SmartBill) ✅
- `sku`, `SKU`
- `code`, `Code`
- `productCode`, `product_code`
- `cod`, `cod_produs`

### Pentru Preț:
- `Pret` (SmartBill) ✅
- `price`, `Price`
- `pret`, `PRET`
- `pret_vanzare`, `pretVanzare`
- `basePrice`, `base_price`
- `priceWithVat`, `priceWithoutVat`

### Coloane Adiționale (citite automat dacă există):
- `Denumire produs` - Numele produsului
- `Pretul contine TVA` - Da/Nu (pentru calcul corect)
- `Cota TVA` - Rata TVA (înlocuiește setarea globală)
- `Moneda` - Moneda (validare RON)
- `Unitate masura` - Unitatea de măsură

---

## 📈 Exemplu de Răspuns

### Preview Success
```json
{
  "success": true,
  "data": {
    "message": "Preview completed (no changes made)",
    "totalRows": 100,
    "validRows": 95,
    "productsUpdated": 0,
    "productsNotFound": 5,
    "errors": [
      {
        "row": 15,
        "sku": "PROD-999",
        "error": "Product not found in database"
      }
    ],
    "preview": [
      {
        "sku": "PAN-LED-6060-36W",
        "name": "Panou LED 60x60 36W",
        "oldPrice": 75.00,
        "newPrice": 89.25
      }
    ]
  }
}
```

### Import Success
```json
{
  "success": true,
  "data": {
    "message": "Import completed",
    "totalRows": 100,
    "validRows": 95,
    "productsUpdated": 95,
    "productsNotFound": 5,
    "errors": [],
    "preview": []
  }
}
```

---

## ⚠️ Validări și Reguli

### Validări Obligatorii
1. ✅ SKU trebuie să existe în coloană
2. ✅ Prețul trebuie să fie număr > 0
3. ✅ Produsul trebuie să existe în baza de date

### Reguli de Import
1. 📦 **Produse Noi**: Nu se creează, doar se actualizează existente
2. 💰 **Prețuri**: Se salvează FĂRĂ TVA în `base_price`
3. 💱 **Moneda**: Se setează automat la RON
4. 🔄 **Actualizare**: Se actualizează `updated_at` automat

### Calcul Preț fără TVA
```
Dacă priceIncludesVat = true (sau "Pretul contine TVA" = "Da"):
  base_price = price / (1 + vatRate/100)
  Exemplu: 119 / 1.19 = 100 RON

Dacă priceIncludesVat = false (sau "Pretul contine TVA" = "Nu"):
  base_price = price
  Exemplu: 100 RON
```

**Notă**: Dacă Excel conține coloana "Pretul contine TVA" și "Cota TVA", aceste valori sunt folosite **per rând** în loc de setările globale. Acest lucru permite import mixt (produse cu TVA diferit în același fișier).

---

## 🛡️ Limitări

| Limitare | Valoare |
|----------|---------|
| Mărime maximă fișier | 10 MB |
| Format | Doar .xlsx, .xls |
| Rânduri | Nelimitat |
| Erori afișate | Primele 20 |
| Preview afișat | Primele 20 produse |

---

## 🐛 Troubleshooting

### Eroare: "Only Excel files are allowed"
**Soluție**: Asigură-te că fișierul are extensia `.xlsx` sau `.xls`

### Eroare: "SKU not found in column"
**Soluție**:
- Verifică că prima coloană conține SKU-uri
- Sau specifică manual numele coloanei în opțiuni

### Eroare: "Product not found in database"
**Soluție**:
- Produsul cu acel SKU nu există în sistem
- Creează produsul mai întâi sau verifică SKU-ul

### Prețuri = 0 după import
**Soluție**:
- Verifică că prețurile din Excel sunt numere (nu text)
- Verifică setarea "Prețul include TVA"

### Import parțial (unele produse nu se actualizează)
**Soluție**:
- Verifică secțiunea "Erori" din rezultate
- Corectează SKU-urile sau prețurile problematice

---

## 💡 Best Practices

### ✅ Recomandări

1. **Folosește Preview întotdeauna prima dată**
   - Verifică rezultatele înainte de import real

2. **Template-ul este prietenul tău**
   - Pornește de la template pentru structură corectă

3. **Backup înainte de import masiv**
   - Fă backup la baza de date pentru siguranță

4. **Verifică TVA-ul**
   - Asigură-te că setarea TVA este corectă

5. **Import incremental**
   - Pentru volume mari, importă în loturi de 100-200 produse

### ❌ Ce să eviți

1. ❌ Import fără preview
2. ❌ Fișiere cu coloane lipsă
3. ❌ SKU-uri duplicate în Excel
4. ❌ Prețuri negative sau 0
5. ❌ Caractere speciale în nume coloane

---

## 📞 Suport

Pentru probleme sau întrebări:
1. Verifică secțiunea Troubleshooting
2. Verifică log-urile: `docker logs cypher-erp-app | grep import`
3. Contactează echipa de suport

---

## 🔄 Integrare cu SmartBill

Acest sistem funcționează independent dar poate fi folosit împreună cu:

### 1. Sincronizare Stocuri SmartBill
```
POST /api/v1/smartbill/sync-stock
```
Sincronizează cantitățile din SmartBill

### 2. Extragere Prețuri din Facturi
```
POST /api/v1/smartbill/sync-prices
```
Extrage prețuri din facturile SmartBill

### 3. Import Excel (acest sistem)
```
POST /api/v1/smartbill/import-prices
```
Importă prețuri din Excel

**Flux Recomandat:**
1. Sincronizează stocuri din SmartBill
2. Încearcă extragerea prețurilor din facturi
3. Pentru produsele rămase fără preț, folosește import Excel

---

## 📅 Changelog

### v1.0.0 (2026-02-12)
- ✅ Implementare inițială
- ✅ Detectare automată coloane
- ✅ Preview mode
- ✅ Calcul automat preț fără TVA
- ✅ Validări complete
- ✅ Interfață frontend
- ✅ Template Excel
- ✅ Suport .xlsx și .xls
