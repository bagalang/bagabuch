# API

База: `http://localhost:8080`. JSON, JWT Bearer (`POST /v1/auth/token`).
Route id-тата в `backend/routes.baga` са стабилни — не се пренареждат
(OpenAPI operationId). Нови пътища взимат следващ свободен id (140+ са
вътрешните документи). Статичният сегмент (`next-number`) е **преди** `{id}`.

Пълен OpenAPI: `GET /openapi.json`.

## Система и вход

| Метод | Път |
|--------|-----|
| GET | `/health` `/ready` `/readyz` `/v1/meta` `/openapi.json` `/metrics` |
| POST | `/v1/auth/token` |
| GET | `/v1/me` |
| GET/PUT | `/v1/active-company` |

## Фирма и настройки

| Метод | Път |
|--------|-----|
| CRUD | `/v1/companies` |
| GET | `/v1/companies/{id}/settings` |
| POST/PATCH/DELETE | `/v1/companies/{id}/locations`, `/v1/company-locations/{id}` |
| също | `beneficial-owners`, `ultimate-parents`, `document-series` |

## Номенклатури

`/v1/accounts`, `/v1/counterparts`, `/v1/products`, `/v1/units`,
`/v1/vat-exemptions`. `POST /v1/accounts/seed-saft` пълни липсващите
сметки от NRA_Nom_Accounts (същото става при създаване на фирма).

VIES (нужен JWT; ключът е на **активната** фирма):

| Метод | Път | Бележка |
|--------|-----|---------|
| GET | `/v1/counterparts/vies-lookup?vat=` | справка, без запис |
| POST | `/v1/counterparts/vies` | създава контрагент `{vat_number, counterpart_type?}` |

Отговорът на lookup: `valid`, `name`, `address` / `vies_address` (суров),
`street_name`, `building_number`, `city`, `post_code`, `region`,
`country_code`, `vat_number`, `parse_ok`, `parse_note`.
Разделянето е само ако в настройките на активната фирма има `mistral_api_key`.

## Фактури и дневник

| Метод | Път |
|--------|-----|
| CRUD | `/v1/invoices` |
| GET | `/v1/invoices/next-number?document_type=&direction=` |
| POST | `/v1/invoices/{id}/post` |
| GET | `/v1/invoices/{id}/print?format=pdf\|docx\|odt` |
| GET | `/v1/invoices/{id}/ubl` |
| GET/POST | `/v1/journal`, GET `/v1/journal/{id}` |

## Вътрешни документи и склад

| Метод | Път |
|--------|-----|
| CRUD | `/v1/internal-docs` |
| GET | `/v1/internal-docs/next-number` |
| POST | `/v1/internal-docs/{id}/confirm` — **без** journal_entries |
| GET | `/v1/internal-docs/{id}/print?format=` |
| GET | `/v1/inventory/at-location?location_id=` |

## Периоди и начални салда

| Метод | Път |
|--------|-----|
| GET | `/v1/accounting-periods?year=` — 12 месеца; липсващ ред = отворен |
| POST | `/v1/accounting-periods/close` `{year, month, notes, closed_at}` |
| POST | `/v1/accounting-periods/reopen` `{year, month}` |
| GET | `/v1/opening-balances?year=` |
| POST | `/v1/opening-balances` |
| PATCH/DELETE | `/v1/opening-balances/{id}` |

## Справки

JSON на екрана (сумите с точка); файлът е XHTML таблица → reportbaga
(`report_from_html_io`), като печата на фактури. Формати: `pdf`, `xlsx`,
`ods`. В таблицата за експорт сумите са със запетая; XLSX/ODS ги пишат
като числа, за да ги чете български Excel/Google Sheets.

| Метод | Път |
|--------|-----|
| GET | `/v1/reports?kind=&from=&to=&account=&counterpart_id=` |
| GET | `/v1/reports/export?kind=&from=&to=&account=&counterpart_id=&format=` |

`kind`: `trial_balance`, `general_ledger`, `chronological`,
`counterpart_trial`, `counterpart_chrono`. Датите са ISO `YYYY-MM-DD`.
`account` е префикс на номера. По контрагент `counterpart_id` е задължителен.

## ДДС, SAF-T, валута, ДМА

| Метод | Път |
|--------|-----|
| GET | `/v1/vat/registers?period=` `/v1/vat/return?period=` |
| GET | `/v1/vat/export?period=&type=deklar\|pokupki\|prodagbi\|zip` |
| CRUD | `/v1/dividend-distributions` |
| POST | `/v1/dividends/{id}/pay` `{is_paid, payment_date}` |
| GET | `/v1/saft/export?period=&mode=monthly\|ondemand\|annual` |
| GET | `/v1/saft/nomenclatures?kind=&search=` |
| GET | `/v1/exchange-rates`, `/v1/exchange-rates/rate?currency=&date=` |
| POST | `/v1/exchange-rates/import` |
| CRUD | `/v1/fixed-asset-categories`, `/v1/fixed-assets` |
| POST | `/v1/fixed-assets/depreciation/preview` и `/post` |
| POST | `/v1/fixed-assets/{id}/revalue\|move\|conserve\|end-conserve\|dispose` |
| GET | `/v1/fixed-assets/{id}/events` |

`move` приема JSON `{ "location_id": N, "event_date", "reason" }`.

## Админ, SMTP, S3, потребители

SMTP и S3 **не са Baga пакети**. Python sidecar `:5050` (`scripts/py/sidecar.py`).
Backend-ът му говори HTTP.

| Метод | Път |
|--------|-----|
| GET/PUT | `/v1/system-settings` `{items:[{key,value}]}` |
| POST | `/v1/system-settings/smtp-test` `{to}` |
| POST | `/v1/system-settings/s3-test` `/s3-backup` `/s3-delete` `{s3_key}` |
| GET | `/v1/system-settings/s3-backups` |
| CRUD | `/v1/users`, `/v1/roles` |

`GET /v1/saft/nomenclatures` без `kind` връща списъка номенклатури. С `kind=`
връща `{kind, items, count}` (официални кодове на НАП, без CRUD):
`stock_movements`, `asset_movements`, `tax_regimes`, `payment_methods`,
`invoice_types`, `tax_types`, `tax_codes`, `product_types`, `units`,
`regions`, `accounts`. `search` филтрира по подниз.

## Сканиране

| Метод | Път | Бележка |
|--------|-----|---------|
| POST | `/v1/scans/extract` | `{filename, mime, content_base64, direction: in\|out}` → JSON на фактура с редове |
| GET | `/v1/product-name-mappings?counterpart_id=` | запомнени имена от документи |
| POST | `/v1/product-name-mappings` | `{counterpart_id, items: [{scanned_name, product_id}]}` |

Черновата се записва с обикновения `POST /v1/invoices`. Без ключ extract връща 422.
Модели: OCR `mistral-ocr-latest`, JSON `mistral-small-latest` (евтиният път).
