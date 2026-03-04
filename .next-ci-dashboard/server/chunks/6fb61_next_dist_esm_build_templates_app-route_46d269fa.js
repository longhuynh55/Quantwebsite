module.exports=[16447,e=>{"use strict";var t=e.i(41488),r=e.i(87089),a=e.i(805),n=e.i(67436),o=e.i(20109),s=e.i(89425),i=e.i(88999),l=e.i(72107),d=e.i(48207),u=e.i(54989),c=e.i(36464),p=e.i(82888),g=e.i(24554),y=e.i(28692),h=e.i(19574),m=e.i(93695);e.i(53873);var f=e.i(11565),R=e.i(63917),w=e.i(73872);let v=`You are an expert quantitative trading strategy designer for the Vietnamese stock market (HOSE). Your task is to convert natural language descriptions into structured trading strategies that can be visualized as node-based flow diagrams.

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

Return ONLY valid JSON with the strategy structure. Include a Vietnamese explanation of how the strategy works.`,b=`Your previous answer could not be parsed. Regenerate in STRICT JSON mode.

Hard constraints:
1. Return ONLY a single JSON object. No markdown. No prose before/after JSON.
2. Keep output compact and short to avoid truncation.
3. Use at most 4 nodes.
4. "nodes" and "edges" must be arrays.
5. dataSource.config.stocks must be string[] (never a string).
6. Include required keys: nodes, edges, explanation.

Schema reminder:
{
  "nodes": [
    {
      "id": "string",
      "type": "dataSource|indicator|filter|signal|output",
      "position": { "x": number, "y": number },
      "data": {
        "type": "dataSource|indicator|filter|signal|output",
        "label": "string",
        "config": {}
      }
    }
  ],
  "edges": [
    { "id": "string", "source": "string", "target": "string" }
  ],
  "explanation": "string"
}`;var S=e.i(50377);let E=(0,S.createLogger)("ai.strategy-generator");async function C(e,t={}){let r=Date.now(),a=t.requestId||("u">typeof crypto&&"function"==typeof crypto.randomUUID?crypto.randomUUID():`strategy-${Date.now()}-${Math.random().toString(36).slice(2,10)}`),n=E.child({requestId:a});n.info("strategy.generation.started",{promptLength:e.length,promptDigest:(0,S.hashText)(e)});try{let o=Math.max(1,(t.parseRepairRetries??0)+1),s="",i="",l=!1,d=null;for(let t=1;t<=o;t+=1){let u=t>1?v+"\n\n"+b+"\n\nUser request:\n"+e:v+"\n\n"+x.replace("{USER_DESCRIPTION}",e),c=[{role:"system",content:u},{role:"user",content:e}],p=await (0,w.generateWithProviderFallback)(c,{requestId:a});if(!p.success)return n.warn("strategy.generation.provider_failed",{kind:p.kind,latencyMs:p.latencyMs,attempt:t,totalAttempts:o}),{success:!1,error:p.message||"Failed to generate strategy",latencyMs:Date.now()-r};s=p.text,i=p.providerUsed;let g=function(e){try{let t=e.match(/\{[\s\S]*"nodes"[\s\S]*"edges"[\s\S]*\}/);if(!t)return null;let r=JSON.parse(t[0]);if(!Array.isArray(r.nodes)||!Array.isArray(r.edges))return null;return r}catch{try{let t=JSON.parse(e);if(!Array.isArray(t.nodes)||!Array.isArray(t.edges))return null;return t}catch{return null}}}(s);if(g){d=function(e){let t=["dataSource","indicator","filter","signal","output"],r=new Set,a=e.nodes.map((e,a)=>{let n=e.id||`node-${a}`;r.add(n);let o=t.includes(e.type)?e.type:"indicator",s=e.position||{x:50+250*a,y:100},i={type:o,label:e.data?.label||`${o} Node`,config:e.data?.config||{}};return{...e,id:n,type:o,position:s,data:i}}),n=e.edges.filter(e=>{let t=e.source,a=e.target;return r.has(t)&&r.has(a)}).map((e,t)=>({...e,id:e.id||`edge-${t}`}));return{nodes:a,edges:n,explanation:e.explanation||"Chien luoc duoc tao tu mo ta cua ban. Vui long xem cac node de hieu chi tiet.",name:e.name,strategyType:e.strategyType,riskLevel:e.riskLevel}}(g);break}l=!0,n.warn("strategy.generation.parse_failed",{responseLength:s.length,responseDigest:(0,S.hashText)(s),attempt:t,totalAttempts:o})}if(!d)return{success:!1,rawResponse:s,error:l?"Failed to parse strategy from AI response. Please try again with a clearer description.":"Failed to generate strategy.",latencyMs:Date.now()-r};let u=s;return n.info("strategy.generation.completed",{nodeCount:d.nodes.length,edgeCount:d.edges.length,explanationLength:d.explanation.length,latencyMs:Date.now()-r,providerUsed:i}),{success:!0,strategy:d,rawResponse:u,latencyMs:Date.now()-r,providerUsed:i}}catch(t){let e=t instanceof Error?t.message:String(t);return n.error("strategy.generation.exception",{error:e,latencyMs:Date.now()-r}),{success:!1,error:`An error occurred: ${e}`,latencyMs:Date.now()-r}}}var A=e.i(79678);let M=(0,S.createLogger)("api.ai.generate-strategy"),N=Number.parseInt(process.env.STRATEGY_PARSE_REPAIR_RETRIES??"1",10)||1;async function T(e){let t=Date.now(),r="u">typeof crypto&&"function"==typeof crypto.randomUUID?crypto.randomUUID():`strategy-req-${Date.now()}-${Math.random().toString(36).slice(2,10)}`,a=M.child({requestId:r});try{let t,n=(0,A.getClientIdentifier)(e),o=(0,A.createRateLimitKey)("strategy-generation",n),s=(0,A.checkRateLimit)(o,10,6e4);if(!s.allowed)return a.warn("rate_limit.blocked",{remaining:s.remaining,resetInMs:Math.max(0,s.resetTime-Date.now())}),R.NextResponse.json({success:!1,error:"Too many requests. Please wait a moment before generating another strategy.",requestId:r},{status:429});try{t=await e.json()}catch{return a.warn("request.invalid_json"),R.NextResponse.json({success:!1,error:"Invalid JSON payload.",requestId:r},{status:400})}let i=(t.prompt||"").trim();if(!i)return a.warn("request.empty_prompt"),R.NextResponse.json({success:!1,error:"Prompt is required. Please describe the strategy you want to create.",requestId:r},{status:400});if(i.length>2e3)return a.warn("request.prompt_too_long",{promptLength:i.length,maxLength:2e3}),R.NextResponse.json({success:!1,error:"Prompt is too long. Maximum 2000 characters allowed.",requestId:r},{status:400});a.info("request.received",{promptLength:i.length,clientRequestId:t.requestId||null});let l=await C(i,{requestId:t.requestId||r,parseRepairRetries:Math.max(0,N)});if(!l.success)return a.warn("generation.failed",{error:l.error,latencyMs:l.latencyMs}),R.NextResponse.json({success:!1,error:l.error||"Failed to generate strategy. Please try again.",rawResponse:l.rawResponse,latencyMs:l.latencyMs,requestId:r},{status:500});return a.info("generation.completed",{nodeCount:l.strategy?.nodes.length||0,edgeCount:l.strategy?.edges.length||0,latencyMs:l.latencyMs,providerUsed:l.providerUsed}),R.NextResponse.json({success:!0,strategy:l.strategy,latencyMs:l.latencyMs,providerUsed:l.providerUsed,requestId:r})}catch(e){return a.error("request.exception",{...(0,S.toErrorMeta)(e),latencyMs:Date.now()-t}),R.NextResponse.json({success:!1,error:"An unexpected error occurred. Please try again.",requestId:r},{status:500})}}e.s(["POST",()=>T],33338);var D=e.i(33338);let P=new t.AppRouteRouteModule({definition:{kind:r.RouteKind.APP_ROUTE,page:"/api/ai/generate-strategy/route",pathname:"/api/ai/generate-strategy",filename:"route",bundlePath:""},distDir:".next-ci-dashboard",relativeProjectDir:"",resolvedPagePath:"[project]/src/app/api/ai/generate-strategy/route.ts",nextConfigOutput:"",userland:D}),{workAsyncStorage:k,workUnitAsyncStorage:I,serverHooks:O}=P;function _(){return(0,a.patchFetch)({workAsyncStorage:k,workUnitAsyncStorage:I})}async function U(e,t,a){P.isDev&&(0,n.addRequestMeta)(e,"devRequestTimingInternalsEnd",process.hrtime.bigint());let R="/api/ai/generate-strategy/route";R=R.replace(/\/index$/,"")||"/";let w=await P.prepare(e,t,{srcPage:R,multiZoneDraftMode:!1});if(!w)return t.statusCode=400,t.end("Bad Request"),null==a.waitUntil||a.waitUntil.call(a,Promise.resolve()),null;let{buildId:v,params:x,nextConfig:b,parsedUrl:S,isDraftMode:E,prerenderManifest:C,routerServerContext:A,isOnDemandRevalidate:M,revalidateOnlyGenerated:N,resolvedPathname:T,clientReferenceManifest:D,serverActionsManifest:k}=w,I=(0,i.normalizeAppPath)(R),O=!!(C.dynamicRoutes[I]||C.routes[T]),_=async()=>((null==A?void 0:A.render404)?await A.render404(e,t,S,!1):t.end("This page could not be found"),null);if(O&&!E){let e=!!C.routes[T],t=C.dynamicRoutes[I];if(t&&!1===t.fallback&&!e){if(b.experimental.adapterPath)return await _();throw new m.NoFallbackError}}let U=null;!O||P.isDev||E||(U="/index"===(U=T)?"/":U);let q=!0===P.isDev||!O,H=O&&!q;k&&D&&(0,s.setManifestsSingleton)({page:R,clientReferenceManifest:D,serverActionsManifest:k});let L=e.method||"GET",j=(0,o.getTracer)(),$=j.getActiveScopeSpan(),F={params:x,prerenderManifest:C,renderOpts:{experimental:{authInterrupts:!!b.experimental.authInterrupts},cacheComponents:!!b.cacheComponents,supportsDynamicResponse:q,incrementalCache:(0,n.getRequestMeta)(e,"incrementalCache"),cacheLifeProfiles:b.cacheLife,waitUntil:a.waitUntil,onClose:e=>{t.on("close",e)},onAfterTaskError:void 0,onInstrumentationRequestError:(t,r,a,n)=>P.onRequestError(e,t,a,n,A)},sharedContext:{buildId:v}},Y=new l.NodeNextRequest(e),V=new l.NodeNextResponse(t),K=d.NextRequestAdapter.fromNodeNextRequest(Y,(0,d.signalFromNodeResponse)(t));try{let s=async e=>P.handle(K,F).finally(()=>{if(!e)return;e.setAttributes({"http.status_code":t.statusCode,"next.rsc":!1});let r=j.getRootSpanAttributes();if(!r)return;if(r.get("next.span_type")!==u.BaseServerSpan.handleRequest)return void console.warn(`Unexpected root span type '${r.get("next.span_type")}'. Please report this Next.js issue https://github.com/vercel/next.js`);let a=r.get("next.route");if(a){let t=`${L} ${a}`;e.setAttributes({"next.route":a,"http.route":a,"next.span_name":t}),e.updateName(t)}else e.updateName(`${L} ${R}`)}),i=!!(0,n.getRequestMeta)(e,"minimalMode"),l=async n=>{var o,l;let d=async({previousCacheEntry:r})=>{try{if(!i&&M&&N&&!r)return t.statusCode=404,t.setHeader("x-nextjs-cache","REVALIDATED"),t.end("This page could not be found"),null;let o=await s(n);e.fetchMetrics=F.renderOpts.fetchMetrics;let l=F.renderOpts.pendingWaitUntil;l&&a.waitUntil&&(a.waitUntil(l),l=void 0);let d=F.renderOpts.collectedTags;if(!O)return await (0,p.sendResponse)(Y,V,o,F.renderOpts.pendingWaitUntil),null;{let e=await o.blob(),t=(0,g.toNodeOutgoingHttpHeaders)(o.headers);d&&(t[h.NEXT_CACHE_TAGS_HEADER]=d),!t["content-type"]&&e.type&&(t["content-type"]=e.type);let r=void 0!==F.renderOpts.collectedRevalidate&&!(F.renderOpts.collectedRevalidate>=h.INFINITE_CACHE)&&F.renderOpts.collectedRevalidate,a=void 0===F.renderOpts.collectedExpire||F.renderOpts.collectedExpire>=h.INFINITE_CACHE?void 0:F.renderOpts.collectedExpire;return{value:{kind:f.CachedRouteKind.APP_ROUTE,status:o.status,body:Buffer.from(await e.arrayBuffer()),headers:t},cacheControl:{revalidate:r,expire:a}}}}catch(t){throw(null==r?void 0:r.isStale)&&await P.onRequestError(e,t,{routerKind:"App Router",routePath:R,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:H,isOnDemandRevalidate:M})},!1,A),t}},u=await P.handleResponse({req:e,nextConfig:b,cacheKey:U,routeKind:r.RouteKind.APP_ROUTE,isFallback:!1,prerenderManifest:C,isRoutePPREnabled:!1,isOnDemandRevalidate:M,revalidateOnlyGenerated:N,responseGenerator:d,waitUntil:a.waitUntil,isMinimalMode:i});if(!O)return null;if((null==u||null==(o=u.value)?void 0:o.kind)!==f.CachedRouteKind.APP_ROUTE)throw Object.defineProperty(Error(`Invariant: app-route received invalid cache entry ${null==u||null==(l=u.value)?void 0:l.kind}`),"__NEXT_ERROR_CODE",{value:"E701",enumerable:!1,configurable:!0});i||t.setHeader("x-nextjs-cache",M?"REVALIDATED":u.isMiss?"MISS":u.isStale?"STALE":"HIT"),E&&t.setHeader("Cache-Control","private, no-cache, no-store, max-age=0, must-revalidate");let m=(0,g.fromNodeOutgoingHttpHeaders)(u.value.headers);return i&&O||m.delete(h.NEXT_CACHE_TAGS_HEADER),!u.cacheControl||t.getHeader("Cache-Control")||m.get("Cache-Control")||m.set("Cache-Control",(0,y.getCacheControlHeader)(u.cacheControl)),await (0,p.sendResponse)(Y,V,new Response(u.value.body,{headers:m,status:u.value.status||200})),null};$?await l($):await j.withPropagatedContext(e.headers,()=>j.trace(u.BaseServerSpan.handleRequest,{spanName:`${L} ${R}`,kind:o.SpanKind.SERVER,attributes:{"http.method":L,"http.target":e.url}},l))}catch(t){if(t instanceof m.NoFallbackError||await P.onRequestError(e,t,{routerKind:"App Router",routePath:I,routeType:"route",revalidateReason:(0,c.getRevalidateReason)({isStaticGeneration:H,isOnDemandRevalidate:M})},!1,A),O)throw t;return await (0,p.sendResponse)(Y,V,new Response(null,{status:500})),null}}e.s(["handler",()=>U,"patchFetch",()=>_,"routeModule",()=>P,"serverHooks",()=>O,"workAsyncStorage",()=>k,"workUnitAsyncStorage",()=>I],16447)}];

//# sourceMappingURL=6fb61_next_dist_esm_build_templates_app-route_46d269fa.js.map