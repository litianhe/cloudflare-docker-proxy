# cloudflare-docker-proxy

![deploy](https://github.com/litianhe/cloudflare-docker-proxy/actions/workflows/deploy.yaml/badge.svg)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/litianhe/cloudflare-docker-proxy)

> If you're looking for proxy for helm, maybe you can try [cloudflare-helm-proxy](https://github.com/litianhe/cloudflare-helm-proxy).

## Deploy

1. click the "Deploy With Workers" button
2. follow the instructions to fork and deploy
3. update routes as you requirement. The worker's name is defined in `wrangler.toml` so the worker name is `cloudflare-proxy`.
```
[env.production]
name = "cloudflare-proxy"
```

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/litianhe/cloudflare-docker-proxy)

## Routes configuration tutorial
1. proxy multiple registries route by host
   - host your domain DNS on cloudflare
   - add `A` record of xxx.example.com to `192.0.2.1`
   - deploy this project to cloudflare workers
   - add `xxx.example.com/*` to HTTP routes of workers
   - add more records and modify the config as you need
   ```javascript
   const routes = {
     // production
    ["docker." + CUSTOM_DOMAIN]: dockerHub,
   }
   ```
2. 
