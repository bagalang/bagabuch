# bagabuch — счетоводна програма

Счетоводна програма за българския пазар: фактури, контрагенти, сметкоплан,
счетоводен дневник (дебит/кредит), публикуване на фактури, мултитенант (активна
фирма), светла/тъмна тема и български/английски интерфейс.

Изградена по образец на референтната програма в `secret/` (локално, не се качва
в git).

## Контекст

2026 година е. България е в еврозоната — основната валута на счетоводството е
**евро (EUR)**. Чуждите валути се преизчисляват по официалните обменни курсове
на Европейската централна банка (ЕЦБ), импортирани от фида
`eurofxref` (дневен / 90-дневна история).

## Архитектура

**Приложенията остават универсални** — fmrbaga, boilaDB и останалите пакети от
`app-product/` не се копират и не се променят. bagabuch ги използва както са:

- **компилация** — чрез path-зависимости в `backend/sandak.toml` (baga монорепото)
- **работа (runtime)** — само през портове, по стандартните протоколи; никакви
  специални мостове или вграждане

| Услуга | Порт | Протокол |
|--------|------|----------|
| boilaDB | 6575 | PostgreSQL v3 wire (`serve_pg`) |
| backend API | 8080 | HTTP/JSON (fmrbaga) |
| frontend (dev) | 3000 | HTTP (Next.js) |

## Стек

| Слой | Технология |
|------|-----------|
| Backend | Baga + fmrbaga framework (HTTP/JSON, route-id dispatch, OpenAPI, JWT) |
| База данни | boilaDB (BoilaSQL) — отделен процес, PostgreSQL v3 wire; P20 SERIAL/FK, P28 JOIN/EXISTS, P31 mux, P43 O(1) point GET |
| Frontend | Next.js (App Router, React 19, чист CSS) |
| Автентикация | JWT |

## Функции

- **Фирми, Сметкоплан (йерархия), Контрагенти, Стоки и услуги** — CRUD
- **Фактури** — пълна форма като в inv: тип (фактура/проформа/кредитно/дебитно),
  автоматичен номер, данъчно събитие, контрагент и артикули с търсене, мерки,
  ДДС по ред, отстъпка, цени с/без ДДС; печат (оригинал/копие) и експорт
  PDF/DOCX/ODT през reportbaga (`report_from_html_io`; таблици/CSV са за отчети)
- **Публикуване на фактура** — генерира счетоводни записи по типови кореспонденции
  (изходяща: Дт 411 / Кт 702 + Кт 4532; входяща: Дт 602 + Дт 4531 / Кт 401);
  балансът дебит = кредит се пази; втори пост → 409
- **Счетоводен дневник** — дебит/кредит редове по запис
- **Валутни курсове (ЕЦБ)** — импорт на официалните курсове на Европейската
  централна банка от `eurofxref` фида (дневен / 90-дневна история), справка по
  дата с отстъпка към предходен работен ден, автодовършване на курса във
  фактура в чужда валута; TLS към ЕЦБ с котвен сертификат Sectigo OV E36
  (презаписваем с `BAGABUCH_ECB_ANCHOR_FILE`)
- **Мултитенант** — активна фирма по потребител (пази се в `settings`),
  превключвател и показване в хедъра, бутон „Активирай“ в страницата с фирми
- **Светла/тъмна тема** — глобално от самото начало, запазва се, без проблясък
- **Български (дефолт) + английски** — речници в `frontend/lib/i18n.ts`, запазват се
- **Частичен PATCH** — обновяват се само подадените полета (не се трият данни)
- **Числови низове в TEXT колони** (ЕИК, фактурни номера с водещи нули) — работят

## Изисквания

- **Baga** — bagabuch живее в baga монорепото (`app-product/bagabuch` е
  submodule). `scripts/dev.sh` намира корена на монорепото сам (две нива нагоре).
- **Node ≥ 20** (препоръчително 22 през nvm — `dev.sh` го добавя към PATH)

## Стартиране

```bash
./scripts/dev.sh     # цял стек (Ctrl+C в същия терминал също спира)
./scripts/stop.sh    # спира стека и от друг терминал
./scripts/seed.sh    # демо данни (след като backend е на :8080)
```

Стартира трите услуги на техните портове (boilaDB → backend → frontend).
Отвори `http://localhost:3000` — вход с произволно потребителско име
(скелетът изпраща само `sub`, паролата не се проверява).
За разработка: изтрий `db/` (пази `.gitignore`), пусни `dev.sh`, после
`./scripts/seed.sh` — фирма Бага ООД, сметкоплан, контрагенти, фактури.
Вход: потребител `demo` (паролата се игнорира).

Портовете и настройките се задават само чрез env променливи (виж
`backend/.env.example`); нищо не е хардкоднато.

## Структура

```
bagabuch/
├── backend/               # Baga приложение върху fmrbaga
│   ├── sandak.toml        # path deps → app-product/fmrbaga, ormbaga, std
│   ├── start.baga         # миграции → fmr_run
│   ├── routes.baga        # route table + dispatch (стабилни route id-та)
│   ├── schema.baga        # миграции (dual set: BoilaSQL + Postgres)
│   ├── actions/           # handlers по модул
│   └── models/            # table helpers
├── frontend/              # Next.js
│   ├── app/               # страници (login, фирми, сметкоплан, …)
│   ├── components/        # провайдери (тема/език/автентикация), обвивка, CRUD
│   └── lib/               # api клиент, i18n речници, storage
├── scripts/dev.sh         # локален старт на трите услуги
├── PLAN.md                # план и пътна карта
├── sstart.md              # начална задача
└── secret/                # (gitignored) референтната програма — само образец
```

## API (основно)

Всичко под `/v1/...`, JSON, JWT Bearer:

| Група | Пътища |
|-------|--------|
| system | `GET /health` `/ready` `/v1/meta` `/openapi.json` `/metrics` |
| auth | `POST /v1/auth/token`, `GET /v1/me` |
| firms | `/v1/companies` CRUD + `PUT /v1/active-company` |
| accounts | `/v1/accounts` CRUD |
| counterparts | `/v1/counterparts` CRUD |
| products | `/v1/products` CRUD |
| invoices | `/v1/invoices` CRUD, `POST /v1/invoices/{id}/post`, `GET /v1/invoices/next-number`, print/export (`pdf`, `docx`, `odt`) |
| journal | `GET /v1/journal`, `GET /v1/journal/{id}` |

## Проверки

```bash
# бекенд (компилация)
cd backend && sandak build

# фронтенд
cd frontend && npm run build && npm run lint

# живи проверки
curl -s localhost:8080/health
curl -s localhost:8080/ready
```

## Git

bagabuch е **отделно репозиторий** (`github.com:bagalang/bagabuch`), регистрирано
като submodule в baga монорепото (`app-product/bagabuch`). `secret/` никога не се
качва.

По пътя бяха фиксирани три универсални бъга в общите пакети (не тук):
- boilaDB `8f68e3b` — unknown-literal коерция str↔i64/num (числови низове в TEXT)
- ormbaga `a2e68b0` — multi-column UPDATE (презаписваше SET списъка)
- boilaDB `c7d5fbb` — числови низове с водещи нули вече не се инференцират като числа

Dual наборът миграции (Postgres vs исторически BoilaSQL) остава: качените
CREATE TABLE в boila набора са от преди P20 (без SERIAL/DEFAULT/NOT NULL/
REFERENCES), а `ALTER TABLE ADD COLUMN` в boila все още е само nullable.
Нови boila миграции ползват текущия диалект (UNIQUE INDEX, IF NOT EXISTS,
DROP INDEX … ON t). Приложението още подава явен PK (`MAX(id)+1`) за
таблиците без SERIAL — броячът се закача само при CREATE TABLE … BIGSERIAL.

Стар `BOILA_PATH` (без маркера `p43|dual`) работи с scan fallback на
versioned GET; нова директория получава O(1) point GET (P43). Backup:
`app-product/boilaDB/tools/backup.baga` (`BACKUP_MODE=create|verify|restore`).
