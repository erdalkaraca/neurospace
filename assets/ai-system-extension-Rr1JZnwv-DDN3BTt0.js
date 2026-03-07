import{s as we,B as ct,C as x,h as U,J as I,K as Ot,M as te,k as N,N as Qe,O as zt,o as z,A as S,P as Dt,q as C,Q as qt,l as u,v as Xe,y as qe,r as Nt,z as Ut,w as Lt,R as W,U as A,G as Bt,E as ce,L as pt,t as Z,V as Gt,a as jt,H as Ht,x as Ft,f as dt,u as D}from"./main-CJ4SEVVU.js";const Wt="events/aiservice/streamStarted",Vt="events/aiservice/streamChunk",ht="events/aiservice/streamComplete",_e="events/aiservice/streamError",Ne="events/aiservice/aiConfigChanged",Kt="events/aiservice/agentWorkflowStarted",Zt="events/aiservice/agentWorkflowComplete",Jt="events/aiservice/agentWorkflowError",ut="aiservice.agents",ve="aiservice.chatProviders",gt="aiservice.promptEnhancers",M="aiConfig",Yt="appsupport",Qt={defaultProvider:"openai",providers:[],requireToolApproval:!0},Xt=10;class ft{constructor(){this.decoder=new TextDecoder,this.usage=null}async*readLines(e){let t="";this.usage=null;try{for(;;){const{done:s,value:r}=await e.read();if(s)break;t+=this.decoder.decode(r,{stream:!0});const n=t.split(`
`);t=n.pop()||"";for(const i of n)i.trim()&&(yield*this.processLine(i))}t.trim()&&(yield*this.processLine(t)),yield this.makeDoneChunk()}finally{e.releaseLock()}}makeDoneChunk(){const e={type:"done",content:""};return this.usage&&(e.metadata={usage:this.usage}),e}}class es extends ft{async*parse(e){yield*this.readLines(e)}async*processLine(e){if(!e.startsWith("data: "))return;const t=e.slice(6).trim();if(t==="[DONE]"){yield this.makeDoneChunk();return}try{const s=JSON.parse(t);if(s.error){yield{type:"error",content:s.error.message||"Unknown error",metadata:s.error};return}this.extractUsage(s);const r=this.parseChunk(s);r&&(yield r)}catch{}}extractUsage(e){if(!e.usage)return;const t=e.usage;this.usage={promptTokens:t.prompt_tokens||0,completionTokens:t.completion_tokens||0,totalTokens:t.total_tokens||0,estimated:!1}}parseChunk(e){const t=e.choices?.[0]?.delta,s=e.choices?.[0];if(t?.content)return{type:"token",content:t.content,message:{role:t.role||"assistant",content:s?.message?.content||t.content}};if(s?.message?.tool_calls){const r=this.parseToolCalls(s.message.tool_calls,!0);if(r.length>0)return{type:"token",content:"",toolCalls:r}}else if(t?.tool_calls||s?.delta?.tool_calls){const r=this.parseToolCalls(t?.tool_calls||s?.delta?.tool_calls||[],!1);if(r.length>0)return{type:"token",content:"",toolCalls:r}}return null}parseToolCalls(e,t){return e.filter(s=>s.function!==void 0).map((s,r)=>({id:s.id||`call_${s.index!==void 0?s.index:r}_${Date.now()}`,type:"function",function:{name:s.function?.name||"",arguments:s.function?.arguments||(t?"{}":"")},_index:s.index!==void 0?s.index:r}))}}class ts extends ft{async*parse(e){yield*this.readLines(e)}async*processLine(e){try{const t=JSON.parse(e);if(t.error){yield{type:"error",content:t.error,metadata:t};return}if(t.done){this.extractUsage(t),yield this.makeDoneChunk();return}const s=this.parseToken(t);s&&(yield s)}catch{}}extractUsage(e){if(e.prompt_eval_count===void 0&&e.eval_count===void 0)return;const t=e.prompt_eval_count||0,s=e.eval_count||0;this.usage={promptTokens:t,completionTokens:s,totalTokens:t+s,estimated:!1}}parseToken(e){return e.message?.content?{type:"token",content:e.message.content,message:{role:e.message.role||"assistant",content:e.message.content}}:e.response?{type:"token",content:e.response,message:{role:"assistant",content:e.response}}:null}}async function Ue(a,e,t){let s="";const r=t.getProvider(e);for await(const n of r.stream({model:e.model,messages:a,chatConfig:e}))n.type==="token"&&(s+=n.content);return s}function ss(a){if(!a)return null;if(a.includes("/v1/chat/completions"))return a.replace("/v1/chat/completions","");if(a.includes("/api/v1/chat/completions"))return a.replace("/api/v1/chat/completions","");if(a.includes("/api/chat/completion"))return a.replace("/api/chat/completion","");try{const e=new URL(a);return`${e.protocol}//${e.host}`}catch{return null}}class mt{createParser(e,t){return e.includes("text/event-stream")||t.includes("openai")?new es:new ts}async getAvailableModels(e){if(!e.chatApiEndpoint)return[];const t=ss(e.chatApiEndpoint);if(!t)return[];try{const s={"Content-Type":"application/json"};e.apiKey&&(s.Authorization=`Bearer ${e.apiKey}`);const r=await fetch(`${t}/v1/models`,{method:"GET",headers:s});return r.ok?((await r.json()).data||[]).map(i=>({id:i.id,name:i.name||i.id})):[]}catch{return[]}}async*stream(e){const t={model:e.model,stream:!0,messages:e.messages,...e.chatConfig.parameters};e.tools&&e.tools.length>0&&(t.tools=e.tools,t.tool_choice="auto");const s=await fetch(e.chatConfig.chatApiEndpoint,{method:"POST",headers:{Authorization:`Bearer ${e.chatConfig.apiKey}`,"Content-Type":"application/json",Accept:"text/event-stream"},body:JSON.stringify(t),signal:e.signal});if(!s.ok){const o=await s.text().catch(()=>"Unknown error");yield{type:"error",content:`HTTP ${s.status}: ${o}`,metadata:{status:s.status}};return}if(!s.body){yield{type:"error",content:"Response body is null or empty",metadata:{status:s.status}};return}const r=s.body.getReader();if(!r){yield{type:"error",content:"Response body is not readable"};return}const n=s.headers.get("content-type")||"",i=this.createParser(n,e.chatConfig.chatApiEndpoint);try{for await(const o of i.parse(r))yield o}catch(o){yield{type:"error",content:o instanceof Error?o.message:"Failed to parse response stream",metadata:{error:o,contentType:n}}}}}class rs extends mt{constructor(){super(...arguments),this.name="openai"}canHandle(e){return e.chatApiEndpoint.includes("openai")||e.chatApiEndpoint.includes("v1/chat/completions")}}class as extends mt{constructor(){super(...arguments),this.name="ollama"}canHandle(e){return e.name.toLowerCase()==="ollama"||e.chatApiEndpoint.includes("ollama")||e.chatApiEndpoint.includes("localhost:11434")}}class pe{constructor(){this.providers=[],this.providers.push(new rs),this.providers.push(new as)}registerProvider(e){this.providers.push(e)}getProvider(e){return this.providers.find(t=>t.canHandle(e))??this.providers[0]}getAllProviders(){return[...this.providers]}}class ns{getAgentContributions(){return U.getContributions(ut)}filterAndSortAgents(e,t){return e.filter(s=>!s.canHandle||s.canHandle(t)).sort((s,r)=>(r.priority||0)-(s.priority||0))}getMatchingAgents(e,t){const s=this.getAgentContributions();if(s.length===0)throw new Error("No agents are registered. The App Support agent should be available from the AI system extension.");const r=t?.length?s.filter(i=>t.includes(i.role)):s,n=this.filterAndSortAgents(r,e);if(t?.length&&n.length===0)throw new Error(`No agents found for requested roles: ${t.join(", ")}. Available: ${s.map(i=>i.role).join(", ")}`);if(!t?.length&&n.length===0)throw new Error(`No agents can handle the current context. Available: ${s.map(i=>i.role).join(", ")}`);return n}}function is(a){const e={role:a.role,content:a.content};return"tool_call_id"in a&&a.tool_call_id&&(e.tool_call_id=a.tool_call_id),"tool_calls"in a&&a.tool_calls&&(e.tool_calls=a.tool_calls),e}function wt(a){return a.map(is)}const os=zt("ToolDetector"),ls=["hello","hi","hey","thanks","thank you","bye","goodbye"],cs=["create","open","delete","read","write","edit","save","rename","move","copy","list","show","display","run","execute","build","add","remove","update","modify","change","set","get","find","search","filter","sort","install","uninstall","load","import","export","generate","make","do","perform","call","invoke"],ps=["file","folder","directory","workspace","editor","map","layer","command","tool","extension","script","code","project"];class ds{needsTools(e){if(!e?.trim())return!1;const t=e.toLowerCase().trim();if(ls.some(i=>t===i||t.startsWith(i+" ")))return!1;const s=cs.some(i=>e.includes(i)),r=ps.some(i=>e.includes(i)),n=s&&(r||e.length>20);return n&&os.info("Heuristic: needsTools=true (action+context or long prompt)"),n}dispose(){}}const hs=new ds;class us{constructor(e){this.toolRegistry=e,this.enhancers=[]}addEnhancer(e){this.enhancers.push(e)}async getSysPrompt(e,t){let s=e.sysPrompt;if(typeof s=="function"&&(s=s()),!s||typeof s!="string")throw new Error(`Agent "${e.role}" is missing a system prompt.`);const r=[...e.promptEnhancers||[],...this.enhancers,...this.getContributedEnhancers()].sort((i,o)=>(o.priority||0)-(i.priority||0));let n=s;for(const i of r)try{const o=await i.enhance(n,t);o&&typeof o=="string"&&(n=o)}catch(o){console.warn("[PromptBuilder] Enhancer failed:",o)}return n}rewriteChatHistoryForAgent(e,t){return e.map(s=>s.role==="user"?{role:s.role,content:s.content}:s.role===t?{role:"assistant",content:s.content}:{role:"user",content:`***Agent '${s.role}' replied:***
${s.content}`})}getContributedEnhancers(){return U.getContributions(gt).map(t=>({...t.enhancer,priority:t.priority??t.enhancer.priority}))}async build(e,t,s,r){r?.beforeSend&&await r.beforeSend(t,s);const n=wt(t),i=this.rewriteChatHistoryForAgent(n,e.role);let o=e.tools;typeof o=="function"&&(o=await o());let l;if(o?.enabled)if(o.smartToolDetection){const d=t[t.length-1];hs.needsTools(d?.content||"")&&(l=this.toolRegistry.getAvailableTools(s,o.commandFilter))}else l=this.toolRegistry.getAvailableTools(s,o.commandFilter);const c=await this.getSysPrompt(e,s);return i.unshift({role:"system",content:c}),{messages:i,userPromptIndex:i.length-1,tools:l}}}class gs{constructor(){this.processors=[]}addProcessor(e){this.processors.push(e)}async process(e,t,s){const r=[...t.messageProcessors||[],...this.processors].sort((i,o)=>(o.priority||0)-(i.priority||0));let n={...e};for(const i of r)n=await i.process(n,s);return n}}class fs{constructor(){this.accumulatedToolCalls=new Map,this.toolCallIndexMap=new Map}processChunk(e){if(!(e.type!=="token"||!e.toolCalls?.length))for(const t of e.toolCalls){const s=t._index,r=t.id;let n,i;s!==void 0&&this.toolCallIndexMap.has(s)?(i=this.toolCallIndexMap.get(s),n=this.accumulatedToolCalls.get(i)):r&&this.accumulatedToolCalls.has(r)?(i=r,n=this.accumulatedToolCalls.get(i)):(i=r||`call_${s!==void 0?s:Date.now()}_${Math.random()}`,n=void 0),n?(this.accumulatedToolCalls.set(i,{id:i,type:t.type||n.type,function:{name:t.function.name||n.function.name,arguments:(n.function.arguments||"")+(t.function.arguments||"")}}),s!==void 0&&!this.toolCallIndexMap.has(s)&&this.toolCallIndexMap.set(s,i)):(this.accumulatedToolCalls.set(i,{...t,id:i}),s!==void 0&&this.toolCallIndexMap.set(s,i))}}getFinalToolCalls(){return Array.from(this.accumulatedToolCalls.values()).filter(e=>e.function.name?.trim().length>0).map(e=>({...e,function:{...e.function,arguments:e.function.arguments?.trim()||"{}"}}))}reset(){this.accumulatedToolCalls.clear(),this.toolCallIndexMap.clear()}}function be(a){return a.replace(/[^a-zA-Z0-9_-]/g,"_").replace(/^[^a-zA-Z]/,"cmd_$&").replace(/_+/g,"_").replace(/^_|_$/g,"")}class ms{findCommand(e,t){const s=e.function.name,r=N.getCommand(s);if(r)return r;const n=N.listCommands();for(const[i,o]of Object.entries(n))if(be(i)===s)return o;return null}parseArguments(e){if(!e?.trim()||e==="{}")return{};try{const t=JSON.parse(e);return t&&typeof t=="object"?t:{}}catch{return{}}}sanitizeArguments(e,t){if(!t?.parameters||!e||typeof e!="object")return e||{};const s={};return t.parameters.forEach(r=>{const n=be(r.name);n in e&&(s[r.name]=e[n])}),s}async executeToolCall(e,t){try{const s=this.findCommand(e,t),r=s?.id||e.function.name,n=this.parseArguments(e.function.arguments||"{}"),i=this.sanitizeArguments(n,s),o=N.createExecutionContext(i),l={...t,...o,params:i},c=await N.execute(r,l),h={success:!0,message:`Command "${s?.name||r}" executed successfully`,command:r};if(Object.keys(i).length>0&&(h.parameters=i),c!=null){let g=c;g instanceof Promise&&(g=await g),h.result=g,s?.output?.length&&(h.output=s.output.map(m=>`${m.name}: ${m.description||m.type||"value"}`).join(", "))}return{id:e.id,result:h}}catch(s){let r=null;try{r=this.findCommand(e,t)}catch{}const n=s instanceof Error?s.message:String(s),i=r?.name||e.function.name;let o=n;return(n.includes("No handler found")||n.includes("No handlers registered"))&&(o=`Command "${i}" cannot be executed. ${n}.`),{id:e.id,result:null,error:o}}}async executeToolCalls(e,t){const s=[];for(const r of e)s.push(await this.executeToolCall(r,t));return s}createToolCallAccumulator(){return new fs}createToolCallSignature(e){let t={};try{const r=JSON.parse(e.function.arguments||"{}");t=r&&typeof r=="object"?r:{}}catch{t={}}const s=Object.keys(t).sort().reduce((r,n)=>(r[n]=t[n],r),{});return`${e.function.name}:${JSON.stringify(s)}`}}class ws{commandToTool(e,t){const s={},r=[];return e.parameters?.forEach(n=>{const i=be(n.name);s[i]={type:n.type||"string",description:n.description,...n.allowedValues&&{enum:n.allowedValues}},n.required===!0&&r.push(i)}),{type:"function",function:{name:be(e.id),description:e.description||e.name,parameters:{type:"object",properties:s,required:r}}}}getAvailableTools(e,t){const s=N.listCommands();let r=Object.values(s);return t&&(r=r.filter(n=>t(n,e))),r.map(n=>this.commandToTool(n,e))}}class vs{async execute(e,t,s,r){const n=t.chatConfig;if(!n)throw new Error("Chat config is required");await Promise.all(e.map(async i=>{try{await r(i,t.chatContext.history,s.sharedState,n,t,s)}catch(o){const l=o instanceof Error?o:new Error(String(o));s.errors.set(i.role,l),t.onAgentError?.(i.role,l)}}))}}class vt{createAgentContextWithPreviousAgents(e,t,s){return{...e,...t.callContext.getProxy(),previousAgents:Array.from(s.messages.entries()).map(([r,n])=>({role:r,content:n.content}))}}updateWorkflowState(e,t,s,r,n){return t.push(e),s={...s,...r,message:e},n.sharedState=s,{currentMessages:t,accumulatedState:s}}}class bs extends vt{async execute(e,t,s,r){const n=t.chatConfig;if(!n)throw new Error("Chat config is required");let i=[...t.chatContext.history],o={...s.sharedState};for(const l of e)try{const c=this.createAgentContextWithPreviousAgents(o,t,s),d=await r(l,i,o,n,t,s);if(!d)break;const h=this.updateWorkflowState(d,i,o,c,s);i=h.currentMessages,o=h.accumulatedState}catch(c){const d=c instanceof Error?c:new Error(String(c));s.errors.set(l.role,d),t.onAgentError?.(l.role,d);break}}}class ys extends vt{async execute(e,t,s,r){const n=t.chatConfig;if(!n)throw new Error("Chat config is required");let i=[...t.chatContext.history],o={...s.sharedState};for(const l of e)try{const c=this.createAgentContextWithPreviousAgents(o,t,s);if(l.canHandle&&!l.canHandle(c))continue;const d=await r(l,i,o,n,t,s);if(!d)break;const h=this.updateWorkflowState(d,i,o,c,s);i=h.currentMessages,o=h.accumulatedState}catch(c){const d=c instanceof Error?c:new Error(String(c));s.errors.set(l.role,d),t.onAgentError?.(l.role,d)}}}class ks{async execute(e,t,s,r){const n=t.chatConfig;if(!n)throw new Error("Chat config is required");let i=[...t.chatContext.history];for(const o of this.buildTopoOrder(e)){await Promise.all(o.map(async l=>{try{await r(l,i,s.sharedState,n,t,s)}catch(c){const d=c instanceof Error?c:new Error(String(c));s.errors.set(l.role,d),t.onAgentError?.(l.role,d)}}));for(const l of o){const c=s.messages.get(l.role);c&&i.push(c)}}}buildTopoOrder(e){const t=[],s=new Set;for(;s.size<e.length;){const r=e.filter(n=>{if(s.has(n.role))return!1;if(!n.consumes?.length)return!0;const i=e.filter(o=>s.has(o.role)).flatMap(o=>o.produces||[]);return n.consumes.every(o=>i.includes(o))});if(r.length===0){t.push(e.filter(n=>!s.has(n.role)));break}t.push(r);for(const n of r)s.add(n.role)}return t}}function et(a,e){const t=Date.now();return{id:`plan-${t}-${Math.random().toString(36).slice(2,9)}`,originalPrompt:a,steps:e.map(s=>({...s,status:"pending",revisions:0})),status:"planning",createdAt:t,updatedAt:t}}function xs(a){const e=new Set(a.steps.filter(t=>t.status==="completed").map(t=>t.id));return a.steps.filter(t=>t.status==="pending"&&t.dependsOn.every(s=>e.has(s)))}function As(a){return a.steps.every(e=>e.status==="completed"||e.status==="skipped")}function Cs(a){return a.steps.some(e=>e.status==="failed")}const Ss=`You are a task orchestrator. Given a user's complex request, decompose it into a structured execution plan.

Respond with ONLY a JSON object matching this schema (no markdown, no explanation):
{
  "steps": [
    {
      "id": "step-1",
      "role": "<agent role>",
      "subTask": "<specific instruction for this step>",
      "dependsOn": [],
      "consumes": [],
      "produces": ["<artifact-id>"]
    }
  ]
}

Rules:
- Each step must have a unique id (step-1, step-2, ...)
- "role" must match an available agent role
- "dependsOn" lists step IDs that must complete before this step
- "consumes" and "produces" are artifact IDs
- Steps with no dependencies can run in parallel
- Keep the plan minimal — only as many steps as needed`;async function bt(a){const e=a.availableAgents.filter(r=>!r.isOrchestrator).map(r=>`- ${r.role}: ${r.description}`).join(`
`),t=[{role:"system",content:`${Ss}

Available agents:
${e}`},{role:"user",content:a.prompt}],s=await a.executeCompletion(t,a.chatConfig);try{const r=s.match(/\{[\s\S]*\}/);if(!r)throw new Error("No JSON found in orchestrator response");const n=JSON.parse(r[0]);return et(a.prompt,n.steps||[])}catch{const n=a.availableAgents.find(i=>!i.isOrchestrator);return et(a.prompt,[{id:"step-1",role:n?.role||Yt,subTask:a.prompt,dependsOn:[],consumes:[],produces:["step-1-result"]}])}}class de{constructor(e,t){this.artifacts=new Map,this.mailbox=new Map,this.taskId=e,this.plan=t}putArtifact(e){this.artifacts.set(e.id,e)}getArtifact(e){return this.artifacts.get(e)}getArtifactsByType(e){return Array.from(this.artifacts.values()).filter(t=>t.type===e)}getArtifactsProducedBy(e){return Array.from(this.artifacts.values()).filter(t=>t.producedBy===e)}postMessage(e){const t=e.to==="*"?"__broadcast__":e.to,s=this.mailbox.get(t)||[];s.push(e),this.mailbox.set(t,s)}readMessages(e){const t=this.mailbox.get(e)||[],s=this.mailbox.get("__broadcast__")||[];return[...t,...s]}clearMessages(e){this.mailbox.delete(e)}updateStepStatus(e,t,s){const r=this.plan.steps.find(n=>n.id===e);r&&(r.status=t,s&&(r.result=s,this.putArtifact(s)),this.plan.updatedAt=Date.now())}getNextRunnableSteps(){const e=new Set(this.plan.steps.filter(t=>t.status==="completed").map(t=>t.id));return this.plan.steps.filter(t=>t.status==="pending"&&t.dependsOn.every(s=>e.has(s)))}toJSON(){return{taskId:this.taskId,plan:this.plan,artifacts:Array.from(this.artifacts.values()),mailbox:Object.fromEntries(this.mailbox.entries())}}static fromJSON(e){const t=new de(e.taskId,e.plan);for(const s of e.artifacts||[])t.artifacts.set(s.id,s);for(const[s,r]of Object.entries(e.mailbox||{}))t.mailbox.set(s,r);return t}}const Pe="ai_task_checkpoint_",Ee="ai_task_checkpoint_registry";class Ts{async save(e){const t=`${Pe}${e.taskId}`;await x.set(t,e.toJSON())}async restore(e){const t=`${Pe}${e}`,s=await x.get(t);return s?de.fromJSON(s):null}async delete(e){const t=`${Pe}${e}`;await x.set(t,void 0)}async listCheckpoints(){return this.getRegistry()}async registerCheckpoint(e){const t=await this.getRegistry();t.includes(e)||(t.push(e),await x.set(Ee,t))}async unregisterCheckpoint(e){const t=await this.getRegistry();await x.set(Ee,t.filter(s=>s!==e))}async getRegistry(){return await x.get(Ee)||[]}}const ae=new Ts;class Re{constructor(e){this.executeStep=e}async run(e,t){const s=e.plan;s.status="running",await ae.save(e);const r=new Map;for(;;){if(t.signal?.aborted){s.status="paused";break}const i=xs(s);if(i.length===0)break;if(await Promise.all(i.map(async o=>{e.updateStepStatus(o.id,"running"),t.onStepStart?.(o);try{const l=await this.executeStep(o,e,t);e.updateStepStatus(o.id,"completed",l),t.onStepComplete?.(o,l),await ae.save(e)}catch(l){const c=l instanceof Error?l:new Error(String(l));e.updateStepStatus(o.id,"failed"),r.set(o.id,c),t.onStepError?.(o,c)}})),Cs(s)){s.status="failed";break}if(As(s)){s.status="completed";break}}const n=s.steps.filter(i=>i.result).map(i=>i.result);return{plan:s,artifacts:n,errors:r}}}class $s{async execute(e,t,s,r){const n=t.chatConfig;if(!n)throw new Error("Chat config is required");const i=t.chatContext.history[t.chatContext.history.length-1]?.content||"",o=new pe,l=await bt({prompt:i,availableAgents:e,chatConfig:n,context:t.callContext.getProxy(),executeCompletion:(p,f)=>Ue(p,f,o)}),c=new de(`wf-${Date.now()}`,l),d=new Map(e.map(p=>[p.role,p])),m=(await new Re(async(p,f,w)=>{const k=d.get(p.role)||e[0],$=[...t.chatContext.history,{role:"user",content:p.subTask}],K=(await r(k,$,s.sharedState,n,t,s))?.content||"";return{id:p.produces[0]||`${p.id}-result`,type:"text",content:K,producedBy:p.role,createdAt:Date.now()}}).run(c,{prompt:i,chatConfig:n,callContext:t.callContext,signal:t.signal})).artifacts.map(p=>p.content).filter(Boolean).join(`

`);m&&s.messages.set("orchestrator",{role:"assistant",content:m})}}const _s=`You are a quality reviewer. Evaluate the provided artifact against the original task.

Respond with ONLY a JSON object:
{
  "verdict": "approved" | "needs-revision",
  "score": 0-100,
  "notes": "<feedback for revision, empty if approved>"
}`;async function Ps(a){const e=[{role:"system",content:_s},{role:"user",content:`Original task: ${a.originalTask}

Artifact to review:
${a.artifact.content}`}];try{const s=(await a.executeCompletion(e,a.chatConfig)).match(/\{[\s\S]*\}/);if(!s)throw new Error("No JSON in reviewer response");const r=JSON.parse(s[0]);return{verdict:r.verdict==="approved"?"approved":"needs-revision",score:typeof r.score=="number"?r.score:50,notes:r.notes||""}}catch{return{verdict:"approved",score:70,notes:""}}}class Es{async execute(e,t,s,r){const n=t.chatConfig;if(!n)throw new Error("Chat config is required");const i=new pe,o=e[0],l=e.find(g=>g.reviewerFor?.includes(o.role)),c=o.maxRevisions??2;let d=[...t.chatContext.history],h=0;for(;h<=c;){const g=await r(o,d,s.sharedState,n,t,s);if(!g)break;if(!l){s.messages.set(o.role,g);break}const m={id:`draft-${h}`,type:"text",content:g.content,producedBy:o.role,createdAt:Date.now()},p=t.chatContext.history[t.chatContext.history.length-1]?.content||"",f=await Ps({artifact:m,originalTask:p,chatConfig:n,executeCompletion:(w,k)=>Ue(w,k,i)});if(f.verdict==="approved"||h>=c){s.messages.set(o.role,g);break}d=[...t.chatContext.history,g,{role:"user",content:`Please revise based on this feedback: ${f.notes}`}],h++}}}class Ms{constructor(){this.strategies=new Map([["parallel",new vs],["sequential",new bs],["conditional",new ys],["pipeline",new ks],["orchestrated",new $s],["review",new Es]])}registerStrategy(e,t){this.strategies.set(e,t)}async execute(e,t,s){const r=`workflow-${Date.now()}-${Math.random()}`,n=t.execution||"parallel",i={messages:new Map,sharedState:{...t.sharedState||{}},errors:new Map};I(Kt,{workflowId:r,options:t});try{const o=this.strategies.get(n);if(!o)throw new Error(`Unknown workflow execution strategy: ${n}`);return await o.execute(e,t,i,s),I(Zt,{workflowId:r,results:i}),i}catch(o){const l=o instanceof Error?o:new Error(String(o));throw I(Jt,{workflowId:r,error:l}),l}}}const he=class{static estimateTokens(e){if(!e?.trim())return 0;const t=e.trim();return Math.max(1,Math.ceil(t.length/this.AVERAGE_CHARS_PER_TOKEN+t.split(/\s+/).filter(s=>s.length>0).length*.3))}static estimateMessageTokens(e){let t=this.MESSAGE_OVERHEAD;if(e.content&&(t+=this.estimateTokens(e.content)),e.role&&(t+=this.estimateTokens(e.role)),e.tool_calls)for(const s of e.tool_calls)t+=this.estimateTokens(s.function.name||"")+this.estimateTokens(s.function.arguments||"{}")+this.TOOL_CALL_OVERHEAD;return e.tool_call_id&&(t+=this.estimateTokens(e.tool_call_id)),t}static estimatePromptTokens(e,t){let s=e.reduce((r,n)=>r+this.estimateMessageTokens(n),0);if(t?.length)for(const r of t)s+=this.TOOL_DEFINITION_OVERHEAD,s+=this.estimateTokens(r.function.name||""),s+=this.estimateTokens(r.function.description||""),r.function.parameters&&(s+=this.estimateTokens(JSON.stringify(r.function.parameters)));return s}static estimateCompletionTokens(e,t){let s=this.estimateTokens(e);if(t?.length)for(const r of t)s+=this.TOOL_CALL_OVERHEAD+this.estimateTokens(r.function?.name||"")+this.estimateTokens(r.function?.arguments||"{}");return s}};he.AVERAGE_CHARS_PER_TOKEN=4;he.TOOL_DEFINITION_OVERHEAD=50;he.TOOL_CALL_OVERHEAD=10;he.MESSAGE_OVERHEAD=4;let tt=he;const st="ai_token_usage",J={promptTokens:0,completionTokens:0,totalTokens:0,requestCount:0};class Rs{constructor(){this.data=null,this.loadPromise=null}async loadData(){return this.data?this.data:this.loadPromise?this.loadPromise:(this.loadPromise=(async()=>{const e=await Qe.getObject(st);return this.data=e||{providers:{},total:{...J},lastUpdated:Date.now()},this.data||(this.data={providers:{},total:{...J},lastUpdated:Date.now()},await this.saveData()),this.loadPromise=null,this.data})(),this.loadPromise)}async saveData(){this.data&&(this.data.lastUpdated=Date.now(),await Qe.persistObject(st,this.data))}async recordUsage(e,t){if(await this.loadData(),!this.data)return;this.data.providers[e]??={...J};const s=this.data.providers[e];s.promptTokens+=t.promptTokens,s.completionTokens+=t.completionTokens,s.totalTokens+=t.totalTokens,s.requestCount+=1,this.data.total.promptTokens+=t.promptTokens,this.data.total.completionTokens+=t.completionTokens,this.data.total.totalTokens+=t.totalTokens,this.data.total.requestCount+=1,await this.saveData()}async getProviderUsage(e){return await this.loadData(),this.data?.providers[e]||null}async getAllProviderUsage(){return await this.loadData(),this.data?.providers||{}}async getTotalUsage(){return await this.loadData(),this.data?.total||{...J}}async reset(){this.data={providers:{},total:{...J},lastUpdated:Date.now()},await this.saveData()}async resetProvider(e){if(await this.loadData(),!this.data)return;const t=this.data.providers[e];t&&(this.data.total.promptTokens-=t.promptTokens,this.data.total.completionTokens-=t.completionTokens,this.data.total.totalTokens-=t.totalTokens,this.data.total.requestCount-=t.requestCount,delete this.data.providers[e],await this.saveData())}}const me=new Rs;class Is{constructor(){this.activeRequests=new Map,this.activeTasks=new Map,this.toolRegistry=new ws,this.providerFactory=new pe,this.agentRegistry=new ns,this._promptBuilder=new us(this.toolRegistry),this.messageProcessor=new gs,this.toolExecutor=new ms,this.workflowEngine=new Ms,we(ct,()=>{this.aiConfig=void 0,this.configCheckPromise=void 0,this.checkAIConfig().then()}),this.checkAIConfig().then()}get promptBuilder(){return this._promptBuilder}getAgentContributions(){return this.agentRegistry.getAgentContributions()}async getProviders(){return await this.checkAIConfig(),this.aiConfig?.providers||[]}async getDefaultProvider(){await this.checkAIConfig();const e=await this.getProviders();if(this.aiConfig?.defaultProvider){const t=e.find(s=>s.name===this.aiConfig?.defaultProvider);if(t)return t}return e[0]}async setDefaultProvider(e){return await this.checkAIConfig(),this.aiConfig&&(this.aiConfig.defaultProvider=e,await x.set(M,this.aiConfig)),this.getDefaultProvider()}createMessage(e){return{role:"user",content:e}}registerStreamingFetcher(e){this.providerFactory.registerProvider(e)}getContributedProviders(){return U.getContributions(ve).map(t=>t.provider)}mergeProviders(e,t){const s=new Set(e.map(n=>n.name)),r=t.filter(n=>!s.has(n.name));return r.length>0?[...e,...r]:e}async createInitialConfig(){const e={...Qt,providers:this.getContributedProviders()};return await x.set(M,e),x.get(M)}async updateConfigWithMissingProviders(e){const t=this.mergeProviders(e.providers,this.getContributedProviders());if(t.length===e.providers.length)return e;const s={...e,providers:t};return await x.set(M,s),s}async checkAIConfig(){if(!this.aiConfig)return this.configCheckPromise?this.configCheckPromise:(this.configCheckPromise=this.performConfigCheck(),this.configCheckPromise)}async performConfigCheck(){try{this.aiConfig=await x.get(M),this.aiConfig=this.aiConfig?await this.updateConfigWithMissingProviders(this.aiConfig):await this.createInitialConfig(),I(Ne,this.aiConfig)}finally{this.configCheckPromise=void 0}}createAgentContext(e,t,s={}){return{...e,...t.getProxy(),...s}}async*streamCompletion(e){const t=`${Date.now()}-${Math.random()}`,s=new AbortController;this.activeRequests.set(t,s),e.signal&&e.signal.addEventListener("abort",()=>s.abort());const r=e.signal||s.signal;try{e.onStatus?.("starting"),I(Wt,{requestId:t,options:e});const n=e.chatConfig||await this.getDefaultProvider(),i=wt(e.chatContext.history),o=this.providerFactory.getProvider(n),l=this.toolExecutor.createToolCallAccumulator();let c="",d="assistant",h;for await(const p of o.stream({model:n.model,messages:i,chatConfig:n,tools:e.tools,signal:r})){if(p.type==="error"){e.onStatus?.("error"),I(_e,{requestId:t,chunk:p}),yield p;break}if(p.type==="token")l.processChunk(p),p.toolCalls?.length||(c+=p.content),p.message?.role&&(d=p.message.role),p.content&&e.onToken?.(p.content),e.onStatus?.("streaming"),e.onProgress?.({received:c.length}),I(Vt,{requestId:t,chunk:p}),yield p;else if(p.type==="done"){p.metadata?.usage&&(h=p.metadata.usage),e.onStatus?.("complete"),I(ht,{requestId:t}),yield p;break}else yield p}const g=l.getFinalToolCalls(),m={role:d,content:c,...g.length>0&&{toolCalls:g}};if(!h){const p=tt.estimatePromptTokens(i,e.tools),f=tt.estimateCompletionTokens(c,g);h={promptTokens:p,completionTokens:f,totalTokens:p+f,estimated:!0}}return me.recordUsage(n.name,h).catch(p=>{Ot.error(`Failed to record token usage: ${p instanceof Error?p.message:String(p)}`)}),{message:m,tokenUsage:h}}catch(n){if(n instanceof Error&&n.name==="AbortError")throw e.onStatus?.("error"),I(_e,{requestId:t,error:"Request cancelled"}),n;e.onStatus?.("error");const i=n instanceof Error?n.message:String(n);throw I(_e,{requestId:t,error:i}),yield{type:"error",content:i,metadata:{error:n}},n}finally{this.activeRequests.delete(t)}}async handleStreamingPromptDirect(e){const t=this.streamCompletion(e);let s;for(;;){if(s=await t.next(),s.done)return s.value.message;const r=s.value;if(r.type==="error")throw new Error(r.content);if(r.type==="done"){const n=await t.next();if(n.done&&n.value)return n.value.message;if(!n.done)continue;throw new Error("Stream completed without return value")}}}async handleStreamingPrompt(e){const t=e.callContext||te.createChild({}),s=this.createAgentContext({},t,{userPrompt:e.chatContext.history[e.chatContext.history.length-1]?.content||""}),r=this.agentRegistry.getMatchingAgents(s),n=r.length>0?r.map(l=>l.role):["assistant"],i=await this.executeAgentWorkflow({chatContext:e.chatContext,chatConfig:e.chatConfig,callContext:t,execution:"parallel",stream:e.stream,signal:e.signal,onToken:(l,c)=>e.onToken?.(c),onStatus:(l,c)=>e.onStatus?.(c),roles:n}),o=Array.from(i.messages.values());return o.length===1?o[0]:o}cancelRequest(e){const t=this.activeRequests.get(e);return t?(t.abort(),this.activeRequests.delete(e),!0):!1}async executeAgentWorkflow(e){const t=this.createAgentContext(e.sharedState||{},e.callContext),s=this.agentRegistry.getMatchingAgents(t,e.roles);return this.workflowEngine.execute(s,e,(r,n,i,o,l,c)=>this.executeAgent(r,n,i,o,l,c))}async executeAgent(e,t,s,r,n,i){n.onAgentStart?.(e.role);const o=this.createAgentContext(s,n.callContext,{userPrompt:t[t.length-1]?.content||""}),{messages:l,tools:c}=await this._promptBuilder.build(e,t,o,e.hooks),d=l.map(w=>{const k={role:w.role,content:w.content};return w.tool_call_id&&(k.tool_call_id=w.tool_call_id),w.tool_calls&&(k.tool_calls=w.tool_calls),k});let h=await this.handleStreamingPromptDirect({chatContext:{history:d},chatConfig:r,callContext:n.callContext,stream:n.stream??!0,signal:n.signal,onToken:n.onToken?w=>n.onToken(e.role,w):void 0,tools:c}),g=0;const m=[...l];for(;h.toolCalls&&h.toolCalls.length>0;){if(g++,g>Xt){console.warn("[AIService] Max tool call iterations reached");break}let w;if(n.requireToolApproval&&n.onToolApprovalRequest){const y=h.toolCalls.map(L=>{let B={};try{B=JSON.parse(L.function.arguments||"{}")}catch{}return`${L.function.name}(${Object.entries(B).map(([Rt,It])=>`${Rt}=${It}`).join(", ")})`}).join(", "),K={toolCalls:h.toolCalls,message:`The AI wants to execute: ${y}`};await n.onToolApprovalRequest(e.role,K)?w=await this.toolExecutor.executeToolCalls(h.toolCalls,o):w=h.toolCalls.map(L=>({id:L.id,result:{success:!1,message:"Tool execution cancelled by user",cancelled:!0}}))}else w=await this.toolExecutor.executeToolCalls(h.toolCalls,o);const k=w.map(y=>({role:"tool",content:y.error?JSON.stringify({error:y.error}):JSON.stringify(y.result),tool_call_id:y.id})),$={role:"assistant",content:h.content||""};if(h.toolCalls?.length&&($.tool_calls=h.toolCalls.filter(y=>y.function.name?.trim()).map(y=>({id:y.id,type:y.type,function:{name:y.function.name,arguments:y.function.arguments||"{}"}}))),m.push($,...k),h=await this.handleStreamingPromptDirect({chatContext:{history:m.map(y=>({role:y.role,content:y.content,...y.tool_call_id&&{tool_call_id:y.tool_call_id},...y.tool_calls&&{tool_calls:y.tool_calls}}))},chatConfig:r,callContext:n.callContext,stream:n.stream??!0,signal:n.signal,tools:c}),h.content?.trim()&&!h.toolCalls?.length)break}const p=await this.messageProcessor.process(h,e,this.createAgentContext(s,n.callContext,{message:h}));e.hooks?.afterReceive&&await e.hooks.afterReceive(p,this.createAgentContext(s,n.callContext));const f={role:e.role,content:p.content};return i.messages.set(e.role,f),n.onAgentComplete?.(e.role,f),f}async planTask(e,t){const s=await this.getDefaultProvider(),r=this.agentRegistry.getAgentContributions();return te.createChild({}),bt({prompt:e,availableAgents:r,chatConfig:s,context:t,executeCompletion:(n,i)=>Ue(n,i,this.providerFactory)})}async executeTask(e){const t=e.chatConfig||await this.getDefaultProvider(),s=e.callContext||te.createChild({}),r=this.agentRegistry.getAgentContributions(),n=await this.planTask(e.prompt,s.getProxy());e.onPlanReady?.(n);const i=new de(`task-${Date.now()}`,n);await ae.registerCheckpoint(i.taskId);const o=new AbortController;this.activeTasks.set(i.taskId,o);const l={...e,signal:e.signal??o.signal},c=new Map(r.map(h=>[h.role,h])),d=new Re(this.createStepExecutor(c,r,t,s,l));try{const h=await d.run(i,l);return await ae.unregisterCheckpoint(i.taskId),h}finally{this.activeTasks.delete(i.taskId)}}async resumeTask(e,t){const s=await ae.restore(e);if(!s)throw new Error(`No checkpoint found for task ${e}`);const r=t.chatConfig||await this.getDefaultProvider(),n=t.callContext||te.createChild({}),i=this.agentRegistry.getAgentContributions(),o=new Map(i.map(c=>[c.role,c]));return new Re(this.createStepExecutor(o,i,r,n,t)).run(s,t)}createStepExecutor(e,t,s,r,n){return async(i,o,l)=>{const c=e.get(i.role)||t[0],d=[...n.chatContext?.history||[],{role:"user",content:i.subTask}],g=(await this.workflowEngine.execute([c],{chatContext:{history:d},chatConfig:s,callContext:r,execution:"parallel",stream:!0,signal:n.signal,roles:[c.role]},(m,p,f,w,k,$)=>this.executeAgent(m,p,f,w,k,$))).messages.get(c.role);return{id:i.produces[0]||`${i.id}-result`,type:"text",content:g?.content||"",producedBy:i.role,createdAt:Date.now()}}}cancelTask(e){const t=this.activeTasks.get(e);t&&(t.abort(),this.activeTasks.delete(e))}}const se=new Is;function Le(){return{async:!1,breaks:!1,extensions:null,gfm:!0,hooks:null,pedantic:!1,renderer:null,silent:!1,tokenizer:null,walkTokens:null}}var V=Le();function yt(a){V=a}var ne={exec:()=>null};function v(a,e=""){let t=typeof a=="string"?a:a.source,s={replace:(r,n)=>{let i=typeof n=="string"?n:n.source;return i=i.replace(T.caret,"$1"),t=t.replace(r,i),s},getRegex:()=>new RegExp(t,e)};return s}var Os=(()=>{try{return!!new RegExp("(?<=1)(?<!1)")}catch{return!1}})(),T={codeRemoveIndent:/^(?: {1,4}| {0,3}\t)/gm,outputLinkReplace:/\\([\[\]])/g,indentCodeCompensation:/^(\s+)(?:```)/,beginningSpace:/^\s+/,endingHash:/#$/,startingSpaceChar:/^ /,endingSpaceChar:/ $/,nonSpaceChar:/[^ ]/,newLineCharGlobal:/\n/g,tabCharGlobal:/\t/g,multipleSpaceGlobal:/\s+/g,blankLine:/^[ \t]*$/,doubleBlankLine:/\n[ \t]*\n[ \t]*$/,blockquoteStart:/^ {0,3}>/,blockquoteSetextReplace:/\n {0,3}((?:=+|-+) *)(?=\n|$)/g,blockquoteSetextReplace2:/^ {0,3}>[ \t]?/gm,listReplaceTabs:/^\t+/,listReplaceNesting:/^ {1,4}(?=( {4})*[^ ])/g,listIsTask:/^\[[ xX]\] /,listReplaceTask:/^\[[ xX]\] +/,anyLine:/\n.*\n/,hrefBrackets:/^<(.*)>$/,tableDelimiter:/[:|]/,tableAlignChars:/^\||\| *$/g,tableRowBlankLine:/\n[ \t]*$/,tableAlignRight:/^ *-+: *$/,tableAlignCenter:/^ *:-+: *$/,tableAlignLeft:/^ *:-+ *$/,startATag:/^<a /i,endATag:/^<\/a>/i,startPreScriptTag:/^<(pre|code|kbd|script)(\s|>)/i,endPreScriptTag:/^<\/(pre|code|kbd|script)(\s|>)/i,startAngleBracket:/^</,endAngleBracket:/>$/,pedanticHrefTitle:/^([^'"]*[^\s])\s+(['"])(.*)\2/,unicodeAlphaNumeric:/[\p{L}\p{N}]/u,escapeTest:/[&<>"']/,escapeReplace:/[&<>"']/g,escapeTestNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/,escapeReplaceNoEncode:/[<>"']|&(?!(#\d{1,7}|#[Xx][a-fA-F0-9]{1,6}|\w+);)/g,unescapeTest:/&(#(?:\d+)|(?:#x[0-9A-Fa-f]+)|(?:\w+));?/ig,caret:/(^|[^\[])\^/g,percentDecode:/%25/g,findPipe:/\|/g,splitPipe:/ \|/,slashPipe:/\\\|/g,carriageReturn:/\r\n|\r/g,spaceLine:/^ +$/gm,notSpaceStart:/^\S*/,endingNewline:/\n$/,listItemRegex:a=>new RegExp(`^( {0,3}${a})((?:[	 ][^\\n]*)?(?:\\n|$))`),nextBulletRegex:a=>new RegExp(`^ {0,${Math.min(3,a-1)}}(?:[*+-]|\\d{1,9}[.)])((?:[ 	][^\\n]*)?(?:\\n|$))`),hrRegex:a=>new RegExp(`^ {0,${Math.min(3,a-1)}}((?:- *){3,}|(?:_ *){3,}|(?:\\* *){3,})(?:\\n+|$)`),fencesBeginRegex:a=>new RegExp(`^ {0,${Math.min(3,a-1)}}(?:\`\`\`|~~~)`),headingBeginRegex:a=>new RegExp(`^ {0,${Math.min(3,a-1)}}#`),htmlBeginRegex:a=>new RegExp(`^ {0,${Math.min(3,a-1)}}<(?:[a-z].*>|!--)`,"i")},zs=/^(?:[ \t]*(?:\n|$))+/,Ds=/^((?: {4}| {0,3}\t)[^\n]+(?:\n(?:[ \t]*(?:\n|$))*)?)+/,qs=/^ {0,3}(`{3,}(?=[^`\n]*(?:\n|$))|~{3,})([^\n]*)(?:\n|$)(?:|([\s\S]*?)(?:\n|$))(?: {0,3}\1[~`]* *(?=\n|$)|$)/,ue=/^ {0,3}((?:-[\t ]*){3,}|(?:_[ \t]*){3,}|(?:\*[ \t]*){3,})(?:\n+|$)/,Ns=/^ {0,3}(#{1,6})(?=\s|$)(.*)(?:\n+|$)/,Be=/(?:[*+-]|\d{1,9}[.)])/,kt=/^(?!bull |blockCode|fences|blockquote|heading|html|table)((?:.|\n(?!\s*?\n|bull |blockCode|fences|blockquote|heading|html|table))+?)\n {0,3}(=+|-+) *(?:\n+|$)/,xt=v(kt).replace(/bull/g,Be).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/\|table/g,"").getRegex(),Us=v(kt).replace(/bull/g,Be).replace(/blockCode/g,/(?: {4}| {0,3}\t)/).replace(/fences/g,/ {0,3}(?:`{3,}|~{3,})/).replace(/blockquote/g,/ {0,3}>/).replace(/heading/g,/ {0,3}#{1,6}/).replace(/html/g,/ {0,3}<[^\n>]+>\n/).replace(/table/g,/ {0,3}\|?(?:[:\- ]*\|)+[\:\- ]*\n/).getRegex(),Ge=/^([^\n]+(?:\n(?!hr|heading|lheading|blockquote|fences|list|html|table| +\n)[^\n]+)*)/,Ls=/^[^\n]+/,je=/(?!\s*\])(?:\\[\s\S]|[^\[\]\\])+/,Bs=v(/^ {0,3}\[(label)\]: *(?:\n[ \t]*)?([^<\s][^\s]*|<.*?>)(?:(?: +(?:\n[ \t]*)?| *\n[ \t]*)(title))? *(?:\n+|$)/).replace("label",je).replace("title",/(?:"(?:\\"?|[^"\\])*"|'[^'\n]*(?:\n[^'\n]+)*\n?'|\([^()]*\))/).getRegex(),Gs=v(/^( {0,3}bull)([ \t][^\n]+?)?(?:\n|$)/).replace(/bull/g,Be).getRegex(),Ce="address|article|aside|base|basefont|blockquote|body|caption|center|col|colgroup|dd|details|dialog|dir|div|dl|dt|fieldset|figcaption|figure|footer|form|frame|frameset|h[1-6]|head|header|hr|html|iframe|legend|li|link|main|menu|menuitem|meta|nav|noframes|ol|optgroup|option|p|param|search|section|summary|table|tbody|td|tfoot|th|thead|title|tr|track|ul",He=/<!--(?:-?>|[\s\S]*?(?:-->|$))/,js=v("^ {0,3}(?:<(script|pre|style|textarea)[\\s>][\\s\\S]*?(?:</\\1>[^\\n]*\\n+|$)|comment[^\\n]*(\\n+|$)|<\\?[\\s\\S]*?(?:\\?>\\n*|$)|<![A-Z][\\s\\S]*?(?:>\\n*|$)|<!\\[CDATA\\[[\\s\\S]*?(?:\\]\\]>\\n*|$)|</?(tag)(?: +|\\n|/?>)[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|<(?!script|pre|style|textarea)([a-z][\\w-]*)(?:attribute)*? */?>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$)|</(?!script|pre|style|textarea)[a-z][\\w-]*\\s*>(?=[ \\t]*(?:\\n|$))[\\s\\S]*?(?:(?:\\n[ 	]*)+\\n|$))","i").replace("comment",He).replace("tag",Ce).replace("attribute",/ +[a-zA-Z:_][\w.:-]*(?: *= *"[^"\n]*"| *= *'[^'\n]*'| *= *[^\s"'=<>`]+)?/).getRegex(),At=v(Ge).replace("hr",ue).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("|table","").replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",Ce).getRegex(),Hs=v(/^( {0,3}> ?(paragraph|[^\n]*)(?:\n|$))+/).replace("paragraph",At).getRegex(),Fe={blockquote:Hs,code:Ds,def:Bs,fences:qs,heading:Ns,hr:ue,html:js,lheading:xt,list:Gs,newline:zs,paragraph:At,table:ne,text:Ls},rt=v("^ *([^\\n ].*)\\n {0,3}((?:\\| *)?:?-+:? *(?:\\| *:?-+:? *)*(?:\\| *)?)(?:\\n((?:(?! *\\n|hr|heading|blockquote|code|fences|list|html).*(?:\\n|$))*)\\n*|$)").replace("hr",ue).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("blockquote"," {0,3}>").replace("code","(?: {4}| {0,3}	)[^\\n]").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",Ce).getRegex(),Fs={...Fe,lheading:Us,table:rt,paragraph:v(Ge).replace("hr",ue).replace("heading"," {0,3}#{1,6}(?:\\s|$)").replace("|lheading","").replace("table",rt).replace("blockquote"," {0,3}>").replace("fences"," {0,3}(?:`{3,}(?=[^`\\n]*\\n)|~{3,})[^\\n]*\\n").replace("list"," {0,3}(?:[*+-]|1[.)]) ").replace("html","</?(?:tag)(?: +|\\n|/?>)|<(?:script|pre|style|textarea|!--)").replace("tag",Ce).getRegex()},Ws={...Fe,html:v(`^ *(?:comment *(?:\\n|\\s*$)|<(tag)[\\s\\S]+?</\\1> *(?:\\n{2,}|\\s*$)|<tag(?:"[^"]*"|'[^']*'|\\s[^'"/>\\s]*)*?/?> *(?:\\n{2,}|\\s*$))`).replace("comment",He).replace(/tag/g,"(?!(?:a|em|strong|small|s|cite|q|dfn|abbr|data|time|code|var|samp|kbd|sub|sup|i|b|u|mark|ruby|rt|rp|bdi|bdo|span|br|wbr|ins|del|img)\\b)\\w+(?!:|[^\\w\\s@]*@)\\b").getRegex(),def:/^ *\[([^\]]+)\]: *<?([^\s>]+)>?(?: +(["(][^\n]+[")]))? *(?:\n+|$)/,heading:/^(#{1,6})(.*)(?:\n+|$)/,fences:ne,lheading:/^(.+?)\n {0,3}(=+|-+) *(?:\n+|$)/,paragraph:v(Ge).replace("hr",ue).replace("heading",` *#{1,6} *[^
]`).replace("lheading",xt).replace("|table","").replace("blockquote"," {0,3}>").replace("|fences","").replace("|list","").replace("|html","").replace("|tag","").getRegex()},Vs=/^\\([!"#$%&'()*+,\-./:;<=>?@\[\]\\^_`{|}~])/,Ks=/^(`+)([^`]|[^`][\s\S]*?[^`])\1(?!`)/,Ct=/^( {2,}|\\)\n(?!\s*$)/,Zs=/^(`+|[^`])(?:(?= {2,}\n)|[\s\S]*?(?:(?=[\\<!\[`*_]|\b_|$)|[^ ](?= {2,}\n)))/,Se=/[\p{P}\p{S}]/u,We=/[\s\p{P}\p{S}]/u,St=/[^\s\p{P}\p{S}]/u,Js=v(/^((?![*_])punctSpace)/,"u").replace(/punctSpace/g,We).getRegex(),Tt=/(?!~)[\p{P}\p{S}]/u,Ys=/(?!~)[\s\p{P}\p{S}]/u,Qs=/(?:[^\s\p{P}\p{S}]|~)/u,Xs=v(/link|precode-code|html/,"g").replace("link",/\[(?:[^\[\]`]|(?<a>`+)[^`]+\k<a>(?!`))*?\]\((?:\\[\s\S]|[^\\\(\)]|\((?:\\[\s\S]|[^\\\(\)])*\))*\)/).replace("precode-",Os?"(?<!`)()":"(^^|[^`])").replace("code",/(?<b>`+)[^`]+\k<b>(?!`)/).replace("html",/<(?! )[^<>]*?>/).getRegex(),$t=/^(?:\*+(?:((?!\*)punct)|[^\s*]))|^_+(?:((?!_)punct)|([^\s_]))/,er=v($t,"u").replace(/punct/g,Se).getRegex(),tr=v($t,"u").replace(/punct/g,Tt).getRegex(),_t="^[^_*]*?__[^_*]*?\\*[^_*]*?(?=__)|[^*]+(?=[^*])|(?!\\*)punct(\\*+)(?=[\\s]|$)|notPunctSpace(\\*+)(?!\\*)(?=punctSpace|$)|(?!\\*)punctSpace(\\*+)(?=notPunctSpace)|[\\s](\\*+)(?!\\*)(?=punct)|(?!\\*)punct(\\*+)(?!\\*)(?=punct)|notPunctSpace(\\*+)(?=notPunctSpace)",sr=v(_t,"gu").replace(/notPunctSpace/g,St).replace(/punctSpace/g,We).replace(/punct/g,Se).getRegex(),rr=v(_t,"gu").replace(/notPunctSpace/g,Qs).replace(/punctSpace/g,Ys).replace(/punct/g,Tt).getRegex(),ar=v("^[^_*]*?\\*\\*[^_*]*?_[^_*]*?(?=\\*\\*)|[^_]+(?=[^_])|(?!_)punct(_+)(?=[\\s]|$)|notPunctSpace(_+)(?!_)(?=punctSpace|$)|(?!_)punctSpace(_+)(?=notPunctSpace)|[\\s](_+)(?!_)(?=punct)|(?!_)punct(_+)(?!_)(?=punct)","gu").replace(/notPunctSpace/g,St).replace(/punctSpace/g,We).replace(/punct/g,Se).getRegex(),nr=v(/\\(punct)/,"gu").replace(/punct/g,Se).getRegex(),ir=v(/^<(scheme:[^\s\x00-\x1f<>]*|email)>/).replace("scheme",/[a-zA-Z][a-zA-Z0-9+.-]{1,31}/).replace("email",/[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+(@)[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)+(?![-_])/).getRegex(),or=v(He).replace("(?:-->|$)","-->").getRegex(),lr=v("^comment|^</[a-zA-Z][\\w:-]*\\s*>|^<[a-zA-Z][\\w-]*(?:attribute)*?\\s*/?>|^<\\?[\\s\\S]*?\\?>|^<![a-zA-Z]+\\s[\\s\\S]*?>|^<!\\[CDATA\\[[\\s\\S]*?\\]\\]>").replace("comment",or).replace("attribute",/\s+[a-zA-Z:_][\w.:-]*(?:\s*=\s*"[^"]*"|\s*=\s*'[^']*'|\s*=\s*[^\s"'=<>`]+)?/).getRegex(),ye=/(?:\[(?:\\[\s\S]|[^\[\]\\])*\]|\\[\s\S]|`+[^`]*?`+(?!`)|[^\[\]\\`])*?/,cr=v(/^!?\[(label)\]\(\s*(href)(?:(?:[ \t]*(?:\n[ \t]*)?)(title))?\s*\)/).replace("label",ye).replace("href",/<(?:\\.|[^\n<>\\])+>|[^ \t\n\x00-\x1f]*/).replace("title",/"(?:\\"?|[^"\\])*"|'(?:\\'?|[^'\\])*'|\((?:\\\)?|[^)\\])*\)/).getRegex(),Pt=v(/^!?\[(label)\]\[(ref)\]/).replace("label",ye).replace("ref",je).getRegex(),Et=v(/^!?\[(ref)\](?:\[\])?/).replace("ref",je).getRegex(),pr=v("reflink|nolink(?!\\()","g").replace("reflink",Pt).replace("nolink",Et).getRegex(),at=/[hH][tT][tT][pP][sS]?|[fF][tT][pP]/,Ve={_backpedal:ne,anyPunctuation:nr,autolink:ir,blockSkip:Xs,br:Ct,code:Ks,del:ne,emStrongLDelim:er,emStrongRDelimAst:sr,emStrongRDelimUnd:ar,escape:Vs,link:cr,nolink:Et,punctuation:Js,reflink:Pt,reflinkSearch:pr,tag:lr,text:Zs,url:ne},dr={...Ve,link:v(/^!?\[(label)\]\((.*?)\)/).replace("label",ye).getRegex(),reflink:v(/^!?\[(label)\]\s*\[([^\]]*)\]/).replace("label",ye).getRegex()},Ie={...Ve,emStrongRDelimAst:rr,emStrongLDelim:tr,url:v(/^((?:protocol):\/\/|www\.)(?:[a-zA-Z0-9\-]+\.?)+[^\s<]*|^email/).replace("protocol",at).replace("email",/[A-Za-z0-9._+-]+(@)[a-zA-Z0-9-_]+(?:\.[a-zA-Z0-9-_]*[a-zA-Z0-9])+(?![-_])/).getRegex(),_backpedal:/(?:[^?!.,:;*_'"~()&]+|\([^)]*\)|&(?![a-zA-Z0-9]+;$)|[?!.,:;*_'"~)]+(?!$))+/,del:/^(~~?)(?=[^\s~])((?:\\[\s\S]|[^\\])*?(?:\\[\s\S]|[^\s~\\]))\1(?=[^~]|$)/,text:v(/^([`~]+|[^`~])(?:(?= {2,}\n)|(?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)|[\s\S]*?(?:(?=[\\<!\[`*~_]|\b_|protocol:\/\/|www\.|$)|[^ ](?= {2,}\n)|[^a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-](?=[a-zA-Z0-9.!#$%&'*+\/=?_`{\|}~-]+@)))/).replace("protocol",at).getRegex()},hr={...Ie,br:v(Ct).replace("{2,}","*").getRegex(),text:v(Ie.text).replace("\\b_","\\b_| {2,}\\n").replace(/\{2,\}/g,"*").getRegex()},fe={normal:Fe,gfm:Fs,pedantic:Ws},X={normal:Ve,gfm:Ie,breaks:hr,pedantic:dr},ur={"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"},nt=a=>ur[a];function R(a,e){if(e){if(T.escapeTest.test(a))return a.replace(T.escapeReplace,nt)}else if(T.escapeTestNoEncode.test(a))return a.replace(T.escapeReplaceNoEncode,nt);return a}function it(a){try{a=encodeURI(a).replace(T.percentDecode,"%")}catch{return null}return a}function ot(a,e){let t=a.replace(T.findPipe,(n,i,o)=>{let l=!1,c=i;for(;--c>=0&&o[c]==="\\";)l=!l;return l?"|":" |"}),s=t.split(T.splitPipe),r=0;if(s[0].trim()||s.shift(),s.length>0&&!s.at(-1)?.trim()&&s.pop(),e)if(s.length>e)s.splice(e);else for(;s.length<e;)s.push("");for(;r<s.length;r++)s[r]=s[r].trim().replace(T.slashPipe,"|");return s}function ee(a,e,t){let s=a.length;if(s===0)return"";let r=0;for(;r<s&&a.charAt(s-r-1)===e;)r++;return a.slice(0,s-r)}function gr(a,e){if(a.indexOf(e[1])===-1)return-1;let t=0;for(let s=0;s<a.length;s++)if(a[s]==="\\")s++;else if(a[s]===e[0])t++;else if(a[s]===e[1]&&(t--,t<0))return s;return t>0?-2:-1}function lt(a,e,t,s,r){let n=e.href,i=e.title||null,o=a[1].replace(r.other.outputLinkReplace,"$1");s.state.inLink=!0;let l={type:a[0].charAt(0)==="!"?"image":"link",raw:t,href:n,title:i,text:o,tokens:s.inlineTokens(o)};return s.state.inLink=!1,l}function fr(a,e,t){let s=a.match(t.other.indentCodeCompensation);if(s===null)return e;let r=s[1];return e.split(`
`).map(n=>{let i=n.match(t.other.beginningSpace);if(i===null)return n;let[o]=i;return o.length>=r.length?n.slice(r.length):n}).join(`
`)}var ke=class{options;rules;lexer;constructor(a){this.options=a||V}space(a){let e=this.rules.block.newline.exec(a);if(e&&e[0].length>0)return{type:"space",raw:e[0]}}code(a){let e=this.rules.block.code.exec(a);if(e){let t=e[0].replace(this.rules.other.codeRemoveIndent,"");return{type:"code",raw:e[0],codeBlockStyle:"indented",text:this.options.pedantic?t:ee(t,`
`)}}}fences(a){let e=this.rules.block.fences.exec(a);if(e){let t=e[0],s=fr(t,e[3]||"",this.rules);return{type:"code",raw:t,lang:e[2]?e[2].trim().replace(this.rules.inline.anyPunctuation,"$1"):e[2],text:s}}}heading(a){let e=this.rules.block.heading.exec(a);if(e){let t=e[2].trim();if(this.rules.other.endingHash.test(t)){let s=ee(t,"#");(this.options.pedantic||!s||this.rules.other.endingSpaceChar.test(s))&&(t=s.trim())}return{type:"heading",raw:e[0],depth:e[1].length,text:t,tokens:this.lexer.inline(t)}}}hr(a){let e=this.rules.block.hr.exec(a);if(e)return{type:"hr",raw:ee(e[0],`
`)}}blockquote(a){let e=this.rules.block.blockquote.exec(a);if(e){let t=ee(e[0],`
`).split(`
`),s="",r="",n=[];for(;t.length>0;){let i=!1,o=[],l;for(l=0;l<t.length;l++)if(this.rules.other.blockquoteStart.test(t[l]))o.push(t[l]),i=!0;else if(!i)o.push(t[l]);else break;t=t.slice(l);let c=o.join(`
`),d=c.replace(this.rules.other.blockquoteSetextReplace,`
    $1`).replace(this.rules.other.blockquoteSetextReplace2,"");s=s?`${s}
${c}`:c,r=r?`${r}
${d}`:d;let h=this.lexer.state.top;if(this.lexer.state.top=!0,this.lexer.blockTokens(d,n,!0),this.lexer.state.top=h,t.length===0)break;let g=n.at(-1);if(g?.type==="code")break;if(g?.type==="blockquote"){let m=g,p=m.raw+`
`+t.join(`
`),f=this.blockquote(p);n[n.length-1]=f,s=s.substring(0,s.length-m.raw.length)+f.raw,r=r.substring(0,r.length-m.text.length)+f.text;break}else if(g?.type==="list"){let m=g,p=m.raw+`
`+t.join(`
`),f=this.list(p);n[n.length-1]=f,s=s.substring(0,s.length-g.raw.length)+f.raw,r=r.substring(0,r.length-m.raw.length)+f.raw,t=p.substring(n.at(-1).raw.length).split(`
`);continue}}return{type:"blockquote",raw:s,tokens:n,text:r}}}list(a){let e=this.rules.block.list.exec(a);if(e){let t=e[1].trim(),s=t.length>1,r={type:"list",raw:"",ordered:s,start:s?+t.slice(0,-1):"",loose:!1,items:[]};t=s?`\\d{1,9}\\${t.slice(-1)}`:`\\${t}`,this.options.pedantic&&(t=s?t:"[*+-]");let n=this.rules.other.listItemRegex(t),i=!1;for(;a;){let l=!1,c="",d="";if(!(e=n.exec(a))||this.rules.block.hr.test(a))break;c=e[0],a=a.substring(c.length);let h=e[2].split(`
`,1)[0].replace(this.rules.other.listReplaceTabs,k=>" ".repeat(3*k.length)),g=a.split(`
`,1)[0],m=!h.trim(),p=0;if(this.options.pedantic?(p=2,d=h.trimStart()):m?p=e[1].length+1:(p=e[2].search(this.rules.other.nonSpaceChar),p=p>4?1:p,d=h.slice(p),p+=e[1].length),m&&this.rules.other.blankLine.test(g)&&(c+=g+`
`,a=a.substring(g.length+1),l=!0),!l){let k=this.rules.other.nextBulletRegex(p),$=this.rules.other.hrRegex(p),y=this.rules.other.fencesBeginRegex(p),K=this.rules.other.headingBeginRegex(p),$e=this.rules.other.htmlBeginRegex(p);for(;a;){let L=a.split(`
`,1)[0],B;if(g=L,this.options.pedantic?(g=g.replace(this.rules.other.listReplaceNesting,"  "),B=g):B=g.replace(this.rules.other.tabCharGlobal,"    "),y.test(g)||K.test(g)||$e.test(g)||k.test(g)||$.test(g))break;if(B.search(this.rules.other.nonSpaceChar)>=p||!g.trim())d+=`
`+B.slice(p);else{if(m||h.replace(this.rules.other.tabCharGlobal,"    ").search(this.rules.other.nonSpaceChar)>=4||y.test(h)||K.test(h)||$.test(h))break;d+=`
`+g}!m&&!g.trim()&&(m=!0),c+=L+`
`,a=a.substring(L.length+1),h=B.slice(p)}}r.loose||(i?r.loose=!0:this.rules.other.doubleBlankLine.test(c)&&(i=!0));let f=null,w;this.options.gfm&&(f=this.rules.other.listIsTask.exec(d),f&&(w=f[0]!=="[ ] ",d=d.replace(this.rules.other.listReplaceTask,""))),r.items.push({type:"list_item",raw:c,task:!!f,checked:w,loose:!1,text:d,tokens:[]}),r.raw+=c}let o=r.items.at(-1);if(o)o.raw=o.raw.trimEnd(),o.text=o.text.trimEnd();else return;r.raw=r.raw.trimEnd();for(let l=0;l<r.items.length;l++)if(this.lexer.state.top=!1,r.items[l].tokens=this.lexer.blockTokens(r.items[l].text,[]),!r.loose){let c=r.items[l].tokens.filter(h=>h.type==="space"),d=c.length>0&&c.some(h=>this.rules.other.anyLine.test(h.raw));r.loose=d}if(r.loose)for(let l=0;l<r.items.length;l++)r.items[l].loose=!0;return r}}html(a){let e=this.rules.block.html.exec(a);if(e)return{type:"html",block:!0,raw:e[0],pre:e[1]==="pre"||e[1]==="script"||e[1]==="style",text:e[0]}}def(a){let e=this.rules.block.def.exec(a);if(e){let t=e[1].toLowerCase().replace(this.rules.other.multipleSpaceGlobal," "),s=e[2]?e[2].replace(this.rules.other.hrefBrackets,"$1").replace(this.rules.inline.anyPunctuation,"$1"):"",r=e[3]?e[3].substring(1,e[3].length-1).replace(this.rules.inline.anyPunctuation,"$1"):e[3];return{type:"def",tag:t,raw:e[0],href:s,title:r}}}table(a){let e=this.rules.block.table.exec(a);if(!e||!this.rules.other.tableDelimiter.test(e[2]))return;let t=ot(e[1]),s=e[2].replace(this.rules.other.tableAlignChars,"").split("|"),r=e[3]?.trim()?e[3].replace(this.rules.other.tableRowBlankLine,"").split(`
`):[],n={type:"table",raw:e[0],header:[],align:[],rows:[]};if(t.length===s.length){for(let i of s)this.rules.other.tableAlignRight.test(i)?n.align.push("right"):this.rules.other.tableAlignCenter.test(i)?n.align.push("center"):this.rules.other.tableAlignLeft.test(i)?n.align.push("left"):n.align.push(null);for(let i=0;i<t.length;i++)n.header.push({text:t[i],tokens:this.lexer.inline(t[i]),header:!0,align:n.align[i]});for(let i of r)n.rows.push(ot(i,n.header.length).map((o,l)=>({text:o,tokens:this.lexer.inline(o),header:!1,align:n.align[l]})));return n}}lheading(a){let e=this.rules.block.lheading.exec(a);if(e)return{type:"heading",raw:e[0],depth:e[2].charAt(0)==="="?1:2,text:e[1],tokens:this.lexer.inline(e[1])}}paragraph(a){let e=this.rules.block.paragraph.exec(a);if(e){let t=e[1].charAt(e[1].length-1)===`
`?e[1].slice(0,-1):e[1];return{type:"paragraph",raw:e[0],text:t,tokens:this.lexer.inline(t)}}}text(a){let e=this.rules.block.text.exec(a);if(e)return{type:"text",raw:e[0],text:e[0],tokens:this.lexer.inline(e[0])}}escape(a){let e=this.rules.inline.escape.exec(a);if(e)return{type:"escape",raw:e[0],text:e[1]}}tag(a){let e=this.rules.inline.tag.exec(a);if(e)return!this.lexer.state.inLink&&this.rules.other.startATag.test(e[0])?this.lexer.state.inLink=!0:this.lexer.state.inLink&&this.rules.other.endATag.test(e[0])&&(this.lexer.state.inLink=!1),!this.lexer.state.inRawBlock&&this.rules.other.startPreScriptTag.test(e[0])?this.lexer.state.inRawBlock=!0:this.lexer.state.inRawBlock&&this.rules.other.endPreScriptTag.test(e[0])&&(this.lexer.state.inRawBlock=!1),{type:"html",raw:e[0],inLink:this.lexer.state.inLink,inRawBlock:this.lexer.state.inRawBlock,block:!1,text:e[0]}}link(a){let e=this.rules.inline.link.exec(a);if(e){let t=e[2].trim();if(!this.options.pedantic&&this.rules.other.startAngleBracket.test(t)){if(!this.rules.other.endAngleBracket.test(t))return;let n=ee(t.slice(0,-1),"\\");if((t.length-n.length)%2===0)return}else{let n=gr(e[2],"()");if(n===-2)return;if(n>-1){let i=(e[0].indexOf("!")===0?5:4)+e[1].length+n;e[2]=e[2].substring(0,n),e[0]=e[0].substring(0,i).trim(),e[3]=""}}let s=e[2],r="";if(this.options.pedantic){let n=this.rules.other.pedanticHrefTitle.exec(s);n&&(s=n[1],r=n[3])}else r=e[3]?e[3].slice(1,-1):"";return s=s.trim(),this.rules.other.startAngleBracket.test(s)&&(this.options.pedantic&&!this.rules.other.endAngleBracket.test(t)?s=s.slice(1):s=s.slice(1,-1)),lt(e,{href:s&&s.replace(this.rules.inline.anyPunctuation,"$1"),title:r&&r.replace(this.rules.inline.anyPunctuation,"$1")},e[0],this.lexer,this.rules)}}reflink(a,e){let t;if((t=this.rules.inline.reflink.exec(a))||(t=this.rules.inline.nolink.exec(a))){let s=(t[2]||t[1]).replace(this.rules.other.multipleSpaceGlobal," "),r=e[s.toLowerCase()];if(!r){let n=t[0].charAt(0);return{type:"text",raw:n,text:n}}return lt(t,r,t[0],this.lexer,this.rules)}}emStrong(a,e,t=""){let s=this.rules.inline.emStrongLDelim.exec(a);if(!(!s||s[3]&&t.match(this.rules.other.unicodeAlphaNumeric))&&(!(s[1]||s[2])||!t||this.rules.inline.punctuation.exec(t))){let r=[...s[0]].length-1,n,i,o=r,l=0,c=s[0][0]==="*"?this.rules.inline.emStrongRDelimAst:this.rules.inline.emStrongRDelimUnd;for(c.lastIndex=0,e=e.slice(-1*a.length+r);(s=c.exec(e))!=null;){if(n=s[1]||s[2]||s[3]||s[4]||s[5]||s[6],!n)continue;if(i=[...n].length,s[3]||s[4]){o+=i;continue}else if((s[5]||s[6])&&r%3&&!((r+i)%3)){l+=i;continue}if(o-=i,o>0)continue;i=Math.min(i,i+o+l);let d=[...s[0]][0].length,h=a.slice(0,r+s.index+d+i);if(Math.min(r,i)%2){let m=h.slice(1,-1);return{type:"em",raw:h,text:m,tokens:this.lexer.inlineTokens(m)}}let g=h.slice(2,-2);return{type:"strong",raw:h,text:g,tokens:this.lexer.inlineTokens(g)}}}}codespan(a){let e=this.rules.inline.code.exec(a);if(e){let t=e[2].replace(this.rules.other.newLineCharGlobal," "),s=this.rules.other.nonSpaceChar.test(t),r=this.rules.other.startingSpaceChar.test(t)&&this.rules.other.endingSpaceChar.test(t);return s&&r&&(t=t.substring(1,t.length-1)),{type:"codespan",raw:e[0],text:t}}}br(a){let e=this.rules.inline.br.exec(a);if(e)return{type:"br",raw:e[0]}}del(a){let e=this.rules.inline.del.exec(a);if(e)return{type:"del",raw:e[0],text:e[2],tokens:this.lexer.inlineTokens(e[2])}}autolink(a){let e=this.rules.inline.autolink.exec(a);if(e){let t,s;return e[2]==="@"?(t=e[1],s="mailto:"+t):(t=e[1],s=t),{type:"link",raw:e[0],text:t,href:s,tokens:[{type:"text",raw:t,text:t}]}}}url(a){let e;if(e=this.rules.inline.url.exec(a)){let t,s;if(e[2]==="@")t=e[0],s="mailto:"+t;else{let r;do r=e[0],e[0]=this.rules.inline._backpedal.exec(e[0])?.[0]??"";while(r!==e[0]);t=e[0],e[1]==="www."?s="http://"+e[0]:s=e[0]}return{type:"link",raw:e[0],text:t,href:s,tokens:[{type:"text",raw:t,text:t}]}}}inlineText(a){let e=this.rules.inline.text.exec(a);if(e){let t=this.lexer.state.inRawBlock;return{type:"text",raw:e[0],text:e[0],escaped:t}}}},P=class Oe{tokens;options;state;tokenizer;inlineQueue;constructor(e){this.tokens=[],this.tokens.links=Object.create(null),this.options=e||V,this.options.tokenizer=this.options.tokenizer||new ke,this.tokenizer=this.options.tokenizer,this.tokenizer.options=this.options,this.tokenizer.lexer=this,this.inlineQueue=[],this.state={inLink:!1,inRawBlock:!1,top:!0};let t={other:T,block:fe.normal,inline:X.normal};this.options.pedantic?(t.block=fe.pedantic,t.inline=X.pedantic):this.options.gfm&&(t.block=fe.gfm,this.options.breaks?t.inline=X.breaks:t.inline=X.gfm),this.tokenizer.rules=t}static get rules(){return{block:fe,inline:X}}static lex(e,t){return new Oe(t).lex(e)}static lexInline(e,t){return new Oe(t).inlineTokens(e)}lex(e){e=e.replace(T.carriageReturn,`
`),this.blockTokens(e,this.tokens);for(let t=0;t<this.inlineQueue.length;t++){let s=this.inlineQueue[t];this.inlineTokens(s.src,s.tokens)}return this.inlineQueue=[],this.tokens}blockTokens(e,t=[],s=!1){for(this.options.pedantic&&(e=e.replace(T.tabCharGlobal,"    ").replace(T.spaceLine,""));e;){let r;if(this.options.extensions?.block?.some(i=>(r=i.call({lexer:this},e,t))?(e=e.substring(r.raw.length),t.push(r),!0):!1))continue;if(r=this.tokenizer.space(e)){e=e.substring(r.raw.length);let i=t.at(-1);r.raw.length===1&&i!==void 0?i.raw+=`
`:t.push(r);continue}if(r=this.tokenizer.code(e)){e=e.substring(r.raw.length);let i=t.at(-1);i?.type==="paragraph"||i?.type==="text"?(i.raw+=(i.raw.endsWith(`
`)?"":`
`)+r.raw,i.text+=`
`+r.text,this.inlineQueue.at(-1).src=i.text):t.push(r);continue}if(r=this.tokenizer.fences(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.heading(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.hr(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.blockquote(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.list(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.html(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.def(e)){e=e.substring(r.raw.length);let i=t.at(-1);i?.type==="paragraph"||i?.type==="text"?(i.raw+=(i.raw.endsWith(`
`)?"":`
`)+r.raw,i.text+=`
`+r.raw,this.inlineQueue.at(-1).src=i.text):this.tokens.links[r.tag]||(this.tokens.links[r.tag]={href:r.href,title:r.title},t.push(r));continue}if(r=this.tokenizer.table(e)){e=e.substring(r.raw.length),t.push(r);continue}if(r=this.tokenizer.lheading(e)){e=e.substring(r.raw.length),t.push(r);continue}let n=e;if(this.options.extensions?.startBlock){let i=1/0,o=e.slice(1),l;this.options.extensions.startBlock.forEach(c=>{l=c.call({lexer:this},o),typeof l=="number"&&l>=0&&(i=Math.min(i,l))}),i<1/0&&i>=0&&(n=e.substring(0,i+1))}if(this.state.top&&(r=this.tokenizer.paragraph(n))){let i=t.at(-1);s&&i?.type==="paragraph"?(i.raw+=(i.raw.endsWith(`
`)?"":`
`)+r.raw,i.text+=`
`+r.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=i.text):t.push(r),s=n.length!==e.length,e=e.substring(r.raw.length);continue}if(r=this.tokenizer.text(e)){e=e.substring(r.raw.length);let i=t.at(-1);i?.type==="text"?(i.raw+=(i.raw.endsWith(`
`)?"":`
`)+r.raw,i.text+=`
`+r.text,this.inlineQueue.pop(),this.inlineQueue.at(-1).src=i.text):t.push(r);continue}if(e){let i="Infinite loop on byte: "+e.charCodeAt(0);if(this.options.silent){console.error(i);break}else throw new Error(i)}}return this.state.top=!0,t}inline(e,t=[]){return this.inlineQueue.push({src:e,tokens:t}),t}inlineTokens(e,t=[]){let s=e,r=null;if(this.tokens.links){let l=Object.keys(this.tokens.links);if(l.length>0)for(;(r=this.tokenizer.rules.inline.reflinkSearch.exec(s))!=null;)l.includes(r[0].slice(r[0].lastIndexOf("[")+1,-1))&&(s=s.slice(0,r.index)+"["+"a".repeat(r[0].length-2)+"]"+s.slice(this.tokenizer.rules.inline.reflinkSearch.lastIndex))}for(;(r=this.tokenizer.rules.inline.anyPunctuation.exec(s))!=null;)s=s.slice(0,r.index)+"++"+s.slice(this.tokenizer.rules.inline.anyPunctuation.lastIndex);let n;for(;(r=this.tokenizer.rules.inline.blockSkip.exec(s))!=null;)n=r[2]?r[2].length:0,s=s.slice(0,r.index+n)+"["+"a".repeat(r[0].length-n-2)+"]"+s.slice(this.tokenizer.rules.inline.blockSkip.lastIndex);s=this.options.hooks?.emStrongMask?.call({lexer:this},s)??s;let i=!1,o="";for(;e;){i||(o=""),i=!1;let l;if(this.options.extensions?.inline?.some(d=>(l=d.call({lexer:this},e,t))?(e=e.substring(l.raw.length),t.push(l),!0):!1))continue;if(l=this.tokenizer.escape(e)){e=e.substring(l.raw.length),t.push(l);continue}if(l=this.tokenizer.tag(e)){e=e.substring(l.raw.length),t.push(l);continue}if(l=this.tokenizer.link(e)){e=e.substring(l.raw.length),t.push(l);continue}if(l=this.tokenizer.reflink(e,this.tokens.links)){e=e.substring(l.raw.length);let d=t.at(-1);l.type==="text"&&d?.type==="text"?(d.raw+=l.raw,d.text+=l.text):t.push(l);continue}if(l=this.tokenizer.emStrong(e,s,o)){e=e.substring(l.raw.length),t.push(l);continue}if(l=this.tokenizer.codespan(e)){e=e.substring(l.raw.length),t.push(l);continue}if(l=this.tokenizer.br(e)){e=e.substring(l.raw.length),t.push(l);continue}if(l=this.tokenizer.del(e)){e=e.substring(l.raw.length),t.push(l);continue}if(l=this.tokenizer.autolink(e)){e=e.substring(l.raw.length),t.push(l);continue}if(!this.state.inLink&&(l=this.tokenizer.url(e))){e=e.substring(l.raw.length),t.push(l);continue}let c=e;if(this.options.extensions?.startInline){let d=1/0,h=e.slice(1),g;this.options.extensions.startInline.forEach(m=>{g=m.call({lexer:this},h),typeof g=="number"&&g>=0&&(d=Math.min(d,g))}),d<1/0&&d>=0&&(c=e.substring(0,d+1))}if(l=this.tokenizer.inlineText(c)){e=e.substring(l.raw.length),l.raw.slice(-1)!=="_"&&(o=l.raw.slice(-1)),i=!0;let d=t.at(-1);d?.type==="text"?(d.raw+=l.raw,d.text+=l.text):t.push(l);continue}if(e){let d="Infinite loop on byte: "+e.charCodeAt(0);if(this.options.silent){console.error(d);break}else throw new Error(d)}}return t}},xe=class{options;parser;constructor(a){this.options=a||V}space(a){return""}code({text:a,lang:e,escaped:t}){let s=(e||"").match(T.notSpaceStart)?.[0],r=a.replace(T.endingNewline,"")+`
`;return s?'<pre><code class="language-'+R(s)+'">'+(t?r:R(r,!0))+`</code></pre>
`:"<pre><code>"+(t?r:R(r,!0))+`</code></pre>
`}blockquote({tokens:a}){return`<blockquote>
${this.parser.parse(a)}</blockquote>
`}html({text:a}){return a}def(a){return""}heading({tokens:a,depth:e}){return`<h${e}>${this.parser.parseInline(a)}</h${e}>
`}hr(a){return`<hr>
`}list(a){let e=a.ordered,t=a.start,s="";for(let i=0;i<a.items.length;i++){let o=a.items[i];s+=this.listitem(o)}let r=e?"ol":"ul",n=e&&t!==1?' start="'+t+'"':"";return"<"+r+n+`>
`+s+"</"+r+`>
`}listitem(a){let e="";if(a.task){let t=this.checkbox({checked:!!a.checked});a.loose?a.tokens[0]?.type==="paragraph"?(a.tokens[0].text=t+" "+a.tokens[0].text,a.tokens[0].tokens&&a.tokens[0].tokens.length>0&&a.tokens[0].tokens[0].type==="text"&&(a.tokens[0].tokens[0].text=t+" "+R(a.tokens[0].tokens[0].text),a.tokens[0].tokens[0].escaped=!0)):a.tokens.unshift({type:"text",raw:t+" ",text:t+" ",escaped:!0}):e+=t+" "}return e+=this.parser.parse(a.tokens,!!a.loose),`<li>${e}</li>
`}checkbox({checked:a}){return"<input "+(a?'checked="" ':"")+'disabled="" type="checkbox">'}paragraph({tokens:a}){return`<p>${this.parser.parseInline(a)}</p>
`}table(a){let e="",t="";for(let r=0;r<a.header.length;r++)t+=this.tablecell(a.header[r]);e+=this.tablerow({text:t});let s="";for(let r=0;r<a.rows.length;r++){let n=a.rows[r];t="";for(let i=0;i<n.length;i++)t+=this.tablecell(n[i]);s+=this.tablerow({text:t})}return s&&(s=`<tbody>${s}</tbody>`),`<table>
<thead>
`+e+`</thead>
`+s+`</table>
`}tablerow({text:a}){return`<tr>
${a}</tr>
`}tablecell(a){let e=this.parser.parseInline(a.tokens),t=a.header?"th":"td";return(a.align?`<${t} align="${a.align}">`:`<${t}>`)+e+`</${t}>
`}strong({tokens:a}){return`<strong>${this.parser.parseInline(a)}</strong>`}em({tokens:a}){return`<em>${this.parser.parseInline(a)}</em>`}codespan({text:a}){return`<code>${R(a,!0)}</code>`}br(a){return"<br>"}del({tokens:a}){return`<del>${this.parser.parseInline(a)}</del>`}link({href:a,title:e,tokens:t}){let s=this.parser.parseInline(t),r=it(a);if(r===null)return s;a=r;let n='<a href="'+a+'"';return e&&(n+=' title="'+R(e)+'"'),n+=">"+s+"</a>",n}image({href:a,title:e,text:t,tokens:s}){s&&(t=this.parser.parseInline(s,this.parser.textRenderer));let r=it(a);if(r===null)return R(t);a=r;let n=`<img src="${a}" alt="${t}"`;return e&&(n+=` title="${R(e)}"`),n+=">",n}text(a){return"tokens"in a&&a.tokens?this.parser.parseInline(a.tokens):"escaped"in a&&a.escaped?a.text:R(a.text)}},Ke=class{strong({text:a}){return a}em({text:a}){return a}codespan({text:a}){return a}del({text:a}){return a}html({text:a}){return a}text({text:a}){return a}link({text:a}){return""+a}image({text:a}){return""+a}br(){return""}},E=class ze{options;renderer;textRenderer;constructor(e){this.options=e||V,this.options.renderer=this.options.renderer||new xe,this.renderer=this.options.renderer,this.renderer.options=this.options,this.renderer.parser=this,this.textRenderer=new Ke}static parse(e,t){return new ze(t).parse(e)}static parseInline(e,t){return new ze(t).parseInline(e)}parse(e,t=!0){let s="";for(let r=0;r<e.length;r++){let n=e[r];if(this.options.extensions?.renderers?.[n.type]){let o=n,l=this.options.extensions.renderers[o.type].call({parser:this},o);if(l!==!1||!["space","hr","heading","code","table","blockquote","list","html","def","paragraph","text"].includes(o.type)){s+=l||"";continue}}let i=n;switch(i.type){case"space":{s+=this.renderer.space(i);continue}case"hr":{s+=this.renderer.hr(i);continue}case"heading":{s+=this.renderer.heading(i);continue}case"code":{s+=this.renderer.code(i);continue}case"table":{s+=this.renderer.table(i);continue}case"blockquote":{s+=this.renderer.blockquote(i);continue}case"list":{s+=this.renderer.list(i);continue}case"html":{s+=this.renderer.html(i);continue}case"def":{s+=this.renderer.def(i);continue}case"paragraph":{s+=this.renderer.paragraph(i);continue}case"text":{let o=i,l=this.renderer.text(o);for(;r+1<e.length&&e[r+1].type==="text";)o=e[++r],l+=`
`+this.renderer.text(o);t?s+=this.renderer.paragraph({type:"paragraph",raw:l,text:l,tokens:[{type:"text",raw:l,text:l,escaped:!0}]}):s+=l;continue}default:{let o='Token with "'+i.type+'" type was not found.';if(this.options.silent)return console.error(o),"";throw new Error(o)}}}return s}parseInline(e,t=this.renderer){let s="";for(let r=0;r<e.length;r++){let n=e[r];if(this.options.extensions?.renderers?.[n.type]){let o=this.options.extensions.renderers[n.type].call({parser:this},n);if(o!==!1||!["escape","html","link","image","strong","em","codespan","br","del","text"].includes(n.type)){s+=o||"";continue}}let i=n;switch(i.type){case"escape":{s+=t.text(i);break}case"html":{s+=t.html(i);break}case"link":{s+=t.link(i);break}case"image":{s+=t.image(i);break}case"strong":{s+=t.strong(i);break}case"em":{s+=t.em(i);break}case"codespan":{s+=t.codespan(i);break}case"br":{s+=t.br(i);break}case"del":{s+=t.del(i);break}case"text":{s+=t.text(i);break}default:{let o='Token with "'+i.type+'" type was not found.';if(this.options.silent)return console.error(o),"";throw new Error(o)}}}return s}},re=class{options;block;constructor(a){this.options=a||V}static passThroughHooks=new Set(["preprocess","postprocess","processAllTokens","emStrongMask"]);static passThroughHooksRespectAsync=new Set(["preprocess","postprocess","processAllTokens"]);preprocess(a){return a}postprocess(a){return a}processAllTokens(a){return a}emStrongMask(a){return a}provideLexer(){return this.block?P.lex:P.lexInline}provideParser(){return this.block?E.parse:E.parseInline}},mr=class{defaults=Le();options=this.setOptions;parse=this.parseMarkdown(!0);parseInline=this.parseMarkdown(!1);Parser=E;Renderer=xe;TextRenderer=Ke;Lexer=P;Tokenizer=ke;Hooks=re;constructor(...a){this.use(...a)}walkTokens(a,e){let t=[];for(let s of a)switch(t=t.concat(e.call(this,s)),s.type){case"table":{let r=s;for(let n of r.header)t=t.concat(this.walkTokens(n.tokens,e));for(let n of r.rows)for(let i of n)t=t.concat(this.walkTokens(i.tokens,e));break}case"list":{let r=s;t=t.concat(this.walkTokens(r.items,e));break}default:{let r=s;this.defaults.extensions?.childTokens?.[r.type]?this.defaults.extensions.childTokens[r.type].forEach(n=>{let i=r[n].flat(1/0);t=t.concat(this.walkTokens(i,e))}):r.tokens&&(t=t.concat(this.walkTokens(r.tokens,e)))}}return t}use(...a){let e=this.defaults.extensions||{renderers:{},childTokens:{}};return a.forEach(t=>{let s={...t};if(s.async=this.defaults.async||s.async||!1,t.extensions&&(t.extensions.forEach(r=>{if(!r.name)throw new Error("extension name required");if("renderer"in r){let n=e.renderers[r.name];n?e.renderers[r.name]=function(...i){let o=r.renderer.apply(this,i);return o===!1&&(o=n.apply(this,i)),o}:e.renderers[r.name]=r.renderer}if("tokenizer"in r){if(!r.level||r.level!=="block"&&r.level!=="inline")throw new Error("extension level must be 'block' or 'inline'");let n=e[r.level];n?n.unshift(r.tokenizer):e[r.level]=[r.tokenizer],r.start&&(r.level==="block"?e.startBlock?e.startBlock.push(r.start):e.startBlock=[r.start]:r.level==="inline"&&(e.startInline?e.startInline.push(r.start):e.startInline=[r.start]))}"childTokens"in r&&r.childTokens&&(e.childTokens[r.name]=r.childTokens)}),s.extensions=e),t.renderer){let r=this.defaults.renderer||new xe(this.defaults);for(let n in t.renderer){if(!(n in r))throw new Error(`renderer '${n}' does not exist`);if(["options","parser"].includes(n))continue;let i=n,o=t.renderer[i],l=r[i];r[i]=(...c)=>{let d=o.apply(r,c);return d===!1&&(d=l.apply(r,c)),d||""}}s.renderer=r}if(t.tokenizer){let r=this.defaults.tokenizer||new ke(this.defaults);for(let n in t.tokenizer){if(!(n in r))throw new Error(`tokenizer '${n}' does not exist`);if(["options","rules","lexer"].includes(n))continue;let i=n,o=t.tokenizer[i],l=r[i];r[i]=(...c)=>{let d=o.apply(r,c);return d===!1&&(d=l.apply(r,c)),d}}s.tokenizer=r}if(t.hooks){let r=this.defaults.hooks||new re;for(let n in t.hooks){if(!(n in r))throw new Error(`hook '${n}' does not exist`);if(["options","block"].includes(n))continue;let i=n,o=t.hooks[i],l=r[i];re.passThroughHooks.has(n)?r[i]=c=>{if(this.defaults.async&&re.passThroughHooksRespectAsync.has(n))return(async()=>{let h=await o.call(r,c);return l.call(r,h)})();let d=o.call(r,c);return l.call(r,d)}:r[i]=(...c)=>{if(this.defaults.async)return(async()=>{let h=await o.apply(r,c);return h===!1&&(h=await l.apply(r,c)),h})();let d=o.apply(r,c);return d===!1&&(d=l.apply(r,c)),d}}s.hooks=r}if(t.walkTokens){let r=this.defaults.walkTokens,n=t.walkTokens;s.walkTokens=function(i){let o=[];return o.push(n.call(this,i)),r&&(o=o.concat(r.call(this,i))),o}}this.defaults={...this.defaults,...s}}),this}setOptions(a){return this.defaults={...this.defaults,...a},this}lexer(a,e){return P.lex(a,e??this.defaults)}parser(a,e){return E.parse(a,e??this.defaults)}parseMarkdown(a){return(e,t)=>{let s={...t},r={...this.defaults,...s},n=this.onError(!!r.silent,!!r.async);if(this.defaults.async===!0&&s.async===!1)return n(new Error("marked(): The async option was set to true by an extension. Remove async: false from the parse options object to return a Promise."));if(typeof e>"u"||e===null)return n(new Error("marked(): input parameter is undefined or null"));if(typeof e!="string")return n(new Error("marked(): input parameter is of type "+Object.prototype.toString.call(e)+", string expected"));if(r.hooks&&(r.hooks.options=r,r.hooks.block=a),r.async)return(async()=>{let i=r.hooks?await r.hooks.preprocess(e):e,o=await(r.hooks?await r.hooks.provideLexer():a?P.lex:P.lexInline)(i,r),l=r.hooks?await r.hooks.processAllTokens(o):o;r.walkTokens&&await Promise.all(this.walkTokens(l,r.walkTokens));let c=await(r.hooks?await r.hooks.provideParser():a?E.parse:E.parseInline)(l,r);return r.hooks?await r.hooks.postprocess(c):c})().catch(n);try{r.hooks&&(e=r.hooks.preprocess(e));let i=(r.hooks?r.hooks.provideLexer():a?P.lex:P.lexInline)(e,r);r.hooks&&(i=r.hooks.processAllTokens(i)),r.walkTokens&&this.walkTokens(i,r.walkTokens);let o=(r.hooks?r.hooks.provideParser():a?E.parse:E.parseInline)(i,r);return r.hooks&&(o=r.hooks.postprocess(o)),o}catch(i){return n(i)}}}onError(a,e){return t=>{if(t.message+=`
Please report this to https://github.com/markedjs/marked.`,a){let s="<p>An error occurred:</p><pre>"+R(t.message+"",!0)+"</pre>";return e?Promise.resolve(s):s}if(e)return Promise.reject(t);throw t}}},H=new mr;function b(a,e){return H.parse(a,e)}b.options=b.setOptions=function(a){return H.setOptions(a),b.defaults=H.defaults,yt(b.defaults),b};b.getDefaults=Le;b.defaults=V;b.use=function(...a){return H.use(...a),b.defaults=H.defaults,yt(b.defaults),b};b.walkTokens=function(a,e){return H.walkTokens(a,e)};b.parseInline=H.parseInline;b.Parser=E;b.parser=E.parse;b.Renderer=xe;b.TextRenderer=Ke;b.Lexer=P;b.lexer=P.lex;b.Tokenizer=ke;b.Hooks=re;b.parse=b;b.options;b.setOptions;b.use;b.walkTokens;b.parseInline;E.parse;P.lex;const wr=`You are an assistant in a web application with workspace, editors, and AI chat.

**Tools:**
Commands are exposed as AI-callable tools. Tools are context-aware - available commands depend on active editor, selected files, and workspace state.

**Tool Usage Rules:**
1. If tools are available and match the request, use them - don't describe manual steps
2. Read tool descriptions/parameters to select the correct tool
3. Call tools in sequence for multi-step tasks
4. After successful tool execution, provide a final response - don't loop or call more tools unless explicitly requested
5. If no tools are available, explain what context is needed

Keep responses concise. Use tools when available rather than discussing alternatives.

`,vr=[{label:"Ollama (Local)",name:"ollama",model:"gemma3:12b",chatApiEndpoint:"https://<your-server>/v1/chat/completions",apiKey:""},{label:"OpenWebUI (Self Hosted)",name:"openwebui",model:"gemma3:12b",chatApiEndpoint:"https://<your-server>/api/v1/chat/completion",apiKey:""},{label:"OpenAI",name:"openai",model:"gpt-4.1",chatApiEndpoint:"https://api.openai.com/v1/chat/completions",apiKey:"<your api key>"},{label:"Groq",name:"groq",model:"llama-3.1-8b-instant",chatApiEndpoint:"https://api.groq.com/openai/v1/chat/completions",apiKey:"<your api key>"},{label:"Cerebras",name:"cerebras",model:"llama3.1-8b",chatApiEndpoint:"https://api.cerebras.ai/v1/chat/completions",apiKey:"<your api key>"},{label:"WebLLM",name:"webllm",model:"gemma-2-9b-it-q4f16_1-MLC",chatApiEndpoint:"",apiKey:"",parameters:{context_window_size:4096}},{label:"Mistral",name:"mistral",model:"mistral-large-latest",chatApiEndpoint:"https://api.mistral.ai/v1/chat/completions",apiKey:"<your api key>"},{label:"LiteLLM",name:"litellm",model:"gpt-3.5-turbo",chatApiEndpoint:"https://<your-server>/v1/chat/completions",apiKey:"<your api key>"}];for(const{label:a,...e}of vr)U.registerContribution(ve,{target:ve,label:a,provider:e});const br={priority:20,enhance:async(a,e)=>{try{const t=await Lt.getWorkspace(),s=qe.getEditorArea()?.getActiveEditor(),r={workspace:t?.getName()||null,activeEditor:s?{title:s.input?.title||null,editorId:s.input?.editorId||null}:null};return`${a}

***App's state:***
${JSON.stringify(r,null,2)}`}catch{return a}}};U.registerContribution(gt,{label:"App State Enhancer",enhancer:br});class yr{constructor(){this.activeSession=null,this.pastSessions=[]}async load(){const e=await x.get("aiChatSessions");if(e){if(e.active&&Array.isArray(e.history))this.activeSession=e.active;else if(e.activeSessionId&&Array.isArray(e.sessions))this.activeSession=e.sessions.find(t=>t.id===e.activeSessionId)||null,this.pastSessions=e.sessions.filter(t=>t.id!==e.activeSessionId);else if(Array.isArray(e.all)){const[t,...s]=e.all.sort((r,n)=>n.updatedAt-r.updatedAt);this.activeSession=t||null,this.pastSessions=s}}}async persist(){const e=[];this.activeSession&&e.push(this.activeSession),e.push(...this.pastSessions),await x.set("aiChatSessions",{all:e,activeSessionId:this.activeSession?.id||null})}createSession(){const e={id:`session-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,history:[],title:"New Chat",createdAt:Date.now(),updatedAt:Date.now()};return this.activeSession&&this.pastSessions.unshift(this.activeSession),this.activeSession=e,this.persist(),e}getActiveSession(){return this.activeSession}getActiveSessionId(){return this.activeSession?.id||""}switchToSession(e){if(this.activeSession?.id===e)return!0;const t=this.pastSessions.findIndex(r=>r.id===e);if(t===-1)return!1;const[s]=this.pastSessions.splice(t,1);return s?(this.activeSession&&this.pastSessions.unshift(this.activeSession),this.activeSession=s,this.persist(),!0):!1}getPastSessions(){return this.pastSessions}deletePastSession(e){const t=this.pastSessions.findIndex(s=>s.id===e);return t===-1?!1:(this.pastSessions.splice(t,1),this.persist(),!0)}addMessage(e){this.activeSession&&(this.activeSession.history.push(e),this.activeSession.updatedAt=Date.now(),this.persist())}setTitle(e){this.activeSession&&(this.activeSession.title=e,this.persist())}generateTitle(e){const t=e.trim();return t?t.length<=30?t:t.substring(0,30).trim()+"...":"New Chat"}deleteActiveAndSwitchToFirst(){this.activeSession&&(this.activeSession=this.pastSessions.shift()||null,this.activeSession||this.createSession(),this.persist())}}class kr{constructor(e){this.streamingMessages=new Map,this.currentIndex=-1,this.pendingUpdate=!1,this.onUpdate=e}createStreamingMessage(e){const t=++this.currentIndex;return this.streamingMessages.set(t,{message:{role:e,content:""},isStreaming:!0}),t}updateStreamingMessage(e,t){const s=this.streamingMessages.get(e);s&&(s.message.content+=t,this.scheduleUpdate())}completeStreamingMessage(e,t){const s=this.streamingMessages.get(e);s&&(s.message=t,s.isStreaming=!1)}removeStreamingMessage(e){this.streamingMessages.delete(e)}findStreamingMessage(e){return Array.from(this.streamingMessages.values()).find(t=>t.message.role===e)?.message}getAllStreamingMessages(){return Array.from(this.streamingMessages.values())}scheduleUpdate(){this.pendingUpdate||(this.pendingUpdate=!0,this.rafHandle=requestAnimationFrame(()=>{this.pendingUpdate=!1,this.onUpdate?.()}))}cancelUpdates(){this.rafHandle!==void 0&&(cancelAnimationFrame(this.rafHandle),this.rafHandle=void 0,this.pendingUpdate=!1)}reset(){this.streamingMessages.clear(),this.cancelUpdates(),this.currentIndex=-1}}const Me="aiViewChat";class xr{constructor(e){this.aiService=e,this.providers=[],this.availableModels=[],this.loadingModels=!1,this.providerFactory=new pe}async initialize(){this.providers=await this.aiService.getProviders()||[];const e=await this.aiService.getDefaultProvider();e&&(this.selectedProvider=e)}getProviders(){return this.providers}getSelectedProvider(){return this.selectedProvider}setSelectedProvider(e){this.selectedProvider=e}getAvailableModels(){return this.availableModels}isLoadingModels(){return this.loadingModels}async saveSettings(e,t,s,r,n){const o={...await x.get(Me)||{}};r!==void 0&&(o.requireToolApproval=r),n!==void 0&&(o.toolApprovalAllowlist=n),await x.set(Me,o);const l=this.providers.find(c=>c.name===e);if(l){const c={...l,model:t,...s!==void 0&&{apiKey:s}};this.selectedProvider=c,await this.updateProviderInAIConfig(e,{model:t,...s!==void 0&&{apiKey:s}}),await this.aiService.setDefaultProvider(e)}}async updateProviderInAIConfig(e,t){const s=await x.get(M)||{};if(!s.providers||!Array.isArray(s.providers))return;const r=s.providers.findIndex(n=>n.name===e);r>=0&&(s.providers[r]={...s.providers[r],...t},await x.set(M,s))}async loadToolApprovalAllowlist(){return(await x.get(Me)||{}).toolApprovalAllowlist||[]}async fetchModels(e){const t=this.providers.find(s=>s.name===e);if(t){this.loadingModels=!0,this.availableModels=[];try{const s=this.providerFactory.getProvider(t);this.availableModels=await s.getAvailableModels?.(t)??[]}finally{this.loadingModels=!1}}}}class Ar{constructor(){this.groups=new Map}createGroup(e,t,s,r,n){const i=`group-${Date.now()}-${Math.random().toString(36).slice(2,9)}`;this.currentGroupId=i;const o={id:i,sessionId:e,userMessageIndex:t,userMessage:s,timestamp:new Date,agents:new Map,messageIndices:new Map};return r.forEach(l=>{const{label:c,icon:d}=n(l);o.agents.set(l,{role:l,label:c,icon:d,status:"streaming"})}),this.groups.set(i,o),i}getGroup(e){return this.groups.get(e)}updateAgentStatus(e,t,s,r,n){const i=this.groups.get(e);if(!i)return;const o=i.agents.get(t);o&&(o.status=s,r&&(o.message=r),n!==void 0&&(o.messageIndex=n,i.messageIndices.set(t,n)))}getGroupsForSession(e){return Array.from(this.groups.values()).filter(t=>t.sessionId===e)}findGroupForUserMessage(e,t,s){return Array.from(this.groups.values()).find(r=>r.sessionId===e&&r.userMessageIndex===t&&r.userMessage===s)}findGroupForMessage(e,t,s){return Array.from(this.groups.values()).find(r=>r.sessionId===e&&r.messageIndices.get(t)===s)}getCurrentGroupId(){return this.currentGroupId}setCurrentGroupId(e){this.currentGroupId=e}clearCurrentGroup(){this.currentGroupId=void 0}getAllGroups(){return Array.from(this.groups.values())}clearAll(){this.groups.clear(),this.currentGroupId=void 0}}var Cr=Object.defineProperty,Sr=Object.getOwnPropertyDescriptor,ge=(a,e,t,s)=>{for(var r=s>1?void 0:s?Sr(e,t):e,n=a.length-1,i;n>=0;n--)(i=a[n])&&(r=(s?i(e,t,r):i(r))||r);return s&&r&&Cr(e,t,r),r};let F=class extends W{constructor(){super(...arguments),this.isStreaming=!1,this.showHeader=!0}updated(a){super.updated(a),(a.has("message")||!this.hasAttribute("data-is-user"))&&this.updateAlignment()}updateAlignment(){this.message&&this.setAttribute("data-is-user",String(this.message.role==="user"))}copyToClipboard(a){navigator.clipboard.writeText(a).catch(e=>console.error("Failed to copy:",e))}processMarkdownContent(a){return a.includes("code-blocwrapper")?a:a.replace(/<pre><code([^>]*)>([\s\S]*?)<\/code><\/pre>/gi,(e,t,s)=>`
            <div class="code-blocwrapper">
                <div class="code-blocheader">
                    <wa-copy-button value="${this.escapeHtmlAttribute(s.trim())}" size="small" label="Copy code"></wa-copy-button>
                </div>
                <div class="code-bloccontent">
                    <pre><code${t}>${s}</code></pre>
                </div>
            </div>`)}escapeHtmlAttribute(a){return a.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;").replace(/'/g,"&#39;")}handleResend(a){a?.preventDefault(),a?.stopPropagation(),this.message&&this.dispatchEvent(new CustomEvent("resend",{detail:{message:this.message,messageIndex:this.messageIndex},bubbles:!0,composed:!0}))}render(){if(!this.message)return u``;const a=this.message,e=a.role==="user";return u`
            <div class="message-wrapper ${e?"user":"assistant"} ${this.isStreaming?"streaming":""}">
                ${A(this.showHeader&&!e,()=>u`
                    <div class="message-header">
                        <div class="message-meta">
                            <wa-icon name="robot" label="${a.role}"></wa-icon>
                            <span class="role-name">${a.role}</span>
                        </div>
                    <div class="message-actions">
                        <wa-button variant="neutral" appearance="plain" size="small" title="Copy"
                            @click="${()=>this.copyToClipboard(a.content)}">
                            <wa-icon slot="label" name="copy" label="Copy"></wa-icon>
                        </wa-button>
                    </div>
                    </div>
                `)}
                <div class="message-content-wrapper ${e?"user":""}">
                    <div class="message-content">
                        ${Bt(this.processMarkdownContent(b.parse(a.content||"")))}
                        ${A(this.isStreaming,()=>u`<span class="streaming-cursor">▋</span>`)}
                    </div>
                    ${A(e,()=>u`
                        <wa-button variant="neutral" appearance="plain" size="small" title="Copy"
                            @click="${()=>this.copyToClipboard(a.content)}">
                            <wa-icon name="copy" label="Copy"></wa-icon>
                        </wa-button>
                        <wa-button variant="neutral" appearance="plain" size="small" title="Resend"
                            @click="${t=>this.handleResend(t)}">
                            <wa-icon name="rotate-right" label="Resend"></wa-icon>
                        </wa-button>
                    `)}
                </div>
            </div>
        `}};F.styles=z`
        :host {
            display: flex;
            flex-direction: column;
            width: 100%;
            max-width: 85%;
            box-sizing: border-box;
            animation: slideIn 0.2s ease-out;
        }

        :host([data-is-user="true"]) { align-self: flex-end; }
        :host([data-is-user="false"]) { align-self: flex-start; }

        @keyframes slideIn {
            from { opacity: 0; transform: translateY(10px); }
            to { opacity: 1; transform: translateY(0); }
        }

        .message-wrapper {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            width: 100%;
            box-sizing: border-box;
        }

        .message-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 0.5rem;
            padding: 0 0.5rem;
        }

        .message-meta {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            font-size: 0.875rem;
            color: var(--wa-color-text-quiet);
        }

        .role-name { text-transform: capitalize; }

        .message-actions {
            display: flex;
            gap: 0.25rem;
            opacity: 0;
            transition: opacity 0.2s;
        }

        .message-wrapper:hover .message-actions,
        :host:hover .message-actions { opacity: 1; }

        .message-content-wrapper {
            display: flex;
            align-items: flex-start;
            gap: 0.5rem;
            width: 100%;
        }

        .message-content-wrapper.user {
            flex-direction: row;
            align-items: center;
        }

        .message-content {
            padding: 0.5rem 0.75rem;
            border-radius: 0.25rem;
            background-color: var(--wa-color-surface-default);
            word-break: breaword;
            overflow-wrap: breaword;
            max-width: 100%;
            box-sizing: border-box;
            line-height: 1.3;
            font-size: 0.9rem;
        }

        .message-content-wrapper.user .message-content {
            padding: 0.0625rem 0.75rem;
            background-color: var(--wa-color-brand-fill-quiet);
            color: var(--wa-color-text-normal);
            line-height: 1.4;
            flex: 1;
        }

        .message-content p { margin: 0; padding: 0; }
        .message-content ul, .message-content ol { margin: 0.25rem 0; padding-left: 1.25rem; }
        .message-content li { margin: 0.125rem 0; padding: 0; line-height: 1.3; }
        .message-content :first-child { margin-top: 0; padding-top: 0; }
        .message-content :last-child { margin-bottom: 0; padding-bottom: 0; }

        .message-content pre {
            white-space: pre-wrap;
            word-break: breaall;
            max-width: 100%;
            box-sizing: border-box;
            overflow-x: auto;
            margin: 0;
        }

        .message-content code {
            font-family: 'Courier New', monospace;
            background-color: var(--wa-color-surface-lowered);
            padding: 0.125rem 0.25rem;
            border-radius: 0.125rem;
        }

        .message-content pre code { background-color: transparent; padding: 0; display: block; }

        .code-blocwrapper {
            margin: 0.75rem 0;
            border: solid var(--wa-border-width-s) var(--wa-color-neutral-border-loud);
            border-radius: var(--wa-border-radius-m);
            background-color: var(--wa-color-surface-lowered);
            overflow: hidden;
        }

        .code-blocheader {
            display: flex;
            justify-content: flex-end;
            align-items: center;
            padding: 0.375rem 0.5rem;
            border-bottom: solid var(--wa-border-width-s) var(--wa-color-neutral-border-loud);
            background-color: var(--wa-color-surface-default);
        }

        .code-bloccontent { padding: 0.75rem; overflow-x: auto; }
        .code-bloccontent pre { margin: 0; background-color: transparent; }
        .code-bloccontent code { background-color: transparent; padding: 0; }

        .streaming-cursor {
            display: inline-block;
            animation: blink 1s infinite;
            color: var(--wa-color-brand-50);
        }

        @keyframes blink {
            0%, 50% { opacity: 1; }
            51%, 100% { opacity: 0; }
        }
    `;ge([S({type:Object,attribute:!1})],F.prototype,"message",2);ge([S({type:Boolean})],F.prototype,"isStreaming",2);ge([S({type:Boolean})],F.prototype,"showHeader",2);ge([S({type:Number,attribute:!1})],F.prototype,"messageIndex",2);F=ge([D("lyra-ai-chat-message")],F);var Tr=Object.defineProperty,$r=Object.getOwnPropertyDescriptor,Q=(a,e,t,s)=>{for(var r=s>1?void 0:s?$r(e,t):e,n=a.length-1,i;n>=0;n--)(i=a[n])&&(r=(s?i(e,t,r):i(r))||r);return s&&r&&Tr(e,t,r),r};let G=class extends W{constructor(){super(...arguments),this.value="",this.disabled=!1,this.busy=!1,this.hasProvider=!0}onInput(a){this.value=a.target.value,this.dispatchEvent(new CustomEvent("input-change",{detail:{value:this.value},bubbles:!0,composed:!0}))}onKeyDown(a){a.key==="Enter"&&!a.shiftKey&&(a.preventDefault(),this.send())}async send(){if(!this.value.trim()||this.disabled||!this.hasProvider)return;const a=this.value;this.value="",this.requestUpdate(),await this.updateComplete,this.textareaElement&&(this.textareaElement.value="",this.textareaElement.focus()),this.dispatchEvent(new CustomEvent("send",{detail:{value:a},bubbles:!0,composed:!0}))}cancel(){this.dispatchEvent(new CustomEvent("cancel",{bubbles:!0,composed:!0}))}render(){return u`
            <div class="input-container">
                <div class="input-row">
                    <wa-textarea
                        placeholder="Type a message... (Enter to send, Shift+Enter for new line)"
                        size="small"
                        resize="auto"
                        rows="1"
                        .value="${this.value}"
                        ?disabled="${this.disabled||!this.hasProvider}"
                        @input="${this.onInput}"
                        @keydown="${this.onKeyDown}">
                    </wa-textarea>
                    ${A(this.busy,()=>u`
                        <wa-button appearance="plain" size="small" @click="${this.cancel}">
                            <wa-icon name="stop" label="Stop"></wa-icon>
                        </wa-button>
                    `)}
                </div>
            </div>
        `}};G.styles=z`
        :host { display: block; width: 100%; }
        .input-container { margin-bottom: 0.25rem; margin-left: 0.25rem; }
        .input-row { display: flex; gap: 0.5rem; align-items: flex-end; }
        wa-textarea { flex: 1; min-width: 0; }
    `;Q([S({type:String})],G.prototype,"value",2);Q([S({type:Boolean})],G.prototype,"disabled",2);Q([S({type:Boolean})],G.prototype,"busy",2);Q([S({type:Boolean})],G.prototype,"hasProvider",2);Q([Dt("wa-textarea")],G.prototype,"textareaElement",2);G=Q([D("lyra-ai-chat-input")],G);var _r=Object.defineProperty,Pr=Object.getOwnPropertyDescriptor,Ze=(a,e,t,s)=>{for(var r=s>1?void 0:s?Pr(e,t):e,n=a.length-1,i;n>=0;n--)(i=a[n])&&(r=(s?i(e,t,r):i(r))||r);return s&&r&&_r(e,t,r),r};let ie=class extends W{copyToClipboard(a){navigator.clipboard.writeText(a).catch(e=>console.error("Failed to copy:",e))}renderStatusIcon(a){switch(a){case"streaming":return u`<wa-icon name="spinner" class="spinning"></wa-icon>`;case"completed":return u`<wa-icon name="check-circle" class="status-success"></wa-icon>`;case"error":return u`<wa-icon name="exclamation-circle" class="status-error"></wa-icon>`}}renderCard(a,e){return e?u`
            <div class="agent-card status-${a.status}">
                <div class="agent-card-header">
                    <wa-icon name="${a.icon}" label="${a.label}"></wa-icon>
                    <span>${a.label}</span>
                    ${this.renderStatusIcon(a.status)}
                    <div class="agent-card-actions">
                        <wa-button variant="neutral" appearance="plain" size="small" title="Copy"
                            @click="${()=>this.copyToClipboard(e.content||"")}">
                            <wa-icon name="copy" label="Copy"></wa-icon>
                        </wa-button>
                    </div>
                </div>
                <div class="agent-card-content">
                    <lyra-ai-chat-message
                        .message="${e}"
                        .isStreaming="${a.status==="streaming"}"
                        .showHeader="${!1}"
                        .messageIndex="${a.messageIndex}">
                    </lyra-ai-chat-message>
                </div>
            </div>
        `:u`
                <div class="agent-card status-${a.status}">
                    <div class="agent-card-header">
                        <wa-icon name="${a.icon}" label="${a.label}"></wa-icon>
                        <span>${a.label}</span>
                        ${this.renderStatusIcon(a.status)}
                    </div>
                    <div class="agent-card-content waiting">Waiting for response...</div>
                </div>
            `}render(){if(!this.group)return u``;const a=Array.from(this.group.agents.values()),e=a.filter(i=>i.status==="completed").length,t=a.filter(i=>i.status==="streaming").length,s=a.filter(i=>i.status==="error").length,r=a.length>0&&e+s===a.length,n=a.length===1;return u`
            <div class="agent-response-group">
                ${A(!n,()=>u`
                    <div class="group-header">
                        <wa-icon name="robot" label="Multiple Agents"></wa-icon>
                        <span>Multiple Agents</span>
                        <span class="status-badge">
                            ${A(t>0,()=>u`<span class="streaming">${t} responding</span>`)}
                            ${A(r,()=>u`<span class="done">All completed (${e})</span>`)}
                        </span>
                    </div>
                `)}
                <div class="group-content">
                    ${ce(a,i=>i.role,i=>{const o=i.message||(i.status==="streaming"&&this.findStreamingMessage?this.findStreamingMessage(i.role):void 0);return this.renderCard(i,o)})}
                </div>
            </div>
        `}};ie.styles=z`
        :host { display: block; width: 100%; box-sizing: border-box; }

        .agent-response-group {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            width: 100%;
        }

        .group-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 0.75rem;
            background-color: var(--wa-color-surface-lowered);
            border: solid var(--wa-border-width-s) var(--wa-color-surface-border);
            font-weight: 500;
        }

        .status-badge {
            display: flex;
            gap: 0.5rem;
            margin-left: auto;
            font-size: 0.875rem;
        }

        .streaming { color: var(--wa-color-brand-50); }
        .done { color: var(--wa-color-success-70); font-weight: 600; }

        .group-content {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            width: 100%;
        }

        .agent-card {
            display: flex;
            flex-direction: column;
            border: solid var(--wa-border-width-s) var(--wa-color-surface-border);
            background-color: var(--wa-color-surface-default);
        }

        .agent-card.status-streaming { border-color: var(--wa-color-brand-border-quiet); }
        .agent-card.status-completed { border-color: var(--wa-color-success-border-quiet); }
        .agent-card.status-error { border-color: var(--wa-color-danger-border-quiet); }

        .agent-card-header {
            display: flex;
            align-items: center;
            gap: 0.375rem;
            padding: 0.375rem 0.5rem;
            border-bottom: solid var(--wa-border-width-s) var(--wa-color-surface-border);
            background-color: var(--wa-color-surface-lowered);
            font-weight: 500;
            font-size: 0.875rem;
        }

        .agent-card-actions { margin-left: auto; display: flex; gap: 0.25rem; }
        .agent-card-content { padding: 0.375rem; }
        .waiting { padding: 1rem; text-align: center; color: var(--wa-color-text-quiet); }

        .spinning { animation: spin 1s linear infinite; }
        .status-success { color: var(--wa-color-success-60); }
        .status-error { color: var(--wa-color-danger-60); }

        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
    `;Ze([S({type:Object,attribute:!1})],ie.prototype,"group",2);Ze([S({type:Function,attribute:!1})],ie.prototype,"findStreamingMessage",2);ie=Ze([D("lyra-ai-agent-response-group")],ie);var Er=Object.defineProperty,Mr=Object.getOwnPropertyDescriptor,Mt=(a,e,t,s)=>{for(var r=s>1?void 0:s?Mr(e,t):e,n=a.length-1,i;n>=0;n--)(i=a[n])&&(r=(s?i(e,t,r):i(r))||r);return s&&r&&Er(e,t,r),r};let Ae=class extends W{constructor(){super(...arguments),this.pendingApprovals=new Map}approve(a,e){this.dispatchEvent(new CustomEvent("approve",{detail:{approvalId:a,approval:e},bubbles:!0,composed:!0})),e.resolve(!0),this.pendingApprovals.delete(a),this.requestUpdate()}deny(a,e){e.resolve(!1),this.pendingApprovals.delete(a),this.requestUpdate()}formatArgs(a){let e={};try{e=JSON.parse(a)}catch{}return Object.entries(e).map(([t,s])=>`${t}=${JSON.stringify(s)}`).join(", ")}render(){return this.pendingApprovals.size===0?u``:u`
            <div class="approval-container">
                ${Array.from(this.pendingApprovals.entries()).map(([a,e])=>{const t=e.request.toolCalls,s=t[0],r=t.length===1?`AI wants to execute: ${s?.function.name}()`:`AI wants to execute ${t.length} tools`;return u`
                        <wa-details class="approval-item">
                            <span slot="summary" class="approval-summary">
                                <span>${r}</span>
                                <div class="approval-inline-actions">
                                    <wa-button appearance="plain" size="small" variant="neutral"
                                        @click="${n=>{n.stopPropagation(),this.deny(a,e)}}">
                                        <wa-icon name="xmark" label="Deny"></wa-icon>
                                    </wa-button>
                                    <wa-button appearance="plain" size="small" variant="success"
                                        @click="${async n=>{n.stopPropagation(),this.approve(a,e)}}">
                                        <wa-icon name="check" label="Approve"></wa-icon>
                                    </wa-button>
                                </div>
                            </span>
                            <div class="approval-detail">
                                <strong>${e.role} wants to execute:</strong>
                                <ul class="tool-list">
                                    ${ce(t,n=>n.id,n=>{const i=this.formatArgs(n.function.arguments||"{}"),o=e.alwaysAllowSelections.get(n.id)||!1;return u`
                                            <li class="tool-item">
                                                <label class="always-allow-label">
                                                    <wa-checkbox
                                                        ?checked="${o}"
                                                        @change="${l=>{e.alwaysAllowSelections.set(n.id,l.target.checked),this.requestUpdate()}}">
                                                    </wa-checkbox>
                                                    <span>Always allow</span>
                                                </label>
                                                <code>${n.function.name}(${i})</code>
                                            </li>
                                        `})}
                                </ul>
                            </div>
                        </wa-details>
                    `})}
            </div>
        `}};Ae.styles=z`
        :host { display: block; }

        .approval-container {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            padding: 0.75rem 1rem;
            border-top: solid var(--wa-border-width-s) var(--wa-color-warning-border-normal);
            background-color: var(--wa-color-warning-fill-quiet);
        }

        .approval-summary {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 1rem;
            width: 100%;
        }

        .approval-inline-actions { display: flex; gap: 0.5rem; flex-shrink: 0; }

        .approval-detail {
            display: flex;
            flex-direction: column;
            gap: 0.5rem;
            padding: 0.75rem 0;
            font-size: 0.875rem;
        }

        .tool-list { margin: 0.5rem 0 0 1.5rem; padding: 0; list-style: disc; }

        .tool-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            margin: 0.5rem 0;
        }

        .always-allow-label {
            display: flex;
            align-items: center;
            gap: 0.375rem;
            cursor: pointer;
        }

        code {
            font-family: var(--wa-font-mono);
            font-size: 0.875rem;
            padding: 0.125rem 0.25rem;
            background-color: var(--wa-color-neutral-fill-subtle);
            border-radius: var(--wa-border-radius-s);
        }
    `;Mt([S({type:Map,attribute:!1})],Ae.prototype,"pendingApprovals",2);Ae=Mt([D("lyra-ai-tool-approval")],Ae);var Rr=Object.defineProperty,Ir=Object.getOwnPropertyDescriptor,Je=(a,e,t,s)=>{for(var r=s>1?void 0:s?Ir(e,t):e,n=a.length-1,i;n>=0;n--)(i=a[n])&&(r=(s?i(e,t,r):i(r))||r);return s&&r&&Rr(e,t,r),r};let oe=class extends W{constructor(){super(...arguments),this.message="No AI provider configured",this.hint="Click the settings icon to configure an AI provider"}render(){return u`
            <div class="empty-state">
                <wa-icon name="robot" style="font-size: 3rem; opacity: 0.3;"></wa-icon>
                <p>${this.message}</p>
                <p class="hint">${this.hint}</p>
            </div>
        `}};oe.styles=z`
        :host {
            display: flex;
            align-items: center;
            justify-content: center;
            width: 100%;
            height: 100%;
        }

        .empty-state {
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            padding: 2rem;
            text-align: center;
            color: var(--wa-color-text-quiet);
        }

        .empty-state p { margin: 0.5rem 0; }
        .hint { font-size: 0.875rem; opacity: 0.7; }
    `;Je([S({type:String})],oe.prototype,"message",2);Je([S({type:String})],oe.prototype,"hint",2);oe=Je([D("lyra-ai-empty-state")],oe);var Or=Object.defineProperty,zr=Object.getOwnPropertyDescriptor,Ye=(a,e,t,s)=>{for(var r=s>1?void 0:s?zr(e,t):e,n=a.length-1,i;n>=0;n--)(i=a[n])&&(r=(s?i(e,t,r):i(r))||r);return s&&r&&Or(e,t,r),r};const Dr={running:"spinner",completed:"check-circle",failed:"exclamation-circle",skipped:"forward",pending:"circle"},qr={running:"var(--wa-color-brand-50)",completed:"var(--wa-color-success-60)",failed:"var(--wa-color-danger-60)",skipped:"var(--wa-color-neutral-40)",pending:"var(--wa-color-neutral-40)"};let le=class extends W{constructor(){super(...arguments),this.expanded=!0}render(){if(!this.plan)return u``;const a=this.plan.steps.filter(s=>s.status==="completed").length,e=this.plan.steps.length,t=e>0?Math.round(a/e*100):0;return u`
            <div class="taspanel">
                <div class="panel-header" @click="${()=>{this.expanded=!this.expanded}}">
                    <wa-icon name="diagram-project" label="Task Plan"></wa-icon>
                    <span class="panel-title">Task Plan</span>
                    <span class="progress-text">${a}/${e}</span>
                    <wa-progress-bar value="${t}" class="progress-bar"></wa-progress-bar>
                    <wa-icon name="${this.expanded?"chevron-up":"chevron-down"}" label="toggle"></wa-icon>
                </div>
                ${A(this.expanded,()=>u`
                    <div class="panel-body">
                        ${ce(this.plan.steps,s=>s.id,s=>u`
                            <div class="step-row">
                                <wa-icon
                                    name="${Dr[s.status]??"circle"}"
                                    style="color: ${qr[s.status]??"var(--wa-color-neutral-40)"}; ${s.status==="running"?"animation: spin 1s linear infinite;":""}">
                                </wa-icon>
                                <div class="step-info">
                                    <span class="step-role">${s.role}</span>
                                    <span class="step-task">${s.subTask}</span>
                                </div>
                                ${A(s.revisions>0,()=>u`
                                    <span class="revisions-badge">${s.revisions} rev</span>
                                `)}
                            </div>
                        `)}
                    </div>
                `)}
            </div>
        `}};le.styles=z`
        :host { display: block; }

        .taspanel {
            border: solid var(--wa-border-width-s) var(--wa-color-brand-border-quiet);
            border-radius: var(--wa-border-radius-m);
            background: var(--wa-color-surface-default);
            margin: 0.5rem 0;
        }

        .panel-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 0.75rem;
            cursor: pointer;
            user-select: none;
        }

        .panel-title {
            font-weight: 500;
            flex: 0 0 auto;
        }

        .progress-text {
            font-size: 0.8rem;
            color: var(--wa-color-text-quiet);
        }

        .progress-bar {
            flex: 1;
            min-width: 60px;
        }

        .panel-body {
            display: flex;
            flex-direction: column;
            gap: 0.25rem;
            padding: 0.5rem 0.75rem;
            border-top: solid var(--wa-border-width-s) var(--wa-color-neutral-border-subtle);
        }

        .step-row {
            display: flex;
            align-items: flex-start;
            gap: 0.5rem;
            padding: 0.25rem 0;
        }

        .step-info {
            display: flex;
            flex-direction: column;
            gap: 0.125rem;
            flex: 1;
            min-width: 0;
        }

        .step-role {
            font-size: 0.75rem;
            font-weight: 600;
            color: var(--wa-color-text-quiet);
            text-transform: uppercase;
        }

        .step-task {
            font-size: 0.85rem;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .revisions-badge {
            font-size: 0.7rem;
            padding: 0.1rem 0.3rem;
            background: var(--wa-color-warning-fill-quiet);
            border-radius: var(--wa-border-radius-s);
            color: var(--wa-color-warning-70);
            flex-shrink: 0;
        }

        @keyframes spin {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
    `;Ye([S({type:Object,attribute:!1})],le.prototype,"plan",2);Ye([C()],le.prototype,"expanded",2);le=Ye([D("lyra-ai-task-progress-panel")],le);var Nr=Object.defineProperty,Ur=Object.getOwnPropertyDescriptor,Te=(a,e,t,s)=>{for(var r=s>1?void 0:s?Ur(e,t):e,n=a.length-1,i;n>=0;n--)(i=a[n])&&(r=(s?i(e,t,r):i(r))||r);return s&&r&&Nr(e,t,r),r};const Lr={code:"code",json:"brackets-curly","file-list":"list",plan:"diagram-project",review:"magnifying-glass",text:"file-lines"};let Y=class extends W{constructor(){super(...arguments),this.artifacts=[],this.expanded=!1}render(){return this.artifacts.length===0?u``:u`
            <div class="workspace-panel">
                <div class="panel-header" @click="${()=>{this.expanded=!this.expanded,this.selectedArtifact=void 0}}">
                    <wa-icon name="folder-open" label="Workspace"></wa-icon>
                    <span class="panel-title">Workspace</span>
                    <span class="count-badge">${this.artifacts.length} artifact${this.artifacts.length!==1?"s":""}</span>
                    <wa-icon name="${this.expanded?"chevron-up":"chevron-down"}" label="toggle"></wa-icon>
                </div>
                ${A(this.expanded,()=>u`
                    <div class="panel-body">
                        <div class="artifact-list">
                            ${ce(this.artifacts,a=>a.id,a=>u`
                                <div
                                    class="artifact-item ${this.selectedArtifact?.id===a.id?"selected":""}"
                                    @click="${()=>{this.selectedArtifact=this.selectedArtifact?.id===a.id?void 0:a}}">
                                    <wa-icon name="${Lr[a.type]??"file-lines"}" label="${a.type}"></wa-icon>
                                    <div class="artifact-meta">
                                        <span class="artifact-id">${a.id}</span>
                                        <span class="artifact-producer">by ${a.producedBy}</span>
                                    </div>
                                    <span class="artifact-type">${a.type}</span>
                                </div>
                                ${A(this.selectedArtifact?.id===a.id,()=>u`
                                    <div class="artifact-content">
                                        <pre>${a.content}</pre>
                                    </div>
                                `)}
                            `)}
                        </div>
                    </div>
                `)}
            </div>
        `}};Y.styles=z`
        :host { display: block; }

        .workspace-panel {
            border: solid var(--wa-border-width-s) var(--wa-color-neutral-border-subtle);
            border-radius: var(--wa-border-radius-m);
            background: var(--wa-color-surface-default);
            margin: 0.5rem 0;
        }

        .panel-header {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 0.75rem;
            cursor: pointer;
            user-select: none;
        }

        .panel-title { font-weight: 500; }

        .count-badge {
            font-size: 0.8rem;
            color: var(--wa-color-text-quiet);
            margin-left: auto;
        }

        .panel-body {
            border-top: solid var(--wa-border-width-s) var(--wa-color-neutral-border-subtle);
        }

        .artifact-list { display: flex; flex-direction: column; }

        .artifact-item {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.4rem 0.75rem;
            cursor: pointer;
        }

        .artifact-item:hover { background: var(--wa-color-surface-lowered); }
        .artifact-item.selected { background: var(--wa-color-brand-fill-quiet); }

        .artifact-meta {
            display: flex;
            flex-direction: column;
            flex: 1;
            min-width: 0;
        }

        .artifact-id {
            font-size: 0.85rem;
            font-weight: 500;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }

        .artifact-producer {
            font-size: 0.75rem;
            color: var(--wa-color-text-quiet);
        }

        .artifact-type {
            font-size: 0.75rem;
            padding: 0.1rem 0.3rem;
            background: var(--wa-color-surface-lowered);
            border-radius: var(--wa-border-radius-s);
        }

        .artifact-content {
            padding: 0.5rem 0.75rem;
            border-top: solid var(--wa-border-width-s) var(--wa-color-neutral-border-subtle);
            background: var(--wa-color-surface-lowered);
        }

        .artifact-content pre {
            margin: 0;
            white-space: pre-wrap;
            word-break: breaword;
            font-size: 0.8rem;
            max-height: 200px;
            overflow-y: auto;
        }
    `;Te([S({type:Array,attribute:!1})],Y.prototype,"artifacts",2);Te([C()],Y.prototype,"expanded",2);Te([C()],Y.prototype,"selectedArtifact",2);Y=Te([D("lyra-ai-workspace-panel")],Y);var Br=Object.defineProperty,Gr=Object.getOwnPropertyDescriptor,j=(a,e,t,s)=>{for(var r=s>1?void 0:s?Gr(e,t):e,n=a.length-1,i;n>=0;n--)(i=a[n])&&(r=(s?i(e,t,r):i(r))||r);return s&&r&&Br(e,t,r),r};let O=class extends pt{constructor(){super(...arguments),this.sessionManager=new yr,this.streamManager=new kr(()=>{this.requestUpdate(),this.scrollDebounceTimer&&clearTimeout(this.scrollDebounceTimer),this.scrollDebounceTimer=setTimeout(async()=>{await this.updateComplete,this.scrollToBottom(),this.scrollDebounceTimer=void 0},100)}),this.providerManager=new xr(se),this.agentGroupManager=new Ar,this.busy=!1,this.inputValue="",this.requireToolApproval=!0,this.showHistory=!1,this.currentArtifacts=[],this.pendingToolApprovals=new Map,this.toolApprovalAllowlist=new Set}async doBeforeUI(){this.subscribe(Ne,()=>this.onAIConfigChanged()),await this.sessionManager.load(),this.sessionManager.getActiveSession()||this.sessionManager.createSession(),await this.providerManager.initialize(),await this.loadSettings(),this.requestUpdate()}async onAIConfigChanged(){await this.providerManager.initialize(),await this.loadSettings(),this.requestUpdate()}async loadSettings(){const a=await x.get(M)||{};this.requireToolApproval=a.requireToolApproval!==!1;const e=await this.providerManager.loadToolApprovalAllowlist();this.toolApprovalAllowlist=new Set(e)}async scrollToBottom(){await this.updateComplete;const a=this.shadowRoot?.querySelector("wa-scroller.chat-messages");if(!a)return;const e=a.shadowRoot?.querySelector(".scroll-container");e?e.scrollTop=e.scrollHeight:a.scrollTo&&a.scrollTo({top:a.scrollHeight,behavior:"smooth"})}resetViewState(){this.inputValue="",this.showHistory=!1,this.currentTaskPlan=void 0,this.currentArtifacts=[],this.requestUpdate(),this.updateToolbar()}createNewSession(){this.sessionManager.createSession(),this.resetViewState()}switchToSession(a){this.sessionManager.switchToSession(a)&&this.resetViewState()}deletePastSession(a){this.sessionManager.deletePastSession(a),this.requestUpdate(),this.updateToolbar()}async sendMessage(){const a=this.inputValue.trim();!a||this.busy||(this.inputValue="",await this.handlePrompt(a))}async handleResend(a){!a||a.role!=="user"||await this.handlePrompt(a.content)}cancelStream(){this.abortController?.abort(),this.abortController=void 0,this.busy=!1,this.streamManager.cancelUpdates()}async handlePrompt(a){if(a.startsWith("/")){await this.runCommand(a.substring(1));return}const e=this.providerManager.getSelectedProvider();if(!e){Z("Please configure an AI provider in settings");return}const t=this.sessionManager.getActiveSession();if(!t)return;const s=se.createMessage(a);this.sessionManager.addMessage(s),t.history.length===1&&(this.sessionManager.setTitle(this.sessionManager.generateTitle(a)),this.updateToolbar()),this.requestUpdate(),await this.updateComplete,this.scrollToBottom(),this.busy=!0,this.currentTaskPlan=void 0,this.currentArtifacts=[],this.abortController=new AbortController;const r=new Map,n={history:[...t.history]},i=t.id,o=N.createExecutionContext(),l=Gt.createChild({...o}),c=se.getAgentContributions();if(c.length===0){Z("No agents are registered."),this.busy=!1;return}const d=c.filter(p=>!p.canHandle||p.canHandle({...l.getProxy(),userPrompt:a})).sort((p,f)=>(f.priority||0)-(p.priority||0));if(d.length===0){Z(`No agents available. Available: ${c.map(p=>p.role).join(", ")}`),this.busy=!1;return}const h=d.map(p=>p.role),g=this.sessionManager.getActiveSession();if(!g)return;const m=this.agentGroupManager.createGroup(i,g.history.length-1,s,h,p=>{const f=c.find(w=>w.role===p);return{label:f?.label||p,icon:f?.icon||"robot"}});jt.runAsync("Calling AI assistant",async()=>se.executeAgentWorkflow({chatContext:n,chatConfig:e,callContext:l,execution:"parallel",stream:!0,signal:this.abortController.signal,roles:h,requireToolApproval:this.requireToolApproval,onToolApprovalRequest:async(p,f)=>f.toolCalls.every(k=>this.toolApprovalAllowlist.has(k.function.name))?!0:new Promise(k=>{const $=`approval-${Date.now()}-${Math.random().toString(36).slice(2,9)}`,y={role:p,request:f,resolve:k,alwaysAllowSelections:new Map};this.pendingToolApprovals.set($,y),this.requestUpdate()}),onAgentStart:async p=>{const f=this.streamManager.createStreamingMessage(p);r.set(p,f),this.agentGroupManager.updateAgentStatus(m,p,"streaming"),this.requestUpdate(),await this.updateComplete,this.scrollToBottom()},onToken:(p,f)=>{const w=r.get(p);w!==void 0&&this.streamManager.updateStreamingMessage(w,f)},onAgentComplete:async(p,f)=>{const w=this.sessionManager.getActiveSession();if(!w||w.id!==i)return;const k=r.get(p);if(k!==void 0){this.streamManager.completeStreamingMessage(k,f);const $=w.history.length;this.sessionManager.addMessage(f),r.delete(p),this.streamManager.removeStreamingMessage(k),this.agentGroupManager.updateAgentStatus(m,p,"completed",f,$),this.requestUpdate(),await this.updateComplete,this.scrollToBottom()}},onAgentError:(p,f)=>{const w=r.get(p);w!==void 0&&(this.streamManager.removeStreamingMessage(w),r.delete(p)),this.agentGroupManager.updateAgentStatus(m,p,"error",{role:p,content:`Error: ${f.message}`}),this.requestUpdate(),Z(`Agent ${p} error: ${f.message}`)}}).then(()=>{this.agentGroupManager.clearCurrentGroup()})).catch(p=>{p?.name!=="AbortError"&&Z(`${p}`)}).finally(async()=>{this.busy=!1,this.abortController=void 0,this.streamManager.reset(),this.agentGroupManager.clearCurrentGroup(),this.requestUpdate(),this.updateToolbar()})}async runCommand(a){const e=a.trim().split(/\s+/);if(e.length===0)return;const t=e.shift(),s=N.getCommand(t);if(!s){Z(`Command not found: ${t}`);return}const r={};e.forEach((n,i)=>{s.parameters?.[i]&&(r[s.parameters[i].name]=n)}),await N.execute(t,N.createExecutionContext(r)),this.requestUpdate()}handleToolApproval(a){const{approvalId:e,approval:t}=a.detail;Array.from(t.alwaysAllowSelections.entries()).filter(([,r])=>r).map(([r])=>r).forEach(r=>this.toolApprovalAllowlist.add(r)),this.pendingToolApprovals.delete(e),this.requestUpdate()}renderMessage(a,e,t=!1){return u`
            <lyra-ai-chat-message
                .message="${a}"
                .isStreaming="${t}"
                .showHeader="${!0}"
                .messageIndex="${e}"
                @resend="${s=>this.handleResend(s.detail.message)}">
            </lyra-ai-chat-message>
        `}renderToolbar(){const a=this.sessionManager.getPastSessions(),e=this.sessionManager.getActiveSession();return u`
            <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:0.875rem;font-weight:500;padding:0 0.25rem;">${e?.title||"New Chat"}</span>
            <wa-button appearance="plain" size="small" title="New chat"
                @click="${()=>this.createNewSession()}">
                <wa-icon name="plus" label="New chat"></wa-icon>
            </wa-button>
            ${a.length>0?u`
                <wa-dropdown
                    ?open="${this.showHistory}"
                    @wa-after-hide="${()=>{this.showHistory=!1}}"
                    placement="bottom-start">
                    <wa-button slot="trigger" appearance="plain" size="small" with-caret
                        title="Chat history"
                        @click="${()=>{this.showHistory=!this.showHistory}}">
                        <wa-icon name="clock-rotate-left" label="History"></wa-icon>
                    </wa-button>
                    ${a.map(t=>u`
                        <wa-dropdown-item @click="${()=>this.switchToSession(t.id)}">
                            <wa-icon name="message" label="Session" slot="icon"></wa-icon>
                            <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${t.title||"Unnamed Chat"}</span>
                            <wa-button slot="details" appearance="plain" size="small" title="Delete"
                                @click="${s=>{s.stopPropagation(),this.deletePastSession(t.id)}}">
                                <wa-icon name="trash" label="Delete"></wa-icon>
                            </wa-button>
                        </wa-dropdown-item>
                    `)}
                </wa-dropdown>
            `:Ht}
            <lyra-command cmd="open_ai_config" icon="gear" title="AI Settings"></lyra-command>
        `}render(){const a=this.sessionManager.getActiveSession(),e=this.providerManager.getSelectedProvider();return u`
            <div class="chat-container">
                <wa-scroller class="chat-messages" orientation="vertical">
                    <div class="chat-content">
                        ${A(!e,()=>u`
                            <lyra-ai-empty-state
                                message="No AI provider configured"
                                hint='Click the settings icon below to configure an AI provider'>
                            </lyra-ai-empty-state>
                        `,()=>A(!a||a.history.length===0,()=>u`
                            <lyra-ai-empty-state message="How can I help you?" hint=""></lyra-ai-empty-state>
                        `,()=>u`
                            ${a.history.map((t,s)=>{const r=this.agentGroupManager.findGroupForUserMessage(a.id,s,t);return r&&t.role==="user"?u`
                                        <lyra-ai-chat-message
                                            .message="${t}"
                                            .isStreaming="${!1}"
                                            .showHeader="${!0}"
                                            .messageIndex="${s}"
                                            @resend="${n=>this.handleResend(n.detail.message)}">
                                        </lyra-ai-chat-message>
                                        <lyra-ai-agent-response-group
                                            .group="${r}"
                                            .findStreamingMessage="${n=>this.streamManager.findStreamingMessage(n)}">
                                        </lyra-ai-agent-response-group>
                                    `:this.agentGroupManager.findGroupForMessage(a.id,t.role,s)?u``:this.renderMessage(t,s)})}

                            ${this.streamManager.getAllStreamingMessages().filter(t=>!this.agentGroupManager.getAllGroups().some(s=>s.sessionId===a.id&&s.agents.has(t.message.role))).map(t=>this.renderMessage(t.message,-1,t.isStreaming))}

                            ${A(this.busy&&this.streamManager.getAllStreamingMessages().length===0,()=>u`
                                <div class="thinking-indicator">
                                    <wa-progress-ring indeterminate size="small"></wa-progress-ring>
                                    <span>Thinking…</span>
                                </div>
                            `)}
                        `))}

                        ${A(this.currentTaskPlan,()=>u`
                            <lyra-ai-task-progress-panel .plan="${this.currentTaskPlan}"></lyra-ai-task-progress-panel>
                        `)}

                        ${A(this.currentArtifacts.length>0,()=>u`
                            <lyra-ai-workspace-panel .artifacts="${this.currentArtifacts}"></lyra-ai-workspace-panel>
                        `)}
                    </div>
                </wa-scroller>

                ${A(this.pendingToolApprovals.size>0,()=>u`
                    <lyra-ai-tool-approval
                        .pendingApprovals="${this.pendingToolApprovals}"
                        @approve="${t=>this.handleToolApproval(t)}">
                    </lyra-ai-tool-approval>
                `)}

                <div class="input-area">
                    <lyra-ai-chat-input
                        .value="${this.inputValue}"
                        .busy="${this.busy}"
                        .disabled="${!e}"
                        .hasProvider="${!!e}"
                        @input-change="${t=>{this.inputValue=t.detail.value}}"
                        @send="${t=>{this.inputValue=t.detail.value,this.sendMessage()}}"
                        @cancel="${()=>this.cancelStream()}">
                    </lyra-ai-chat-input>
                </div>
            </div>
        `}};O.styles=z`
        :host {
            display: flex;
            flex-direction: column;
            height: 100%;
            overflow: hidden;
            background: var(--wa-color-surface-default);
        }

        .chat-container {
            display: flex;
            flex-direction: column;
            height: 100%;
            overflow: hidden;
        }

        .chat-messages {
            flex: 1;
            overflow: hidden;
        }

        .chat-content {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            padding: 1rem;
            min-height: 100%;
            box-sizing: border-box;
        }

        .thinking-indicator {
            display: flex;
            align-items: center;
            gap: 0.5rem;
            padding: 0.5rem 0.75rem;
            color: var(--wa-color-text-quiet);
            font-size: 0.875rem;
        }

        .input-area {
            padding: 0.5rem;
            border-top: solid var(--wa-border-width-s) var(--wa-color-neutral-border-subtle);
            flex-shrink: 0;
        }
    `;j([C()],O.prototype,"busy",2);j([C()],O.prototype,"inputValue",2);j([C()],O.prototype,"requireToolApproval",2);j([C()],O.prototype,"showHistory",2);j([C()],O.prototype,"currentTaskPlan",2);j([C()],O.prototype,"currentArtifacts",2);j([C()],O.prototype,"pendingToolApprovals",2);O=j([D("lyra-aiview")],O);var jr=Object.getOwnPropertyDescriptor,Hr=(a,e,t,s)=>{for(var r=s>1?void 0:s?jr(e,t):e,n=a.length-1,i;n>=0;n--)(i=a[n])&&(r=i(r)||r);return r};let De=class extends Ft{constructor(){super(...arguments),this.totalUsage={...J},this.providerUsage={}}connectedCallback(){super.connectedCallback(),this.loadUsage(),we(ht,()=>{this.loadUsage()})}async loadUsage(){this.totalUsage=await me.getTotalUsage(),this.providerUsage=await me.getAllProviderUsage(),this.requestUpdate()}formatNumber(a){return a>=1e6?(a/1e6).toFixed(2)+"M":a>=1e3?(a/1e3).toFixed(1)+"K":a.toString()}async handleReset(){await dt("Reset all token usage statistics?")&&(await me.reset(),await this.loadUsage())}renderStatItem(a,e){return u`
            <div class="stat-item">
                <span class="stat-label">${a}</span>
                <span class="stat-value">${this.formatNumber(e)}</span>
            </div>
        `}render(){return this.totalUsage.totalTokens===0?u``:u`
            <wa-dropdown placement="top-end" distance="8">
                <wa-button slot="trigger" appearance="plain" size="small" title="Token usage">
                    <wa-icon name="database" label="Tokens" slot="start"></wa-icon>
                    ${this.formatNumber(this.totalUsage.totalTokens)} tokens
                </wa-button>

                <h3>Token Usage</h3>

                <h6>Total</h6>
                <wa-dropdown-item>
                    <span>All providers</span>
                    <div class="stats-row">
                        ${this.renderStatItem("Prompt",this.totalUsage.promptTokens)}
                        ${this.renderStatItem("Completion",this.totalUsage.completionTokens)}
                        ${this.renderStatItem("Total",this.totalUsage.totalTokens)}
                        ${this.renderStatItem("Requests",this.totalUsage.requestCount)}
                    </div>
                </wa-dropdown-item>

                ${Object.keys(this.providerUsage).length>0?u`
                    <wa-divider></wa-divider>
                    <h6>By Provider</h6>
                    ${Object.entries(this.providerUsage).map(([a,e])=>u`
                        <wa-dropdown-item>
                            <span class="provider-name">${a}</span>
                            <div class="stats-row">
                                ${this.renderStatItem("Prompt",e.promptTokens)}
                                ${this.renderStatItem("Completion",e.completionTokens)}
                                ${this.renderStatItem("Total",e.totalTokens)}
                                ${this.renderStatItem("Req",e.requestCount)}
                            </div>
                        </wa-dropdown-item>
                    `)}
                `:""}

                <wa-divider></wa-divider>
                <wa-dropdown-item variant="danger" @click="${()=>this.handleReset()}">
                    <wa-icon name="trash" slot="icon"></wa-icon>
                    Reset statistics
                </wa-dropdown-item>
            </wa-dropdown>
        `}};De.styles=z`
        :host { display: inline-block; }

        wa-dropdown::part(menu) { min-width: 320px; max-width: 420px; }

        h3 {
            padding: var(--wa-space-s) var(--wa-space-m);
            margin: 0;
            font-weight: 600;
            font-size: 0.95em;
        }

        h6 {
            padding: var(--wa-space-xs) var(--wa-space-m);
            margin: 0;
            font-weight: 600;
            font-size: 0.85em;
            color: var(--wa-color-neutral-text-subtle);
            text-transform: uppercase;
            letter-spacing: 0.05em;
        }

        .provider-name { font-weight: 500; }

        .stats-row { display: flex; gap: var(--wa-space-m); font-size: 0.875rem; }

        .stat-item {
            display: flex;
            flex-direction: column;
            align-items: flex-end;
        }

        .stat-label { font-size: 0.8em; color: var(--wa-color-neutral-text-subtle); }
        .stat-value { font-weight: 600; }
    `;De=Hr([D("lyra-token-usage")],De);var Fr=Object.defineProperty,Wr=Object.getOwnPropertyDescriptor,q=(a,e,t,s)=>{for(var r=s>1?void 0:s?Wr(e,t):e,n=a.length-1,i;n>=0;n--)(i=a[n])&&(r=(s?i(e,t,r):i(r))||r);return s&&r&&Fr(e,t,r),r};let _=class extends pt{constructor(){super(...arguments),this.providers=[],this.defaultProvider="",this.hasChanges=!1,this.availableModels=[],this.loadingModels=!1,this.requireToolApproval=!0,this.smartToolDetection=!1,this.editingState={},this.providerFactory=new pe}async doInitUI(){await this.loadConfig(),we(Ne,()=>this.loadConfig()),we(ct,()=>this.loadConfig())}async loadConfig(){const a=await x.get(M);this.aiConfig=a;const e=U.getContributions(ve).map(r=>r.provider),t=a?.providers||[],s=new Set(t.map(r=>r.name));this.providers=[...t,...e.filter(r=>!s.has(r.name))],this.defaultProvider=a?.defaultProvider||"",this.requireToolApproval=a?.requireToolApproval!==!1,this.smartToolDetection=a?.smartToolDetection!==void 0?a.smartToolDetection:!1,this.editingState={},this.hasChanges=!1,this.markDirty(!1)}getEditValue(a,e){const t=this.editingState[a];if(t&&e in t)return t[e]??"";const s=this.providers[a];return s?s[e]??"":""}setEditValue(a,e,t){this.editingState={...this.editingState,[a]:{...this.editingState[a]||{},[e]:t}},this.providers=this.providers.map((s,r)=>r===a?{...s,[e]:t}:s),this.markDirtyAndUpdate()}markDirtyAndUpdate(){this.hasChanges=!0,this.markDirty(!0)}async fetchModels(a){const e=this.providers[a];if(e){this.loadingModels=!0,this.availableModels=[];try{const t=this.providerFactory.getProvider(e);if(t.getAvailableModels){const s=await t.getAvailableModels(e);this.availableModels=Array.isArray(s)?s:[]}}finally{this.loadingModels=!1}}}async saveConfig(){const a={...this.aiConfig??{},defaultProvider:this.defaultProvider,providers:this.providers,requireToolApproval:this.requireToolApproval,smartToolDetection:this.smartToolDetection};await x.set(M,a),this.aiConfig=a,this.hasChanges=!1,this.markDirty(!1)}async save(){this.hasChanges&&await this.saveConfig()}addProvider(){this.providers=[...this.providers,{name:"new-provider",model:"",apiKey:"",chatApiEndpoint:""}],this.markDirtyAndUpdate()}async deleteProvider(a){const e=this.providers[a];await dt(`Delete provider "${e.name}"?`)&&(this.defaultProvider===e.name&&(this.defaultProvider=""),this.providers=this.providers.filter((t,s)=>s!==a),this.markDirtyAndUpdate())}renderProviderField(a,e,t="text"){const s=this.getEditValue(a,e);return u`
            <wa-input
                type="${t}"
                ?password-toggle="${t==="password"}"
                .value="${s}"
                @input="${r=>this.setEditValue(a,e,r.target.value)}">
            </wa-input>
        `}render(){return u`
            <div class="editor">
                <div class="editor-header">
                    <h2>AI Providers</h2>
                    <wa-button variant="brand" appearance="filled" @click="${this.addProvider}">
                        Add Provider
                    </wa-button>
                </div>

                ${A(this.providers.length===0,()=>u`
                    <div class="empty-state"><p>No providers configured.</p></div>
                `,()=>u`
                    <div class="providers-list">
                        ${ce(this.providers,(a,e)=>e,(a,e)=>u`
                            <div class="provider-card">
                                <div class="provider-card-header ${this.defaultProvider===a.name?"is-default":""}">
                                    <span class="provider-name">${a.name}</span>
                                    ${this.defaultProvider===a.name?u`<span class="default-badge">Default</span>`:u`<wa-button appearance="plain" size="small" title="Set as default"
                                                @click="${()=>{this.defaultProvider=a.name,this.markDirtyAndUpdate()}}">
                                                Set default
                                            </wa-button>`}
                                    <wa-button variant="danger" appearance="plain" size="small"
                                        @click="${()=>this.deleteProvider(e)}">
                                        Delete
                                    </wa-button>
                                </div>
                                <div class="provider-fields">
                                    <div class="field-row">
                                        <label>Name</label>
                                        ${this.renderProviderField(e,"name")}
                                    </div>
                                    <div class="field-row">
                                        <label>Model</label>
                                        <div class="model-row">
                                            ${this.renderProviderField(e,"model")}
                                            <wa-button appearance="plain" size="small"
                                                @click="${async()=>{await this.fetchModels(e)}}"
                                                title="Fetch available models">
                                                <wa-icon name="refresh" label="Refresh"></wa-icon>
                                            </wa-button>
                                        </div>
                                        ${A(this.loadingModels,()=>u`
                                            <wa-progress-ring indeterminate size="small"></wa-progress-ring>
                                        `)}
                                        ${A(this.availableModels.length>0,()=>u`
                                            <wa-dropdown
                                                @wa-select="${t=>{t.detail.item?.value&&this.setEditValue(e,"model",t.detail.item.value)}}">
                                                <wa-button slot="trigger" size="small" appearance="plain" with-caret>
                                                    Select model
                                                </wa-button>
                                                ${this.availableModels.map(t=>u`
                                                    <wa-dropdown-item value="${t.id}">${t.name||t.id}</wa-dropdown-item>
                                                `)}
                                            </wa-dropdown>
                                        `)}
                                    </div>
                                    <div class="field-row">
                                        <label>API Endpoint</label>
                                        ${this.renderProviderField(e,"chatApiEndpoint")}
                                    </div>
                                    <div class="field-row">
                                        <label>API Key</label>
                                        ${this.renderProviderField(e,"apiKey","password")}
                                    </div>
                                </div>
                            </div>
                        `)}
                    </div>
                `)}

                <div class="settings-section">
                    <h3>Tool Settings</h3>
                    <wa-checkbox
                        ?checked="${this.requireToolApproval}"
                        @change="${a=>{this.requireToolApproval=a.target.checked,this.markDirtyAndUpdate()}}">
                        Require approval before executing tools
                    </wa-checkbox>
                    <wa-checkbox
                        ?checked="${this.smartToolDetection}"
                        @change="${a=>{this.smartToolDetection=a.target.checked,this.markDirtyAndUpdate()}}">
                        Smart tool detection (use ML to detect when tools are needed)
                    </wa-checkbox>
                </div>
            </div>
        `}};_.styles=z`
        :host { display: block; height: 100%; overflow: auto; }

        .editor {
            display: flex;
            flex-direction: column;
            gap: 1.5rem;
            padding: 1rem;
        }

        .editor-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .editor-header h2 { margin: 0; font-size: 1.25rem; }

        .providers-list { display: flex; flex-direction: column; gap: 1rem; }

        .provider-card {
            border: solid var(--wa-border-width-s) var(--wa-color-neutral-border-loud);
            border-radius: var(--wa-border-radius-m);
            overflow: hidden;
        }

        .provider-card-header {
            display: flex;
            align-items: center;
            gap: 0.75rem;
            padding: 0.5rem 0.75rem;
            background: var(--wa-color-surface-lowered);
            border-bottom: solid var(--wa-border-width-s) var(--wa-color-neutral-border-subtle);
        }

        .provider-card-header.is-default {
            background: var(--wa-color-brand-fill-quiet);
            border-bottom-color: var(--wa-color-brand-border-quiet);
        }

        .default-badge {
            font-size: 0.75rem;
            font-weight: 600;
            padding: 0.1rem 0.4rem;
            background: var(--wa-color-brand-fill-loud);
            color: var(--wa-color-brand-on-loud);
            border-radius: var(--wa-border-radius-s);
            text-transform: uppercase;
            letter-spacing: 0.04em;
        }

        .provider-name {
            font-weight: 500;
            flex: 1;
        }

        .provider-fields {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            padding: 0.75rem;
        }

        .field-row {
            display: grid;
            grid-template-columns: 120px 1fr;
            align-items: start;
            gap: 0.5rem;
        }

        .field-row label {
            font-size: 0.875rem;
            color: var(--wa-color-text-quiet);
            padding-top: 0.4rem;
        }

        .model-row { display: flex; gap: 0.25rem; align-items: center; }
        .model-row wa-input { flex: 1; }

        .settings-section {
            display: flex;
            flex-direction: column;
            gap: 0.75rem;
            padding-top: 1rem;
            border-top: solid var(--wa-border-width-s) var(--wa-color-neutral-border-subtle);
        }

        .settings-section h3 { margin: 0 0 0.5rem 0; font-size: 1rem; }

        .empty-state {
            display: flex;
            justify-content: center;
            padding: 3rem;
            color: var(--wa-color-text-subtle);
        }
    `;q([S({attribute:!1})],_.prototype,"input",2);q([C()],_.prototype,"providers",2);q([C()],_.prototype,"defaultProvider",2);q([C()],_.prototype,"hasChanges",2);q([C()],_.prototype,"availableModels",2);q([C()],_.prototype,"loadingModels",2);q([C()],_.prototype,"requireToolApproval",2);q([C()],_.prototype,"smartToolDetection",2);q([C()],_.prototype,"editingState",2);_=q([D("lyra-ai-config-editor")],_);U.registerContribution(qt,{name:"aiview",label:"AI Assistant",icon:"robot",component:a=>u`<lyra-aiview id="${a}"></lyra-aiview>`});U.registerContribution(ut,{label:"App Support",description:"General-purpose assistant that can answer questions and execute app commands",role:"appsupport",priority:100,icon:"question-circle",sysPrompt:wr,tools:async()=>({enabled:!0,smartToolDetection:(await x.get(M))?.smartToolDetection??!1})});U.registerContribution(Xe,{target:Xe,label:"Token Usage",component:"<lyra-token-usage></lyra-token-usage>"});qe.registerEditorInputHandler({editorId:"system.ai-config-editor",label:"AI Config",ranking:1e3,canHandle:a=>a.key===".system.ai-config",handle:async a=>(a.component=()=>u`<lyra-ai-config-editor .input="${a}"></lyra-ai-config-editor>`,a)});Nt({command:{id:"open_ai_config",name:"Open AI Configuration",description:"Open the AI system configuration editor",parameters:[]},handler:{execute:a=>{const e={title:"AI Settings",data:{},key:".system.ai-config",icon:"robot",state:{}};qe.loadEditor(e).then()}},contribution:{target:Ut,icon:"robot",label:"AI Config"}});te.put("aiService",se);
