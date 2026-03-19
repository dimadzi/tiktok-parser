# TikTok Stats Parser

Веб-додаток для збору статистики TikTok акаунтів через Apify API.

## Структура проекту

```
tiktok-parser/
├── index.html                    ← веб-інтерфейс
├── netlify.toml                  ← конфіг Netlify
├── package.json                  ← залежності для functions
└── netlify/
    └── functions/
        └── scrape.js             ← серверна функція (викликає Apify)
```

## Деплой на Netlify (покрокова інструкція)

### 1. Завантаж проект на GitHub

1. Зайди на github.com → "New repository"
2. Назви його `tiktok-parser`, зроби приватним
3. Завантаж всі файли цього проекту

### 2. Підключи до Netlify

1. Зайди на netlify.com → "Add new site" → "Import an existing project"
2. Вибери GitHub і обери репозиторій `tiktok-parser`
3. Build settings залиш пустими (статичний сайт)
4. Натисни "Deploy site"

### 3. Готово!

Netlify автоматично підхопить `netlify/functions/scrape.js` і задеплоїть її як serverless function.

## Використання

1. Відкрий сайт
2. Вкажи Apify API ключ (знайти: console.apify.com → Settings → API & Integrations)
3. Вкажи акаунти (URL або @username, кожен з нового рядка)
4. Вибери місяць і рік
5. Натисни "Запустити парсер"
6. Завантаж результат у CSV

## Важливо

- API ключ вводиться прямо на сайті — нікуди не зберігається
- Щоб змінити ключ — просто введи новий
- Один запуск = ~$0.50–1.00 з Apify кредитів (залежить від к-сті акаунтів)
