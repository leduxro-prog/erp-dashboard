# Ghid: Sincronizare Prețuri din Facturi SmartBill

## Problema Identificată

API-ul SmartBill **NU returnează prețuri** prin endpoint-ul `/stocks`.
Răspunsul conține doar: SKU, nume, cantitate, unitate măsură.

## Soluția Implementată

Am creat un sistem care extrage prețurile din **facturile istorice** SmartBill.

---

## Cum Funcționează

1. **Obține facturile** din perioada specificată (default: 90 zile)
2. **Extrage prețurile** din produsele facturate
3. **Calculează automat** prețul fără TVA din prețul cu TVA
4. **Actualizează produsele** în baza de date cu prețurile găsite

---

## Utilizare

### 1. Preview - Verificare Prețuri (fără actualizare)

Pentru a vedea ce prețuri ar fi extrase **FĂRĂ a actualiza** baza de date:

```bash
# Via browser sau Postman
GET http://localhost:3000/api/v1/smartbill/preview-prices?daysBack=90

# Via curl
curl -X GET \
  'http://localhost:3000/api/v1/smartbill/preview-prices?daysBack=90' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

**Parametri:**
- `daysBack` (opțional): Câte zile înapoi să caute facturi (default: 90)

**Răspuns Exemplu:**
```json
{
  "success": true,
  "data": {
    "totalInvoices": 245,
    "totalProducts": 523,
    "productPrices": [
      {
        "sku": "PAN-LED-6060-36W",
        "name": "Panou LED 60x60 36W",
        "price": 75.00,
        "occurrences": 15
      },
      {
        "sku": "SPOT-GU10-7W-WW",
        "name": "Spot LED GU10 7W",
        "price": 12.50,
        "occurrences": 8
      }
    ]
  }
}
```

---

### 2. Sincronizare Completă - Actualizare Prețuri

Pentru a actualiza efectiv prețurile în baza de date:

```bash
# Via browser sau Postman
POST http://localhost:3000/api/v1/smartbill/sync-prices?daysBack=90&strategy=latest

# Via curl
curl -X POST \
  'http://localhost:3000/api/v1/smartbill/sync-prices?daysBack=90&strategy=latest' \
  -H 'Authorization: Bearer YOUR_TOKEN' \
  -H 'Content-Type: application/json'
```

**Parametri:**
- `daysBack` (opțional): Câte zile înapoi (default: 90)
- `strategy` (opțional):
  - `latest` - folosește prețul din cea mai recentă factură (default)
  - `average` - calculează media prețurilor din toate facturile

**Răspuns Exemplu:**
```json
{
  "success": true,
  "data": {
    "message": "Price sync completed",
    "totalInvoices": 245,
    "totalProducts": 523,
    "productsUpdated": 487,
    "uniqueProducts": 487,
    "errors": []
  }
}
```

---

## Strategii de Actualizare

### Strategy: `latest` (Recomandat)
- Folosește prețul din **cea mai recentă factură**
- Ideal pentru prețuri care se schimbă frecvent
- Reflectă prețurile actuale

### Strategy: `average`
- Calculează **media** prețurilor din toate facturile
- Util pentru prețuri care variază
- Oferă o valoare stabilizată

---

## Exemple de Utilizare

### Exemplu 1: Preview pentru ultimele 30 zile
```bash
curl -X GET \
  'http://localhost:3000/api/v1/smartbill/preview-prices?daysBack=30' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

### Exemplu 2: Sincronizare cu media prețurilor (ultimele 180 zile)
```bash
curl -X POST \
  'http://localhost:3000/api/v1/smartbill/sync-prices?daysBack=180&strategy=average' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

### Exemplu 3: Sincronizare rapidă (ultimele 14 zile, preț latest)
```bash
curl -X POST \
  'http://localhost:3000/api/v1/smartbill/sync-prices?daysBack=14&strategy=latest' \
  -H 'Authorization: Bearer YOUR_TOKEN'
```

---

## Programare Automată (Opțional)

Pentru a rula sincronizarea automat, adaugă un cronjob:

```bash
# Editează crontab
crontab -e

# Adaugă linia (rulează în fiecare zi la 02:00)
0 2 * * * curl -X POST 'http://localhost:3000/api/v1/smartbill/sync-prices?daysBack=90&strategy=latest' \
  -H 'Authorization: Bearer YOUR_TOKEN' >> /var/log/smartbill-price-sync.log 2>&1
```

Sau folosește un job scheduler în Docker/Kubernetes.

---

## Autentificare

Toate endpoint-urile necesită autentificare și rol de **admin**.

1. Obține token de autentificare prin login
2. Include token-ul în header: `Authorization: Bearer YOUR_TOKEN`

---

## Verificare Rezultate

După sincronizare, verificați în baza de date:

```sql
-- Verifică câte produse au prețuri
SELECT
  COUNT(*) as total_products,
  COUNT(CASE WHEN base_price > 0 THEN 1 END) as products_with_price,
  AVG(base_price) as average_price
FROM products
WHERE is_active = true;

-- Produse actualizate recent
SELECT sku, name, base_price, currency_code, updated_at
FROM products
WHERE base_price > 0 AND currency_code = 'RON'
ORDER BY updated_at DESC
LIMIT 20;
```

---

## Limitări și Considerații

### 1. Rate Limiting
SmartBill API are limitări de rate. Scriptul:
- Procesează maximum **100 facturi** per run (pentru siguranță)
- Adaugă **200ms delay** între apeluri
- Pentru mai multe facturi, rulați de mai multe ori cu date range diferite

### 2. Prețuri Lipsă
Produsele care **NU apar în facturi** nu vor avea prețuri actualizate:
- Produse noi care nu au fost încă vândute
- Produse dezactivate
- Produse cu SKU diferit în facturi vs. inventar

### 3. Conversie Valutară
- Prețurile în alte valute (EUR, USD) sunt **loggate ca warning**
- Trebuie conversie manuală sau integrare cu API de exchange rate

### 4. TVA
- Scriptul calculează automat prețul fără TVA (19%)
- Dacă produsele au rate de TVA diferite, acestea sunt respectate din factură

---

## Troubleshooting

### Eroare: "Service unavailable"
- Verificați că modulul SmartBill este inițializat corect
- Verificați log-urile: `docker logs cypher-erp-app | grep smartbill`

### Puține produse actualizate
- Creșteți `daysBack` pentru a include mai multe facturi
- Verificați că SKU-urile din facturi corespund cu cele din inventar

### Prețuri 0 după sincronizare
- Verificați că facturile conțin prețuri > 0
- Rulați preview pentru a vedea ce prețuri sunt extrase

---

## Suport

Pentru probleme sau întrebări:
1. Verificați log-urile: `docker logs cypher-erp-app`
2. Rulați preview pentru diagnostic
3. Verificați documentația SmartBill API

---

## Changelog

### v1.0.0 (2026-02-12)
- ✅ Implementare inițială
- ✅ Extragere prețuri din facturi
- ✅ Calcul automat preț fără TVA
- ✅ Strategii: latest și average
- ✅ Preview mode
- ✅ Rate limiting protection
