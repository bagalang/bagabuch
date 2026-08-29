# Модел на данните

Миграциите са dual набор: `schema_pg_a/b/c.baga` (Postgres DDL с
NOT NULL/DEFAULT) и `schema_boila_a/b/c.baga` (исторически набор:
`ALTER ADD COLUMN` е само nullable). `schema.baga` ги сглобява според
`ORM_BACKEND`.

Качените `CREATE TABLE` **не се пипат**. Нови колони — нов `ALTER`.
Нови таблици в boila набора ползват текущия диалект.

PK за таблици от преди P20: `MAX(id)+1` в приложението. Нови таблици с
`BIGSERIAL` в Postgres набора.

## Основни таблици

| Таблица | Бележка |
|---------|---------|
| `companies` | Реквизити, ДДС, SAF-T полета, метод WAC/FIFO/LIFO; `settings` е JSON текст (`mistral_api_key`, `zhipu_api_key`) |
| `company_locations` | Търговски обекти и поделения |
| `beneficial_owners` | Действителни собственици |
| `ultimate_parents` | Крайни предприятия-майки |
| `document_series` | Кочани; `document_types` е CSV от кодове |
| `accounts` | Сметкоплан; `analytic_type`: none / counterpart / product |
| `counterparts` | Клиент / доставчик; `vies_address` суров, `street_name` / `building_number` / `region` за SAF-T |
| `products` | Стоки/услуги; складов флаг, сметки, фирмена наличност |
| `inventory_lots` | Партиди + `location_id` |
| `invoices` / `invoice_lines` | Данъчни документи + `location_id` |
| `journal_entries` / `journal_lines` | Дневник; редът има `location_id` |
| `vat_return_lines` | Клетки на ППДДС |
| `fixed_assets` / `fixed_asset_categories` / `fixed_asset_events` | ДМА; активът има `location_id` |
| `internal_docs` / `internal_doc_lines` | Вътрешен протокол |
| `accounting_periods` | Месец: open/closed; липсващ ред = отворен |
| `opening_balances` | Начално салдо за фискална година по сметка |
| `exchange_rates` | ЕЦБ курсове по дата |
| `settings` | Ключ/стойност (активна фирма). OCR/Mistral ключът е в `companies.settings`, не тук |
| `users` | Има таблица, няма модул |
| `bank_accounts` / `bank_transactions` | Има таблици, няма модул |

## Вътрешен документ

```
internal_docs (
  id, number, doc_date,
  from_location_id, to_location_id,
  status,            -- draft | confirmed
  notes, handed_by, received_by,
  created_at
)

internal_doc_lines (
  id, doc_id,
  line_kind,         -- product | fixed_asset
  product_id,        -- 0 ако ДМА
  asset_id,          -- 0 ако артикул
  quantity,          -- за ДМА винаги 1
  unit_cost, amount, description
)
```

## Пари и дати

Суми: `NUMERIC` в SQL, стринг в JSON. Датите по документи са `TEXT`
(`YYYY-MM-DD`), не timestamptz — заради boila и за да съвпадат с
данъчното събитие / месеца.
