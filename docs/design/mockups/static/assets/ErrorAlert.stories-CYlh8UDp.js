import{E as k}from"./ErrorAlert-DJ3NJZQx.js";import"./jsx-runtime-D_zvdyIk.js";import"./index-JhL3uwfD.js";import"./i18nInstance-DbGJisJM.js";const A={title:"Components/ErrorAlert",component:k},e={args:{message:"Search failed. The server may be unavailable.",onRetry:()=>{},showGoBack:!0}},r={args:{message:"Nonce mismatch. Please use the challenge from the last response.",nextAction:"Retry kairos_next with the fresh challenge below.",onRetry:()=>{},showGoBack:!0}},s={args:{message:"Connection lost.",onRetry:()=>{},showGoBack:!1}};var o,t,a,n,c;e.parameters={...e.parameters,docs:{...(o=e.parameters)==null?void 0:o.docs,source:{originalSource:`{
  args: {
    message: "Search failed. The server may be unavailable.",
    onRetry: () => {},
    showGoBack: true
  }
}`,...(a=(t=e.parameters)==null?void 0:t.docs)==null?void 0:a.source},description:{story:"Default: message, retry, go back (mockup 04).",...(c=(n=e.parameters)==null?void 0:n.docs)==null?void 0:c.description}}};var i,m,l,p,h;r.parameters={...r.parameters,docs:{...(i=r.parameters)==null?void 0:i.docs,source:{originalSource:`{
  args: {
    message: "Nonce mismatch. Please use the challenge from the last response.",
    nextAction: "Retry kairos_next with the fresh challenge below.",
    onRetry: () => {},
    showGoBack: true
  }
}`,...(l=(m=r.parameters)==null?void 0:m.docs)==null?void 0:l.source},description:{story:"With next_action from API.",...(h=(p=r.parameters)==null?void 0:p.docs)==null?void 0:h.description}}};var d,g,u,y,f;s.parameters={...s.parameters,docs:{...(d=s.parameters)==null?void 0:d.docs,source:{originalSource:`{
  args: {
    message: "Connection lost.",
    onRetry: () => {},
    showGoBack: false
  }
}`,...(u=(g=s.parameters)==null?void 0:g.docs)==null?void 0:u.source},description:{story:"Retry only, no go back.",...(f=(y=s.parameters)==null?void 0:y.docs)==null?void 0:f.description}}};const B=["Default","WithNextAction","RetryOnly"];export{e as Default,s as RetryOnly,r as WithNextAction,B as __namedExportsOrder,A as default};
