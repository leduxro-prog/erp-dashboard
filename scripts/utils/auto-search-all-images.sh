#!/bin/bash

# Script pentru căutare automată imagini pentru toate produsele
# Procesează câte 50 produse pe rând până termină lista

set -e

API_URL="http://localhost:3000/api/v1"
BATCH_SIZE=50
DELAY_BETWEEN_BATCHES=10  # secunde de așteptare între batch-uri

echo "=================================="
echo "Auto-Search Product Images Script"
echo "=================================="
echo ""

# Login și obținere token
echo "🔐 Logging in..."
LOGIN_RESPONSE=$(curl -s -X POST "${API_URL}/users/login" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "admin@ledux.ro",
    "password": "admin123"
  }')

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*' | sed 's/"token":"//')

if [ -z "$TOKEN" ]; then
  echo "❌ Login failed! Check credentials."
  exit 1
fi

echo "✅ Logged in successfully"
echo ""

# Verificare câte produse nu au imagini
echo "📊 Checking products without images..."
PRODUCTS_COUNT=$(docker compose exec -T db psql -U cypher_user -d cypher_erp -t -c "
  SELECT COUNT(*)
  FROM products p
  LEFT JOIN product_images pi ON pi.product_id = p.id AND pi.is_primary = true
  WHERE p.is_active = true AND pi.id IS NULL
" | tr -d ' ')

echo "📦 Found $PRODUCTS_COUNT products without images"
echo ""

if [ "$PRODUCTS_COUNT" -eq 0 ]; then
  echo "✨ All products already have images!"
  exit 0
fi

# Calculare număr de batch-uri
TOTAL_BATCHES=$(( ($PRODUCTS_COUNT + $BATCH_SIZE - 1) / $BATCH_SIZE ))
echo "🔄 Will process in $TOTAL_BATCHES batches of $BATCH_SIZE products each"
echo ""

# Inițializare statistici
TOTAL_IMPORTED=0
TOTAL_NOT_FOUND=0
TOTAL_SEARCHED=0

# Procesare batch-uri
for ((batch=1; batch<=TOTAL_BATCHES; batch++)); do
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "📦 Processing batch $batch/$TOTAL_BATCHES"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"

  # Apel API pentru căutare automată
  RESPONSE=$(curl -s -X POST "${API_URL}/inventory/products/images/auto-search?limit=${BATCH_SIZE}&skipExisting=true" \
    -H "Authorization: Bearer ${TOKEN}")

  # Extragere rezultate
  SEARCHED=$(echo $RESPONSE | grep -o '"searched":[0-9]*' | grep -o '[0-9]*' || echo "0")
  IMPORTED=$(echo $RESPONSE | grep -o '"imported":[0-9]*' | grep -o '[0-9]*' || echo "0")
  NOT_FOUND=$(echo $RESPONSE | grep -o '"notFound":[0-9]*' | grep -o '[0-9]*' || echo "0")

  # Actualizare statistici
  TOTAL_SEARCHED=$((TOTAL_SEARCHED + SEARCHED))
  TOTAL_IMPORTED=$((TOTAL_IMPORTED + IMPORTED))
  TOTAL_NOT_FOUND=$((TOTAL_NOT_FOUND + NOT_FOUND))

  echo "  🔍 Searched: $SEARCHED products"
  echo "  ✅ Imported: $IMPORTED images"
  echo "  ❌ Not found: $NOT_FOUND images"
  echo ""

  # Verificare dacă mai sunt produse de procesat
  if [ "$SEARCHED" -eq 0 ]; then
    echo "✨ No more products to process!"
    break
  fi

  # Afișare progres total
  PROGRESS=$(( (batch * 100) / TOTAL_BATCHES ))
  echo "📈 Overall Progress: $PROGRESS% ($TOTAL_IMPORTED imported, $TOTAL_NOT_FOUND not found)"
  echo ""

  # Așteptare între batch-uri (doar dacă nu e ultimul)
  if [ $batch -lt $TOTAL_BATCHES ]; then
    echo "⏳ Waiting ${DELAY_BETWEEN_BATCHES}s before next batch (to respect rate limits)..."
    sleep $DELAY_BETWEEN_BATCHES
    echo ""
  fi
done

echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo "🎉 COMPLETE!"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "📊 Final Statistics:"
echo "  🔍 Total searched: $TOTAL_SEARCHED products"
echo "  ✅ Total imported: $TOTAL_IMPORTED images"
echo "  ❌ Total not found: $TOTAL_NOT_FOUND images"
echo "  📈 Success rate: $(( TOTAL_SEARCHED > 0 ? (TOTAL_IMPORTED * 100) / TOTAL_SEARCHED : 0 ))%"
echo ""
echo "✨ All done! Check your inventory page to see the results."
