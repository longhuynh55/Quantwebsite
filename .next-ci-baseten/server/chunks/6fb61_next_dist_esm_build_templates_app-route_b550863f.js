module.exports=[78700,e=>{"use strict";var t=e.i(41488),a=e.i(87089),r=e.i(805),n=e.i(67436),s=e.i(20109),i=e.i(89425),o=e.i(88999),d=e.i(72107),u=e.i(48207),l=e.i(54989),c=e.i(36464),_=e.i(82888),p=e.i(24554),E=e.i(28692),w=e.i(19574),I=e.i(93695);e.i(53873);var b=e.i(11565),m=e.i(63917),y=e.i(68859),R=e.i(41256);async function g(e,t){let a=t.queueName?.trim()||"strategy_lab_default",r=Math.max(1e3,Math.trunc(t.leaseMs)),n=(await e.query(`
WITH candidate AS (
  SELECT id
  FROM strategy_lab_jobs
  WHERE queue_name = $1
    AND status IN ('queued', 'retry_wait')
    AND next_run_at <= now()
  ORDER BY priority DESC, next_run_at ASC, created_at ASC
  FOR UPDATE SKIP LOCKED
  LIMIT 1
)
UPDATE strategy_lab_jobs job
SET
  status = 'leased',
  lease_owner = $2,
  lease_expires_at = now() + ($3 * interval '1 millisecond'),
  last_heartbeat_at = now(),
  updated_at = now()
FROM candidate
WHERE job.id = candidate.id
RETURNING
  job.id,
  job.run_id,
  job.queue_name,
  job.attempt,
  job.max_attempts,
  job.priority,
  job.lease_expires_at
    `.trim(),[a,t.workerId,r])).rows[0];return n?{jobId:n.id,runId:n.run_id,queueName:n.queue_name,attempt:n.attempt,maxAttempts:n.max_attempts,priority:n.priority,leaseExpiresAt:n.lease_expires_at}:null}async function h(e,t){let a=Math.max(1e3,Math.trunc(t.leaseMs));return((await e.query(`
UPDATE strategy_lab_jobs
SET
  lease_expires_at = now() + ($3 * interval '1 millisecond'),
  last_heartbeat_at = now(),
  updated_at = now()
WHERE id = $1
  AND lease_owner = $2
  AND status IN ('leased', 'running')
    `.trim(),[t.jobId,t.workerId,a])).rowCount??0)>0}async function T(e,t){let a=t?.queueName?.trim()||"strategy_lab_default",r=Math.max(1,Math.min(1e3,Math.trunc(t?.limit??100)));return(await e.query(`
WITH expired AS (
  SELECT id
  FROM strategy_lab_jobs
  WHERE queue_name = $1
    AND status IN ('leased', 'running')
    AND lease_expires_at IS NOT NULL
    AND lease_expires_at < now()
  ORDER BY lease_expires_at ASC
  LIMIT $2
)
UPDATE strategy_lab_jobs job
SET
  status = 'retry_wait',
  lease_owner = NULL,
  lease_expires_at = NULL,
  next_run_at = now(),
  updated_at = now()
FROM expired
WHERE job.id = expired.id
RETURNING job.id
    `.trim(),[a,r])).rows.length}let A=new Set(["INTERNAL_ERROR","UPSTREAM_UNAVAILABLE","TIMEOUT","TRANSIENT_ERROR"]),N={leaseNext:g,heartbeat:h,recoverExpired:T};function f(e,t,a){return Math.max(t,Math.min(a,Math.trunc(e)))}async function x(e,t){await e.query(`
INSERT INTO strategy_lab_run_events (run_id, job_id, event_type, payload, created_at)
VALUES ($1, $2, $3, $4::jsonb, now())
    `.trim(),[t.runId,t.jobId,t.eventType,JSON.stringify(t.payload??{})])}async function j(e,t){return(await e.query(`
SELECT id, request_payload, cancel_requested
FROM strategy_lab_runs
WHERE id = $1
LIMIT 1
    `.trim(),[t])).rows[0]??null}async function S(e,t){let a=await e.query(`
SELECT cancel_requested
FROM strategy_lab_runs
WHERE id = $1
LIMIT 1
    `.trim(),[t]);return!!a.rows[0]?.cancel_requested}async function v(e,t){await e.query(`
UPDATE strategy_lab_runs
SET status = 'cancelled',
    updated_at = now(),
    finished_at = COALESCE(finished_at, now())
WHERE id = $1
    `.trim(),[t.runId]),await e.query(`
UPDATE strategy_lab_jobs
SET status = 'cancelled',
    lease_owner = NULL,
    lease_expires_at = NULL,
    updated_at = now(),
    finished_at = COALESCE(finished_at, now())
WHERE id = $1
    `.trim(),[t.jobId]),await x(e,{runId:t.runId,jobId:t.jobId,eventType:"run_cancelled",payload:{status:"cancelled",reason:t.reason}})}async function C(e,t=N){let a=e.queueName?.trim()||"strategy_lab_default",r=f(e.leaseMs??3e4,1e3,3e5),n=f(e.heartbeatMs??Math.max(1e3,Math.trunc(r/2)),1e3,r);await t.recoverExpired(e.client,{queueName:a});let s=await t.leaseNext(e.client,{workerId:e.workerId,queueName:a,leaseMs:r});if(!s)return{status:"idle"};let i=await j(e.client,s.runId);if(!i)return await e.client.query(`
UPDATE strategy_lab_jobs
SET status = 'dead_letter',
    lease_owner = NULL,
    lease_expires_at = NULL,
    last_error = 'Run not found',
    updated_at = now()
WHERE id = $1
      `.trim(),[s.jobId]),{status:"failed",runId:s.runId,jobId:s.jobId};if(i.cancel_requested)return await v(e.client,{runId:s.runId,jobId:s.jobId,reason:"cancel_requested_before_start"}),{status:"cancelled",runId:s.runId,jobId:s.jobId};await e.client.query(`
UPDATE strategy_lab_jobs
SET status = 'running',
    attempt = attempt + 1,
    updated_at = now()
WHERE id = $1
  AND lease_owner = $2
    `.trim(),[s.jobId,e.workerId]),await e.client.query(`
UPDATE strategy_lab_runs
SET status = 'running',
    updated_at = now(),
    started_at = COALESCE(started_at, now())
WHERE id = $1
    `.trim(),[s.runId]),await x(e.client,{runId:s.runId,jobId:s.jobId,eventType:"run_started",payload:{status:"running",workerId:e.workerId,attempt:s.attempt+1,maxAttempts:s.maxAttempts}});let o=new AbortController,d=setInterval(()=>{(async()=>{await t.heartbeat(e.client,{jobId:s.jobId,workerId:e.workerId,leaseMs:r}),await S(e.client,s.runId)&&!o.signal.aborted&&o.abort()})()},n);try{let t=(0,R.normalizeCreateRunRequest)(i.request_payload),a=await (0,R.executeRunInput)(s.runId,t,{signal:o.signal});return await e.client.query(`
UPDATE strategy_lab_runs
SET status = 'succeeded',
    metrics_summary = $2::jsonb,
    error_code = NULL,
    error_message = NULL,
    updated_at = now(),
    finished_at = now()
WHERE id = $1
      `.trim(),[s.runId,JSON.stringify({metrics:a.result.metrics,diagnostics:a.result.diagnostics,totalTrades:a.result.trades.length,equityPoints:a.result.equityCurve.length,antiBiasSignals:a.antiBiasSignals})]),await e.client.query(`
UPDATE strategy_lab_jobs
SET status = 'succeeded',
    lease_owner = NULL,
    lease_expires_at = NULL,
    updated_at = now(),
    finished_at = now()
WHERE id = $1
      `.trim(),[s.jobId]),await x(e.client,{runId:s.runId,jobId:s.jobId,eventType:"run_succeeded",payload:{status:"succeeded",totalTrades:a.result.trades.length,totalReturn:a.result.metrics.totalReturn}}),{status:"succeeded",runId:s.runId,jobId:s.jobId}}catch(r){var u;let t=(0,R.getExecutionErrorMeta)(r);if("RUN_ABORTED"===t.code||await S(e.client,s.runId))return await v(e.client,{runId:s.runId,jobId:s.jobId,reason:"RUN_ABORTED"===t.code?"abort_signal":"cancel_requested_during_execution"}),{status:"cancelled",runId:s.runId,jobId:s.jobId};let a=s.attempt+1;if(u=t.code,A.has(u)&&a<s.maxAttempts){let r,n=(r=f(e.retryBaseDelayMs??1e3,100,6e4),Math.min(f(e.retryMaxDelayMs??1e4,r,3e5),Math.trunc(r*Math.pow(2,Math.max(0,a-1)))));return await e.client.query(`
UPDATE strategy_lab_runs
SET status = 'queued',
    error_code = $2,
    error_message = $3,
    updated_at = now()
WHERE id = $1
        `.trim(),[s.runId,t.code,t.message]),await e.client.query(`
UPDATE strategy_lab_jobs
SET status = 'retry_wait',
    lease_owner = NULL,
    lease_expires_at = NULL,
    next_run_at = now() + ($2 * interval '1 millisecond'),
    last_error = $3,
    updated_at = now()
WHERE id = $1
        `.trim(),[s.jobId,n,`${t.code}: ${t.message}`]),await x(e.client,{runId:s.runId,jobId:s.jobId,eventType:"run_retry_scheduled",payload:{status:"queued",retryDelayMs:n,errorCode:t.code,currentAttempt:a,maxAttempts:s.maxAttempts}}),{status:"retry_wait",runId:s.runId,jobId:s.jobId}}return await e.client.query(`
UPDATE strategy_lab_runs
SET status = 'failed',
    error_code = $2,
    error_message = $3,
    updated_at = now(),
    finished_at = now()
WHERE id = $1
      `.trim(),[s.runId,t.code,t.message]),await e.client.query(`
UPDATE strategy_lab_jobs
SET status = 'dead_letter',
    lease_owner = NULL,
    lease_expires_at = NULL,
    last_error = $2,
    updated_at = now(),
    finished_at = now()
WHERE id = $1
      `.trim(),[s.jobId,`${t.code}: ${t.message}`]),await x(e.client,{runId:s.runId,jobId:s.jobId,eventType:"run_failed",payload:{status:"failed",errorCode:t.code,errorMessage:t.message}}),{status:"failed",runId:s.runId,jobId:s.jobId}}finally{clearInterval(d)}}function L(e){let t=Number.parseInt(String(e??"").trim(),10);if(Number.isFinite(t)&&!(t<1))return t}async function U(e){if("postgres"!==String(process.env.STRATEGY_LAB_REPOSITORY_BACKEND??"memory").trim().toLowerCase())return m.NextResponse.json({ok:!1,error:{code:"UNSUPPORTED_MODE",message:"Worker tick requires STRATEGY_LAB_REPOSITORY_BACKEND=postgres."}},{status:409});let t=process.env.STRATEGY_LAB_ADMIN_TOKEN?.trim();if(t){let a=e.headers.get("x-strategy-lab-admin-token")?.trim();if(!a||a!==t)return m.NextResponse.json({ok:!1,error:{code:"UNAUTHORIZED",message:"Invalid strategy-lab admin token."}},{status:403})}let a={};if((e.headers.get("content-type")??"").includes("application/json"))try{a=await e.json()}catch{return m.NextResponse.json({ok:!1,error:{code:"INVALID_INPUT",message:"Invalid JSON body."}},{status:400})}await (0,y.bootstrapStrategyLabPostgresClientFromEnv)();let r=globalThis.__strategyLabPostgresClient__;if(!r)return m.NextResponse.json({ok:!1,error:{code:"DATASET_UNAVAILABLE",message:"Postgres client is not available."}},{status:503});let n=await C({client:r,workerId:String(a.workerId??`sl-worker-${process.pid}`),queueName:"string"==typeof a.queueName?a.queueName:void 0,leaseMs:L(a.leaseMs),heartbeatMs:L(a.heartbeatMs)});return m.NextResponse.json({ok:!0,data:n})}e.s(["POST",()=>U],50668);var q=e.i(50668);let M=new t.AppRouteRouteModule({definition:{kind:a.RouteKind.APP_ROUTE,page:"/api/strategy-lab/worker/tick/route",pathname:"/api/strategy-lab/worker/tick",filename:"route",bundlePath:""},distDir:".next-ci-baseten",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/strategy-lab/worker/tick/route.ts",nextConfigOutput:"",userland:q}),{workAsyncStorage:O,workUnitAsyncStorage:D,serverHooks:P}=M;function $(){return(0,r.patchFetch)({workAsyncStorage:O,workUnitAsyncStorage:D})}async function k(e,t,r){M.isDev&&(0,n.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let m="/api/strategy-lab/worker/tick/route";m=m.replace(/\/index$/,"")||"/";let y=await M.prepare(e,t,{srcPage:m,multiZoneDraftMode:!1});if(!y)return t.statusCode=400,t.end("Bad Request"),null==r.waitUntil||r.waitUntil.call(r,Promise.resolve()),null;let{buildId:R,params:g,nextConfig:h,parsedUrl:T,isDraftMode:A,prerenderManifest:N,routerServerContext:f,isOnDemandRevalidate:x,revalidateOnlyGenerated:j,resolvedPathname:S,clientReferenceManifest:v,serverActionsManifest:C}=y,L=(0,o.normalizeAppPath)(m),U=!!(N.dynamicRoutes[L]||N.routes[S]),q=async()=>((null==f?void 0:f.render404)?await f.render404(e,t,T,!1):t.end("This page could not be found"),null);if(U&&!A){let e=!!N.routes[S],t=N.dynamicRoutes[L];if(t&&!1===t.fallback&&!e){if(h.experimental.adapterPath)return await q();throw new I.NoFallbackError}}let O=null;!U||M.isDev||A||(O="/index"===(O=S)?"/":O);let D=!0===M.isDev||!U,P=U&&!D;C&&v&&(0,i.setManifestsSingleton)({page:m,clientReferenceManifest:v,serverActionsManifest:C});let $=e.method||"GET",k=(0,s.getTracer)(),H=k.getActiveScopeSpan(),W={params:g,prerenderManifest:N,renderOpts:{experimental:{authInterrupts:!!h.experimental.authInterrupts},cacheComponents:!!h.cacheComponents,supportsDynamicResponse:D,incrementalCache:(0,n.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:h.cacheLife,waitUntil:r.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,a,r,n)=>M.onRequestError(e,t,r,n,f)},sharedContext:{buildId:R}},B=new d.NodeNextRequest(e),F=new d.NodeNextResponse(t),K=u.NextRequestAdapter.fromNodeNextRequest(B,(0,u.signalFromNodeResponse)(t));try{let i=async e=>M.handle(K,W).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let a=k.getRootSpanAttributes();if(!a)return;if(a.get("next.span_type")!==l.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${a.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let r=a.get("next.route");if(r){let t=`${$} ${r}`;e.setAttributes({"next.route":r,"http.route":r,"next.span_name":t}),e.updateName(t)}else e.updateName(`${$} ${m}`)}),o=!!(0,n.getRequestMeta)(e,"minimalMode"),d=async n=>{var s,d;let u=async({previousCacheEntry:a})=>{try{if(!o&&x&&j&&!a)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let s=await i(n);e.fetchMetrics=W.renderOpts.fetchMetrics;let d=W.renderOpts.pendingWaitUntil;d&&r.waitUntil&&(r.waitUntil(d),d=void 0);let u=W.renderOpts.collectedTags;if(!U)return await (0,_.sendResponse)(B,F,s,W.renderOpts.pendingWaitUntil),null;{let e=await s.blob(),t=(0,p.toNodeOutgoingHttpHeaders)(s.headers);u&&(t[w.NEXT_CACHE_TAGS_HEADER]=u),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let a=void 0!==W.renderOpts.collectedRevalidate&&!(W.renderOpts.collectedRevalidate>=w.INFINITE_CACHE)&&W.renderOpts.collectedRevalidate,r=void 0===W.renderOpts.collectedExpire||W.renderOpts.collectedExpire>=w.INFINITE_CACHE?void 0:W.renderOpts.collectedExpire;return{value:{kind:b.CachedRouteKind.APP_ROUTE,status:s.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:a,expire:r}}}}catch(t){throw(null==a?void 0:a.isStale)&&await M.onRequestError(e,t,{routerKind:"App Router",routePath:m,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:P,isOnDemandRevalidate:x})},!1,f),t}},l=await M.handleResponse({req:e,nextConfig:h,cacheKey:O,routeKind:a.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:N,isRoutePPREnabled:!1,isOnDemandRevalidate:x,revalidateOnlyGenerated:j,responseGenerator:u,waitUntil:r.waitUntil,isMinimalMode:o});if(!U)return null;if((null==l||null==(s=l.value)?void 0:s.kind)!==b.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==l||null==(d=l.value)?void 0:d.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});o||t.setHeader("x-nextjs-cache",x?"REVALIDATED":l.isMiss?"MISS":l.isStale?"STALE":"HIT"),A&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let I=(0,p.fromNodeOutgoingHttpHeaders)(l.value.headers);return o&&U||I.delete(w.NEXT_CACHE_TAGS_HEADER),!l.cacheControl||t.getHeader("Cache-Control")||I.get("Cache-Control")||I.set("Cache-Control",(0,E.getCacheControlHeader)(l.cacheControl)),await (0,_.sendResponse)(B,F,new Response(l.value.body,{headers:I,status:l.value.status||200})),null};H?await d(H):await k.withPropagatedContext(e.headers,()=>k.trace(l.BaseServerSpan.handleRequest,{spanName:`${$} ${m}`,kind:s.SpanKind.SERVER,attributes:{"http.method":$,"http.target":e.url}},d))}catch(t){if(t instanceof I.NoFallbackError||await M.onRequestError(e,t,{routerKind:"App Router",routePath:L,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:P,isOnDemandRevalidate:x})},!1,f),U)throw t;return await (0,_.sendResponse)(B,F,new Response(null,{status:500})),null}}e.s(["handler",()=>k,"patchFetch",()=>$,"routeModule",()=>M,"serverHooks",()=>P,"workAsyncStorage",()=>O,"workUnitAsyncStorage",()=>D],78700)}];

//# sourceMappingURL=6fb61_next_dist_esm_build_templates_app-route_b550863f.js.map