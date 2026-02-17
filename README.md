# Cloud Agent (работает без открытого MacBook)

Этот сервис запускается на сервере (Railway/Render/VM) и:
- может работать в ручном режиме (по кнопке) или в авто-режиме
- хранит текущий статус (`ЕСТЬ/НЕТ`)
- отдает endpoint для Apple Watch Команд:
  - `/watch/status?token=...`
  - `/watch/check?token=...`
  - `/watch/view?token=...` (визуальная карточка)

## 1) Локальный тест

```bash
cd cloud
cp .env.example .env
npm install
npm start
```

Проверка:
- `http://localhost:8080/health`
- `http://localhost:8080/status`

## 2) Деплой на Render (проще всего)

1. Создай новый `Web Service` из папки `cloud`.
2. Build Command:
`npm install`
3. Start Command:
`npm start`
4. Environment variables:
`TARGET_URL`
`PENDING_TEXT`
`PENDING_TEXT_VARIANTS`
`CLOUD_AUTO_CHECKS_ENABLED=false`
`CLOUD_CHECK_INTERVAL_MS=30000` (используется только если авто-режим включен)
`CLOUD_WATCH_TOKEN=<секрет>`
`CLOUD_HEADLESS=true`

После деплоя получишь URL вида:
`https://your-service.onrender.com`

## 3) URL для Apple Watch Команды

Используй:
`https://your-service.onrender.com/watch/check?token=<CLOUD_WATCH_TOKEN>`

Для только статуса без форс-проверки:
`https://your-service.onrender.com/watch/status?token=<CLOUD_WATCH_TOKEN>`

Для визуальной карточки:
`https://your-service.onrender.com/watch/view?token=<CLOUD_WATCH_TOKEN>`

## Ручной режим (только по нажатию)

Поставь:
`CLOUD_AUTO_CHECKS_ENABLED=false`

Тогда cloud-агент не будет проверять каждые 30 сек.
Проверка пойдет только при запросе:
`/watch/check?token=...`

## Ограничение

Если Sirius требует персональную авторизацию (логин/код), cloud-агент может показывать `Нужна авторизация`.
Это ограничение самой платформы авторизации, а не кода.
