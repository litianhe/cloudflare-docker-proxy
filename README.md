# cloudflare-docker-proxy

![deploy](https://github.com/litianhe/cloudflare-docker-proxy/actions/workflows/deploy.yaml/badge.svg)

[![Deploy to Cloudflare Workers](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/litianhe/cloudflare-docker-proxy)

> If you're looking for proxy for helm, maybe you can try [cloudflare-helm-proxy](https://github.com/litianhe/cloudflare-helm-proxy).

## Introduction
This project is a docker registry proxy. It's deployed as a cloudflare worker, and provide the proxy service for accessing docker registry.


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
      ["docker." + CUSTOM_DOMAIN]: dockerHub,
      ["quay." + CUSTOM_DOMAIN]: "https://quay.io",
      ["gcr." + CUSTOM_DOMAIN]: "https://gcr.io",
      ["k8s-gcr." + CUSTOM_DOMAIN]: "https://k8s.gcr.io",
      ["k8s." + CUSTOM_DOMAIN]: "https://registry.k8s.io",
      ["ghcr." + CUSTOM_DOMAIN]: "https://ghcr.io",
      ["cloudsmith." + CUSTOM_DOMAIN]: "https://docker.cloudsmith.io",
      ["ecr." + CUSTOM_DOMAIN]: "https://public.ecr.aws",
   }
   ```
2. config so the access to docker.example.com can be redirect to docker.io, and then access `https://www.example.com` to check the routers
3. change the docker daemon's registry-mirrors file `/etc/docker/daemon.json` with content like this:
```
{
  "registry-mirrors": [
      "https://docker.example.com"
  ]
}
```
4. Restart docker service with command `sudo service docker restart` and test it with `docker pull nginx`
>  Note: The worker with free plan can only handle 10k requests per day, and pls retry if the docker pull request failed(resource limitation in cloudflare worker free plan)