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
├── backend/            # Baga приложение на fmrbaga (бизнес код в apps/*)
│   ├── sandak.toml     # path deps → app-product/fmrbaga, jwtbaga и т.н.
│   └── apps/           # модулите на счетоводството
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
| ДДС | Дневници покупки/продажби, ППДДС клетки 01–82 |
| ДМА | Категории, амортизации, движения |
| Банки | Сметки (IBAN/BIC), извлечения: OBB, Postbank, Unicredit, Revolut, Wise, Paysera |
| SAF-T BG | Номенклатури, кореспонденции, годишен/месечен/on-demand експорт |
| Импорт | Controlisy-style XML, OCR на сканирани документи |
| Спомагателни | Начални салда, периоди, валути, продукти, настройки |

## Пътна карта

### Фаза 0 — Репо и скелет
- `git init -b main`, remote `git@github.com:bagalang/bagabuch.git`, `.gitignore` (secret/ изключен), първи push
- backend: празно fmrbaga приложение с универсалния скелет (health/ready/meta)
- frontend: `create-next-app` скелет
- `scripts/dev.sh`: стартира boilaDB + backend + frontend на фиксирани портове (env-configurable)

### Фаза 1 — Схема на данните (boilaDB)
- Таблици: companies, accounts, counterparts, products, invoices + invoice_lines,
  journal_entries, vat_returns, fixed_assets, bank_accounts, bank_transactions, settings
- Миграции + seed: типов сметкоплан, ДДС номенклатури, SAF-T списъци

### Фаза 2 — Backend API (fmrbaga)
- Модул по модул: auth, companies, accounts, counterparts, products, invoices, journal
- CRUD + валидация (jsonx), JWT, OpenAPI от route table
- Правила: счетоводни записи се генерират от фактури (SAF-T кореспонденции)

### Фаза 3 — Frontend (Next.js)
- Страници по модул: login, dashboard, фирми, сметкоплан, контрагенти, фактури, дневник
- Таблици, форми, пагинация — през HTTP/JSON API-то

### Фаза 4 — ДДС и SAF-T
- ДДС дневници (покупки/продажби) автоматично от фактурите
- ППДДС клетки 01–82 по стандарта на НАП
- SAF-T BG експорт по BG_SAFT_Schema V1.0.1 (годишен, месечен, on-demand)

### Фаза 5 — Импорти
- Банкови извлечения (CSV/XML по банка) → банкови транзакции
- Controlisy-style XML импорт на контрагенти, документи, контировки
- OCR на фактури → чернови на входящи документи

### Фаза 6 — Завършване
- Отчети (XLSX/PDF), начални салда, отваряне/затваряне на периоди, ДМА амортизации
- Тестове (backend + frontend), Docker/инсталация, документация в docs/

## Портове (конвенция)

| Услуга | Порт | Протокол |
|--------|------|----------|
| boilaDB | 5432 | PostgreSQL v3 wire (+ негов HTTP админ порт) |
| backend API | 8080 | HTTP/JSON |
| frontend dev | 3000 | HTTP |

Портовете се задават само чрез env променливи (`.env`, не се комитва) — нищо не се хардкодва.

## Правила на работа

- `secret/` никога не влиза в git; референцията се ползва само за образец на поведение/форми
- Всеки модул: backend тестове (sandak) + frontend тестове преди качване
- Домейн термини и имена на модулите — на български според референцията
- Качените миграции не се променят — само нови миграции напред
