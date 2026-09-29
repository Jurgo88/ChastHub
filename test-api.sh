#!/usr/bin/env bash
# ChastHub V2 API – test script
# Spusti: bash test-api.sh
# Pozadavky: curl, jq

set -euo pipefail

# Farby
GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[1;33m'
BLUE='\033[0;34m'; GRAY='\033[0;90m'; NC='\033[0m'

ok()      { echo -e "${GREEN}  ok $1${NC}"; }
fail()    { echo -e "${RED}  FAIL $1${NC}"; echo -e "${GRAY}    $2${NC}"; }
section() { echo -e "\n${BLUE}> $1${NC}"; }
info()    { echo -e "${GRAY}  $1${NC}"; }

# Konfig
BASE="http://localhost:3000"

if [ -f .env ]; then
  set -a; source <(grep -v '^#' .env | grep '='); set +a
fi
SUPABASE_URL="${NUXT_PUBLIC_SUPABASE_URL:-}"
SERVICE_KEY="${NUXT_SUPABASE_SERVICE_KEY:-}"

if [ -z "$SUPABASE_URL" ] || [ -z "$SERVICE_KEY" ]; then
  echo -e "${YELLOW}SKIP: NUXT_PUBLIC_SUPABASE_URL alebo NUXT_SUPABASE_SERVICE_KEY nie su nastavene – testy preskocene.${NC}"
  exit 0
fi

LOQEE_EMAIL="test-loqee@chasthub.test"
LOQEE_PASS="TestLoqee1"
LOQHOLDER_EMAIL="test-loqholder@chasthub.test"
LOQHOLDER_PASS="TestLoqholder1"

# Pomocne funkcie
req() {
  local method=$1 url=$2 token=${3:-} data=${4:-}
  if [ -n "$data" ]; then
    curl -s -w "\n%{http_code}" -X "$method" "$url" \
      ${token:+-H "Authorization: Bearer $token"} \
      -H "Content-Type: application/json" \
      -d "$data"
  else
    curl -s -w "\n%{http_code}" -X "$method" "$url" \
      ${token:+-H "Authorization: Bearer $token"}
  fi
}

body_of()   { echo "$1" | head -n -1; }
status_of() { echo "$1" | tail -n 1; }

check() {
  local label=$1 resp=$2 expected=$3
  local status; status=$(status_of "$resp")
  local body; body=$(body_of "$resp")
  if [ "$status" = "$expected" ]; then
    ok "$label -> $status"
  else
    fail "$label -> cakal som $expected, dostal som $status" "$body"
  fi
}

echo ""
echo "=============================================="
echo "  ChastHub V2 API - Test Script"
echo "=============================================="

# Clear login rate limits so retries from previous runs don't block us
curl -s -X DELETE \
  "$SUPABASE_URL/rest/v1/rate_limit_buckets?key=like.login%25" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "apikey: $SERVICE_KEY" > /dev/null

# SETUP: Login
section "SETUP - Login"

resp=$(req POST "$BASE/api/auth/login" "" \
  "{\"email\":\"$LOQEE_EMAIL\",\"password\":\"$LOQEE_PASS\"}")
if [ "$(status_of "$resp")" != "200" ]; then
  # Self-healing: previous test run may have changed the password
  info "Login s povodnym heslom zlyhal, skusam fallback (NewSecurePass1!)"
  resp2=$(req POST "$BASE/api/auth/login" "" \
    "{\"email\":\"$LOQEE_EMAIL\",\"password\":\"NewSecurePass1!\"}")
  if [ "$(status_of "$resp2")" = "200" ]; then
    FALLBACK_TOKEN=$(body_of "$resp2" | jq -r '.session.access_token // empty')
    reset=$(req POST "$BASE/api/profile/change-password" "$FALLBACK_TOKEN" \
      "{\"password\":\"$LOQEE_PASS\"}")
    if [ "$(status_of "$reset")" = "200" ]; then
      ok "Heslo obnovene na povodne"
      resp=$(req POST "$BASE/api/auth/login" "" \
        "{\"email\":\"$LOQEE_EMAIL\",\"password\":\"$LOQEE_PASS\"}")
    fi
  fi
fi
check "Loqee login" "$resp" "200"
LOQEE_TOKEN=$(body_of "$resp" | jq -r '.session.access_token // empty')
LOQEE_ID=$(body_of "$resp" | jq -r '.user.id // empty')

resp=$(req POST "$BASE/api/auth/login" "" \
  "{\"email\":\"$LOQHOLDER_EMAIL\",\"password\":\"$LOQHOLDER_PASS\"}")
check "Loqholder login" "$resp" "200"
LOQHOLDER_TOKEN=$(body_of "$resp" | jq -r '.session.access_token // empty')
LOQHOLDER_ID=$(body_of "$resp" | jq -r '.user.id // empty')

if [ -z "$LOQEE_TOKEN" ] || [ -z "$LOQHOLDER_TOKEN" ]; then
  echo -e "${RED}CHYBA: Nepodarilo sa ziskat tokeny. Je server spusteny? (npm run dev)${NC}"
  exit 1
fi

info "Loqee ID:     $LOQEE_ID"
info "Loqholder ID: $LOQHOLDER_ID"

# SETUP: Subscription
section "SETUP - Aktivacia subscription pre loqee"

PATCH_RESP=$(curl -s -w "\n%{http_code}" \
  -X PATCH "$SUPABASE_URL/rest/v1/profiles?id=eq.$LOQEE_ID" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "apikey: $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"subscription_status":"active"}')
if [ "$(status_of "$PATCH_RESP")" = "204" ]; then
  ok "Subscription aktivovana"
else
  fail "Subscription patch" "$(body_of "$PATCH_RESP")"
fi

# CLEANUP: zrus existujuce loqs aby test 1 prebehol cisto
section "CLEANUP - Zrus existujuce loqs"

curl -s -X PATCH \
  "$SUPABASE_URL/rest/v1/loqs?loqee_id=eq.$LOQEE_ID&status=in.(draft,pending,active,paused)" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "apikey: $SERVICE_KEY" \
  -H "Content-Type: application/json" \
  -H "Prefer: return=minimal" \
  -d '{"status":"cancelled","locked":false}' > /dev/null
ok "Stare loqs zrusene"

# Pomocna funkcia: active endpoint vracia [] ked nema aktivny loq
check_no_active() {
  local label=$1 resp=$2
  local s; s=$(status_of "$resp")
  local count; count=$(body_of "$resp" | jq -r 'if type == "array" then length elif . == null then 0 else 1 end' 2>/dev/null || echo "1")
  if [ "$s" = "200" ] && [ "$count" = "0" ]; then
    ok "$label (prazdne pole)"
  elif [ "$s" = "204" ] || { [ "$s" = "200" ] && [ "$(body_of "$resp")" = "null" ]; }; then
    ok "$label (status: $s)"
  else
    fail "$label" "ocakaval prazdne pole, dostal $s count=$count: $(body_of "$resp")"
  fi
}

section "SETUP CHECK - Loqholder nema aktivny loq"

resp=$(req GET "$BASE/api/loqholders/active" "$LOQHOLDER_TOKEN")
check_no_active "Ziadny aktivny loq pred testmi" "$resp"

echo ""
echo "-- TESTY ----------------------------------------"

# TEST 1
section "TEST 1 - Loqee vytori loq"

resp=$(req POST "$BASE/api/loqs" "$LOQEE_TOKEN" \
  '{"duration_minutes":60,"combination_text":"1234","emotion":"pleading","reason":"Test loq"}')
check "Vytvorenie loqu" "$resp" "200"
LOQ_ID=$(body_of "$resp" | jq -r '.id // empty')
LOQ_STATUS=$(body_of "$resp" | jq -r '.status // empty')
info "Loq ID: $LOQ_ID  |  Status: $LOQ_STATUS"

if [ -z "$LOQ_ID" ]; then
  echo -e "${RED}KRITICKA CHYBA: LOQ_ID je prazdny - prerušujem testy${NC}"
  echo -e "${GRAY}$(body_of "$resp")${NC}"
  exit 1
fi

# TEST 1b
section "TEST 1b - GET /api/loqs/current"

resp=$(req GET "$BASE/api/loqs/current" "$LOQEE_TOKEN")
check "Current loq endpoint" "$resp" "200"
CURRENT_ID=$(body_of "$resp" | jq -r '.id // empty')
if [ "$CURRENT_ID" = "$LOQ_ID" ]; then
  ok "ID sa zhoduje"
else
  fail "ID sa nezhoduje" "ocakaval $LOQ_ID, dostal $CURRENT_ID"
fi

# TEST 2
section "TEST 2 - Druhy loq musi vratit 409"

resp=$(req POST "$BASE/api/loqs" "$LOQEE_TOKEN" \
  '{"duration_minutes":30,"combination_text":"9999"}')
check "Druhy loq = 409 Conflict" "$resp" "409"

# TEST 3
section "TEST 3 - Loqee posle request loqholderovi"

resp=$(req POST "$BASE/api/loqs/$LOQ_ID/request" "$LOQEE_TOKEN" \
  "{\"loqholder_ids\":[\"$LOQHOLDER_ID\"]}")
check "Request odoslany" "$resp" "200"

# TEST 4
section "TEST 4 - Loqholder vidi incoming requests"

resp=$(req GET "$BASE/api/loqholders/incoming" "$LOQHOLDER_TOKEN")
check "Incoming requests" "$resp" "200"
COUNT=$(body_of "$resp" | jq -r '.total // 0')
info "Pocet pending requestov: $COUNT"

# TEST 5
section "TEST 5 - Cudzi loqholder = 403 pri accepte"

req POST "$BASE/api/auth/signup" "" \
  '{"email":"other-loqholder@chasthub.test","password":"OtherLH1","role":"loqholder"}' > /dev/null 2>&1 || true
resp=$(req POST "$BASE/api/auth/login" "" \
  '{"email":"other-loqholder@chasthub.test","password":"OtherLH1"}')
OTHER_TOKEN=$(body_of "$resp" | jq -r '.session.access_token // empty')

if [ -n "$OTHER_TOKEN" ]; then
  resp=$(req POST "$BASE/api/loqs/$LOQ_ID/accept" "$OTHER_TOKEN")
  check "Cudzi loqholder = 403" "$resp" "403"
else
  info "Preskocene (cudzí ucet sa nepodarilo vytvorit)"
fi

# TEST 6
section "TEST 6 - Loqholder prijme loq"

resp=$(req POST "$BASE/api/loqs/$LOQ_ID/accept" "$LOQHOLDER_TOKEN")
check "Accept loqu" "$resp" "200"
LOQED_UNTIL=$(body_of "$resp" | jq -r '.loqed_until // empty')
LOCKED=$(body_of "$resp" | jq -r '.locked // empty')
info "loqed_until: $LOQED_UNTIL  |  locked: $LOCKED"

# TEST 6-LH - Loqholder active endpoint
section "TEST 6-LH - GET /api/loqholders/active"

resp=$(req GET "$BASE/api/loqholders/active" "$LOQHOLDER_TOKEN")
check "Active loq pre loqholdera" "$resp" "200"
ACTIVE_ID=$(body_of "$resp" | jq -r '.[0].id // empty')
if [ "$ACTIVE_ID" = "$LOQ_ID" ]; then
  ok "ID sa zhoduje"
else
  fail "ID sa nezhoduje" "ocakaval $LOQ_ID, dostal $ACTIVE_ID"
fi
LOQEE_NAME=$(body_of "$resp" | jq -r '.[0].loqee.display_name // empty')
info "Loqee display_name: '${LOQEE_NAME}'"

# Skontroluj ze accept endpoint tiez vracia loqee profil
resp=$(req POST "$BASE/api/loqs/$LOQ_ID/accept" "$LOQHOLDER_TOKEN" 2>/dev/null || true)
ACCEPT_LOQEE=$(body_of "$resp" | jq -r '.loqee.id // empty' 2>/dev/null || true)
if [ -n "$ACCEPT_LOQEE" ]; then
  ok "Accept endpoint vracia loqee profil"
else
  info "Accept endpoint nevracia loqee profil (double-accept test prebehne nizsie)"
fi

resp=$(req GET "$BASE/api/loqholders/active" "$LOQEE_TOKEN")
check "Loqee nema pristup = 403" "$resp" "403"

# TEST 6a
section "TEST 6a - Loqee posle spravu"

resp=$(req POST "$BASE/api/loqs/$LOQ_ID/messages" "$LOQEE_TOKEN" \
  '{"content":"Ahoj z loqee!"}')
check "Loqee posle spravu" "$resp" "200"
MSG1_ID=$(body_of "$resp" | jq -r '.id // empty')
info "Sprava 1 ID: $MSG1_ID"

# TEST 6b
section "TEST 6b - Loqholder odpovie"

resp=$(req POST "$BASE/api/loqs/$LOQ_ID/messages" "$LOQHOLDER_TOKEN" \
  '{"content":"Ahoj z loqholdera!"}')
check "Loqholder posle spravu" "$resp" "200"
MSG2_ID=$(body_of "$resp" | jq -r '.id // empty')
info "Sprava 2 ID: $MSG2_ID"

# TEST 6c
section "TEST 6c - GET zoznam sprav"

resp=$(req GET "$BASE/api/loqs/$LOQ_ID/messages" "$LOQEE_TOKEN")
check "Nacitanie sprav" "$resp" "200"
MSG_COUNT=$(body_of "$resp" | jq -r '.messages | length')
info "Pocet sprav: $MSG_COUNT"
if [ "$MSG_COUNT" -ge 2 ]; then
  ok "Obe spravy su v zozname"
else
  fail "Ocakaval aspon 2 spravy" "pocet: $MSG_COUNT"
fi

# TEST 6d
section "TEST 6d - Cudzí ucastnik = 403 pri spravach"

if [ -n "$OTHER_TOKEN" ]; then
  resp=$(req POST "$BASE/api/loqs/$LOQ_ID/messages" "$OTHER_TOKEN" \
    '{"content":"Neopravnena sprava"}')
  check "Cudzi user = 403" "$resp" "403"
else
  info "Preskocene (cudzí ucet neexistuje)"
fi

# TEST 7
section "TEST 7 - Dvojity accept = 409"

resp=$(req POST "$BASE/api/loqs/$LOQ_ID/accept" "$LOQHOLDER_TOKEN")
check "Dvojity accept = 409" "$resp" "409"

# TEST 8
section "TEST 8 - GET loq detail"

resp=$(req GET "$BASE/api/loqs/$LOQ_ID" "$LOQEE_TOKEN")
check "Loqee vidi loq detail" "$resp" "200"
info "Status: $(body_of "$resp" | jq -r '.status')"

# TEST 9
section "TEST 9 - Loqholder prida/obre cas"

resp=$(req POST "$BASE/api/loqs/$LOQ_ID/time" "$LOQHOLDER_TOKEN" \
  '{"delta_minutes":30}')
check "Pridaj +30 min" "$resp" "200"
info "Novy loqed_until: $(body_of "$resp" | jq -r '.loqed_until')"

resp=$(req POST "$BASE/api/loqs/$LOQ_ID/time" "$LOQHOLDER_TOKEN" \
  '{"delta_minutes":-15}')
check "Ober -15 min" "$resp" "200"

# TEST 10
section "TEST 10 - Pauza a resume"

resp=$(req POST "$BASE/api/loqs/$LOQ_ID/pause" "$LOQHOLDER_TOKEN")
check "Pauza" "$resp" "200"
info "Status po pauze: $(body_of "$resp" | jq -r '.status')  |  paused_at: $(body_of "$resp" | jq -r '.paused_at')"

resp=$(req POST "$BASE/api/loqs/$LOQ_ID/pause" "$LOQHOLDER_TOKEN")
check "Resume" "$resp" "200"
info "Status po resume: $(body_of "$resp" | jq -r '.status')"

# TEST 11
section "TEST 11 - Loqee zmeni emotion"

resp=$(req POST "$BASE/api/loqs/$LOQ_ID/emotion" "$LOQEE_TOKEN" \
  '{"emotion":"naughty"}')
check "Zmena emotion" "$resp" "200"
info "Nova emotion: $(body_of "$resp" | jq -r '.emotion')"

resp=$(req POST "$BASE/api/loqs/$LOQ_ID/emotion" "$LOQEE_TOKEN" \
  '{"emotion":"INVALID"}')
check "Neplatna emotion = 400" "$resp" "400"

# TEST 12
section "TEST 12 - Visitor link"

resp=$(req POST "$BASE/api/loqs/$LOQ_ID/visitor-link" "$LOQHOLDER_TOKEN")
check "Generovanie visitor linku" "$resp" "200"
LINK_ID=$(body_of "$resp" | jq -r '.public_link_id // empty')
info "public_link_id: $LINK_ID"

resp=$(req POST "$BASE/api/loqs/$LOQ_ID/visitor-link" "$LOQHOLDER_TOKEN")
LINK_ID2=$(body_of "$resp" | jq -r '.public_link_id // empty')
if [ "$LINK_ID" = "$LINK_ID2" ]; then
  ok "Visitor link je idempotentny"
else
  fail "Visitor link nie je idempotentny" "$LINK_ID vs $LINK_ID2"
fi

# TEST 12b
section "TEST 12b - Public loq visitor endpoints"

if [ -n "$LINK_ID" ]; then
  resp=$(req GET "$BASE/api/loq/$LINK_ID")
  check "GET public loq page = 200" "$resp" "200"
  info "status: $(body_of "$resp" | jq -r '.status')  |  loqed_until: $(body_of "$resp" | jq -r '.loqed_until')"

  resp=$(req POST "$BASE/api/loq/$LINK_ID/add-time")
  check "Prvy add-time = 200" "$resp" "200"
  info "Novy loqed_until: $(body_of "$resp" | jq -r '.new_loqed_until')"

  resp=$(req POST "$BASE/api/loq/$LINK_ID/add-time")
  check "Druhy add-time (rate limit) = 429" "$resp" "429"

  resp=$(req GET "$BASE/api/loq/nonexistent-link-id-xyz")
  check "Neznamy public_link_id = 404" "$resp" "404"
else
  info "Preskocene (LINK_ID je prazdny)"
fi

# TEST 13
section "TEST 13 - Ukoncenie loqu"

resp=$(req POST "$BASE/api/loqs/$LOQ_ID/end" "$LOQHOLDER_TOKEN")
check "Ukoncenie loqu" "$resp" "200"
info "Status: $(body_of "$resp" | jq -r '.status')  |  locked: $(body_of "$resp" | jq -r '.locked')"

# TEST 13-LH
section "TEST 13-LH - Active = null po ukonceni loqu"

resp=$(req GET "$BASE/api/loqholders/active" "$LOQHOLDER_TOKEN")
check_no_active "Ziadny aktivny loq po ukonceni" "$resp"

# TEST 13a
section "TEST 13a - Public loq page vrati 410 po ukonceni"

if [ -n "$LINK_ID" ]; then
  resp=$(req GET "$BASE/api/loq/$LINK_ID")
  check "GET public loq po ukonceni = 410" "$resp" "410"
else
  info "Preskocene (LINK_ID je prazdny)"
fi

# TEST 13b
section "TEST 13b - Sprava do ukonceneho loqu = 403"

resp=$(req POST "$BASE/api/loqs/$LOQ_ID/messages" "$LOQEE_TOKEN" \
  '{"content":"Toto nesmie prejst"}')
check "Ukonceny loq = 403" "$resp" "403"

# TEST 13c - Combination reveal
section "TEST 13c - Combination: loqholder vidi, loqee maskована kym locked"

# Loqee vytvori novy loq s kombináciou
resp=$(req POST "$BASE/api/loqs" "$LOQEE_TOKEN" \
  '{"duration_minutes":30,"combination_text":"SECRET-42","emotion":"happy","reason":"combo test"}')
check "Vytvorenie loqu s kombináciou" "$resp" "200"
COMBO_LOQ_ID=$(body_of "$resp" | jq -r '.id // empty')

if [ -z "$COMBO_LOQ_ID" ]; then
  fail "COMBO_LOQ_ID je prazdny - preskakujem test 13c" "$(body_of "$resp")"
else
  # Loqee posle request a loqholder prijme
  req POST "$BASE/api/loqs/$COMBO_LOQ_ID/request" "$LOQEE_TOKEN" \
    "{\"loqholder_ids\":[\"$LOQHOLDER_ID\"]}" > /dev/null

  resp=$(req POST "$BASE/api/loqs/$COMBO_LOQ_ID/accept" "$LOQHOLDER_TOKEN")
  check "Loqholder acceptne combo loq" "$resp" "200"
  COMBO_LOCKED=$(body_of "$resp" | jq -r '.locked')
  info "locked po accepte: $COMBO_LOCKED"

  # Loqholder vidi kombinaciu
  resp=$(req GET "$BASE/api/loqholders/active" "$LOQHOLDER_TOKEN")
  check "Loqholder active endpoint" "$resp" "200"
  LH_COMBO=$(body_of "$resp" | jq -r '.[0].combination_text // empty')
  if [ "$LH_COMBO" = "SECRET-42" ]; then
    ok "Loqholder vidi kombináciu: $LH_COMBO"
  else
    fail "Loqholder nevidí kombináciu" "dostal: '$LH_COMBO'"
  fi

  # Loqee NEVIDI kombinaciu cez /current kym locked=true
  resp=$(req GET "$BASE/api/loqs/current" "$LOQEE_TOKEN")
  check "Loqee /current endpoint" "$resp" "200"
  LOQEE_COMBO=$(body_of "$resp" | jq -r '.combination_text')
  if [ "$LOQEE_COMBO" = "null" ]; then
    ok "Loqee nevidi kombináciu kým locked=true"
  else
    fail "Loqee vidi kombináciu kým locked=true!" "combination_text: '$LOQEE_COMBO'"
  fi

  # Loqholder ukonci loq (locked -> false)
  resp=$(req POST "$BASE/api/loqs/$COMBO_LOQ_ID/end" "$LOQHOLDER_TOKEN")
  check "Ukoncenie combo loqu" "$resp" "200"
  ENDED_LOCKED=$(body_of "$resp" | jq -r '.locked')
  ENDED_COMBO=$(body_of "$resp" | jq -r '.combination_text // empty')
  if [ "$ENDED_LOCKED" = "false" ]; then
    ok "Po ukonceni: locked=false"
  else
    fail "locked nie je false po ukonceni" "locked: $ENDED_LOCKED"
  fi
  if [ "$ENDED_COMBO" = "SECRET-42" ]; then
    ok "End response obsahuje kombináciu (pre odovzdanie loqee)"
  else
    fail "End response neobsahuje kombináciu" "combination_text: '$ENDED_COMBO'"
  fi
fi

# TEST 14
section "TEST 14 - Public queue"

resp=$(req POST "$BASE/api/loqs" "$LOQEE_TOKEN" \
  '{"duration_minutes":120,"combination_text":"PUBLIC","emotion":"happy","reason":"Queue test"}')
check "Vytvorenie loqu pre queue" "$resp" "200"
LOQ2_ID=$(body_of "$resp" | jq -r '.id // empty')

if [ -z "$LOQ2_ID" ]; then
  fail "LOQ2_ID je prazdny - preskakujem zvysok testu 14" "$(body_of "$resp")"
else
  resp=$(req POST "$BASE/api/loqs/$LOQ2_ID/publish" "$LOQEE_TOKEN")
  check "Publikovanie do queue" "$resp" "200"
  info "is_public: $(body_of "$resp" | jq -r '.is_public')"

  resp=$(req GET "$BASE/api/loqs/queue" "$LOQHOLDER_TOKEN")
  check "Loqholder vidi queue" "$resp" "200"
  QUEUE_TOTAL=$(body_of "$resp" | jq -r '.total // 0')
  QUEUE_HAS_LOQ=$(body_of "$resp" | jq -r --arg id "$LOQ2_ID" '[.data[]? | select(.id == $id)] | length')
  info "Pocet loqov v queue: $QUEUE_TOTAL"
  if [ "$QUEUE_HAS_LOQ" -ge 1 ]; then
    ok "Publikovany loq sa objavil v queue"
  else
    fail "Publikovany loq nie je v queue" "total: $QUEUE_TOTAL, data: $(body_of "$resp" | jq -r '.data | length') zaznamov"
  fi

  resp=$(req POST "$BASE/api/loqs/$LOQ2_ID/accept" "$LOQEE_TOKEN")
  check "Loqee nemoze acceptnut z queue = 403" "$resp" "403"

  resp=$(req POST "$BASE/api/loqs/$LOQ2_ID/accept" "$LOQHOLDER_TOKEN")
  check "Accept z public queue" "$resp" "200"

  resp=$(req POST "$BASE/api/loqs/$LOQ2_ID/accept" "$LOQHOLDER_TOKEN")
  check "Double-accept public queue = 409" "$resp" "409"

  resp=$(req GET "$BASE/api/loqs/queue" "$LOQHOLDER_TOKEN")
  check "Queue po accepte" "$resp" "200"
  QUEUE_AFTER=$(body_of "$resp" | jq -r '.total // 0')
  STILL_THERE=$(body_of "$resp" | jq -r --arg id "$LOQ2_ID" '[.data[]? | select(.id == $id)] | length')
  if [ "$STILL_THERE" -eq 0 ]; then
    ok "Acceptnuty loq zmizol z queue"
  else
    fail "Acceptnuty loq stale v queue" "total: $QUEUE_AFTER"
  fi

  resp=$(req POST "$BASE/api/loqs/$LOQ2_ID/end" "$LOQHOLDER_TOKEN")
  check "Cleanup - koniec queue loqu" "$resp" "200"
fi

# TEST 14b - Unpublish
section "TEST 14b - Unpublish loqu"

resp=$(req POST "$BASE/api/loqs" "$LOQEE_TOKEN" \
  '{"duration_minutes":60,"combination_text":"UNPUB","reason":"unpublish test"}')
check "Vytvorenie loqu pre unpublish test" "$resp" "200"
UNPUB_ID=$(body_of "$resp" | jq -r '.id // empty')

if [ -z "$UNPUB_ID" ]; then
  fail "UNPUB_ID je prazdny - preskakujem test 14b" "$(body_of "$resp")"
else
  resp=$(req POST "$BASE/api/loqs/$UNPUB_ID/publish" "$LOQEE_TOKEN")
  check "Publikovanie" "$resp" "200"
  IS_PUB=$(body_of "$resp" | jq -r '.is_public')
  [ "$IS_PUB" = "true" ] && ok "is_public=true po publish" || fail "is_public nie je true" "$IS_PUB"

  resp=$(req POST "$BASE/api/loqs/$UNPUB_ID/unpublish" "$LOQEE_TOKEN")
  check "Unpublish" "$resp" "200"
  IS_PUB2=$(body_of "$resp" | jq -r '.is_public')
  [ "$IS_PUB2" = "false" ] && ok "is_public=false po unpublish" || fail "is_public nie je false" "$IS_PUB2"

  resp=$(req GET "$BASE/api/loqs/queue" "$LOQHOLDER_TOKEN")
  check "Queue po unpublish" "$resp" "200"
  STILL=$(body_of "$resp" | jq -r --arg id "$UNPUB_ID" '[.data[]? | select(.id == $id)] | length')
  [ "$STILL" -eq 0 ] && ok "Unpublikovany loq zmizol z queue" || fail "Unpublikovany loq je stale v queue" ""

  resp=$(req POST "$BASE/api/loqs/$UNPUB_ID/unpublish" "$LOQEE_TOKEN")
  check "Dvojite unpublish = 409" "$resp" "409"

  resp=$(req POST "$BASE/api/loqs/$UNPUB_ID/cancel" "$LOQEE_TOKEN")
  check "Cleanup - cancel unpublish loqu" "$resp" "200"
fi

# TEST 15
section "TEST 15 - Reject flow (loqholder odmietne request)"

resp=$(req POST "$BASE/api/loqs" "$LOQEE_TOKEN" \
  '{"duration_minutes":30,"combination_text":"reject-test","emotion":"anxious"}')
check "Vytvorenie loqu pre reject test" "$resp" "200"
LOQ3_ID=$(body_of "$resp" | jq -r '.id // empty')

if [ -z "$LOQ3_ID" ]; then
  fail "LOQ3_ID je prazdny - preskakujem test 15" "$(body_of "$resp")"
else
  resp=$(req POST "$BASE/api/loqs/$LOQ3_ID/request" "$LOQEE_TOKEN" \
    "{\"loqholder_ids\":[\"$LOQHOLDER_ID\"]}")
  check "Request odoslany loqholderovi" "$resp" "200"

  resp=$(req GET "$BASE/api/loqholders/incoming" "$LOQHOLDER_TOKEN")
  check "Loqholder vidi request v incoming" "$resp" "200"
  PENDING_BEFORE=$(body_of "$resp" | jq -r '.total // 0')
  info "Pocet incoming pred reject: $PENDING_BEFORE"

  resp=$(req POST "$BASE/api/loqs/$LOQ3_ID/reject" "$LOQHOLDER_TOKEN")
  check "Loqholder odmietne request = 200" "$resp" "200"
  info "Request status po reject: $(body_of "$resp" | jq -r '.status')"

  resp=$(req GET "$BASE/api/loqholders/incoming" "$LOQHOLDER_TOKEN")
  check "Incoming po reject" "$resp" "200"
  PENDING_AFTER=$(body_of "$resp" | jq -r '.total // 0')
  if [ "$PENDING_AFTER" -lt "$PENDING_BEFORE" ]; then
    ok "Request zmizol z incoming (${PENDING_BEFORE} -> ${PENDING_AFTER})"
  else
    fail "Request stale v incoming" "pocet: $PENDING_AFTER"
  fi

  resp=$(req GET "$BASE/api/loqs/$LOQ3_ID" "$LOQEE_TOKEN")
  check "Loq stale existuje po reject" "$resp" "200"
  LOQ3_STATUS=$(body_of "$resp" | jq -r '.status')
  if [ "$LOQ3_STATUS" = "pending" ]; then
    ok "Loq zostal pending (iba request odmietnuty, nie loq)"
  else
    fail "Ocakaval pending status" "status: $LOQ3_STATUS"
  fi

  resp=$(req POST "$BASE/api/loqs/$LOQ3_ID/cancel" "$LOQEE_TOKEN")
  check "Cleanup - loqee zrusi loq" "$resp" "200"

  resp=$(req GET "$BASE/api/loqholders/active" "$LOQHOLDER_TOKEN")
  check_no_active "Active = null po reject flow" "$resp"
fi

# ─────────────────────────────────────────────
section "TEST 15: PATCH /api/profile"
# ─────────────────────────────────────────────
if [ -n "${LOQEE_TOKEN:-}" ]; then
  resp=$(req PATCH "$BASE/api/profile" "$LOQEE_TOKEN" '{"display_name":"Test Loqee","bio":"Hello world","leaderboard_opt_out":true}')
  check "Loqee aktualizuje profil = 200" "$resp" "200"
  NEW_NAME=$(body_of "$resp" | jq -r '.display_name // ""')
  if [ "$NEW_NAME" = "Test Loqee" ]; then ok "display_name ulozeny"; else fail "display_name" "got: $NEW_NAME"; fi
  NEW_BIO=$(body_of "$resp" | jq -r '.bio // ""')
  if [ "$NEW_BIO" = "Hello world" ]; then ok "bio ulozeny"; else fail "bio" "got: $NEW_BIO"; fi
  OPT=$(body_of "$resp" | jq -r '.leaderboard_opt_out')
  if [ "$OPT" = "true" ]; then ok "leaderboard_opt_out=true"; else fail "leaderboard_opt_out" "got: $OPT"; fi

  resp=$(req PATCH "$BASE/api/profile" "$LOQEE_TOKEN" '{"avatar_url":"not-https"}')
  check "Avatar URL bez https = 400" "$resp" "400"

  resp=$(req PATCH "$BASE/api/profile" "" '')
  check "Bez tokenu = 401" "$resp" "401"

  resp=$(req PATCH "$BASE/api/profile" "$LOQEE_TOKEN" '{}')
  check "Prazdny body = 400" "$resp" "400"
fi



# ─────────────────────────────────────────────────────────────────────────────
# REALTIME DATA CONSISTENCY TESTS (issue #56)
# WebSocket subscriptions nemozno testovat cez curl, ale mozeme overit ze
# backend data ktore by frontend dostal cez realtime su konzistentne.
# ─────────────────────────────────────────────────────────────────────────────
section "REALTIME - Priprava: vytvor a acceptni loq"

resp=$(req POST "$BASE/api/loqs" "$LOQEE_TOKEN" \
  '{"duration_minutes":30,"combination_text":"rt-test","emotion":"happy","reason":"realtime test"}')
check "Vytvorenie RT loqu" "$resp" "200"
RT_LOQ_ID=$(body_of "$resp" | jq -r '.id // empty')

if [ -n "$RT_LOQ_ID" ]; then
  req POST "$BASE/api/loqs/$RT_LOQ_ID/request" "$LOQEE_TOKEN" \
    "{\"loqholder_ids\":[\"$LOQHOLDER_ID\"]}" > /dev/null

  resp=$(req POST "$BASE/api/loqs/$RT_LOQ_ID/accept" "$LOQHOLDER_TOKEN")
  check "Accept RT loqu" "$resp" "200"
  RT_LOQED_UNTIL=$(body_of "$resp" | jq -r '.loqed_until // empty')
  info "loqed_until po accepte: $RT_LOQED_UNTIL"

  section "REALTIME - loq UPDATE po pause (loqee dashboard by dostal event)"
  resp=$(req POST "$BASE/api/loqs/$RT_LOQ_ID/pause" "$LOQHOLDER_TOKEN")
  check "Pause RT loqu" "$resp" "200"
  RT_STATUS=$(body_of "$resp" | jq -r '.status')
  RT_PAUSED_AT=$(body_of "$resp" | jq -r '.paused_at // empty')
  [ "$RT_STATUS" = "paused" ] && ok "status=paused (realtime payload bol by: status, paused_at)" || fail "status nie je paused" "$RT_STATUS"
  [ -n "$RT_PAUSED_AT" ] && ok "paused_at nastaveny: $RT_PAUSED_AT" || fail "paused_at prazdny" ""

  resp=$(req GET "$BASE/api/loqs/$RT_LOQ_ID" "$LOQEE_TOKEN")
  check "GET loq po pause = 200" "$resp" "200"
  [ "$(body_of "$resp" | jq -r '.status')" = "paused" ] && ok "DB status=paused" || fail "DB status nie je paused" ""

  section "REALTIME - loq UPDATE po resume"
  resp=$(req POST "$BASE/api/loqs/$RT_LOQ_ID/pause" "$LOQHOLDER_TOKEN")
  check "Resume RT loqu" "$resp" "200"
  [ "$(body_of "$resp" | jq -r '.status')" = "active" ] && ok "status=active po resume" || fail "status nie je active" ""
  [ "$(body_of "$resp" | jq -r '.paused_at')" = "null" ] && ok "paused_at vymazany" || fail "paused_at nie je null" ""

  section "REALTIME - loq UPDATE po adjust time"
  resp=$(req POST "$BASE/api/loqs/$RT_LOQ_ID/time" "$LOQHOLDER_TOKEN" '{"delta_minutes":15}')
  check "Adjust +15 min" "$resp" "200"
  NEW_UNTIL=$(body_of "$resp" | jq -r '.loqed_until // empty')
  [ -n "$NEW_UNTIL" ] && ok "loqed_until aktualizovany: $NEW_UNTIL" || fail "loqed_until prazdny" ""

  section "REALTIME - loq_requests UPDATE (loqholder dostane event pri novom requeste)"
  resp2=$(req POST "$BASE/api/loqs" "$LOQEE_TOKEN" \
    '{"duration_minutes":15,"combination_text":"req-rt","reason":"request rt test"}')
  RT2_ID=$(body_of "$resp2" | jq -r '.id // empty' 2>/dev/null || echo "")

  if [ -n "$RT2_ID" ]; then
    resp=$(req POST "$BASE/api/loqs/$RT2_ID/request" "$LOQEE_TOKEN" \
      "{\"loqholder_ids\":[\"$LOQHOLDER_ID\"]}")
    check "Loqee posle request (loqholder realtime trigger)" "$resp" "200"

    resp=$(req GET "$BASE/api/loqholders/incoming" "$LOQHOLDER_TOKEN")
    check "Loqholder vidi request v incoming = 200" "$resp" "200"
    NEW_COUNT=$(body_of "$resp" | jq -r '.total // 0')
    [ "$NEW_COUNT" -ge 1 ] && ok "loq_requests tabulka ma zaznamy (realtime by zobrazil notifikaciu)" || fail "Ziadne incoming requesty" ""

    req POST "$BASE/api/loqs/$RT2_ID/cancel" "$LOQEE_TOKEN" > /dev/null
  fi

  section "REALTIME - loq UPDATE po end (obe dashboardy dostanu event)"
  resp=$(req POST "$BASE/api/loqs/$RT_LOQ_ID/end" "$LOQHOLDER_TOKEN")
  check "End RT loqu" "$resp" "200"
  FINAL_STATUS=$(body_of "$resp" | jq -r '.status')
  FINAL_LOCKED=$(body_of "$resp" | jq -r '.locked')
  [ "$FINAL_STATUS" = "ended" ] && ok "status=ended" || fail "status nie je ended" "$FINAL_STATUS"
  [ "$FINAL_LOCKED" = "false" ] && ok "locked=false" || fail "locked nie je false" "$FINAL_LOCKED"

  resp=$(req GET "$BASE/api/loqs/$RT_LOQ_ID" "$LOQEE_TOKEN")
  check "GET loq po end = 200" "$resp" "200"
  [ "$(body_of "$resp" | jq -r '.status')" = "ended" ] && ok "DB status=ended (konzistentne)" || fail "DB status nie je ended" ""
else
  info "REALTIME testy preskocene – RT_LOQ_ID je prazdny"
fi

# ─────────────────────────────────────────────────────────────────────────────
# SERVER-SIDE LOQ EXPIRY TESTS (#54)
# Loqs whose loqed_until is in the past must be auto-expired on the next GET
# ─────────────────────────────────────────────────────────────────────────────

PAST="2000-01-01T00:00:00.000Z"

# Helper: create loq, send request, accept it → returns loq id in EXPIRY_ID
make_active_loq() {
  local combo=$1
  local resp
  resp=$(req POST "$BASE/api/loqs" "$LOQEE_TOKEN" \
    "{\"duration_minutes\":30,\"combination_text\":\"$combo\",\"emotion\":\"happy\",\"reason\":\"expiry test\"}")
  local id; id=$(body_of "$resp" | jq -r '.id // empty')
  if [ -z "$id" ]; then echo ""; return; fi
  req POST "$BASE/api/loqs/$id/request" "$LOQEE_TOKEN" \
    "{\"loqholder_ids\":[\"$LOQHOLDER_ID\"]}" > /dev/null
  req POST "$BASE/api/loqs/$id/accept" "$LOQHOLDER_TOKEN" > /dev/null
  echo "$id"
}

cleanup_expiry_loq() {
  local id=$1
  [ -z "$id" ] && return
  curl -s -X PATCH \
    "$SUPABASE_URL/rest/v1/loqs?id=eq.$id&status=in.(draft,pending,active,paused)" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "apikey: $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d '{"status":"cancelled","locked":false}' > /dev/null
}

section "TEST 17a - Auto-expiry: active loq past loqed_until -> /current returns null"

EXPIRY_LOQ_ID=$(make_active_loq "EXP-1")
if [ -z "$EXPIRY_LOQ_ID" ]; then
  fail "Nepodarilo sa vytvorit expiry loq" ""
else
  check "Loq je aktivny pred expirou" \
    "$(req GET "$BASE/api/loqs/current" "$LOQEE_TOKEN")" "200"

  # Backdate loqed_until to the past
  curl -s -X PATCH \
    "$SUPABASE_URL/rest/v1/loqs?id=eq.$EXPIRY_LOQ_ID" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "apikey: $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "{\"loqed_until\":\"$PAST\"}" > /dev/null

  resp=$(req GET "$BASE/api/loqs/current" "$LOQEE_TOKEN")
  check_no_active "current vracia volny stav po auto-expiry" "$resp"

  DB=$(curl -s "$SUPABASE_URL/rest/v1/loqs?id=eq.$EXPIRY_LOQ_ID&select=status,locked" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "apikey: $SERVICE_KEY")
  DB_STATUS=$(echo "$DB" | jq -r '.[0].status // empty')
  DB_LOCKED=$(echo "$DB" | jq -r '.[0].locked')
  [ "$DB_STATUS" = "ended" ] && ok "DB status=ended po auto-expiry" \
    || fail "DB status nie je ended" "dostal: $DB_STATUS"
  [ "$DB_LOCKED" = "false" ] && ok "DB locked=false po auto-expiry" \
    || fail "DB locked nie je false" "dostal: $DB_LOCKED"
fi

section "TEST 17b - Auto-expiry: GET /api/loqs/:id returns 410 for expired loq"

EXPIRY2_LOQ_ID=$(make_active_loq "EXP-2")
if [ -z "$EXPIRY2_LOQ_ID" ]; then
  fail "Nepodarilo sa vytvorit expiry2 loq" ""
else
  curl -s -X PATCH \
    "$SUPABASE_URL/rest/v1/loqs?id=eq.$EXPIRY2_LOQ_ID" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "apikey: $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "{\"loqed_until\":\"$PAST\"}" > /dev/null

  resp=$(req GET "$BASE/api/loqs/$EXPIRY2_LOQ_ID" "$LOQEE_TOKEN")
  check "GET by id po vyprsani = 410" "$resp" "410"
  # Cleanup: the loq was auto-ended by the GET, nothing to cancel
fi

section "TEST 17c - Auto-expiry: paused loq with time expired while paused"

EXPIRY3_LOQ_ID=$(make_active_loq "EXP-3")
if [ -z "$EXPIRY3_LOQ_ID" ]; then
  fail "Nepodarilo sa vytvorit expiry3 loq" ""
else
  resp=$(req POST "$BASE/api/loqs/$EXPIRY3_LOQ_ID/pause" "$LOQHOLDER_TOKEN")
  check "Pauza loqu" "$resp" "200"

  # Backdate loqed_until to before paused_at so remaining <= 0
  curl -s -X PATCH \
    "$SUPABASE_URL/rest/v1/loqs?id=eq.$EXPIRY3_LOQ_ID" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "apikey: $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d "{\"loqed_until\":\"$PAST\"}" > /dev/null

  resp=$(req GET "$BASE/api/loqs/current" "$LOQEE_TOKEN")
  check_no_active "current vracia volny stav po paused auto-expiry" "$resp"

  DB_STATUS=$(curl -s "$SUPABASE_URL/rest/v1/loqs?id=eq.$EXPIRY3_LOQ_ID&select=status" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "apikey: $SERVICE_KEY" | jq -r '.[0].status // empty')
  [ "$DB_STATUS" = "ended" ] && ok "DB status=ended po paused auto-expiry" \
    || fail "DB status nie je ended pre paused" "dostal: $DB_STATUS"
fi


# ─────────────────────────────────────────────────────────────────────────────
# ADMIN BAN TESTS (#55)
# Banning a user must terminate all their V2 loqs and cancel pending requests
# ─────────────────────────────────────────────────────────────────────────────

ADMIN_EMAIL="test-admin@chasthub.test"
ADMIN_PASS="TestAdmin1"

section "SETUP - Admin test ucet"

ADMIN_ID=$(curl -s \
  "$SUPABASE_URL/rest/v1/profiles?email=eq.$ADMIN_EMAIL&select=id" \
  -H "Authorization: Bearer $SERVICE_KEY" \
  -H "apikey: $SERVICE_KEY" | jq -r '.[0].id // empty')

if [ -z "$ADMIN_ID" ]; then
  ADMIN_CREATE=$(curl -s \
    -X POST "$SUPABASE_URL/auth/v1/admin/users" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "apikey: $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -d "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\",\"email_confirm\":true}")
  ADMIN_ID=$(echo "$ADMIN_CREATE" | jq -r '.id // empty')
  if [ -n "$ADMIN_ID" ]; then
    curl -s -X POST "$SUPABASE_URL/rest/v1/profiles" \
      -H "Authorization: Bearer $SERVICE_KEY" \
      -H "apikey: $SERVICE_KEY" \
      -H "Content-Type: application/json" \
      -H "Prefer: return=minimal" \
      -d "{\"id\":\"$ADMIN_ID\",\"email\":\"$ADMIN_EMAIL\",\"role\":\"admin\",\"status\":\"active\"}" > /dev/null
  fi
fi

# Ensure role=admin and status=active
if [ -n "$ADMIN_ID" ]; then
  curl -s -X PATCH "$SUPABASE_URL/rest/v1/profiles?id=eq.$ADMIN_ID" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "apikey: $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d '{"role":"admin","status":"active"}' > /dev/null
fi

resp=$(req POST "$BASE/api/auth/login" "" \
  "{\"email\":\"$ADMIN_EMAIL\",\"password\":\"$ADMIN_PASS\"}")
check "Admin login" "$resp" "200"
ADMIN_TOKEN=$(body_of "$resp" | jq -r '.session.access_token // empty')

if [ -z "$ADMIN_TOKEN" ]; then
  fail "Admin token nedostupny - preskakujem ban testy" ""
else

section "TEST 18a - Ban loqee -> ich aktivny loq je ukonceny"

BAN_LOQ_ID=$(make_active_loq "BAN-1")
if [ -z "$BAN_LOQ_ID" ]; then
  fail "Nepodarilo sa vytvorit loq pre ban test" ""
else
  resp=$(req POST "$BASE/api/admin/users/$LOQEE_ID/ban" "$ADMIN_TOKEN" \
    '{"reason":"test ban"}')
  check "Ban loqee = 200" "$resp" "200"

  BAN_STATUS=$(curl -s \
    "$SUPABASE_URL/rest/v1/loqs?id=eq.$BAN_LOQ_ID&select=status,locked" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "apikey: $SERVICE_KEY" | jq -r '.[0].status // empty')
  [ "$BAN_STATUS" = "ended" ] && ok "Loq ukonceny po bane loqee" \
    || fail "Loq nebol ukonceny" "dostal: $BAN_STATUS"

  BAN_LOCKED=$(curl -s \
    "$SUPABASE_URL/rest/v1/loqs?id=eq.$BAN_LOQ_ID&select=locked" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "apikey: $SERVICE_KEY" | jq -r '.[0].locked')
  [ "$BAN_LOCKED" = "false" ] && ok "Loq locked=false po bane" \
    || fail "Loq locked nie je false" "dostal: $BAN_LOCKED"

  curl -s -X PATCH "$SUPABASE_URL/rest/v1/profiles?id=eq.$LOQEE_ID" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "apikey: $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d '{"status":"active"}' > /dev/null
  ok "Loqee status obnoveny"

  resp=$(req POST "$BASE/api/auth/login" "" \
    "{\"email\":\"$LOQEE_EMAIL\",\"password\":\"$LOQEE_PASS\"}")
  LOQEE_TOKEN=$(body_of "$resp" | jq -r '.session.access_token // empty')
fi

section "TEST 18b - Ban loqholder -> ich aktivny loq je ukonceny"

BAN2_LOQ_ID=$(make_active_loq "BAN-2")
if [ -z "$BAN2_LOQ_ID" ]; then
  fail "Nepodarilo sa vytvorit loq pre ban loqholder test" ""
else
  resp=$(req POST "$BASE/api/admin/users/$LOQHOLDER_ID/ban" "$ADMIN_TOKEN" \
    '{"reason":"test ban loqholder"}')
  check "Ban loqholder = 200" "$resp" "200"

  BAN2_STATUS=$(curl -s \
    "$SUPABASE_URL/rest/v1/loqs?id=eq.$BAN2_LOQ_ID&select=status" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "apikey: $SERVICE_KEY" | jq -r '.[0].status // empty')
  [ "$BAN2_STATUS" = "ended" ] && ok "Loq ukonceny po bane loqholdera" \
    || fail "Loq nebol ukonceny" "dostal: $BAN2_STATUS"

  curl -s -X PATCH "$SUPABASE_URL/rest/v1/profiles?id=eq.$LOQHOLDER_ID" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "apikey: $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d '{"status":"active"}' > /dev/null
  ok "Loqholder status obnoveny"

  resp=$(req POST "$BASE/api/auth/login" "" \
    "{\"email\":\"$LOQHOLDER_EMAIL\",\"password\":\"$LOQHOLDER_PASS\"}")
  LOQHOLDER_TOKEN=$(body_of "$resp" | jq -r '.session.access_token // empty')
fi

section "TEST 18c - Ban loqholder -> pending loq_request je zruseny"

resp=$(req POST "$BASE/api/loqs" "$LOQEE_TOKEN" \
  '{"duration_minutes":30,"combination_text":"BAN-3","emotion":"happy","reason":"ban request test"}')
check "Vytvorenie loqu pre ban request test" "$resp" "200"
BAN3_LOQ_ID=$(body_of "$resp" | jq -r '.id // empty')

if [ -z "$BAN3_LOQ_ID" ]; then
  fail "BAN3_LOQ_ID prazdny" ""
else
  resp=$(req POST "$BASE/api/loqs/$BAN3_LOQ_ID/request" "$LOQEE_TOKEN" \
    "{\"loqholder_ids\":[\"$LOQHOLDER_ID\"]}")
  check "Request odoslany loqholderovi" "$resp" "200"
  REQ_ID=$(body_of "$resp" | jq -r '.requests[0].id // empty')

  resp=$(req POST "$BASE/api/admin/users/$LOQHOLDER_ID/ban" "$ADMIN_TOKEN" \
    '{"reason":"test ban for request"}')
  check "Ban loqholder = 200" "$resp" "200"

  if [ -n "$REQ_ID" ]; then
    REQ_STATUS=$(curl -s \
      "$SUPABASE_URL/rest/v1/loq_requests?id=eq.$REQ_ID&select=status" \
      -H "Authorization: Bearer $SERVICE_KEY" \
      -H "apikey: $SERVICE_KEY" | jq -r '.[0].status // empty')
    [ "$REQ_STATUS" = "cancelled" ] && ok "loq_request zruseny po bane loqholdera" \
      || fail "loq_request nebol zruseny" "dostal: $REQ_STATUS"
  fi

  curl -s -X PATCH "$SUPABASE_URL/rest/v1/profiles?id=eq.$LOQHOLDER_ID" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "apikey: $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d '{"status":"active"}' > /dev/null
  curl -s -X PATCH "$SUPABASE_URL/rest/v1/loqs?id=eq.$BAN3_LOQ_ID" \
    -H "Authorization: Bearer $SERVICE_KEY" \
    -H "apikey: $SERVICE_KEY" \
    -H "Content-Type: application/json" \
    -H "Prefer: return=minimal" \
    -d '{"status":"cancelled"}' > /dev/null
  ok "Loqholder obnoveny, loq zruseny"

  resp=$(req POST "$BASE/api/auth/login" "" \
    "{\"email\":\"$LOQHOLDER_EMAIL\",\"password\":\"$LOQHOLDER_PASS\"}")
  LOQHOLDER_TOKEN=$(body_of "$resp" | jq -r '.session.access_token // empty')
fi

fi # end: ADMIN_TOKEN guard

echo ""
echo "=============================================="
echo "  Testy dokoncene!"
echo "=============================================="
echo ""
