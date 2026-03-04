module.exports=[16447,e=>{"use strict";var t=e.i(41488),r=e.i(87089),a=e.i(805),n=e.i(67436),o=e.i(20109),s=e.i(89425),i=e.i(88999),l=e.i(72107),d=e.i(48207),c=e.i(54989),u=e.i(36464),p=e.i(82888),g=e.i(24554),y=e.i(28692),h=e.i(19574),m=e.i(93695);e.i(53873);var f=e.i(11565),v=e.i(63917),w=e.i(73872);let R=`You are an expert quantitative trading strategy designer for the Vietnamese stock market (HOSE). Your task is to convert natural language descriptions into structured trading strategies that can be visualized as node-based flow diagrams.

## Available Node Types

1. **dataSource**: Input data from stock market
   - stocks: Array of stock symbols (e.g., ["VNM", "VCB", "VIC"])
   - timeframe: Time period (e.g., "1d", "1h", "1w")
   - startDate: Start date in YYYY-MM-DD format
   - endDate: End date in YYYY-MM-DD format

2. **indicator**: Technical indicators
   - indicatorType: One of "rsi", "macd", "ma", "ema", "bollinger", "atr", "volume"
   - period: Lookback period (default: 14)
   - fastPeriod: Fast period for MACD (default: 12)
   - slowPeriod: Slow period for MACD (default: 26)
   - signalPeriod: Signal period for MACD (default: 9)
   - standardDeviations: StdDev for Bollinger (default: 2)

3. **filter**: Conditions to filter data
   - filterType: One of "price_above", "price_below", "volume_above", "volume_below", "rsi_overbought", "rsi_oversold"
   - value: Threshold value
   - comparisonOperator: One of ">", "<", ">=", "<=", "==", "!="

4. **signal**: Buy/Sell signal generation
   - signalType: "buy" or "sell"
   - condition: Description of the condition
   - quantity: Number of shares (optional)
   - stopLoss: Stop loss percentage (optional)
   - takeProfit: Take profit percentage (optional)

5. **output**: Strategy output/metrics
   - metrics: Array of metrics to track (e.g., ["sharpe", "returns", "drawdown", "win_rate"])

## Output Format

You must return a valid JSON object with this structure:
{
  "nodes": [
    {
      "id": "unique-node-id",
      "type": "dataSource|indicator|filter|signal|output",
      "position": { "x": number, "y": number },
      "data": {
        "type": "dataSource|indicator|filter|signal|output",
        "label": "Human readable label",
        "config": { ... node-specific config ... }
      }
    }
  ],
  "edges": [
    {
      "id": "unique-edge-id",
      "source": "source-node-id",
      "target": "target-node-id"
    }
  ],
  "explanation": "Vietnamese explanation of the strategy logic and expected behavior"
}

## Position Guidelines
- dataSource nodes should start at x: 50, y: 50
- indicator nodes should be at x: 300, increment y by 100 for each
- filter nodes should be at x: 550, increment y by 100 for each
- signal nodes should be at x: 800, increment y by 100 for each
- output nodes should be at x: 1050, y: 150

## Strategy Design Rules
1. Every strategy must start with a dataSource node
2. Indicators must connect to dataSource or other indicators
3. Filters must connect to indicators or dataSource
4. Signals must connect to filters or indicators
5. Output must connect to signals
6. Provide clear Vietnamese explanations
7. Use realistic parameter values for Vietnamese market

## Vietnamese Stock Market Context
- Trading hours: 9:00-11:30 AM and 1:00-2:30 PM (ICT)
- Price limits: +/- 7% for HOSE, +/- 10% for HNX
- Common indicators work well: RSI (14), MACD (12,26,9), MA (20, 50, 200)
- Consider market-specific factors: foreign flows, circuit breakers, Tet seasonality`,x=`Please create a trading strategy based on the following description:

{USER_DESCRIPTION}

Return ONLY valid JSON with the strategy structure. Include a Vietnamese explanation of how the strategy works.`;var b=e.i(50377);let S=(0,b.createLogger)("ai.strategy-generator");async function C(e,t={}){let r=Date.now(),a=t.requestId||("u">typeof crypto&&"function"==typeof crypto.randomUUID?crypto.randomUUID():`strategy-${Date.now()}-${Math.random().toString(36).slice(2,10)}`),n=S.child({requestId:a});n.info("strategy.generation.started",{promptLength:e.length,promptDigest:(0,b.hashText)(e)});try{var o;let t,s,i,l,d=[{role:"system",content:R+"\n\n"+x.replace("{USER_DESCRIPTION}",e)},{role:"user",content:e}],c=await (0,w.generateWithProviderFallback)(d,{requestId:a});if(!c.success)return n.warn("strategy.generation.provider_failed",{kind:c.kind,latencyMs:c.latencyMs}),{success:!1,error:c.message||"Failed to generate strategy",latencyMs:Date.now()-r};let u=c.text,p=function(e){try{let t=e.match(/\{[\s\S]*"nodes"[\s\S]*"edges"[\s\S]*\}/);if(!t)return null;let r=JSON.parse(t[0]);if(!Array.isArray(r.nodes)||!Array.isArray(r.edges))return null;return r}catch{try{let t=JSON.parse(e);if(!Array.isArray(t.nodes)||!Array.isArray(t.edges))return null;return t}catch{return null}}}(u);if(!p)return n.warn("strategy.generation.parse_failed",{responseLength:u.length,responseDigest:(0,b.hashText)(u)}),{success:!1,rawResponse:u,error:"Failed to parse strategy from AI response. Please try again with a clearer description.",latencyMs:Date.now()-r};let g=(o=p,t=["dataSource","indicator","filter","signal","output"],s=new Set,i=o.nodes.map((e,r)=>{let a=e.id||`node-${r}`;s.add(a);let n=t.includes(e.type)?e.type:"indicator",o=e.position||{x:50+250*r,y:100},i={type:n,label:e.data?.label||`${n} Node`,config:e.data?.config||{}};return{...e,id:a,type:n,position:o,data:i}}),l=o.edges.filter(e=>{let t=e.source,r=e.target;return s.has(t)&&s.has(r)}).map((e,t)=>({...e,id:e.id||`edge-${t}`})),{nodes:i,edges:l,explanation:o.explanation||"Chien luoc duoc tao tu mo ta cua ban. Vui long xem cac node de hieu chi tiet.",name:o.name,strategyType:o.strategyType,riskLevel:o.riskLevel});return n.info("strategy.generation.completed",{nodeCount:g.nodes.length,edgeCount:g.edges.length,explanationLength:g.explanation.length,latencyMs:Date.now()-r,providerUsed:c.providerUsed}),{success:!0,strategy:g,rawResponse:u,latencyMs:Date.now()-r,providerUsed:c.providerUsed}}catch(t){let e=t instanceof Error?t.message:String(t);return n.error("strategy.generation.exception",{error:e,latencyMs:Date.now()-r}),{success:!1,error:`An error occurred: ${e}`,latencyMs:Date.now()-r}}}var E=e.i(79678);let A=(0,b.createLogger)("api.ai.generate-strategy");async function M(e){let t=Date.now(),r="u">typeof crypto&&"function"==typeof crypto.randomUUID?crypto.randomUUID():`strategy-req-${Date.now()}-${Math.random().toString(36).slice(2,10)}`,a=A.child({requestId:r});try{let t,n=(0,E.getClientIdentifier)(e),o=(0,E.createRateLimitKey)("strategy-generation",n),s=(0,E.checkRateLimit)(o,10,6e4);if(!s.allowed)return a.warn("rate_limit.blocked",{remaining:s.remaining,resetInMs:Math.max(0,s.resetTime-Date.now())}),v.NextResponse.json({success:!1,error:"Too many requests. Please wait a moment before generating another strategy.",requestId:r},{status:429});try{t=await e.json()}catch{return a.warn("request.invalid_json"),v.NextResponse.json({success:!1,error:"Invalid JSON payload.",requestId:r},{status:400})}let i=(t.prompt||"").trim();if(!i)return a.warn("request.empty_prompt"),v.NextResponse.json({success:!1,error:"Prompt is required. Please describe the strategy you want to create.",requestId:r},{status:400});if(i.length>2e3)return a.warn("request.prompt_too_long",{promptLength:i.length,maxLength:2e3}),v.NextResponse.json({success:!1,error:"Prompt is too long. Maximum 2000 characters allowed.",requestId:r},{status:400});a.info("request.received",{promptLength:i.length,clientRequestId:t.requestId||null});let l=await C(i,{requestId:t.requestId||r});if(!l.success)return a.warn("generation.failed",{error:l.error,latencyMs:l.latencyMs}),v.NextResponse.json({success:!1,error:l.error||"Failed to generate strategy. Please try again.",rawResponse:l.rawResponse,latencyMs:l.latencyMs,requestId:r},{status:500});return a.info("generation.completed",{nodeCount:l.strategy?.nodes.length||0,edgeCount:l.strategy?.edges.length||0,latencyMs:l.latencyMs,providerUsed:l.providerUsed}),v.NextResponse.json({success:!0,strategy:l.strategy,latencyMs:l.latencyMs,providerUsed:l.providerUsed,requestId:r})}catch(e){return a.error("request.exception",{...(0,b.toErrorMeta)(e),latencyMs:Date.now()-t}),v.NextResponse.json({success:!1,error:"An unexpected error occurred. Please try again.",requestId:r},{status:500})}}e.s(["POST",()=>M],33338);var D=e.i(33338);let T=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/ai/generate-strategy/route",pathname:"/api/ai/generate-strategy",filename:"route",bundlePath:""},distDir:".next-ci-landing-validation",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/ai/generate-strategy/route.ts",nextConfigOutput:"",userland:D}),{workAsyncStorage:N,workUnitAsyncStorage:P,serverHooks:k}=T;function I(){return(0,a.patchFetch)({workAsyncStorage:N,workUnitAsyncStorage:P})}async function O(e,t,a){T.isDev&&(0,n.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let v="/api/ai/generate-strategy/route";v=v.replace(/\/index$/,"")||"/";let w=await T.prepare(e,t,{srcPage:v,multiZoneDraftMode:!1});if(!w)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:R,params:x,nextConfig:b,parsedUrl:S,isDraftMode:C,prerenderManifest:E,routerServerContext:A,isOnDemandRevalidate:M,revalidateOnlyGenerated:D,resolvedPathname:N,clientReferenceManifest:P,serverActionsManifest:k}=w,I=(0,i.normalizeAppPath)(v),O=!!(E.dynamicRoutes[I]||E.routes[N]),_=async()=>((null==A?void 0:A.render404)?await A.render404(e,t,S,!1):t.end("This page could not be found"),null);if(O&&!C){let e=!!E.routes[N],t=E.dynamicRoutes[I];if(t&&!1===t.fallback&&!e){if(b.experimental.adapterPath)return await _();throw new m.NoFallbackError}}let U=null;!O||T.isDev||C||(U="/index"===(U=N)?"/":U);let q=!0===T.isDev||!O,H=O&&!q;k&&P&&(0,s.setManifestsSingleton)({page:v,clientReferenceManifest:P,serverActionsManifest:k});let L=e.method||"GET",j=(0,o.getTracer)(),$=j.getActiveScopeSpan(),F={params:x,prerenderManifest:E,renderOpts:{experimental:{authInterrupts:!!b.experimental.authInterrupts},cacheComponents:!!b.cacheComponents,supportsDynamicResponse:q,incrementalCache:(0,n.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:b.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,n)=>T.onRequestError(e,t,a,n,A)},sharedContext:{buildId:R}},V=new l.NodeNextRequest(e),Y=new l.NodeNextResponse(t),K=d.NextRequestAdapter.fromNodeNextRequest(V,(0,d.signalFromNodeResponse)(t));try{let s=async e=>T.handle(K,F).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=j.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==c.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${L} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t)}else e.updateName(`${L} ${v}`)}),i=!!(0,n.getRequestMeta)(e,"minimalMode"),l=async n=>{var o,l;let d=async({previousCacheEntry:r})=>{try{if(!i&&M&&D&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let o=await s(n);e.fetchMetrics=F.renderOpts.fetchMetrics;let l=F.renderOpts.pendingWaitUntil;l&&a.waitUntil&&(a.waitUntil(l),l=void 0);let d=F.renderOpts.collectedTags;if(!O)return await (0,p.sendResponse)(V,Y,o,F.renderOpts.pendingWaitUntil),null;{let e=await o.blob(),t=(0,g.toNodeOutgoingHttpHeaders)(o.headers);d&&(t[h.NEXT_CACHE_TAGS_HEADER]=d),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==F.renderOpts.collectedRevalidate&&!(F.renderOpts.collectedRevalidate>=h.INFINITE_CACHE)&&F.renderOpts.collectedRevalidate,a=void 0===F.renderOpts.collectedExpire||F.renderOpts.collectedExpire>=h.INFINITE_CACHE?void 0:F.renderOpts.collectedExpire;return{value:{kind:f.CachedRouteKind.APP_ROUTE,status:o.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==r?void 0:r.isStale)&&await T.onRequestError(e,t,{routerKind:"App Router",routePath:v,routeType:"route",revalidateReason:(0,u.getRevalidateReason)({isStaticGeneration:H,isOnDemandRevalidate:M})},!1,A),t}},c=await T.handleResponse({req:e,nextConfig:b,cacheKey:U,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:E,isRoutePPREnabled:!1,isOnDemandRevalidate:M,revalidateOnlyGenerated:D,responseGenerator:d,waitUntil:a.waitUntil,isMinimalMode:i});if(!O)return null;if((null==c||null==(o=c.value)?void 0:o.kind)!==f.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==c||null==(l=c.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});i||t.setHeader("x-nextjs-cache",M?"REVALIDATED":c.isMiss?"MISS":c.isStale?"STALE":"HIT"),C&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,g.fromNodeOutgoingHttpHeaders)(c.value.headers);return i&&O||m.delete(h.NEXT_CACHE_TAGS_HEADER),!c.cacheControl||t.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,y.getCacheControlHeader)(c.cacheControl)),await (0,p.sendResponse)(V,Y,new Response(c.value.body,{headers:m,status:c.value.status||200})),null};$?await l($):await j.withPropagatedContext(e.headers,()=>j.trace(c.BaseServerSpan.handleRequest,{spanName:`${L} ${v}`,kind:o.SpanKind.SERVER,attributes:{"http.method":L,"http.target":e.url}},l))}catch(t){if(t instanceof m.NoFallbackError||await T.onRequestError(e,t,{routerKind:"App Router",routePath:I,routeType:"route",revalidateReason:(0,u.getRevalidateReason)({isStaticGeneration:H,isOnDemandRevalidate:M})},!1,A),O)throw t;return await (0,p.sendResponse)(V,Y,new Response(null,{status:500})),null}}e.s(["handler",()=>O,"patchFetch",()=>I,"routeModule",()=>T,"serverHooks",()=>k,"workAsyncStorage",()=>N,"workUnitAsyncStorage",()=>P],16447)}];

//# sourceMappingURL=6fb61_next_dist_esm_build_templates_app-route_46d269fa.js.map