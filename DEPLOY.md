# הוראות הפעלה על VPS בישראל

## אפשרות 1: עם Docker

1. התקן Docker ו-Docker Compose על ה-VPS
2. העתק את הקבצים ל-VPS
3. הרץ:
```bash
docker-compose up -d
```

## אפשרות 2: ללא Docker

1. התקן Node.js 20+ על ה-VPS
2. העתק את הקבצים ל-VPS
3. הרץ:
```bash
npm install
npm run build
npm start
```

## אפשרות 3: עם PM2 (מומלץ)

1. התקן PM2: `npm install -g pm2`
2. הרץ: `pm2 start npm --name "idf-proxy" -- start`
3. שמור: `pm2 save`
4. הגדר auto-start: `pm2 startup`

## אפשרות 4: עם Nginx Reverse Proxy

1. התקן Nginx
2. צור קובץ `/etc/nginx/sites-available/idf-proxy`:
```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```
3. הפעל: `sudo ln -s /etc/nginx/sites-available/idf-proxy /etc/nginx/sites-enabled/`
4. הרענן: `sudo nginx -s reload`

## הערות

- אם אתה מריץ על VPS בישראל, **אין צורך ב-proxy** - פשוט תסיר את `PROXY_URL` מה-environment variables
- השרת ירוץ ישירות מישראל, כך שהבקשות יראו כאילו הן מגיעות מישראל

