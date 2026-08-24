# План и пътна карта — bagabuch

Счетоводна програма за българския пазар, по образец на референтната програма в `secret/`
(baraba-diox/su-doxis): фактури, контрагенти, сметкоплан, счетоводни записи, ДДС (ППДДС),
ДМА, банкови извлечения, SAF-T BG експорт, OCR на документи.

## Архитектурни правила (фиксирани)

1. **Приложенията остават универсални.** fmrbaga, boilaDB и др. НЕ се копират, вграждат
   или свързват вътре в bagabuch. Използват се както са, без промени по тях.
2. **Комуникация само по стандартен начин през портове:**
   - backend ⇄ frontend: HTTP/JSON (fmrbaga) и/или WebSocket (wsbaga)
   - backend ⇄ база данни: PostgreSQL v3 wire към boilaDB (реален psql/libpq протокол)
   - boilaDB админ/SQL: неговия HTTP порт
   Никакви специални мостове, embedding или shared memory.
3. **Build зависимости** — чрез path deps в baga монорепото (`-I app-product`, sandak.toml),
   както самите fmrbaga/boilaDB ползват std/httpdbaga/jwtbaga/ormbaga. Това е време на
   компилация, а не runtime мост.
4. `secret/` никога не се комитва (gitignored) — референцията е само за образец.

## Стек

| Слой | Технология |
|------|-----------|
| Backend | Baga + fmrbaga framework — HTTP/JSON API, route-id dispatch, OpenAPI, JWT |
| База данни | boilaDB (BoilaSQL) — отделен процес, PostgreSQL v3 wire порт |
| Frontend | Next.js (React) — комуникация с backend по HTTP/WS |
| Експорти | SAF-T BG XML (XSD V1.0.1), XLSX отчети |
| Автентикация | JWT (jwtbaga) |

## Структура на репото

```
bagabuch/
├── backend/            # Baga приложение на fmrbaga (бизнес кодът е тук)
│   ├── sandak.toml     # path deps → app-product/fmrbaga, ormbaga, std
│   ├── start.baga      # migrate → fmr_run
│   ├── routes.baga     # route table + dispatch
│   ├── schema.baga     # миграции (собственост на bagabuch)
│   ├── actions/        # handlers по модул
│   └── models/         # table helpers
├── frontend/           # Next.js
├── docs/               # домейн модел, схеми, ръководства
├── scripts/            # dev/run скриптове (портове, env)
├── PLAN.md
├── sstart.md
└── secret/             # (gitignored) референтната програма
```

## Домейн модули (по референцията)

| Модул | Съдържание |
|-------|-----------|
| Auth | Login, потребители, роли и права |
| Фирми | Реквизити: ЕИК, ДДС номер, адрес, банкови данни |
| Сметкоплан | Сметки с SAF-T mapping и аналитичен тип (контрагент/продукт) |
| Контрагенти | Клиенти и доставчици (ЕИК, ДДС номер, адрес) |
| Фактури | Входящи/изходящи, редове, ДДС ставки, валути |
| Счетоводни записи | Дневник с дебит/кредит редове, ДДС операции |
| ДДС | Ддневници покупки/продажби, ППДДС клетки 01–82 |
| ДМА | Категории, амортизации, движения |
| Банки | Сметки (IBAN/BIC), извлечения: OBB, Postbank, Unicredit, Revolut, Wise, Paysera |
| SAF-T BG | Номенклатури, кореспонденции, годишен/месечен/on-demand експорт |
| Импорт | Controlisy-style XML, OCR на сканирани документи |
| Спомагателни | Начални салда, периоди, валути, продукти, настройки |

## Данни — правила за BoilaSQL

- `PRIMARY KEY` е задължителен и явен; **без** SERIAL / DEFAULT / NOT NULL / REFERENCES
  (ограниченията се пазят в приложението, не в базата).
- Идентификатори: `BIGINT`, генерирани от приложението (време-базиран пореден номер),
  не от базата.
- Суми: `NUMERIC(18,2)`; валутни курсове `NUMERIC(18,6)`; количества `NUMERIC(18,4)`;
  ДДС ставки `NUMERIC(5,2)`.
- Дати: `TEXT` във формат `YYYY-MM-DD` (счетоводен месец `YYYY-MM-01`); `TIMESTAMPTZ`
  само за created_at.
- Миграциите са напред-само; качена миграция не се променя.

## Модел на данните (Фаза 1)

| Таблица | Колони (основни) | Индекси |
|---------|------------------|---------|
| `companies` | id, name, eik, vat_number, address, city, mol, iban, bic, created_at | eik |
| `accounts` | id, number, name, saft_account_type, analytic_type (none/counterpart/product), parent_id, created_at | number |
| `counterparts` | id, name, eik, vat_number, address, city, country, is_client, is_supplier, created_at | eik |
| `products` | id, name, code, unit, price, vat_rate, is_service, created_at | code |
| `invoices` | id, direction (in/out), number, issue_date, accounting_month, counterpart_id, currency, currency_rate, net_amount, vat_amount, total_amount, status, created_at | counterpart_id, accounting_month |
| `invoice_lines` | id, invoice_id, product_id, description, quantity, unit_price, net_amount, vat_rate, vat_amount, total_amount | invoice_id |
| `journal_entries` | id, entry_date, document_type, document_id, description, created_at | entry_date |
| `journal_lines` | id, entry_id, account_id, direction (debit/credit), amount, counterpart_id, product_id | entry_id, account_id |
| `vat_return_lines` | id, period (YYYY-MM-01), cell_no (01–82), amount | period |
| `fixed_assets` | id, name, category, acquisition_date, cost, salvage_value, useful_life_months, created_at | — |
| `bank_accounts` | id, iban, bic, bank_name, currency, created_at | iban |
| `bank_transactions` | id, bank_account_id, txn_date, amount, currency, counterpart_name, counterpart_iban, description, reference, created_at | bank_account_id, txn_date |
| `users` | id, email, name, password_hash, role, created_at | email |
| `settings` | id, key, value | key |

## API повърхност (Фаза 2)

Всичко под `/v1/...`, JSON; OpenAPI се ражда от route table-а на fmrbaga.

| Група | Пътища |
|-------|--------|
| system | `GET /health` `/ready` `/readyz` `/v1/meta` `/openapi.json` `/metrics` |
| auth | `POST /v1/auth/token`, `GET /v1/me` |
| firms | `GET/POST /v1/companies`, `GET/PATCH/DELETE /v1/companies/{id}` |
| accounts | същия CRUD за `/v1/accounts` |
| counterparts | `/v1/counterparts` |
| products | `/v1/products` |
| invoices | `/v1/invoices` (+ `/v1/invoices/{id}/lines`, `POST /v1/invoices/{id}/post` — пуска контировките) |
| journal | `GET /v1/journal` (филтри: период, сметка, контрагент) |
| vat | `GET /v1/vat/registers?period=`, `GET /v1/vat/return?period=` (клетки 01–82) |
| saft | `GET /v1/saft/export?period=&mode=annual|monthly|ondemand` → XML |
| banks | `/v1/bank-accounts`, `/v1/bank-transactions`, `POST /v1/bank-import` |
| fixed assets | `/v1/fixed-assets` |

## Пътна карта

### Фаза 0 — Репо и скелет ✓ (bcf2118, 01d7cba)
- git init -b main, remote, .gitignore (secret/ изключен), push
- backend: fmrbaga скелет (health/ready/meta/openapi/metrics), празна схема
- frontend: Next.js скелет
- `scripts/dev.sh`: boilaDB :6575 + backend :8080 + frontend :3000
- Проверено: /health, /ready (database up), /v1/meta, frontend 200

### Фаза 1 — Схема на данните (boilaDB) ✓
- Таблиците от модела по-горе като миграции в `backend/schema.baga`
  (dual set: BoilaSQL + Postgres, auto избор по `ORM_BACKEND` — конвенцията на apps/api)
- Проверено: второ стартиране → `migrate applied=0` (30-те миграции са приложени
  от първото; всяка в транзакция, история в `baga_schema_migrations`), `/ready` ok

### Фаза 2 — Backend API (fmrbaga)
- Модул по модул: auth, companies, accounts, counterparts, products, invoices, journal
- CRUD + валидация (jsonx), JWT, OpenAPI от route table
- `POST /v1/invoices/{id}/post` генерира счетоводни записи по кореспонденции
- Приемане: всеки модул с интеграционен тест през истински порт (не през мост)
- Готово: **auth** (token/me) + **companies** (CRUD, числов ЕИК в TEXT, multi-column
  UPDATE) — интеграционен тест през :8080 минава изцяло
- По пътя са фиксирани два универсални bug-а (не bagabuch-специфични):
  - boilaDB `8f68e3b`: unknown-literal коерция str↔i64/num (числови низове в TEXT колони)
  - ormbaga `a2e68b0`: multi-column UPDATE — `sql_update_eq/_p` презаписваха SET списъка

### Фаза 3 — Frontend (Next.js)
- Страници по модул: login, dashboard, фирми, сметкоплан, контрагенти, фактури, дневник
- Таблици, форми, пагинация — през HTTP/JSON API-то
- Приемане: `npm run build` + ръчна обиколка на модулите

### Фаза 4 — ДДС и SAF-T
- ДДС дневници (покупки/продажби) автоматично от фактурите
- ППДДС клетки 01–82 по стандарта на НАП
- SAF-T BG експорт по BG_SAFT_Schema V1.0.1 (годишен, месечен, on-demand);
  валидиране срещу XSD-то от референцията (локално, в secret/)
- Приемане: експортът минава валидация на схемата; сумите съвпадат с дневниците

### Фаза 5 — Импорти
- Банкови извлечения (CSV/XML по банка: OBB, Postbank, Unicredit, Revolut, Wise, Paysera)
  → `bank_transactions`
- Controlisy-style XML импорт на контрагенти, документи, контировки
- OCR на фактури → чернови на входящи документи
- Приемане: реални файлове от `secret/CONT-FILE` се импортират без загуба

### Фаза 6 — Завършване
- Отчети (XLSX), начални салда, отваряне/затваряне на периоди, ДМА амортизации
- Тестове (backend + frontend), документация в docs/

## Портове (конвенция)

| Услуга | Порт | Протокол |
|--------|------|----------|
| boilaDB | 6575 | PostgreSQL v3 wire (`serve_pg`) |
| backend API | 8080 | HTTP/JSON |
| frontend dev | 3000 | HTTP |

Портовете се задават само чрез env променливи (`.env`, не се комитва) — нищо не се хардкодва.

## Команди

```bash
# цял стек (boilaDB + backend + frontend)
./scripts/dev.sh

# само backend (компилиране)
PATH=/home/ziko/z-git/baga:$PATH /home/ziko/z-git/baga/sandak build   # в backend/

# проверки
curl -s localhost:8080/health
curl -s localhost:8080/ready
curl -s localhost:8080/v1/meta
```

## Правила на работа

- `secret/` никога не влиза в git; референцията се ползва само за образец на поведение/форми
- Всеки модул: тестове преди качване; проверка през истински портове, не през мостове
- Домейн термини и имена на модулите — на български според референцията
- Качените миграции не се променят — само нови миграции напред
