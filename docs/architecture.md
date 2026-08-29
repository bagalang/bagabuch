# Архитектура

## Правило

Приложенията в `app-product/` остават универсални. bagabuch **не** копира,
не вгражда и не кърпи fmrbaga / boilaDB / ormbaga. Връзката е:

- **build** — path deps в `backend/sandak.toml`
- **runtime** — само през портове по стандартни протоколи

## Стек

| Слой | Технология | Порт |
|------|------------|------|
| База | boilaDB, PostgreSQL v3 wire (`serve_pg`) | 6575 |
| API | Baga + fmrbaga (HTTP/JSON, JWT, OpenAPI, route-id dispatch) | 8080 |
| UI | Next.js App Router, React 19, чист CSS | 3000 |

Данните на boilaDB живеят в `bagabuch/db/` (`BOILA_PATH`), не в `/tmp`.

## Пакети (backend)

От `backend/sandak.toml`:

- `fmrbaga` — HTTP, JWT, JSON, маршрути
- `ormbaga` — заявки към boilaDB/Postgres
- `bagadecimal` — пари като стринг, без float
- `xmlbaga` + `reportbaga` — печат PDF/DOCX/ODT от HTML
- `std` — стандартната библиотека на Baga

Сумите в базата са `NUMERIC`, в JSON и в кода — **стрингове**.

## Мултитенант

Активната фирма е по потребител в таблица `settings` (ключ
`активна_фирма:<sub>`). Превключва се от хедъра.

Оперативните таблици (фактури, продукти, дневник) **още нямат** `company_id`.
Обектите (`company_locations`) и кочаните (`document_series`) имат.
Това е отделен дълг — при една демо-фирма минава.

## Автентикация

`POST /v1/auth/token` — JWT. В скелета паролата не се проверява; стига `sub`.
Роли и права по модул още няма (таблица `users` съществува, UI за тях няма).

## Репо

bagabuch е отделно репо (`bagalang/bagabuch`), submodule в baga монорепото
под `app-product/bagabuch`. Компилация: от `backend/` с `sandak` от корена
на baga.
