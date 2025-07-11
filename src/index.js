import DOCS from "./help.html";
import PAGE404 from "./404.html";

addEventListener("fetch", (event) => {
  event.passThroughOnException();
  event.respondWith(handleRequest(event.request));
});

const dockerHub = "https://registry-1.docker.io";
const gitHub = "https://github.com";

const index_dockerHub = "https://index.docker.io";
const registry_quay = "https://quay.io";
const index_quay = "https://quay.io";

const routes = {
  // production
  ["doc." + CUSTOM_DOMAIN]: "doc",
  ["docker." + CUSTOM_DOMAIN]: "https://registry-1.docker.io",
  ["quay." + CUSTOM_DOMAIN]: "https://quay.io",
  ["gcr." + CUSTOM_DOMAIN]: "https://gcr.io",
  ["k8s-gcr." + CUSTOM_DOMAIN]: "https://k8s.gcr.io",
  ["k8s." + CUSTOM_DOMAIN]: "https://registry.k8s.io",
  ["ghcr." + CUSTOM_DOMAIN]: "https://ghcr.io",
  ["cloudsmith." + CUSTOM_DOMAIN]: "https://docker.cloudsmith.io",
  ["ecr." + CUSTOM_DOMAIN]: "https://public.ecr.aws",
  ["github." + CUSTOM_DOMAIN]: gitHub,
};

function routeByHosts(host) {
  if (host in routes) {
    return routes[host];
  }
  if (MODE == "debug") {
    return TARGET_UPSTREAM;
  }
  return "";
}

async function handleRequest(request) {
  const url = new URL(request.url);
  const upstream = routeByHosts(url.hostname);
  // if (upstream === "") {
  //   return new Response(PAGE404,{
  //       status: 404,
  //       headers: {
  //         "content-type": "text/html",
  //       },
  //     }
  //   );
  // }

  if (upstream === "") {
    return fetch(request);
  }

  // return docs
  if (upstream === "doc") {
    return new Response(DOCS, {
      status: 200,
      headers: {
        "content-type": "text/html",
      },
    });
  }

  const isDockerHub = upstream == dockerHub;
  const isGitHub = upstream == gitHub;

  const authorization = request.headers.get("Authorization");

  if (url.pathname.startsWith("/v1/")) {
    let newUrl = url

    // Docker API /v1/_ping
    // https://docs.docker.com/reference/api/engine/version/v1.47/#tag/System/operation/SystemPing
    if (url.pathname == "/v1/_ping") {
      return new Response(null, {
        status: 200,
        headers: {
          "content-type": "text/plain",
        },
      });
    }

    // Docker API /v1/search
    if (url.pathname == "/v1/search") {
      if(isDockerHub){
        newUrl = new URL(index_dockerHub + "/v1/search");
      }else if(isQuay){
        newUrl = new URL(index_quay + "/v1/search");
      }else{
        newUrl = url
      }

      newUrl.search = url.search;
    }

    const headers = new Headers();
    if (authorization) {
      headers.set("Authorization", authorization);
    }

    // check if need to authenticate
    const resp = await fetch(newUrl.toString(), {
      method: "GET",
      headers: headers,
      redirect: "follow",
    });

    if (resp.status === 401) {
      return responseUnauthorized(url);
    }
    return resp;
  }

  if (url.pathname == "/v2/") {
    const newUrl = new URL(upstream + "/v2/");
    const headers = new Headers();
    if (authorization) {
      headers.set("Authorization", authorization);
    }
    // check if need to authenticate
    const resp = await fetch(newUrl.toString(), {
      method: "GET",
      headers: headers,
      redirect: "follow",
    });
    if (resp.status === 401) {
      return responseUnauthorized(url);
    }
    return resp;
  }
  // get token
  if (url.pathname == "/v2/auth") {
    const newUrl = new URL(upstream + "/v2/");
    const resp = await fetch(newUrl.toString(), {
      method: "GET",
      redirect: "follow",
    });
    if (resp.status !== 401) {
      return resp;
    }
    const authenticateStr = resp.headers.get("WWW-Authenticate");
    if (authenticateStr === null) {
      return resp;
    }
    const wwwAuthenticate = parseAuthenticate(authenticateStr);
    let scope = url.searchParams.get("scope");
    // autocomplete repo part into scope for DockerHub library images
    // Example: repository:busybox:pull => repository:library/busybox:pull
    if (scope && isDockerHub) {
      let scopeParts = scope.split(":");
      if (scopeParts.length == 3 && !scopeParts[1].includes("/")) {
        scopeParts[1] = "library/" + scopeParts[1];
        scope = scopeParts.join(":");
      }
    }
    return await fetchToken(wwwAuthenticate, scope, authorization);
  }
  console.log(JSON.stringify(url, null, 2))

  // redirect for DockerHub library images
  // Example: /v2/busybox/manifests/latest => /v2/library/busybox/manifests/latest
  if (isDockerHub) {
    const pathParts = url.pathname.split("/");
    console.log(JSON.stringify(url, null, 2))
    if (pathParts.length == 5) {
      pathParts.splice(2, 0, "library");
      const redirectUrl = new URL(url);
      redirectUrl.pathname = pathParts.join("/");
      return Response.redirect(redirectUrl, 301);
    }
  }

  // foward requests
  const newUrl = new URL(upstream + url.pathname);
  const headers = new Headers(request.headers);
  // Add User-Agent header for GitHub
  if (isGitHub && !headers.has("User-Agent")) {
    headers.set("User-Agent", "Cloudflare-Docker-Proxy");
  }

  const newReq = new Request(newUrl, {
    method: request.method,
    headers: request.headers,
    // don't follow redirect to dockerhub blob upstream
    redirect: isDockerHub ? "manual" : "follow",
  });
  const resp = await fetch(newReq);
  if (resp.status == 401) {
    return responseUnauthorized(url);
  }
  // handle dockerhub blob redirect manually
  if (isDockerHub && resp.status == 307) {
    const location = new URL(resp.headers.get("Location"));
    const redirectResp = await fetch(location.toString(), {
      method: "GET",
      redirect: "follow",
    });
    return redirectResp;
  }
  return resp;
}

function parseAuthenticate(authenticateStr) {
  // sample: Bearer realm="https://auth.ipv6.docker.com/token",service="registry.docker.io"
  // match strings after =" and before "
  const re = /(?<=\=")(?:\\.|[^"\\])*(?=")/g;
  const matches = authenticateStr.match(re);
  if (matches == null || matches.length < 2) {
    throw new Error(`invalid Www-Authenticate Header: ${authenticateStr}`);
  }
  return {
    realm: matches[0],
    service: matches[1],
  };
}

async function fetchToken(wwwAuthenticate, scope, authorization) {
  const url = new URL(wwwAuthenticate.realm);
  if (wwwAuthenticate.service.length) {
    url.searchParams.set("service", wwwAuthenticate.service);
  }
  if (scope) {
    url.searchParams.set("scope", scope);
  }
  const headers = new Headers();
  if (authorization) {
    headers.set("Authorization", authorization);
  }
  return await fetch(url, { method: "GET", headers: headers });
}

function responseUnauthorized(url) {
  const headers = new Headers();
  if (MODE == "debug") {
    headers.set(
      "Www-Authenticate",
      `Bearer realm="http://${url.host}/v2/auth",service="cloudflare-docker-proxy"`
    );
  } else {
    headers.set(
      "Www-Authenticate",
      `Bearer realm="https://${url.hostname}/v2/auth",service="cloudflare-docker-proxy"`
    );
  }
  return new Response(JSON.stringify({ message: "UNAUTHORIZED" }), {
    status: 401,
    headers: headers,
  });
}
